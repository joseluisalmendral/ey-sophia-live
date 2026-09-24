import { NextResponse } from "next/server";
import {
  createPublicReadClient,
  resolvePollFilter,
} from "@/lib/supabase/public-read";
import { INTERVAL_DEFAULTS } from "@/lib/assistant/scheduler";

/**
 * GET /api/poll/[id]/assistant — projector-only, CDN-cacheable Broqui config.
 *
 * WHY THIS EXISTS: the admin's Live Control "Broqui en pantalla" switch (and
 * the min/max pacing set in the config form) must reach the projector WITHOUT
 * a page reload and WITHOUT adding a realtime subscription. The projector
 * (ScreenClient, via useAssistantConfig) polls THIS tiny endpoint on a slow,
 * jittered, visibility-aware cadence (~5s) — same shape as /api/channel/[slug]
 * — so the CDN collapses however many screens are on one poll to ~1 origin
 * hit per window.
 *
 * PHONES MUST NEVER CALL THIS ENDPOINT — they read `assistantEnabled` once at
 * SSR (see /vote/[poll]/page.tsx) and add no new requests.
 *
 * Contract:
 *  - { enabled, min, max, updatedAt } — min/max are the sanitized interval so
 *    a stray DB value can never violate the floor/spread rules.
 *  - Cookie-less public read client → no Set-Cookie, so the CDN may cache it.
 *  - 404 (short cache) for an unknown or malformed id/join code.
 *  - `[id]` may be a poll UUID OR a short join code (matches resolvePollFilter).
 */

export const runtime = "nodejs";

const CACHE_CONTROL = "public, s-maxage=3, stale-while-revalidate=5";

interface AssistantRow {
  assistant_enabled: boolean;
  assistant_min_interval_s: number;
  assistant_max_interval_s: number;
  assistant_updated_at: string;
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
    .select(
      "assistant_enabled, assistant_min_interval_s, assistant_max_interval_s, assistant_updated_at",
    )
    .eq(column, value)
    .maybeSingle<AssistantRow>();

  if (error || !data) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  return NextResponse.json(
    {
      enabled: data.assistant_enabled ?? true,
      min: data.assistant_min_interval_s ?? INTERVAL_DEFAULTS.min,
      max: data.assistant_max_interval_s ?? INTERVAL_DEFAULTS.max,
      updatedAt: data.assistant_updated_at,
    },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
