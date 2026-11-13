import type { Spot } from './types.ts'

export interface LatLng {
  lat: number
  lng: number
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The group's average location, or null unless at least half the players shared one.
 */
export function averageLocation(shared: LatLng[], playerCount: number): LatLng | null {
  if (shared.length === 0 || shared.length * 2 < playerCount) return null
  const lat = shared.reduce((sum, p) => sum + p.lat, 0) / shared.length
  const lng = shared.reduce((sum, p) => sum + p.lng, 0) / shared.length
  return { lat, lng }
}

/** Spots sorted nearest first. With no centre, use the campus travel estimates. */
export function rankSpots(spots: Spot[], center: LatLng | null): Spot[] {
  if (!center) return [...spots].sort((x, y) => x.minutes - y.minutes)
  return [...spots].sort((x, y) => haversineKm(center, x) - haversineKm(center, y))
}

/**
 * A rough door-to-door estimate for a short city trip: about 2.2 min per km plus
 * 4 min of parking and walking, rounded to the nearest 5 and never below 5.
 */
export function estimateMinutes(center: LatLng, spot: Spot): number {
  const raw = haversineKm(center, spot) * 2.2 + 4
  return Math.max(5, Math.round(raw / 5) * 5)
}
