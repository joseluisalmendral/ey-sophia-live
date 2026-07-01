"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSessionAlias } from "@/lib/lobby/alias";

/**
 * useLobbyPresence — voter-side presence track for the projector lobby feed.
 *
 * SCOPE NOTE (important): the voter path deliberately has NO realtime for poll
 * status (see useVoteFlow — HTTP polling keeps the room within the concurrent
 * connection cap). This hook is the ONE narrow exception: while the voter sits
 * in the PRE-OPEN lobby, it joins the `lobby:<pollId>` presence channel so the
 * big screen can show who's arriving. The channel is torn down the moment
 * `enabled` flips false (poll opens / voter acts), so voting-phase traffic
 * carries zero websockets, exactly as before.
 *
 * Payload stays backward-compatible with the original `{ at, role }` shape —
 * it only ADDS `alias`, an anonymous, session-stable display name ("Vega 12").
 * The screen tolerates entries without alias, and older screens ignore it.
 *
 * Fire-and-forget: any auth/subscribe failure is swallowed — presence is pure
 * ambience and must never affect the voting flow.
 */
export function useLobbyPresence(pollId: string, enabled: boolean): void {
  const supabase = useMemo(() => createClient(), []);
  // Stable presence key per hook instance so re-subscribes never double-count.
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (keyRef.current === null) {
      keyRef.current = `v_${Math.random().toString(36).slice(2)}`;
    }
    const channel = supabase.channel(`lobby:${pollId}`, {
      config: { presence: { key: keyRef.current }, private: true },
    });

    const connect = async () => {
      try {
        const token =
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          (await supabase.auth.getSession()).data.session?.access_token ??
          "";
        await supabase.realtime.setAuth(token);
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void channel.track({
              at: Date.now(),
              role: "voter",
              alias: getSessionAlias(),
            });
          }
        });
      } catch {
        // Presence is ambience only — never surface an error to the voter.
      }
    };

    void connect();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, supabase, enabled]);
}
