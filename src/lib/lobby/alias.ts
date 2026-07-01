/**
 * Anonymous voter alias for the lobby presence feed.
 *
 * Voters are anonymous (no signup), but the projector lobby feels far more
 * alive when each join shows up as a *named* chip instead of a bare counter.
 * Aliases follow the event's cosmic art direction — star/constellation names
 * plus a short number ("Vega 12", "Altair 3") — professional and on-brand,
 * never childish, and safe to project on a corporate stage.
 *
 * The alias is generated client-side once per browser session and persisted in
 * sessionStorage so a reload keeps the same identity (and the presence feed on
 * the big screen doesn't show phantom "new" joins for the same phone).
 */

const STAR_NAMES = [
  "Vega",
  "Altair",
  "Sirio",
  "Polaris",
  "Orión",
  "Lyra",
  "Andrómeda",
  "Rigel",
  "Antares",
  "Cassiopeia",
  "Deneb",
  "Atlas",
  "Nova",
  "Aquila",
  "Perseo",
  "Fénix",
] as const;

const STORAGE_KEY = "sophia-lobby-alias";

/** Generate a fresh alias, e.g. "Vega 12". */
export function generateAlias(): string {
  const name = STAR_NAMES[Math.floor(Math.random() * STAR_NAMES.length)];
  const num = Math.floor(Math.random() * 98) + 1; // 1..99, short enough for a chip
  return `${name} ${num}`;
}

/**
 * Get the session-stable alias for this browser, generating and persisting it
 * on first use. Falls back to a non-persisted alias when sessionStorage is
 * unavailable (private mode edge cases) — presence still works, it just won't
 * survive a reload.
 */
export function getSessionAlias(): string {
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const alias = generateAlias();
    window.sessionStorage.setItem(STORAGE_KEY, alias);
    return alias;
  } catch {
    return generateAlias();
  }
}
