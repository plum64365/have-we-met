// No accounts. Each phone keeps a random player id per room code in localStorage, so a
// refresh (or a locked phone waking up) rejoins as the same player. The host screen
// remembers its room code the same way.

const HOST_KEY = 'hwm.host.code'
const playerKey = (code: string) => `hwm.player.${code.toUpperCase()}`

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private mode or storage disabled: the game still works, a refresh just will not rejoin.
  }
}

/** crypto.randomUUID only exists on HTTPS and localhost, so this also covers LAN testing. */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// Kept in memory too, so the id is stable even when localStorage is unavailable.
const memory = new Map<string, string>()

export function getPlayerId(code: string): string {
  const key = playerKey(code)
  let id = memory.get(key) ?? read(key)
  if (!id) {
    id = uuid()
    write(key, id)
  }
  memory.set(key, id)
  return id
}

export function getHostCode(): string | null {
  return read(HOST_KEY)
}

export function setHostCode(code: string | null) {
  write(HOST_KEY, code)
}
