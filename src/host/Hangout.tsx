import { Blob, IconClock, IconPin, Logo } from '../components/ui.tsx'
import { spotById } from '../lib/game.ts'
import type { HostScreenProps } from '../pages/Host.tsx'
import { strongestPairs } from '../shared/profile.ts'

export function Hangout({ state, room, act }: HostScreenProps) {
  const content = room.content
  if (!content) return null
  const spot = spotById(content.hangout.spot_id)
  const minutes = content.computed?.minutes_away ?? null
  const pairs = strongestPairs(state.players, 2)
  const player = (id: string) => state.players.find((p) => p.id === id)

  return (
    <div className="hang">
      <header className="host-head">
        <div>
          <p className="kicker">That's the game. Now make it real.</p>
          <h1 className="host-h1">Your hangout idea</h1>
        </div>
        <Logo small />
      </header>

      <div className="hang-body">
        <section className="card pad hang-main tilt-l">
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
        </section>

        <section className="hang-pairs" aria-label="Strongest pairs">
          <h2 className="host-h2">Most in common</h2>
          {pairs.length === 0 && <p className="host-sub">Opposites attract. You have plenty to talk about!</p>}
          {pairs.map((pair, i) => {
            const a = player(pair.a)
            const b = player(pair.b)
            if (!a || !b) return null
            return (
              <div className={`card pad pair ${i === 0 ? 'tilt-r' : ''}`} key={`${pair.a}${pair.b}`}>
                <p className="pair-names">
                  <Blob color={a.avatar} size={52} />
                  <Blob color={b.avatar} size={52} />
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
          <button className="btn btn-big" onClick={act.again}>
            Play again
          </button>
        </section>
      </div>
    </div>
  )
}
