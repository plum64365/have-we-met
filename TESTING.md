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
