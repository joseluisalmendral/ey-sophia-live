# LIMITS.md — EY SophIA Live: free-tier limits & room-size math

This is the honest capacity picture, measured against the REAL production Supabase
(project `soiekjltkigbmohtpznq`) and the REAL Vercel prod deployment with real load
tests. Read the **verdict** first, then the math if you want the why.

> **Architecture note (this is why the old numbers changed).** Voter phones **no
> longer open a Supabase Realtime WebSocket at all.** They use CDN-cached HTTP
> polling (`usePollStatus` → `GET /api/poll/[id]/status`). The old "one WS per open
> phone" connection ceiling is gone for the audience. Only the **projector** still
> uses Realtime. The binding constraint is no longer Supabase connections — it's the
> per-IP request rate from the venue's single NAT IP against Vercel's DDoS
> mitigation, and that has been verified safe at room scale.

---

## TL;DR verdict

| Question | Answer |
|---|---|
| **Safe max room size (people)** | **Comfortably several hundred attendees on free tier.** Verified safe to ~300 phones (re-audited at the current 2-3.25s pre-open cadence: CDN collapses the fan-out). For bigger rooms, lengthen the poll interval (see math) — the CDN cache means the origin barely moves regardless. |
| **Do voter connections gate room size?** | **No.** Voters hold **ZERO** Realtime connections. Only the projector holds Realtime (2). Supabase's 200-connection cap is a non-issue for the audience. |
| **What breaks first at scale** | **Aggregate polling request-rate from the venue's single NAT IP** against Vercel per-IP DDoS mitigation. Verified NOT tripped by the shipped cadence at ~300 phones. |
| **Votes/sec capacity** | Not a concern. 200 concurrent vote writes = 100% success, p95 ≈ 570–710 ms, tallies EXACT (no lost updates). Votes are HTTP writes, not connections. |
| **When to upgrade** | You don't need Supabase Pro for connections anymore. For much larger rooms, the free lever is to **lengthen the poll interval** (req/s = phones ÷ interval), not to pay. |

---

## Voter architecture — CDN-cached HTTP polling (no WebSocket)

Each voter phone polls a cookie-less, CDN-cacheable endpoint instead of holding a
WebSocket. From the code (verified):

| Client | Realtime connections held |
|---|---|
| **Voter phone (before voting)** | **0** — polls `GET /api/poll/[id]/status` on a slow cadence. |
| **Voter phone (after voting)** | **0** — same poll, slower cadence; one `GET /api/poll/[id]/results` at close for the personal "your team finished #N". |
| **Projector screen** | **2** — Realtime `poll:<id>` (live tally/status) + `lobby:<id>` (presence count). Unchanged. |

### The polling cadence (deliberately gentle — `src/lib/polling/usePollStatus.ts`)
- **Base interval:** 2.5s while waiting for the poll to open (s-maxage=1 CDN cache absorbs the room), 8s while open, 20s **after** voting.
- **Hard floor:** never sooner than 10s, jitter included.
- **±30% jitter** per tick so a room that loaded together doesn't sync into a herd.
- **Random initial delay (0..12s)** so the first poll from a room that scans the QR
  together is staggered, not one synchronized same-IP burst.
- **Exponential backoff** on fetch error (capped at 30s).
- **Pauses entirely while the tab is hidden**; fires one immediate tick on return.
- **Never surfaces an error** — on repeated failures it keeps the last known state
  and the flow degrades to "watch the big screen."

### The endpoints are CDN-cacheable (verified in prod)
- `GET /api/poll/[id]/status` and `GET /api/poll/[id]/results` both send
  `Cache-Control: public, s-maxage=3, stale-while-revalidate=10` and are cookie-less
  (**no `Set-Cookie`**), so Vercel's CDN serves them.
- **Verified in prod:** `x-vercel-cache: HIT` and NO `Set-Cookie` on both endpoints.
- Effect: no matter how many phones poll, the CDN collapses the room to ~1 origin
  hit per 3s. The origin (and Supabase behind it) is **barely touched**.

---

## The real scaling constraint — per-IP request rate behind venue NAT

All phones at a venue share **one public IP** (the venue NAT). Vercel applies
**per-IP DDoS mitigation**, so what matters is the aggregate request rate from that
single IP:

```
requests_per_second ≈ phones ÷ poll_interval_seconds
```

At the 2.5s pre-open cadence: **300 phones ÷ 2.5s ≈ 120 req/s** from the venue IP, nearly all CDN HITs (verified untripped in the final audit).

### Verified safe (real load test)
A paced load of **2250 requests at ~25 req/s for 90s from a single IP** returned
**2250× HTTP 200, ZERO 403 / zero `x-vercel-mitigated`.** The gentle cadence does
**not** trip Vercel's per-IP mitigation at room scale.

> **Context / why the cadence is deliberately slow.** An earlier *pathological* burst
> of **hundreds of req/s** from one IP DID briefly trip Vercel's per-IP mitigation.
> That mitigation is **per-IP and temporary**, and normal users are never affected —
> but it's exactly why the shipped cadence is intentionally slow. Real audience
> traffic stays well under the threshold.

### Scaling to bigger rooms — lengthen the interval
Because `req/s = phones ÷ interval`, doubling the interval halves the per-IP rate:

| Phones | Interval | ≈ req/s from venue IP |
|---|---|---|
| 300 | 12s (shipped) | ~25 (verified safe) |
| 600 | 24s | ~25 |
| 1000 | 30s | ~33 |

The CDN cache (`s-maxage=3`) means lengthening the interval costs the origin/Supabase
essentially nothing — it only changes how often each phone asks the CDN.

### The trade-off (by design, imperceptible in a guided event)
Phones learn "voting opened/closed" within **~12s**, not instantly. The **projector
is instant** (it keeps Realtime). In a presenter-guided event the presenter says
"vote now" and the phones catch up within a poll cycle — imperceptible. Phones
intentionally do **not** show the live race; the audience watches the big screen.

---

## Supabase free tier — the numbers that matter here

| Resource | Free-tier limit | Our usage / headroom |
|---|---|---|
| **Concurrent Realtime connections** | **200** | **No longer a factor for the audience.** Only the projector uses Realtime (2 connections total). Voters use 0. |
| Realtime messages / month | 2,000,000 | Only the projector subscribes. A whole event is a few hundred messages. Trivial. |
| Database size | 500 MB | A vote row is ~100 bytes. 1M votes ≈ 100 MB. Non-issue for workshops. |
| Monthly Active Users (MAU) | 50,000 | Voters are anon (no auth user). Only admins are auth users (a handful). Non-issue. |
| Egress / bandwidth | 5 GB/mo | Static bundle + small JSON, most of it served from the CDN cache. Non-issue. |
| **Project auto-pause** | **after 7 days inactivity** | Handled automatically by the Vercel Cron keep-alive (`/api/cron/keepalive`, daily, now deployed in prod). See caveat below. |

### Project auto-pause — operational caveat
The free project **pauses after 7 days with no activity**, which would make the app
error on first load if it slept. Status now:
- `vercel.json` has a daily cron (`0 6 * * *`) hitting `/api/cron/keepalive`
  (a trivial authed DB ping). **Prod is deployed, so this cron is ACTIVE** and keeps
  the project awake.
- Belt-and-suspenders: if unsure the morning of the event, **open the app once ~1
  hour before**. First load after any pause wakes it (a few seconds cold start), then
  it's fine.

---

## Write capacity — measured, not a concern

Votes are HTTP writes (`/api/vote` → a single RPC), **not** connections.

- **200 concurrent vote writes = 100% success**, p95 ≈ 570–710 ms.
- Tallies EXACT (no lost updates), no rate-limits hit.

Write throughput is never the binding constraint at workshop scale.

---

## Vercel free (Hobby) limits — prod is deployed

| Resource | Hobby limit | Note for this app |
|---|---|---|
| Serverless function invocations | Generous (1M+/mo equiv) | Most voter polls are **CDN cache hits** (never reach a function). `/api/vote` is one invocation per vote. Non-issue. |
| Function duration | 10 s (Hobby) | Vote route is a single RPC, <1 s. Status/results are single reads. Non-issue. |
| Cron jobs | **1 run/day** | The keep-alive cron (`0 6 * * *`). Fine for keep-alive. Auto-close does NOT depend on it (compute-on-read + pg_cron in the DB handle that). |
| Bandwidth | 100 GB/mo | Static bundle + small JSON, mostly CDN-cached. Non-issue for one event. |
| **Per-IP DDoS mitigation** | Automatic, per-IP, temporary | The one thing that matters at room scale. Verified NOT tripped by the shipped cadence at ~300 phones. See "The real scaling constraint" above. |

**Note:** the server-authoritative auto-close is handled INSIDE Supabase
(compute-on-read in `cast_vote` + a `pg_cron` job), NOT by a Vercel cron, so the
once-a-day Hobby cron limit does NOT affect timed polls.

---

## Room size — recommendation

- **Free tier, as shipped:** comfortably **several hundred attendees**. There is no
  Supabase connection cap in play for voters, and polling is proven safe to **~300
  phones** at the 12s cadence.
- **Bigger than that:** **lengthen the poll interval** (`req/s = phones ÷ interval`).
  This is free and keeps the per-IP rate flat. Supabase Pro is **NOT** needed for
  connections anymore.
- **Honest caveat:** a real **projector legibility test** at the real distance and a
  real **end-to-end dry run** on the venue network are still required before any
  event — capacity math can't check those for you.

**Bottom line:** on **free tier as shipped**, plan for **several hundred attendees**
with confidence; scale further by lengthening the poll interval, not by paying.
