import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Blob } from '../components/ui.tsx'
import { fetchRoomByCode, JoinError, joinRoom } from '../lib/api.ts'
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
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')
  const taken = players.map((p) => p.avatar)
  const [avatar, setAvatar] = useState<AvatarColor | null>(null)
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
      <h1>Join the game</h1>

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
            const used = taken.includes(color)
            return (
              <label key={color} className={`avatar-pick ${avatar === color ? 'on' : ''} ${used ? 'used' : ''}`}>
                <input
                  type="radio"
                  name="avatar"
                  value={color}
                  checked={avatar === color}
                  disabled={used}
                  onChange={() => setAvatar(color)}
                />
                <Blob color={color} size={64} dim={used} />
                <span className="sr-only">
                  {AVATAR_NAMES[color]}
                  {used ? ' (taken)' : ''}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

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
