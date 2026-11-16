import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../components/ui.tsx'
import { useTheme } from '../hooks/useTheme.ts'
import { preparePhoto } from '../lib/photos.ts'
import {
  deleteStoryDraft,
  emptyDraft,
  PUBLISHED_STORIES,
  readStoryDraft,
  savedStoryIds,
  saveStoryDraft,
  setStorySaved,
  STORY_OUTCOMES,
} from '../lib/stories.ts'
import type { Story, StoryDraft, StoryOutcome } from '../lib/stories.ts'

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
          <Link className="btn btn-yellow btn-small" to="/">
            Your room
          </Link>
        </div>
      </nav>
      {children}
    </main>
  )
}

function SaveStory({ story, onChange }: { story: Story; onChange?: () => void }) {
  const [saved, setSaved] = useState(() => savedStoryIds().includes(story.id))
  const [error, setError] = useState('')
  useEffect(() => {
    const sync = () => setSaved(savedStoryIds().includes(story.id))
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [story.id])
  const toggle = () => {
    try {
      setStorySaved(story.id, !saved)
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

export function Stories() {
  const [outcome, setOutcome] = useState<StoryOutcome | ''>('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [savedIds, setSavedIds] = useState(savedStoryIds)
  const [limit, setLimit] = useState(12)
  useEffect(() => {
    const sync = () => setSavedIds(savedStoryIds())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const filtered = PUBLISHED_STORIES.filter(
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
      <section className="stories-section" aria-label="Community stories">
        <div className="stories-section-title">
          <h2>After we met</h2>
          <p>Real experiences, shared with permission.</p>
        </div>
        <div className="story-filters" role="group" aria-label="Filter stories">
          <button
            className={`chip ${!outcome ? 'chip-yellow' : 'chip-light'}`}
            aria-pressed={!outcome}
            onClick={() => {
              setOutcome('')
              setLimit(12)
            }}
          >
            All stories
          </button>
          {(Object.entries(STORY_OUTCOMES) as [StoryOutcome, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`chip ${outcome === key ? 'chip-yellow' : 'chip-light'}`}
              aria-pressed={outcome === key}
              onClick={() => {
                setOutcome(key)
                setLimit(12)
              }}
            >
              {label}
            </button>
          ))}
          <button
            className={`chip ${savedOnly ? 'chip-cyan' : 'chip-light'}`}
            aria-pressed={savedOnly}
            onClick={() => {
              setSavedOnly(!savedOnly)
              setLimit(12)
            }}
          >
            ★ Saved stories
          </button>
        </div>
        {filtered.length ? (
          <div className="story-grid">
            {filtered.slice(0, limit).map((story) => (
              <article className="card story-card" key={story.id}>
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
                    <SaveStory story={story} onChange={() => setSavedIds(savedStoryIds())} />
                  </div>
                </div>
              </article>
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
        {filtered.length > limit && (
          <button className="btn btn-white" onClick={() => setLimit((value) => value + 12)}>
            More stories
          </button>
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
  const { id } = useParams()
  const story = PUBLISHED_STORIES.find((entry) => entry.id === id)
  return (
    <StoryLayout>
      {story ? (
        <article className="card pad story-detail">
          <Link className="link-btn" to="/stories">
            ← All stories
          </Link>
          <p className="chip chip-yellow">{STORY_OUTCOMES[story.outcome]}</p>
          <h1>{story.title}</h1>
          <p>
            By {story.group_name}
            {story.place && ` · ${story.place}`}
          </p>
          <p className="hint">
            Updated {new Date(story.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
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
          <SaveStory story={story} />
          <Link className="btn btn-cyan" to="/stories/write">
            What is your group’s story?
          </Link>
        </article>
      ) : (
        <section className="card pad step">
          <h1>Story unavailable</h1>
          <p>This story may have moved or been removed.</p>
          <Link className="btn" to="/stories">
            Explore stories
          </Link>
        </section>
      )}
    </StoryLayout>
  )
}

export function StoryEditor() {
  const [draft, setDraft] = useState<StoryDraft>(() => readStoryDraft() ?? emptyDraft())
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const busy = useRef(false)
  const change = <K extends keyof StoryDraft>(key: K, value: StoryDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setStatus('Unsaved changes')
  }
  const save = () => {
    try {
      saveStoryDraft(draft)
      setStatus('Draft saved on this browser. Come back and add what happens next.')
      setError('')
    } catch {
      setError(
        'Your draft could not be saved. Copy your text before leaving this page, or try a smaller photo.',
      )
    }
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
  const clear = () => {
    if (
      !window.confirm('Delete the draft saved on this browser? Download a copy first if you want to keep it.')
    )
      return
    try {
      deleteStoryDraft()
      setDraft(emptyDraft())
      setStatus('Draft deleted.')
      setError('')
    } catch {
      setError('The saved draft could not be deleted.')
    }
  }
  return (
    <StoryLayout>
      <header className="stories-intro">
        <p className="kicker">Your group, your words</p>
        <h1>What happened next?</h1>
        <p>
          Tell us about a first hangout, a campus discovery, or the friendship you are building. You can
          return to your saved draft as your story grows.
        </p>
      </header>
      <form
        className="card pad story-editor"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <p className="story-note">
          Your draft stays on this browser. Public sharing is coming soon. Save it now, then come back to add
          what happens next.
        </p>
        <fieldset className="step" disabled={preparing}>
          <label className="field">
            Story title
            <input
              className="input"
              value={draft.title}
              onChange={(e) => change('title', e.target.value)}
              maxLength={100}
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
              maxLength={60}
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
              maxLength={120}
              placeholder="A campus spot or hangout place"
            />
          </label>
          <label className="field">
            Tell your story
            <textarea
              className="input"
              value={draft.body}
              onChange={(e) => change('body', e.target.value)}
              maxLength={1800}
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
              maxLength={400}
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
              Save draft
            </button>
            <button type="button" className="btn btn-yellow" disabled>
              Publish story · Coming soon
            </button>
          </div>
          <button className="link-btn" type="button" onClick={clear}>
            Delete saved draft
          </button>
        </fieldset>
        {preparing && <p role="status">Preparing your photo…</p>}
        {status && <p role="status">{status}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </StoryLayout>
  )
}
