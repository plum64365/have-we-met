import { Blob, IconArrow, IconCheck, IconClock, IconLock } from '../components/ui.tsx'
import type { HostScreenProps } from '../pages/Host.tsx'
import { currentAnswers, eligibleVoters, witPromptCount } from '../shared/machine.ts'

export function WitScreen({ state, room, act, secondsLeft }: HostScreenProps & { secondsLeft: number | null }) {
  const content = room.content
  if (!content) return null
  const { promptIndex = 0, pair = [] } = room.phase_data
  const total = witPromptCount(room)
  const prompt = content.wit[promptIndex]?.prompt ?? ''
  const authors = pair.map((id) => state.players.find((p) => p.id === id)).filter((p) => p !== undefined)
  const live = { ...state, room }
  const answers = currentAnswers(live)
  const voters = eligibleVoters(live)
  const votes = state.votes.filter((v) => v.prompt_index === promptIndex)
  const isLast = promptIndex + 1 >= total

  const header = (
    <header className="host-head">
      <p className="kicker kicker-ink">
        Wit Dispute · prompt {promptIndex + 1} of {total}
      </p>
      <div className="head-buttons">
        {room.phase !== 'wit_reveal' && (
          <button className="btn btn-white btn-small" disabled={act.busy} onClick={act.skipPrompt}>
            Skip this prompt
          </button>
        )}
        <button className="btn btn-white btn-small" disabled={act.busy} onClick={act.skipGame}>
          Skip to next game <IconArrow size={20} />
        </button>
      </div>
    </header>
  )

  if (room.phase === 'wit_answer') {
    return (
      <div className="wit">
        {header}
        <div className="card wit-prompt tilt-l">{prompt}</div>
        <div className="wit-writers">
          {authors.map((p) => {
            const locked = answers.some((a) => a.player_id === p.id)
            return (
              <div key={p.id} className={`card writer ${locked ? 'locked' : ''}`}>
                <Blob color={p.avatar} size={84} />
                <p className="writer-name">{p.name}</p>
                <p className="writer-status">
                  {locked ? <IconLock size={22} /> : null}
                  {locked ? 'Locked in' : 'Writing…'}
                </p>
              </div>
            )
          })}
          <div className={`timer ${secondsLeft !== null && secondsLeft <= 10 ? 'timer-low' : ''}`} role="timer" aria-live="off">
            <IconClock size={40} />
            <span>{secondsLeft ?? '–'}</span>
          </div>
        </div>
        <p className="wit-foot">Everyone else: watch your phone, you vote next</p>
      </div>
    )
  }

  const reveal = room.phase === 'wit_reveal'
  const countFor = (answerId: string) => votes.filter((v) => v.answer_id === answerId).length
  const best = Math.max(0, ...answers.map((a) => countFor(a.id)))
  const noVote = reveal && votes.length === 0

  return (
    <div className="wit">
      {header}
      <div className="card wit-prompt wit-prompt-small">{prompt}</div>

      {answers.length === 0 ? (
        <p className="card pad wit-empty">Nobody answered in time. On to the next one!</p>
      ) : (
        <div className="versus">
          {answers.map((a, i) => {
            const author = state.players.find((p) => p.id === a.player_id)
            const count = countFor(a.id)
            const winner = reveal && votes.length > 0 && count === best
            return (
              <div className="versus-side" key={a.id}>
                {i === 1 && <span className="vs" aria-hidden="true">VS</span>}
                <div className={`card answer ${i === 0 ? 'tilt-l' : 'tilt-r'} ${winner ? 'winner' : ''}`}>
                  <p className="answer-text">{a.text}</p>
                  {reveal && author && (
                    <p className="answer-author pop">
                      <Blob color={author.avatar} size={48} />
                      <span>{author.name}</span>
                      {votes.length > 0 && (
                        <span className="chip vote-chip">
                          {count} vote{count === 1 ? '' : 's'}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          {answers.length === 1 && reveal && (
            <p className="card pad wit-empty">Only one answer came in, so it wins by default.</p>
          )}
        </div>
      )}

      <div className="wit-bottom">
        {reveal ? (
          <>
            <p className="wit-foot">
              {noVote && answers.length === 2 ? 'No voters this round. Call it out loud!' : 'Authors revealed'}
            </p>
            <button className="btn btn-big btn-white" disabled={act.busy} onClick={act.next}>
              {isLast ? 'Next game' : 'Next prompt'} <IconArrow size={30} />
            </button>
          </>
        ) : (
          <>
            <p className="wit-foot" role="status">
              <IconCheck size={26} /> {votes.length} of {Math.max(voters.length, votes.length)} votes in. Vote on your phone!
            </p>
            <button className="btn btn-big btn-white" disabled={act.busy} onClick={act.next}>
              Reveal <IconArrow size={30} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
