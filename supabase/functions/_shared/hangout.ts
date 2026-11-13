import { interestCounts } from './profile.ts'
import type { PlayerLite } from './profile.ts'
import type { GameContent, Spot } from './types.ts'

export function matchingPlayers(players: PlayerLite[], spot: Spot): number {
  return players.filter((p) => p.interests.some((interest) => spot.good_for.includes(interest))).length
}

/** Input is nearest-first. Stable sorting preserves distance order when coverage ties. */
export function rankHangoutSpots(players: PlayerLite[], nearbySpots: Spot[]): Spot[] {
  return [...nearbySpots].sort((a, b) => matchingPlayers(players, b) - matchingPlayers(players, a))
}

export function hangoutForSpot(players: PlayerLite[], spot: Spot): GameContent['hangout'] {
  const why = interestCounts(players).filter((c) => spot.good_for.includes(c.interest))
    .slice(0, 3).map((c) => `${c.count} chose ${c.interest}`)
  if (why.length < 2) why.push('Start with one activity')
  if (why.length < 2) why.push('A chance to keep talking')
  return {
    spot_id: spot.id,
    activity: spot.activity ?? 'At this spot, take turns sharing one recommendation and choose something to try together.',
    why,
  }
}
