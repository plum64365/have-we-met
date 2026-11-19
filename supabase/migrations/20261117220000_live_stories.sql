-- Live community stories.
--
-- Authors are Supabase Auth users. The stories pages sign in anonymously the first time someone
-- publishes, so no account form is needed, and the game itself never signs in. Ownership is
-- enforced with auth.uid(). The game's browser-generated player ids are not used for stories.
--
-- Requires: Authentication > Sign In / Providers > "Allow anonymous sign-ins" turned on.
--
-- Photos are small JPEG data URLs stored on the row (the same format as room_posts), so a photo
-- is readable exactly when its story is: published stories are public, unpublished ones are
-- visible only to their author. No Storage bucket is needed.

create table public.stories (
  id uuid primary key,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 100 and char_length(btrim(title)) > 0),
  group_name text not null check (char_length(group_name) <= 60 and char_length(btrim(group_name)) > 0),
  body text not null check (char_length(body) <= 1800 and char_length(btrim(body)) > 0),
  place text not null default '' check (char_length(place) <= 120),
  next_plan text not null default '' check (char_length(next_plan) <= 400),
  outcome text not null check (outcome in ('first_hangout', 'became_friends', 'still_meeting')),
  photo text check (
    photo is null
    or (char_length(photo) <= 300000 and photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')
  ),
  consent_confirmed boolean not null default false,
  status text not null default 'published' check (status in ('published', 'unpublished')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  -- Nothing reaches the public feed without the author's explicit permission.
  constraint stories_published_needs_consent
    check (status <> 'published' or (consent_confirmed and published_at is not null))
);

create index stories_feed_idx on public.stories (published_at desc, id desc) where status = 'published';
create index stories_feed_outcome_idx on public.stories (outcome, published_at desc, id desc)
  where status = 'published';
create index stories_author_idx on public.stories (author_id, updated_at desc);

-- Server-managed fields. The client can never choose the author, revision or timestamps.
-- Security definer so the per-author limit can count rows without exposing author_id to the API.
create function public.prepare_story()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'SIGN_IN_REQUIRED' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.stories where author_id = uid) >= 30 then
      raise exception 'STORY_LIMIT';
    end if;
    new.author_id := uid;
    new.status := 'published';
    new.revision := 1;
    new.created_at := now();
    new.updated_at := now();
    new.published_at := now();
  else
    if new.id is distinct from old.id
      or new.author_id is distinct from old.author_id
      or new.created_at is distinct from old.created_at then
      raise exception 'IMMUTABLE_FIELD';
    end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
    if new.status = 'published' and old.status <> 'published' then
      new.published_at := now();
    else
      new.published_at := old.published_at;
    end if;
  end if;
  if new.status = 'published' and not new.consent_confirmed then
    raise exception 'CONSENT_REQUIRED';
  end if;
  return new;
end;
$$;

create trigger stories_prepare before insert or update on public.stories
for each row execute function public.prepare_story();

alter table public.stories enable row level security;

-- Column-level grants: author_id, consent_confirmed and created_at are never readable through
-- the API, so the public feed carries no ownership metadata.
revoke all on public.stories from anon, authenticated;
grant select (id, title, group_name, body, place, next_plan, outcome, photo, status, revision, updated_at, published_at)
  on public.stories to anon, authenticated;
grant insert (id, title, group_name, body, place, next_plan, outcome, photo, consent_confirmed)
  on public.stories to authenticated;
grant update (title, group_name, body, place, next_plan, outcome, photo, consent_confirmed, status)
  on public.stories to authenticated;
grant delete on public.stories to authenticated;

create policy "stories: anyone reads published" on public.stories
  for select to anon, authenticated using (status = 'published');
create policy "stories: authors read their own" on public.stories
  for select to authenticated using (author_id = (select auth.uid()));
create policy "stories: authors create their own" on public.stories
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "stories: authors edit their own" on public.stories
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "stories: authors delete their own" on public.stories
  for delete to authenticated using (author_id = (select auth.uid()));

-- "Your stories": the signed-in author's own stories, published or not, without photos.
-- Security definer because author_id is deliberately not selectable through the API.
create function public.my_stories()
returns table (
  id uuid,
  title text,
  group_name text,
  outcome text,
  status text,
  revision integer,
  has_photo boolean,
  updated_at timestamptz,
  published_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.title, s.group_name, s.outcome, s.status, s.revision, s.photo is not null,
         s.updated_at, s.published_at
  from public.stories s
  where s.author_id = auth.uid()
  order by s.updated_at desc, s.id desc
  limit 50;
$$;

revoke execute on function public.my_stories() from public, anon;
grant execute on function public.my_stories() to authenticated;
revoke execute on function public.prepare_story() from public, anon, authenticated;
