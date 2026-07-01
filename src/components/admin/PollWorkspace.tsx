"use client";

import { useState } from "react";
import Link from "next/link";
import { PollConfigForm, type PollConfigInitial } from "./PollConfigForm";
import { LiveControlPanel } from "./LiveControlPanel";
import { StatusBadge } from "./StatusBadge";
import type { PollStatus } from "@/lib/types";

/**
 * PollWorkspace — tabbed shell combining poll configuration and live control on
 * one page. The active tab can be deep-linked (?tab=live) so the list's "Control
 * en vivo" CTA lands directly on the cockpit.
 */
export function PollWorkspace({
  pollId,
  title,
  status,
  joinCode,
  hasCountdown,
  configInitial,
  initialTab,
}: {
  pollId: string;
  title: string;
  status: PollStatus;
  joinCode: string;
  hasCountdown: boolean;
  configInitial: PollConfigInitial;
  initialTab: "config" | "live";
}) {
  const [tab, setTab] = useState<"config" | "live">(initialTab);

  const tabCls = (active: boolean) =>
    [
      "h-10 rounded-lg px-4 text-small font-medium transition-colors",
      active
        ? "bg-surface-raised text-text"
        : "text-text-dim hover:text-text",
    ].join(" ");

  return (
    <div>
      <div className="mb-5">
        <Link
          href="/admin"
          className="text-small text-text-dim hover:text-text"
        >
          ← Votaciones
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h1 font-extrabold text-text">
            {title || "Nueva votación"}
          </h1>
          <StatusBadge status={status} />
          <span className="font-mono uppercase tracking-widest text-text-dim">
            {joinCode}
          </span>
        </div>
      </div>

      <div className="mb-6 inline-flex gap-1 rounded-xl border border-white/10 bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab("config")}
          className={tabCls(tab === "config")}
        >
          Configuración
        </button>
        <button
          type="button"
          onClick={() => setTab("live")}
          className={tabCls(tab === "live")}
        >
          Control en vivo
        </button>
        <Link href={`/admin/${pollId}/analytics`} className={tabCls(false)}>
          Analíticas
        </Link>
      </div>

      {tab === "config" ? (
        <PollConfigForm initial={configInitial} />
      ) : (
        <LiveControlPanel
          pollId={pollId}
          joinCode={joinCode}
          initialStatus={status}
          hasCountdown={hasCountdown}
        />
      )}
    </div>
  );
}

export default PollWorkspace;
