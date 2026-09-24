import type { Metadata } from "next";
import { isPersonaId } from "@/lab/personas";
import { guardLab } from "../guard";
import { one, settingsFromParams, type SearchParams } from "../params";
import { LabPhone } from "./LabPhone";

/**
 * /lab/phone?persona=ana|luis|marta|pablo — one scripted voter phone. Follows
 * the control room over BroadcastChannel("lab"); taps override the persona
 * locally and submit to a FAKE handler (never /api/vote).
 */

export const metadata: Metadata = {
  title: "Móvil · Laboratorio",
  robots: { index: false, follow: false },
};

export default async function LabPhonePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  guardLab();
  const sp = await searchParams;
  const persona = one(sp, "persona");
  const drive = one(sp, "drive") === "1" ? settingsFromParams(sp) : null;
  return (
    <LabPhone
      persona={isPersonaId(persona) ? persona : "ana"}
      drive={drive}
      autoplay={one(sp, "autoplay") === "1"}
    />
  );
}
