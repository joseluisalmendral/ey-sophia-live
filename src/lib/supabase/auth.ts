import { createClient } from "./server";

/**
 * Admin authorization helpers.
 *
 * Authz is driven by verified JWT claims via `getClaims()` (local WebCrypto
 * verification of an asymmetric JWT — no network round-trip), NOT getUser() or
 * getSession(). The email in the verified claims is checked against the
 * `admins` allowlist. The real allowlist check is enforced in the DB by the
 * `is_admin()` SQL helper + RLS; this server-side gate is the UI/route guard.
 *
 * STUB: the allowlist query is wired to the future `admins` table. Until that
 * table and its RLS exist, `isAdmin()` returns false unless ADMIN_ALLOWLIST is
 * provided as a comma-separated env fallback (dev convenience only).
 */

export interface Claims {
  email: string | null;
  sub: string | null;
}

/** Read verified JWT claims for the current request, or null if unauthenticated. */
export async function getClaims(): Promise<Claims | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) return null;

  const claims = data.claims as Record<string, unknown>;
  return {
    email: typeof claims.email === "string" ? claims.email : null,
    sub: typeof claims.sub === "string" ? claims.sub : null,
  };
}

/**
 * Whether the current request belongs to an allowlisted admin.
 *
 * Checks the verified email against the `admins` table. Falls back to the
 * ADMIN_ALLOWLIST env var (dev only) when the table is not yet provisioned.
 */
export async function isAdmin(): Promise<boolean> {
  const claims = await getClaims();
  if (!claims?.email) return false;

  const email = claims.email.toLowerCase();

  // Dev fallback before the `admins` table + RLS exist.
  const envAllowlist = (process.env.ADMIN_ALLOWLIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (envAllowlist.includes(email)) return true;

  // Real check (no-op until the `admins` table is created in a later phase).
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("admins")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}
