import { INTERESTS, THIS_OR_THAT } from './quiz.ts'
import type { PlayerRow } from './types.ts'

/** The parts of a player that the content logic needs. */
export type PlayerLite = Pick<PlayerRow, 'id' | 'name' | 'interests' | 'this_or_that' | 'voice_text'>

export interface InterestCount {
  interest: string
  count: number
}

/** Interests picked by at least one player, most popular first. */
export function interestCounts(players: PlayerLite[]): InterestCount[] {
  const counts = new Map<string, number>()
  for (const p of players) {
    for (const i of new Set(p.interests ?? [])) counts.set(i, (counts.get(i) ?? 0) + 1)
  }
  const order = (i: string) => {
    const at = INTERESTS.indexOf(i)
    return at === -1 ? 999 : at
  }
  return [...counts.entries()]
    .map(([interest, count]) => ({ interest, count }))
    .sort((x, y) => y.count - x.count || order(x.interest) - order(y.interest))
}

export interface Split {
  key: string
  a: { label: string; group: string; count: number }
  b: { label: string; group: string; count: number }
}

export function thisOrThatSplits(players: PlayerLite[]): Split[] {
  return THIS_OR_THAT.map((q) => {
    let a = 0
    let b = 0
    for (const p of players) {
      const pick = p.this_or_that?.[q.key]
      if (pick === 'a') a++
      else if (pick === 'b') b++
    }
    return { key: q.key, a: { ...q.a, count: a }, b: { ...q.b, count: b } }
  })
}

/** The most lopsided this-or-that result, e.g. { label: 'Night owl', count: 4 }. */
export function biggestMajority(
  players: PlayerLite[],
): { label: string; group: string; count: number } | null {
  let best: { label: string; group: string; count: number } | null = null
  for (const s of thisOrThatSplits(players)) {
    for (const side of [s.a, s.b]) {
      if (side.count >= 2 && (!best || side.count > best.count)) best = side
    }
  }
  return best
}

export function countPhrase(count: number, total: number): string {
  if (count === total && total === 2) return 'Both of you'
  if (count === total) return `All ${total} of you`
  return `${count} of you`
}

export interface PairOverlap {
  a: string
  b: string
  /** Labels of what the two have in common: interests first, then this-or-that picks. */
  shared: string[]
  score: number
}

/** Every pair of players, strongest overlap first. */
export function pairOverlaps(players: PlayerLite[]): PairOverlap[] {
  const pairs: PairOverlap[] = []
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const x = players[i]
      const y = players[j]
      const sharedInterests = (x.interests ?? []).filter((n) => (y.interests ?? []).includes(n))
      const sharedPicks = THIS_OR_THAT.filter(
        (q) => x.this_or_that?.[q.key] && x.this_or_that[q.key] === y.this_or_that?.[q.key],
      ).map((q) => q[x.this_or_that[q.key]].label)
      pairs.push({
        a: x.id,
        b: y.id,
        shared: [...sharedInterests, ...sharedPicks],
        score: sharedInterests.length * 2 + sharedPicks.length,
      })
    }
  }
  return pairs.sort((x, y) => y.score - x.score)
}

export function strongestPairs(players: PlayerLite[], limit = 2): PairOverlap[] {
  return pairOverlaps(players)
    .filter((p) => p.score > 0)
    .slice(0, limit)
}

/** Two or three overlap lines for the common ground screen, built without AI. */
export function funFacts(players: PlayerLite[]): string[] {
  const facts: string[] = []
  const total = players.length
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? 'Someone'

  const majority = biggestMajority(players)
  if (majority) facts.push(`${countPhrase(majority.count, total)} ${majority.group}`)

  const top = interestCounts(players)[0]
  if (top && top.count >= 2) facts.push(`${countPhrase(top.count, total)} chose ${top.interest}`)

  // A pair fact that says something the two lines above did not.
  for (const pair of pairOverlaps(players)) {
    const fresh = pair.shared.find((label) => label !== top?.interest && label !== majority?.label)
    if (fresh) {
      const isInterest = INTERESTS.includes(fresh)
      facts.push(
        isInterest
          ? `${name(pair.a)} + ${name(pair.b)} both picked ${fresh}`
          : `${name(pair.a)} + ${name(pair.b)} both said "${fresh}"`,
      )
      break
    }
  }

  if (facts.length < 2) facts.push(`${total} strangers, one room, zero awkward silences (we hope)`)
  if (facts.length < 2) facts.push('You all showed up, which already counts as common ground')
  return facts.slice(0, 3)
}

/** First word of a display name, so the AI only ever sees first names. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/**
 * The name the AI sees for each player: the first name, or the whole display name when
 * two players share a first name. Returns a lookup from that name (lower case) back to
 * the display name.
 */
export function aiNames(players: PlayerLite[]): { nameOf: (p: PlayerLite) => string; aliases: Record<string, string> } {
  const firsts = players.map((p) => firstName(p.name).toLowerCase())
  const nameOf = (p: PlayerLite) => {
    const first = firstName(p.name)
    return firsts.filter((f) => f === first.toLowerCase()).length > 1 ? p.name.trim() : first
  }
  const aliases: Record<string, string> = {}
  for (const p of players) aliases[nameOf(p).toLowerCase()] = p.name
  return { nameOf, aliases }
}

/** What we tell the AI about the group. Location is deliberately not part of this. */
export function groupProfile(players: PlayerLite[], aiName: (p: PlayerLite) => string = (p) => p.name) {
  return {
    player_count: players.length,
    players: players.map((p) => ({
      name: aiName(p),
      interests: p.interests ?? [],
      picks: THIS_OR_THAT.filter((q) => p.this_or_that?.[q.key]).map(
        (q) => q[p.this_or_that[q.key]].label,
      ),
      into_lately: (p.voice_text ?? '').trim().slice(0, 140),
    })),
    interest_counts: interestCounts(players),
    this_or_that: thisOrThatSplits(players).map((s) => ({
      [s.a.label]: s.a.count,
      [s.b.label]: s.b.count,
    })),
  }
}
