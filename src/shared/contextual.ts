import { buildBackupContent } from './backup.ts'
import { exploresCampus, introductionThemes, themeQuestion } from './experience.ts'
import { rankSpots } from './geo.ts'
import type { BackupContent, PlayerRow, RoomRow, Spot } from './types.ts'

/** A deterministic browser adaptation, so this release needs no Edge Function or schema changes. */
export function contextualRoom(
  room: RoomRow,
  players: PlayerRow[],
  backup: BackupContent,
  spots: Spot[],
): RoomRow {
  if (!room.content || room.content_source === 'wizard') return room
  if (exploresCampus(room)) {
    const campus = buildBackupContent(players, backup, rankSpots(spots, null), { room, seed: room.round - 1 })
    return {
      ...room,
      content: {
        ...room.content,
        tierlist: campus.tierlist,
        realtalk: campus.realtalk,
        hangout: campus.hangout,
        campus_task: campus.campus_task,
        computed: { ...room.content.computed, minutes_away: null },
      },
    }
  }
  const themes = introductionThemes(players, room)
  if (!themes.length) return room
  const realtalk = { ...room.content.realtalk }
  for (const level of ['light', 'real', 'deep'] as const) {
    const tailored = themes.slice(0, 2).map((theme) => themeQuestion(theme)[level])
    realtalk[level] = [
      ...tailored,
      ...realtalk[level].filter((question) => !tailored.includes(question)),
    ].slice(0, realtalk[level].length)
  }
  return { ...room, content: { ...room.content, realtalk } }
}
