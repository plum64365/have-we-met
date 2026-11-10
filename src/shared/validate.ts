import type { GameContent } from './types.ts'

export interface ValidateContext {
  /** Display names of the players in the room. */
  playerNames: string[]
  /** Other names the AI may have used (lower case) mapped to display names. */
  aliases?: Record<string, string>
  /** Valid spot ids, best first. An unknown spot_id is replaced by the first one. */
  spotIds: string[]
}

export type ValidateResult = { ok: true; content: GameContent } | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

/** A list of at least `min` non-empty strings, cut down to `max` entries. */
function textList(v: unknown, min: number, max: number, maxLen: number): string[] | null {
  if (!Array.isArray(v)) return null
  const out = v.map((x) => text(x, maxLen)).filter((x): x is string => x !== null)
  return out.length >= min ? out.slice(0, max) : null
}

/**
 * Turns whatever names came back into two different real players. Unknown names are
 * dropped and gaps are filled with whoever has had the fewest prompts so far.
 */
function repairPair(raw: unknown, ctx: ValidateContext, used: Map<string, number>): string[] {
  const names = ctx.playerNames
  if (names.length < 2) return [...names]
  const resolve = (n: unknown): string | null => {
    if (typeof n !== 'string') return null
    const key = n.trim().toLowerCase()
    return names.find((p) => p.toLowerCase() === key) ?? ctx.aliases?.[key] ?? null
  }
  const pair: string[] = []
  for (const n of Array.isArray(raw) ? raw : []) {
    const name = resolve(n)
    if (name && !pair.includes(name) && pair.length < 2) pair.push(name)
  }
  while (pair.length < 2) {
    const next = names
      .filter((n) => !pair.includes(n))
      .sort((x, y) => (used.get(x) ?? 0) - (used.get(y) ?? 0))[0]
    pair.push(next)
  }
  for (const n of pair) used.set(n, (used.get(n) ?? 0) + 1)
  return pair
}

/**
 * Checks AI or wizard content against the shape the game needs. Small problems are
 * repaired (extra items, unknown player names, unknown spot); missing or wrong-typed
 * sections fail with a message that says which part was wrong.
 */
export function validateContent(raw: unknown, ctx: ValidateContext): ValidateResult {
  if (!isRecord(raw)) return { ok: false, error: 'Content is not a JSON object' }

  const tl = raw.tierlist
  if (!isRecord(tl)) return { ok: false, error: 'tierlist is missing' }
  const topic = text(tl.topic, 60)
  if (!topic) return { ok: false, error: 'tierlist.topic is empty' }
  const items = textList(tl.items, 8, 8, 40)
  if (!items) return { ok: false, error: 'tierlist.items needs exactly 8 items' }
  if (new Set(items.map((i) => i.toLowerCase())).size !== 8) {
    return { ok: false, error: 'tierlist.items has duplicates' }
  }
  const reason = text(tl.reason, 120) ?? 'Picked for this group'

  if (!Array.isArray(raw.wit) || raw.wit.length === 0) return { ok: false, error: 'wit needs at least 1 prompt' }
  const used = new Map<string, number>()
  const wit: GameContent['wit'] = []
  for (const [i, w] of raw.wit.entries()) {
    if (!isRecord(w)) return { ok: false, error: `wit[${i}] is not an object` }
    const prompt = text(w.prompt, 160)
    if (!prompt) return { ok: false, error: `wit[${i}].prompt is empty` }
    wit.push({ prompt, players: repairPair(w.players, ctx, used) })
  }

  const rt = raw.realtalk
  if (!isRecord(rt)) return { ok: false, error: 'realtalk is missing' }
  const light = textList(rt.light, 3, 3, 180)
  const real = textList(rt.real, 3, 3, 180)
  const deep = textList(rt.deep, 3, 3, 180)
  if (!light || !real || !deep) return { ok: false, error: 'realtalk needs 3 questions each for light, real and deep' }

  const h = raw.hangout
  if (!isRecord(h)) return { ok: false, error: 'hangout is missing' }
  const activity = text(h.activity, 140)
  if (!activity) return { ok: false, error: 'hangout.activity is empty' }
  const why = textList(h.why, 1, 3, 48)
  if (!why) return { ok: false, error: 'hangout.why needs 2-3 short chips' }
  let spotId = text(h.spot_id, 60) ?? ''
  if (!ctx.spotIds.includes(spotId)) {
    if (ctx.spotIds.length === 0) return { ok: false, error: 'hangout.spot_id is not in the spots list' }
    spotId = ctx.spotIds[0]
  }

  const funFacts = textList(raw.fun_facts, 1, 3, 100)
  if (!funFacts) return { ok: false, error: 'fun_facts needs 2-3 lines' }

  const content: GameContent = {
    tierlist: { topic, reason, items },
    wit,
    realtalk: { light, real, deep },
    hangout: { activity, spot_id: spotId, why },
    fun_facts: funFacts,
  }

  // Keep our own computed block if the caller (the wizard) passed it back.
  const c = raw.computed
  if (isRecord(c)) {
    content.computed = {
      minutes_away: typeof c.minutes_away === 'number' && Number.isFinite(c.minutes_away) ? c.minutes_away : null,
      ...(typeof c.note === 'string' ? { note: c.note } : {}),
    }
  }
  return { ok: true, content }
}
