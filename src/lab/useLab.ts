"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { openLabChannel, type LabChannel, type LabMessage } from "./channel";
import { LabEngine, type LabSettings, type LabSnapshot } from "./engine";

/**
 * React bindings for the /lab engine + channel.
 *
 *  - useLabDriver: owns a LabEngine (leader), broadcasts every snapshot and
 *    answers followers' "hello". Returns the snapshot + imperative controls.
 *  - useLabFollower: listens for snapshots from whichever leader is running.
 *  - useStructural: keeps a stable reference while the JSON value is equal,
 *    so 10 Hz snapshots do not churn memoised presentational components.
 */

export interface LabControls {
  play(): void;
  pause(): void;
  toggle(): void;
  seek(t: number): void;
  step(): void;
  reset(): void;
  update(patch: Partial<LabSettings>): void;
  /** Send any message to the followers (e.g. persona-reset). */
  post(msg: LabMessage): void;
}

export function useLabDriver(
  initial: LabSettings | null,
  options: { autoplay?: boolean; onMessage?: (msg: LabMessage) => void } = {},
): { snap: LabSnapshot | null; controls: LabControls } {
  const [snap, setSnap] = useState<LabSnapshot | null>(null);
  const engineRef = useRef<LabEngine | null>(null);
  const channelRef = useRef<LabChannel | null>(null);
  const onMessageRef = useRef(options.onMessage);
  useEffect(() => {
    onMessageRef.current = options.onMessage;
  }, [options.onMessage]);

  const initialKey = initial ? JSON.stringify(initial) : null;
  const autoplay = options.autoplay ?? false;

  useEffect(() => {
    if (initialKey === null) return;
    const settings = JSON.parse(initialKey) as LabSettings;
    let latest: LabSnapshot | null = null;
    const channel = openLabChannel((msg) => {
      if (msg.type === "hello" && latest) channel.post({ type: "snapshot", snap: latest });
      onMessageRef.current?.(msg);
    });
    const engine = new LabEngine(settings, (s) => {
      latest = s;
      setSnap(s);
      channel.post({ type: "snapshot", snap: s });
    });
    engineRef.current = engine;
    channelRef.current = channel;
    engine.start();
    if (autoplay) engine.play();
    return () => {
      engine.stop();
      channel.close();
      engineRef.current = null;
      channelRef.current = null;
    };
  }, [initialKey, autoplay]);

  const controls = useMemo<LabControls>(
    () => ({
      play: () => engineRef.current?.play(),
      pause: () => engineRef.current?.pause(),
      toggle: () => engineRef.current?.toggle(),
      seek: (t) => engineRef.current?.seek(t),
      step: () => engineRef.current?.step(),
      reset: () => engineRef.current?.reset(),
      update: (patch) => engineRef.current?.update(patch),
      post: (msg) => channelRef.current?.post(msg),
    }),
    [],
  );

  return { snap, controls };
}

export function useLabFollower(
  enabled: boolean,
  onMessage?: (msg: LabMessage, channel: LabChannel) => void,
): { snap: LabSnapshot | null; channel: LabChannel | null } {
  const [snap, setSnap] = useState<LabSnapshot | null>(null);
  const [channel, setChannel] = useState<LabChannel | null>(null);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;
    const ch = openLabChannel((msg) => {
      if (msg.type === "snapshot") setSnap(msg.snap);
      else onMessageRef.current?.(msg, ch);
    });
    ch.post({ type: "hello" });
    // Expose the channel on the next macrotask (no sync setState in effect).
    const id = setTimeout(() => setChannel(ch), 0);
    return () => {
      clearTimeout(id);
      ch.close();
    };
  }, [enabled]);

  return { snap, channel };
}

/** Stable reference for structurally-equal values (JSON-comparable data). */
export function useStructural<T>(value: T): T {
  const key = JSON.stringify(value);
  return useMemo(() => JSON.parse(key) as T, [key]);
}
