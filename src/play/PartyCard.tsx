import { useState } from 'react'
import { privatePartyCard } from '../shared/middle-games.ts'
import type { PartyState } from '../shared/types.ts'

export function PartyCard({ game, playerId }: { game: PartyState; playerId: string }) {
  const [shown, setShown] = useState(false)
  const card = privatePartyCard(game, playerId)
  return (
    <section className="card pad step party-phone">
      <h1>{game.kind === 'wavelength' ? 'Wavelength' : 'Imposter'}</h1>
      <p>Keep your phone facing you. Look up when you have read your card.</p>
      {card ? (
        <>
          {shown || game.stage === 'reveal' ? (
            <>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </>
          ) : (
            <p>Your card is face down.</p>
          )}
          {game.stage !== 'reveal' && (
            <button className="btn" aria-pressed={shown} onClick={() => setShown(!shown)}>
              {shown ? 'Hide my card' : 'Show my card'}
            </button>
          )}
        </>
      ) : (
        <p>Watch the shared screen for this round.</p>
      )}
    </section>
  )
}
