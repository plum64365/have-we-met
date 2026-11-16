import { exploresCampus, introductionThemes } from './experience.ts'
import type { EventContext } from './experience.ts'
import { interestCounts } from './profile.ts'
import type { PlayerLite } from './profile.ts'
import type { GameContent, Spot } from './types.ts'

export function matchingPlayers(players: PlayerLite[], spot: Spot): number {
  return players.filter((p) => p.interests.some((interest) => spot.good_for.includes(interest))).length
}

/** Input is nearest-first. Stable sorting preserves distance order when coverage ties. */
export function rankHangoutSpots(players: PlayerLite[], nearbySpots: Spot[], room?: EventContext): Spot[] {
  const candidates = exploresCampus(room)
    ? nearbySpots.filter((spot) => spot.on_campus && spot.exploration_steps?.length === 3)
    : nearbySpots
  const themes = introductionThemes(players, room)
  const descriptionFit = (spot: Spot) => themes.filter((theme) => spot.good_for.includes(theme)).length
  return [...candidates].sort(
    (a, b) =>
      matchingPlayers(players, b) - matchingPlayers(players, a) || descriptionFit(b) - descriptionFit(a),
  )
}

export function hangoutForSpot(players: PlayerLite[], spot: Spot): GameContent['hangout'] {
  const why = interestCounts(players)
    .filter((c) => spot.good_for.includes(c.interest))
    .slice(0, 3)
    .map((c) => `${c.count} chose ${c.interest}`)
  if (why.length < 2) why.push('Start with one activity')
  if (why.length < 2) why.push('A chance to keep talking')
  return {
    spot_id: spot.id,
    activity:
      spot.activity ??
      'At this spot, take turns sharing one recommendation and choose something to try together.',
    why,
  }
}

export function campusTaskForSpot(spot?: Spot): GameContent['campus_task'] {
  if (!spot?.on_campus || spot.exploration_steps?.length !== 3) return undefined
  return {
    key: `${spot.id}:v1`,
    title: `Discover ${spot.name} together`,
    steps: spot.exploration_steps,
    return_prompt: 'Come back to your room, share what you found, and choose your next adventure together.',
  }
}
