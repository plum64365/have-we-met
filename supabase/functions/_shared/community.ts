import type { RoomPlan, RoomRow } from './types.ts'

export const PHOTO_MAX_CHARS = 300_000
export const POST_PAGE_SIZE = 20

export function inviteUrl(value: string): string {
  const text = value.trim()
  if (!text) return ''
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new Error('Enter a full HTTPS invite link.')
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Use an HTTPS invite link without login details.')
  if (url.href.length > 2048) throw new Error('Choose an invite link shorter than 2048 characters.')
  return url.href
}

function calendarText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function foldLine(line: string): string {
  const encoder = new TextEncoder()
  let result = ''
  let width = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (width + size > 75) {
      result += '\r\n '
      width = 1
    }
    result += char
    width += size
  }
  return result
}

export function calendarForPlan(
  plan: RoomPlan,
  room: Pick<RoomRow, 'id' | 'title'>,
  roomUrl: string,
): string | null {
  if (!plan.starts_at) return null
  const start = new Date(plan.starts_at)
  if (!Number.isFinite(start.getTime())) return null
  const end = new Date(start.getTime() + plan.duration_minutes * 60_000)
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Have We Met//Room Planner//EN',
    'BEGIN:VEVENT',
    `UID:${room.id}@have-we-met`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${calendarText(plan.activity)}`,
    `LOCATION:${calendarText(plan.location)}`,
    `DESCRIPTION:${calendarText(`${room.title || 'Have We Met?'}\n${roomUrl}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(foldLine)
    .join('\r\n')
}
