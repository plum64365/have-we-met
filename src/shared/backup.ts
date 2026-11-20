import { biggestMajority, countPhrase, funFacts, interestCounts } from './profile.ts'
import type { PlayerLite } from './profile.ts'
import { campusTaskForSpot, hangoutForSpot, rankHangoutSpots } from './hangout.ts'
import {
  CAMPUS_QUESTIONS,
  campusThemeQuestion,
  exploresCampus,
  introductionThemes,
  themeQuestion,
} from './experience.ts'
import type { EventContext } from './experience.ts'
import { realTalkQuestionsPerLevel } from './quiz.ts'
import { REAL_TALK_QUESTIONS } from './question-bank.ts'
import { REALTALK_LEVELS } from './types.ts'
import type { BackupCategory, BackupContent, GameContent, Spot } from './types.ts'

export interface BackupOptions {
  /** Changes which templates are picked, so "Play again" feels different. */
  seed?: number
  room?: EventContext
}

function unique<T>(list: T[]): T[] {
  return [...new Set(list)]
}

function rotate<T>(list: T[], by: number): T[] {
  if (list.length === 0) return list
  const n = ((by % list.length) + list.length) % list.length
  return [...list.slice(n), ...list.slice(0, n)]
}

/** The backup categories for the group's top interests, best first, always ending with general. */
function rankedCategories(
  players: PlayerLite[],
  backup: BackupContent,
): { interest: string; cat: BackupCategory }[] {
  const ranked = interestCounts(players)
    .filter((c) => backup.categories[c.interest])
    .map((c) => ({ interest: c.interest, cat: backup.categories[c.interest] }))
  return [...ranked, { interest: 'hanging out', cat: backup.general }]
}

const CAMPUS_TIER_LISTS = [
  {
    topic: 'What should we discover on campus first?',
    items: [
      'Study corners',
      'Food spots',
      'Campus art',
      'Green spaces',
      'Student clubs',
      'Library spaces',
      'Sports spaces',
      'Meeting spots',
    ],
  },
  {
    topic: 'What makes a campus meetup worth repeating?',
    items: [
      'Easy directions',
      'Shared snacks',
      'Good conversation',
      'Short walks',
      'New discoveries',
      'Flexible plans',
      'Group photos',
      'A next date',
    ],
  },
  {
    topic: 'What belongs on our first campus discovery walk?',
    items: [
      'Campus map',
      'Snack stop',
      'Art detour',
      'Green space',
      'Shared playlist',
      'Photo challenge',
      'Library visit',
      'Meetup plan',
    ],
  },
  {
    topic: 'What should our unofficial campus guide include?',
    items: [
      'Food spots',
      'Quiet corners',
      'Campus art',
      'Club ideas',
      'Study spaces',
      'Outdoor breaks',
      'Meeting spots',
      'Easy walks',
    ],
  },
  {
    topic: 'Which campus mini-adventure should we try next?',
    items: [
      'Art walk',
      'Library visit',
      'Snack scouting',
      'Photo walk',
      'Picnic planning',
      'Game break',
      'Club search',
      'Scenic stroll',
    ],
  },
  {
    topic: 'What makes a good campus study meetup?',
    items: [
      'Comfy seating',
      'Easy meeting',
      'Shared breaks',
      'Quiet space',
      'Snack plan',
      'Clear goals',
      'Fresh air',
      'Friendly faces',
    ],
  },
]

/**
 * Builds a whole game with no AI. `spots` should already be ranked nearest-first when the
 * group shared a location. Works for any group, including players who skipped the quiz.
 */
export function buildBackupContent(
  players: PlayerLite[],
  backup: BackupContent,
  spots: Spot[],
  options: BackupOptions = {},
): GameContent {
  const seed = options.seed ?? 0
  const total = players.length
  const cats = rankedCategories(players, backup)
  const top = cats[0]
  const counts = interestCounts(players)
  const topCount = counts.find((c) => c.interest === top.interest)?.count ?? 0
  const campus = exploresCampus(options.room)
  const themes = introductionThemes(players, options.room)
  const majority = biggestMajority(players)

  const reasonParts: string[] = []
  if (topCount > 0) reasonParts.push(`${countPhrase(topCount, total)} chose ${top.interest}`)
  if (majority) reasonParts.push(`${majority.count} ${majority.group}`)
  const reason = reasonParts.length ? reasonParts.join(' + ') : 'A classic that every group can argue about'

  const realtalk = { light: [] as string[], real: [] as string[], deep: [] as string[] }
  for (const level of REALTALK_LEVELS) {
    // One question from each top interest, then general ones, with enough turns for the group.
    const pool = unique([
      ...rotate(themes, seed + REALTALK_LEVELS.indexOf(level))
        .slice(0, 1)
        .map((theme) => (campus ? campusThemeQuestion(theme) : themeQuestion(theme))[level]),
      ...(campus ? rotate(CAMPUS_QUESTIONS[level], seed) : []),
      ...cats.slice(0, 2).flatMap((c) => rotate(c.cat.realtalk[level], seed).slice(0, 1)),
      ...rotate(REAL_TALK_QUESTIONS[level], seed),
      ...rotate(backup.general.realtalk[level], seed),
    ])
    realtalk[level] = pool.slice(0, realTalkQuestionsPerLevel(total))
  }

  const spot = rankHangoutSpots(players, spots, options.room)[0]

  return {
    tierlist: campus
      ? {
          ...CAMPUS_TIER_LISTS[
            ((seed % CAMPUS_TIER_LISTS.length) + CAMPUS_TIER_LISTS.length) % CAMPUS_TIER_LISTS.length
          ],
          reason: reasonParts.length
            ? `Campus discoveries · ${reasonParts[0]}`
            : 'A first exploration for this new-student group',
        }
      : { topic: top.cat.tierlist.topic, reason, items: top.cat.tierlist.items.slice(0, 8) },
    wit: [],
    realtalk,
    hangout: spot
      ? {
          ...hangoutForSpot(players, spot),
          ...(campus
            ? {
                activity: `Explore ${spot.name} together. Each choose something you would like to come back and try.`,
              }
            : {}),
        }
      : {
          activity: 'Take turns sharing an activity you would like to try together.',
          spot_id: '',
          why: ['Keep the conversation going', 'Choose your next activity'],
        },
    fun_facts: funFacts(players),
    ...(campus ? { campus_task: campusTaskForSpot(spot) } : {}),
  }
}
