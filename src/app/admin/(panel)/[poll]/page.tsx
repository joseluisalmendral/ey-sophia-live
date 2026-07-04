import { notFound } from "next/navigation";
import { getChannel, getPoll, getTeams, listRuns } from "../poll-data";
import { PollWorkspace } from "@/components/admin/PollWorkspace";
import type { PollConfigInitial } from "@/components/admin/PollConfigForm";

/**
 * Poll configure + live control — /admin/[poll]
 *
 * Server shell: loads the poll + teams (RLS allows admin reads), then hands a
 * serializable snapshot to the tabbed PollWorkspace client island. ?tab=live
 * deep-links straight to the live cockpit.
 */

export const dynamic = "force-dynamic";

export default async function PollWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ poll: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { poll: pollId } = await params;
  const { tab } = await searchParams;

  const poll = await getPoll(pollId);
  if (!poll) notFound();

  const [teams, runs, channel] = await Promise.all([
    getTeams(pollId),
    listRuns(pollId),
    getChannel("directo"),
  ]);

  const configInitial: PollConfigInitial = {
    id: poll.id,
    title: poll.title,
    joinCode: poll.joinCode,
    countdownSeconds: poll.countdownSeconds,
    durationSeconds: poll.durationSeconds,
    chartType: poll.chartType,
    showLegend: poll.showLegend,
    showNames: poll.showNames,
    anonymousDisplay: poll.anonymousDisplay,
    tieRule: poll.tieRule,
    teams: teams.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    // Teams + code are locked once a poll leaves draft (avoid altering a live event).
    locked: poll.status !== "draft",
  };

  return (
    <PollWorkspace
      pollId={poll.id}
      title={poll.title}
      status={poll.status}
      joinCode={poll.joinCode}
      hasCountdown={poll.countdownSeconds != null && poll.countdownSeconds > 0}
      configInitial={configInitial}
      runs={runs}
      channel={
        channel ? { slug: channel.slug, pollId: channel.pollId } : null
      }
      initialTab={
        tab === "live" ? "live" : tab === "history" ? "history" : "config"
      }
    />
  );
}
