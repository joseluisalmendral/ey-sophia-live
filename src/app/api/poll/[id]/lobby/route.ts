import { NextResponse } from "next/server";
import {
  createPublicReadClient,
  resolvePollFilter,
} from "@/lib/supabase/public-read";

/**
 * GET /api/poll/[id]/lobby — CDN-cacheable lobby join feed for the projector.
 *
 * Shape: { count, latest: [{ alias }...] } — current-run joins only (the
 * `get_lobby_joins` RPC filters by polls.run_seq, so a relaunch resets the
 * feed with no cleanup job). The screen polls this every ~2.2s.
 *
 * Success responses are `no-store`: the only consumer is a handful of
 * projector screens polling on a slow cadence, so the origin cost is
 * negligible and every poll tick sees a fresh count — a CDN window here
 * (formerly s-maxage=2 + swr=5) added up to ~7s of staleness on top of the
 * polling cadence for zero meaningful savings. The 404 branch (bad/unknown
 * id) keeps a short public cache to absorb junk-URL traffic.
 *
 * `[id]` may be a poll UUID OR a short join code, matching /screen/[poll].
 */

export const runtime = "nodejs";

const CACHE_CONTROL = "no-store";
const NOT_FOUND_CACHE_CONTROL = "public, s-maxage=2, stale-while-revalidate=5";

/** Most recent aliases surfaced to the feed (the counter uses the full count). */
const LATEST_SIZE = 12;

interface JoinRow {
  alias: string;
  joined_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const { column, value } = resolvePollFilter(id);

  const supabase = createPublicReadClient();
  const { data: poll } = await supabase
    .from("polls")
    .select("id")
    .eq(column, value)
    .maybeSingle<{ id: string }>();

  if (!poll) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": NOT_FOUND_CACHE_CONTROL } },
    );
  }

  const { data, error } = await supabase.rpc("get_lobby_joins", {
    p_poll_id: poll.id,
  });

  if (error) {
    return NextResponse.json(
      { error: "unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = (data ?? []) as JoinRow[];
  return NextResponse.json(
    {
      count: rows.length,
      latest: rows.slice(0, LATEST_SIZE).map((r) => ({ alias: r.alias })),
    },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
