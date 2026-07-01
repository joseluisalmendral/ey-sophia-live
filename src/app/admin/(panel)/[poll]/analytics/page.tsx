import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AnalyticsDashboard,
  type AnalyticsData,
} from "@/components/admin/AnalyticsDashboard";

/**
 * Analytics — /admin/[poll]/analytics
 *
 * Calls the is_admin()-gated, SECURITY DEFINER RPC get_poll_analytics, which
 * returns ONLY aggregates (no PII, no raw votes). Renders headline stats +
 * ECharts (votes-over-time + per-team). Friendly for reviewing past polls.
 */

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ poll: string }>;
}) {
  const { poll: pollId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_poll_analytics", {
    p_poll_id: pollId,
  });

  if (error || !data) {
    // not_authorized is already prevented by the layout; a missing poll 404s.
    notFound();
  }

  const analytics = data as AnalyticsData;

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
      <AnalyticsDashboard data={analytics} />
    </div>
  );
}
