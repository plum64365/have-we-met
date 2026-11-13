import type { AvatarColor, PlayerRow, VoiceAnswer } from './types.ts'
import { VOICE_QUESTIONS } from './question-bank.ts'
import type { VoiceQuestion } from './question-bank.ts'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6
export const MIN_INTERESTS = 3
export const MAX_INTERESTS = 5
export const WIT_MAX_CHARS = 60
export const WIT_SECONDS = 45
export const QUICK_PLAY_PROMPTS = 2

export const AVATARS: AvatarColor[] = ['yellow', 'pink', 'cyan', 'green', 'orange', 'lilac']

export const INTERESTS = [
  'Food',
  'Music',
  'Gaming',
  'Anime',
  'Sports',
  'Outdoors',
  'Movies & TV',
  'Fashion',
  'Art & design',
  'Tech',
  'Travel',
  'Fitness',
  'Pets',
  'Books',
  'Cooking',
  'Going out',
]

export const VOICE_QUESTION = "What's something you've been really into lately, and why?"

export interface ThisOrThat {
  key: string
  a: { label: string; group: string }
  b: { label: string; group: string }
}

/** `group` finishes the sentence "4 of you ..." on the common ground screen. */
export const THIS_OR_THAT: ThisOrThat[] = [
  {
    key: 'sleep',
    a: { label: 'Early bird', group: 'are early birds' },
    b: { label: 'Night owl', group: 'are night owls' },
  },
  {
    key: 'social',
    a: { label: 'Stay in', group: 'would rather stay in' },
    b: { label: 'Go out', group: 'would rather go out' },
  },
  {
    key: 'taste',
    a: { label: 'Sweet', group: 'pick sweet over savory' },
    b: { label: 'Savory', group: 'pick savory over sweet' },
  },
  {
    key: 'place',
    a: { label: 'Beach', group: 'are beach people' },
    b: { label: 'Mountains', group: 'are mountain people' },
  },
  {
    key: 'plan',
    a: { label: 'Plan it', group: 'like to plan it' },
    b: { label: 'Wing it', group: 'like to wing it' },
  },
  {
    key: 'novelty',
    a: { label: 'Revisit a favorite', group: 'would revisit a favorite' },
    b: { label: 'Try a wildcard', group: 'would try a wildcard' },
  },
  {
    key: 'party-role',
    a: { label: 'Make the playlist', group: 'would make the playlist' },
    b: { label: 'Pick the snacks', group: 'would pick the snacks' },
  },
  {
    key: 'learning',
    a: { label: 'Watch first', group: 'learn by watching first' },
    b: { label: 'Jump in and try', group: 'learn by jumping in' },
  },
  {
    key: 'games',
    a: { label: 'One long game', group: 'prefer one long game' },
    b: { label: 'Several short rounds', group: 'prefer several short rounds' },
  },
  {
    key: 'exploring',
    a: { label: 'Explore one place', group: 'would explore one place deeply' },
    b: { label: 'Make several stops', group: 'would make several stops' },
  },
  {
    key: 'creating',
    a: { label: 'Make something', group: 'would make something together' },
    b: { label: 'Solve something', group: 'would solve something together' },
  },
  {
    key: 'food-adventure',
    a: { label: 'Favorite order', group: 'would get their favorite order' },
    b: { label: 'Something new', group: 'would order something new' },
  },
  {
    key: 'souvenir',
    a: { label: 'Take a photo', group: 'would take a photo' },
    b: { label: 'Keep a souvenir', group: 'would keep a souvenir' },
  },
  {
    key: 'story-format',
    a: { label: 'Read the story', group: 'prefer reading a story' },
    b: { label: 'Watch the adaptation', group: 'prefer watching an adaptation' },
  },
  {
    key: 'group-activity',
    a: { label: 'Cooperate', group: 'would choose a cooperative game' },
    b: { label: 'Friendly competition', group: 'would choose friendly competition' },
  },
]

export interface QuizSelection {
  voice: VoiceQuestion[]
  thisOrThat: ThisOrThat[]
}

/** Stable across devices and refreshes; each pool cycles before repeating a question. */
export function quizForRound(roomId: string, round: number): QuizSelection {
  let seed = 0
  for (const char of roomId) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0
  const offset = Math.max(0, round - 1)
  const voice = (['everyday', 'story', 'hypothetical'] as const).map((category) => {
    const pool = VOICE_QUESTIONS.filter((q) => q.category === category)
    return pool[(seed % pool.length + offset) % pool.length]
  })
  const start = (seed % THIS_OR_THAT.length + offset * 5) % THIS_OR_THAT.length
  const thisOrThat = Array.from({ length: 5 }, (_, i) => THIS_OR_THAT[(start + i) % THIS_OR_THAT.length])
  return { voice, thisOrThat }
}

/** Preserve the original question when reading rows created before multiple answers. */
export function voiceAnswersFor(player: Pick<PlayerRow, 'voice_text' | 'voice_answers'>): VoiceAnswer[] {
  if (player.voice_answers?.length) return player.voice_answers
  if (player.voice_text === null) return []
  return [{ question_id: 'into-lately', question: VOICE_QUESTION, answer: player.voice_text }]
}

export function quizComplete(player: PlayerRow, round: number): boolean {
  return player.quiz_done && (player.quiz_round ?? round) === round
}
