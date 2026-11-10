import { Blob, IconArrow, Starburst } from '../components/ui.tsx'
import type { HostScreenProps } from '../pages/Host.tsx'

const GAME_NAME = { tierlist: 'Tier List', wit_answer: 'Wit Dispute', realtalk: 'Real Talk' }

export function Transition({ state, room, act }: HostScreenProps) {
  const out = room.phase_data.kind === 'phones_out'
  const next = room.phase_data.next ?? 'tierlist'
  const back = state.players.filter((p) => state.onlineIds.includes(p.id)).length

  return (
    <div className="transition">
      <Starburst fill={out ? '#3EC6FF' : '#FFD23F'} size={640}>
        <span className="burst-line">PHONES</span>
        <span className="burst-line">{out ? 'OUT!' : 'AWAY!'}</span>
      </Starburst>

      <div className="transition-foot">
        <div>
          <p className="transition-next">
            Next up: <strong>{GAME_NAME[next]}</strong>
          </p>
          {out && (
            <div className="transition-ready" role="status">
              {state.players.map((p) => (
                <Blob key={p.id} color={p.avatar} size={44} dim={!state.onlineIds.includes(p.id)} />
              ))}
              <span>
                {back}/{state.players.length} phones back
              </span>
            </div>
          )}
        </div>
        <button className="btn btn-big btn-white" disabled={act.busy} onClick={act.next}>
          Start {GAME_NAME[next]} <IconArrow size={30} />
        </button>
      </div>
    </div>
  )
}
