import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { Blob, IconArrow, IconCheck, IconPencil, Logo, useDelayed } from '../components/ui.tsx'
import { removePlayer } from '../lib/api.ts'
import { RoomDetails } from '../components/RoomDetails.tsx'
import type { HostScreenProps } from '../pages/Host.tsx'
import { MAX_PLAYERS, MIN_PLAYERS, canStartGame, quizComplete } from '../shared/quiz.ts'

const AUTO_START_SECONDS = 10

export function Lobby({ state, room, act }: HostScreenProps) {
  const { players, onlineIds } = state
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState('')
  const [customizing, setCustomizing] = useState(false)
  const joinUrl = `${window.location.origin}/play/${room.code}`
  const shownUrl = joinUrl.replace(/^https?:\/\//, '')
  const localOnly = ['localhost', '127.0.0.1'].includes(window.location.hostname)

  const doneCount = players.filter((p) => quizComplete(p, room.round)).length
  const enough = players.length >= MIN_PLAYERS
  const allDone = canStartGame(players, room.round)

  // Auto-start: a cancelable countdown once everyone has finished. It restarts whenever
  // someone joins or finishes, and "Cancel" holds it until the lobby changes again.
  const signature = `${players.length}:${doneCount}:${room.round}`
  const [cancelled, setCancelled] = useState<string | null>(null)
  const armed = allDone && !customizing && removing === null && cancelled !== signature
  const [left, setLeft] = useState(AUTO_START_SECONDS)
  useEffect(() => {
    if (!armed) return
    setLeft(AUTO_START_SECONDS)
    const tick = setInterval(() => setLeft((n) => n - 1), 1000)
    return () => clearInterval(tick)
  }, [armed, signature])
  useDelayed(armed, AUTO_START_SECONDS * 1000, act.start)

  const kick = async (id: string, name: string) => {
    setCancelled(signature)
    if (
      !window.confirm(
        `Remove ${name} from this lobby? They will need to join again. Any room posts and RSVPs linked to this player will also be removed.`,
      )
    )
      return
    setRemoving(id)
    setRemoveError('')
    try {
      await removePlayer(id, room.id)
      state.refresh()
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'Could not remove the player. Try again.')
    } finally {
      setRemoving(null)
    }
  }

  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => players[i] ?? null)

  return (
    <div className="lobby">
      <section className="lobby-join">
        <Logo small />
        <h1 className="room-welcome" title={room.title}>
          {room.title || 'Have We Met?'}
        </h1>
        {room.description && <p className="room-description lobby-description">{room.description}</p>}
        <RoomDetails room={room} onSaved={state.refresh} onEditingChange={setCustomizing} />
        <div className="card qr-card tilt-l">
          <QRCodeSVG
            value={joinUrl}
            size={165}
            marginSize={1}
            fgColor="#1A1033"
            bgColor="#FFFFFF"
            level="M"
          />
        </div>
        <p className="lobby-url">
          Scan, or go to <strong>{shownUrl.replace(`/${room.code}`, '')}</strong>
        </p>
        {localOnly && (
          <p className="lobby-warn">
            Phones cannot open "localhost". Open this screen from the Network address that npm run dev prints.
          </p>
        )}
        <p className="lobby-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code}
        </p>
      </section>

      <section className="lobby-players">
        <h2 className="host-h2">
          Players{' '}
          <span className="count">
            {players.length}/{MAX_PLAYERS}
          </span>
        </h2>
        <ul className="player-grid">
          {slots.map((p, i) =>
            p ? (
              <li
                key={p.id}
                className={`card player-card pop ${quizComplete(p, room.round) ? 'is-done' : ''}`}
              >
                <Blob color={p.avatar} size={42} dim={!onlineIds.includes(p.id)} />
                <div>
                  <p className="player-name">{p.name}</p>
                  <p className={`player-status ${quizComplete(p, room.round) ? 'done' : ''}`}>
                    {quizComplete(p, room.round) ? <IconCheck size={20} /> : <IconPencil size={20} />}
                    {quizComplete(p, room.round) ? 'Quiz done' : 'Taking quiz…'}
                  </p>
                </div>
                <button
                  className="player-kick"
                  disabled={removing !== null || act.busy}
                  aria-label={`Remove ${p.name} from lobby`}
                  onClick={() => void kick(p.id, p.name)}
                >
                  {removing === p.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ) : (
              <li key={`empty-${i}`} className="player-card player-empty">
                Waiting…
              </li>
            ),
          )}
        </ul>

        {removeError && (
          <p className="lobby-save-error" role="alert">
            {removeError}
          </p>
        )}
        <div className="lobby-actions">
          {armed ? (
            <div className="autostart" role="status">
              <span>
                Everyone's done! Starting in <strong>{Math.max(0, left)}</strong>
              </span>
              <button className="btn btn-white btn-small" onClick={() => setCancelled(signature)}>
                Cancel
              </button>
            </div>
          ) : (
            <p className="lobby-hint">
              {!enough
                ? `Need at least ${MIN_PLAYERS} players to start`
                : allDone
                  ? 'Ready when you are'
                  : `${doneCount} of ${players.length} finished the quiz`}
            </p>
          )}

          <button
            className="btn btn-big"
            disabled={!allDone || customizing || removing !== null || act.busy}
            onClick={act.start}
          >
            Everyone's in <IconArrow size={30} />
          </button>
        </div>
        <button className="link-btn lobby-new" onClick={act.newRoom}>
          Start a new room with a new code
        </button>
      </section>
    </div>
  )
}

export function Building() {
  return (
    <div className="host-center">
      <div className="building-blobs" aria-hidden="true">
        <Blob color="yellow" size={90} />
        <Blob color="pink" size={90} />
        <Blob color="cyan" size={90} />
      </div>
      <h1 className="host-h1">Building your game…</h1>
      <p className="host-sub">Mixing your answers into Tier List, your group’s game, and Talk It Out</p>
    </div>
  )
}
