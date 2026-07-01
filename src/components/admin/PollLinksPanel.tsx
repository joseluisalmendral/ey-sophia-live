"use client";

import { useState } from "react";
import { QrCode } from "@/components/atoms/QrCode";
import { CopyButton } from "./CopyButton";
import { voteUrl, screenUrl } from "./links";

/**
 * PollLinksPanel — compact share block for the poll workspace: the projector
 * and voter URLs (open in a new tab + copy) plus an expandable QR for the vote
 * link. Lets the admin grab everything from the configure page without going
 * back to the poll list.
 */
export function PollLinksPanel({
  joinCode,
  className,
}: {
  joinCode: string;
  className?: string;
}) {
  const [showQr, setShowQr] = useState(false);
  const sUrl = screenUrl(joinCode);
  const vUrl = voteUrl(joinCode);

  const openCls =
    "inline-flex h-8 shrink-0 items-center rounded-md border border-white/15 px-2.5 text-micro font-medium text-text-dim transition-colors hover:text-text";

  const rows = [
    { label: "Pantalla", url: sUrl, copyLabel: "Copiar URL de pantalla" },
    { label: "Votar", url: vUrl, copyLabel: "Copiar URL de votación" },
  ];

  return (
    <div
      className={[
        "rounded-xl border border-white/10 bg-surface-raised p-5",
        className ?? "",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-h3 font-bold text-text">Enlaces</h2>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          aria-expanded={showQr}
          className="inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-small font-medium text-text-dim transition-colors hover:text-text"
        >
          {showQr ? "Ocultar QR" : "QR de votación"}
        </button>
      </div>

      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap"
          >
            <span className="w-20 shrink-0 text-small font-medium text-text">
              {row.label}
            </span>
            <span
              className="min-w-0 flex-1 truncate font-mono text-micro text-text-dim"
              title={row.url}
            >
              {row.url}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className={openCls}
              >
                Abrir ↗
              </a>
              <CopyButton value={row.url} label="Copiar" />
            </span>
          </li>
        ))}
      </ul>

      {showQr && (
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-white/10 pt-4">
          <QrCode value={vUrl} size={180} />
          <p className="text-micro text-text-dim">
            Escanea para votar · código{" "}
            <span className="font-mono uppercase tracking-widest">
              {joinCode}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

export default PollLinksPanel;
