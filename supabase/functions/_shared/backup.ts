import { biggestMajority, countPhrase, funFacts, interestCounts } from './profile.ts'
import type { PlayerLite } from './profile.ts'
import { hangoutForSpot, rankHangoutSpots } from './hangout.ts'
import { REAL_TALK_QUESTIONS } from './question-bank.ts'
import { REALTALK_LEVELS } from './types.ts'
import type { BackupCategory, BackupContent, GameContent, Spot } from './types.ts'

export interface BackupOptions {
  /** How many Wit Dispute prompts to produce. */
  witCount: number
  /** Changes which templates are picked, so "Play again" feels different. */
  seed?: number
}

function fill(template: string, name: string, interest: string): string {
  return template.replaceAll('{name}', name).replaceAll('{interest}', interest.toLowerCase())
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

/** Round-robin pairs: (0,1), (2,3), (4,5), (0,1)… and for odd groups (0,1), (2,0), (1,2)… */
export function roundRobinPair(names: string[], index: number): string[] {
  if (names.length < 2) return [...names]
  const a = names[(index * 2) % names.length]
  const b = names[(index * 2 + 1) % names.length]
  return a === b ? [a, names[(index * 2 + 2) % names.length]] : [a, b]
}

/** Wit Dispute prompts from templates, with pairs assigned. */
export function backupWit(
  players: PlayerLite[],
  backup: BackupContent,
  count: number,
  seed = 0,
  avoid: string[] = [],
): GameContent['wit'] {
  const cats = rankedCategories(players, backup)
  const topInterest = cats[0].interest
  const names = players.map((p) => p.name)
  // Mix the top interests with the general pool so the round is not all one theme.
  const pool = unique([
    ...rotate(cats[0].cat.wit, seed),
    ...(cats.length > 2 ? rotate(cats[1].cat.wit, seed) : []),
    ...rotate(backup.general.wit, seed),
    ...cats.slice(2, -1).flatMap((c) => c.cat.wit),
  ])
  const out: GameContent['wit'] = []
  for (let i = 0; out.length < count && i < pool.length * 2; i++) {
    const pair = roundRobinPair(names, out.length)
    // The {name} slot is someone outside the pair when the group is big enough.
    const others = names.filter((n) => !pair.includes(n))
    const subject = others.length ? others[(i + seed) % others.length] : names[(i + seed) % Math.max(1, names.length)] ?? 'someone'
    const prompt = fill(pool[i % pool.length], subject, topInterest)
    if (avoid.includes(prompt) || out.some((w) => w.prompt === prompt)) continue
    out.push({ prompt, players: pair })
  }
  return out
}

/** Trims or pads the Wit Dispute list to exactly `count` prompts. */
export function fitWitCount(
  content: GameContent,
  players: PlayerLite[],
  backup: BackupContent,
  count: number,
  seed = 0,
): GameContent {
  if (content.wit.length === count) return content
  if (content.wit.length > count) return { ...content, wit: content.wit.slice(0, count) }
  const existing = content.wit.map((w) => w.prompt)
  const extra = backupWit(players, backup, count, seed + 1, existing)
  const names = players.map((p) => p.name)
  const padded = [...content.wit]
  for (const w of extra) {
    if (padded.length >= count) break
    padded.push({ prompt: w.prompt, players: roundRobinPair(names, padded.length) })
  }
  return { ...content, wit: padded }
}

/**
 * Builds a whole game with no AI. `spots` should already be ranked nearest-first when the
 * group shared a location. Works for any group, including players who skipped the quiz.
 */
export function buildBackupContent(
  players: PlayerLite[],
  backup: BackupContent,
  spots: Spot[],
  options: BackupOptions,
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
    // One question from each top interest, then general ones, three per level.
    const pool = unique([
      ...cats.slice(0, 2).flatMap((c) => rotate(c.cat.realtalk[level], seed).slice(0, 1)),
      ...rotate(REAL_TALK_QUESTIONS[level], seed),
      ...rotate(backup.general.realtalk[level], seed),
    ])
    realtalk[level] = pool.slice(0, 3)
  }

  const spot = rankHangoutSpots(players, spots)[0]

  return {
    tierlist: { topic: top.cat.tierlist.topic, reason, items: top.cat.tierlist.items.slice(0, 8) },
    wit: backupWit(players, backup, options.witCount, seed),
    realtalk,
    hangout: spot ? hangoutForSpot(players, spot) : { activity: 'Take turns sharing an activity you would like to try together.', spot_id: '', why: ['Keep the conversation going', 'Choose your next activity'] },
    fun_facts: funFacts(players),
  }
}
