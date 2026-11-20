import { IconArrow, IconSwap } from '../components/ui.tsx'
import { patchRoom } from '../lib/api.ts'
import { randomFrom, spareQuestions } from '../lib/game.ts'
import type { HostScreenProps } from '../pages/Host.tsx'
import { realTalkSequence } from '../shared/machine.ts'
import { REALTALK_LEVELS } from '../shared/types.ts'

const LEVEL_NAMES = ['Light', 'Real', 'Deep']

export function RealTalk({ state, room, act }: HostScreenProps) {
  const d = room.phase_data
  const step = d.step ?? 0
  const sequence = realTalkSequence(room.content)
  const level = REALTALK_LEVELS.indexOf(sequence[step]?.level ?? 'light')
  const firstNames = (d.firstPlayerIds?.length ? d.firstPlayerIds : [d.firstPlayerId])
    .map((id) => state.players.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(' + ')
  const isLast = step + 1 >= sequence.length

  const swap = () => {
    const spare = randomFrom(
      spareQuestions(REALTALK_LEVELS[level], room.content, d.question ? [d.question] : [], room),
    )
    if (spare)
      void patchRoom(room, { phase_data: { ...d, question: spare, swaps: (d.swaps ?? 0) + 1 } }).then(
        state.refresh,
      )
  }

  return (
    <div className="real">
      <header className="host-head">
        <div>
          <p className="kicker">
            Talk It Out · phones away · question {step + 1} of {sequence.length}
          </p>
          <ol className="depth" aria-label={`Depth: level ${level + 1} of 3, ${LEVEL_NAMES[level]}`}>
            {LEVEL_NAMES.map((name, i) => (
              <li
                key={name}
                className={i === level ? 'on' : i < level ? 'past' : ''}
                aria-current={i === level ? 'step' : undefined}
              >
                {i + 1} · {name}
              </li>
            ))}
          </ol>
        </div>
        <button className="btn btn-white" disabled={act.busy} onClick={act.skipGame}>
          Finish talking <IconArrow />
        </button>
      </header>

      <div className="card real-card tilt-l" key={d.question}>
        <p className="pop">{d.question}</p>
      </div>

      <footer className="real-foot">
        <p className="real-first">
          <strong>{firstNames || 'Whoever is ready'}</strong>{' '}
          {d.firstPlayerIds && d.firstPlayerIds.length > 1
            ? 'start together, then invite everyone in'
            : 'answers first, then pass it left'}
        </p>
        <div className="head-buttons">
          <button className="btn btn-cyan" onClick={swap}>
            <IconSwap /> Swap question
          </button>
          <button className="btn btn-big" disabled={act.busy} onClick={act.next}>
            {isLast ? 'Finish' : 'Next question'} <IconArrow size={30} />
          </button>
        </div>
      </footer>
    </div>
  )
}
