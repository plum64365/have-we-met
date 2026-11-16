import { Link } from 'react-router-dom'
import { CampusTask } from './CampusTask.tsx'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useCommunity } from '../hooks/useCommunity.ts'
import { savePlan, savePost, saveRsvp } from '../lib/community.ts'
import { spotById } from '../lib/game.ts'
import { rememberRoom } from '../lib/returnVisits.ts'
import { uuid } from '../lib/identity.ts'
import { preparePhoto } from '../lib/photos.ts'
import { calendarForPlan, inviteUrl } from '../shared/community.ts'
import type { PlayerRow, RoomPlan, RoomRow, RsvpStatus } from '../shared/types.ts'

const RSVP_LABELS: Record<RsvpStatus, string> = { going: "I'm in", maybe: 'Maybe', cant: "Can't make it" }

export function RoomCommunity({
  room,
  players,
  player,
  editable = false,
}: {
  room: RoomRow
  players: PlayerRow[]
  player?: PlayerRow
  editable?: boolean
}) {
  useEffect(() => {
    rememberRoom({ code: room.code, title: room.title })
  }, [room.code, room.title])
  const data = useCommunity(room.id)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [voting, setVoting] = useState(false)
  const link = `${window.location.origin}/room/${room.code}`
  const plan = data.plan
  const currentRsvps = data.rsvps.filter((rsvp) => rsvp.plan_rev === plan?.rev)
  const myRsvp = currentRsvps.find((rsvp) => rsvp.player_id === player?.id)?.status
  const suggestion = room.content?.hangout
  const activity = plan?.activity || suggestion?.activity || 'Make your next plan together'
  const location = plan?.location || spotById(suggestion?.spot_id)?.name || ''

  const respond = async (status: RsvpStatus) => {
    if (!player || !plan || voting) return
    setVoting(true)
    try {
      await saveRsvp(room.id, player.id, status, plan.rev)
      await data.refresh()
      setMessage('Response saved.')
    } catch (error) {
      await data.refresh()
      setMessage(
        error instanceof Error && error.message.includes('PLAN_CHANGED')
          ? 'The plan changed. Check the new details and respond again.'
          : 'Your response did not save. Try again.',
      )
    } finally {
      setVoting(false)
    }
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Room link copied.')
    } catch {
      setMessage('Select and copy the room link below.')
    }
  }
  const calendar = () => {
    if (!plan) return
    const content = calendarForPlan(plan, room, link)
    if (!content) return
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `have-we-met-${room.code}.ics`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="community" aria-label="Room plans and updates">
      <header className="community-heading">
        <p className="kicker">Room {room.code}</p>
        <h1>{room.title || 'Keep in touch'}</h1>
        {room.description && <p>{room.description}</p>}
      </header>
      {data.loading && (
        <p className="community-status" role="status">
          Loading your room…
        </p>
      )}
      {data.error && (
        <div className="card pad" role="alert">
          <p>{data.error}</p>
          <button className="link-btn" onClick={() => void data.refresh()}>
            Try again
          </button>
        </div>
      )}

      {room.content?.campus_task && (
        <CampusTask
          key={`${room.round}:${room.content.campus_task.key}`}
          room={room}
          task={room.content.campus_task}
          spot={spotById(room.content.hangout.spot_id)}
        />
      )}

      <section className="card pad community-card" aria-label="Hangout planner">
        <div className="community-title-row">
          <h2>Your next hangout</h2>
          {editable && !editing && (
            <button
              className="btn btn-white btn-small"
              onClick={() => setEditing(true)}
              disabled={data.loading || !!data.error}
            >
              {plan ? 'Edit plan' : 'Make a plan'}
            </button>
          )}
        </div>
        {editing ? (
          <PlanEditor
            room={room}
            plan={plan}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              void data.refresh()
            }}
          />
        ) : (
          <>
            <p className="community-plan-activity">{activity}</p>
            {location && <p>{location}</p>}
            <p>
              {plan?.starts_at
                ? new Date(plan.starts_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Time to be decided together'}
              {plan?.starts_at && ` · ${plan.duration_minutes} minutes`}
            </p>
            {plan?.starts_at && (
              <button className="btn btn-cyan" onClick={calendar}>
                Add to calendar
              </button>
            )}
            {plan &&
              player &&
              data.rsvps.some((rsvp) => rsvp.player_id === player.id && rsvp.plan_rev !== plan.rev) && (
                <p className="hint">The plan changed. Confirm your response for the new details.</p>
              )}
            {plan && player && (
              <div className="community-actions" role="group" aria-label="Your RSVP">
                {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map((status) => (
                  <button
                    key={status}
                    className={`btn btn-small ${myRsvp === status ? '' : 'btn-white'}`}
                    aria-pressed={myRsvp === status}
                    disabled={voting}
                    onClick={() => void respond(status)}
                  >
                    {RSVP_LABELS[status]}
                  </button>
                ))}
              </div>
            )}
            {currentRsvps.length > 0 && (
              <p className="hint">
                {currentRsvps.filter((r) => r.status === 'going').length} going ·{' '}
                {currentRsvps.filter((r) => r.status === 'maybe').length} maybe
              </p>
            )}
            <ul className="community-rsvps">
              {currentRsvps.map((rsvp) => (
                <li key={rsvp.player_id}>
                  {players.find((p) => p.id === rsvp.player_id)?.name || 'A player'} ·{' '}
                  {RSVP_LABELS[rsvp.status]}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card pad community-card" aria-label="Stay connected">
        <h2>Keep the group together</h2>
        <p>Save this room link to return to your plans, photos, and conversation.</p>
        <label className="field">
          Your room link
          <input className="input" value={link} readOnly onFocus={(e) => e.target.select()} />
        </label>
        <div className="community-actions">
          <button className="btn" onClick={() => void copyLink()}>
            Copy room link
          </button>
          {plan?.chat_url && (
            <a className="btn btn-cyan" href={plan.chat_url} target="_blank" rel="noopener noreferrer">
              Join group chat
            </a>
          )}
        </div>
        {message && <p role="status">{message}</p>}
      </section>

      <section className="card pad community-card" aria-label="Your next chapter">
        <p className="kicker">Make this the beginning</p>
        <h2>What happened after you met?</h2>
        <p>
          Come back after your hangout. Keep planning here, record your group’s story, and explore stories
          shared by other groups.
        </p>
        <div className="community-actions">
          <Link className="btn btn-cyan" to="/stories/write">
            Write your story
          </Link>
          <Link className="btn btn-white" to="/stories">
            Read community stories
          </Link>
        </div>
      </section>

      <section className="community-feed" aria-label="Room updates">
        <h2>Photos & conversation</h2>
        <p className="community-status">Shared with people who open this room link.</p>
        {player ? (
          <PostComposer
            roomId={room.id}
            playerId={player.id}
            onSaved={() => void data.refresh()}
            disabled={data.loading || !!data.error}
          />
        ) : (
          <p className="card pad">To post or RSVP, return using the browser you joined with.</p>
        )}
        {!data.loading && !data.error && data.posts.length === 0 && (
          <p className="card pad">Start with a group photo, a favorite moment, or an idea for next time.</p>
        )}
        {data.posts.map((post) => (
          <article className="card pad community-card room-post" key={post.id}>
            <header className="community-title-row">
              <strong>{players.find((p) => p.id === post.player_id)?.name || 'A player'}</strong>
              <time dateTime={post.created_at}>
                {new Date(post.created_at).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </time>
            </header>
            {post.photo && (
              <img
                className="room-photo"
                src={post.photo}
                alt={`Photo shared by ${players.find((p) => p.id === post.player_id)?.name || 'a player'}`}
                loading="lazy"
              />
            )}
            {post.body && <p className="post-body">{post.body}</p>}
          </article>
        ))}
        {data.hasMore && (
          <button
            className="btn btn-white"
            disabled={data.loadingOlder}
            onClick={() => void data.loadOlder()}
          >
            {data.loadingOlder ? 'Loading…' : 'Older updates'}
          </button>
        )}
      </section>
    </section>
  )
}

function PlanEditor({
  room,
  plan,
  onSaved,
  onCancel,
}: {
  room: RoomRow
  plan: RoomPlan | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [activity, setActivity] = useState(plan?.activity ?? room.content?.hangout.activity ?? '')
  const [location, setLocation] = useState(
    plan?.location ?? spotById(room.content?.hangout.spot_id)?.name ?? '',
  )
  const [time, setTime] = useState(() => {
    if (!plan?.starts_at) return ''
    const date = new Date(plan.starts_at)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  })
  const [duration, setDuration] = useState(plan?.duration_minutes ?? 60)
  const [chat, setChat] = useState(plan?.chat_url ?? '')
  const [revision] = useState(plan?.rev)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const starts = time ? new Date(time) : null
      if (starts && !Number.isFinite(starts.getTime())) throw new Error('Choose a valid date and time.')
      await savePlan(
        {
          room_id: room.id,
          activity: activity.trim(),
          location: location.trim(),
          starts_at: starts?.toISOString() ?? null,
          duration_minutes: duration,
          chat_url: inviteUrl(chat),
        },
        revision,
      )
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The plan did not save. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="step" onSubmit={(e) => void submit(e)}>
      <label className="field">
        Activity
        <input
          className="input"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          maxLength={140}
          required
        />
      </label>
      <label className="field">
        Meet at
        <input
          className="input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={120}
        />
      </label>
      <label className="field">
        Date and time
        <input
          className="input"
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      <label className="field">
        Duration
        <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          {[30, 60, 90, 120].map((minutes) => (
            <option value={minutes} key={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Group-chat invite link
        <input
          className="input"
          type="url"
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          maxLength={2048}
          placeholder="https://…"
        />
      </label>
      <p className="hint">Create a group in your chat app, then paste its invite link here.</p>
      {error && <p role="alert">{error}</p>}
      <div className="community-actions">
        <button className="btn" disabled={busy || !activity.trim()}>
          {busy ? 'Saving…' : 'Save plan'}
        </button>
        <button type="button" className="btn btn-white" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function PostComposer({
  roomId,
  playerId,
  onSaved,
  disabled,
}: {
  roomId: string
  playerId: string
  onSaved: () => void
  disabled: boolean
}) {
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [postId, setPostId] = useState(uuid)
  const [busy, setBusy] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const attach = async (file: File) => {
    setPreparing(true)
    setError('')
    try {
      setPhoto(await preparePhoto(file))
      setPostId(uuid())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The photo could not be prepared.')
    } finally {
      setPreparing(false)
    }
  }
  const post = async (event: FormEvent) => {
    event.preventDefault()
    if (pending.current || preparing || (!body.trim() && !photo)) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await savePost({ id: postId, room_id: roomId, player_id: playerId, body: body.trim(), photo })
      setBody('')
      setPhoto(null)
      setPostId(uuid())
      onSaved()
    } catch {
      setError('Your update did not save. Try again.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <form className="card pad step" onSubmit={(e) => void post(e)}>
      <fieldset className="step" disabled={disabled || busy || preparing}>
        <label className="field">
          Leave an update
          <textarea
            className="input"
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setPostId(uuid())
            }}
            maxLength={600}
            rows={3}
            placeholder="A favorite moment, a plan, or something to share…"
          />
        </label>
        <label className="photo-picker">
          Take or add a photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void attach(file)
            }}
          />
        </label>
        {photo && (
          <>
            <img className="room-photo" src={photo} alt="Your photo preview" />
            <button
              className="link-btn"
              type="button"
              onClick={() => {
                setPhoto(null)
                setPostId(uuid())
              }}
            >
              Remove photo
            </button>
          </>
        )}
        <button className="btn" disabled={!body.trim() && !photo}>
          {busy ? 'Posting…' : 'Post update'}
        </button>
      </fieldset>
      {preparing && <p role="status">Preparing your photo…</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
