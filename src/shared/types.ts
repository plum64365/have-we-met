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

/** Generated content. The legacy wit array is empty in new games. */
export interface GameContent {
  tierlist: { topic: string; reason: string; items: string[] }
  wit: { prompt: string; players: string[] }[]
  realtalk: { light: string[]; real: string[]; deep: string[] }
  hangout: { activity: string; spot_id: string; why: string[] }
  fun_facts: string[]
  /** Curated from the selected campus spot after validation. */
  campus_task?: { key: string; title: string; steps: string[]; return_prompt: string }
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
  /** Middle games use an existing phase value so no schema migration is needed. */
  habet?: HabetState
  party?: PartyState
  middle_game?: MiddleChoice
  game_catalog?: GameCatalogEntry[]
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
  /** 0..5. Two questions per depth level. */
  step?: number
  question?: string
  firstPlayerId?: string | null
  firstPlayerIds?: string[]
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
  title?: string
  description?: string
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
  /** Optional while reading legacy rows and fixtures. Empty answer means passed. */
  voice_answers?: VoiceAnswer[]
  quiz_round?: number
  this_or_that: Record<string, 'a' | 'b'>
  shared_location: boolean
  quiz_done: boolean
  joined_at: string
  last_seen: string
}

export interface VoiceAnswer {
  question_id: string
  question: string
  answer: string
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
  /** Interest categories used by AI and backup hangout matching. */
  good_for: string[]
  /** Curated activity that can actually be done at this spot. */
  activity?: string
  placeholder: boolean
  on_campus?: boolean
  source_url?: string
  exploration_steps?: string[]
}

export interface BackupCategory {
  tierlist: { topic: string; items: string[] }
  realtalk: { light: string[]; real: string[]; deep: string[] }
  hangout: { activity: string; spot_categories: string[] }
}

export interface BackupContent {
  categories: Record<string, BackupCategory>
  general: BackupCategory
}

export interface RoomPlan {
  room_id: string
  activity: string
  location: string
  starts_at: string | null
  duration_minutes: number
  chat_url: string
  rev: number
}

export type RsvpStatus = 'going' | 'maybe' | 'cant'
export interface RoomRsvp {
  room_id: string
  player_id: string
  status: RsvpStatus
  plan_rev: number
}

export interface RoomPost {
  id: string
  room_id: string
  player_id: string
  body: string
  photo: string | null
  created_at: string
}

export interface HabetState {
  status: 'playing' | 'complete'
  topic: string
  remaining: string[]
  currentIndex: number
  eliminated: string[]
  blocked: string[]
  answers: { player_id: string; text: string; letter: string }[]
  turn: number
  deadline: string
  ends_at: string
  winners: string[]
  paused?: { turn_ms: number; game_ms: number }
}

export type MiddleGameId = 'habet' | 'wavelength' | 'imposter'
export interface GameCatalogEntry {
  id: MiddleGameId
  name: string
  min_players: number
  interests: string[]
  description: string
}
export interface MiddleChoice {
  id: MiddleGameId
  name: string
  topic: string
  reason: string
}
export interface PartyState {
  kind: 'wavelength' | 'imposter'
  stage: 'clue' | 'guess' | 'describe' | 'vote' | 'reveal'
  round: number
  roster: string[]
  turn: number
  clue_giver_id: string
  target: number
  left: string
  right: string
  clue: string
  guess: number
  word: string
  imposter_id: string
  suspect_id?: string
  score: number
}
