import { NextResponse } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/public-read";

/**
 * GET /api/channel/[slug] — CDN-cacheable channel-assignment endpoint.
 *
 * The /tv/[slug] projector polls THIS tiny endpoint (~5s, jittered, paused when
 * hidden — see ChannelRefresher) to detect when the admin re-assigns the
 * channel, then refreshes itself. The response is `public, s-maxage=3` so even
 * multiple screens on one channel collapse to ~1 origin hit per window.
 *
 * Contract:
 *  - { pollId: string | null, updatedAt: string } — the minimal change
 *    fingerprint. No poll payload here; the page re-fetches on refresh.
 *  - Cookie-less read client → no Set-Cookie, so the CDN may cache it.
 *  - 404 for an unknown or malformed slug.
 */

export const runtime = "nodejs";

const CACHE_CONTROL = "public, s-maxage=3, stale-while-revalidate=10";

/** Matches the DB CHECK on screen_channels.slug (lowercase kebab-case). */
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

interface ChannelRow {
  poll_id: string | null;
  updated_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase();

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  const supabase = createPublicReadClient();
  const { data, error } = await supabase
    .from("screen_channels")
    .select("poll_id, updated_at")
    .eq("slug", slug)
    .maybeSingle<ChannelRow>();

  if (error || !data) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  return NextResponse.json(
    { pollId: data.poll_id, updatedAt: data.updated_at },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
