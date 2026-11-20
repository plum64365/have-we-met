import { useRef, useState } from 'react'
import { IconArrow, useDelayed } from '../components/ui.tsx'
import { applyStep } from '../lib/api.ts'
import { useDraft } from '../lib/drafts.ts'
import type { HostScreenProps } from '../pages/Host.tsx'
import { partyClue, partyGuess, partyNextClue, partyVote } from '../shared/middle-games.ts'
import type { PartyState } from '../shared/types.ts'

export function PartyGame(props: HostScreenProps) {
  const game = props.room.phase_data.party
  return game ? <PartyRound key={`${game.kind}:${game.round}`} {...props} game={game} /> : null
}
function PartyRound({ room, state, act, game }: HostScreenProps & { game: PartyState }) {
  const key = `hwm.middle.draft.v1.${room.id}.${room.round}.${game.kind}.${game.round}`
  const [clue, setClue] = useDraft(`${key}.clue`, '')
  const [guess, setGuess] = useDraft(`${key}.guess`, 50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [automatic, setAutomatic] = useState(true)
  const pending = useRef(false)
  const name = (id: string) => state.players.find((player) => player.id === id)?.name ?? 'A player'
  const reveal = game.stage === 'reveal'
  useDelayed(reveal && automatic, 5000, act.next)
  const save = async (make: () => PartyState) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const next = make()
      const saved = await applyStep(room, {
        phase: 'wit_answer',
        phase_data: { ...room.phase_data, party: next },
      })
      if (!saved) throw new Error('The round changed. Check the screen and try again.')
      state.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'This turn did not save. Try again.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <div className="habet party-game">
      <header className="host-head">
        <div>
          <p className="kicker">
            Game 2 ·{' '}
            {game.kind === 'wavelength'
              ? `Wavelength · Round ${game.round + 1} of 2`
              : 'Imposter · One clue each'}
          </p>
          <h1 className="host-h1">{room.phase_data.middle_game?.topic || 'Find your common ground'}</h1>
        </div>
        <button className="btn btn-white" onClick={act.skipGame} disabled={busy || act.busy}>
          Next game <IconArrow />
        </button>
      </header>
      <section className="card pad party-main" aria-label="Middle game round">
        {game.kind === 'wavelength' ? (
          <>
            {game.stage === 'clue' && (
              <>
                <h2>{name(game.clue_giver_id)}, check your phone</h2>
                <p>
                  Only the clue giver should look at their target. Say one clue that fits between these two
                  extremes. No numbers!
                </p>
                <Spectrum game={game} />
                <form
                  className="step"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void save(() => partyClue(game, clue))
                  }}
                >
                  <label className="field">
                    Clue said out loud
                    <input
                      className="input"
                      maxLength={120}
                      value={clue}
                      onChange={(event) => setClue(event.target.value)}
                      disabled={busy}
                      placeholder="The host writes down the clue"
                    />
                  </label>
                  <button className="btn" disabled={busy || !clue.trim()}>
                    Let the group guess
                  </button>
                </form>
              </>
            )}
            {game.stage === 'guess' && (
              <>
                <h2>“{game.clue}”</h2>
                <p>
                  Discuss where the clue belongs. The clue giver listens while everyone else agrees on a
                  guess.
                </p>
                <Spectrum game={game} />
                <form
                  className="step"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void save(() => partyGuess(game, guess))
                  }}
                >
                  <input
                    type="range"
                    aria-label="Guess slider"
                    min={0}
                    max={100}
                    value={guess}
                    onChange={(event) => setGuess(Number(event.target.value))}
                    disabled={busy}
                  />
                  <label className="field">
                    Group guess · 0 to 100
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={guess}
                      onChange={(event) => setGuess(Number(event.target.value))}
                      disabled={busy}
                    />
                  </label>
                  <button className="btn" disabled={busy}>
                    Reveal target
                  </button>
                </form>
              </>
            )}
            {reveal && (
              <>
                <h2>{game.score} points together!</h2>
                <Spectrum game={game} reveal />
                <p>
                  Your guess was {game.guess}. The target was {game.target}.
                </p>
                <p>What made the clue land in a different place for different people?</p>
              </>
            )}
          </>
        ) : (
          <>
            {game.stage === 'describe' && (
              <>
                <p className="kicker kicker-ink">
                  Clue {game.turn + 1} of {game.roster.length}
                </p>
                <h2>{name(game.roster[game.turn])}, one word</h2>
                <p>
                  Open your card on your phone. Everyone except one imposter sees the same word. Give one word
                  that hints at it without saying it.
                </p>
                <p>Listen for common ground. The imposter tries to blend in.</p>
                <button className="btn" disabled={busy} onClick={() => void save(() => partyNextClue(game))}>
                  {game.turn + 1 === game.roster.length ? 'Vote now' : 'Next clue'} <IconArrow />
                </button>
              </>
            )}
            {game.stage === 'vote' && (
              <>
                <h2>Who did the group pick?</h2>
                <p>Agree on one player together. The host taps the group’s choice.</p>
                <div className="party-votes">
                  {game.roster.map((id) => (
                    <button
                      className="btn btn-white"
                      key={id}
                      disabled={busy}
                      aria-label={`Vote for ${name(id)}`}
                      onClick={() => void save(() => partyVote(game, id))}
                    >
                      {name(id)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {reveal && (
              <>
                <h2>
                  {game.suspect_id === game.imposter_id
                    ? 'The group found the imposter!'
                    : 'The imposter blended in!'}
                </h2>
                <p>
                  <strong>{name(game.imposter_id)}</strong> had the imposter card.
                </p>
                <p>
                  The shared word was <strong>{game.word}</strong>.
                </p>
                <p>Which clue helped you connect the dots?</p>
              </>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {reveal && (
          <div className="community-actions">
            <button className="btn btn-cyan" disabled={act.busy} onClick={act.next}>
              {game.kind === 'wavelength' && game.round === 0
                ? 'Next Wavelength round'
                : 'Continue to Talk It Out'}{' '}
              <IconArrow />
            </button>
            {automatic && (
              <button className="link-btn" onClick={() => setAutomatic(false)}>
                Stay here
              </button>
            )}
          </div>
        )}
      </section>
      <p className="party-reason">{room.phase_data.middle_game?.reason}</p>
    </div>
  )
}
function Spectrum({ game, reveal = false }: { game: PartyState; reveal?: boolean }) {
  return (
    <div className="party-spectrum">
      <div className="party-spectrum-labels">
        <strong>{game.left}</strong>
        <strong>{game.right}</strong>
      </div>
      <div className="party-spectrum-track">
        {reveal && (
          <span style={{ left: `${game.target}%` }} aria-label={`Target ${game.target}`}>
            ★
          </span>
        )}
      </div>
      <div className="party-spectrum-labels">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  )
}
