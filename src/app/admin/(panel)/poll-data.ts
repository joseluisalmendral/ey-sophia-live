import { createClient } from "@/lib/supabase/server";
import type { ChartType, PollStatus, Team, TieRule } from "@/lib/types";

/**
 * Server-side admin data access. The admin reads through the authenticated SSR
 * client; polls/teams are publicly readable, admins-only data is RLS-gated.
 *
 * The polls table carries extra admin-only columns beyond the public `Poll`
 * type (countdown_seconds, show_names, created_by), so admin pages use this
 * richer `AdminPoll` shape.
 */

export interface AdminPoll {
  id: string;
  title: string;
  status: PollStatus;
  countdownSeconds: number | null;
  durationSeconds: number | null;
  opensAt: string | null;
  closesAt: string | null;
  chartType: ChartType;
  showLegend: boolean;
  showNames: boolean;
  tieRule: TieRule;
  joinCode: string;
  createdAt: string;
}

interface AdminPollRow {
  id: string;
  title: string;
  status: PollStatus;
  countdown_seconds: number | null;
  duration_seconds: number | null;
  opens_at: string | null;
  closes_at: string | null;
  chart_type: ChartType;
  show_legend: boolean;
  show_names: boolean;
  tie_rule: TieRule;
  join_code: string;
  created_at: string;
}

const POLL_COLUMNS =
  "id, title, status, countdown_seconds, duration_seconds, opens_at, closes_at, chart_type, show_legend, show_names, tie_rule, join_code, created_at";

function mapPoll(r: AdminPollRow): AdminPoll {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    countdownSeconds: r.countdown_seconds,
    durationSeconds: r.duration_seconds,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    chartType: r.chart_type,
    showLegend: r.show_legend,
    showNames: r.show_names,
    tieRule: r.tie_rule,
    joinCode: r.join_code,
    createdAt: r.created_at,
  };
}

export async function listPolls(): Promise<AdminPoll[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polls")
    .select(POLL_COLUMNS)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => mapPoll(r as AdminPollRow));
}

export async function getPoll(pollId: string): Promise<AdminPoll | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polls")
    .select(POLL_COLUMNS)
    .eq("id", pollId)
    .maybeSingle<AdminPollRow>();
  return data ? mapPoll(data) : null;
}

export async function getTeams(pollId: string): Promise<Team[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, poll_id, name, color, position")
    .eq("poll_id", pollId)
    .order("position", { ascending: true });
  return (data ?? []).map(
    (t: { id: string; poll_id: string; name: string; color: string }) => ({
      id: t.id,
      pollId: t.poll_id,
      name: t.name,
      color: t.color,
    }),
  );
}

export async function listAdmins(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admins")
    .select("email")
    .order("email", { ascending: true });
  return (data ?? []).map((a: { email: string }) => a.email);
}
