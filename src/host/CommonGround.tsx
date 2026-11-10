import { IconArrow, IconEyes, IconPhone } from '../components/ui.tsx'
import type { HostScreenProps } from '../pages/Host.tsx'
import { witPromptCount } from '../shared/machine.ts'
import { interestCounts } from '../shared/profile.ts'

export function CommonGround({ state, room, act }: HostScreenProps) {
  const content = room.content
  const total = state.players.length
  const top = interestCounts(state.players).slice(0, 4)
  if (!content) return null
  const prompts = witPromptCount(room)

  return (
    <div className="cg">
      <header className="host-head">
        <h1 className="host-h1">Your common ground</h1>
        <button className="btn btn-big" disabled={act.busy} onClick={act.next}>
          Let's play <IconArrow size={30} />
        </button>
      </header>

      <div className="cg-top">
        <section className="card pad cg-bars" aria-label="Top shared interests">
          <h2>Top shared interests</h2>
          {top.length === 0 && <p>No interests picked yet. A mystery group!</p>}
          {top.map((t, i) => (
            <div className="bar-row" key={t.interest}>
              <span className="bar-label">{t.interest}</span>
              <span className="bar-track">
                <span className={`bar-fill bar-${i}`} style={{ width: `${Math.max(8, (t.count / total) * 100)}%` }} />
              </span>
              <span className="bar-count">
                {t.count}/{total}
              </span>
            </div>
          ))}
        </section>

        <section className="cg-facts" aria-label="Fun overlaps">
          {content.fun_facts.slice(0, 3).map((fact, i) => (
            <p key={fact} className={`card fact fact-${i}`}>
              {fact}
            </p>
          ))}
        </section>
      </div>

      <section className="cg-games" aria-label="Tonight's games">
        <article className="card game-card game-tier">
          <p className="game-kicker">Game 1 · Tier List</p>
          <h3>{content.tierlist.topic}</h3>
          <p className="phones-badge away">
            <IconEyes size={22} /> Phones away
          </p>
        </article>
        <article className="card game-card game-wit">
          <p className="game-kicker">Game 2 · Wit Dispute</p>
          <h3>
            {prompts} prompt{prompts === 1 ? '' : 's'} written about you
          </h3>
          <p className="phones-badge out">
            <IconPhone size={22} /> Phones out
          </p>
        </article>
        <article className="card game-card game-real">
          <p className="game-kicker">Game 3 · Real Talk</p>
          <h3>9 questions, light to deep</h3>
          <p className="phones-badge away">
            <IconEyes size={22} /> Phones away
          </p>
        </article>
      </section>
    </div>
  )
}
