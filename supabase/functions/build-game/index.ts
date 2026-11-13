// build-game: turns the players' quiz answers into one game's worth of content.
//
//   POST { "roomId": "<uuid>" }
//   -> 200 { ok: true, source: "ai" | "backup", saved: boolean, note?: string }
//   -> 4xx/5xx { ok: false, error: "what went wrong" }
//
// One call to Gemini. If that fails, times out (15 s) or returns something that does not
// validate, the content is built from backup-content.json instead, so the game always starts.
//
// Secrets (set with `supabase secrets set`, see SETUP.md):
//   GEMINI_API_KEY  required for the AI path. Without it the backup is used.
//   GEMINI_MODEL    optional. Defaults to DEFAULT_MODEL below.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// The files in ../_shared are generated copies of src/shared and src/data (`npm run sync`).

import { createClient } from 'npm:@supabase/supabase-js@2'
import backupJson from '../_shared/backup-content.json' with { type: 'json' }
import spotsJson from '../_shared/spots.json' with { type: 'json' }
import { buildBackupContent, fitWitCount } from '../_shared/backup.ts'
import { averageLocation, estimateMinutes, rankSpots } from '../_shared/geo.ts'
import { aiNames } from '../_shared/profile.ts'
import { SYSTEM_PROMPT, userPrompt } from '../_shared/prompts.ts'
import { hangoutForSpot, rankHangoutSpots } from '../_shared/hangout.ts'
import { MIN_PLAYERS, QUICK_PLAY_PROMPTS } from '../_shared/quiz.ts'
import type { BackupContent, GameContent, PlayerRow, RoomRow, Spot } from '../_shared/types.ts'
import { validateContent } from '../_shared/validate.ts'

// TODO(team): check Google's docs for the current free-tier Flash model name before the demo:
//   https://aistudio.google.com/docs/models   (model ids)
//   https://aistudio.google.com/docs/pricing  (which ones have a free tier)
// "gemini-3.6-flash" was the stable free-tier Flash model when this was written (Nov 2026).
// To change it without redeploying: supabase secrets set GEMINI_MODEL=<model id>
const DEFAULT_MODEL = 'gemini-3.6-flash'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const GEMINI_TIMEOUT_MS = 15_000

const SPOTS = spotsJson as Spot[]
const BACKUP = backupJson as BackupContent

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** JSON Schema for the reply. The counts are also checked by validateContent afterwards. */
function responseSchema() {
  // Only basic keywords (type, properties, required, items) so the schema is accepted as is.
  // The exact counts are stated in the prompt and enforced by validateContent.
  const strings = () => ({ type: 'array', items: { type: 'string' } })
  return {
    type: 'object',
    properties: {
      tierlist: {
        type: 'object',
        properties: { topic: { type: 'string' }, reason: { type: 'string' }, items: strings() },
        required: ['topic', 'reason', 'items'],
      },
      wit: {
        type: 'array',
        items: {
          type: 'object',
          properties: { prompt: { type: 'string' }, players: strings() },
          required: ['prompt', 'players'],
        },
      },
      realtalk: {
        type: 'object',
        properties: { light: strings(), real: strings(), deep: strings() },
        required: ['light', 'real', 'deep'],
      },
      hangout: {
        type: 'object',
        properties: { activity: { type: 'string' }, spot_id: { type: 'string' }, why: strings() },
        required: ['activity', 'spot_id', 'why'],
      },
      fun_facts: strings(),
    },
    required: ['tierlist', 'wit', 'realtalk', 'hangout', 'fun_facts'],
  }
}

/** Calls Gemini once and returns the parsed JSON. Throws on any failure, including the timeout. */
async function askGemini(apiKey: string, model: string, prompt: string): Promise<unknown> {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': '2026-05-20',
    },
    body: JSON.stringify({
      model,
      system_instruction: SYSTEM_PROMPT,
      input: prompt,
      // Nothing here needs to be kept on Google's side.
      store: false,
      generation_config: { thinking_level: 'low' },
      response_format: { type: 'text', mime_type: 'application/json', schema: responseSchema() },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw new Error(`Gemini returned HTTP ${response.status}: ${detail}`)
  }

  const interaction = await response.json()
  if (interaction.status && interaction.status !== 'completed') {
    throw new Error(`Gemini interaction status was "${interaction.status}"`)
  }
  // The reply text is in the model_output steps.
  const text = (interaction.steps ?? [])
    .filter((step: { type?: string }) => step.type === 'model_output')
    .flatMap((step: { content?: { type?: string; text?: string }[] }) => step.content ?? [])
    .filter((block: { type?: string }) => block.type === 'text')
    .map((block: { text?: string }) => block.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error('Gemini returned no text')

  // Tolerate a ```json fence even though we asked for bare JSON.
  const bare = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(bare)
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST with a JSON body: { "roomId": "..." }' }, 405)

  let roomId: unknown
  try {
    roomId = (await req.json())?.roomId
  } catch {
    return json({ ok: false, error: 'Body must be JSON: { "roomId": "..." }' }, 400)
  }
  if (typeof roomId !== 'string' || !/^[0-9a-f-]{36}$/i.test(roomId)) {
    return json({ ok: false, error: 'roomId must be the room\'s uuid' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in the function environment' }, 500)
  }
  // Service role: needed to read player_locations, which the browser cannot.
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  try {
    const { data: room, error: roomError } = await db.from('rooms').select().eq('id', roomId).maybeSingle<RoomRow>()
    if (roomError) return json({ ok: false, error: `Could not load the room: ${roomError.message}` }, 500)
    if (!room) return json({ ok: false, error: 'No room with that id' }, 404)

    const { data: playerRows, error: playersError } = await db
      .from('players')
      .select()
      .eq('room_id', roomId)
      .order('joined_at')
    if (playersError) return json({ ok: false, error: `Could not load players: ${playersError.message}` }, 500)
    const players = (playerRows ?? []) as PlayerRow[]
    if (players.length < MIN_PLAYERS) {
      return json({ ok: false, error: `Need at least ${MIN_PLAYERS} players, found ${players.length}` }, 400)
    }

    // Location is used here only, to order the spots and estimate travel time.
    const { data: locationRows } = await db.from('player_locations').select('lat, lng').eq('room_id', roomId)
    const locations = (locationRows ?? []).map((l) => ({ lat: Number(l.lat), lng: Number(l.lng) }))
    const center = averageLocation(locations, players.length)
    const rankedSpots = rankHangoutSpots(players, rankSpots(SPOTS, center))

    const witCount = room.quick_play ? QUICK_PLAY_PROMPTS : Math.max(MIN_PLAYERS, players.length)
    const { nameOf, aliases } = aiNames(players)

    let content: GameContent | null = null
    let source: 'ai' | 'backup' = 'backup'
    let note: string | undefined

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL
    if (!apiKey) {
      note = 'GEMINI_API_KEY is not set, so the backup content was used'
    } else {
      try {
        const raw = await askGemini(apiKey, model, userPrompt(players, rankedSpots, witCount, nameOf))
        const checked = validateContent(raw, {
          playerNames: players.map((p) => p.name),
          aliases,
          spotIds: rankedSpots.map((s) => s.id),
          preferredHangout: rankedSpots[0] ? hangoutForSpot(players, rankedSpots[0]) : undefined,
        })
        if (!checked.ok) throw new Error(`AI content failed validation: ${checked.error}`)
        content = fitWitCount(checked.content, players, BACKUP, witCount, room.round - 1)
        source = 'ai'
      } catch (e) {
        const reason = e instanceof Error ? (e.name === 'TimeoutError' ? 'Gemini took longer than 15 s' : e.message) : String(e)
        note = `${reason}, so the backup content was used`
        console.error('build-game: AI path failed:', reason)
      }
    }

    if (!content) {
      content = buildBackupContent(players, BACKUP, rankedSpots, { witCount, seed: room.round - 1 })
      source = 'backup'
    }

    const spot = SPOTS.find((s) => s.id === content!.hangout.spot_id)
    content.computed = {
      minutes_away: center && spot ? estimateMinutes(center, spot) : null,
      ...(note ? { note } : {}),
    }

    // Only save while the room is still waiting for this build. If the host gave up and
    // built the backup itself, leave that in place.
    const { data: saved, error: saveError } = await db
      .from('rooms')
      .update({ content, content_source: source, build_status: 'ready' })
      .eq('id', roomId)
      .eq('build_status', 'building')
      .eq('round', room.round)
      .select('id')
    if (saveError) return json({ ok: false, error: `Could not save the content: ${saveError.message}` }, 500)

    return json({ ok: true, source, saved: (saved ?? []).length > 0, ...(note ? { note } : {}) })
  } catch (e) {
    console.error('build-game: unexpected error:', e)
    return json({ ok: false, error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
