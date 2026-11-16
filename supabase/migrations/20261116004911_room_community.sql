-- Room introductions and a shared game for up to twelve people.
alter table public.rooms
  add column title text not null default 'Have We Met?' check (char_length(btrim(title)) between 1 and 60),
  add column description text not null default '' check (char_length(description) <= 300);

create or replace function public.check_player_join()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  room_phase text;
  player_count integer;
begin
  select phase into room_phase from public.rooms where id = new.room_id for update;
  if room_phase is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if room_phase <> 'lobby' then raise exception 'GAME_STARTED'; end if;
  select count(*) into player_count from public.players where room_id = new.room_id;
  if player_count >= 12 then raise exception 'ROOM_FULL'; end if;
  return new;
end;
$$;

-- The composite key prevents posts and RSVPs being attributed to a different room.
alter table public.players add constraint players_room_id_id_key unique (room_id, id);

create table public.room_plans (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  activity text not null check (char_length(btrim(activity)) between 1 and 140),
  location text not null default '' check (char_length(location) <= 120),
  starts_at timestamptz,
  duration_minutes integer not null default 60 check (duration_minutes in (30, 60, 90, 120)),
  chat_url text not null default '' check (chat_url = '' or (chat_url ~ '^https://' and char_length(chat_url) <= 2048)),
  rev integer not null default 0
);

create trigger room_plans_bump_rev before update on public.room_plans
for each row execute function public.bump_room_rev();

create table public.room_rsvps (
  room_id uuid not null references public.room_plans(room_id) on delete cascade,
  player_id uuid not null,
  status text not null check (status in ('going', 'maybe', 'cant')),
  plan_rev integer not null default 0,
  primary key (room_id, player_id),
  foreign key (room_id, player_id) references public.players(room_id, id) on delete cascade
);

-- A response belongs to the plan the player saw, including its date and location.
create function public.check_rsvp_plan()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  current_rev integer;
begin
  select rev into current_rev from public.room_plans where room_id = new.room_id for share;
  if current_rev is null or current_rev <> new.plan_rev then raise exception 'PLAN_CHANGED'; end if;
  return new;
end;
$$;
create trigger room_rsvps_check_plan before insert or update on public.room_rsvps
for each row execute function public.check_rsvp_plan();

create table public.room_posts (
  id uuid primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null,
  body text not null default '' check (char_length(body) <= 600),
  -- Small JPEGs only. Photos stay with the post and need no separate Storage bucket.
  photo text check (photo is null or (char_length(photo) <= 300000 and photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')),
  created_at timestamptz not null default now(),
  check (char_length(btrim(body)) > 0 or photo is not null),
  foreign key (room_id, player_id) references public.players(room_id, id) on delete cascade
);
create index room_posts_room_timeline_idx on public.room_posts(room_id, created_at desc, id desc);

alter table public.room_plans enable row level security;
alter table public.room_rsvps enable row level security;
alter table public.room_posts enable row level security;

-- This account-free classroom prototype shares its board through the room link.
-- These policies follow the existing room access model. They do not claim private accounts.
create policy "prototype: read room plans" on public.room_plans for select to anon, authenticated using (true);
create policy "prototype: create room plans" on public.room_plans for insert to anon, authenticated with check (true);
create policy "prototype: update room plans" on public.room_plans for update to anon, authenticated using (true) with check (true);
create policy "prototype: read room rsvps" on public.room_rsvps for select to anon, authenticated using (true);
create policy "prototype: create room rsvps" on public.room_rsvps for insert to anon, authenticated with check (true);
create policy "prototype: update room rsvps" on public.room_rsvps for update to anon, authenticated using (true) with check (true);
create policy "prototype: read room posts" on public.room_posts for select to anon, authenticated using (true);
create policy "prototype: create room posts" on public.room_posts for insert to anon, authenticated with check (true);
grant select, insert, update on public.room_plans, public.room_rsvps to anon, authenticated;
grant select, insert on public.room_posts to anon, authenticated;

alter publication supabase_realtime add table public.room_plans;
alter publication supabase_realtime add table public.room_rsvps;
alter publication supabase_realtime add table public.room_posts;
