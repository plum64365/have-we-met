# Test script: several tabs, then real phones

Run `npm run links` at any time to print the URLs for your machine.

Two things to know first:

- **One browser profile = one player.** The player id is saved in the browser, so every
  normal tab is the same player, and all of Chrome's incognito windows together are one
  more. To get several players on one computer, use different browsers (Chrome, Chrome
  incognito, Safari, Firefox) or separate Chrome profiles.
- **Mic and location need HTTPS or localhost.** On `http://192.168...` the voice step
  shows the typing box. That is the fallback working.

## Part 0: no backend at all (2 minutes)

```bash
npm run test:logic     # 31 checks on quiz rotation, matching, game rules and backup content
npm run dev            # then open http://localhost:5173/preview
```

`/preview` shows every host and phone screen with fake data.

## Part 1: one computer, several windows (10 minutes)

Do `SETUP.md` steps 1, 2 and 7 first. The Edge Function is optional for this part: without
it the host builds the backup content after a pause of a second or two.

1. `npm run dev`. Open `http://localhost:5173/host`. **Expect:** a QR code and a 4-letter code.
2. Open `http://localhost:5173/play/CODE` in three separate browsers or profiles (see above).
3. In each: enter a name, pick a blob, tap **I'm in**.
   **Expect:** a card for each player appears on the host screen within a second, saying
   "Taking quiz…".
4. Try to reuse a name. **Expect:** "Someone already took that name."
5. Finish the quiz in each window (pick 3 to 5 interests, speak, type, or pass on each of three questions,
   five this-or-that picks, Finish).
   **Expect:** each card flips to "Quiz done". When the last one finishes, the host shows
   "Starting in 10". Click **Cancel** once and check it stops, then click **Everyone's in**.
6. **Expect:** "Building your game…", then the common ground screen.
7. Click through: **Let's play**, then **Start Tier List**.
   **Expect:** phones show "Phones away!". The first player to join is named as scribe and
   their phone says "You're the scribe!".
8. Place a few items with the S/A/B/C/D buttons, click **Undo last** once, then
   **Skip to next game**.
9. **PHONES OUT!** then **Start Wit Dispute**.
   **Expect:** two windows get a text box and a 45-second timer. The third says "Others are
   writing…".
10. Answer in both. **Expect:** the host moves to the VS screen by itself. The third window
    gets two vote buttons. The two authors see "No voting on your own prompt".
11. Vote. **Expect:** the host reveals authors and vote counts by itself.
12. **Next prompt**, and this time let the timer run out with only one answer.
    **Expect:** it goes straight to the reveal with "wins by default".
13. **Next game**, **Start Real Talk**. Try **Swap question** and **Next question**.
    **Expect:** the "answers first" name changes each question. Phones show "Phones away!".
14. **Skip to next game**. **Expect:** the hangout screen.
15. **Play again**. **Expect:** back in the lobby with the same players and code, all
    taking a fresh quiz. Interests carry over, the speaking questions and this-or-that
    pairs rotate, and the countdown waits for everyone to finish.

### Refresh checks

Start another game and, at each of these points, reload the host tab and one player tab:

- [ ] lobby, after saving the first speaking answer (the player returns to the second question, and Back shows the saved answer)
- [ ] "Building your game…"
- [ ] common ground
- [ ] a PHONES AWAY / PHONES OUT screen
- [ ] Tier List after placing 3 items (the same item is up next)
- [ ] Wit Dispute while answering (the timer continues, it does not restart)
- [ ] Wit Dispute voting, and the reveal
- [ ] Real Talk (same question, same "answers first" name)
- [ ] hangout

**Expect:** every screen comes back exactly where it was.

### Dropped player check

1. With three or more players, close one player's window during Tier List.
2. Continue to Wit Dispute.
   **Expect:** the lobby-style blobs on the PHONES OUT screen show that phone as missing,
   and prompts are only given to players who are still connected.
3. Reopen the closed window at the same `/play/CODE` link.
   **Expect:** it rejoins as the same player.

### Two players, and seven

- [ ] With exactly 2 players, Wit Dispute skips the vote and the reveal says
      "Call it out loud!".
- [ ] With 6 players in the lobby, a 7th browser gets "This room already has 6 players".
- [ ] A new browser that opens the link after the game started gets
      "This game already started".

### Wizard console

Open `http://localhost:5173/wizard/CODE` in another window during a game.

- [ ] **Force next step** moves the host screen and every phone.
- [ ] Edit a Tier List item or a later Wit Dispute prompt, **Save changes**: the host
      screen shows the new text and the status line says `content wizard`.
- [ ] During Real Talk, type into **Question on screen now** and click
      **Show this question**.
- [ ] **Load backup content** and **Regenerate with AI** both work (the second needs the
      function deployed).
- [ ] **Jump to** `hangout`, then **Back to lobby (new round)**.

## Part 2: real phones (10 minutes, needs the Vercel deploy)

1. Open `https://YOUR-SITE.vercel.app/host` on the laptop and put it on the projector or
   a big monitor. Check that text is readable from the back of the room.
2. Each tester scans the QR code. Try at least one iPhone and one Android phone.
3. Voice step, on each phone: hold the button, speak, let go.
   **Expect:** the words appear in the box and can be edited. On an iPhone with Siri and
   Dictation turned off, the typing box appears instead with a short explanation.
4. Tap **Rather type it?** on one phone. **Expect:** it switches to typing.
5. Location step: tick the box on at least half the phones and allow the permission.
6. Play the whole game once without touching the wizard.
   **Expect:** on the hangout screen, "about N min away" appears (only if at least half
   shared a location).
7. During Tier List, lock one phone for a minute, then unlock it at PHONES OUT.
   **Expect:** it catches up to the current screen within a few seconds.
8. Open `/wizard/CODE` on a second laptop and confirm the status line says `content ai`.

## What to write down for the team

- Which phones could not use voice, and what message they saw.
- How long the quiz took (the target is under 90 seconds).
- How long "Building your game…" lasted.
- Any screen where text was cut off or too small on the projector.
