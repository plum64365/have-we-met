import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { RoomCommunity } from '../components/RoomCommunity.tsx'
import { Blob, IconClock, IconPin, Logo } from '../components/ui.tsx'
import { spotById } from '../lib/game.ts'
import type { HostScreenProps } from '../pages/Host.tsx'
import { strongestPairs } from '../shared/profile.ts'

export function Hangout({ state, room, act }: HostScreenProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const roomLink = `${window.location.origin}/room/${room.code}`
  const content = room.content
  if (!content) return null
  const spot = spotById(content.hangout.spot_id)
  const minutes = content.computed?.minutes_away ?? null
  const pairs = strongestPairs(state.players, 1)
  const player = (id: string) => state.players.find((p) => p.id === id)

  return (
    <div className="hang">
      <header className="host-head">
        <div>
          <p className="kicker">You’ve met. Make the next plan.</p>
          <h1 className="host-h1">
            {content.campus_task ? 'Your first campus adventure' : 'Your hangout idea'}
          </h1>
        </div>
        <Logo small />
      </header>

      <div className="hang-body">
        <section className={`card pad hang-main tilt-l ${content.campus_task ? 'hang-campus' : ''}`}>
          <p className="hang-activity">{content.hangout.activity}</p>
          {spot && (
            <p className="hang-spot">
              <IconPin size={30} />
              <span>
                <strong>{spot.name}</strong>
                <small>{spot.category}</small>
              </span>
              {minutes !== null && (
                <span className="chip chip-cyan">
                  <IconClock size={20} /> about {minutes} min away
                </span>
              )}
            </p>
          )}
          <ul className="chips" aria-label="Why it fits">
            {content.hangout.why.map((w) => (
              <li className="chip chip-yellow" key={w}>
                {w}
              </li>
            ))}
          </ul>
          {content.campus_task && (
            <div className="campus-ending">
              <ol>
                {content.campus_task.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p>Scan the room code to save your checklist, pick a time, and return with your story.</p>
            </div>
          )}
        </section>

        <section className="hang-pairs" aria-label="Strongest pairs">
          <h2 className="host-h2">Most in common</h2>
          {pairs.length === 0 && (
            <p className="host-sub">Opposites attract. You have plenty to talk about!</p>
          )}
          {pairs.map((pair, i) => {
            const a = player(pair.a)
            const b = player(pair.b)
            if (!a || !b) return null
            return (
              <div className={`card pad pair ${i === 0 ? 'tilt-r' : ''}`} key={`${pair.a}${pair.b}`}>
                <p className="pair-names">
                  <Blob color={a.avatar} size={38} />
                  <Blob color={b.avatar} size={38} />
                  <span>
                    {a.name} + {b.name}
                  </span>
                </p>
                <ul className="chips">
                  {pair.shared.slice(0, 4).map((s) => (
                    <li className="chip chip-light" key={s}>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          <div className="hang-connect card pad">
            <QRCodeSVG value={roomLink} size={110} marginSize={1} />
            <div>
              <p>Scan to plan, explore, and come back with a story.</p>
              <strong>Room {room.code}</strong>
            </div>
          </div>
          <button className="btn btn-cyan" onClick={() => dialog.current?.showModal()}>
            Plan & share
          </button>
          <button className="btn btn-big" onClick={act.again}>
            Play again
          </button>
        </section>
      </div>
      <dialog className="card community-dialog" ref={dialog} aria-label="Room planner and updates">
        <button className="btn btn-white btn-small dialog-close" onClick={() => dialog.current?.close()}>
          Close
        </button>
        <RoomCommunity room={room} players={state.players} editable />
      </dialog>
    </div>
  )
}
