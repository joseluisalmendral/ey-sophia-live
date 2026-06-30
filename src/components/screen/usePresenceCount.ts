"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * usePresenceCount — a live "people in the room" count for the lobby, via
 * Supabase Realtime PRESENCE on a dedicated lobby channel.
 *
 * This is purely additive aliveness for the LOBBY; it deliberately uses its own
 * public channel `lobby:<pollId>` (NOT the private `poll:<id>` tally channel) so
 * it never interferes with the tally subscription in useLiveTally and needs no
 * private-channel auth. Each subscribed client tracks one presence key, so the
 * count reflects connected screens + any voter clients that also join.
 *
 * Degrades gracefully: if presence never syncs (auth/policy/offline), the count
 * stays null and the caller shows a tasteful "scan to join" prompt instead.
 */
export function usePresenceCount(pollId: string): number | null {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const key = `c_${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(`lobby:${pollId}`, {
      config: { presence: { key } },
    });

    const recompute = () => {
      if (!active) return;
      const state = channel.presenceState();
      setCount(Object.keys(state).length);
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ at: Date.now() });
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [pollId, supabase]);

  return count;
}
