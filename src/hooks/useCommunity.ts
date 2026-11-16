import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCommunity, fetchPosts } from '../lib/community.ts'
import { supabase } from '../lib/supabase.ts'
import { POST_PAGE_SIZE } from '../shared/community.ts'
import type { RoomPlan, RoomPost, RoomRsvp } from '../shared/types.ts'

function mergePosts(current: RoomPost[], incoming: RoomPost[]): RoomPost[] {
  const byId = new Map(current.map((post) => [post.id, post]))
  for (const post of incoming) byId.set(post.id, post)
  return [...byId.values()].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  )
}

export function useCommunity(roomId: string) {
  const [plan, setPlan] = useState<RoomPlan | null>(null)
  const [rsvps, setRsvps] = useState<RoomRsvp[]>([])
  const [posts, setPosts] = useState<RoomPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const sequence = useRef(0)
  const olderPending = useRef(false)
  const latestSignature = useRef('')
  const knownPosts = useRef<RoomPost[]>([])

  const refresh = useCallback(async () => {
    const request = ++sequence.current
    try {
      const data = await fetchCommunity(roomId, knownPosts.current)
      if (request !== sequence.current) return
      setPlan(data.plan)
      setRsvps(data.rsvps)
      const signature = data.posts.map((post) => post.id).join('|')
      if (signature !== latestSignature.current) {
        latestSignature.current = signature
        knownPosts.current = data.posts
        setPosts(data.posts)
        setHasMore(data.posts.length === POST_PAGE_SIZE)
      }
      setError('')
    } catch {
      if (request === sequence.current)
        setError('Room tools could not load. Try again or ask the host to check the room setup.')
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    void refresh()
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const channel = supabase.channel(`community:${roomId}`)
    for (const table of ['room_plans', 'room_rsvps', 'room_posts']) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `room_id=eq.${roomId}` },
        (change) => {
          if (table === 'room_posts' && change.eventType === 'DELETE') {
            knownPosts.current = knownPosts.current.filter((post) => post.id !== change.old.id)
            setPosts(knownPosts.current)
          }
          void refresh()
        },
      )
    }
    channel.subscribe()
    const interval = setInterval(visible, 15_000)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('online', visible)
    return () => {
      // This counter invalidates in-flight requests when the subscription closes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequence.current++
      clearInterval(interval)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('online', visible)
      void supabase.removeChannel(channel)
    }
  }, [roomId, refresh])

  const loadOlder = async () => {
    const oldest = posts.at(-1)
    if (!oldest || olderPending.current) return
    olderPending.current = true
    setLoadingOlder(true)
    try {
      const signature = latestSignature.current
      const older = await fetchPosts(roomId, oldest)
      if (signature !== latestSignature.current) return
      knownPosts.current = mergePosts(knownPosts.current, older)
      setPosts(knownPosts.current)
      setHasMore(older.length === POST_PAGE_SIZE)
    } catch {
      setError('Older updates could not load. Try again.')
    } finally {
      olderPending.current = false
      setLoadingOlder(false)
    }
  }

  return { plan, rsvps, posts, loading, error, refresh, hasMore, loadOlder, loadingOlder }
}
