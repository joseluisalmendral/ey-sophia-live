/**
 * Resolve the canonical site origin. Prefers NEXT_PUBLIC_SITE_URL (set
 * per-environment), stripped of any trailing slash; falls back to the current
 * origin in the browser and to localhost on the server during dev.
 *
 * Single source of truth: both the admin link builders and the magic-link login
 * redirect import this instead of keeping their own copies.
 */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}
