import { IconArrow, IconUndo } from '../components/ui.tsx'
import { placeTier, removeTier } from '../lib/api.ts'
import type { HostScreenProps } from '../pages/Host.tsx'
import { TIERS } from '../shared/types.ts'
import type { Tier } from '../shared/types.ts'

export function TierList({ state, room, act }: HostScreenProps) {
  const content = room.content
  if (!content) return null
  const { topic, reason, items } = content.tierlist
  const placed = new Map(state.placements.map((p) => [p.item_index, p]))
  // The current item is simply the first one without a tier, so a reload lands on the right item.
  const current = items.findIndex((_, i) => !placed.has(i))
  const done = current === -1
  const scribe = state.players.find((p) => p.id === room.phase_data.scribeId) ?? state.players[0]
  const last = [...state.placements].sort((a, b) => b.placed_at.localeCompare(a.placed_at))[0]

  const place = (tier: Tier) => {
    if (!done) void placeTier(room, current, tier).then(state.refresh)
  }

  return (
    <div className="tier">
      <header className="host-head">
        <div>
          <p className="kicker">Tier List · phones away</p>
          <h1 className="host-h1">{topic}</h1>
        </div>
        <button className="btn btn-white" disabled={act.busy} onClick={act.skipGame}>
          Skip to next game <IconArrow />
        </button>
      </header>

      <div className="tier-body">
        <div className="card tier-board" role="table" aria-label="Tier list">
          {TIERS.map((t) => (
            <div className="tier-row" role="row" key={t}>
              <span className={`tier-label tier-${t}`} role="rowheader">
                {t}
              </span>
              <span className="tier-items" role="cell">
                {items.map((item, i) =>
                  placed.get(i)?.tier === t ? (
                    <span className="tier-chip pop" key={i}>
                      {item}
                    </span>
                  ) : null,
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="tier-side">
          {done ? (
            <div className="card pad tier-now tilt-r">
              <p className="tier-count">All {items.length} ranked</p>
              <p className="tier-item">That's the list!</p>
              <button className="btn btn-big" disabled={act.busy} onClick={act.next}>
                Next game <IconArrow size={30} />
              </button>
            </div>
          ) : (
            <div className="card pad tier-now tilt-r" key={current}>
              <p className="tier-count">
                Item {current + 1} of {items.length}
              </p>
              <p className="tier-item pop">{items[current]}</p>
              <p className="tier-debate">Debate it out loud!</p>
              <div className="tier-buttons" role="group" aria-label={`Tier for ${items[current]}`}>
                {TIERS.map((t) => (
                  <button key={t} className={`btn tier-btn tier-${t}`} onClick={() => place(t)} aria-label={`${t} tier`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="tier-scribe">
            Scribe: <strong>{scribe?.name ?? 'Anyone'}</strong> taps the tier on this laptop
          </p>
          <p className="chip chip-light tier-reason">Why this topic: {reason}</p>
          <button
            className="link-btn"
            disabled={!last}
            onClick={() => last && void removeTier(room, last.item_index).then(state.refresh)}
          >
            <IconUndo size={18} /> Undo last
          </button>
        </div>
      </div>
    </div>
  )
}
