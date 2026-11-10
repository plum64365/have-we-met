import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AvatarColor, PlayerRow } from '../shared/types.ts'

export const AVATAR_HEX: Record<AvatarColor, string> = {
  yellow: '#FFD23F',
  pink: '#FF4F8B',
  cyan: '#3EC6FF',
  green: '#7CE38B',
  orange: '#FF8A3D',
  lilac: '#C9A7FF',
}

const INK = '#1A1033'

/** The cartoon blob avatar. Decorative by default; pass `label` when it stands alone. */
export function Blob({ color, size = 64, label, dim = false }: { color: AvatarColor; size?: number; label?: string; dim?: boolean }) {
  return (
    <svg
      className="blob"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ opacity: dim ? 0.45 : 1 }}
    >
      <path
        d="M50 7c21 0 38 12 41 35 3 24-10 48-40 51C22 96 7 74 8 49 9 24 28 7 50 7z"
        fill={AVATAR_HEX[color]}
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="37" cy="46" r="5.5" fill={INK} />
      <circle cx="63" cy="46" r="5.5" fill={INK} />
      <path d="M37 62q13 13 26 0" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

export function PlayerTag({ player, size = 44, dim }: { player: PlayerRow; size?: number; dim?: boolean }) {
  return (
    <span className="player-tag">
      <Blob color={player.avatar} size={size} dim={dim} />
      <span className="player-tag-name">{player.name}</span>
    </span>
  )
}

function burstPoints(spikes: number, outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI * i) / spikes - Math.PI / 2
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}
const BURST = burstPoints(18, 48, 38)

/** Full-screen cartoon starburst with a pop-in animation. */
export function Starburst({ fill, children, size }: { fill: string; children: ReactNode; size: number }) {
  return (
    <div className="starburst" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <polygon points={BURST} fill={INK} transform="translate(1.6 1.6)" />
        <polygon points={BURST} fill={fill} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
      <div className="starburst-text">{children}</div>
    </div>
  )
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? 'logo logo-small' : 'logo'}>
      Have We <span className="logo-pop">Met?</span>
    </span>
  )
}

/**
 * The host screen is designed at 1280 x 720 and scaled to fit whatever the projector gives us.
 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div className="stage-wrap">
      <main className="stage" style={{ '--stage-scale': scale } as CSSProperties}>
        {children}
      </main>
    </div>
  )
}

/** Calls `fn` once, `delay` ms after `when` becomes true. Cancels if `when` goes false first. */
export function useDelayed(when: boolean, delay: number, fn: () => void) {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    if (!when) return
    const t = setTimeout(() => ref.current(), delay)
    return () => clearTimeout(t)
  }, [when, delay])
}

// --- Icons (inline SVG, no emoji in the UI) ------------------------------------------

function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

type IconProps = { size?: number }

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12.5l5 5L20 6.5" />
  </Icon>
)
export const IconArrow = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
)
export const IconMic = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0014 0M12 18v3" />
  </Icon>
)
export const IconPhone = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18h2" />
  </Icon>
)
export const IconPhoneAway = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M3 3l18 18" />
  </Icon>
)
export const IconEyes = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="7.5" cy="12" rx="4" ry="6" />
    <ellipse cx="16.5" cy="12" rx="4" ry="6" />
    <circle cx="8" cy="9.5" r="1" fill="currentColor" />
    <circle cx="17" cy="9.5" r="1" fill="currentColor" />
  </Icon>
)
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)
export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </Icon>
)
export const IconSwap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />
  </Icon>
)
export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 018 0v3" />
  </Icon>
)
export const IconPencil = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20l1-4.5L16.5 4l3.5 3.5L8.5 19z" />
  </Icon>
)
export const IconUndo = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5L3 10l5 5M3 10h11a6 6 0 010 12h-3" />
  </Icon>
)
export const IconSpark = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z" />
  </Icon>
)
