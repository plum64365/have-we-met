# Have We Met?

A multiplayer icebreaker game for people who have just met, built as a prototype for
COGS 123 (social computing) at UCSD.

One screen on a projector runs the game. Two to twelve players join on their phones by
scanning a QR code, take a short quiz, and then play two short games that are
generated from what the group has in common:

1. **Tier List** (phones away): rank 8 things together, out loud.
2. **Real Talk** (phones away): nine questions for 2–9 players, twelve for 10–12 players. Everyone starts a turn.

It ends with a hangout suggestion and a shared room for planning a meetup, responding to invitations, posting photos and updates, and returning later. New-student rooms get campus-focused speaking questions, Tier List and Real Talk, plus a three-step campus discovery task. Optional personal introductions and voice answers inform neutral discussion themes.

## How it is built

| Part | What |
|---|---|
| Frontend | React, Vite, TypeScript, React Router, plain CSS |
| Backend | Supabase Postgres + Realtime, one Edge Function (`build-game`) |
| AI | Google Gemini (a free-tier Flash model), called only from the Edge Function |
| Voice | The browser Web Speech API, with typing as a fallback |
| Hosting | Vercel |

There are no accounts. Each phone keeps a random player id in `localStorage`, so a refresh
rejoins as the same player.

## Routes

| Route | Who | What |
|---|---|---|
| `/host` | The laptop on the projector | Creates a room and drives every phase change |
| `/play`, `/play/:code` | Phones | Join, take the quiz, answer and vote |
| `/room/:code` | Returning players | Saved plan, calendar export, RSVPs, chat invite, photos and updates |
| `/stories` | Everyone | Community stories screen with outcome filters and browser-saved bookmarks |
| `/stories/:id` | Everyone | Story detail and follow-up plan |
| `/stories/write` | Returning groups | A story draft with optional photo, saved on this browser. Live publishing is not connected yet |
| `/wizard/:code` | A teammate, quietly | Edit content, swap prompts, force the next phase. Not linked from anywhere. |
| `/preview` | Developers (`npm run dev` only) | Every screen with fake data, no Supabase needed |

## Run it locally

You need Node 22.18 or newer (Node 24 recommended).

```bash
npm install
cp .env.example .env.local     # then fill in the two VITE_ values
npm run dev
```

Multiplayer play and shared room plans need the existing backend. Home and the stories screens work without backend configuration. **`SETUP.md` has the full steps**
(create the project, run the migration, deploy the function, deploy to Vercel).

Want to look at the design first? `npm run dev` and open `http://localhost:5173/preview`.
That page works with no Supabase project at all.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server, also reachable from phones on the same wifi |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint` | ESLint |
| `npm run test:logic` | Checks the game logic (backup content, validation, phase machine) with fake players |
| `npm run links` | Prints the URLs to open for a multi-device test (see `TESTING.md`) |
| `npm run sync` | Explicitly copies shared code and data into the Edge Function folder when preparing a separate backend release |

## How the game stays in sync

- All game state is in the database. The room row holds the current `phase` and
  `phase_data`; phones only render whatever phase the room is in.
- Only the host screen (or the wizard) changes the phase. The rules are pure functions in
  `src/shared/machine.ts`.
- Every screen subscribes to the room's rows with Supabase Realtime (`postgres_changes`)
  and uses Realtime Presence on the same channel to know who is connected.
- Reload any screen mid-game and it loads the room again and lands in the right place. A
  slow poll (every 4 seconds) covers anything a sleeping phone missed.

```
lobby -> building -> common_ground
  -> PHONES AWAY -> tierlist
  -> PHONES AWAY -> realtalk
  -> hangout -> (Play again) -> lobby
```

## Where things are

```
src/shared/      Game logic used by both the browser and the Edge Function
src/data/        spots.json (PLACEHOLDERS, see spots.README.md) and backup-content.json
src/lib/         Supabase client, all database writes, player identity
src/hooks/       useRoom (live room state + presence), speech, countdown, wake lock
src/host/        Projector screens     src/play/   Phone screens     src/pages/  Routes
supabase/migrations/0001_init.sql      Tables, join rules, RLS, Realtime
supabase/functions/build-game/         The Edge Function
supabase/functions/_shared/            Generated copy of src/shared + src/data. Do not edit.
```

## Content and the AI

When the game starts, `build-game` sends Gemini a group profile (first names, interests,
this-or-that picks, and three short answers with their original questions) and asks for both games as
JSON. The reply is validated. If the call fails, takes more than 15 seconds or returns
something invalid, the content is built from `src/data/backup-content.json` instead. If the
function itself cannot be reached, the host screen builds the same backup content in the
browser. **The whole demo works with zero AI.**

Each room gets one everyday, one story, and one hypothetical speaking question from
`src/shared/question-bank.ts`, plus five rotating this-or-that pairs. Players can speak,
type, or pass. Question sets are stable on refresh and rotate on Play Again, which resets
answers while retaining interests. The generator uses suitable voice details for at least
one Real Talk question. Both content paths choose hangout spots by distinct players matched
to `good_for`, with proximity breaking ties. Activities and reasons stay tied to that spot.

## Privacy notes

- Location is optional, rounded to 2 decimals (about 1 km) on the phone, stored in a table
  the browser cannot read, never shown to anyone and never sent to the AI. It is only used
  to order the hangout spots and estimate "about N min away".
- This is a class prototype. The database policies are wide open on purpose (see the big
  comment in the migration). Do not put real personal data in it.

## Before the demo

- Replace the placeholder spots in `src/data/spots.json` (see `src/data/spots.README.md`).
- Check the Gemini model name in `supabase/functions/build-game/index.ts`.
- Do a full run with real phones on the deployed site (`TESTING.md`).

## Room introductions and staying in touch

The host can set a room name and welcome description in the lobby. Both are saved and
shown to joining players. All twelve seats can reuse the existing six avatar colors.

At the end, the host opens **Plan & share** to set an activity, meeting place, date, duration,
and an HTTPS group-chat invite from their chat app. Players RSVP from their phones and can
export the plan as a calendar event. Updating a plan asks players to confirm their RSVP again.

The shared `/room/CODE` page holds photo and text updates across games. Photos are resized
and re-encoded as JPEGs on the device, with a 300,000-character limit, then saved with the
post. This release needs no additional Storage bucket. The board loads twenty posts at a
time. A saved room link and the home page's room-code form let players return later.
Player and host recognition use the browser they originally joined or hosted with.

The room board follows this account-free classroom prototype's existing access model.
Plans, chat invites, photos, and updates are shared through the room link, and the database
API policies permit public reads. Returning access uses the original browser identity.

## Campus context and returning groups

Use **Customize room → Use new-student introduction**, or describe students as new to campus.
The browser adapts the game using curated campus questions, personal-introduction themes,
and the selected interests. Campus destinations are restricted to Price Center, RIMAC,
Geisel Library, and Sun God Lawn. The room checklist links to official campus information
and the campus map. Travel estimates are omitted for the browser-selected campus task.
The six campus Tier Lists and eighteen campus speaking questions rotate between rounds.

This release uses existing room descriptions, `players.voice_text` for a marked optional
introduction, the existing three `voice_answers`, and existing room content. There are no
new tables, migrations, environment variables, or deployed Edge Function changes. Browser
adaptation takes effect with the frontend deployment. The shared AI prompt source includes
more detailed context guidance for a future, separately authorized generator update.

Exploration checklist progress, story drafts, bookmarks, and recent-room shortcuts stay
on the same browser. Existing room plans and room updates still use their existing shared
backend.

## Live stories

`/stories` is a public feed of stories that groups chose to publish. Nothing from a room
(posts, photos, player names, introductions or quiz answers) is ever published automatically,
and the feed contains no invented testimonials.

- **Identity.** The stories pages use a separate Supabase client with a persisted
  *anonymous* Auth session (`hwm.stories.auth.v1` in localStorage). Readers never sign in.
  The first publish creates an anonymous user that owns the story. The game client stays
  account-free; browser-generated player ids are not used as proof of ownership.
- **Database.** `supabase/migrations/20261117220000_live_stories.sql` adds `public.stories`
  with RLS: anyone reads published stories, only the author creates, edits, unpublishes or
  deletes. `author_id` and consent are not selectable through the API (column grants), and
  `my_stories()` lists the caller's own stories. A trigger manages ownership, revision,
  timestamps and a 30-story-per-author limit. Photos are bounded JPEG data on the row, so
  they are exactly as visible as their story. No Storage bucket is needed.
- **Publishing.** Requires title, group name, story text and the permission checkbox
  (checked again server-side). The draft and photo are saved locally before every attempt
  and kept on failure. The story id comes from the draft, and edits are conditional on the
  revision, so retries never duplicate or silently overwrite.
- **Returning authors.** **Your stories** (`/stories/mine`) lists stories published from this
  browser with Edit, Unpublish/Publish again and Delete. Authorship lives in that browser:
  clearing site data loses the ability to edit.
- **Bookmarks** are per-browser story ids, loaded by id so they do not depend on the feed
  page. Removed or unpublished bookmarks are reported and can be cleared.
