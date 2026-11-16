import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../components/ui.tsx'
import { RoomCommunity } from '../components/RoomCommunity.tsx'
import { useRoom } from '../hooks/useRoom.ts'
import { useTheme } from '../hooks/useTheme.ts'
import { isHostOf, getPlayerId } from '../lib/identity.ts'
import { cleanRoomCode } from '../lib/roomCode.ts'

export default function Room() {
  const code = cleanRoomCode(useParams().code ?? '')
  return <RoomPage code={code} key={code} />
}

function RoomPage({ code }: { code: string }) {
  useTheme('purple')
  const playerId = useMemo(() => getPlayerId(code), [code])
  const me = useMemo(() => ({ role: 'player' as const, playerId }), [playerId])
  const state = useRoom(code.length === 4 ? code : undefined, me)
  const player = state.players.find((p) => p.id === playerId)
  return (
    <main className="room-page">
      <header className="room-page-nav">
        <Logo small />
        <Link className="btn btn-white btn-small" to="/">
          Home
        </Link>
      </header>
      {state.room ? (
        <>
          {state.room.phase === 'lobby' && (
            <Link className="btn btn-cyan" to={`/play/${code}`}>
              A new game is open · Join in
            </Link>
          )}
          <RoomCommunity
            key={state.room.id}
            room={state.room}
            players={state.players}
            player={player}
            editable={isHostOf(code)}
          />
        </>
      ) : (
        <div className="card pad step">
          <h1>
            {state.status === 'loading' && code.length === 4 ? 'Opening your room…' : 'Room unavailable'}
          </h1>
          <p>
            {state.status === 'error'
              ? 'Check your connection and try again.'
              : 'Use the four-letter code your group saved.'}
          </p>
          {state.status === 'error' && (
            <button className="btn" onClick={state.refresh}>
              Try again
            </button>
          )}
          <Link className="btn" to="/">
            Find your room
          </Link>
        </div>
      )}
    </main>
  )
}
