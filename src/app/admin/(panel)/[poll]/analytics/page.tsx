import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  AnalyticsData,
  JoinCurve,
} from "@/components/admin/AnalyticsDashboard";
import { AnalyticsView } from "@/components/admin/AnalyticsView";
import { listRuns } from "../../poll-data";

/**
 * Analytics — /admin/[poll]/analytics
 *
 * Per-launch analytics. The CURRENT run comes from the live is_admin()-gated
 * RPCs (get_poll_analytics + get_lobby_join_curve); archived runs come from
 * the analytics snapshot relaunch_poll froze into poll_runs.analytics. All
 * documents are aggregates only — no PII, no raw votes, no aliases.
 */

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ poll: string }>;
}) {
  const { poll: pollId } = await params;
  const supabase = await createClient();

  const [analyticsRes, joinsRes, seqRes, runs] = await Promise.all([
    supabase.rpc("get_poll_analytics", { p_poll_id: pollId }),
    supabase.rpc("get_lobby_join_curve", { p_poll_id: pollId }),
    supabase
      .from("polls")
      .select("run_seq")
      .eq("id", pollId)
      .maybeSingle<{ run_seq: number }>(),
    listRuns(pollId),
  ]);

  if (analyticsRes.error || !analyticsRes.data) {
    // not_authorized is already prevented by the layout; a missing poll 404s.
    notFound();
  }

  const analytics = analyticsRes.data as AnalyticsData;
  const liveJoins = (joinsRes.data as JoinCurve | null) ?? null;
  const currentSeq = seqRes.data?.run_seq ?? 1;

  return (
    <div>
      <div className="mb-5">
        <Link
          href={`/admin/${pollId}`}
          className="text-small text-text-dim hover:text-text"
        >
          ← Volver a la votación
        </Link>
        <h1 className="mt-2 font-display text-h1 font-extrabold text-text">
          Analíticas
        </h1>
        <p className="mt-1 text-small text-text-dim">{analytics.title}</p>
      </div>
      <AnalyticsView
        live={analytics}
        liveJoins={liveJoins}
        currentSeq={currentSeq}
        runs={runs}
      />
    </div>
  );
}
