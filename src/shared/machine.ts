import { GAME_CATALOG, middleChoice, middleSeed, startParty } from './middle-games.ts'
import { startHabet } from './habet.ts'
import { REALTALK_LEVELS } from './types.ts'
import type { GameContent, Phase, PhaseData, PlayerRow, RoomRow } from './types.ts'

/**
 * The phase state machine. Pure functions: given what a screen currently knows, they
 * return the next { phase, phase_data } to write to the room row. Only the host and the
 * wizard call these. Phones never do.
 *
 * lobby -> building -> common_ground
 *   -> tierlist -> matched middle game (existing wit_answer phase, marked in phase_data)
 *   -> realtalk (six questions) -> hangout
 */

export interface Snapshot {
  room: RoomRow
  players: PlayerRow[]
  /** Player ids currently connected (Realtime Presence). */
  onlineIds: string[]
  /** Date.now() on the device making the change. */
  now: number
}

export interface Step {
  phase: Phase
  phase_data: PhaseData
}

function byJoinOrder(players: PlayerRow[]): PlayerRow[] {
  return [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id))
}

/** The roster saved in phase_data, minus anyone who no longer exists; else all joined players. */
function rosterOf(s: Snapshot): string[] {
  const saved = (s.room.phase_data.roster ?? []).filter((id) => s.players.some((p) => p.id === id))
  return saved.length >= 2 ? saved : freshRoster(s)
}

function freshRoster(s: Snapshot): string[] {
  // Keep the whole joined roster, including phones that sleep during shared-screen play.
  return byJoinOrder(s.players).map((p) => p.id)
}

function transition(next: 'tierlist' | 'realtalk', roster: string[]): Step {
  return { phase: 'transition', phase_data: { kind: 'phones_away', next, roster } }
}

function gameMeta(s: Snapshot) {
  return { middle_game: middleChoice(s.room, s.players), game_catalog: GAME_CATALOG }
}
function enterMiddle(s: Snapshot): Step {
  const roster = rosterOf(s)
  const players = roster.flatMap((id) => s.players.find((player) => player.id === id) ?? [])
  const meta = gameMeta(s)
  return {
    phase: 'wit_answer',
    phase_data: {
      ...meta,
      roster,
      ...(meta.middle_game.id === 'habet'
        ? { habet: startHabet(players, s.now, s.room) }
        : { party: startParty(meta.middle_game, roster, middleSeed(s.room)) }),
    },
  }
}

function enterTierlist(s: Snapshot): Step {
  const roster = rosterOf(s)
  return { phase: 'tierlist', phase_data: { ...gameMeta(s), scribeId: roster[0] ?? null, roster } }
}

export function realTalkSequence(content: GameContent | null) {
  return content
    ? REALTALK_LEVELS.flatMap((level) =>
        content.realtalk[level].slice(0, 2).map((question) => ({ level, question })),
      )
    : []
}

function enterRealtalk(s: Snapshot, step: number, roster: string[]): Step {
  const content = s.room.content
  const sequence = realTalkSequence(content)
  if (!content || step >= sequence.length) return { phase: 'hangout', phase_data: { ...gameMeta(s), roster } }
  const entry = sequence[step]
  const firstPlayerIds =
    roster.length <= 6
      ? roster.length
        ? [roster[step % roster.length]]
        : []
      : roster.filter((_, index) => index % 6 === step)
  return {
    phase: 'realtalk',
    phase_data: {
      ...gameMeta(s),
      step,
      question: entry.question,
      firstPlayerId: firstPlayerIds[0] ?? null,
      firstPlayerIds,
      swaps: 0,
      roster,
    },
  }
}

function enter(s: Snapshot, phase: PhaseData['next']): Step {
  if (phase === 'tierlist') return enterTierlist(s)

  return enterRealtalk(s, 0, rosterOf(s))
}

/** The natural next step from the current phase, or null if there is none. */
export function nextStep(s: Snapshot): Step | null {
  const d = s.room.phase_data
  switch (s.room.phase) {
    case 'building':
      return { phase: 'common_ground', phase_data: { ...gameMeta(s) } }
    case 'common_ground':
      return enterTierlist(s)
    case 'transition':
      return enter(s, d.next ?? 'tierlist')
    case 'tierlist':
      return enterMiddle(s)
    case 'wit_answer':
      if (d.party?.kind === 'wavelength' && d.party.stage === 'reveal' && d.party.round < 1)
        return {
          phase: 'wit_answer',
          phase_data: {
            ...gameMeta(s),
            roster: rosterOf(s),
            party: startParty(
              middleChoice(s.room, s.players),
              rosterOf(s),
              middleSeed(s.room),
              d.party.round + 1,
            ),
          },
        }
      return enterRealtalk(s, 0, rosterOf(s))
    case 'wit_vote':
    case 'wit_reveal':
      return enterRealtalk(s, 0, rosterOf(s))
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
      return enterMiddle(s)
    case 'wit_answer':
    case 'wit_vote':
    case 'wit_reveal':
      return enterRealtalk(s, 0, rosterOf(s))
    case 'realtalk':
      return { phase: 'hangout', phase_data: { ...gameMeta(s), roster: d.roster } }
    default:
      return nextStep(s)
  }
}

/** Jump straight to the start of a phase. Used by the wizard's "force phase" control. */
export function jumpTo(s: Snapshot, phase: Phase): Step {
  const roster = rosterOf(s)
  switch (phase) {
    case 'tierlist':
      return enterTierlist(s)
    case 'wit_answer':
      return enterMiddle(s)
    case 'wit_vote':
    case 'wit_reveal':
      return enterRealtalk(s, 0, roster)
    case 'realtalk':
      return enterRealtalk(s, 0, roster)
    case 'hangout':
      return { phase: 'hangout', phase_data: { ...gameMeta(s), roster } }
    case 'transition':
      return transition('tierlist', roster)
    default:
      return { phase, phase_data: {} }
  }
}
