import { interestCounts } from './profile.ts'
import { exploresCampus } from './experience.ts'
import type { EventContext } from './experience.ts'
import type { HabetState, PlayerRow } from './types.ts'

const TOPICS: Record<string, string> = {
  Food: 'Foods you could share',
  Cooking: 'Foods you could share',
  Music: 'Songs, artists, or instruments',
  Books: 'Things you might find in a library',
  Tech: 'Apps, websites, or gadgets',
  Gaming: 'Games or things you find in games',
  Anime: 'Characters from movies, TV, or anime',
  Sports: 'Sports, activities, or equipment',
  Fitness: 'Sports, activities, or equipment',
  Outdoors: 'Things you might see outdoors',
  Travel: 'Places you could visit',
  'Movies & TV': 'Movies, TV shows, or characters',
  'Art & design': 'Things you could draw',
}
export function habetTopic(players: PlayerRow[], room?: EventContext): string {
  if (exploresCampus(room)) return 'Things you might find on campus'
  return TOPICS[interestCounts(players)[0]?.interest] ?? 'Things you could bring to a picnic'
}
export function habetSeconds(turn: number) {
  return Math.max(3, 12 - Math.floor(turn / 2))
}
export function startHabet(players: PlayerRow[], now: number, room?: EventContext): HabetState {
  const remaining = players.map((player) => player.id)
  return {
    status: remaining.length > 1 ? 'playing' : 'complete',
    topic: habetTopic(players, room),
    remaining,
    currentIndex: 0,
    eliminated: [],
    blocked: [],
    answers: [],
    turn: 0,
    deadline: new Date(now + 12_000).toISOString(),
    ends_at: new Date(now + 120_000).toISOString(),
    winners: remaining.length > 1 ? [] : remaining,
  }
}
const finish = (game: HabetState): HabetState => ({
  ...game,
  status: 'complete',
  winners: game.remaining,
  paused: undefined,
})
function advance(game: HabetState, remaining: string[], index: number, now: number): HabetState {
  const turn = game.turn + 1
  const next = {
    ...game,
    remaining,
    currentIndex: remaining.length ? index % remaining.length : 0,
    turn,
    deadline: new Date(now + habetSeconds(turn) * 1000).toISOString(),
  }
  return remaining.length <= 1 || next.blocked.length === 26 || now >= Date.parse(next.ends_at)
    ? finish(next)
    : next
}
export function acceptHabet(game: HabetState, answer: string, now: number): HabetState {
  if (game.status !== 'playing' || game.paused)
    throw new Error('Resume the clock before accepting an answer.')
  if (now >= Date.parse(game.deadline) || now >= Date.parse(game.ends_at))
    throw new Error('Time is up. Move to the next player.')
  const text = answer.replace(/\s+/g, ' ').trim()
  if (!text || text.length > 60) throw new Error('Use an answer of 1–60 characters.')
  const letter = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .charAt(0)
    .toUpperCase()
  if (!/^[A-Z]$/.test(letter)) throw new Error('Start your answer with a letter from A to Z.')
  if (game.blocked.includes(letter))
    throw new Error(`${letter} is already blocked. Try a different first letter.`)
  const normalize = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase()
  if (game.answers.some((item) => normalize(item.text) === normalize(text)))
    throw new Error('That answer was already used.')
  return advance(
    {
      ...game,
      blocked: [...game.blocked, letter],
      answers: [...game.answers, { player_id: game.remaining[game.currentIndex], text, letter }],
    },
    game.remaining,
    game.currentIndex + 1,
    now,
  )
}
export function expireHabet(game: HabetState, now: number): HabetState {
  if (game.status !== 'playing' || game.paused) return game
  if (now >= Date.parse(game.ends_at)) return finish(game)
  if (now < Date.parse(game.deadline)) return game
  return passHabet(game, now)
}
export function passHabet(game: HabetState, now: number): HabetState {
  if (game.status !== 'playing' || game.paused) return game
  const out = game.remaining[game.currentIndex]
  return advance(
    { ...game, eliminated: [...game.eliminated, out] },
    game.remaining.filter((id) => id !== out),
    game.currentIndex,
    now,
  )
}
export function pauseHabet(game: HabetState, now: number): HabetState {
  if (game.status !== 'playing') return game
  if (game.paused)
    return {
      ...game,
      paused: undefined,
      deadline: new Date(now + game.paused.turn_ms).toISOString(),
      ends_at: new Date(now + game.paused.game_ms).toISOString(),
    }
  if (now >= Date.parse(game.deadline) || now >= Date.parse(game.ends_at)) return expireHabet(game, now)
  return {
    ...game,
    paused: { turn_ms: Date.parse(game.deadline) - now, game_ms: Date.parse(game.ends_at) - now },
  }
}
