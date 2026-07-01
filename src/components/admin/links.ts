/**
 * URL helpers for the voter and projector surfaces. The origin resolves via the
 * shared `siteUrl()` helper (NEXT_PUBLIC_SITE_URL, else browser origin, else
 * localhost).
 */
import { siteUrl } from "@/lib/utils/siteUrl";

/** Voter join URL by join code (works for /vote/[poll] which accepts a code). */
export function voteUrl(joinCode: string): string {
  return `${siteUrl()}/vote/${joinCode}`;
}

/** Projector URL by join code (the /screen/[poll] route accepts a code too). */
export function screenUrl(joinCode: string): string {
  return `${siteUrl()}/screen/${joinCode}`;
}

/** Stable technician-channel URL (/tv/[slug]); the admin assigns the poll. */
export function tvUrl(slug: string): string {
  return `${siteUrl()}/tv/${slug}`;
}
