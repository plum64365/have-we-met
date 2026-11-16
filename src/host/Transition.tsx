import { IconArrow, Starburst } from '../components/ui.tsx'
import type { HostScreenProps } from '../pages/Host.tsx'

export function Transition({ room, act }: HostScreenProps) {
  const next = room.phase_data.next === 'tierlist' ? 'Tier List' : 'Real Talk'
  return (
    <div className="transition">
      <Starburst fill="#FFD23F" size={640}>
        <span className="burst-line">PHONES</span>
        <span className="burst-line">AWAY!</span>
      </Starburst>
      <div className="transition-foot">
        <p className="transition-next">Next up <strong>{next}</strong></p>
        <button className="btn btn-big btn-white" disabled={act.busy} onClick={act.next}>
          Start {next} <IconArrow size={30} />
        </button>
      </div>
    </div>
  )
}
