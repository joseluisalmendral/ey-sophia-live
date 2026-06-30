import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase session on every matched request.
 *
 * Follows the @supabase/ssr SSR pattern: build a response, mirror cookie writes
 * onto BOTH the request (so downstream server code sees the fresh session) and
 * the response (so the browser stores it). Calling `getClaims()` triggers the
 * token refresh when needed.
 *
 * The response carries `Cache-Control: private, no-store` so a refreshed
 * session is never cached and served to another user via a shared CDN.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If env is not configured (e.g. local build with placeholders), pass through.
  if (!url || !publishableKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: refresh the session. Do not run code between client creation and
  // this call, and use getClaims() (local verify) rather than getUser/getSession.
  await supabase.auth.getClaims();

  // Never cache a response that may carry a refreshed session cookie.
  supabaseResponse.headers.set("Cache-Control", "private, no-store");

  return supabaseResponse;
}
