import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Blob } from '../components/ui.tsx'
import { fetchRoomByCode, JoinError, joinRoom } from '../lib/api.ts'
import { useDraft } from '../lib/drafts.ts'
import { getPlayerId } from '../lib/identity.ts'
import { cleanRoomCode } from '../lib/roomCode.ts'
import { AVATARS, MAX_PLAYERS } from '../shared/quiz.ts'
import type { AvatarColor, PlayerRow, RoomRow } from '../shared/types.ts'

interface Props {
  initialCode: string
  /** Known when the code came from the QR link. */
  room?: RoomRow
  players?: PlayerRow[]
  notice?: string
  onJoined?: () => void
}

const AVATAR_NAMES: Record<AvatarColor, string> = {
  yellow: 'Yellow',
  pink: 'Pink',
  cyan: 'Cyan',
  green: 'Green',
  orange: 'Orange',
  lilac: 'Lilac',
}

export function JoinForm({ initialCode, room, players = [], notice, onJoined }: Props) {
  const navigate = useNavigate()
  const [code, setCode] = useDraft(`hwm.join.code.v1.${initialCode || 'manual'}`, initialCode)
  const [profile, setProfile, draftSaved] = useDraft<{ name: string; avatar: AvatarColor | null }>(
    `hwm.join.profile.v1.${code}`,
    { name: '', avatar: null },
  )
  const { name, avatar } = profile
  const setName = (name: string) => setProfile({ ...profile, name })
  const setAvatar = (avatar: AvatarColor) => setProfile({ ...profile, avatar })
  const [error, setError] = useState<string | null>(notice ?? null)
  const [busy, setBusy] = useState(false)

  const full = Boolean(room) && players.length >= MAX_PLAYERS
  const ready = code.length === 4 && name.trim().length > 0 && avatar !== null && !full

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready || !avatar) return
    setBusy(true)
    setError(null)
    try {
      const target = room && room.code === code ? room : await fetchRoomByCode(code)
      if (!target) {
        setError(`No room with the code ${code}. Check the big screen and try again.`)
        return
      }
      await joinRoom(target.id, getPlayerId(code), name, avatar)
      if (room && room.code === code) onJoined?.()
      else navigate(`/play/${code}`, { replace: true })
    } catch (err) {
      setError(err instanceof JoinError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card pad join" onSubmit={submit} noValidate>
      <h1>{room?.title || 'Join the game'}</h1>
      {room?.description && <p className="hint room-description">{room.description}</p>}

      {full && (
        <p className="notice" role="alert">
          This room already has {MAX_PLAYERS} players. Cheer them on from the big screen!
        </p>
      )}

      <label className="field">
        <span>Room code</span>
        <input
          className="input input-code"
          value={code}
          onChange={(e) => setCode(cleanRoomCode(e.target.value))}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={4}
          placeholder="ABCD"
          required
        />
      </label>

      <label className="field">
        <span>Your name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          autoComplete="given-name"
          maxLength={16}
          placeholder="First name"
          required
        />
      </label>

      <fieldset className="field">
        <legend>Pick your blob</legend>
        <div className="avatar-grid">
          {AVATARS.map((color) => {
            return (
              <label key={color} className={`avatar-pick ${avatar === color ? 'on' : ''}`}>
                <input
                  type="radio"
                  name="avatar"
                  value={color}
                  checked={avatar === color}
                  onChange={() => setAvatar(color)}
                />
                <Blob color={color} size={64} />
                <span className="sr-only">{AVATAR_NAMES[color]}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {!draftSaved && (
        <p className="hint">This browser could not keep your name and avatar for your next visit.</p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      <button className="btn btn-big" type="submit" disabled={!ready || busy}>
        {busy ? 'Joining…' : "I'm in"}
      </button>
    </form>
  )
}
