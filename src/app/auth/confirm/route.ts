import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/confirm — magic-link callback.
 *
 * supabase-js v2 magic links arrive in one of two shapes depending on the
 * project's flow:
 *   1. token_hash + type  -> verifyOtp({ token_hash, type })
 *   2. code               -> exchangeCodeForSession(code)  (PKCE)
 * We support BOTH so the link works regardless of the configured flow.
 *
 * On success we establish the session (cookies are written by the SSR client)
 * and redirect to `next` (default /admin). The allowlist is NOT checked here —
 * that happens in the admin layout and at the DB (is_admin()): an authenticated
 * but non-allowlisted user still lands and is shown a clear "No autorizado"
 * screen rather than a confusing auth error.
 *
 * Always responds private/no-store: this response carries a Set-Cookie session
 * and must never be cached by a shared CDN across users.
 */

export const dynamic = "force-dynamic";

function safeNext(raw: string | null): string {
  // Only allow same-origin relative paths to avoid open-redirect.
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/admin";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  let ok = false;
  let errorMessage = "auth_failed";

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    ok = !error;
    if (error) errorMessage = error.message;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) errorMessage = error.message;
  } else {
    errorMessage = "missing_token";
  }

  const dest = ok
    ? new URL(next, origin)
    : new URL(`/admin/login?error=${encodeURIComponent(errorMessage)}`, origin);

  const res = NextResponse.redirect(dest);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
