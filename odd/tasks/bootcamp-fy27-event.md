# Bootcamp FY27 event adaptation

Locator: odd/tasks/bootcamp-fy27-event.md · Engram mirror: odd/bootcamp-fy27-event/tasks

## Objective
Adapt EY SophIA Live for the "IA HACKATHON · #EYBOOTCAMPFY27" popular vote (Bootcamp IA FAAS, Grupo Ibercantia case) on 2026-09-24, 19:15-19:20, ~172 attendees, 3 finalists.

## Problem / why
The app still carries the previous event's "SophIA" wordmark on screen, curtain, home, vote page and tab title. The event needs its own poll, a QR for the deck slide, and the /tv/directo channel pointing at the new poll.

## Scope (authorized by user: "Marca + poll + QR")
- Rebrand SophIA wordmark to IA HACKATHON + #EYBOOTCAMPFY27, keep EY beam + thePower logo. Copy/branding only; no voting logic changes.
- Create the event poll with 3 provisional finalist teams (names edited live at ~19:00).
- QR PNG for the deck slide pointing to the vote URL.
- Repoint /tv/directo to the new poll.
- Deploy and verify in prod.

Out of scope: AI-generated imagery; pptx image extraction (deck not available locally).

## Constraints
- Copy in Spanish (Spain), matching existing app tone.
- Do not touch realtime contracts, vote pipeline, caching.
- TDD: off (no test runner in package.json; source: package.json scripts). Checks: pnpm lint, pnpm build, prod smoke.
- Delivery strategy: single-pr (small change), direct to main per repo history after preview verification.

## Tasks
- [x] T1 Rebrand wordmark and metadata (route: delegated writer — writer trigger, 11 files) — commit b837ab0; lint 0 errors, build OK, local GET shows IA HACKATHON/#EYBOOTCAMPFY27; visual check pending in T5
- [x] T2 Create event poll + 3 provisional teams in prod DB (route: delegated, DB-only, parallel with T1) — HACK27, id e1085b68-8b89-4b03-957d-f585289c1759, config mirrors H55CX, 3 tallies, draft pristine
- [x] T3 Generate optimized QR PNG for deck slide (route: delegated) — ~/Downloads/QR_votacion_IA_Hackathon.png, 2048px, level H, 3.3KB, decoded OK
- [x] T4 Repoint /tv/directo to the event poll (route: delegated) — /api/channel/directo returns new pollId (verified by parent)
- [x] T5 Deploy and verify (route: inline) — main 455033f live in ~80s; prod /, /vote/HACK27, /screen/HACK27, /tv/directo, /admin/login, /screen/H55CX = 200, /vote/NOPE = 404; branding present, no visible SophIA

## Acceptance criteria
- No visible "SophIA" string on /, /vote/<code>, /screen/<code>, /tv/directo, curtain, tab title.
- lint + build clean; prod routes 200; poll votable after open; QR scans to the vote URL.

## Progress / evidence
(pending)

## Next step
T1.
