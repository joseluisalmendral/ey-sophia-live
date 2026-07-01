# RUNBOOK — EY SophIA Live Voting

Operator guide for **manual testing tomorrow** and **running the event day-of**.
Written to be followed top-to-bottom. If you only read one section, read
**"Two things only the account owner can do"** and **"Day-of pre-flight"**.

---

## 0. Two things ONLY the account owner can do (do these first)

These two are BLOCKED at the account level and cannot be done from code. They need
the Vercel/Supabase dashboard owner.

### (1) Unblock the Vercel production deploy
Production is currently blocked. Until it's unblocked, the app only runs locally.
- Open the project: **https://vercel.com/joseluisalmendrals-projects/ey-sophia-live**
- In the dashboard, resolve whatever is blocking prod deploys (account/plan/permission
  gate), then deploy:
  ```bash
  vercel deploy --prod
  # or: push to the main branch if Git-connected auto-deploy is on
  ```
- Production URL after deploy:
  **https://ey-sophia-live-joseluisalmendrals-projects.vercel.app**
- Deploying prod ALSO activates the daily keep-alive cron (see §5), which stops the
  free Supabase project from pausing.

### (2) Configure Supabase Auth URLs (for admin magic-link login)
The admin logs in via magic-link. The link only works if the Site URL + Redirect URLs
are allowlisted, otherwise the login email link 404s or redirects nowhere.
- Supabase Dashboard → **Authentication → URL Configuration**
- **Site URL:** `https://ey-sophia-live-joseluisalmendrals-projects.vercel.app`
- **Redirect URLs — add BOTH:**
  - `https://ey-sophia-live-joseluisalmendrals-projects.vercel.app/**`
  - `http://localhost:3000/**`   (so local testing magic-links also work)
- Save. Then test: request a magic link, click it, confirm you land on `/admin`.
- (Alternative: set these via a Supabase Personal Access Token + the Management API,
  but the dashboard is simpler and less error-prone.)

> If admins can't log in on event day, it is almost always (2). Re-check the Redirect
> URLs first.

---

## 1. Run the app locally (for testing tomorrow, before prod is unblocked)

```bash
# from the project root
pnpm install          # first time only
pnpm build            # must finish CLEAN (it does)
pnpm start            # serves the REAL production build on http://localhost:3000
```
`.env.local` already points at the real production Supabase, so local = real DB +
real realtime. This is exactly what you'll test.

Demo poll for practice: join code **DEMO42** (4 teams). Reset it to draft before a
clean run (see §6).

---

## 2. The happy-path walkthrough (do this end-to-end at least once)

You'll want **two devices**: a laptop (admin + projector) and a phone (voter).

1. **Admin logs in.** Go to `/admin`. If not logged in you're sent to `/admin/login`.
   Enter an allowlisted admin email → "Enviar enlace" → open the magic link from your
   inbox → you land on the admin panel.
2. **Create / open a poll.** Use the demo poll (DEMO42) or create a new one:
   title, add teams (name + color — the color picker shows a live contrast preview),
   optionally set an **open duration** (seconds) for an auto-closing timed vote,
   choose chart type. The poll starts in **Borrador (draft)**.
3. **Open the projector.** On the laptop (or a second screen/projector), open
   `/screen/DEMO42`. It shows the **lobby**: a big QR code, the short join code, and
   the finalist cards at zero. The QR encodes the VOTER url (`/vote/DEMO42`), not the
   screen url — scan it with the phone to confirm.
4. **Phones join & the room fills.** Attendees scan the QR → land on `/vote/DEMO42`.
   While the poll is draft/countdown they see an animated "voting opens soon" state
   (NOT the vote buttons).
5. **Open voting.** In the admin Live Control, click the big next-state button
   (Draft → [Cuenta atrás] → **Abrir votación**). All phones flip to the vote cards
   **with no refresh**. If a duration was set, the projector shows a live countdown.
6. **Watch the live race.** As phones vote, the projector bar-race animates in real
   time (leader bar glows EY-yellow). A voter taps a team → **Votar** → gets a
   confirmation ("Tu voto para [Equipo] está registrado — mirá la pantalla grande").
   A second tap from the same phone is rejected (one vote per device).
7. **Close & reveal.** Click **Cerrar votación y revelar** (confirm-gated). The
   projector runs the 3-beat reveal: suspense hold → podium (1st center) + crown +
   confetti → fireworks → settle. Each phone that voted shows **"Tu equipo quedó #N"**.

That's the whole show. Rehearse it once fully before the event.

---

## 3. Edge cases to eyeball (spot-check these)

These are all verified in code + automated tests, but eyeball them on real hardware:

- **Bad code → clean 404.** Open `/vote/NOPE` and `/screen/NOPE` → branded 404 page,
  real HTTP 404 (fixed this QA pass). No crash.
- **Draft poll → no vote buttons.** `/vote/DEMO42` while draft shows "opens soon",
  never raw cards.
- **Double vote blocked.** Vote, then reload the phone → you see the "ya votaste"
  state, not the cards. Vote again from a *different* phone → count goes up.
- **Zero votes close.** Open then close a poll with NO votes → reveal shows a designed
  "no votes" state (no crown, no NaN, no crash).
- **Tie.** Two teams equal top count: default rule crowns a single deterministic
  winner (first to reach the count). If you set `double_crown`, two co-winners.
- **Timed auto-close.** Set a short duration (e.g. 20 s), open, walk away — the poll
  closes itself and reveals even if nobody touches anything (server-authoritative).
- **Reconnect.** Toggle wifi on the projector briefly → the board must NOT flash to
  empty; it keeps the last counts and resumes.
- **Reduced motion.** Turn on "Reduce Motion" on a phone → entrances/confetti collapse
  to crossfades; everything still works.
- **Projector legibility.** On the REAL projector at the REAL distance: is the smallest
  text readable? Do the team colors read distinctly? (Projectors crush mid-tones — this
  is the one thing automated tests can't check for you.)

---

## 4. Device / browser checklist

Test the VOTER flow on each; the PROJECTOR only needs to run on the laptop driving it.

| Device / browser | What to check | Known caveats |
|---|---|---|
| **iOS Safari (iPhone)** | scan QR, vote, see confirm + reveal | No vibration (iOS has no `navigator.vibrate` — silently skipped). Audio only after a tap. Private mode: cookies still work (we use cookies, not localStorage) so dedup + reload state survive. |
| **Android Chrome** | scan QR, vote, feel the haptic buzz on vote | Vibration works here. Everything else identical. |
| **Chrome / Edge desktop** | full flow + projector | Full support incl. WebGL shader background. |
| **Firefox desktop** | full flow + projector | Full support; WebGL shader works. |
| **Safari desktop** | full flow | If WebGL is disabled/old, background falls back to a static cosmic gradient — no error. |
| **Any device, "Reduce Motion" on** | vote + reveal | Animations become crossfades; confetti/fireworks disabled; still fully usable. |

**Cookies & https:** the anti-fraud cookie is `Secure`, which requires https. On the
Vercel prod URL that's automatic. On `http://localhost:3000` browsers make a
localhost exception, so local testing works too. On any OTHER plain-http host the
Secure cookie would be dropped and dedup would weaken — always use the https prod URL
for the real event.

---

## 5. Keep-alive (don't let the DB fall asleep)

Free Supabase pauses after **7 days of inactivity**. A paused project makes the app
error on first load.
- The daily Vercel cron (`/api/cron/keepalive`) prevents this — **but it only runs
  once prod is deployed on Vercel** (see §0.1). Until then it is NOT running.
- **While prod is still blocked:** touch the DB at least once every 7 days (open the
  admin panel, or just load `/vote/DEMO42`).
- **Morning of the event:** load the app once ~1 hour before doors. If it was asleep,
  the first load wakes it (a few seconds), then it's warm.

---

## 6. Reset the demo poll to a clean state

Before a clean rehearsal or the real event, reset DEMO42 to pristine (draft, 0 votes,
no timestamps). From the project, using the DB password:

```bash
# quickest: via the Supabase SQL editor or psql
UPDATE polls SET status='draft', opens_at=NULL, closes_at=NULL
  WHERE join_code='DEMO42';
DELETE FROM votes WHERE poll_id=(SELECT id FROM polls WHERE join_code='DEMO42');
UPDATE team_tallies SET count=0
  WHERE poll_id=(SELECT id FROM polls WHERE join_code='DEMO42');
```
(For the real event, create a FRESH poll rather than reusing the demo — cleaner
history and analytics.)

---

## 7. Day-of-event pre-flight checklist

Run this ~60 minutes before doors.

- [ ] **Prod is deployed & reachable.** Open the prod URL, confirm `/` loads.
      (If prod is still blocked, run the whole event from a laptop on `pnpm start`
      on the venue network — test that phones on the venue wifi can reach the
      laptop's `http://<laptop-ip>:3000`. Prefer prod if at all possible.)
- [ ] **DB is awake.** Load `/vote/<code>` once; confirm no error / cold-start passed.
- [ ] **Admin can log in.** Do a real magic-link login now, not at showtime. If it
      fails → check Supabase Redirect URLs (§0.2).
- [ ] **Poll created & in draft.** Teams, colors, duration (if timed), chart type set.
- [ ] **Projector shows the lobby.** QR scannable from the back of the room; join code
      big and legible; finalist cards visible at zero.
- [ ] **Scan test.** Scan the on-screen QR with a phone → lands on the right vote page
      with the right teams.
- [ ] **One full dry run** on the real network: open → 2–3 test votes from 2 phones →
      close → reveal. Then **reset** (§6) before the real audience.
- [ ] **Room size within limits.** See LIMITS.md — free tier is comfortable to
      ~300–400 attendees with the shipped mitigation. If bigger, upgrade Supabase Pro
      first (§ LIMITS "Upgrade path").
- [ ] **Wifi sanity.** Venue wifi that phones will use is reachable and not blocking
      WebSockets (corporate guest wifi sometimes does — test a real vote on it).
- [ ] **Reduce-motion path** quickly eyeballed on one phone.

---

## 8. Troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| Admin magic-link goes nowhere / errors | Supabase Redirect URLs not set (§0.2). Add both prod `/**` and localhost `/**`. |
| App errors on first load event morning | DB was paused (7-day sleep). Reload once to wake it; deploy prod so the cron keeps it awake (§5). |
| Phones show "connecting…" and never see the race | Realtime connection cap hit (>~180 open undecided phones on free tier) OR venue wifi blocks WebSockets. Upgrade Supabase Pro, or move to a network that allows WS. |
| Live race not moving while votes happen | Check the projector is on `/screen/<code>` (not an old tab), and that the poll status is **open**. First status flip after a fresh page can lag 1–2 s (realtime warm-up) — normal. |
| A voter can't vote ("closed" / "not open") | The poll isn't `open`. Open it from admin Live Control. Timed polls auto-close at the duration — reopen requires a new poll (closed is terminal). |
| Vote seems to not dedupe | You're on a plain-http (non-localhost) host so the Secure cookie was dropped. Use the https prod URL. |
| Background is flat (no shader) | WebGL unavailable or Reduce-Motion on → intentional CSS-gradient fallback. Not a bug. |
| Countdown wrong after phone was locked | Countdown is re-derived from the server `closes_at` on resume — unlock and it corrects itself. |

---

## 9. What was verified in QA (so you can trust the above)

Tested against the REAL prod Supabase with the REAL production build:
- Smoke: all routes correct (incl. real 404 for bad codes — fixed this pass).
- Realtime E2E: vote → tally broadcast (absolute count), dedup, open/closed/not-open,
  countdown `closes_at`. 13/13.
- Edge: zero-votes, ties (single + double crown), 1/2/12-team podiums, emoji/long/
  injection team names (stored safe, no XSS), rapid double-submit (exactly 1 vote),
  cross-poll isolation. All pass.
- Load: 150 & 200 concurrent votes = 100% success, tallies EXACT, p95 ≈ 570–710 ms,
  no rate-limits. 50 concurrent realtime subscriptions = all connected.
- Browser fallbacks (WebGL→CSS, WebAudio no-op, vibrate guard, cookies, no
  localStorage, reduced-motion) all present.
- Two bugs found & fixed (cast_vote closed-result semantics; notFound() returning 200).
- One capacity mitigation shipped (voters release their realtime connection after voting).
