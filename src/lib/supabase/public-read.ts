import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-less, RLS-bound Supabase read client for CDN-cacheable public endpoints.
 *
 * WHY A SEPARATE CLIENT (not `@/lib/supabase/server`):
 *   The `@supabase/ssr` server client wires the request cookie jar via
 *   getAll/setAll. Any response that carries a `Set-Cookie` header is treated as
 *   personalized and is NEVER cached by a shared CDN (Vercel). The voter-scale
 *   status/results endpoints MUST be CDN-cacheable so 500 phones collapse to a
 *   few origin hits, so they read Supabase through THIS plain publishable-key
 *   client which holds no session and touches no cookies.
 *
 * Auth posture: publishable key only (subject to RLS: anon SELECT on
 * polls/teams/team_tallies + the `get_results` RPC). No session persistence, no
 * auto-refresh, no cookie adapter → no Set-Cookie is ever emitted.
 */
export function createPublicReadClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A poll param may be either a UUID or a short join code (e.g. DEMO42). Returns
 * the column to filter on and the normalized value (join codes are uppercased).
 */
export function resolvePollFilter(pollParam: string): {
  column: "id" | "join_code";
  value: string;
} {
  return UUID_RE.test(pollParam)
    ? { column: "id", value: pollParam }
    : { column: "join_code", value: pollParam.toUpperCase() };
}
