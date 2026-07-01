import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Poll, PollStatus, Team } from "@/lib/types";

/**
 * Shared server-side loader for the projector experience.
 *
 * Both projector surfaces render the SAME ScreenClient island:
 *  - /screen/[poll]  — direct URL per poll (UUID or join code),
 *  - /tv/[slug]      — stable technician channel with an admin-assigned poll.
 *
 * This module owns the poll+teams fetch, the row->domain mapping and the
 * voter-URL derivation so neither route duplicates the logic.
 *
 * CRITICAL: the QR shown ON the screen must point at the VOTER url
 * (/vote/<join_code>), NEVER at the screen url. The absolute origin is built
 * from the forwarded request headers (works behind a proxy/CDN), falling back
 * to NEXT_PUBLIC_SITE_URL when configured.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PollRow {
  id: string;
  title: string;
  status: PollStatus;
  opens_at: string | null;
  closes_at: string | null;
  duration_seconds: number | null;
  chart_type: Poll["chartType"];
  show_legend: boolean;
  tie_rule: Poll["tieRule"];
  join_code: string;
  created_at: string;
}

interface TeamRow {
  id: string;
  poll_id: string;
  name: string;
  color: string;
}

function mapPoll(r: PollRow): Poll {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    durationSeconds: r.duration_seconds,
    chartType: r.chart_type,
    showLegend: r.show_legend,
    tieRule: r.tie_rule,
    joinCode: r.join_code,
    createdAt: r.created_at,
  };
}

/** Build the absolute origin from forwarded headers (proxy-aware) or env. */
export async function resolveOrigin(): Promise<string> {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Everything ScreenClient needs, resolved server-side. */
export interface ScreenData {
  poll: Poll;
  teams: Team[];
  /** Absolute VOTER url the on-screen QR encodes. */
  voterUrl: string;
}

/**
 * Resolve a poll param (UUID or join code) into the full projector snapshot.
 * Returns null when the poll does not exist (caller decides 404 vs standby).
 */
export async function loadScreenData(
  pollParam: string,
): Promise<ScreenData | null> {
  const supabase = await createClient();
  const column = UUID_RE.test(pollParam) ? "id" : "join_code";
  const value = column === "join_code" ? pollParam.toUpperCase() : pollParam;

  const { data: pollData, error: pollErr } = await supabase
    .from("polls")
    .select(
      "id, title, status, opens_at, closes_at, duration_seconds, chart_type, show_legend, tie_rule, join_code, created_at",
    )
    .eq(column, value)
    .maybeSingle<PollRow>();

  if (pollErr || !pollData) return null;

  const poll = mapPoll(pollData);

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, poll_id, name, color")
    .eq("poll_id", poll.id);

  const teams: Team[] = (teamRows ?? []).map((t: TeamRow) => ({
    id: t.id,
    pollId: t.poll_id,
    name: t.name,
    color: t.color,
  }));

  const origin = await resolveOrigin();
  const voterUrl = `${origin}/vote/${poll.joinCode}`;

  return { poll, teams, voterUrl };
}
