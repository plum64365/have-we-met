import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { Blob, IconArrow, IconCheck, IconPencil, Logo } from '../components/ui.tsx'
import { patchRoom } from '../lib/api.ts'
import type { HostScreenProps } from '../pages/Host.tsx'
import { MAX_PLAYERS, MIN_PLAYERS } from '../shared/quiz.ts'

const AUTO_START_SECONDS = 10

export function Lobby({ state, room, act }: HostScreenProps) {
  const { players, onlineIds } = state
  const joinUrl = `${window.location.origin}/play/${room.code}`
  const shownUrl = joinUrl.replace(/^https?:\/\//, '')
  const localOnly = ['localhost', '127.0.0.1'].includes(window.location.hostname)

  const doneCount = players.filter((p) => p.quiz_done).length
  const enough = players.length >= MIN_PLAYERS
  const allDone = enough && doneCount === players.length

  // Auto-start: a cancelable countdown once everyone has finished. It restarts whenever
  // someone joins or finishes, and "Cancel" holds it until the lobby changes again.
  const signature = `${players.length}:${doneCount}:${room.round}`
  const [cancelled, setCancelled] = useState<string | null>(null)
  const armed = allDone && cancelled !== signature
  const [left, setLeft] = useState(AUTO_START_SECONDS)
  useEffect(() => {
    if (!armed) return
    setLeft(AUTO_START_SECONDS)
    const tick = setInterval(() => setLeft((n) => n - 1), 1000)
    return () => clearInterval(tick)
  }, [armed, signature])
  const { start } = act
  useEffect(() => {
    if (armed && left <= 0) start()
    // `start` is recreated every render; the countdown reaching zero is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, left])

  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => players[i] ?? null)

  return (
    <div className="lobby">
      <section className="lobby-join">
        <Logo />
        <div className="card qr-card tilt-l">
          <QRCodeSVG value={joinUrl} size={250} marginSize={1} fgColor="#1A1033" bgColor="#FFFFFF" level="M" />
        </div>
        <p className="lobby-url">
          Scan, or go to <strong>{shownUrl.replace(`/${room.code}`, '')}</strong>
        </p>
        {localOnly && (
          <p className="lobby-warn">Phones cannot open "localhost". Open this screen from the Network address that npm run dev prints.</p>
        )}
        <p className="lobby-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code}
        </p>
      </section>

      <section className="lobby-players">
        <h2 className="host-h2">
          Players <span className="count">{players.length}/{MAX_PLAYERS}</span>
        </h2>
        <ul className="player-grid">
          {slots.map((p, i) =>
            p ? (
              <li key={p.id} className={`card player-card pop ${p.quiz_done ? 'is-done' : ''}`}>
                <Blob color={p.avatar} size={72} dim={!onlineIds.includes(p.id)} />
                <div>
                  <p className="player-name">{p.name}</p>
                  <p className={`player-status ${p.quiz_done ? 'done' : ''}`}>
                    {p.quiz_done ? <IconCheck size={20} /> : <IconPencil size={20} />}
                    {p.quiz_done ? 'Quiz done' : 'Taking quiz…'}
                  </p>
                </div>
              </li>
            ) : (
              <li key={`empty-${i}`} className="player-card player-empty">
                Waiting…
              </li>
            ),
          )}
        </ul>

        <div className="lobby-actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={room.quick_play}
              onChange={(e) => void patchRoom(room, { quick_play: e.target.checked }).then(state.refresh)}
            />
            <span className="toggle-track" aria-hidden="true" />
            <span>
              <strong>Quick play</strong>
              <small>{room.quick_play ? '2 Wit Dispute prompts' : 'One prompt per player'}</small>
            </span>
          </label>

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

          <button className="btn btn-big" disabled={!enough || act.busy} onClick={act.start}>
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
      <p className="host-sub">Mixing your answers into three games made for this group</p>
    </div>
  )
}
