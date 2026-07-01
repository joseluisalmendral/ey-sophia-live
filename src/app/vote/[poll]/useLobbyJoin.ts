"use client";

import { useEffect } from "react";
import { getSessionAlias } from "@/lib/lobby/alias";

/**
 * useLobbyJoin — voter-side ONE-SHOT lobby join event (HTTP, no realtime).
 *
 * Replaces the old presence WebSocket (useLobbyPresence): while the voter sits
 * in the PRE-OPEN lobby, the phone fires a single POST /api/poll/[id]/join
 * with its anonymous session alias ("Vega 12") so the big screen's polled
 * join feed can show them arriving. No connection is held open — the voter
 * path now carries ZERO websockets, keeping the whole room off the realtime
 * concurrent-connection cap.
 *
 * Dedupe: a sessionStorage marker per poll AND per relaunch epoch guarantees
 * one join per browser session per run: after an admin relaunch the epoch
 * bumps, the marker key changes, and a phone still sitting on the page
 * re-posts its join exactly once so the new run's feed is not empty. The
 * `join_lobby` RPC stamps the current run_seq server-side.
 *
 * Fire-and-forget: any failure is swallowed — the join feed is pure ambience
 * and must never affect the voting flow.
 */
export function useLobbyJoin(
  pollId: string,
  enabled: boolean,
  relaunchEpoch = 0,
): void {
  useEffect(() => {
    if (!enabled) return;

    const markerKey = `sophia-lobby-joined-${pollId}-e${relaunchEpoch}`;
    try {
      if (window.sessionStorage.getItem(markerKey) === "1") return;
      window.sessionStorage.setItem(markerKey, "1");
    } catch {
      // sessionStorage unavailable (private mode edge cases): still post once
      // per mount — the effect only re-runs if pollId/enabled change.
    }

    void fetch(`/api/poll/${encodeURIComponent(pollId)}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias: getSessionAlias() }),
      keepalive: true,
    }).catch(() => {
      // Ambience only — never surface an error to the voter.
    });
  }, [pollId, enabled, relaunchEpoch]);
}
