// Pure story rules shared by the editor, the API layer and scripts/test-logic.mjs.
// The database enforces the same limits (supabase/migrations/20261117220000_live_stories.sql).

export const STORY_OUTCOMES = {
  first_hangout: 'Our first hangout',
  became_friends: 'We became friends',
  still_meeting: 'We keep meeting up',
} as const
export type StoryOutcome = keyof typeof STORY_OUTCOMES
export type StoryStatus = 'published' | 'unpublished'

export const STORY_LIMITS = { title: 100, group_name: 60, body: 1800, place: 120, next_plan: 400 } as const
export const STORY_PHOTO_MAX_CHARS = 300_000
export const STORY_PAGE_SIZE = 12
const PHOTO_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface StoryContent {
  title: string
  group_name: string
  body: string
  place: string
  next_plan: string
  outcome: StoryOutcome
  photo: string | null
}
export interface Story extends StoryContent {
  id: string
  status: StoryStatus
  revision: number
  updated_at: string
  published_at: string | null
}
export interface StoryDraft extends StoryContent {
  id: string
  updated_at: string
  consent_confirmed: boolean
  /** Set when the draft edits an already published story: the revision the edits started from. */
  base_revision?: number
}

export const isStoryId = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value)

export const isOutcome = (value: unknown): value is StoryOutcome =>
  typeof value === 'string' && Object.hasOwn(STORY_OUTCOMES, value)

export const validPhoto = (value: unknown): value is string | null =>
  value === null ||
  (typeof value === 'string' && value.length <= STORY_PHOTO_MAX_CHARS && PHOTO_PATTERN.test(value))

/** Problems that block publishing, written for the person filling in the form. */
export function storyProblems(draft: StoryContent & { consent_confirmed: boolean }): string[] {
  const problems: string[] = []
  if (!draft.title.trim()) problems.push('Add a story title.')
  if (!draft.group_name.trim()) problems.push('Add a public group name.')
  if (!draft.body.trim()) problems.push('Tell your story before publishing.')
  for (const [key, max] of Object.entries(STORY_LIMITS))
    if (draft[key as keyof typeof STORY_LIMITS].length > max)
      problems.push(`Shorten the ${key.replace('_', ' ')} to ${max} characters.`)
  if (!isOutcome(draft.outcome)) problems.push('Choose a chapter for your story.')
  if (!validPhoto(draft.photo)) problems.push('Choose the photo again.')
  if (!draft.consent_confirmed) problems.push('Confirm that everyone agreed to share this story publicly.')
  return problems
}

/** The fields sent to the server. Text is trimmed so the stored story matches what readers see. */
export function storyContent(draft: StoryContent): StoryContent {
  return {
    title: draft.title.trim(),
    group_name: draft.group_name.trim(),
    body: draft.body.trim(),
    place: draft.place.trim(),
    next_plan: draft.next_plan.trim(),
    outcome: draft.outcome,
    photo: draft.photo,
  }
}

export function sameContent(a: StoryContent, b: StoryContent): boolean {
  const x = storyContent(a)
  const y = storyContent(b)
  return (Object.keys(x) as (keyof StoryContent)[]).every((key) => x[key] === y[key])
}

export interface FeedCursor {
  published_at: string
  id: string
}

/** Keyset filter for the next feed page: strictly older than the cursor, ties broken by id. */
export function feedCursorFilter(cursor: FeedCursor): string {
  if (!isStoryId(cursor.id) || !Number.isFinite(Date.parse(cursor.published_at)))
    throw new Error('Invalid feed cursor.')
  const at = `"${cursor.published_at}"`
  return `published_at.lt.${at},and(published_at.eq.${at},id.lt.${cursor.id})`
}

/** Merge a new page into the loaded feed without duplicates, newest first, deterministic. */
export function mergeFeed(current: Story[], incoming: Story[]): Story[] {
  const byId = new Map(current.map((story) => [story.id, story]))
  for (const story of incoming) byId.set(story.id, story)
  return [...byId.values()].sort(
    (a, b) =>
      (b.published_at ?? '').localeCompare(a.published_at ?? '') ||
      (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  )
}

/** An error whose message is already written for the author. */
export type StoryNoticeCode = 'CONFLICT' | 'NOT_OWNER' | 'INVALID' | 'NOT_CONFIGURED'
export class StoryNotice extends Error {
  readonly code: StoryNoticeCode
  constructor(message: string, code: StoryNoticeCode) {
    super(message)
    this.name = 'StoryNotice'
    this.code = code
  }
}

/** Turn database and network errors into short messages. Callers add what happened to the draft. */
export function storyErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'StoryNotice') return error.message
  const text = error instanceof Error ? error.message : String(error ?? '')
  if (/anonymous.*(disabled|not enabled)|anonymous_provider_disabled/i.test(text))
    return 'Story publishing is not switched on for this site yet.'
  if (/STORY_LIMIT/.test(text)) return 'This browser has reached the limit of 30 stories. Delete one first.'
  if (/CONSENT_REQUIRED/.test(text)) return 'Confirm that everyone agreed to share this story publicly.'
  if (/SIGN_IN_REQUIRED|JWT|permission denied|row-level security/i.test(text))
    return 'This browser is not allowed to change that story. Only its author can edit it.'
  if (/check constraint|violates/i.test(text))
    return 'Something in the story is empty or too long. Check each field and try again.'
  if (/rate limit|too many/i.test(text)) return 'Too many attempts right now. Wait a minute and try again.'
  if (/fetch|network|load failed|timeout|abort/i.test(text))
    return 'Could not reach the stories server. Check your connection and try again.'
  return 'Something went wrong. Try again in a moment.'
}
