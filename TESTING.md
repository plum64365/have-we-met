# Test the game and shared room

Use Node 22.18+ or Node 24. Run `npm run build`, `npm run lint`, and `npm run test:logic`.
The logic suite checks the two-game flow, twelve-player turn allocation, quiz rotation,
matching, calendar times and invite URL validation. `/preview` provides sample screens.

## One host and several phones

Use separate browser profiles for separate players. Apply all migrations in `SETUP.md`
first. Start `/host` and join through `/play/CODE`.

1. Choose **Customize room**, save a title and description, and refresh the host. Confirm
   the introduction remains and appears on joining phones.
2. Join two players, complete the quiz, and check that a saved speaking answer survives a
   refresh. Try speaking, typing, and passing. Finish the five this-or-that pairs.
3. Start the game. The overview shows Tier List and Real Talk. Rank items, then advance
   directly to Real Talk. Try swapping a question and advancing through all levels.
4. Finish on the hangout screen. Confirm the suggested activity matches the selected spot.
5. Repeat with twelve players. Reuse avatar colors. All twelve cards should fit on the
   projector. Confirm that a thirteenth join is refused and all twelve players start a
   Real Talk turn over twelve questions.
6. Refresh during Tier List and Real Talk. The item/question and starting player should
   resume. If presence is unavailable, the saved roster should still participate.

## Plans, photos and returning later

1. On the host, open **Plan & share**. Save an activity, place, date, duration, and HTTPS
   chat invite. Cancel an edit and verify that saved data stays intact.
2. Open the room from a phone at the end, or scan the room QR. RSVP and refresh. The
   response and count should remain. Change the host's plan and confirm that old responses
   require reconfirmation. A stale plan editor should report a conflict.
3. Download **Add to calendar**. Confirm the local time and chosen duration in a calendar
   app. A plan without a date should offer date selection through its editor.
4. Post an update and upload or take a photo. Confirm the preview and shared post. Try a
   failed response followed by a retry and verify there is one post. Invalid or oversized
   images should show an error. Text updates should render as text.
5. Open **Join group chat** and check the host's invite destination. Copy the room link.
6. Refresh, then open the saved `/room/CODE` link using the original browser. Confirm the
   plan, RSVP, photo and updates remain. The home page's room-code form should reopen it.
7. Choose **Play again**. Quiz answers reset and questions rotate. The community plan and
   updates persist. After hosting a different room, the original host can still edit the
   older room from its saved link.
8. With more than twenty updates, use **Older updates** and verify chronological ordering
   and complete pages, including posts sharing the same timestamp.

## Hosting verification

Verify both real AI generation and the backup path. Inspect the wizard's content source
and computed note to confirm which ran. The browser flow works with a local backup when
the function is unavailable. Real microphone support requires HTTPS or localhost and a
supported browser.

The account-free room board is accessible through room links and the public API access
model documented in `README.md`. Test photos should be appropriate for the shared room.

## Campus context and stories screens — frontend only

1. Customize a room with the new-student introduction. Join on a phone, choose interests,
   and enter an optional introduction. Confirm three campus-oriented speaking questions,
   typing and passing, and refresh/resume. The introduction must not consume one of the
   three speaking-answer slots.
2. Play with two and twelve people. Confirm a campus Tier List, the correct Real Talk
   count, newcomer-answerable questions at each level, and campus-only question swaps.
   Play again and check that speaking questions and Tier List topics rotate.
3. Finish the game. Confirm the projector's campus task and the phone's three checkboxes.
   Follow the map and official spot link. Check a step and refresh in the same browser.
   Progress is browser-local, separate from the existing shared planner.
4. Return home and open the recent-room shortcut. Existing planner, RSVP, photo and chat
   features should remain available.

## Live stories (deployed site)

Use two browser profiles: **A** (author) and **B** (reader, never published).
Delete your test stories from **Your stories** afterwards; do not leave fictional stories up.

1. **Draft.** In A, open `/stories/write`. Save a partial draft, reload, and check it resumes.
   Add a photo, save, reload: the preview remains. Publishing with an empty field or without
   the permission checkbox shows what is missing and sends nothing.
2. **Publish failure.** In A, go offline (DevTools > Network > Offline) and publish. An error
   says the draft and photo are still saved. Reload: both are there.
3. **Publish.** Back online, publish a story without a photo, then one with a photo. Each opens
   its page with "Your story is live". Click Publish twice quickly / retry after a failure:
   only one story appears.
4. **Read.** In B, open `/stories` and each story URL. Both stories show without signing in.
5. **Return and edit.** In A, refresh, open **Your stories**, edit a story, re-tick the
   permission box, publish changes. B sees the change after a refresh.
6. **Unpublish.** In A, unpublish one. B's feed and story URL no longer show it
   ("Story unavailable"); A still sees it marked "Only you can see this". Publish again.
7. **Direct API.** With B's anon key (and with a separate anonymous session), try
   `PATCH /rest/v1/stories?id=eq.<A's id>` and `DELETE …`: zero rows change.
   `GET /rest/v1/stories?select=author_id` is refused, and `GET …?status=eq.unpublished`
   returns nothing for anyone but the author.
8. **Filters and pages.** With more than 12 stories, More stories loads the next page with no
   duplicates; each outcome filter shows only its stories.
9. **Bookmarks.** In B, save a story, switch filters and pages, then open **Saved stories**:
   it is there. Unpublish it in A: B's saved view reports it is no longer available and
   offers to remove it.
10. Confirm the campus game, room planner, RSVPs, photos and updates still work.

`npm run test:logic` also covers story validation, retry matching, feed cursors and error text.
