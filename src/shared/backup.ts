import { biggestMajority, countPhrase, funFacts, interestCounts } from './profile.ts'
import type { PlayerLite } from './profile.ts'
import { hangoutForSpot, rankHangoutSpots } from './hangout.ts'
import { realTalkQuestionsPerLevel } from './quiz.ts'
import { REAL_TALK_QUESTIONS } from './question-bank.ts'
import { REALTALK_LEVELS } from './types.ts'
import type { BackupCategory, BackupContent, GameContent, Spot } from './types.ts'

export interface BackupOptions {
  /** Changes which templates are picked, so "Play again" feels different. */
  seed?: number
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
function rankedCategories(players: PlayerLite[], backup: BackupContent): { interest: string; cat: BackupCategory }[] {
  const ranked = interestCounts(players)
    .filter((c) => backup.categories[c.interest])
    .map((c) => ({ interest: c.interest, cat: backup.categories[c.interest] }))
  return [...ranked, { interest: 'hanging out', cat: backup.general }]
}

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
  const majority = biggestMajority(players)

  const reasonParts: string[] = []
  if (topCount > 0) reasonParts.push(`${countPhrase(topCount, total)} chose ${top.interest}`)
  if (majority) reasonParts.push(`${majority.count} ${majority.group}`)
  const reason = reasonParts.length ? reasonParts.join(' + ') : 'A classic that every group can argue about'

  const realtalk = { light: [] as string[], real: [] as string[], deep: [] as string[] }
  for (const level of REALTALK_LEVELS) {
    // One question from each top interest, then general ones, with enough turns for the group.
    const pool = unique([
      ...cats.slice(0, 2).flatMap((c) => rotate(c.cat.realtalk[level], seed).slice(0, 1)),
      ...rotate(REAL_TALK_QUESTIONS[level], seed),
      ...rotate(backup.general.realtalk[level], seed),
    ])
    realtalk[level] = pool.slice(0, realTalkQuestionsPerLevel(total))
  }

  const spot = rankHangoutSpots(players, spots)[0]

  return {
    tierlist: { topic: top.cat.tierlist.topic, reason, items: top.cat.tierlist.items.slice(0, 8) },
    wit: [],
    realtalk,
    hangout: spot ? hangoutForSpot(players, spot) : { activity: 'Take turns sharing an activity you would like to try together.', spot_id: '', why: ['Keep the conversation going', 'Choose your next activity'] },
    fun_facts: funFacts(players),
  }
}
