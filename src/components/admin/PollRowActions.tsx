"use client";

import { useState } from "react";
import Link from "next/link";
import { QrCode } from "@/components/atoms/QrCode";
import { CopyButton } from "./CopyButton";
import { voteUrl, screenUrl } from "./links";

/**
 * Per-poll quick actions for the list row: configure / live control / analytics,
 * open the voter & projector URLs in a new tab, and a QR popover with copy
 * buttons for fast sharing during an event.
 */
export function PollRowActions({
  pollId,
  joinCode,
}: {
  pollId: string;
  joinCode: string;
}) {
  const [showQr, setShowQr] = useState(false);
  const vUrl = voteUrl(joinCode);
  const sUrl = screenUrl(joinCode);

  const linkCls =
    "inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-small font-medium text-text-dim transition-colors hover:text-text";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/admin/${pollId}`} className={linkCls}>
        Configurar
      </Link>
      <Link
        href={`/admin/${pollId}?tab=live`}
        className="inline-flex h-9 items-center rounded-md border border-power-green/40 px-3 text-small font-medium text-power-green transition-colors hover:bg-power-green/10"
      >
        Control en vivo
      </Link>
      <Link href={`/admin/${pollId}/analytics`} className={linkCls}>
        Analíticas
      </Link>
      <a href={sUrl} target="_blank" rel="noreferrer" className={linkCls}>
        Pantalla ↗
      </a>
      <a href={vUrl} target="_blank" rel="noreferrer" className={linkCls}>
        Votar ↗
      </a>
      <button
        type="button"
        onClick={() => setShowQr((v) => !v)}
        className={linkCls}
        aria-expanded={showQr}
      >
        QR
      </button>

      {showQr && (
        <div className="mt-2 flex w-full flex-col items-center gap-3 rounded-lg border border-white/10 bg-surface p-4 sm:w-auto">
          <QrCode value={vUrl} size={160} />
          <div className="flex flex-col gap-2">
            <CopyButton value={vUrl} label="Copiar URL de votación" />
            <CopyButton value={sUrl} label="Copiar URL de pantalla" />
            <CopyButton value={joinCode} label={`Copiar código ${joinCode}`} />
          </div>
        </div>
      )}
    </div>
  );
}

export default PollRowActions;
