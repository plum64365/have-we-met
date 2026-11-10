// 4-letter room codes. I and O are left out because they read as 1 and 0 on a projector.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

// Codes we would rather not put on a classroom projector.
const BLOCKED = ['DAMN', 'HELL', 'CRAP', 'SUCK', 'DUMB', 'FART', 'BUTT', 'DEAD', 'KLLS', 'HATE', 'UGLY', 'SEXY', 'NUDE', 'DRUG', 'SLUT', 'DYKE', 'FAGS', 'JEWS', 'NAZZ', 'PAKY', 'TWAT', 'WANK', 'ARSE', 'SHAG', 'PSSY', 'DCKS', 'CNTS', 'FCKS', 'FVCK', 'SHTS', 'BTCH', 'JERK', 'RAPE', 'KKKK']

export function randomRoomCode(): string {
  for (;;) {
    const picks = crypto.getRandomValues(new Uint8Array(4))
    const code = [...picks].map((n) => LETTERS[n % LETTERS.length]).join('')
    if (!BLOCKED.includes(code)) return code
  }
}

/** Uppercases and strips anything that is not a letter, e.g. " krbq " -> "KRBQ". */
export function cleanRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
}
