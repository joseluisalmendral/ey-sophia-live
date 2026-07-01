"use client";

import { useEffect, useMemo, useState } from "react";
import type { PollStatus } from "@/lib/types";

/**
 * useLocalStatusFlip — derive the effective poll status from the authoritative
 * status (polled or broadcast) plus the server open/close timestamps, advancing
 * LOCALLY (no extra network) at the exact instant each deadline passes.
 *
 * Shared by the voter flow (useVoteFlow) AND the projector (ScreenClient) so
 * both surfaces flip countdown → open at the same wall-clock moment instead of
 * waiting for the next poll / broadcast round-trip.
 *
 * - If `opensAt` is in the future and the poll is still pre-open, schedule a
 *   single timer that flips to `open` at that moment (a configured count-in then
 *   opens instantly and in sync across screens and phones).
 * - If `closesAt` has passed while `open`, flip to `closed` locally too.
 *
 * Only ever advances forward (pre-open → open → closed); a fresh authoritative
 * status that is further along always wins. The server timestamps stay
 * authoritative — this merely removes the transport latency at the flip.
 */
export function useLocalStatusFlip(
  baseStatus: PollStatus,
  opensAt: string | null,
  closesAt: string | null,
): PollStatus {
  const [now, setNow] = useState(() => Date.now());

  const opensAtMs = useMemo(
    () => (opensAt ? new Date(opensAt).getTime() : null),
    [opensAt],
  );
  const closesAtMs = useMemo(
    () => (closesAt ? new Date(closesAt).getTime() : null),
    [closesAt],
  );

  // Compute the effective status from the current clock + server timestamps.
  const effective = deriveEffectiveStatus(baseStatus, opensAtMs, closesAtMs, now);

  // Schedule a single timer to the NEXT boundary that would change the effective
  // status, so we re-render exactly at opens_at / closes_at (not on an interval).
  // The boundary condition recomputes the effective status inline (via the pure
  // module-level helper) rather than depending on the `effective` value, so the
  // dep array is honest AND exactly one timer is registered per boundary.
  useEffect(() => {
    const isOpenNow =
      deriveEffectiveStatus(baseStatus, opensAtMs, closesAtMs, now) === "open";
    const nextBoundary = (() => {
      if (
        opensAtMs !== null &&
        opensAtMs > now &&
        (baseStatus === "draft" || baseStatus === "countdown")
      ) {
        return opensAtMs;
      }
      if (closesAtMs !== null && closesAtMs > now && isOpenNow) {
        return closesAtMs;
      }
      return null;
    })();

    if (nextBoundary === null) return;
    const delay = Math.max(0, nextBoundary - Date.now());
    const id = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(id);
  }, [opensAtMs, closesAtMs, baseStatus, now]);

  return effective;
}

/**
 * Pure effective-status derivation. Advances the base status forward when the
 * server open/close deadlines have passed relative to `now`. Never rolls back.
 */
export function deriveEffectiveStatus(
  baseStatus: PollStatus,
  opensAtMs: number | null,
  closesAtMs: number | null,
  now: number,
): PollStatus {
  if (baseStatus === "closed") return "closed";

  // Close deadline reached while (effectively) open → closed.
  if (closesAtMs !== null && now >= closesAtMs) {
    // Only treat as closed if the poll had actually reached open (server said
    // open, or open deadline passed). Guards against a stray future closes_at.
    if (baseStatus === "open" || (opensAtMs !== null && now >= opensAtMs)) {
      return "closed";
    }
  }

  if (baseStatus === "open") return "open";

  // Pre-open (draft/countdown) with a reached open deadline → open.
  if (opensAtMs !== null && now >= opensAtMs) return "open";

  return baseStatus;
}
