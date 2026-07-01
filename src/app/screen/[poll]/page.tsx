import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadScreenData, UUID_RE } from "@/lib/screen/load";
import { ScreenClient } from "@/components/screen/ScreenClient";

/**
 * Projector surface server shell — /screen/[poll]
 *
 * The `[poll]` segment may be EITHER a poll UUID OR a short join code (e.g.
 * DEMO42), mirroring the voter shell, so both a deep link and a typed code
 * resolve. The poll+teams fetch and the voter-URL derivation live in the shared
 * loader (`@/lib/screen/load`) reused by the /tv/[slug] channel surface.
 */

/** Per-poll <title> so each projector tab is identifiable. */
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
  const title = data?.title
    ? `${data.title} · Pantalla · EY SophIA Live`
    : "Pantalla · EY SophIA Live";
  return { title };
}

export default async function ScreenPage({
  params,
}: {
  params: Promise<{ poll: string }>;
}) {
  const { poll: pollParam } = await params;

  const data = await loadScreenData(pollParam);
  if (!data) notFound();

  return (
    <ScreenClient
      poll={data.poll}
      teams={data.teams}
      voterUrl={data.voterUrl}
    />
  );
}
