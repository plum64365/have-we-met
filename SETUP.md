# Setup: the steps you do by hand

Nothing in this repo has been connected to any cloud service. These steps create the
Supabase project, deploy the Edge Function and put the site on Vercel. Allow about 20 minutes.

You need: a Supabase account, a Google account (for the Gemini key), a Vercel account, and
the Supabase CLI (`supabase --version`; install with `brew install supabase/tap/supabase`).

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and choose **New project**.
2. Pick a name (for example `have-we-met`), set a database password and save it somewhere,
   and choose the region closest to San Diego (West US).
3. Wait until the project finishes setting up.
4. Open **Project Settings > API** (on newer dashboards: **Settings > API Keys** and
   **Settings > Data API**) and copy two values:
   - the **Project URL**, like `https://abcdefgh.supabase.co`
   - the **anon** key (or the newer **publishable** key; either works)
5. The part before `.supabase.co` in the URL is your **project ref**. You need it in step 3.

## 2. Run the migration

Easiest way:

1. In the dashboard, open **SQL Editor > New query**.
2. Paste the whole contents of `supabase/migrations/0001_init.sql`.
3. Click **Run**. It should say "Success. No rows returned".

Or with the CLI, after step 3's `login` and `link`: `supabase db push`.

Run it only once. To start over, delete the six tables (**Table Editor**) and run it again.

## 3. Link the CLI to the project

From the repo folder:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 4. Check Realtime

The migration already adds the tables to Realtime. To confirm:

1. Open **Database > Publications** and click `supabase_realtime`.
2. These five tables should be switched on: `rooms`, `players`, `wit_answers`,
   `wit_votes`, `tier_placements`.
3. `player_locations` must stay **off**. It holds the private location data.

If a table is off, switch it on. Without Realtime the game still works but each screen
updates up to 4 seconds late.

## 5. Get a Gemini key and set the function's secrets

1. Go to <https://aistudio.google.com/apikey> and create an API key. The free tier is enough.
2. Check the current free-tier Flash model name at <https://aistudio.google.com/docs/models>
   and <https://aistudio.google.com/docs/pricing>. When this was written (November 2026) it
   was `gemini-3.6-flash`. If it has changed, use the new name below.
3. Set the secrets:

```bash
supabase secrets set GEMINI_API_KEY=paste-your-key-here GEMINI_MODEL=gemini-3.6-flash
```

These are stored on Supabase, not in the repo. Never put the Gemini key in a `VITE_` variable.

No key yet? Skip this step. The game will run on the backup content.

## 6. Deploy the Edge Function

```bash
npm install
npm run sync
supabase functions deploy build-game
```

`npm run sync` copies the shared code and data into `supabase/functions/_shared`, which is
what gets deployed. Run it and redeploy whenever you change `src/shared` or `src/data`
(for example after fixing `spots.json`).

Quick check that it is live (replace both placeholders). It should answer
`{"ok":false,"error":"No room with that id"}`:

```bash
curl -s -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/build-game \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"roomId":"00000000-0000-0000-0000-000000000000"}'
```

## 7. Fill in `.env.local`

```bash
cp .env.example .env.local
```

Edit `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the values
from step 1. The two `GEMINI_` lines in that file are only a reminder; Vite ignores them.

## 8. Try it locally

```bash
npm run dev
```

Open `http://localhost:5173/host`. A room code should appear. Then follow `TESTING.md`.

## 9. Deploy to Vercel

The mic and location need HTTPS, so real phones need the deployed site.

1. Push the repo to GitHub.
2. Go to <https://vercel.com/new> and import the repo.
3. Framework preset: **Vite**. Build command `npm run build`, output directory `dist`
   (both are the defaults).
4. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   with the same values as `.env.local`. Do not add the Gemini key here.
5. Click **Deploy**.
6. Open `https://YOUR-SITE.vercel.app/host` on the laptop and scan the QR code with a phone.

`vercel.json` already rewrites every path to `index.html`, so links like `/play/KRBQ` work.

## 10. Before the class demo

- [ ] Replace the placeholder spots: `src/data/spots.README.md`. Then `npm run sync`,
      redeploy the function (step 6) and push so Vercel rebuilds.
- [ ] Do one full game on the deployed site with real phones (`TESTING.md`, part 2).
- [ ] Open `/wizard/CODE` during that run and look at **content**: it should say `ai`. If it
      says `backup`, the **note** line under Content says why.
- [ ] Decide who runs the wizard console during the demo.

## If something goes wrong

| What you see | Likely cause | Fix |
|---|---|---|
| "Almost there" page | `.env.local` missing or not filled in | Step 7, then restart `npm run dev`. On Vercel: step 9.4, then redeploy. |
| "Could not reach the game server" on `/host` | Migration not run, or wrong URL/key | Step 2, and check the values from step 1. |
| Phones join but the host screen updates slowly | Realtime is off for a table | Step 4. |
| Content is always `backup` | Key missing, wrong model name, or Gemini quota | Read the note in the wizard console. Check step 5. See logs in **Edge Functions > build-game > Logs**. |
| `/wizard` says content note "build-game failed" | Function not deployed | Step 6. |
| Function logs say `SUPABASE_SERVICE_ROLE_KEY is missing` | Project uses only the new key system | In **Edge Functions > Secrets**, add `SUPABASE_SERVICE_ROLE_KEY` set to the project's secret (service role) key. |
| "Hold to talk" never appears on an iPhone | Siri and Dictation are off, or not on HTTPS | Expected. The typing box is the fallback. |
| A 7th person cannot join | Rooms hold 6 players | Expected. |
