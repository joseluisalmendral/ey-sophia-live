# Experience v2 — Broqui co-host, broadcast UI, phone v2, /lab

Locator: odd/tasks/experience-v2.md · Engram mirror: odd/experience-v2/tasks · Branch: feat/experience-v2
Revert point: tag v1.0-event-fy27 (fa8aa5a). main stays untouched (live event 2026-09-24 19:15).

## Objective
Take the live-voting app to a premium "live TV show" experience: an animated co-host mascot (Broqui, thePower shield brought to life)
that comments with ironic, human lines on the projector (configurable interval), a polished phone flow with retention moments,
broadcast-grade projector UI, upgraded final reveal, and a /lab rehearsal route that works without Supabase.

## Specs (scratchpad, source of truth for writers)
xp/00-director-notes.md · xp/01-app-map.md · xp/05-ux-spec.md (UX/UI + mascot bible + plan) · xp/06-motion-spec.md (rig + acting + motion)
· xp/07-brand-and-case-addendum.md · xp/02,03 Mobbin insights · xp/08-lines (comedy pool, pending)

## Decisions
- Layered SVG rig animated with motion/react (crisp 4K, continuous expressions); zero animated SVG filters.
- Curated Spanish (Spain) line pool with event triggers + anon-safe flags; no live LLM at a live corporate event.
- Hold-to-confirm 650 ms on phone CTA (irreversible vote, packed room); Enter/Space confirm instantly.
- Mascot only in layout-reserved anchors with keep-out zones; absent during curtain + camera cuts.
- Phones: zero new network calls. Projector-only cached assistant config endpoint (~5 s) for the live toggle; key M = local panic toggle.
- Brand colors kept (EY yellow, navy/cosmic, thePower green); Mobbin = patterns only.

## Constraints / checks
- DO-NOT-BREAK: realtime channel/events, useLiveTally merge, cookie names, status cache headers + phone cadence, useLocalStatusFlip clock, anonymous masking upstream.
- TDD: off (no test runner; source: package.json). Checks per WP: pnpm lint, pnpm build, /lab visual pass, screenshots.
- RDD: off (default). Delivery: work-unit commits on feat/experience-v2; push branch for preview; NO merge to main (user decides).
- ~400 authored lines per task is advisory only.

## Tasks
- [x] E1 Tokens + glass (WP0) + Broqui SVG rig with 12 expressions + /lab/mascot gallery (route: delegated writer, fable — animation)
- [x] E2 /lab engine + scenarios + ScreenStage/VoteShell extraction (WP2) (route: delegated writer — 4+ files)
- [x] E3 Assistant brain (detectEvents/scheduler/resolver/lines) + MascotHost + SpeechBubble + anchors/keep-outs (WP3) (route: delegated writer, fable)
- [ ] E4 Assistant config: migration + admin form + Live Control toggle + projector endpoint (WP4) (route: delegated writer)
- [ ] E5 Phone v2: hold-to-confirm, glass cards, confirm moment, lobby retention, post-vote, personal result, phone mascot (WP5) (route: delegated writer)
- [ ] E6 Projector broadcast grammar + lobby cleanup + count-in takeover + reveal/podium polish + mascot cameo (WP6/7/9/11) (route: delegated writer, fable)
- [ ] E7 Home polish + OG share image (Codex render, optimized) (WP10) (route: delegated writer)
- [ ] E8 QA: visual QA (phone/projector/reduced motion), contract review, E2E on throwaway poll vs prod DB, perf check; fixes (route: delegated QA + reviewers)
- [ ] E9 Push branch, preview check of /lab, final report (route: inline)

## Acceptance criteria
- /lab plays full show (lobby → count-in → live → close → reveal) with projector + phones, zero Supabase requests, works on Vercel preview.
- Broqui: 12 expressions, smooth mouth morph, never overlaps keep-outs, respects U[min,max] + 6 s floor, anon mode never leaks names.
- Real /screen and /vote still work against prod DB (E2E on throwaway poll), lint + build clean, reduced motion degrades cleanly.

## Progress / evidence
- Comedy pool (scratchpad xp/08-lines.es.ts): 391 lines, tsc strict OK, validator OK (max 88 chars expanded, anonSafe lines never carry name placeholders/colour words), 26% fy27 pack. anonSafe 65% accepted (lobby/count-in/suspense cannot carry names).
- E1: e9d001a tokens+glass, dff500f Broqui rig (13 expressions incl. squeeze) + /lab/mascot; lint 0 errors, build OK, screenshots qa-e1/. Lead review: expressions approved; glass look pass requested (darker body, fading teal halo with top-right yellow-green only, cyan bloom) -> 0ceb716 done, approved (minor bloom banding noted for E8).
- E2: 1cae1d7 ScreenStage extraction, 5a132de VoteShell + pure phase.ts, 4de4a65 /lab engine + control room. Regression pixel diff 0.000% on stable captures, identical requests; /lab full show 176 requests, 0 to supabase.co / /api. Pre-existing bugs found for E6: (1) double-crown podium duplicates co-winner and drops 3rd, (2) columns x-axis labels overlap with 5 long names, (3) count-in lobby at 1080p pushes 'EN LA SALA' off-screen.
- Event poll HACK27: found CLOSED with 1 vote (opened 00:41:30 UTC, likely the owner's own phone test). Not modified; owner must press 'Relanzar' before the event.
- E3: 4f68b93 brain (detectEvents/scheduler/resolveLine/lines/selfCheck), 7199c72 MascotHost + SpeechBubble + anchors/keep-outs + RevealStage onBeatChange, 0526014 lab mascot panel; 078b2b9 fix podium bubble covering winner name (text-range keep-outs). Lab matrix final-ajustada/empate-cierre x anon on/off all ok (0 overlaps, 0 anon leaks, intervals ok, hidden during curtain/cameras); prod GET smoke /screen/H55CX ok. Note for E6: podium bubble sits far from mascot; double-crown podium bug (pre-existing).
- User override on spec: mascot must MOVE between several safe anchors per stage (not fixed) — passed to E3.

## Next step
E4 config (running) -> E5 phone -> E6 projector/reveal -> E7 home/OG -> E8 QA.
