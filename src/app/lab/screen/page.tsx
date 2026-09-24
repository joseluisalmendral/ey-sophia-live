import type { Metadata } from "next";
import { guardLab } from "../guard";
import { one, settingsFromParams, type SearchParams } from "../params";
import { LabScreen } from "./LabScreen";

/**
 * /lab/screen — the projector frame of the rehearsal lab. Follows the control
 * room over BroadcastChannel("lab"); open it fullscreen on a real projector
 * (same browser) and drive the show from the laptop. `?drive=1` runs a local
 * engine instead (standalone QA / no control room).
 */

export const metadata: Metadata = {
  title: "Proyector · Laboratorio",
  robots: { index: false, follow: false },
};

export default async function LabScreenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  guardLab();
  const sp = await searchParams;
  const drive = one(sp, "drive") === "1" ? settingsFromParams(sp) : null;
  return (
    <LabScreen
      drive={drive}
      autoplay={one(sp, "autoplay") === "1"}
      mascotCrash={one(sp, "mascotCrash") === "1"}
    />
  );
}
