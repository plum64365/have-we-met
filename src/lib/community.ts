import { POST_PAGE_SIZE } from '../shared/community.ts'
import type { RoomPlan, RoomPost, RoomRsvp, RsvpStatus } from '../shared/types.ts'
import { supabase } from './supabase.ts'

export async function fetchPosts(roomId: string, before?: RoomPost): Promise<RoomPost[]> {
  let query = supabase
    .from('room_posts')
    .select()
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(POST_PAGE_SIZE)
  if (before)
    query = query.or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`,
    )
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as RoomPost[]
}

export async function fetchCommunity(roomId: string, knownPosts: RoomPost[]) {
  const [plan, rsvps, latest] = await Promise.all([
    supabase.from('room_plans').select().eq('room_id', roomId).maybeSingle(),
    supabase.from('room_rsvps').select().eq('room_id', roomId),
    supabase
      .from('room_posts')
      .select('id,room_id,player_id,body,created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(POST_PAGE_SIZE),
  ])
  const error = plan.error ?? rsvps.error ?? latest.error
  if (error) throw new Error(error.message)
  // Keep recurring sync requests small. A photo is downloaded once per loaded post.
  const cached = new Map(knownPosts.map((post) => [post.id, post.photo]))
  const rows = (latest.data ?? []) as Omit<RoomPost, 'photo'>[]
  const missing = rows.filter((post) => !cached.has(post.id)).map((post) => post.id)
  if (missing.length) {
    const photos = await supabase
      .from('room_posts')
      .select('id,photo')
      .eq('room_id', roomId)
      .in('id', missing)
    if (photos.error) throw new Error(photos.error.message)
    for (const post of photos.data ?? []) cached.set(post.id, post.photo)
  }
  const posts = rows
    .filter((post) => cached.has(post.id))
    .map((post) => ({ ...post, photo: cached.get(post.id) ?? null }))
  return { plan: plan.data as RoomPlan | null, rsvps: (rsvps.data ?? []) as RoomRsvp[], posts }
}

export async function savePlan(plan: Omit<RoomPlan, 'rev'>, revision?: number): Promise<void> {
  const query =
    revision === undefined
      ? supabase.from('room_plans').insert(plan)
      : supabase.from('room_plans').update(plan).eq('room_id', plan.room_id).eq('rev', revision)
  const { data, error } = await query.select('room_id')
  if (error?.code === '23505' || (!error && !data?.length))
    throw new Error('The plan changed. Refresh it before saving again.')
  if (error) throw new Error(error.message)
}

export async function saveRsvp(
  roomId: string,
  playerId: string,
  status: RsvpStatus,
  revision: number,
): Promise<void> {
  const { error } = await supabase
    .from('room_rsvps')
    .upsert(
      { room_id: roomId, player_id: playerId, status, plan_rev: revision },
      { onConflict: 'room_id,player_id' },
    )
  if (error) throw new Error(error.message)
}

export async function savePost(
  post: Pick<RoomPost, 'id' | 'room_id' | 'player_id' | 'body' | 'photo'>,
): Promise<void> {
  // The caller reuses the id after a failed response, so a retry cannot duplicate a post.
  const { error } = await supabase
    .from('room_posts')
    .upsert(post, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}
