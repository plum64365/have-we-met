import published from '../data/community-stories.json'
import { uuid } from './identity.ts'

export const STORY_OUTCOMES = {
  first_hangout: 'Our first hangout',
  became_friends: 'We became friends',
  still_meeting: 'We keep meeting up',
} as const
export type StoryOutcome = keyof typeof STORY_OUTCOMES
export interface Story {
  id: string
  title: string
  group_name: string
  body: string
  place: string
  next_plan: string
  outcome: StoryOutcome
  photo: string | null
  updated_at: string
}
export interface StoryDraft extends Story {
  consent_confirmed: boolean
}
const DRAFT_KEY = 'hwm.story.draft.v1'
const SAVED_PREFIX = 'hwm.story.saved.v1.'
const OUTCOMES = Object.keys(STORY_OUTCOMES)

export function validStory(value: unknown): value is Story {
  if (!value || typeof value !== 'object') return false
  const story = value as Record<string, unknown>
  return (
    ['id', 'title', 'group_name', 'body', 'place', 'next_plan', 'updated_at'].every(
      (key) => typeof story[key] === 'string',
    ) &&
    /^[a-zA-Z0-9-]{1,80}$/.test(String(story.id)) &&
    !!String(story.title).trim() &&
    String(story.title).length <= 100 &&
    !!String(story.group_name).trim() &&
    String(story.group_name).length <= 60 &&
    !!String(story.body).trim() &&
    String(story.body).length <= 1800 &&
    String(story.place).length <= 120 &&
    String(story.next_plan).length <= 400 &&
    OUTCOMES.includes(String(story.outcome)) &&
    Number.isFinite(Date.parse(String(story.updated_at))) &&
    (story.photo === null ||
      (typeof story.photo === 'string' &&
        story.photo.length <= 300_000 &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(story.photo)))
  )
}

/** Published feed placeholder. Live publishing will be connected separately. Never seed fake testimonials. */
export const PUBLISHED_STORIES = (published as unknown[])
  .filter(validStory)
  .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))

export function emptyDraft(): StoryDraft {
  return {
    id: uuid(),
    title: '',
    group_name: '',
    body: '',
    place: '',
    next_plan: '',
    outcome: 'first_hangout',
    photo: null,
    consent_confirmed: false,
    updated_at: new Date().toISOString(),
  }
}
export function readStoryDraft(): StoryDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    // Partial drafts are expected. Rebuild only known fields, with bounded strings.
    if (!value || typeof value !== 'object' || typeof value.id !== 'string') return null
    const base = emptyDraft()
    for (const key of ['id', 'title', 'group_name', 'body', 'place', 'next_plan', 'updated_at'] as const) {
      if (typeof value[key] === 'string')
        base[key] = value[key].slice(
          0,
          { id: 80, title: 100, group_name: 60, body: 1800, place: 120, next_plan: 400, updated_at: 40 }[key],
        )
    }
    if (OUTCOMES.includes(value.outcome)) base.outcome = value.outcome
    if (
      value.photo === null ||
      (typeof value.photo === 'string' &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.photo) &&
        value.photo.length <= 300_000)
    )
      base.photo = value.photo
    base.consent_confirmed = value.consent_confirmed === true
    return base
  } catch {
    return null
  }
}
export function saveStoryDraft(draft: StoryDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}
export function deleteStoryDraft() {
  localStorage.removeItem(DRAFT_KEY)
}
export function savedStoryIds(): string[] {
  try {
    return PUBLISHED_STORIES.filter((story) => localStorage.getItem(SAVED_PREFIX + story.id) === '1').map(
      (story) => story.id,
    )
  } catch {
    return []
  }
}
export function setStorySaved(id: string, saved: boolean) {
  if (saved) localStorage.setItem(SAVED_PREFIX + id, '1')
  else localStorage.removeItem(SAVED_PREFIX + id)
}
