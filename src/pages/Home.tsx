import { Link } from 'react-router-dom'
import { Blob, Logo } from '../components/ui.tsx'
import { useTheme } from '../hooks/useTheme.ts'
import { AVATARS } from '../shared/quiz.ts'

export default function Home() {
  useTheme('purple')
  return (
    <main className="phone home">
      <Logo />
      <p className="lead">The icebreaker game for people who have not met yet.</p>
      <div className="home-blobs" aria-hidden="true">
        {AVATARS.map((c) => (
          <Blob key={c} color={c} size={52} />
        ))}
      </div>
      <Link className="btn btn-big" to="/play">
        Join a game
      </Link>
      <Link className="btn btn-big btn-cyan" to="/host">
        Host on the big screen
      </Link>
      <p className="fine">Joining is for phones. Hosting is for the laptop on the projector.</p>
    </main>
  )
}
