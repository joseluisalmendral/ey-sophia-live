"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MascotBoundary } from "@/components/mascot/MascotBoundary";
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
  mascotCrash = false,
}: {
  drive: LabSettings | null;
  autoplay: boolean;
  /** QA only (?mascotCrash=1): MascotHost throws on render to prove isolation. */
  mascotCrash?: boolean;
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
      crash: mascotCrash,
    }),
    [post, mascotCrash],
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

  const anonDom = useAnonDomScan(
    snap.status === "open" && poll.anonymousDisplay,
    teams.map((t) => t.name),
    post,
  );

  return (
    <LabSettingsProvider value={frame}>
      {showKeepouts && <style>{KEEPOUT_CSS}</style>}
      {/* QA hook: virtual time + status for scripted screenshots. */}
      <span
        hidden
        data-lab-t={snap.t.toFixed(2)}
        data-lab-status={snap.status}
        data-lab-anon-scans={anonDom.scans}
        data-lab-anon-leaks={anonDom.leaks.join("|")}
      />
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
          <MascotBoundary name="lab">
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
          </MascotBoundary>
        }
      />
    </LabSettingsProvider>
  );
}

/** "Candidato A"-style letter labels: never allowed on a hidden identity. */
const LETTER_LABEL = /\b[Cc]andidat[oa]s?\b|\b[Ee]quipo [A-Z]\b/;

/**
 * Live DOM leak test (open + anonymous): every 500 ms read the LIVE stage
 * and the mascot host — visible text AND aria-labels — and flag any real team
 * name or letter label. Scoped to [data-stage="live"] so the lobby fading out
 * under the stinger (it legitimately shows the real finalists) never counts.
 * Reports to the control room and on a hidden QA span.
 */
function useAnonDomScan(
  active: boolean,
  realNames: string[],
  post: (msg: LabMessage) => void,
): { scans: number; leaks: string[] } {
  const [result, setResult] = useState<{ scans: number; leaks: string[] }>({ scans: 0, leaks: [] });
  const namesKey = realNames.join("\u0001");
  useEffect(() => {
    if (!active) return;
    const names = namesKey.split("\u0001").filter((n) => n.trim().length > 1);
    let scans = 0;
    const leaks = new Set<string>();
    const scan = () => {
      const roots = [
        ...document.querySelectorAll<HTMLElement>('[data-stage="live"], [data-mascot-host]'),
      ];
      if (roots.length === 0) return;
      const texts: string[] = [];
      for (const r of roots) {
        texts.push(r.innerText);
        r.querySelectorAll("[aria-label]").forEach((el) => texts.push(el.getAttribute("aria-label") ?? ""));
      }
      const blob = texts.join("\n").toLowerCase();
      for (const n of names) if (blob.includes(n.toLowerCase())) leaks.add(n);
      const letter = LETTER_LABEL.exec(texts.join("\n"));
      if (letter) leaks.add(letter[0]);
      scans += 1;
      const next = { scans, leaks: [...leaks] };
      setResult(next);
      post({ type: "anon-dom", ...next });
    };
    const id = setInterval(scan, 500);
    const first = setTimeout(scan, 50);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [active, namesKey, post]);
  return result;
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
