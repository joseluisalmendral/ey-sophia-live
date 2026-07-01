import { NextResponse } from "next/server";
import {
  createPublicReadClient,
  resolvePollFilter,
} from "@/lib/supabase/public-read";
import type { PollStatus } from "@/lib/types";

/**
 * GET /api/poll/[id]/status — CDN-cacheable poll lifecycle endpoint.
 *
 * WHY THIS EXISTS (voter scale, off the WS ceiling):
 *   Voters must never open a realtime WebSocket (that would count against
 *   Supabase's 200 concurrent-connection cap). Instead every voter phone polls
 *   THIS endpoint on a slow, jittered, visibility-aware cadence. The response is
 *   marked `public, s-maxage` so Vercel's CDN serves ~1 origin hit per 3s no
 *   matter how many phones poll — 500 phones collapse to a handful of origin
 *   req/sec, all cache hits otherwise.
 *
 * Contract:
 *  - Returns ONLY { status, opensAt, closesAt } — no vote counts (results live
 *    at the sibling /results endpoint). Counts must not sit behind a lifecycle
 *    poll.
 *  - Cookie-less client → NO Set-Cookie, so the CDN is allowed to cache it.
 *  - 404 for an unknown poll (UUID or join code).
 *
 * `[id]` may be a poll UUID OR a short join code (DEMO42), matching /vote/[poll].
 */

export const runtime = "nodejs";

// ~1 origin hit / 3s across the whole room; stale served up to 10s while
// revalidating so a burst never stampedes the origin.
const CACHE_CONTROL = "public, s-maxage=3, stale-while-revalidate=10";

interface StatusRow {
  status: PollStatus;
  opens_at: string | null;
  closes_at: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const { column, value } = resolvePollFilter(id);

  const supabase = createPublicReadClient();
  const { data, error } = await supabase
    .from("polls")
    .select("status, opens_at, closes_at")
    .eq(column, value)
    .maybeSingle<StatusRow>();

  if (error || !data) {
    // Do not cache a 404 aggressively: an unknown poll may be created moments
    // later (draft → shared link). A short shared cache is fine.
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  return NextResponse.json(
    {
      status: data.status,
      opensAt: data.opens_at,
      closesAt: data.closes_at,
    },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
