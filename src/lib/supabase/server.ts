import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase client (Server Components, Route Handlers, Server Actions).
 *
 * Uses the @supabase/ssr getAll/setAll cookie pattern. The publishable key is
 * used for normal request-scoped, RLS-bound access. For privileged server-only
 * operations that must bypass RLS, use `createSecretClient()` below with the
 * SECRET key — never in code that reaches the browser.
 *
 * IMPORTANT: when this client refreshes the session and writes cookies, the
 * caller must ensure the response is NOT cached across users. Middleware sets a
 * private Cache-Control; for Route Handlers that call setAll, also send
 * `Cache-Control: private, no-store` to avoid leaking a session via the CDN.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `setAll` was called from a Server Component (read-only cookies).
          // This is safe to ignore when middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Privileged server-only client using the SECRET key (bypasses RLS).
 *
 * Use ONLY in trusted server contexts (e.g. the vote insert path, admin close,
 * token issuance, cron keep-alive). The SECRET key must never be NEXT_PUBLIC_.
 * This client does not persist auth cookies.
 */
export function createSecretClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  return createServerClient(url, secretKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // No-op: the secret client is stateless and must not touch user cookies.
      },
    },
  });
}
