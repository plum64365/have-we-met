import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { uuid } from './identity.ts'
import { isConfigured } from './supabase.ts'
import {
  feedCursorFilter,
  isOutcome,
  isStoryId,
  sameContent,
  STORY_LIMITS,
  STORY_PAGE_SIZE,
  storyContent,
  StoryNotice,
  storyProblems,
  validPhoto,
} from './storyRules.ts'
import type { FeedCursor, Story, StoryContent, StoryDraft, StoryOutcome, StoryStatus } from './storyRules.ts'

export * from './storyRules.ts'

// Stories use their own client with a persisted session, kept under its own storage key.
// The game client in supabase.ts stays account-free. A visitor who only reads stories never
// signs in; the first publish creates an anonymous Supabase Auth user that owns the story.
const AUTH_STORAGE_KEY = 'hwm.stories.auth.v1'
let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!isConfigured)
    throw new StoryNotice('Stories are not connected to Supabase on this site yet.', 'NOT_CONFIGURED')
  client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: AUTH_STORAGE_KEY,
      },
    },
  )
  return client
}

// Never select '*': author_id and consent are deliberately not readable through the API.
const STORY_COLUMNS = 'id,title,group_name,body,place,next_plan,outcome,photo,status,revision,updated_at,published_at'

function toStory(row: unknown): Story | null {
  if (!row || typeof row !== 'object') return null
  const value = row as Record<string, unknown>
  const text = ['title', 'group_name', 'body', 'place', 'next_plan', 'updated_at'] as const
  if (!isStoryId(value.id) || !text.every((key) => typeof value[key] === 'string')) return null
  if (!isOutcome(value.outcome) || !validPhoto(value.photo ?? null)) return null
  if (value.status !== 'published' && value.status !== 'unpublished') return null
  return {
    id: value.id,
    title: value.title as string,
    group_name: value.group_name as string,
    body: value.body as string,
    place: value.place as string,
    next_plan: value.next_plan as string,
    outcome: value.outcome,
    photo: (value.photo as string | null) ?? null,
    status: value.status,
    revision: Number(value.revision) || 1,
    updated_at: value.updated_at as string,
    published_at: typeof value.published_at === 'string' ? value.published_at : null,
  }
}
const stories = (rows: unknown[] | null) => (rows ?? []).map(toStory).filter((s): s is Story => !!s)

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

export async function fetchFeed(
  outcome: StoryOutcome | '',
  after?: FeedCursor,
): Promise<{ stories: Story[]; hasMore: boolean }> {
  let query = db()
    .from('stories')
    .select(STORY_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(STORY_PAGE_SIZE + 1)
  if (outcome) query = query.eq('outcome', outcome)
  if (after) query = query.or(feedCursorFilter(after))
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const page = stories(data)
  return { stories: page.slice(0, STORY_PAGE_SIZE), hasMore: page.length > STORY_PAGE_SIZE }
}

/** A published story, or the signed-in author's own unpublished one. */
export async function fetchStory(id: string): Promise<Story | null> {
  if (!isStoryId(id)) return null
  const { data, error } = await db().from('stories').select(STORY_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return toStory(data)
}

/** Published stories for the given bookmark ids. Ids that are missing were unpublished or deleted. */
export async function fetchStoriesByIds(ids: string[]): Promise<Map<string, Story>> {
  const found = new Map<string, Story>()
  const valid = ids.filter(isStoryId)
  for (let i = 0; i < valid.length; i += 40) {
    const { data, error } = await db()
      .from('stories')
      .select(STORY_COLUMNS)
      .eq('status', 'published')
      .in('id', valid.slice(i, i + 40))
    if (error) throw new Error(error.message)
    for (const story of stories(data)) found.set(story.id, story)
  }
  return found
}

// ---------------------------------------------------------------------------------------------
// Authorship
// ---------------------------------------------------------------------------------------------

export interface MyStory {
  id: string
  title: string
  group_name: string
  outcome: StoryOutcome
  status: StoryStatus
  revision: number
  has_photo: boolean
  updated_at: string
  published_at: string | null
}

async function hasAuthorSession(): Promise<boolean> {
  const { data } = await db().auth.getSession()
  return !!data.session
}

async function ensureAuthor(): Promise<void> {
  if (await hasAuthorSession()) return
  const { error } = await db().auth.signInAnonymously()
  if (error) throw new Error(error.code ?? error.message)
}

/** Stories published from this browser. Never signs in: no session means no stories yet. */
export async function myStories(): Promise<MyStory[]> {
  if (!(await hasAuthorSession())) return []
  const { data, error } = await db().rpc('my_stories')
  if (error) throw new Error(error.message)
  return ((data ?? []) as MyStory[]).filter((story) => isStoryId(story.id) && isOutcome(story.outcome))
}

/** The full story if this browser's author owns it. */
export async function ownStory(id: string): Promise<Story | null> {
  if (!(await myStories()).some((story) => story.id === id)) return null
  return fetchStory(id)
}

const conflict = () =>
  new StoryNotice(
    'This story was changed somewhere else, such as another tab. Copy anything you want to keep, then discard your local changes to load the latest version.',
    'CONFLICT',
  )
const notOwner = () =>
  new StoryNotice(
    'This story was deleted or was published from a different browser, so it cannot be changed here.',
    'NOT_OWNER',
  )

// ---------------------------------------------------------------------------------------------
// Writing. Every write is safe to retry: the story id comes from the draft, and edits are
// conditional on the revision they started from.
// ---------------------------------------------------------------------------------------------

export async function publishStory(draft: StoryDraft): Promise<Story> {
  const problems = storyProblems(draft)
  if (problems.length) throw new StoryNotice(problems.join(' '), 'INVALID')
  await ensureAuthor()
  const content = storyContent(draft)
  if (draft.base_revision !== undefined) return updateStory(draft.id, content, draft.base_revision)
  const { data, error } = await db()
    .from('stories')
    .insert({ id: draft.id, ...content, consent_confirmed: true })
    .select(STORY_COLUMNS)
    .single()
  if (!error) {
    const story = toStory(data)
    if (story) return story
  }
  if (error && error.code !== '23505') throw new Error(error.message)
  // A retry after a lost response: the first attempt already created the story.
  const existing = await ownStory(draft.id)
  if (!existing) throw notOwner()
  if (existing.status === 'published' && sameContent(existing, content)) return existing
  return updateStory(draft.id, content, existing.revision)
}

async function updateStory(id: string, content: StoryContent, revision: number): Promise<Story> {
  const { data, error } = await db()
    .from('stories')
    .update({ ...content, consent_confirmed: true, status: 'published' })
    .eq('id', id)
    .eq('revision', revision)
    .select(STORY_COLUMNS)
  if (error) throw new Error(error.message)
  const updated = stories(data)[0]
  if (updated) return updated
  const current = await ownStory(id)
  if (!current) throw notOwner()
  // The same edit already went through on an earlier attempt.
  if (current.status === 'published' && sameContent(current, content)) return current
  throw conflict()
}

export async function setStoryStatus(id: string, status: StoryStatus, revision: number): Promise<void> {
  const { data, error } = await db()
    .from('stories')
    .update({ status })
    .eq('id', id)
    .eq('revision', revision)
    .select('id')
  if (error) throw new Error(error.message)
  if (data?.length) return
  const current = await ownStory(id)
  if (!current) throw notOwner()
  if (current.status !== status) throw conflict()
}

export async function deleteStory(id: string): Promise<void> {
  const { error } = await db().from('stories').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------------------------
// Local drafts (this browser only)
// ---------------------------------------------------------------------------------------------

const NEW_DRAFT_KEY = 'hwm.story.draft.v1'
const EDIT_DRAFT_PREFIX = 'hwm.story.edit.v1.'
const draftKey = (draft: Pick<StoryDraft, 'id' | 'base_revision'>) =>
  draft.base_revision === undefined ? NEW_DRAFT_KEY : EDIT_DRAFT_PREFIX + draft.id

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

/** Start editing a published story. Permission is confirmed again before the changes go live. */
export function draftFromStory(story: Story): StoryDraft {
  return {
    ...storyContent(story),
    id: story.id,
    updated_at: story.updated_at,
    consent_confirmed: false,
    base_revision: story.revision,
  }
}

function parseDraft(raw: string | null): StoryDraft | null {
  try {
    const value = JSON.parse(raw ?? 'null')
    // Partial drafts are expected. Rebuild only known fields, with bounded strings.
    if (!value || typeof value !== 'object' || !isStoryId(value.id)) return null
    const base = emptyDraft()
    base.id = value.id
    for (const key of Object.keys(STORY_LIMITS) as (keyof typeof STORY_LIMITS)[])
      if (typeof value[key] === 'string') base[key] = value[key].slice(0, STORY_LIMITS[key])
    if (typeof value.updated_at === 'string') base.updated_at = value.updated_at.slice(0, 40)
    if (isOutcome(value.outcome)) base.outcome = value.outcome
    if (validPhoto(value.photo ?? null)) base.photo = value.photo ?? null
    base.consent_confirmed = value.consent_confirmed === true
    if (Number.isInteger(value.base_revision) && value.base_revision > 0) base.base_revision = value.base_revision
    return base
  } catch {
    return null
  }
}

export function readStoryDraft(): StoryDraft | null {
  try {
    return parseDraft(localStorage.getItem(NEW_DRAFT_KEY))
  } catch {
    return null
  }
}
export function readEditDraft(id: string): StoryDraft | null {
  try {
    const draft = parseDraft(localStorage.getItem(EDIT_DRAFT_PREFIX + id))
    return draft?.id === id && draft.base_revision !== undefined ? draft : null
  } catch {
    return null
  }
}
export function hasEditDraft(id: string): boolean {
  return readEditDraft(id) !== null
}
export function saveStoryDraft(draft: StoryDraft) {
  localStorage.setItem(draftKey(draft), JSON.stringify({ ...draft, updated_at: new Date().toISOString() }))
}
export function deleteStoryDraft(draft: Pick<StoryDraft, 'id' | 'base_revision'>) {
  localStorage.removeItem(draftKey(draft))
}

// ---------------------------------------------------------------------------------------------
// Saved stories (bookmarks). Kept per browser and independent of which feed page is loaded.
// ---------------------------------------------------------------------------------------------

const SAVED_PREFIX = 'hwm.story.saved.v1.'

/** Saved story ids, most recently saved first. */
export function savedStoryIds(): string[] {
  try {
    const saved: [string, number][] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(SAVED_PREFIX)) continue
      const id = key.slice(SAVED_PREFIX.length)
      if (isStoryId(id)) saved.push([id, Number(localStorage.getItem(key)) || 0])
    }
    return saved.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id)
  } catch {
    return []
  }
}
export function setStorySaved(id: string, saved: boolean) {
  if (saved) localStorage.setItem(SAVED_PREFIX + id, String(Date.now()))
  else localStorage.removeItem(SAVED_PREFIX + id)
}
