import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchRoomByCode, fetchRoomTables } from '../lib/api.ts'
import { supabase } from '../lib/supabase.ts'
import type { PlayerRow, RoomRow, TierPlacementRow, WitAnswerRow, WitVoteRow } from '../shared/types.ts'

export interface Me {
  role: 'host' | 'wizard' | 'player'
  playerId?: string
}

export interface RoomState {
  status: 'loading' | 'missing' | 'error' | 'ready'
  /** The room code that `status` describes. Lags behind for one render when the code changes. */
  forCode: string | null
  error: string | null
  room: RoomRow | null
  players: PlayerRow[]
  /** Current round only. */
  answers: WitAnswerRow[]
  votes: WitVoteRow[]
  placements: TierPlacementRow[]
  /** Player ids connected right now, from Realtime Presence. */
  onlineIds: string[]
  /** Whether the realtime channel is subscribed. */
  connected: boolean
  refresh: () => void
}

type Row = Record<string, unknown>
type Change = RealtimePostgresChangesPayload<Row>

/** Applies one realtime change to a list. `keyOf` must work on DELETE's old row (primary key only). */
function applyChange<T>(list: T[], change: Change, keyOf: (row: T) => string): T[] {
  if (change.eventType === 'DELETE') {
    const gone = keyOf(change.old as T)
    return list.filter((row) => keyOf(row) !== gone)
  }
  const next = change.new as T
  const key = keyOf(next)
  return list.some((row) => keyOf(row) === key)
    ? list.map((row) => (keyOf(row) === key ? next : row))
    : [...list, next]
}

const placementKey = (p: TierPlacementRow) => `${p.room_id}:${p.round}:${p.item_index}`
const idKey = (r: { id: string }) => r.id

/** Safety net in case Realtime is misconfigured or a phone missed an event while asleep. */
const POLL_MS = 4000

/**
 * Live view of one room. Loads everything, subscribes to postgres_changes on the room's
 * rows, tracks Presence on the same channel, and refetches whenever the channel
 * (re)subscribes or the tab becomes visible. All game state lives in the database, so a
 * reload of any screen lands back in the right place.
 */
export function useRoom(code: string | undefined, me: Me): RoomState {
  const [status, setStatus] = useState<RoomState['status']>('loading')
  const [forCode, setForCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomRow | null>(null)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [answers, setAnswers] = useState<WitAnswerRow[]>([])
  const [votes, setVotes] = useState<WitVoteRow[]>([])
  const [placements, setPlacements] = useState<TierPlacementRow[]>([])
  const [onlineIds, setOnlineIds] = useState<string[]>([])
  const [connected, setConnected] = useState(false)

  const roomId = room?.id
  const { role, playerId } = me
  const fetchSeq = useRef(0)

  // Never let an older copy of the room row replace a newer one.
  const acceptRoom = useCallback((next: RoomRow) => {
    setRoom((current) => (current && current.id === next.id && current.rev > next.rev ? current : next))
  }, [])

  const refresh = useCallback(async () => {
    if (!code) return
    const seq = ++fetchSeq.current
    try {
      const found = await fetchRoomByCode(code)
      if (seq !== fetchSeq.current) return
      if (!found) {
        setRoom(null)
        setForCode(code)
        setStatus('missing')
        return
      }
      const tables = await fetchRoomTables(found.id)
      if (seq !== fetchSeq.current) return
      acceptRoom(found)
      setPlayers(tables.players)
      setAnswers(tables.answers)
      setVotes(tables.votes)
      setPlacements(tables.placements)
      setError(null)
      setForCode(code)
      setStatus('ready')
    } catch (e) {
      if (seq !== fetchSeq.current) return
      setError(e instanceof Error ? e.message : String(e))
      // Keep showing the last good state if we had one; only a first load shows an error screen.
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'))
    }
  }, [code, acceptRoom])

  // First load, and whenever the code changes.
  useEffect(() => {
    setStatus('loading')
    setRoom(null)
    void refresh()
  }, [refresh])

  // Realtime: row changes + presence, on one channel per room.
  useEffect(() => {
    if (!roomId) return
    const filter = `room_id=eq.${roomId}`
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: playerId ?? `${role}-${Math.random().toString(36).slice(2, 8)}` } },
    })

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (c: Change) => {
        if (c.eventType === 'DELETE') void refresh()
        else acceptRoom(c.new as unknown as RoomRow)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter }, (c: Change) =>
        setPlayers((list) => applyChange(list, c, idKey)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wit_answers', filter }, (c: Change) =>
        setAnswers((list) => applyChange(list, c, idKey)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wit_votes', filter }, (c: Change) =>
        setVotes((list) => applyChange(list, c, idKey)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tier_placements', filter }, (c: Change) =>
        setPlacements((list) => applyChange(list, c, placementKey)),
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ playerId?: string }>()
        const ids = Object.values(state)
          .flat()
          .map((meta) => meta.playerId)
          .filter((id): id is string => Boolean(id))
        setOnlineIds([...new Set(ids)].sort())
      })
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          setConnected(true)
          void channel.track({ role, playerId, at: Date.now() })
          // Catch up on anything that changed while we were not subscribed.
          void refresh()
        } else {
          setConnected(false)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roomId, role, playerId, refresh, acceptRoom])

  // Catch up when a phone wakes or the tab comes back, plus a slow poll as a safety net.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    const poll = setInterval(onVisible, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      clearInterval(poll)
    }
  }, [refresh])

  const round = room?.round ?? 1
  const roundAnswers = useMemo(() => answers.filter((a) => a.round === round), [answers, round])
  const roundVotes = useMemo(() => votes.filter((v) => v.round === round), [votes, round])
  const roundPlacements = useMemo(() => placements.filter((p) => p.round === round), [placements, round])
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id)),
    [players],
  )

  return {
    status,
    forCode,
    error,
    room,
    players: sortedPlayers,
    answers: roundAnswers,
    votes: roundVotes,
    placements: roundPlacements,
    onlineIds,
    connected,
    refresh: () => void refresh(),
  }
}
