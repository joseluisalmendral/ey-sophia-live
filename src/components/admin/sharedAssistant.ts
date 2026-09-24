"use client";

import { useState, useTransition } from "react";
import { setAssistantEnabled } from "@/app/admin/(panel)/poll-actions";

/**
 * Broqui on/off shared by the config form and Live Control (one source of
 * truth, owned by PollWorkspace).
 *
 * `set(next)` is optimistic: both switches flip at once, the value is
 * written with setAssistantEnabled (admin-gated), and a failed write reverts
 * both and surfaces a Spanish error. Saving the config form then writes this
 * CURRENT value too, so a form save can never clobber the live toggle.
 * A server refresh with a different DB value (another operator) re-syncs the
 * state (state-from-props during render, no effect).
 */
export interface SharedAssistant {
  enabled: boolean;
  pending: boolean;
  error: string | null;
  set: (next: boolean) => void;
}

export function useSharedAssistant(pollId: string, serverValue: boolean): SharedAssistant {
  const [enabled, setEnabled] = useState(serverValue);
  const [seen, setSeen] = useState(serverValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (serverValue !== seen) {
    setSeen(serverValue);
    setEnabled(serverValue);
  }

  const set = (next: boolean) => {
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const res = await setAssistantEnabled(pollId, next);
      if (!res.ok) {
        setEnabled(!next);
        setError(res.error ?? "No se pudo cambiar a Broqui. Inténtalo de nuevo.");
      }
    });
  };

  return { enabled, pending, error, set };
}
