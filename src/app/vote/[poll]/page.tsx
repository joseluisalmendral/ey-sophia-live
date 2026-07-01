import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Poll, PollStatus, Team } from "@/lib/types";
import { VoteClient } from "./VoteClient";

/**
 * Voter surface server shell — /vote/[poll]
 *
 * The `[poll]` segment may be EITHER a poll UUID OR a short join code (e.g.
 * DEMO42), so a scanned QR link and a typed code both resolve. We load the poll
 * + its teams server-side (RLS allows anon SELECT on polls/teams), then hand a
 * plain serializable snapshot to the client island.
 *
 * Not-found (bad id/code) renders Next's notFound() so the voter gets a clean
 * 404 instead of a runtime error.
 */

const UUID_RE =
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
  run_seq: number;
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

/** Per-poll <title> so a shared vote link reads as the specific poll. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ poll: string }>;
}): Promise<Metadata> {
  const { poll: pollParam } = await params;
  const supabase = await createClient();
  const column = UUID_RE.test(pollParam) ? "id" : "join_code";
  const value = column === "join_code" ? pollParam.toUpperCase() : pollParam;
  const { data } = await supabase
    .from("polls")
    .select("title")
    .eq(column, value)
    .maybeSingle<{ title: string }>();
  const title = data?.title ? `Votar · ${data.title}` : "Votar · EY SophIA Live";
  return { title };
}

export default async function VotePage({
  params,
}: {
  params: Promise<{ poll: string }>;
}) {
  const { poll: pollParam } = await params;
  const supabase = await createClient();

  // Resolve by UUID or by (case-insensitive) join_code.
  const column = UUID_RE.test(pollParam) ? "id" : "join_code";
  const value = column === "join_code" ? pollParam.toUpperCase() : pollParam;

  const { data: pollData, error: pollErr } = await supabase
    .from("polls")
    .select(
      "id, title, status, opens_at, closes_at, duration_seconds, chart_type, show_legend, tie_rule, join_code, created_at, run_seq",
    )
    .eq(column, value)
    .maybeSingle<PollRow>();

  if (pollErr || !pollData) {
    notFound();
  }

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

  // Readable /vote-scoped marker set by /api/vote after a successful vote. If
  // present, seed the client so a reload shows the neutral "Ya votaste" view
  // (or the neutral closed view when the poll is closed) instead of the cards.
  // Neutral only: this marker carries NO team, so we never claim a specific vote.
  // Run-scoped (voted_<id>_r<seq>): after a relaunch the poll's run_seq bumps,
  // old markers stop matching, and every device can vote again immediately.
  const cookieStore = await cookies();
  const alreadyVotedOnReload =
    cookieStore.get(`voted_${poll.id}_r${pollData.run_seq}`)?.value === "1";

  return (
    <VoteClient
      poll={poll}
      teams={teams}
      alreadyVotedOnReload={alreadyVotedOnReload}
    />
  );
}
