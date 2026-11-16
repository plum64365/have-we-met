// DEV ONLY. Renders any screen with fake data so the design can be checked without a
// Supabase project: http://localhost:5173/preview
// It is loaded only by `npm run dev` and is not part of the production build.
// Buttons on these screens are not wired to anything real.

import { BrowserRouter, Link, useSearchParams } from 'react-router-dom'
import { Logo, Stage } from '../components/ui.tsx'
import { CommonGround } from '../host/CommonGround.tsx'
import { Hangout } from '../host/Hangout.tsx'
import { Building, Lobby } from '../host/Lobby.tsx'
import { RealTalk } from '../host/RealTalk.tsx'
import { TierList } from '../host/TierList.tsx'
import { Transition } from '../host/Transition.tsx'
import type { RoomState } from '../hooks/useRoom.ts'
import { useTheme } from '../hooks/useTheme.ts'
import { BACKUP, SPOTS } from '../lib/game.ts'
import { JoinForm } from '../play/JoinForm.tsx'
import { PhoneGame } from '../play/PhoneGame.tsx'
import { Quiz } from '../play/Quiz.tsx'
import { buildBackupContent } from '../shared/backup.ts'
import { AVATARS, INTERESTS } from '../shared/quiz.ts'
import type { Phase, PhaseData, PlayerRow, RoomRow } from '../shared/types.ts'
import type { HostActions } from './Host.tsx'

const NAMES = ['Maya', 'Dev', 'Sam', 'Priya', 'Leo', 'Anastasia', 'Alex', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Quinn']
const players: PlayerRow[] = NAMES.map((name, i) => ({
  id: `p${i}`,
  room_id: 'r',
  name,
  avatar: AVATARS[i % AVATARS.length],
  interests: ['Food', INTERESTS[(i % 4) + 1], INTERESTS[(i % 3) + 5], 'Anime'].slice(0, i === 2 ? 3 : 4),
  voice_text: 'Rewatching Haikyuu and trying every ramen place on Convoy',
  this_or_that: { sleep: i < 4 ? 'b' : 'a', social: i % 2 ? 'a' : 'b', taste: 'b', place: 'a', plan: i % 3 ? 'b' : 'a' },
  shared_location: i < 4,
  quiz_done: i !== 4,
  joined_at: `2026-11-10T10:00:0${i}Z`,
  last_seen: '2026-11-10T10:00:00Z',
}))

const content = {
  ...buildBackupContent(players, BACKUP, SPOTS, {}),
  computed: { minutes_away: 15 },
}

const PHASE_DATA: Record<string, [Phase, PhaseData]> = {
  lobby: ['lobby', {}],
  building: ['building', {}],
  common: ['common_ground', {}],
  away: ['transition', { kind: 'phones_away', next: 'tierlist' }],
  tier: ['tierlist', { scribeId: 'p0' }],
  tierdone: ['tierlist', { scribeId: 'p0' }],
  real: ['realtalk', { step: 4, question: content.realtalk.real[1], firstPlayerId: 'p3' }],
  hangout: ['hangout', {}],
}
const PHONE = ['join', 'quiz', 'done', 'scribe', 'waiting']

const act: HostActions = { busy: false, next() {}, skipGame() {}, start() {}, again() {}, newRoom() {} }

function makeState(screen: string, phase: Phase, phase_data: PhaseData): RoomState & { room: RoomRow } {
  const room: RoomRow = {
    id: 'r',
    code: 'KRBQ',
    phase,
    phase_data,
    rev: 1,
    content: phase === 'lobby' ? null : content,
    content_source: 'backup',
    build_status: 'ready',
    quick_play: true,
    round: 1,
    created_at: new Date().toISOString(),
  }
  const placedCount = screen === 'tierdone' ? 8 : screen === 'tier' ? 5 : 0
  const tiers = ['S', 'A', 'A', 'C', 'B', 'S', 'D', 'B'] as const
  const placements = Array.from({ length: placedCount }, (_, i) => ({
    room_id: 'r',
    round: 1,
    item_index: i,
    tier: tiers[i],
    placed_at: `2026-11-10T10:01:0${i}Z`,
  }))
  return {
    status: 'ready',
    forCode: 'KRBQ',
    error: null,
    room,
    players,
    placements,
    onlineIds: players.filter((_, i) => i !== 5).map((p) => p.id),
    connected: true,
    refresh() {},
  }
}

function HostPreview({ screen }: { screen: string }) {
  const [phase, phase_data] = PHASE_DATA[screen]
  const state = makeState(screen, phase, phase_data)
  const { room } = state
  useTheme(phase.startsWith('wit_') || phase_data.kind === 'phones_out' ? 'pink' : phase === 'realtalk' ? 'deep' : 'purple')
  const props = { state, room, act }
  return (
    <Stage>
      <div className="host-screen">
        {phase === 'lobby' && <Lobby {...props} />}
        {phase === 'building' && <Building />}
        {phase === 'common_ground' && <CommonGround {...props} />}
        {phase === 'transition' && <Transition {...props} />}
        {phase === 'tierlist' && <TierList {...props} />}
        {phase === 'realtalk' && <RealTalk {...props} />}
        {phase === 'hangout' && <Hangout {...props} />}
      </div>
    </Stage>
  )
}

function PhonePreview({ screen }: { screen: string }) {
  const map: Record<string, [string, Phase, PhaseData, number]> = {
    scribe: ['tier', 'tierlist', { scribeId: 'p0' }, 0],
    waiting: ['away', 'realtalk', {}, 2],
  }
  const entry = map[screen]
  const phase = entry?.[1] ?? 'lobby'
  useTheme(phase.startsWith('wit_') ? 'pink' : phase === 'realtalk' ? 'deep' : 'purple')

  if (screen === 'join') {
    return (
      <main className="phone">
        <Logo />
        <JoinForm initialCode="KRBQ" players={players.slice(0, 2)} />
      </main>
    )
  }
  if (screen === 'quiz' || screen === 'done') {
    const me = { ...players[0], interests: [], voice_text: null, this_or_that: {}, quiz_done: screen === 'done' }
    return (
      <main className="phone">
        <header className="phone-top">
          <Logo small />
        </header>
        <Quiz player={me} round={1} />
      </main>
    )
  }
  const state = makeState(entry[0], entry[1], entry[2])
  return (
    <main className="phone">
      <header className="phone-top">
        <Logo small />
      </header>
      <PhoneGame state={state} room={state.room} player={players[entry[3]]} />
    </main>
  )
}

function Index() {
  useTheme('purple')
  return (
    <main className="phone">
      <Logo />
      <div className="card pad">
        <h2>Host screens (1280 x 720)</h2>
        <ul>
          {Object.keys(PHASE_DATA).map((s) => (
            <li key={s}>
              <Link to={`/preview?host=${s}`}>{s}</Link>
            </li>
          ))}
        </ul>
        <h2>Phone screens</h2>
        <ul>
          {PHONE.map((s) => (
            <li key={s}>
              <Link to={`/preview?phone=${s}`}>{s}</Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

function Pick() {
  const [params] = useSearchParams()
  const host = params.get('host')
  const phone = params.get('phone')
  if (host && PHASE_DATA[host]) return <HostPreview screen={host} />
  if (phone && PHONE.includes(phone)) return <PhonePreview screen={phone} />
  return <Index />
}

export default function Preview() {
  return (
    <BrowserRouter>
      <Pick />
    </BrowserRouter>
  )
}
