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

The campus discovery ending uses the four entries marked `on_campus` with exactly three
`exploration_steps`. Their `source_url` links to official UC San Diego information.
Geisel and Sun God are real campus landmarks, but coordinates and travel minutes remain
approximate. The new-student activity is an exploration rather than a promise of equipment,
entry, business hours, or event availability.

For the current frontend-only release, editing these entries changes the browser's campus
ending after a normal frontend build. When preparing a separately authorized Edge Function
release, run `npm run sync` explicitly to copy the list and shared sources before deployment.
