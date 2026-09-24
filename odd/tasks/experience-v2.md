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
- [x] E4 Assistant config: migration + admin form + Live Control toggle + projector endpoint (WP4) (route: delegated writer)
- [x] E5 Phone v2: hold-to-confirm, glass cards, confirm moment, lobby retention, post-vote, personal result, phone mascot (WP5) (route: delegated writer)
- [ ] E6 Projector broadcast grammar + lobby cleanup + count-in takeover + reveal/podium polish + mascot cameo (WP6/7/9/11) (route: delegated writer, fable)
- [x] E7 Home polish + OG share image (Codex render, optimized) (WP10) (route: delegated writer, done with E5)
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
- E4: bdf8786 db (migration 20260924120000_assistant.sql applied to prod via `supabase db query --linked`, recorded in supabase_migrations.schema_migrations; polls.assistant_{enabled,min_interval_s,max_interval_s,updated_at} + spread check + touch trigger; Poll type + load.ts/vote page.tsx safe-fallback select + poll-data.ts), 5f51620 admin (PollConfigForm fieldset reusing scheduler.ts validateInterval, poll-actions.ts createPoll/updatePoll validation + new setAssistantEnabled action, LiveControlPanel optimistic switch), acb4137 screen (GET /api/poll/[id]/assistant mirroring /api/channel/[slug], s-maxage=3/swr=5; useAssistantConfig hook ~5s ±30% jitter/pause-when-hidden mounted only in ScreenClient). Checks: `pnpm lint` 0 errors, `pnpm build` success. E2E on throwaway poll "ZZ-E4 test" (id 0e56e793-0748-420b-b3fb-b47bc8afef86, code CXNUN) against prod DB via `pnpm start -p 3126` + Playwright: invalid interval 3/6 -> Spanish error + disabled save; valid 8/12 saved and persisted after reload; Live Control toggle OFF -> GET endpoint enabled:false + correct Cache-Control -> projector screenshot confirms mascot hidden within ~9.5s -> toggled back ON -> mascot reappears. Poll + teams/team_tallies/votes/lobby_joins/poll_runs deleted after, verified zero residue; HACK27 (closed, run_seq 1, 130 votes on H55CX / 1 vote on HACK27) unchanged before/after. Evidence: scratchpad/qa-e4/{01..06}*.png, result.json, migration-verify.json, existing-rows.json, protected-before.json, protected-after.json, post-delete-verify.json. Servers killed.

- E5+E7: c951ba4 mascot (PhoneMascot host row + PhoneSpeechBubble + local phone_* scheduler, poke, rank poses; no network, no timers while hidden, life layer paused off-screen; Broqui mouth ry clamp fixes negative-radius console errors), a63a11a vote (compact header, glass cards w/ spine + spring selection, HoldConfirmButton 650 ms w/ drain+hint+wiggle, haptic [18,40,18], detail==0 click = Enter/Space/AT instant confirm, stepped fill in reduced motion; LobbyView countdown hero + finalists + Cómo va; ConfirmView orb burst -> look-up wait; AlreadyVoted/Closed glyph views; RevealView 600 ms delay + gold/silver/bronze + ranked list from the same one-shot /results fetch via new `ranking` (denseRanking in phase.ts); confetti palette team+yellow+white; mascot follows poll.assistantEnabled; submit fetch/cookies untouched), ea5f86a home (glass join card, Broqui cameo, valid/invalid CTA, admin link in footer) + static OG/Twitter JPG 1200x630 74 KB via file convention + metadataBase/openGraph/twitter.
  Checks: `pnpm lint` 0 errors; `pnpm build` success (one transient Turbopack next/font fetch failure, passed on retry). /lab (speed 2, final-ajustada) phones ana@390, ana@360, luis@360 (manual hold), marta, pablo: every phase captured, 0 supabase.co requests, 0 /api requests, 0 horizontal scroll at 360, no console errors; hold 300 ms -> no submit + hint, 700 ms -> submitting -> confirm; reduced-motion pass identical checks. Video ~33 s (qa-e5/video/e5-phone-flow.webm). Real app (pnpm start -p 3127) on throwaway poll ZZ-E5 (ZZE5Q, id 9f9e852f…): lobby -> SQL open -> cards in 1.8 s -> short press 0 POSTs -> hold 1 POST -> confirm -> second tab/reload "Ya votaste" -> SQL close -> personal result #1 in 16.5 s; API endpoints used only status/join/vote/results; cookies join_/vt_/voted_ unchanged; throwaway deleted, zero residue in polls/teams/team_tallies/votes/lobby_joins/poll_runs; HACK27 + H55CX identical before/after. Evidence: scratchpad qa-e5/{lab,lab-reduced,home,video,e2e,og}.
  Notes: the Homebrew supabase CLI binary has an invalid code signature (killed, exit 137); `npx supabase db query --linked` works. Local og:image URL falls back to localhost:3000 without NEXT_PUBLIC_SITE_URL; on Vercel VERCEL_PROJECT_PRODUCTION_URL is used.

- E6a (projector broadcast grammar, route: delegated writer): 08054f3 lobby v2 + count-in takeover (QR glass frame w/ yellow viewfinder corners, white "Escanea para unirte", host + big yellow code badge, VOTACIÓN FINAL + balanced 2-line title, mint presence w/ ping per join, glass finalist rows w/o counters/numbering, anonymous = one masked card + grey silhouettes, reserved co-host strip; last-5 s ring takeover from two rotating half-rings), 1ee9a69 broadcast (LiveBug states incl. reconnecting, EY-beam stinger lobby→live w/ "¡YA!" and live→reveal, lower third on open entry over the rail foot, anonymous glass pill, rail labels at the type floor, BarRace medals/flat glass tracks/scaleX + honest springs, projector root font scales with the 16:9 frame above 1080p for 4K), 4fbe780 fixes. Pre-existing bugs, root causes: (a) count-in stacked on top of the QR column -> presence pushed below the fold; now the count-in lives in the right column. (b) columns axis label width fixed at fs(240) > category slot with 5 teams -> width-aware wrap per slot. (c) Podium rendered `second` as the left block AND inside SharedCenter, and hid `third` on double crown; names were truncate-in-content-width spans (overflowed) -> co-winners once each + 3rd on the right, names wrap in capped columns (longest word fits).
  Checks: `pnpm lint` 0 errors; `pnpm build` success. /lab matrix (3 scenarios × bar_race/columns/donut × anon on/off, 1920 and 3840): 0 overlaps, 0 console errors, 0 supabase requests, no scroll (scratchpad qa-e6a/final + sheets); E3 e3-lab re-run x8 all ok (qa-e6a/e3, e3-final.log); flip videos normal/reduced (qa-e6a/video-prod); prod GET smoke /screen/H55CX + /tv/directo 200, 0 errors, only read-only get_results RPC (qa-e6a/prod). Remaining E6 scope: WP9 podium polish, WP11 mascot podium dance, WP8 presence dot field (skipped).

## Next step
E6 projector/reveal -> E8 QA.
