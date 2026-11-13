import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Logo } from '../components/ui.tsx'
import { useRoom } from '../hooks/useRoom.ts'
import type { Me } from '../hooks/useRoom.ts'
import { useTheme } from '../hooks/useTheme.ts'
import type { Theme } from '../hooks/useTheme.ts'
import { useWakeLock } from '../hooks/useWakeLock.ts'
import { touchPlayer } from '../lib/api.ts'
import { getPlayerId } from '../lib/identity.ts'
import { cleanRoomCode } from '../lib/roomCode.ts'
import { JoinForm } from '../play/JoinForm.tsx'
import { PhoneGame } from '../play/PhoneGame.tsx'
import { Quiz } from '../play/Quiz.tsx'
import { Message } from '../play/Message.tsx'
import type { RoomRow } from '../shared/types.ts'

function themeFor(room: RoomRow | null): Theme {
  if (!room) return 'purple'
  if (room.phase.startsWith('wit_')) return 'pink'
  if (room.phase === 'transition' && room.phase_data.kind === 'phones_out') return 'pink'
  if (room.phase === 'realtalk') return 'deep'
  return 'purple'
}

export default function Play() {
  const params = useParams()
  const code = params.code ? cleanRoomCode(params.code) : ''
  // No code in the URL yet: just the join form, which navigates to /play/CODE.
  if (code.length !== 4) return <JoinOnly badCode={params.code && code.length !== 4 ? params.code : undefined} />
  return <PlayRoom code={code} key={code} />
}

function JoinOnly({ badCode }: { badCode?: string }) {
  useTheme('purple')
  return (
    <main className="phone">
      <Logo />
      <JoinForm initialCode="" notice={badCode ? `"${badCode}" is not a room code. Codes are 4 letters.` : undefined} />
    </main>
  )
}

function PlayRoom({ code }: { code: string }) {
  const playerId = useMemo(() => getPlayerId(code), [code])
  const me: Me = useMemo(() => ({ role: 'player', playerId }), [playerId])
  const state = useRoom(code, me)
  const { room } = state
  const player = state.players.find((p) => p.id === playerId)

  useTheme(themeFor(room))
  useWakeLock(Boolean(player && room && room.phase !== 'hangout'))

  // Heartbeat, as a record of when this phone was last around.
  const joined = Boolean(player)
  useEffect(() => {
    if (!joined) return
    const beat = setInterval(() => {
      if (document.visibilityState === 'visible') touchPlayer(playerId)
    }, 30_000)
    return () => clearInterval(beat)
  }, [joined, playerId])

  if (state.status === 'loading') {
    return (
      <main className="phone">
        <Logo />
        <Message title="Finding your room…" />
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="phone">
        <Logo />
        <Message title="Can't connect" body="Check your connection and try again.">
          <button className="btn" onClick={state.refresh}>
            Try again
          </button>
        </Message>
      </main>
    )
  }
  if (state.status === 'missing' || !room) {
    return (
      <main className="phone">
        <Logo />
        <JoinForm initialCode="" notice={`No room with the code ${code}. Check the big screen and try again.`} />
      </main>
    )
  }

  if (!player) {
    if (room.phase !== 'lobby') {
      return (
        <main className="phone">
          <Logo />
          <Message title="This game already started" body="Watch the big screen and jump in on the next round!" />
        </main>
      )
    }
    return (
      <main className="phone">
        <Logo />
        <JoinForm initialCode={code} room={room} players={state.players} onJoined={state.refresh} />
      </main>
    )
  }

  return (
    <main className="phone">
      <header className="phone-top">
        <Logo small />
        {!state.connected && <span className="chip chip-light">Reconnecting…</span>}
      </header>
      {room.phase === 'lobby' ? (
        <Quiz key={`${room.round}:${player.quiz_round}`} player={player} round={room.round} />
      ) : (
        <PhoneGame state={state} room={room} player={player} />
      )}
    </main>
  )
}
