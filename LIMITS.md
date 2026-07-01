# LIMITS.md — EY SophIA Live: free-tier limits, connection ceiling & room-size math

This is the honest capacity picture, measured against the REAL production Supabase
(project `soiekjltkigbmohtpznq`) with real load tests. Read the **verdict** first,
then the math if you want the why.

---

## TL;DR verdict

| Question | Answer |
|---|---|
| **Safe max room size (people)** | **~180 concurrent open phones** on Supabase free tier, comfortably. Hard ceiling ~198. |
| **With the post-vote mitigation now shipped** | The ceiling is no longer "open tabs" — it's "people still deciding at the same instant." A room of **300–400** is realistic because voters release their connection seconds after voting. |
| **Votes/sec capacity** | Not a concern. 200 concurrent vote writes completed at 100% success, p95 ≈ 570–710 ms, tallies EXACT (no lost updates). Votes are NOT connections. |
| **What breaks first at scale** | Concurrent **Realtime connections** (200 cap), never write throughput or DB size. |
| **When to upgrade** | If you expect **>180 phones open simultaneously and NOT yet voted**, move to Supabase Pro (500 connections, raise-able). See "Upgrade path". |

---

## Supabase free tier — the numbers that matter here

| Resource | Free-tier limit | Our usage / headroom |
|---|---|---|
| **Concurrent Realtime connections** | **200** | THE binding constraint. See ceiling math below. |
| Realtime messages / month | 2,000,000 | 1 broadcast per vote + 1 per status change. A 300-vote event ≈ 300 msgs. Fanned out to N subscribers, each delivery counts — see message math. Still tiny vs 2M. |
| Database size | 500 MB | A vote row is ~100 bytes. 1M votes ≈ 100 MB. Non-issue for workshops. |
| Monthly Active Users (MAU) | 50,000 | Voters are anon (no auth user). Only admins are auth users (a handful). Non-issue. |
| Egress / bandwidth | 5 GB/mo | Static bundle + small JSON. Non-issue for a single event. |
| **Project auto-pause** | **after 7 days inactivity** | Mitigated by the Vercel Cron keep-alive (`/api/cron/keepalive`, daily). See caveat below. |

### Project auto-pause — IMPORTANT operational caveat
The free project **pauses after 7 days with no activity**, which would make the app
return errors on event day if it slept. Mitigations in place:
- `vercel.json` has a daily cron hitting `/api/cron/keepalive` (a trivial authed DB ping).
- **BUT Vercel Hobby crons run only ONCE PER DAY** and only when the project is
  deployed on Vercel. Since production is currently NOT deployed (blocked at the
  account level), the cron is NOT running yet.
- **Action:** Once Vercel prod is unblocked (see RUNBOOK), the cron keeps it awake.
  Until then, **manually hit the DB at least once every 7 days** (open the admin, or
  run any query) — or the project sleeps and the event-day app errors on first load.
- If unsure the morning of the event: open the app once ~1 hour before. First load
  after a pause wakes it (a few seconds cold start), then it's fine.

---

## The connection ceiling — measured, not guessed

Each open browser tab that holds a Supabase Realtime WebSocket = **1 connection**
against the 200 cap. From the code (verified):

| Client | Realtime connections held |
|---|---|
| **Voter phone (before voting)** | **1** — the private `poll:<id>` channel (live tally + status) via `useLiveTally`. |
| **Voter phone (AFTER voting, with mitigation)** | **0** — drops the WS, switches to a light HTTP status poll. |
| **Projector screen** | **2** — `poll:<id>` (tally/status) + `lobby:<id>` (presence count). |

### Formula
```
Without mitigation:  concurrent_connections ≈ N_open_tabs + 2
With mitigation:     concurrent_connections ≈ N_still_deciding + 2
```
Where `N_still_deciding` = people who have the page open but have NOT yet voted at
that instant. In a real room, that spikes for ~30–60 s after the QR goes up, then
collapses toward 0 as people vote.

### What this means for room size
- **Without mitigation:** ~198 phones can be open at once before hitting the cap.
  A 200-person room where everyone opens the page simultaneously would flirt with
  the ceiling; a 250+ room would exceed it and late subscribers would fail to
  connect (they'd fall back to "connecting…", never seeing the live race).
- **With the shipped mitigation:** the sustained connection count tracks only the
  "deciding" crowd. Even a 400-person room is fine as long as no more than ~180
  people are simultaneously open-and-not-yet-voted. Realistically voting is staggered
  over seconds, so the peak-concurrent-deciding is well under the headcount.

### Recommended max room size
- **No changes / mitigation off:** cap the room at **~180 phones** for comfort.
- **Mitigation on (current state):** **300–400 people** is safe for a normal
  vote-then-watch flow. If you expect a synchronized stampede (everyone scans in the
  same 5 seconds and stares before voting), keep it under ~180 open-simultaneously
  or upgrade.

### Message-count math (the 2M/mo limit — not a worry)
Broadcast fan-out = (messages emitted) × (subscribers). Worst case: 300 votes × 200
subscribers = 60,000 deliveries for the whole event. Against 2,000,000/month that's
3%. The mitigation reduces this further (fewer subscribers after voting). **Never
the binding constraint.**

---

## Mitigation shipped (this QA pass)

**Change:** after a voter casts (or is detected already-voted), the voter page
**unsubscribes from Realtime** and switches to `usePollWatch` — a visibility-aware
4-second poll of `polls.status` plus a single `get_results` call when the poll
closes. The personal "your team finished #N" reveal is preserved (it reads the
final ranked results at close). Verified end-to-end against prod (rank/count exact).

**Effect:** trades a scarce resource (200 WS connections) for an abundant one
(indexed HTTP reads). Sustained connections drop from "one per open phone for the
whole event" to "one per phone only until it votes."

**Cost:** a voted phone does 1 tiny indexed SELECT every 4 s while visible (paused
when the tab is hidden). At 300 voted phones that's ~75 req/s of single-row reads —
trivial for PostgREST.

---

## Vercel free (Hobby) limits — for when prod is deployed

| Resource | Hobby limit | Note for this app |
|---|---|---|
| Serverless function invocations | Generous (1M+/mo equiv) | `/api/vote` is one invocation per vote. A 300-vote event ≈ 300 invocations. Non-issue. |
| Function duration | 10 s (Hobby) | Vote route is a single RPC, <1 s. Non-issue. |
| Cron jobs | **1 run/day, and only on a deployed project** | The keep-alive cron. Fine for keep-alive; can't be used for sub-daily scheduling. Auto-close does NOT depend on it (compute-on-read + pg_cron in the DB handle that). |
| Bandwidth | 100 GB/mo | Static bundle + JSON. Non-issue for one event. |
| Concurrent builds / deploys | 1 | Irrelevant on event day. |

**Note:** the server-authoritative auto-close is handled INSIDE Supabase
(compute-on-read in `cast_vote` + a `pg_cron` job every 30 s), NOT by a Vercel cron,
so the once-a-day Hobby cron limit does NOT affect timed polls.

---

## Upgrade path (if the room is bigger than free tier allows)

| If you need… | Do this |
|---|---|
| **>180 phones open-and-undecided at once** | **Supabase Pro** ($25/mo): 500 concurrent Realtime connections (raise-able on request), no 7-day pause, larger DB. Single biggest lever. |
| Sub-daily Vercel cron, longer functions | **Vercel Pro** ($20/mo): more cron frequency, 60 s functions, more bandwidth. Only needed if you add features; NOT required for the current app. |
| Huge one-off event (1000+ concurrent) | Supabase Pro + consider raising the Realtime connection limit via support, and load-test again at the target number before the event. |

**Bottom line:** on **free tier as shipped (mitigation on)**, plan for **up to
~300–400 attendees** with confidence. Above that, the one upgrade that matters is
**Supabase Pro** for the Realtime connection headroom.
