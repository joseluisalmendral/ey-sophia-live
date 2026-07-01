/**
 * URL helpers for the voter and projector surfaces. SITE_URL resolves from
 * NEXT_PUBLIC_SITE_URL (set per-environment), falling back to the current
 * origin in the browser and localhost on the server during dev.
 */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** Voter join URL by join code (works for /vote/[poll] which accepts a code). */
export function voteUrl(joinCode: string): string {
  return `${siteUrl()}/vote/${joinCode}`;
}

/** Projector URL by join code (the /screen/[poll] route accepts a code too). */
export function screenUrl(joinCode: string): string {
  return `${siteUrl()}/screen/${joinCode}`;
}
