import { quizForRound, voiceAnswersFor } from './quiz.ts'
import type { VoiceQuestion } from './question-bank.ts'
import type { PlayerRow, RoomRow } from './types.ts'

export type EventContext = Pick<RoomRow, 'title' | 'description'>
export const INTRODUCTION_PREFIX = 'Introduction: '
export function introductionFor(player: Pick<PlayerRow, 'voice_text' | 'voice_answers'>): string {
  return player.voice_text?.startsWith(INTRODUCTION_PREFIX)
    ? player.voice_text.slice(INTRODUCTION_PREFIX.length).trim().slice(0, 380)
    : ''
}

export function exploresCampus(room?: EventContext): boolean {
  const text = `${room?.title ?? ''} ${room?.description ?? ''}`
  if (
    /\b(?:not|aren't|are not)\s+(?:all\s+)?(?:new students|new to (?:the )?campus|new on campus)\b/i.test(
      text,
    )
  )
    return false
  return /\b(?:new students|new to (?:the )?campus|new on campus|first[- ]year|freshm[ae]n|incoming students|orientation|explor\w* (?:the )?campus)\b/i.test(
    text,
  )
}

export const CAMPUS_QUESTIONS = {
  light: [
    'What kind of campus spot would you explore first: food, art, nature, or a place to study?',
    'What would make a campus meeting spot easy for your group to find again?',
    'What would you bring on a short first-week campus walk?',
    'What would you put on a campus discovery bingo card?',
    'Would you rather discover a quiet corner or a lively student space?',
    'What would you name a campus walking club that only meets for twenty minutes?',
  ],
  real: [
    'When has exploring an unfamiliar place been easier because you went with someone?',
    'What is something you would like a new classmate to show you how to get started with?',
    'What could this group try together during its first week on campus?',
    'When did trying a new activity help you start a conversation?',
    'What makes it easier for you to suggest a plan to people you have just met?',
    'What would you want to learn about campus from someone who has been here longer?',
  ],
  deep: [
    'What would help a new campus start to feel like a place where you belong?',
    'What small tradition would you like this group to start together?',
    'What makes an invitation feel easy to accept when you are new somewhere?',
    'What could you do to help another new student feel included?',
    'What kind of friendship would make an ordinary week on campus better?',
    'What would make you want to come back and meet this group again?',
  ],
}

const THEME_WORDS: Record<string, RegExp> = {
  Food: /\b(food|cook\w*|bak\w*|snack\w*|ramen|boba)\b/i,
  Music: /\b(music|song\w*|band|concert\w*|playlist\w*)\b/i,
  Books: /\b(book\w*|read\w*|library|novel\w*)\b/i,
  Gaming: /\b(gam\w*|boardgame\w*|chess)\b/i,
  'Art & design': /\b(art|draw\w*|design\w*|sketch\w*|photograph\w*)\b/i,
  Sports: /\b(sport\w*|basketball|soccer|volleyball|fitness|workout\w*)\b/i,
  Outdoors: /\b(outdoor\w*|nature|walk\w*|hik\w*|garden\w*)\b/i,
  Tech: /\b(tech\w*|cod\w*|robot\w*|program\w*)\b/i,
  Anime: /\b(anime|manga)\b/i,
  'Movies & TV': /\b(movie\w*|cinema|film\w*|television|tv)\b/i,
  Fashion: /\b(fashion|clothes|outfit\w*|thrift\w*)\b/i,
  Pets: /\b(pets?|dogs?|cats?|animals?)\b/i,
  Travel: /\b(travel\w*|trip\w*|sightseeing)\b/i,
  Fitness: /\b(fitness|workout\w*|exercis\w*|running|gym)\b/i,
  Cooking: /\b(cook\w*|bak\w*|recipes?|dumplings?)\b/i,
  'Going out': /\b(going out|nightlife|danc\w*|parties)\b/i,
}

/** Topic hints for neutral questions, never facts or personality labels about a player. */
export function introductionThemes(
  players: Pick<PlayerRow, 'voice_text' | 'voice_answers'>[],
  room?: EventContext,
): string[] {
  const texts = players.map((player) =>
    [introductionFor(player), ...voiceAnswersFor(player).map((answer) => answer.answer)].join(' '),
  )
  const context = `${room?.title ?? ''} ${room?.description ?? ''}`
  return Object.entries(THEME_WORDS)
    .map(([theme, pattern]) => ({
      theme,
      score:
        texts.filter((text) => pattern.test(text)).length + (pattern.test(context) ? players.length + 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ theme }) => theme)
}

export function campusThemeQuestion(theme: string) {
  return {
    light: `What would you look for in a campus spot for a ${theme.toLowerCase()} meetup?`,
    real: `What could make a campus ${theme.toLowerCase()} activity easy for a curious beginner to try?`,
    deep: `What would make a campus ${theme.toLowerCase()} group welcoming to a complete beginner?`,
  }
}

export function themeQuestion(theme: string) {
  return {
    light: `What would make a ${theme.toLowerCase()} meetup fun for someone trying it for the first time?`,
    real: `What could someone learn about you by trying a ${theme.toLowerCase()} activity with you?`,
    deep: `What helps a group make room for different levels of interest in ${theme.toLowerCase()}?`,
  }
}

const CAMPUS_VOICE: VoiceQuestion[] = [
  {
    id: 'campus-first-find',
    category: 'everyday',
    prompt: 'What would you like to discover on campus first, and why?',
  },
  {
    id: 'campus-meetup',
    category: 'everyday',
    prompt: 'Describe a campus hangout you would feel comfortable joining.',
  },
  {
    id: 'campus-hobby',
    category: 'everyday',
    prompt: 'What interest would you like to explore with new classmates?',
  },
  {
    id: 'campus-afternoon',
    category: 'everyday',
    prompt: 'You have a free afternoon on campus. What would you like to try with a new friend?',
  },
  {
    id: 'campus-ask',
    category: 'everyday',
    prompt: 'What is one thing about campus you would like to figure out together?',
  },
  {
    id: 'campus-routine',
    category: 'everyday',
    prompt: 'What would make a good regular meeting spot for you and a few classmates?',
  },
  {
    id: 'campus-new-place',
    category: 'story',
    prompt: 'Think of a time you explored somewhere unfamiliar. What made it enjoyable?',
  },
  {
    id: 'campus-invitation',
    category: 'story',
    prompt: 'What is a small invitation you appreciated, or one you would like to receive?',
  },
  {
    id: 'campus-beginner',
    category: 'story',
    prompt: 'Tell us about trying something new, or something you would like to try here.',
  },
  {
    id: 'campus-common-ground',
    category: 'story',
    prompt: 'When has a shared interest helped you start a conversation?',
  },
  {
    id: 'campus-team',
    category: 'story',
    prompt: 'What is a small task that becomes more fun when you do it with someone?',
  },
  {
    id: 'campus-plan',
    category: 'story',
    prompt: 'Describe a simple outing you enjoyed, or one you would like to plan.',
  },
  {
    id: 'campus-tour',
    category: 'hypothetical',
    prompt: 'If this group designed a campus discovery walk, what would be on it?',
  },
  {
    id: 'campus-club',
    category: 'hypothetical',
    prompt: 'If you could start a tiny campus club tomorrow, what would people do together?',
  },
  {
    id: 'campus-tradition',
    category: 'hypothetical',
    prompt: 'If this group met once a week, what small tradition would you suggest?',
  },
  {
    id: 'campus-bingo',
    category: 'hypothetical',
    prompt: 'If campus exploration were a bingo game, what would one square say?',
  },
  {
    id: 'campus-guide',
    category: 'hypothetical',
    prompt: 'If you made a campus guide for the next new student, what would you want to include?',
  },
  {
    id: 'campus-bench',
    category: 'hypothetical',
    prompt: 'If you could add one shared space to campus, what would it be for?',
  },
]

export function quizForContext(roomId: string, round: number, room?: EventContext) {
  const normal = quizForRound(roomId, round)
  if (!exploresCampus(room)) return normal
  let seed = 0
  for (const char of roomId) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0
  return {
    ...normal,
    voice: (['everyday', 'story', 'hypothetical'] as const).map((category) => {
      const pool = CAMPUS_VOICE.filter((question) => question.category === category)
      return pool[((seed % pool.length) + Math.max(0, round - 1)) % pool.length]
    }),
  }
}
