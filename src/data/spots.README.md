# spots.json: PLACEHOLDERS, verify before the demo

Every entry in `spots.json` has `"placeholder": true`. The names are general areas or
generic descriptions, the coordinates are approximate, and `minutes` is a guess at the
travel time from the middle of campus.

Before presenting, for each spot:

1. Replace the name with a real place the team has checked is open and student-friendly.
2. Fix `lat` / `lng` (right-click the place in a maps app and copy the coordinates).
3. Fix `minutes`.
4. Set `"placeholder": false`.

Keep each `id` short, lowercase and unique. The AI must answer with one of these ids.
`category` is free text shown on the hangout screen. `good_for` lists the quiz interests a
spot suits. The AI and backup rank spots by the number of distinct players with a matching
interest, using proximity to break ties. `activity` supplies a concrete plan at that spot.

After editing, run `npm run sync` (it also runs automatically before `npm run dev` and
`npm run build`) and redeploy the Edge Function so it gets the new list.
