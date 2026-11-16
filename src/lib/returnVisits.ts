import type { RoomRow } from '../shared/types.ts'
const PREFIX = 'hwm.visit.v1.'
export function rememberRoom(room: Pick<RoomRow, 'code' | 'title'>) {
  try {
    localStorage.setItem(
      PREFIX + room.code,
      JSON.stringify({ code: room.code, title: room.title || 'Your group', at: Date.now() }),
    )
  } catch {
    /* Returning by room code remains available when storage is full. */
  }
}
export function recentRooms(): { code: string; title: string; at: number }[] {
  try {
    const rooms: { code: string; title: string; at: number }[] = []
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (!key?.startsWith(PREFIX)) continue
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (
          value &&
          /^[A-Z]{4}$/.test(value.code) &&
          typeof value.title === 'string' &&
          typeof value.at === 'number'
        )
          rooms.push(value)
      } catch {
        /* Ignore a damaged browser entry. */
      }
    }
    return rooms.sort((a, b) => b.at - a.at || a.code.localeCompare(b.code)).slice(0, 3)
  } catch {
    return []
  }
}
