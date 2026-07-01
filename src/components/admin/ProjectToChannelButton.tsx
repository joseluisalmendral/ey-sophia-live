"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignChannel } from "@/app/admin/(panel)/poll-actions";

/**
 * ProjectToChannelButton — one-click "put THIS poll on the technician screen".
 *
 * Lives in the poll workspace next to the links panel. Assigns the poll to the
 * stable /tv/[slug] channel (or releases it back to standby when it is already
 * the one projected). The projector picks the change up on its own.
 */
export function ProjectToChannelButton({
  pollId,
  slug,
  assignedPollId,
}: {
  pollId: string;
  /** Technician channel slug (the seeded default is "directo"). */
  slug: string;
  /** Poll currently assigned to the channel, or null. */
  assignedPollId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isProjected = assignedPollId === pollId;

  function toggle() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await assignChannel(slug, isProjected ? null : pollId);
      if (!res.ok) setError(res.error ?? "Error");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className={[
          "inline-flex h-9 items-center rounded-md border px-3 text-small font-medium transition-colors disabled:opacity-50",
          isProjected
            ? "border-power-green/40 text-power-green hover:bg-power-green/10"
            : "border-white/15 text-text-dim hover:text-text",
        ].join(" ")}
      >
        {pending
          ? "Aplicando…"
          : isProjected
            ? "✓ En el canal directo — quitar"
            : "Proyectar en canal directo"}
      </button>
      {error && (
        <span role="alert" className="text-small text-[#FF9E9E]">
          {error}
        </span>
      )}
    </div>
  );
}

export default ProjectToChannelButton;
