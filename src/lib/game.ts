// Client-side content helpers: calling build-game, the local backup, and lookups.

import backupJson from '../data/backup-content.json'
import spotsJson from '../data/spots.json'
import { rankSpots } from '../shared/geo.ts'
import { buildBackupContent } from '../shared/backup.ts'
import { MIN_PLAYERS, QUICK_PLAY_PROMPTS } from '../shared/quiz.ts'
import { REAL_TALK_QUESTIONS } from '../shared/question-bank.ts'
import { REALTALK_LEVELS } from '../shared/types.ts'
import type { BackupContent, GameContent, PlayerRow, RealTalkLevel, RoomRow, Spot } from '../shared/types.ts'
import { supabase } from './supabase.ts'

export const SPOTS = spotsJson as Spot[]
export const BACKUP = backupJson as BackupContent

export function spotById(id: string | undefined): Spot | undefined {
  return SPOTS.find((s) => s.id === id)
}

/** Quick play: 2 prompts. Full game: one prompt per player, so everyone answers twice. */
export function witCountFor(quickPlay: boolean, playerCount: number): number {
  return quickPlay ? QUICK_PLAY_PROMPTS : Math.max(MIN_PLAYERS, playerCount)
}

const BUILD_TIMEOUT_MS = 25_000

/**
 * Asks the build-game Edge Function to generate content and save it on the room.
 * If the function cannot be reached (not deployed, offline, too slow), builds the same
 * backup content right here so the game can always start.
 */
export async function buildGame(room: RoomRow, players: PlayerRow[]): Promise<'function' | 'local'> {
  let problem: string
  try {
    const call = supabase.functions.invoke('build-game', { body: { roomId: room.id } })
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out after 25 s')), BUILD_TIMEOUT_MS),
    )
    const { data, error } = await Promise.race([call, timeout])
    if (!error && data?.ok) return 'function'
    problem = error?.message ?? data?.error ?? 'unexpected response'
  } catch (e) {
    problem = e instanceof Error ? e.message : String(e)
  }

  console.warn('build-game unavailable, building backup content locally:', problem)
  const content = localBackup(room, players, `Built on the host screen because build-game failed: ${problem}`)
  const { error } = await supabase.from('rooms')
    .update({ content, content_source: 'backup', build_status: 'ready' })
    .eq('id', room.id).eq('round', room.round).eq('build_status', 'building')
  if (error) throw new Error(error.message)
  return 'local'
}

export function localBackup(room: RoomRow, players: PlayerRow[], note?: string): GameContent {
  const content = buildBackupContent(players, BACKUP, rankSpots(SPOTS, null), {
    witCount: witCountFor(room.quick_play, players.length),
    seed: room.round - 1,
  })
  // Location is not readable from the browser, so there is no distance estimate here.
  content.computed = { minutes_away: null, ...(note ? { note } : {}) }
  return content
}

/** Spare Real Talk questions for a level, leaving out ones already in the game. */
export function spareQuestions(level: RealTalkLevel, content: GameContent | null, alsoAvoid: string[] = []): string[] {
  const taken = new Set([...(content ? REALTALK_LEVELS.flatMap((l) => content.realtalk[l]) : []), ...alsoAvoid])
  const all = [REAL_TALK_QUESTIONS[level], BACKUP.general.realtalk[level], ...Object.values(BACKUP.categories).map((c) => c.realtalk[level])].flat()
  return [...new Set(all)].filter((q) => !taken.has(q))
}

export function randomFrom<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)]
}
