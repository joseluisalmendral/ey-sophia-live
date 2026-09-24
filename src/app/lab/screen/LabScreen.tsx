"use client";

import { useEffect, useMemo } from "react";
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

/** Debug outline for mascot anchors/keep-outs (E3 adds the attributes). */
const KEEPOUT_CSS = `
[data-mascot-keepout]{outline:3px dashed #ff4d6d !important;outline-offset:-3px;background-image:repeating-linear-gradient(45deg,rgba(255,77,109,.10) 0 12px,transparent 12px 24px)}
[data-mascot-anchor]{outline:3px dashed #38bdf8 !important;outline-offset:-3px}
`;

export function LabScreen({
  drive,
  autoplay,
}: {
  drive: LabSettings | null;
  autoplay: boolean;
}) {
  const driver = useLabDriver(drive, { autoplay });
  const follower = useLabFollower(drive === null);
  const snap = drive ? driver.snap : follower.snap;
  const post = useMemo(
    () =>
      drive
        ? driver.controls.post
        : (msg: LabMessage) => follower.channel?.post(msg),
    [drive, driver.controls.post, follower.channel],
  );

  if (!snap) return <LabWaiting />;
  return <LabScreenStage snap={snap} post={post} />;
}

function LabScreenStage({
  snap,
  post,
}: {
  snap: LabSnapshot;
  post: (msg: LabMessage) => void;
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

  // Keep-out overlap check placeholder: report how many zones exist (E3 adds
  // the data-mascot-keepout attributes and the real overlap test).
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
