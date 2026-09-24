import type { MascotCommand, MascotReport } from "@/components/mascot/MascotHost";
import type { LabSnapshot } from "./engine";
import type { PersonaId } from "./personas";
import type { Phase } from "@/app/vote/[poll]/phase";

/**
 * /lab cross-tab sync over BroadcastChannel("lab").
 *
 * The control room (or any frame opened with ?drive=1) is the LEADER: it runs
 * the engine and broadcasts a snapshot ~10×/s. Frames (/lab/screen,
 * /lab/phone, same-origin iframes or separate tabs/windows — e.g. the
 * projector fullscreen on a second display) are FOLLOWERS. BroadcastChannel is
 * per browser profile + origin: no network is involved.
 */

export const LAB_CHANNEL = "lab";

export type LabMessage =
  | { type: "snapshot"; snap: LabSnapshot }
  /** A follower just mounted: the leader answers with a snapshot at once. */
  | { type: "hello" }
  /** Phone frame → control room: current phase + manual override flag. */
  | { type: "persona"; id: PersonaId; phase: Phase; manual: boolean }
  /** Control room → phone frame: drop the manual override. */
  | { type: "persona-reset"; id: PersonaId }
  /** Projector frame → control room: mascot keep-out zones found on screen. */
  | { type: "keepouts"; count: number }
  /** Control room → projector frame: drive the mascot (force / fire / random). */
  | { type: "mascot-cmd"; cmd: MascotCommand }
  /** Projector frame → control room: line log + live state (overlap detector). */
  | { type: "mascot"; report: MascotReport }
  /**
   * Projector frame → control room: live DOM leak test while open +
   * anonymous (real names / "Candidato X" labels found in the live stage).
   */
  | { type: "anon-dom"; scans: number; leaks: string[] };

export interface LabChannel {
  post(msg: LabMessage): void;
  close(): void;
}

/** Open the channel; a no-op shim where BroadcastChannel is unavailable. */
export function openLabChannel(onMessage: (msg: LabMessage) => void): LabChannel {
  if (typeof BroadcastChannel === "undefined") {
    return { post: () => {}, close: () => {} };
  }
  const ch = new BroadcastChannel(LAB_CHANNEL);
  ch.onmessage = (e: MessageEvent<LabMessage>) => {
    if (e.data && typeof e.data === "object" && "type" in e.data) onMessage(e.data);
  };
  return {
    post: (msg) => ch.postMessage(msg),
    close: () => ch.close(),
  };
}
