import { NextResponse } from "next/server";
import {
  createPublicReadClient,
  resolvePollFilter,
} from "@/lib/supabase/public-read";

/**
 * GET /api/poll/[id]/results — CDN-cacheable ranked results endpoint.
 *
 * Returns the `get_results(p_poll_id)` rows verbatim (team_id, name, color,
 * team_position, count) ordered by count desc then team_position asc, so a voter
 * can compute their team's final rank at reveal with ONE cheap request. Serves
 * the personal reveal ("tu equipo quedó #N") and is reusable for any read-only
 * results consumer.
 *
 * Cookie-less client + `public, s-maxage` → CDN-cacheable, no Set-Cookie. Same
 * abuse-safety posture as /status: even a whole room hitting close at once is a
 * few origin hits, everything else a cache hit.
 *
 * `[id]` may be a poll UUID OR a short join code (DEMO42).
 */

export const runtime = "nodejs";

const CACHE_CONTROL = "public, s-maxage=3, stale-while-revalidate=10";

interface GetResultsRow {
  team_id: string;
  name: string;
  color: string;
  team_position: number;
  count: number;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const { column, value } = resolvePollFilter(id);

  const supabase = createPublicReadClient();

  // Resolve the join code / UUID to the real poll id first, so the RPC always
  // gets a UUID and an unknown poll returns a clean 404.
  const { data: poll, error: pollErr } = await supabase
    .from("polls")
    .select("id")
    .eq(column, value)
    .maybeSingle<{ id: string }>();

  if (pollErr || !poll) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  const { data, error } = await supabase.rpc("get_results", {
    p_poll_id: poll.id,
  });

  if (error) {
    // Never surface a hard error to the polling voter path; an empty, cacheable
    // result degrades gracefully to the neutral "watch the big screen" state.
    return NextResponse.json(
      { teams: [] },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  const rows = (Array.isArray(data) ? (data as GetResultsRow[]) : [])
    .slice()
    .sort((a, b) => b.count - a.count || a.team_position - b.team_position);

  return NextResponse.json(
    { teams: rows },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
