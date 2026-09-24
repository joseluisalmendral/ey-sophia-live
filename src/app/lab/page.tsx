import type { Metadata } from "next";
import { guardLab } from "./guard";
import { one, settingsFromParams, type SearchParams } from "./params";
import { LabControlRoom } from "./LabControlRoom";

/**
 * /lab — rehearsal control room. Runs the scenario engine (virtual clock, no
 * Supabase, no network) and drives the projector + phone frames through
 * BroadcastChannel("lab"). Guarded in production (see ./guard).
 */

export const metadata: Metadata = {
  title: "Sala de ensayo · Laboratorio",
  robots: { index: false, follow: false },
};

export default async function LabPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  guardLab();
  const sp = await searchParams;
  return (
    <LabControlRoom
      initial={settingsFromParams(sp)}
      autoplay={one(sp, "autoplay") === "1"}
    />
  );
}
