import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  anonSeed,
  anonymousIdentity,
  applyAnonIdentity,
} from "@/components/screen/anonymize";
import { INTERVAL_DEFAULTS } from "@/lib/assistant/scheduler";
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
  anonymous_display: boolean;
  tie_rule: Poll["tieRule"];
  join_code: string;
  created_at: string;
  run_seq?: number | null;
  assistant_enabled?: boolean | null;
  assistant_min_interval_s?: number | null;
  assistant_max_interval_s?: number | null;
}

const POLL_COLUMNS =
  "id, title, status, opens_at, closes_at, duration_seconds, chart_type, show_legend, anonymous_display, tie_rule, join_code, created_at, run_seq";
/** WP4 assistant settings — selected separately so a pre-migration DB (missing
 * these columns) can fall back to {enabled:true,14,28} instead of failing. */
const ASSISTANT_COLUMNS =
  "assistant_enabled, assistant_min_interval_s, assistant_max_interval_s";

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
    anonymousDisplay: r.anonymous_display,
    runSeq: r.run_seq ?? 1,
    tieRule: r.tie_rule,
    joinCode: r.join_code,
    createdAt: r.created_at,
    assistantEnabled: r.assistant_enabled ?? true,
    assistantMinSeconds: r.assistant_min_interval_s ?? INTERVAL_DEFAULTS.min,
    assistantMaxSeconds: r.assistant_max_interval_s ?? INTERVAL_DEFAULTS.max,
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
  /** True when `teams` already carry the anonymous identities (open + anonymous). */
  teamsMasked: boolean;
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

  let { data: pollData, error: pollErr } = await supabase
    .from("polls")
    .select(`${POLL_COLUMNS}, ${ASSISTANT_COLUMNS}`)
    .eq(column, value)
    .maybeSingle<PollRow>();

  // SAFE FALLBACK: an environment whose DB has not run the E4 migration yet
  // (assistant_* columns missing) would fail the whole select — retry without
  // them and let mapPoll apply the {enabled:true,14,28} defaults instead of
  // breaking the projector.
  if (pollErr) {
    ({ data: pollData, error: pollErr } = await supabase
      .from("polls")
      .select(POLL_COLUMNS)
      .eq(column, value)
      .maybeSingle<PollRow>());
  }

  if (pollErr || !pollData) return null;

  const poll = mapPoll(pollData);

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, poll_id, name, color, position")
    .eq("poll_id", poll.id)
    // Stable configured order: the anonymous derangement is defined relative
    // to this (lobby) order, so it must be team position, never insertion.
    .order("position", { ascending: true });

  let teams: Team[] = (teamRows ?? []).map((t: TeamRow) => ({
    id: t.id,
    pollId: t.poll_id,
    name: t.name,
    color: t.color,
  }));

  // ANONYMOUS DISPLAY, server-side wall: ScreenClient props are serialized
  // into the page's RSC payload, so passing real names would leak them in the
  // HTML source even if the render masks them. Identities hide ONLY while the
  // vote is OPEN — the lobby (draft/countdown) deliberately shows the real
  // teams so the room can confirm theirs is in — so the snapshot ships
  // anonymized only for `open`, with the SAME run-seeded identities
  // ("?" + distinct palette + shuffled slots) the client computes, and
  // `teamsMasked` tells ScreenStage to reuse them as-is. The reveal never
  // needs these rows — it renders the runtime get_results data (real names),
  // fetched after the close.
  let teamsMasked = false;
  if (poll.anonymousDisplay && poll.status === "open") {
    const identity = anonymousIdentity(teams, anonSeed(poll.id, poll.runSeq ?? 1));
    teams = applyAnonIdentity(teams, identity);
    teamsMasked = true;
  }

  const origin = await resolveOrigin();
  const voterUrl = `${origin}/vote/${poll.joinCode}`;

  return { poll, teams, voterUrl, teamsMasked };
}
