import { buildBackupContent } from './backup.ts'
import { exploresCampus, introductionThemes, themeQuestion } from './experience.ts'
import { rankSpots } from './geo.ts'
import type { BackupContent, PlayerRow, RoomRow, Spot } from './types.ts'

/** Browser adaptation keeps older generator replies compatible with six-question play. */
export function contextualRoom(
  room: RoomRow,
  players: PlayerRow[],
  backup: BackupContent,
  spots: Spot[],
): RoomRow {
  if (!room.content) return room
  const content = {
    ...room.content,
    realtalk: {
      light: room.content.realtalk.light.slice(0, 2),
      real: room.content.realtalk.real.slice(0, 2),
      deep: room.content.realtalk.deep.slice(0, 2),
    },
  }
  if (room.content_source === 'wizard') return { ...room, content }
  if (exploresCampus(room)) {
    const campus = buildBackupContent(players, backup, rankSpots(spots, null), { room, seed: room.round - 1 })
    return {
      ...room,
      content: {
        ...content,
        tierlist: campus.tierlist,
        realtalk: campus.realtalk,
        hangout: campus.hangout,
        campus_task: campus.campus_task,
        computed: { ...content.computed, minutes_away: null },
      },
    }
  }
  const themes = introductionThemes(players, room)
  const realtalk = { ...content.realtalk }
  for (const level of ['light', 'real', 'deep'] as const) {
    const tailored = themes.slice(0, 1).map((theme) => themeQuestion(theme)[level])
    realtalk[level] = [
      ...tailored,
      ...realtalk[level].filter((question) => !tailored.includes(question)),
    ].slice(0, 2)
  }
  return { ...room, content: { ...content, realtalk } }
}
