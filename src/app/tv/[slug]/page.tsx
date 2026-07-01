import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadScreenData } from "@/lib/screen/load";
import { ScreenClient } from "@/components/screen/ScreenClient";
import { ChannelStandby } from "@/components/screen/ChannelStandby";
import { ChannelRefresher } from "@/components/screen/ChannelRefresher";

/**
 * Technician channel — /tv/[slug]
 *
 * The STABLE projector URL handed to the room technician before the workshop.
 * They open it once and never touch it again: the admin assigns whichever poll
 * is up next to the channel from the panel, and this page switches by itself.
 *
 * Server shell: resolves slug -> screen_channels row (anon SELECT via RLS).
 *  - unknown slug           -> 404
 *  - no poll assigned       -> premium standby board (ChannelStandby)
 *  - poll assigned          -> the EXACT same projector experience as
 *                              /screen/<code> (shared loader + ScreenClient)
 *
 * ChannelRefresher (client, renders nothing) polls the tiny CDN-cached
 * GET /api/channel/[slug] and calls router.refresh() when the assignment
 * changes, so the switch needs no manual reload. ScreenClient is keyed by poll
 * id so a re-assignment fully remounts the board (fresh realtime subscription).
 */

export const dynamic = "force-dynamic";

/** Matches the DB CHECK on screen_channels.slug (lowercase kebab-case). */
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

interface ChannelRow {
  slug: string;
  poll_id: string | null;
  updated_at: string;
}

async function loadChannel(rawSlug: string): Promise<ChannelRow | null> {
  const slug = rawSlug.toLowerCase();
  if (!SLUG_RE.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("screen_channels")
    .select("slug, poll_id, updated_at")
    .eq("slug", slug)
    .maybeSingle<ChannelRow>();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Canal ${slug.toLowerCase()} · Pantalla · EY SophIA Live` };
}

export default async function TvChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const channel = await loadChannel(rawSlug);
  if (!channel) notFound();

  // A dangling assignment cannot really happen (FK ON DELETE SET NULL), but if
  // the poll vanished between reads the channel degrades to standby, never 500.
  const data = channel.poll_id ? await loadScreenData(channel.poll_id) : null;

  return (
    <>
      <ChannelRefresher
        slug={channel.slug}
        pollId={data ? data.poll.id : null}
        updatedAt={channel.updated_at}
      />
      {data ? (
        <ScreenClient
          key={data.poll.id}
          poll={data.poll}
          teams={data.teams}
          voterUrl={data.voterUrl}
        />
      ) : (
        <ChannelStandby slug={channel.slug} />
      )}
    </>
  );
}
