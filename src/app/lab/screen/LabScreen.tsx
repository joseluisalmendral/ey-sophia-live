"use client";

import { useEffect, useMemo, useRef } from "react";
import { MascotHost, type MascotCommand, type MascotLabBridge } from "@/components/mascot/MascotHost";
import { ScreenStage } from "@/components/screen/ScreenStage";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";
import { siteUrl } from "@/lib/utils/siteUrl";
import type { LabMessage } from "@/lab/channel";
import type { LabSettings, LabSnapshot } from "@/lab/engine";
import { LabSettingsProvider } from "@/lab/LabContext";
import { useLabDriver, useLabFollower, useStructural } from "@/lab/useLab";

/**
 * LabScreen — the projector frame: the PRODUCTION ScreenStage fed by the lab
 * engine snapshot instead of realtime. Renders nothing server-side (the first
 * snapshot arrives on the client), so there is no hydration surface.
 */

/**
 * Debug outlines: keep-outs (pink), anchors (blue), mascot body + bubble
 * (green; RED the moment either intersects a keep-out — the acceptance gate).
 */
const KEEPOUT_CSS = `
[data-mascot-keepout]{outline:3px dashed #ff4d6d !important;outline-offset:-3px;background-image:repeating-linear-gradient(45deg,rgba(255,77,109,.10) 0 12px,transparent 12px 24px)}
[data-mascot-anchor]{outline:3px dashed #38bdf8 !important;outline-offset:-3px}
[data-mascot-host] [data-broqui]{outline:3px solid #22c55e;outline-offset:-3px}
[data-mascot-host] .bubble{outline:3px solid #22c55e;outline-offset:2px}
[data-mascot-host][data-mascot-overlap="true"] [data-broqui],
[data-mascot-host][data-mascot-overlap="true"] .bubble{outline-color:#ef4444}
`;

export function LabScreen({
  drive,
  autoplay,
}: {
  drive: LabSettings | null;
  autoplay: boolean;
}) {
  // Mascot command bus: control-room messages → the host mounted below.
  const listeners = useRef(new Set<(cmd: MascotCommand) => void>());
  const onMessage = useMemo(
    () => (msg: LabMessage) => {
      if (msg.type === "mascot-cmd") listeners.current.forEach((cb) => cb(msg.cmd));
    },
    [],
  );
  const driver = useLabDriver(drive, { autoplay, onMessage });
  const follower = useLabFollower(drive === null, onMessage);
  const snap = drive ? driver.snap : follower.snap;
  const post = useMemo(
    () =>
      drive
        ? driver.controls.post
        : (msg: LabMessage) => follower.channel?.post(msg),
    [drive, driver.controls.post, follower.channel],
  );
  const bridge = useMemo<MascotLabBridge>(
    () => ({
      subscribe: (cb) => {
        listeners.current.add(cb);
        return () => listeners.current.delete(cb);
      },
      report: (report) => post({ type: "mascot", report }),
    }),
    [post],
  );

  if (!snap) return <LabWaiting />;
  return <LabScreenStage snap={snap} post={post} bridge={bridge} />;
}

function LabScreenStage({
  snap,
  post,
  bridge,
}: {
  snap: LabSnapshot;
  post: (msg: LabMessage) => void;
  bridge: MascotLabBridge;
}) {
  const osReduced = useReducedMotionPref();
  const { settings } = snap;
  const reduced = settings.reduced || osReduced;
  const poll = useStructural(snap.poll);
  const teams = useStructural(snap.teams);
  const liveTeams = useStructural(snap.liveTeams);
  const frame = useStructural({
    assistant: settings.assistant,
    showKeepouts: settings.showKeepouts,
    reduced,
  });
  // Client-only (the stage never renders before the first snapshot).
  const voterUrl = `${siteUrl()}/vote/${poll.joinCode}`;

  // Keep-out zone count for the drawer hint (the overlap test itself runs in
  // the mascot host and arrives as `mascot` state reports).
  const { showKeepouts } = frame;
  useEffect(() => {
    if (!showKeepouts) return;
    const report = () =>
      post({
        type: "keepouts",
        count: document.querySelectorAll("[data-mascot-keepout]").length,
      });
    report();
    const id = setInterval(report, 1000);
    return () => clearInterval(id);
  }, [showKeepouts, post]);

  return (
    <LabSettingsProvider value={frame}>
      {showKeepouts && <style>{KEEPOUT_CSS}</style>}
      {/* QA hook: virtual time + status for scripted screenshots. */}
      <span hidden data-lab-t={snap.t.toFixed(2)} data-lab-status={snap.status} />
      <ScreenStage
        poll={poll}
        teams={teams}
        liveTeams={liveTeams}
        voterUrl={voterUrl}
        status={snap.status}
        opensAt={snap.opensAt}
        closesAt={snap.closesAt}
        joined={snap.joined}
        connectionState="live"
        ready
        reduced={reduced}
        mascotSlot={
          <MascotHost
            config={{
              enabled: settings.assistant.enabled,
              min: settings.assistant.minIntervalS,
              max: settings.assistant.maxIntervalS,
            }}
            reduced={reduced}
            rngSeed={settings.seed}
            lab={bridge}
          />
        }
      />
    </LabSettingsProvider>
  );
}

export function LabWaiting() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-cosmic-deep px-6 text-center">
      <p className="text-small font-medium uppercase tracking-[0.2em] text-text-dim">
        Esperando a la sala de control…
      </p>
    </main>
  );
}
