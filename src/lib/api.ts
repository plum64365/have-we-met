// Every database write in the app goes through this file.

import type { Step } from '../shared/machine.ts'
import type {
  AvatarColor,
  GameContent,
  PlayerRow,
  RoomRow,
  Tier,
  TierPlacementRow,
  WitAnswerRow,
  WitVoteRow,
} from '../shared/types.ts'
import { randomRoomCode } from './roomCode.ts'
import { supabase } from './supabase.ts'

const UNIQUE_VIOLATION = '23505'

export async function createRoom(): Promise<RoomRow> {
  let lastError = 'Could not create a room'
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase.from('rooms').insert({ code: randomRoomCode() }).select().single()
    if (data) return data as RoomRow
    lastError = error?.message ?? lastError
    if (error?.code !== UNIQUE_VIOLATION) break // anything but a code collision is a real problem
  }
  throw new Error(lastError)
}

export async function fetchRoomByCode(code: string): Promise<RoomRow | null> {
  const { data, error } = await supabase.from('rooms').select().eq('code', code.toUpperCase()).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as RoomRow | null) ?? null
}

export interface RoomTables {
  players: PlayerRow[]
  answers: WitAnswerRow[]
  votes: WitVoteRow[]
  placements: TierPlacementRow[]
}

export async function fetchRoomTables(roomId: string): Promise<RoomTables> {
  const [players, answers, votes, placements] = await Promise.all([
    supabase.from('players').select().eq('room_id', roomId).order('joined_at'),
    supabase.from('wit_answers').select().eq('room_id', roomId),
    supabase.from('wit_votes').select().eq('room_id', roomId),
    supabase.from('tier_placements').select().eq('room_id', roomId),
  ])
  const failed = [players, answers, votes, placements].find((r) => r.error)
  if (failed?.error) throw new Error(failed.error.message)
  return {
    players: (players.data ?? []) as PlayerRow[],
    answers: (answers.data ?? []) as WitAnswerRow[],
    votes: (votes.data ?? []) as WitVoteRow[],
    placements: (placements.data ?? []) as TierPlacementRow[],
  }
}

export type JoinProblem = 'full' | 'started' | 'name_taken' | 'unknown'

export class JoinError extends Error {
  problem: JoinProblem
  constructor(problem: JoinProblem, message: string) {
    super(message)
    this.problem = problem
  }
}

/** Adds this phone to the room. The 6-player cap and lobby-only rule are enforced by the database. */
export async function joinRoom(roomId: string, playerId: string, name: string, avatar: AvatarColor): Promise<void> {
  const { error } = await supabase.from('players').insert({ id: playerId, room_id: roomId, name: name.trim(), avatar })
  if (!error) return
  if (error.message.includes('ROOM_FULL')) {
    throw new JoinError('full', 'This room already has 6 players. Cheer them on from the big screen!')
  }
  if (error.message.includes('GAME_STARTED')) {
    throw new JoinError('started', 'This game already started. Catch the next round!')
  }
  if (error.code === UNIQUE_VIOLATION && error.message.includes('players_room_name_idx')) {
    throw new JoinError('name_taken', 'Someone already took that name. Try another one.')
  }
  if (error.code === UNIQUE_VIOLATION) return // same player id already in: a double tap, treat as joined
  throw new JoinError('unknown', `Could not join: ${error.message}`)
}

export async function updatePlayer(playerId: string, patch: Partial<PlayerRow>): Promise<void> {
  const { error } = await supabase.from('players').update(patch).eq('id', playerId)
  if (error) throw new Error(error.message)
}

export async function removePlayer(playerId: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw new Error(error.message)
}

/** Stores a rounded location (or clears it with nulls). Nobody can read it back from the browser. */
export async function setPlayerLocation(playerId: string, lat: number | null, lng: number | null): Promise<void> {
  const { error } = await supabase.rpc('set_player_location', { p_player_id: playerId, p_lat: lat, p_lng: lng })
  if (error) throw new Error(error.message)
}

export function touchPlayer(playerId: string) {
  void supabase.from('players').update({ last_seen: new Date().toISOString() }).eq('id', playerId).then(() => {})
}

/**
 * Moves the room to a new phase. Guarded by `rev`: if someone else (host vs wizard)
 * already changed the room since `room` was read, nothing is written and this returns false.
 * The database bumps `rev` by itself on every update to a room (see the migration).
 */
export async function applyStep(room: RoomRow, step: Step, extra: Partial<RoomRow> = {}): Promise<boolean> {
  const { data, error } = await supabase
    .from('rooms')
    .update({ ...extra, phase: step.phase, phase_data: step.phase_data })
    .eq('id', room.id)
    .eq('rev', room.rev)
    .select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

/** Changes room fields other than the phase (content, quick play, phase_data tweaks). */
export async function patchRoom(room: RoomRow, patch: Partial<RoomRow>): Promise<void> {
  const { error } = await supabase.from('rooms').update(patch).eq('id', room.id)
  if (error) throw new Error(error.message)
}

export async function saveContent(room: RoomRow, content: GameContent, source: RoomRow['content_source']): Promise<void> {
  await patchRoom(room, { content, content_source: source, build_status: 'ready' })
}

/** "Play again": same room and players, a new round, back to the lobby. */
export async function playAgain(room: RoomRow): Promise<boolean> {
  return applyStep(
    room,
    { phase: 'lobby', phase_data: {} },
    { round: room.round + 1, content: null, content_source: null, build_status: 'idle' },
  )
}

export async function submitAnswer(room: RoomRow, promptIndex: number, playerId: string, text: string): Promise<void> {
  const { error } = await supabase.from('wit_answers').upsert(
    { room_id: room.id, round: room.round, prompt_index: promptIndex, player_id: playerId, text },
    { onConflict: 'room_id,round,prompt_index,player_id' },
  )
  if (error) throw new Error(error.message)
}

export async function castVote(room: RoomRow, promptIndex: number, voterId: string, answerId: string): Promise<void> {
  const { error } = await supabase
    .from('wit_votes')
    .insert({ room_id: room.id, round: room.round, prompt_index: promptIndex, voter_id: voterId, answer_id: answerId })
  // A second vote on the same prompt hits the unique constraint; the first one stands.
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message)
}

export async function placeTier(room: RoomRow, itemIndex: number, tier: Tier): Promise<void> {
  const { error } = await supabase.from('tier_placements').upsert(
    { room_id: room.id, round: room.round, item_index: itemIndex, tier, placed_at: new Date().toISOString() },
    { onConflict: 'room_id,round,item_index' },
  )
  if (error) throw new Error(error.message)
}

export async function removeTier(room: RoomRow, itemIndex: number): Promise<void> {
  const { error } = await supabase
    .from('tier_placements')
    .delete()
    .eq('room_id', room.id)
    .eq('round', room.round)
    .eq('item_index', itemIndex)
  if (error) throw new Error(error.message)
}
