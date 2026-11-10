-- Have We Met? — initial schema
-- Run this once in the Supabase SQL editor, or with `supabase db push` (see SETUP.md).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.rooms (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[A-Z]{4}$'),
  phase          text not null default 'lobby' check (phase in (
                   'lobby', 'building', 'common_ground', 'transition', 'tierlist',
                   'wit_answer', 'wit_vote', 'wit_reveal', 'realtalk', 'hangout')),
  -- Per-phase state: current prompt index, timers, scribe, roster. See src/shared/types.ts.
  phase_data     jsonb not null default '{}'::jsonb,
  -- Optimistic lock. A trigger adds 1 on every update, and every phase change does
  -- `where rev = <seen>`, so the host and the wizard cannot both advance from the same state.
  -- Screens also use it to ignore an out-of-date copy of the row.
  rev            integer not null default 0,
  -- The generated games. See GameContent in src/shared/types.ts.
  content        jsonb,
  content_source text check (content_source in ('ai', 'backup', 'wizard')),
  build_status   text not null default 'idle' check (build_status in ('idle', 'building', 'ready', 'error')),
  quick_play     boolean not null default true,
  -- Goes up by one on "Play again" so old answers, votes and tiers are ignored.
  round          integer not null default 1,
  created_at     timestamptz not null default now()
);

create table public.players (
  -- Generated on the phone and kept in localStorage, so a refresh rejoins the same row.
  id              uuid primary key,
  room_id         uuid not null references public.rooms (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 16),
  avatar          text not null check (avatar in ('yellow', 'pink', 'cyan', 'green', 'orange', 'lilac')),
  interests       text[] not null default '{}',
  -- null = not answered yet, '' = skipped.
  voice_text      text check (voice_text is null or char_length(voice_text) <= 400),
  this_or_that    jsonb not null default '{}'::jsonb,
  -- Only says whether the player shared a location. The coordinates are in player_locations.
  shared_location boolean not null default false,
  quiz_done       boolean not null default false,
  joined_at       timestamptz not null default now(),
  last_seen       timestamptz not null default now()
);

create index players_room_idx on public.players (room_id);
-- Names are unique per room (ignoring case) because the AI refers to players by name.
create unique index players_room_name_idx on public.players (room_id, lower(btrim(name)));

-- Private. Deliberately kept out of `players` because that table is broadcast to every
-- phone by Realtime. Nothing but the build-game function (service role) can read this.
create table public.player_locations (
  player_id  uuid primary key references public.players (id) on delete cascade,
  room_id    uuid not null references public.rooms (id) on delete cascade,
  lat        numeric(5, 2) not null,
  lng        numeric(6, 2) not null,
  created_at timestamptz not null default now()
);

create table public.wit_answers (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  round        integer not null default 1,
  prompt_index integer not null,
  player_id    uuid not null references public.players (id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 60),
  created_at   timestamptz not null default now(),
  unique (room_id, round, prompt_index, player_id)
);

create table public.wit_votes (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  round        integer not null default 1,
  prompt_index integer not null,
  voter_id     uuid not null references public.players (id) on delete cascade,
  answer_id    uuid not null references public.wit_answers (id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- One vote per voter per prompt.
  unique (room_id, round, prompt_index, voter_id)
);

create table public.tier_placements (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  round      integer not null default 1,
  -- Index into content.tierlist.items, so the wizard can rename an item safely.
  item_index integer not null check (item_index between 0 and 7),
  tier       text not null check (tier in ('S', 'A', 'B', 'C', 'D')),
  placed_at  timestamptz not null default now(),
  primary key (room_id, round, item_index)
);

-- ---------------------------------------------------------------------------
-- rooms.rev goes up by exactly one on every update, whoever makes it.
-- ---------------------------------------------------------------------------

create or replace function public.bump_room_rev()
returns trigger
language plpgsql
as $$
begin
  new.rev := old.rev + 1;
  return new;
end;
$$;

create trigger rooms_bump_rev
  before update on public.rooms
  for each row execute function public.bump_room_rev();

-- ---------------------------------------------------------------------------
-- Join rules: at most 6 players, and new players only while the room is in the lobby.
-- Done in a trigger so two phones joining at the same instant cannot both be player 6.
-- The client matches on the ROOM_FULL / GAME_STARTED text to show a friendly message.
-- ---------------------------------------------------------------------------

create or replace function public.check_player_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_phase text;
  player_count integer;
begin
  -- Locks the room row so concurrent joins are checked one at a time.
  select phase into room_phase from rooms where id = new.room_id for update;
  if room_phase is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if room_phase <> 'lobby' then
    raise exception 'GAME_STARTED';
  end if;
  select count(*) into player_count from players where room_id = new.room_id;
  if player_count >= 6 then
    raise exception 'ROOM_FULL';
  end if;
  return new;
end;
$$;

create trigger players_check_join
  before insert on public.players
  for each row execute function public.check_player_join();

-- ---------------------------------------------------------------------------
-- Location: write-only from the phone, through this function.
-- Coordinates are rounded to 2 decimals (about 1 km) here as well as on the phone.
-- Passing nulls removes the player's location.
-- ---------------------------------------------------------------------------

create or replace function public.set_player_location(p_player_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from players where id = p_player_id;
  if v_room_id is null then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  if p_lat is null or p_lng is null then
    delete from player_locations where player_id = p_player_id;
    update players set shared_location = false where id = p_player_id;
    return;
  end if;

  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'BAD_COORDINATES';
  end if;

  insert into player_locations (player_id, room_id, lat, lng)
  values (p_player_id, v_room_id, round(p_lat::numeric, 2), round(p_lng::numeric, 2))
  on conflict (player_id) do update set lat = excluded.lat, lng = excluded.lng;

  update players set shared_location = true where id = p_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- !!! CLASS PROTOTYPE ONLY !!!
-- There are no accounts, so these policies let anyone holding the anon key read and
-- write every row in the five game tables. That is fine for a 10-minute classroom demo
-- and NOT fine for a real product: anyone could change another room's phase or read
-- other players' quiz answers. Before real use, add auth and scope each policy to the
-- caller's room and player.
--
-- The one strict table is player_locations: RLS is on and it has NO policies, so the
-- anon key cannot read or write it at all. Phones write through set_player_location()
-- and only the Edge Function (service role, which bypasses RLS) reads it.
-- ---------------------------------------------------------------------------

alter table public.rooms            enable row level security;
alter table public.players          enable row level security;
alter table public.player_locations enable row level security;
alter table public.wit_answers      enable row level security;
alter table public.wit_votes        enable row level security;
alter table public.tier_placements  enable row level security;

create policy "prototype: open access" on public.rooms
  for all to anon, authenticated using (true) with check (true);
create policy "prototype: open access" on public.players
  for all to anon, authenticated using (true) with check (true);
create policy "prototype: open access" on public.wit_answers
  for all to anon, authenticated using (true) with check (true);
create policy "prototype: open access" on public.wit_votes
  for all to anon, authenticated using (true) with check (true);
create policy "prototype: open access" on public.tier_placements
  for all to anon, authenticated using (true) with check (true);

-- Explicit grants, in case the project does not grant public tables to the API roles by default.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.rooms, public.players, public.wit_answers, public.wit_votes, public.tier_placements
  to anon, authenticated;
revoke all on public.player_locations from anon, authenticated;
grant execute on function public.set_player_location(uuid, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: every screen subscribes to these with postgres_changes.
-- player_locations is intentionally left out.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.wit_answers;
alter publication supabase_realtime add table public.wit_votes;
alter publication supabase_realtime add table public.tier_placements;
