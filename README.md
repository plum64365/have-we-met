# Have We Met?

A multiplayer icebreaker game for people who have just met, built as a prototype for
COGS 123 (social computing) at UCSD.

One screen on a projector runs the game. Two to six players join on their phones by
scanning a QR code, take a short quiz, and then play three short games that are
generated from what the group has in common:

1. **Tier List** (phones away): rank 8 things together, out loud.
2. **Wit Dispute** (phones out): two players answer a prompt, everyone else votes.
3. **Real Talk** (phones away): nine questions that go from light to deep.

It ends with a hangout suggestion for the group.

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
| `/wizard/:code` | A teammate, quietly | Edit content, swap prompts, force the next phase. Not linked from anywhere. |
| `/preview` | Developers (`npm run dev` only) | Every screen with fake data, no Supabase needed |

## Run it locally

You need Node 22.18 or newer (Node 24 recommended).

```bash
npm install
cp .env.example .env.local     # then fill in the two VITE_ values
npm run dev
```

The app needs a Supabase project to do anything real. **`SETUP.md` has the full steps**
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
| `npm run sync` | Copies shared code and data into the Edge Function folder (runs by itself before `dev` and `build`) |

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
  -> PHONES OUT  -> wit_answer -> wit_vote -> wit_reveal   (repeats per prompt)
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
this-or-that picks, and three short answers with their original questions) and asks for all three games as
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
