import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Logo } from '../components/ui.tsx'
import { useTheme } from '../hooks/useTheme.ts'
import { preparePhoto } from '../lib/photos.ts'
import {
  deleteStory,
  deleteStoryDraft,
  draftFromStory,
  emptyDraft,
  fetchFeed,
  fetchStoriesByIds,
  fetchStory,
  hasEditDraft,
  mergeFeed,
  myStories,
  ownStory,
  publishStory,
  readEditDraft,
  readStoryDraft,
  savedStoryIds,
  saveStoryDraft,
  setStorySaved,
  setStoryStatus,
  STORY_LIMITS,
  STORY_OUTCOMES,
  storyErrorMessage,
  storyProblems,
} from '../lib/stories.ts'
import type { MyStory, Story, StoryDraft, StoryOutcome, StoryStatus } from '../lib/stories.ts'

type Load = 'loading' | 'ready' | 'error'

function StoryLayout({ children }: { children: ReactNode }) {
  useTheme('purple')
  return (
    <main className="stories-page">
      <nav className="stories-nav" aria-label="Main navigation">
        <Link to="/" aria-label="Have We Met home">
          <Logo small />
        </Link>
        <div className="community-actions">
          <Link className="btn btn-white btn-small" to="/stories">
            Stories
          </Link>
          <Link className="btn btn-white btn-small" to="/stories/mine">
            Your stories
          </Link>
          <Link className="btn btn-yellow btn-small" to="/">
            Your room
          </Link>
        </div>
      </nav>
      {children}
    </main>
  )
}

const formatDate = (value: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : ''

function SaveStory({ id, onChange }: { id: string; onChange?: () => void }) {
  const [saved, setSaved] = useState(() => savedStoryIds().includes(id))
  const [error, setError] = useState('')
  useEffect(() => {
    const sync = () => setSaved(savedStoryIds().includes(id))
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [id])
  const toggle = () => {
    try {
      setStorySaved(id, !saved)
      setSaved(!saved)
      setError('')
      onChange?.()
    } catch {
      setError('This browser could not save the story. You can bookmark its page instead.')
    }
  }
  return (
    <div>
      <button className="link-btn" aria-pressed={saved} onClick={toggle}>
        {saved ? '★ Saved' : '☆ Save story'}
      </button>
      {error && (
        <p className="hint" role="status">
          {error}
        </p>
      )}
    </div>
  )
}

function StoryCard({ story, onSavedChange }: { story: Story; onSavedChange: () => void }) {
  return (
    <article className="card story-card">
      {story.photo && (
        <Link to={`/stories/${story.id}`} tabIndex={-1} aria-hidden="true">
          <img src={story.photo} alt="" loading="lazy" className="story-cover" />
        </Link>
      )}
      <div className="story-card-body">
        <p className="chip chip-lilac">{STORY_OUTCOMES[story.outcome]}</p>
        <h3>
          <Link to={`/stories/${story.id}`}>{story.title}</Link>
        </h3>
        <p className="hint">
          By {story.group_name}
          {story.place && ` · ${story.place}`}
        </p>
        <p className="story-excerpt">{story.body}</p>
        <div className="community-title-row">
          <Link className="link-btn" to={`/stories/${story.id}`}>
            Read their story ↗
          </Link>
          <SaveStory id={story.id} onChange={onSavedChange} />
        </div>
      </div>
    </article>
  )
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card pad story-empty" role="alert">
      <h3>That did not load</h3>
      <p>{message}</p>
      <button className="btn btn-cyan" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

export function Stories() {
  const [outcome, setOutcome] = useState<StoryOutcome | ''>('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [savedIds, setSavedIds] = useState(savedStoryIds)
  const [stories, setStories] = useState<Story[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [load, setLoad] = useState<Load>('loading')
  const [error, setError] = useState('')
  const [more, setMore] = useState<'idle' | 'loading' | 'error'>('idle')
  const request = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++request.current
    setLoad('loading')
    setMore('idle')
    try {
      if (savedOnly) {
        // Bookmarks are fetched by id, so they never depend on which feed page is loaded.
        const ids = savedStoryIds().slice(0, 120)
        const found = await fetchStoriesByIds(ids)
        if (current !== request.current) return
        setStories(ids.flatMap((id) => found.get(id) ?? []))
        setMissing(ids.filter((id) => !found.has(id)))
        setHasMore(false)
      } else {
        const page = await fetchFeed(outcome)
        if (current !== request.current) return
        setStories(page.stories)
        setHasMore(page.hasMore)
        setMissing([])
      }
      setLoad('ready')
    } catch (e) {
      if (current !== request.current) return
      setError(storyErrorMessage(e))
      setLoad('error')
    }
  }, [outcome, savedOnly])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const sync = () => setSavedIds(savedStoryIds())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const loadMore = async () => {
    const last = stories.at(-1)
    if (!last?.published_at || more === 'loading') return
    const current = request.current
    setMore('loading')
    try {
      const page = await fetchFeed(outcome, { published_at: last.published_at, id: last.id })
      if (current !== request.current) return
      setStories((loaded) => mergeFeed(loaded, page.stories))
      setHasMore(page.hasMore)
      setMore('idle')
    } catch {
      if (current === request.current) setMore('error')
    }
  }

  const forgetMissing = () => {
    try {
      for (const id of missing) setStorySaved(id, false)
    } catch {
      // Storage unavailable: nothing was saved on this browser in the first place.
    }
    setMissing([])
    setSavedIds(savedStoryIds())
  }

  const choose = (next: StoryOutcome | '') => setOutcome(next)
  const visible = stories.filter(
    (story) => (!outcome || story.outcome === outcome) && (!savedOnly || savedIds.includes(story.id)),
  )

  return (
    <StoryLayout>
      <header className="stories-hero">
        <p className="kicker">The part after “nice to meet you”</p>
        <h1>
          Strangers once.
          <br />
          <span>More stories ahead.</span>
        </h1>
        <p>
          Campus discoveries, first hangouts, and friendships that kept going. A place for groups to share
          what happened after the game.
        </p>
        <div className="community-actions">
          <Link className="btn btn-yellow" to="/stories/write">
            Tell your story
          </Link>
          <Link className="btn btn-white" to="/stories/mine">
            Your stories
          </Link>
          <Link className="btn btn-white" to="/">
            Find your group again
          </Link>
        </div>
        <div className="story-journey" aria-label="Meet, explore, come back">
          <span>01 · Meet</span>
          <span>02 · Explore together</span>
          <span>03 · Come back</span>
        </div>
      </header>
      <section className="stories-section" aria-label="Community stories" aria-busy={load === 'loading'}>
        <div className="stories-section-title">
          <h2>After we met</h2>
          <p>Real experiences, shared with permission.</p>
        </div>
        <div className="story-filters" role="group" aria-label="Filter stories">
          <button
            className={`chip ${!outcome ? 'chip-yellow' : 'chip-light'}`}
            aria-pressed={!outcome}
            onClick={() => choose('')}
          >
            All stories
          </button>
          {(Object.entries(STORY_OUTCOMES) as [StoryOutcome, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`chip ${outcome === key ? 'chip-yellow' : 'chip-light'}`}
              aria-pressed={outcome === key}
              onClick={() => choose(key)}
            >
              {label}
            </button>
          ))}
          <button
            className={`chip ${savedOnly ? 'chip-cyan' : 'chip-light'}`}
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly(!savedOnly)}
          >
            ★ Saved stories
          </button>
        </div>
        {savedOnly && missing.length > 0 && load === 'ready' && (
          <div className="card pad story-missing" role="status">
            <p>
              {missing.length === 1
                ? 'One saved story is no longer available. Its group may have unpublished or removed it.'
                : `${missing.length} saved stories are no longer available. Their groups may have unpublished or removed them.`}
            </p>
            <button className="link-btn" onClick={forgetMissing}>
              Remove from saved
            </button>
          </div>
        )}
        {load === 'loading' ? (
          <p className="stories-status" role="status">
            Loading stories…
          </p>
        ) : load === 'error' ? (
          <LoadError message={error} onRetry={() => void refresh()} />
        ) : visible.length ? (
          <div className="story-grid">
            {visible.map((story) => (
              <StoryCard key={story.id} story={story} onSavedChange={() => setSavedIds(savedStoryIds())} />
            ))}
          </div>
        ) : (
          <div className="card pad story-empty">
            <div className="story-empty-art" aria-hidden="true">
              <span>hi!</span>
              <span>again?</span>
            </div>
            <h3>
              {savedOnly
                ? 'Keep a story for later'
                : outcome
                  ? 'A new chapter is on its way'
                  : 'The first story could be yours'}
            </h3>
            <p>
              {savedOnly
                ? 'Tap Save story on a post to find it here when you return on this browser.'
                : 'This collection is waiting for real group stories. Meet up, explore somewhere together, then tell us how it went.'}
            </p>
            <Link className="btn btn-cyan" to="/stories/write">
              Start your story
            </Link>
          </div>
        )}
        {load === 'ready' && !savedOnly && hasMore && (
          <button className="btn btn-white" onClick={() => void loadMore()} disabled={more === 'loading'}>
            {more === 'loading' ? 'Loading…' : 'More stories'}
          </button>
        )}
        {more === 'error' && (
          <p className="stories-status" role="alert">
            More stories could not load. Tap More stories to try again.
          </p>
        )}
      </section>
      <section className="card pad story-return">
        <div>
          <p className="kicker">Make it a regular thing</p>
          <h2>One hangout is a beginning.</h2>
          <p>
            Go back to your room, pick the next date, and keep a record of the little things you discover
            together.
          </p>
        </div>
        <Link className="btn btn-yellow" to="/">
          Return to your room
        </Link>
      </section>
    </StoryLayout>
  )
}

export function StoryDetail() {
  const { id = '' } = useParams()
  const location = useLocation()
  const justPublished = (location.state as { published?: boolean } | null)?.published === true
  const [load, setLoad] = useState<Load | 'missing'>('loading')
  const [story, setStory] = useState<Story | null>(null)
  const [mine, setMine] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(() => savedStoryIds().includes(id))
  const request = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++request.current
    setLoad('loading')
    try {
      const [found, own] = await Promise.all([fetchStory(id), myStories().catch(() => [] as MyStory[])])
      if (current !== request.current) return
      setStory(found)
      setMine(own.some((entry) => entry.id === id))
      setLoad(found ? 'ready' : 'missing')
    } catch (e) {
      if (current !== request.current) return
      setError(storyErrorMessage(e))
      setLoad('error')
    }
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <StoryLayout>
      {load === 'loading' ? (
        <p className="stories-status" role="status">
          Opening story…
        </p>
      ) : load === 'error' ? (
        <LoadError message={error} onRetry={() => void refresh()} />
      ) : story && load === 'ready' ? (
        <article className="card pad story-detail">
          <Link className="link-btn" to="/stories">
            ← All stories
          </Link>
          {justPublished && story.status === 'published' && (
            <p className="story-note" role="status">
              Your story is live. You can edit or unpublish it any time from Your stories on this browser.
            </p>
          )}
          {mine && story.status !== 'published' && (
            <p className="story-note" role="status">
              Only you can see this. It is unpublished and does not appear on the stories page.
            </p>
          )}
          <p className="chip chip-yellow">{STORY_OUTCOMES[story.outcome]}</p>
          <h1>{story.title}</h1>
          <p>
            By {story.group_name}
            {story.place && ` · ${story.place}`}
          </p>
          <p className="hint">Updated {formatDate(story.updated_at)}</p>
          {story.photo && (
            <img className="room-photo" src={story.photo} alt={`A moment shared by ${story.group_name}`} />
          )}
          <p className="post-body">{story.body}</p>
          {story.next_plan && (
            <aside className="story-next">
              <h2>The next plan</h2>
              <p className="post-body">{story.next_plan}</p>
            </aside>
          )}
          {story.status === 'published' && <SaveStory id={story.id} />}
          {mine ? (
            <div className="community-actions">
              <Link className="btn btn-cyan" to={`/stories/${story.id}/edit`}>
                Edit story
              </Link>
              <Link className="btn btn-white" to="/stories/mine">
                Manage your stories
              </Link>
            </div>
          ) : (
            <Link className="btn btn-cyan" to="/stories/write">
              What is your group’s story?
            </Link>
          )}
        </article>
      ) : (
        <section className="card pad step">
          <h1>Story unavailable</h1>
          <p>Its group may have unpublished or removed it.</p>
          {saved && (
            <button
              className="link-btn"
              onClick={() => {
                try {
                  setStorySaved(id, false)
                } catch {
                  // Nothing to remove when storage is unavailable.
                }
                setSaved(false)
              }}
            >
              Remove from saved stories
            </button>
          )}
          <Link className="btn" to="/stories">
            Explore stories
          </Link>
        </section>
      )}
    </StoryLayout>
  )
}

export function MyStories() {
  const [stories, setStories] = useState<MyStory[]>([])
  const [load, setLoad] = useState<Load>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const [draft] = useState(readStoryDraft)
  const request = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++request.current
    setLoad('loading')
    try {
      const own = await myStories()
      if (current !== request.current) return
      setStories(own)
      setLoad('ready')
    } catch (e) {
      if (current !== request.current) return
      setError(storyErrorMessage(e))
      setLoad('error')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const act = async (story: MyStory, action: () => Promise<void>) => {
    if (busy) return
    setBusy(story.id)
    setActionError('')
    try {
      await action()
      await refresh()
    } catch (e) {
      setActionError(`“${story.title}”: ${storyErrorMessage(e)}`)
    } finally {
      setBusy('')
    }
  }
  const changeStatus = (story: MyStory, status: StoryStatus) =>
    act(story, () => setStoryStatus(story.id, status, story.revision))
  const remove = (story: MyStory) => {
    if (!window.confirm(`Delete “${story.title}” permanently? This removes its text and photo.`)) return
    void act(story, async () => {
      await deleteStory(story.id)
      try {
        deleteStoryDraft({ id: story.id, base_revision: story.revision })
      } catch {
        // No local edits to clear.
      }
    })
  }

  return (
    <StoryLayout>
      <header className="stories-intro">
        <p className="kicker">Published from this browser</p>
        <h1>Your stories</h1>
        <p>
          Edit, unpublish, or delete the stories you shared. Unpublished stories disappear from the stories
          page right away and stay here until you publish them again.
        </p>
      </header>
      <section className="stories-section" aria-label="Your stories" aria-busy={load === 'loading'}>
        {draft && (draft.title || draft.body) && (
          <div className="card pad my-story">
            <div>
              <p className="chip chip-light">Draft · Only on this browser</p>
              <h3>{draft.title || 'Untitled draft'}</h3>
            </div>
            <Link className="btn btn-yellow btn-small" to="/stories/write">
              Continue draft
            </Link>
          </div>
        )}
        {load === 'loading' ? (
          <p className="stories-status" role="status">
            Loading your stories…
          </p>
        ) : load === 'error' ? (
          <LoadError message={error} onRetry={() => void refresh()} />
        ) : stories.length ? (
          <ul className="my-stories">
            {stories.map((story) => (
              <li className="card pad my-story" key={story.id} aria-busy={busy === story.id}>
                <div>
                  <p className={`chip ${story.status === 'published' ? 'chip-cyan' : 'chip-light'}`}>
                    {story.status === 'published' ? 'Public' : 'Unpublished'}
                  </p>
                  <h3>
                    <Link to={`/stories/${story.id}`}>{story.title}</Link>
                  </h3>
                  <p className="hint">
                    {STORY_OUTCOMES[story.outcome]} · Updated {formatDate(story.updated_at)}
                    {story.has_photo && ' · With photo'}
                    {hasEditDraft(story.id) && ' · Unsaved changes on this browser'}
                  </p>
                </div>
                <div className="community-actions">
                  <Link className="btn btn-cyan btn-small" to={`/stories/${story.id}/edit`}>
                    Edit
                  </Link>
                  {story.status === 'published' ? (
                    <button
                      className="btn btn-white btn-small"
                      disabled={!!busy}
                      onClick={() => void changeStatus(story, 'unpublished')}
                    >
                      {busy === story.id ? 'Working…' : 'Unpublish'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-yellow btn-small"
                      disabled={!!busy}
                      onClick={() => void changeStatus(story, 'published')}
                    >
                      {busy === story.id ? 'Working…' : 'Publish again'}
                    </button>
                  )}
                  <button className="link-btn" disabled={!!busy} onClick={() => remove(story)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card pad story-empty">
            <h3>Nothing published from this browser yet</h3>
            <p>Stories you publish here will be listed so you can edit or unpublish them later.</p>
            <Link className="btn btn-cyan" to="/stories/write">
              Start your story
            </Link>
          </div>
        )}
        {actionError && (
          <p className="stories-status" role="alert">
            {actionError}
          </p>
        )}
        <p className="stories-status">
          Your stories are linked to this browser, with no account. If you clear this site’s data or switch
          browsers, you will no longer be able to edit them from there.
        </p>
      </section>
    </StoryLayout>
  )
}

/** Edit an existing story. Only its author's browser can load it here. */
export function StoryEdit() {
  const { id = '' } = useParams()
  const [state, setState] = useState<
    | { load: 'loading' | 'missing' }
    | { load: 'error'; message: string }
    | { load: 'ready'; story: Story; draft: StoryDraft; restored: boolean }
  >({ load: 'loading' })
  const request = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++request.current
    setState({ load: 'loading' })
    try {
      const story = await ownStory(id)
      if (current !== request.current) return
      if (!story) return setState({ load: 'missing' })
      const local = readEditDraft(id)
      setState({ load: 'ready', story, draft: local ?? draftFromStory(story), restored: !!local })
    } catch (e) {
      if (current === request.current) setState({ load: 'error', message: storyErrorMessage(e) })
    }
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (state.load === 'ready')
    return (
      <EditorForm
        key={`${state.story.id}:${state.story.revision}:${state.restored}`}
        initial={state.draft}
        story={state.story}
        restored={state.restored}
        onDiscard={() => void refresh()}
      />
    )
  return (
    <StoryLayout>
      {state.load === 'loading' ? (
        <p className="stories-status" role="status">
          Opening your story…
        </p>
      ) : state.load === 'error' ? (
        <LoadError message={state.message} onRetry={() => void refresh()} />
      ) : (
        <section className="card pad step">
          <h1>You cannot edit this story here</h1>
          <p>Stories can only be edited from the browser that published them, and this one was not found.</p>
          <Link className="btn" to="/stories/mine">
            Your stories
          </Link>
        </section>
      )}
    </StoryLayout>
  )
}

export function StoryEditor() {
  const [initial] = useState(() => readStoryDraft() ?? emptyDraft())
  return <EditorForm initial={initial} />
}

function EditorForm({
  initial,
  story,
  restored = false,
  onDiscard,
}: {
  initial: StoryDraft
  story?: Story
  restored?: boolean
  onDiscard?: () => void
}) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<StoryDraft>(initial)
  const [status, setStatus] = useState(
    restored ? 'Restored the changes you saved on this browser. They are not public yet.' : '',
  )
  const [error, setError] = useState(
    restored && story && initial.base_revision !== story.revision
      ? 'This story changed since you saved these edits. Publishing them will replace the newer version.'
      : '',
  )
  const [preparing, setPreparing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const busy = useRef(false)
  const editing = !!story
  // Edits always build on the latest revision the author has seen.
  const base = story ? { ...draft, base_revision: story.revision } : draft

  const change = <K extends keyof StoryDraft>(key: K, value: StoryDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setStatus('Unsaved changes')
  }
  const saveLocally = (): boolean => {
    try {
      saveStoryDraft(base)
      return true
    } catch {
      return false
    }
  }
  const save = () => {
    if (saveLocally()) {
      setStatus(
        editing
          ? 'Changes saved on this browser only. Publish them when you are ready.'
          : 'Draft saved on this browser. Come back and add what happens next.',
      )
      setError('')
    } else
      setError('Your draft could not be saved. Copy your text before leaving this page, or try a smaller photo.')
  }
  const attach = async (file: File) => {
    if (busy.current) return
    busy.current = true
    setPreparing(true)
    try {
      change('photo', await preparePhoto(file))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The photo could not be prepared.')
    } finally {
      busy.current = false
      setPreparing(false)
    }
  }
  const publish = async () => {
    if (busy.current) return
    const problems = storyProblems(draft)
    if (problems.length) {
      setError(problems.join(' '))
      return
    }
    busy.current = true
    setPublishing(true)
    setError('')
    setStatus(editing ? 'Publishing your changes…' : 'Publishing your story…')
    // Save first, so the draft and photo survive a failed or interrupted request.
    const savedLocally = saveLocally()
    try {
      const published = await publishStory(base)
      try {
        deleteStoryDraft(base)
      } catch {
        // The story is live. A leftover local copy is harmless.
      }
      navigate(`/stories/${published.id}`, { state: { published: true } })
    } catch (e) {
      setStatus('')
      setError(
        `${storyErrorMessage(e)} ${
          savedLocally
            ? 'Your draft and photo are still saved on this browser.'
            : 'Copy your text before leaving: this browser could not save the draft.'
        }`,
      )
    } finally {
      busy.current = false
      setPublishing(false)
    }
  }
  const clear = () => {
    if (editing) {
      if (!window.confirm('Discard the changes saved on this browser and load the published version?')) return
      try {
        deleteStoryDraft(base)
      } catch {
        // Nothing saved locally.
      }
      onDiscard?.()
      return
    }
    if (!window.confirm('Delete the draft saved on this browser? This cannot be undone.')) return
    try {
      deleteStoryDraft(draft)
      setDraft(emptyDraft())
      setStatus('Draft deleted.')
      setError('')
    } catch {
      setError('The saved draft could not be deleted.')
    }
  }
  const publishLabel = !editing
    ? 'Publish story'
    : story.status === 'published'
      ? 'Publish changes'
      : 'Publish again with changes'

  return (
    <StoryLayout>
      <header className="stories-intro">
        <p className="kicker">Your group, your words</p>
        <h1>{editing ? 'Update your story' : 'What happened next?'}</h1>
        <p>
          {editing
            ? 'Add what happened since, fix a detail, or change the photo. Your changes go live when you publish them.'
            : 'Tell us about a first hangout, a campus discovery, or the friendship you are building. You can return to your saved draft as your story grows.'}
        </p>
      </header>
      <form
        className="card pad story-editor"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void publish()
        }}
      >
        <p className="story-note">
          {editing
            ? story.status === 'published'
              ? 'This story is public. Edits stay on this browser until you publish them.'
              : 'This story is unpublished. Only you can see it until you publish it again.'
            : 'Drafts stay on this browser until you publish. Published stories appear on the public stories page, and you can edit or unpublish them later from Your stories.'}
        </p>
        <fieldset className="step" disabled={preparing || publishing}>
          <label className="field">
            Story title
            <input
              className="input"
              value={draft.title}
              onChange={(e) => change('title', e.target.value)}
              maxLength={STORY_LIMITS.title}
              placeholder="The walk that became a weekly thing"
              required
            />
          </label>
          <label className="field">
            Public group name
            <input
              className="input"
              value={draft.group_name}
              onChange={(e) => change('group_name', e.target.value)}
              maxLength={STORY_LIMITS.group_name}
              placeholder="Choose a group nickname"
              required
            />
          </label>
          <label className="field">
            Your chapter
            <select
              className="input"
              value={draft.outcome}
              onChange={(e) => change('outcome', e.target.value as StoryOutcome)}
            >
              {(Object.entries(STORY_OUTCOMES) as [StoryOutcome, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Where did you go? <span className="hint">Optional</span>
            <input
              className="input"
              value={draft.place}
              onChange={(e) => change('place', e.target.value)}
              maxLength={STORY_LIMITS.place}
              placeholder="A campus spot or hangout place"
            />
          </label>
          <label className="field">
            Tell your story
            <textarea
              className="input"
              value={draft.body}
              onChange={(e) => change('body', e.target.value)}
              maxLength={STORY_LIMITS.body}
              rows={7}
              placeholder="How did you meet? What did you do together? What made you want to hang out again?"
              required
            />
          </label>
          <label className="field">
            What is next for your group? <span className="hint">Optional</span>
            <textarea
              className="input"
              value={draft.next_plan}
              onChange={(e) => change('next_plan', e.target.value)}
              maxLength={STORY_LIMITS.next_plan}
              rows={3}
              placeholder="A next adventure or a tradition you want to keep"
            />
          </label>
          <label className="photo-picker">
            Add a photo <span className="hint">Optional · With everyone’s permission</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void attach(file)
              }}
            />
          </label>
          {draft.photo && (
            <>
              <img className="room-photo" src={draft.photo} alt="Story photo preview" />
              <button className="link-btn" type="button" onClick={() => change('photo', null)}>
                Remove photo
              </button>
            </>
          )}
          <label className="story-consent">
            <input
              type="checkbox"
              checked={draft.consent_confirmed}
              onChange={(e) => change('consent_confirmed', e.target.checked)}
              required
            />
            <span>
              This is a real experience. Everyone named or pictured has agreed to share it publicly. I am
              comfortable with these words and this photo appearing on the stories page.
            </span>
          </label>
          <div className="community-actions">
            <button type="button" className="btn btn-white" onClick={save}>
              {editing ? 'Save changes on this browser' : 'Save draft'}
            </button>
            <button type="submit" className="btn btn-yellow">
              {publishing ? 'Publishing…' : publishLabel}
            </button>
          </div>
          <button className="link-btn" type="button" onClick={clear}>
            {editing ? 'Discard local changes' : 'Delete saved draft'}
          </button>
        </fieldset>
        {preparing && <p role="status">Preparing your photo…</p>}
        {status && <p role="status">{status}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </StoryLayout>
  )
}
