import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * Used by client components for realtime subscriptions (private channel
 * `poll:<id>`) and reading public aggregates (polls, teams, team_tallies).
 *
 * Uses the NEW key scheme: the PUBLISHABLE key (safe for the browser, subject to
 * RLS). The SECRET key must NEVER be exposed here.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return createBrowserClient(url, publishableKey);
}
