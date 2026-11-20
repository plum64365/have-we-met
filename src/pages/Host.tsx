import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Logo, Stage, useDelayed } from '../components/ui.tsx'
import { CommonGround } from '../host/CommonGround.tsx'
import { Hangout } from '../host/Hangout.tsx'
import { Building, Lobby } from '../host/Lobby.tsx'
import { RealTalk } from '../host/RealTalk.tsx'
import { TierList } from '../host/TierList.tsx'
import { Transition } from '../host/Transition.tsx'
import { useRoom } from '../hooks/useRoom.ts'
import type { Me, RoomState } from '../hooks/useRoom.ts'
import { useTheme } from '../hooks/useTheme.ts'
import type { Theme } from '../hooks/useTheme.ts'
import { applyStep, createRoom, playAgain } from '../lib/api.ts'
import { buildGame } from '../lib/game.ts'
import { getHostCode, setHostCode } from '../lib/identity.ts'
import { nextStep, skipGameStep } from '../shared/machine.ts'
import type { Snapshot, Step } from '../shared/machine.ts'
import { canStartGame } from '../shared/quiz.ts'
import type { RoomRow } from '../shared/types.ts'

const Habet = lazy(() => import('../host/Habet.tsx').then((module) => ({ default: module.Habet })))

const PartyGame = lazy(() =>
  import('../host/PartyGame.tsx').then((module) => ({ default: module.PartyGame })),
)

const HOST: Me = { role: 'host' }

// Module-level so React StrictMode's double effects cannot create two rooms or build twice.
let creating: Promise<RoomRow> | null = null
const building = new Set<string>()

export interface HostActions {
  busy: boolean
  /** Natural next step for the current phase. */
  next: () => void
  skipGame: () => void
  start: () => void
  again: () => void
  newRoom: () => void
}

export interface HostScreenProps {
  state: RoomState
  room: RoomRow
  act: HostActions
}

export default function Host() {
  const [code, setCode] = useState<string | null>(() => getHostCode())
  const [error, setError] = useState<string | null>(null)

  const makeRoom = useCallback(() => {
    setError(null)
    creating ??= createRoom()
    creating
      .then((room) => {
        setHostCode(room.code)
        setCode(room.code)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        creating = null
      })
  }, [])

  useEffect(() => {
    if (!code) makeRoom()
  }, [code, makeRoom])

  const state = useRoom(code ?? undefined, HOST)

  // Keep a remembered room across visits. Only a deleted room needs replacement.
  // (forCode guards against acting on the previous code's status right after a switch.)
  const stale = state.forCode === code && state.status === 'missing'

  useEffect(() => {
    if (code && stale) {
      setHostCode(null)
      setCode(null)
    }
  }, [code, stale])

  const newRoom = useCallback(() => {
    setHostCode(null)
    setCode(null)
  }, [])

  if (error || state.status === 'error') {
    return (
      <Stage>
        <div className="host-center">
          <Logo />
          <div className="card pad host-error">
            <h2>Could not reach the game server</h2>
            <p>{error ?? state.error}</p>
            <p>
              Check the Supabase URL and key in .env.local, and that the migration has been run (SETUP.md).
            </p>
            <button className="btn" onClick={() => (error ? makeRoom() : state.refresh())}>
              Try again
            </button>
          </div>
        </div>
      </Stage>
    )
  }

  if (!state.room || state.status !== 'ready' || state.room.code !== code) {
    return (
      <Stage>
        <div className="host-center">
          <Logo />
          <p className="host-sub">Setting up a room…</p>
        </div>
      </Stage>
    )
  }

  return <HostGame state={state} room={state.room} newRoom={newRoom} />
}

function themeFor(room: RoomRow): Theme {
  if (room.phase_data.habet || room.phase.startsWith('wit_')) return 'pink'
  if (room.phase === 'transition' && room.phase_data.kind === 'phones_out') return 'pink'
  if (room.phase === 'realtalk') return 'deep'
  return 'purple'
}

function HostGame({ state, room, newRoom }: { state: RoomState; room: RoomRow; newRoom: () => void }) {
  useTheme(themeFor(room))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Always read the newest state inside callbacks and timers.
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  })

  const run = useCallback(async (make: (s: Snapshot) => Step | null, extra?: Partial<RoomRow>) => {
    const s = latest.current
    if (!s.room) return
    const step = make({ room: s.room, players: s.players, onlineIds: s.onlineIds, now: Date.now() })
    if (!step) return
    setBusy(true)
    try {
      // If the wizard moved the room first, this does nothing and the screen catches up by itself.
      const saved = await applyStep(s.room, step, extra)
      if (!saved)
        throw new Error('The room changed before this action saved. Check the screen and try again.')
      setProblem(null)
      s.refresh()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const act: HostActions = {
    busy,
    next: () => void run(nextStep),
    skipGame: () => void run(skipGameStep),
    start: () => {
      const current = latest.current
      if (!current.room || !canStartGame(current.players, current.room.round)) return
      void run(() => ({ phase: 'building', phase_data: {} }), {
        build_status: 'building',
        content: null,
        content_source: null,
      })
    },
    again: () => {
      const r = latest.current.room
      if (r) void playAgain(r).then(latest.current.refresh, (e: Error) => setProblem(e.message))
    },
    newRoom,
  }

  // --- Building: generate content, then show common ground -----------------------------
  const buildKey = `${room.id}:${room.round}`
  useEffect(() => {
    if (room.phase !== 'building' || room.build_status === 'ready' || building.has(buildKey)) return
    building.add(buildKey)
    const s = latest.current
    buildGame(room, s.players)
      .catch((e: Error) => setProblem(`Could not build the game: ${e.message}`))
      .finally(() => building.delete(buildKey))
    // Runs once per build; `room` is read at start on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.phase, room.build_status, buildKey])

  const built = room.phase === 'building' && room.build_status === 'ready' && room.content !== null
  // A short beat so "Building your game…" does not just flash by.
  useDelayed(built, 900, () => void run(nextStep))

  // Old removed-game phases advance safely; new middle-game states keep their own flow.
  useDelayed(
    room.phase.startsWith('wit_') && !room.phase_data.habet && !room.phase_data.party,
    0,
    () => void run(nextStep),
  )
  useDelayed(room.phase === 'transition', 900, () => void run(nextStep))

  const props: HostScreenProps = { state, room, act }
  let screen
  switch (room.phase) {
    case 'lobby':
      screen = <Lobby {...props} />
      break
    case 'building':
      screen = <Building />
      break
    case 'common_ground':
      screen = <CommonGround {...props} />
      break
    case 'transition':
      screen = <Transition {...props} />
      break
    case 'tierlist':
      screen = <TierList {...props} />
      break
    case 'wit_answer':
    case 'wit_vote':
    case 'wit_reveal':
      screen = room.phase_data.party ? (
        <Suspense fallback={<Building />}>
          <PartyGame {...props} />
        </Suspense>
      ) : room.phase_data.habet ? (
        <Suspense fallback={<Building />}>
          <Habet {...props} />
        </Suspense>
      ) : (
        <Building />
      )
      break
    case 'realtalk':
      screen = <RealTalk {...props} />
      break
    case 'hangout':
      screen = <Hangout {...props} />
      break
  }

  return (
    <Stage>
      {/* key restarts the entrance animation on every phase change */}
      <div
        className="host-screen"
        key={`${room.phase}:${room.phase_data.promptIndex ?? ''}:${room.phase_data.kind ?? ''}`}
      >
        {screen}
      </div>
      {(problem || !state.connected) && (
        <div className="host-toast" role="status">
          {problem ?? 'Reconnecting to the game…'}
        </div>
      )}
    </Stage>
  )
}
