import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Blob, Logo } from '../components/ui.tsx'
import { useTheme } from '../hooks/useTheme.ts'
import { cleanRoomCode } from '../lib/roomCode.ts'
import { AVATARS } from '../shared/quiz.ts'

export default function Home() {
  useTheme('purple')
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  return (
    <main className="phone home">
      <Logo />
      <p className="lead">Meet here. Make plans together.</p>
      <div className="home-blobs" aria-hidden="true">
        {AVATARS.map((color) => <Blob key={color} color={color} size={46} />)}
      </div>
      <div className="card pad home-choice">
        <h2>Join your people</h2>
        <p>Pick your interests, rank a few things together, then get talking. One shared game for 2–12 people.</p>
        <Link className="btn btn-big" to="/play">Join a game</Link>
      </div>
      <div className="card pad home-choice">
        <h2>Bring a group together</h2>
        <p>Create a room, write a welcome message, and put the game on a shared screen.</p>
        <Link className="btn btn-big btn-cyan" to="/host">Host a game</Link>
      </div>
      <form className="card pad home-choice" onSubmit={(e) => { e.preventDefault(); navigate(`/room/${code}`) }}>
        <h2>Already met?</h2>
        <p>Return to your room to make plans, share a photo, or leave an update.</p>
        <label className="field">Room code
          <input className="input input-code" value={code} onChange={(e) => setCode(cleanRoomCode(e.target.value))} maxLength={4} placeholder="ABCD" required />
        </label>
        <button className="btn btn-white" disabled={code.length !== 4}>Open your room</button>
      </form>
    </main>
  )
}
