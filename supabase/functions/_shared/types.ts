// Types shared by the browser app and the build-game Edge Function.
// This folder is copied into supabase/functions/_shared by scripts/sync-shared.mjs,
// so keep it free of browser-only and Deno-only APIs, and import with explicit .ts extensions.

export type Phase =
  | 'lobby'
  | 'building'
  | 'common_ground'
  | 'transition'
  | 'tierlist'
  | 'wit_answer'
  | 'wit_vote'
  | 'wit_reveal'
  | 'realtalk'
  | 'hangout'

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D'
export const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D']

export type AvatarColor = 'yellow' | 'pink' | 'cyan' | 'green' | 'orange' | 'lilac'
export type ContentSource = 'ai' | 'backup' | 'wizard'
export type RealTalkLevel = 'light' | 'real' | 'deep'
export const REALTALK_LEVELS: RealTalkLevel[] = ['light', 'real', 'deep']

/** The generated games. The first five keys are exactly the shape requested from the AI. */
export interface GameContent {
  tierlist: { topic: string; reason: string; items: string[] }
  wit: { prompt: string; players: string[] }[]
  realtalk: { light: string[]; real: string[]; deep: string[] }
  hangout: { activity: string; spot_id: string; why: string[] }
  fun_facts: string[]
  /** Added by our code, never by the AI. */
  computed?: {
    /** Travel estimate from the group's average location. null when too few players shared. */
    minutes_away: number | null
    /** Why the backup was used, if it was. Shown in the wizard console only. */
    note?: string
  }
}

/** rooms.phase_data. Every field is optional; which ones are set depends on the phase. */
export interface PhaseData {
  // transition
  kind?: 'phones_away' | 'phones_out'
  next?: 'tierlist' | 'wit_answer' | 'realtalk'
  // tierlist
  scribeId?: string | null
  // wit_answer / wit_vote / wit_reveal
  promptIndex?: number
  pair?: string[]
  /** ISO time when answering closes. */
  deadline?: string
  /** How many Wit Dispute prompts each player has been given so far. */
  turns?: Record<string, number>
  // realtalk
  /** 0..8. Level is floor(step / 3). */
  step?: number
  question?: string
  firstPlayerId?: string | null
  swaps?: number
  /**
   * Player ids (in join order) who were online the last time phones were out.
   * Used for the scribe and the Real Talk order, because phones go to sleep during
   * phones-away games and would otherwise look disconnected.
   */
  roster?: string[]
}

export interface RoomRow {
  id: string
  code: string
  phase: Phase
  phase_data: PhaseData
  rev: number
  content: GameContent | null
  content_source: ContentSource | null
  build_status: 'idle' | 'building' | 'ready' | 'error'
  quick_play: boolean
  round: number
  created_at: string
}

export interface PlayerRow {
  id: string
  room_id: string
  name: string
  avatar: AvatarColor
  interests: string[]
  voice_text: string | null
  this_or_that: Record<string, 'a' | 'b'>
  shared_location: boolean
  quiz_done: boolean
  joined_at: string
  last_seen: string
}

export interface WitAnswerRow {
  id: string
  room_id: string
  round: number
  prompt_index: number
  player_id: string
  text: string
}

export interface WitVoteRow {
  id: string
  room_id: string
  round: number
  prompt_index: number
  voter_id: string
  answer_id: string
}

export interface TierPlacementRow {
  room_id: string
  round: number
  item_index: number
  tier: Tier
  placed_at: string
}

export interface Spot {
  id: string
  name: string
  category: string
  lat: number
  lng: number
  /** Approximate travel minutes from the middle of campus. */
  minutes: number
  /** Interest categories this spot suits. Used by the backup builder. */
  good_for: string[]
  placeholder: boolean
}

export interface BackupCategory {
  tierlist: { topic: string; items: string[] }
  /** Templates. {name} becomes a player's name and {interest} the group's top interest. */
  wit: string[]
  realtalk: { light: string[]; real: string[]; deep: string[] }
  hangout: { activity: string; spot_categories: string[] }
}

export interface BackupContent {
  categories: Record<string, BackupCategory>
  general: BackupCategory
}
