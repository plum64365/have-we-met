import { QUICK_PLAY_PROMPTS, WIT_SECONDS } from './quiz.ts'
import { REALTALK_LEVELS } from './types.ts'
import type { Phase, PhaseData, PlayerRow, RoomRow, WitAnswerRow } from './types.ts'

/**
 * The phase state machine. Pure functions: given what a screen currently knows, they
 * return the next { phase, phase_data } to write to the room row. Only the host and the
 * wizard call these. Phones never do.
 *
 * lobby -> building -> common_ground
 *   -> transition(phones_away, tierlist) -> tierlist
 *   -> transition(phones_out, wit_answer) -> wit_answer -> wit_vote -> wit_reveal (per prompt)
 *   -> transition(phones_away, realtalk) -> realtalk (9 questions) -> hangout
 */

export interface Snapshot {
  room: RoomRow
  players: PlayerRow[]
  /** Player ids currently connected (Realtime Presence). */
  onlineIds: string[]
  /** Wit answers for the current round. */
  answers: WitAnswerRow[]
  /** Date.now() on the device making the change. */
  now: number
}

export interface Step {
  phase: Phase
  phase_data: PhaseData
}

export const REALTALK_STEPS = 9

function byJoinOrder(players: PlayerRow[]): PlayerRow[] {
  return [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id))
}

/**
 * Players to count as "still here", in join order. If fewer than 2 look online we assume
 * presence itself is flaky (bad wifi, sleeping phones) and fall back to everyone, rather
 * than silently skipping a game.
 */
export function activePlayers(s: Pick<Snapshot, 'players' | 'onlineIds'>): PlayerRow[] {
  const ordered = byJoinOrder(s.players)
  const online = ordered.filter((p) => s.onlineIds.includes(p.id))
  return online.length >= 2 ? online : ordered
}

/** The roster saved in phase_data, minus anyone who no longer exists; else the active players. */
function rosterOf(s: Snapshot): string[] {
  const saved = (s.room.phase_data.roster ?? []).filter((id) => s.players.some((p) => p.id === id))
  return saved.length >= 2 ? saved : activePlayers(s).map((p) => p.id)
}

function freshRoster(s: Snapshot): string[] {
  return activePlayers(s).map((p) => p.id)
}

export function witPromptCount(room: RoomRow): number {
  const available = room.content?.wit.length ?? 0
  return room.quick_play ? Math.min(QUICK_PLAY_PROMPTS, available) : available
}

function transition(kind: PhaseData['kind'], next: PhaseData['next'], carry: PhaseData): Step {
  return { phase: 'transition', phase_data: { kind, next, roster: carry.roster, turns: carry.turns } }
}

function enterTierlist(s: Snapshot): Step {
  const roster = rosterOf(s)
  return { phase: 'tierlist', phase_data: { scribeId: roster[0] ?? null, roster } }
}

/** Picks the two players for a prompt, preferring the ones the content names. */
export function resolvePair(s: Snapshot, promptIndex: number, turns: Record<string, number>): string[] {
  const active = activePlayers(s)
  const named = (s.room.content?.wit[promptIndex]?.players ?? [])
    .map((name) => active.find((p) => p.name.toLowerCase() === name.toLowerCase())?.id)
    .filter((id): id is string => Boolean(id))
  const pair = [...new Set(named)].slice(0, 2)
  // Replace anyone missing with whoever has had the fewest prompts so far.
  const fillers = active
    .filter((p) => !pair.includes(p.id))
    .sort((a, b) => (turns[a.id] ?? 0) - (turns[b.id] ?? 0))
  while (pair.length < 2 && fillers.length) pair.push(fillers.shift()!.id)
  return pair
}

function enterWit(s: Snapshot, promptIndex: number): Step {
  const turns = { ...(s.room.phase_data.turns ?? {}) }
  const roster = s.room.phase_data.roster
  if (promptIndex >= witPromptCount(s.room)) {
    return transition('phones_away', 'realtalk', { roster: freshRoster(s), turns })
  }
  const pair = resolvePair(s, promptIndex, turns)
  if (pair.length < 2) return transition('phones_away', 'realtalk', { roster: freshRoster(s), turns })
  for (const id of pair) turns[id] = (turns[id] ?? 0) + 1
  return {
    phase: 'wit_answer',
    phase_data: {
      promptIndex,
      pair,
      turns,
      roster,
      deadline: new Date(s.now + WIT_SECONDS * 1000).toISOString(),
    },
  }
}

/** Answers written by the current pair for the current prompt. */
export function currentAnswers(s: Pick<Snapshot, 'room' | 'answers'>): WitAnswerRow[] {
  const { promptIndex, pair = [] } = s.room.phase_data
  return s.answers
    .filter((a) => a.round === s.room.round && a.prompt_index === promptIndex && pair.includes(a.player_id))
    .sort((a, b) => pair.indexOf(a.player_id) - pair.indexOf(b.player_id))
}

/** Players allowed to vote on the current prompt: everyone active except the two authors. */
export function eligibleVoters(s: Pick<Snapshot, 'room' | 'players' | 'onlineIds'>): PlayerRow[] {
  const pair = s.room.phase_data.pair ?? []
  return activePlayers(s).filter((p) => !pair.includes(p.id))
}

function enterRealtalk(s: Snapshot, step: number, roster: string[]): Step {
  const content = s.room.content
  if (!content || step >= REALTALK_STEPS) return { phase: 'hangout', phase_data: { roster } }
  const level = REALTALK_LEVELS[Math.floor(step / 3)]
  return {
    phase: 'realtalk',
    phase_data: {
      step,
      question: content.realtalk[level][step % 3] ?? '',
      firstPlayerId: roster.length ? roster[step % roster.length] : null,
      swaps: 0,
      roster,
    },
  }
}

function enter(s: Snapshot, phase: PhaseData['next']): Step {
  if (phase === 'tierlist') return enterTierlist(s)
  if (phase === 'wit_answer') return enterWit(s, 0)
  return enterRealtalk(s, 0, rosterOf(s))
}

/** The natural next step from the current phase, or null if there is none. */
export function nextStep(s: Snapshot): Step | null {
  const d = s.room.phase_data
  switch (s.room.phase) {
    case 'building':
      return { phase: 'common_ground', phase_data: {} }
    case 'common_ground':
      return transition('phones_away', 'tierlist', { roster: freshRoster(s) })
    case 'transition':
      return enter(s, d.next ?? 'tierlist')
    case 'tierlist':
      return transition('phones_out', 'wit_answer', d)
    case 'wit_answer': {
      // Voting needs two answers and at least one person who did not write one.
      const canVote = currentAnswers(s).length === 2 && eligibleVoters(s).length > 0
      const rest = { ...d }
      delete rest.deadline
      return { phase: canVote ? 'wit_vote' : 'wit_reveal', phase_data: rest }
    }
    case 'wit_vote':
      return { phase: 'wit_reveal', phase_data: d }
    case 'wit_reveal':
      return enterWit(s, (d.promptIndex ?? 0) + 1)
    case 'realtalk':
      return enterRealtalk(s, (d.step ?? 0) + 1, rosterOf(s))
    default:
      return null
  }
}

/** "Skip to next game": leaves the current game no matter how far along it is. */
export function skipGameStep(s: Snapshot): Step | null {
  const d = s.room.phase_data
  switch (s.room.phase) {
    case 'tierlist':
      return transition('phones_out', 'wit_answer', d)
    case 'wit_answer':
    case 'wit_vote':
    case 'wit_reveal':
      return transition('phones_away', 'realtalk', { roster: freshRoster(s), turns: d.turns })
    case 'realtalk':
      return { phase: 'hangout', phase_data: { roster: d.roster } }
    default:
      return nextStep(s)
  }
}

/** Drops the current Wit Dispute prompt and moves to the next one (or the next game). */
export function skipPromptStep(s: Snapshot): Step | null {
  if (!['wit_answer', 'wit_vote', 'wit_reveal'].includes(s.room.phase)) return null
  return enterWit(s, (s.room.phase_data.promptIndex ?? 0) + 1)
}

/** Jump straight to the start of a phase. Used by the wizard's "force phase" control. */
export function jumpTo(s: Snapshot, phase: Phase): Step {
  const roster = rosterOf(s)
  switch (phase) {
    case 'tierlist':
      return enterTierlist(s)
    case 'wit_answer':
    case 'wit_vote':
    case 'wit_reveal':
      return enterWit({ ...s, room: { ...s.room, phase_data: { roster } } }, 0)
    case 'realtalk':
      return enterRealtalk(s, 0, roster)
    case 'hangout':
      return { phase: 'hangout', phase_data: { roster } }
    case 'transition':
      return transition('phones_away', 'tierlist', { roster })
    default:
      return { phase, phase_data: {} }
  }
}
