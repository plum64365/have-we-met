import { useEffect, useRef, useState } from 'react'
import { Blob, IconArrow, useDelayed } from '../components/ui.tsx'
import { useCountdown } from '../hooks/useCountdown.ts'
import { applyStep } from '../lib/api.ts'
import type { HostScreenProps } from '../pages/Host.tsx'
import { acceptHabet, expireHabet, passHabet, pauseHabet } from '../shared/habet.ts'
import type { HabetState } from '../shared/types.ts'

export function Habet(props: HostScreenProps) {
  const game = props.room.phase_data.habet
  return game ? <HabetRound {...props} game={game} /> : null
}
function HabetRound({ room, state, act, game }: HostScreenProps & { game: HabetState }) {
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const attempted = useRef('')
  const seconds = useCountdown(game.paused ? null : game.deadline)
  const total = useCountdown(game.paused ? null : game.ends_at)
  const player = state.players.find((person) => person.id === game.remaining[game.currentIndex])
  const complete = game.status === 'complete'
  const winners = game.winners
    .map((id) => state.players.find((person) => person.id === id)?.name)
    .filter(Boolean)
    .join(' + ')
  const update = async (make: () => HabetState) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const next = make()
      const saved = await applyStep(room, {
        phase: 'wit_answer',
        phase_data: { ...room.phase_data, habet: next },
      })
      if (!saved) throw new Error('The turn changed. Check the screen and try again.')
      setAnswer('')
      state.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The turn did not save. Try again.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const expired = !complete && !game.paused && (seconds === 0 || total === 0)
  useEffect(() => {
    const key = `${room.rev}:${game.turn}`
    if (expired && !busy && attempted.current !== key) {
      attempted.current = key
      void update(() => expireHabet(game, Date.now()))
    }
    // Each saved revision gets at most one automatic expiry attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, room.rev, game.turn])
  const [automatic, setAutomatic] = useState(true)
  useDelayed(complete && automatic, 5000, act.next)

  return (
    <div className="habet">
      <header className="host-head">
        <div>
          <p className="kicker">Game 2 · Habet · Say it out loud</p>
          <h1 className="host-h1">{complete ? 'That’s a round!' : game.topic}</h1>
        </div>
        <button className="btn btn-white" disabled={busy || act.busy} onClick={act.skipGame}>
          Next game <IconArrow />
        </button>
      </header>
      <div className="habet-layout">
        <section className="card pad habet-turn" aria-label="Habet turn">
          {complete ? (
            <>
              <p className="kicker kicker-ink">
                {game.winners.length > 1 ? 'Still standing together' : 'Last player standing'}
              </p>
              <h2>
                {game.winners.length > 3
                  ? `${game.winners.length} players finished together`
                  : winners || 'Great round, everyone!'}
              </h2>
              {game.winners.length > 3 && <p className="habet-winners">{winners}</p>}
              <p>{game.answers.length} answers, plenty to ask each other about.</p>
              <p>Pick one answer you would like to hear more about after the game.</p>
              <button className="btn btn-cyan" disabled={act.busy} onClick={act.next}>
                Continue to Talk It Out <IconArrow />
              </button>
              {automatic && (
                <p className="hint">
                  Continuing in a moment…{' '}
                  <button className="link-btn" onClick={() => setAutomatic(false)}>
                    Stay here
                  </button>
                </p>
              )}
            </>
          ) : (
            <>
              <div className="habet-person">
                {player && <Blob color={player.avatar} size={64} />}
                <h2>{player?.name ?? 'Next player'}</h2>
                <strong className="habet-clock" role="timer" aria-label="Seconds left">
                  {game.paused ? 'Ⅱ' : seconds}
                </strong>
              </div>
              <p>
                Give an answer that starts with an unused letter. The group agrees it fits, then the host
                accepts it.
              </p>
              <form
                className="step"
                onSubmit={(event) => {
                  event.preventDefault()
                  void update(() => acceptHabet(game, answer, Date.now()))
                }}
              >
                <label className="field">
                  Answer
                  <input
                    className="input"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    maxLength={60}
                    disabled={busy || !!game.paused || expired}
                    autoComplete="off"
                    placeholder="Say it, then type it here"
                  />
                </label>
                <div className="community-actions">
                  <button className="btn" disabled={!answer.trim() || busy || !!game.paused || expired}>
                    Accept answer
                  </button>
                  <button
                    type="button"
                    className="btn btn-white"
                    disabled={busy || !!game.paused}
                    onClick={() => void update(() => passHabet(game, Date.now()))}
                  >
                    Pass this turn
                  </button>
                </div>
              </form>
              <button
                className="link-btn"
                disabled={busy}
                onClick={() => void update(() => pauseHabet(game, Date.now()))}
              >
                {game.paused ? 'Resume clock' : 'Pause clock'}
              </button>
              {error && (
                <div role="alert">
                  <p>{error}</p>
                  {expired && (
                    <button
                      className="btn btn-small"
                      onClick={() => void update(() => expireHabet(game, Date.now()))}
                    >
                      Retry next turn
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        <section className="habet-side" aria-label="Habet letters and answers">
          <div className="card pad">
            <h2>New letter. New answer.</h2>
            <div className="habet-alphabet" aria-label="Available letters">
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
                <span
                  key={letter}
                  className={game.blocked.includes(letter) ? 'blocked' : ''}
                  aria-label={`${letter} ${game.blocked.includes(letter) ? 'blocked' : 'available'}`}
                >
                  {letter}
                </span>
              ))}
            </div>
            <p className="hint">
              {game.remaining.length} still in · {game.eliminated.length} cheering them on · 2-minute round
            </p>
          </div>
          <div className="card pad habet-answers">
            <h2>What came up</h2>
            {game.answers.length ? (
              <ul>
                {game.answers.slice(-6).map((item) => (
                  <li key={item.letter}>
                    <strong>{item.letter}</strong> {item.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Answers appear here. Listen for a shared interest to ask about later.</p>
            )}
            <p className="hint">
              Out early? Help the group judge answers and pick a new discovery to talk about.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
