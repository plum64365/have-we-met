import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom.ts'
import type { Me, RoomState } from '../hooks/useRoom.ts'
import { useTheme } from '../hooks/useTheme.ts'
import { applyStep, patchRoom, playAgain, removePlayer, saveContent } from '../lib/api.ts'
import { BACKUP, localBackup, randomFrom, spareQuestions, SPOTS, witCountFor } from '../lib/game.ts'
import { cleanRoomCode } from '../lib/roomCode.ts'
import { supabase } from '../lib/supabase.ts'
import { backupWit } from '../shared/backup.ts'
import { jumpTo, nextStep, skipGameStep, skipPromptStep } from '../shared/machine.ts'
import type { Snapshot, Step } from '../shared/machine.ts'
import { REALTALK_LEVELS } from '../shared/types.ts'
import type { GameContent, Phase, RoomRow } from '../shared/types.ts'
import { validateContent } from '../shared/validate.ts'

const WIZARD: Me = { role: 'wizard' }
const PHASES: Phase[] = ['lobby', 'common_ground', 'transition', 'tierlist', 'wit_answer', 'realtalk', 'hangout']

/**
 * The Wizard of Oz console. A teammate opens /wizard/CODE on their own laptop to fix
 * content and steer the game while the class watches the host screen. It is not linked
 * from anywhere and has no password: class prototype only.
 */
export default function Wizard() {
  useTheme('deep')
  const code = cleanRoomCode(useParams().code ?? '')
  const state = useRoom(code || undefined, WIZARD)

  if (state.status === 'loading') return <main className="wiz"><p>Loading room {code}…</p></main>
  if (!state.room) {
    return (
      <main className="wiz">
        <h1>Wizard console</h1>
        <p>No room with the code "{code}". Open /wizard/CODE using the code on the host screen.</p>
      </main>
    )
  }
  return <Console state={state} room={state.room} />
}

function Console({ state, room }: { state: RoomState; room: RoomRow }) {
  const [message, setMessage] = useState<string | null>(null)
  const [jump, setJump] = useState<Phase>('tierlist')

  const snapshot = (): Snapshot => ({
    room,
    players: state.players,
    onlineIds: state.onlineIds,
    answers: state.answers,
    now: Date.now(),
  })

  const attempt = async (label: string, work: () => Promise<unknown>) => {
    try {
      const result = await work()
      setMessage(result === false ? `${label}: the room changed first, try again` : `${label}: done`)
    } catch (e) {
      setMessage(`${label} failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const move = (label: string, make: (s: Snapshot) => Step | null) =>
    attempt(label, async () => {
      const step = make(snapshot())
      if (!step) throw new Error('nothing to do from this phase')
      return applyStep(room, step)
    })

  const regenerate = () =>
    attempt('Regenerate with AI', async () => {
      // build-game only saves while build_status is "building".
      await patchRoom(room, { build_status: 'building' })
      const { data, error } = await supabase.functions.invoke('build-game', { body: { roomId: room.id } })
      if (error || !data?.ok) {
        await supabase.from('rooms').update({ build_status: room.content ? 'ready' : 'idle' }).eq('id', room.id)
        throw new Error(error?.message ?? data?.error ?? 'unexpected response')
      }
      if (data.source !== 'ai') setMessage(`AI was not used (${data.note ?? 'no reason given'}), backup content loaded`)
    })

  const d = room.phase_data

  return (
    <main className="wiz">
      <header className="wiz-head">
        <h1>Wizard · {room.code}</h1>
        <p className="wiz-status">
          <span>phase <b>{room.phase}</b></span>
          <span>content <b>{room.content_source ?? 'none'}</b></span>
          <span>build <b>{room.build_status}</b></span>
          <span>round <b>{room.round}</b></span>
          <span>{room.quick_play ? 'quick play' : 'full game'}</span>
          <span className={state.connected ? 'ok' : 'bad'}>{state.connected ? 'live' : 'reconnecting'}</span>
        </p>
        {message && <p className="wiz-message" role="status">{message}</p>}
      </header>

      <section className="wiz-panel">
        <h2>Phase control</h2>
        <div className="wiz-row">
          {room.phase === 'lobby' ? (
            <button
              className="wbtn primary"
              onClick={() =>
                attempt('Start game', () =>
                  applyStep(room, { phase: 'building', phase_data: {} }, { build_status: 'building', content: null, content_source: null }),
                )
              }
            >
              Start game (host screen must be open)
            </button>
          ) : (
            <button className="wbtn primary" onClick={() => void move('Next step', nextStep)}>
              Force next step
            </button>
          )}
          <button className="wbtn" onClick={() => void move('Skip game', skipGameStep)}>Skip to next game</button>
          <button className="wbtn" onClick={() => void move('Skip prompt', skipPromptStep)}>Skip Wit prompt</button>
          <button className="wbtn" onClick={() => void attempt('Play again', () => playAgain(room))}>Back to lobby (new round)</button>
        </div>
        <div className="wiz-row">
          <label>
            Jump to{' '}
            <select value={jump} onChange={(e) => setJump(e.target.value as Phase)}>
              {PHASES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <button
            className="wbtn"
            disabled={!room.content && jump !== 'lobby'}
            onClick={() => void move(`Jump to ${jump}`, (s) => jumpTo(s, jump))}
          >
            Go
          </button>
          {!room.content && <small>Jumping into a game needs content. Load backup content below first.</small>}
        </div>
        <p className="wiz-data">phase_data: <code>{JSON.stringify(d)}</code></p>

        {room.phase === 'realtalk' && (
          <RealTalkOverride key={d.question} room={room} onDone={(m) => setMessage(m)} />
        )}
      </section>

      <section className="wiz-panel">
        <h2>Players ({state.players.length})</h2>
        <table className="wiz-table">
          <thead>
            <tr><th>Name</th><th>Online</th><th>Quiz</th><th>Interests</th><th>Location</th><th /></tr>
          </thead>
          <tbody>
            {state.players.map((p) => (
              <tr key={p.id}>
                <td>{p.name}{d.scribeId === p.id ? ' (scribe)' : ''}{d.pair?.includes(p.id) ? ' (answering)' : ''}</td>
                <td className={state.onlineIds.includes(p.id) ? 'ok' : 'bad'}>{state.onlineIds.includes(p.id) ? 'yes' : 'no'}</td>
                <td>{p.quiz_done ? 'done' : 'in progress'}</td>
                <td>{p.interests.join(', ')}</td>
                <td>{p.shared_location ? 'shared' : 'no'}</td>
                <td>
                  <button
                    className="wbtn small"
                    onClick={() => {
                      if (window.confirm(`Remove ${p.name} from the room?`)) void attempt(`Remove ${p.name}`, () => removePlayer(p.id))
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="wiz-panel">
        <h2>Content</h2>
        <div className="wiz-row">
          <button className="wbtn" onClick={() => void regenerate()}>Regenerate with AI</button>
          <button
            className="wbtn"
            onClick={() => void attempt('Load backup', () => saveContent(room, localBackup(room, state.players, 'Loaded from the wizard console'), 'backup'))}
          >
            Load backup content
          </button>
        </div>
        {room.content?.computed?.note && <p className="wiz-data">note: {room.content.computed.note}</p>}
        {room.content ? (
          <Editor room={room} state={state} onSaved={setMessage} />
        ) : (
          <p>No content yet. It is generated when the game starts, or load the backup above.</p>
        )}
      </section>
    </main>
  )
}

function RealTalkOverride({ room, onDone }: { room: RoomRow; onDone: (m: string) => void }) {
  const [text, setText] = useState(room.phase_data.question ?? '')
  return (
    <div className="wiz-row">
      <label className="grow">
        Question on screen now
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={180} />
      </label>
      <button
        className="wbtn"
        disabled={!text.trim()}
        onClick={() =>
          void patchRoom(room, { phase_data: { ...room.phase_data, question: text.trim() } }).then(
            () => onDone('Question replaced on screen'),
            (e: Error) => onDone(`Failed: ${e.message}`),
          )
        }
      >
        Show this question
      </button>
    </div>
  )
}

function Editor({ room, state, onSaved }: { room: RoomRow; state: RoomState; onSaved: (m: string) => void }) {
  const saved = room.content!
  const savedJson = useMemo(() => JSON.stringify(saved), [saved])
  const [draft, setDraft] = useState<GameContent>(() => structuredClone(saved))
  const [dirty, setDirty] = useState(false)

  // Follow the room's content until the wizard starts editing.
  useEffect(() => {
    if (!dirty) setDraft(JSON.parse(savedJson) as GameContent)
  }, [savedJson, dirty])

  const edit = (change: (c: GameContent) => void) => {
    setDraft((current) => {
      const next = structuredClone(current)
      change(next)
      return next
    })
    setDirty(true)
  }

  const names = state.players.map((p) => p.name)

  const save = async () => {
    const result = validateContent(draft, { playerNames: names, spotIds: SPOTS.map((s) => s.id) })
    if (!result.ok) {
      onSaved(`Not saved: ${result.error}`)
      return
    }
    try {
      await saveContent(room, result.content, 'wizard')
      setDirty(false)
      onSaved('Content saved. Screens update right away.')
    } catch (e) {
      onSaved(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const swapPrompt = (i: number) => {
    const fresh = backupWit(state.players, BACKUP, witCountFor(false, 6) + 6, Math.floor(Math.random() * 50), draft.wit.map((w) => w.prompt))
    const pick = randomFrom(fresh)
    if (pick) edit((c) => void (c.wit[i].prompt = pick.prompt))
  }

  const current = room.phase_data.promptIndex

  return (
    <div className="wiz-editor">
      <div className="wiz-row sticky">
        <button className="wbtn primary" disabled={!dirty} onClick={() => void save()}>Save changes</button>
        <button className="wbtn" disabled={!dirty} onClick={() => { setDraft(structuredClone(saved)); setDirty(false) }}>Discard</button>
        {dirty && <small>Unsaved edits</small>}
      </div>

      <fieldset>
        <legend>Tier List</legend>
        <label>Topic<input value={draft.tierlist.topic} onChange={(e) => edit((c) => void (c.tierlist.topic = e.target.value))} /></label>
        <label>Why this topic<input value={draft.tierlist.reason} onChange={(e) => edit((c) => void (c.tierlist.reason = e.target.value))} /></label>
        <div className="wiz-grid">
          {draft.tierlist.items.map((item, i) => (
            <label key={i}>Item {i + 1}<input value={item} maxLength={40} onChange={(e) => edit((c) => void (c.tierlist.items[i] = e.target.value))} /></label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Wit Dispute</legend>
        {draft.wit.map((w, i) => (
          <div className="wiz-row" key={i}>
            <label className="grow">
              Prompt {i + 1}{room.phase.startsWith('wit_') && current === i ? ' (on screen now)' : ''}
              <input value={w.prompt} maxLength={160} onChange={(e) => edit((c) => void (c.wit[i].prompt = e.target.value))} />
            </label>
            {[0, 1].map((slot) => (
              <label key={slot}>
                Player {slot + 1}
                <select value={w.players[slot] ?? ''} onChange={(e) => edit((c) => void (c.wit[i].players[slot] = e.target.value))}>
                  {!names.includes(w.players[slot]) && <option value={w.players[slot] ?? ''}>{w.players[slot] || '(none)'}</option>}
                  {names.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            ))}
            <button className="wbtn small" onClick={() => swapPrompt(i)}>Swap</button>
            <button className="wbtn small" disabled={draft.wit.length <= 1} onClick={() => edit((c) => void c.wit.splice(i, 1))}>Delete</button>
          </div>
        ))}
        <button
          className="wbtn small"
          onClick={() => edit((c) => void c.wit.push({ prompt: 'New prompt', players: names.slice(0, 2) }))}
        >
          Add prompt
        </button>
        <small>Players for a prompt that is already on screen do not change. Edit a prompt before it starts.</small>
      </fieldset>

      <fieldset>
        <legend>Real Talk</legend>
        {REALTALK_LEVELS.map((level) => (
          <div key={level}>
            <h3>{level}</h3>
            {draft.realtalk[level].map((q, i) => (
              <div className="wiz-row" key={i}>
                <label className="grow">
                  <span className="sr-only">{level} question {i + 1}</span>
                  <input value={q} maxLength={180} onChange={(e) => edit((c) => void (c.realtalk[level][i] = e.target.value))} />
                </label>
                <button
                  className="wbtn small"
                  onClick={() => {
                    const spare = randomFrom(spareQuestions(level, draft))
                    if (spare) edit((c) => void (c.realtalk[level][i] = spare))
                  }}
                >
                  Swap
                </button>
              </div>
            ))}
          </div>
        ))}
        <small>A question already on screen is changed with "Question on screen now" under Phase control.</small>
      </fieldset>

      <fieldset>
        <legend>Hangout and common ground</legend>
        <label>Activity<input value={draft.hangout.activity} maxLength={140} onChange={(e) => edit((c) => void (c.hangout.activity = e.target.value))} /></label>
        <label>
          Spot
          <select value={draft.hangout.spot_id} onChange={(e) => edit((c) => void (c.hangout.spot_id = e.target.value))}>
            {SPOTS.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
            ))}
          </select>
        </label>
        <label>
          Why it fits (one chip per line, 2 to 3)
          <textarea rows={3} value={draft.hangout.why.join('\n')} onChange={(e) => edit((c) => void (c.hangout.why = e.target.value.split('\n')))} />
        </label>
        <label>
          Fun overlaps (one per line, 2 to 3)
          <textarea rows={3} value={draft.fun_facts.join('\n')} onChange={(e) => edit((c) => void (c.fun_facts = e.target.value.split('\n')))} />
        </label>
      </fieldset>
    </div>
  )
}
