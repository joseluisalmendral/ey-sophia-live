/**
 * winnerSting — a WebAudio-synthesized triumphant sting.
 *
 * No audio asset is shipped: the sting is generated entirely in code with
 * OscillatorNodes + a GainNode envelope. It is best-effort by design — if the
 * AudioContext is unavailable, autoplay is blocked, or resume() rejects, it
 * fails silently and never throws.
 *
 * The sting is a short (~1.2s) major-chord arpeggio that resolves onto a rising
 * fifth, with a soft attack/decay envelope so it stays tasteful, not harsh.
 */

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext ??
    null
  );
}

/** Handle to stop/clean up an in-flight sting. */
export interface WinnerStingHandle {
  stop: () => void;
}

const NOOP_HANDLE: WinnerStingHandle = { stop: () => {} };

// C major arpeggio rising to a fifth: C5 E5 G5 -> C6, then hold a G5+C6 fifth.
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5];

/**
 * Play the triumphant sting once. Best-effort: returns a no-op handle if audio
 * cannot be created. Accepts no arguments.
 */
export function playWinnerSting(): WinnerStingHandle {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return NOOP_HANDLE;

  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return NOOP_HANDLE;
  }

  // resume() may reject under autoplay policy — swallow it.
  void ctx.resume?.().catch(() => {});

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.5, now + 0.04);
  master.connect(ctx.destination);

  const noteDuration = 0.22;
  const oscillators: OscillatorNode[] = [];

  try {
    ARPEGGIO.forEach((freq, i) => {
      const start = now + i * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      // Soft per-note envelope.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.9, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + noteDuration + 0.05);
      oscillators.push(osc);
    });

    // Sustained rising fifth (G5 + C6) tail to resolve the sting.
    const tailStart = now + ARPEGGIO.length * 0.13;
    [783.99, 1046.5].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, tailStart);
      gain.gain.setValueAtTime(0.0001, tailStart);
      gain.gain.exponentialRampToValueAtTime(0.6, tailStart + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, tailStart + 0.5);
      osc.connect(gain);
      gain.connect(master);
      osc.start(tailStart);
      osc.stop(tailStart + 0.55);
      oscillators.push(osc);
    });
  } catch {
    // Node creation/scheduling failed — close and bail silently.
    void ctx.close?.().catch(() => {});
    return NOOP_HANDLE;
  }

  // Auto-close the context shortly after the sting ends (~1.2s total).
  const closeTimer = setTimeout(() => {
    void ctx.close?.().catch(() => {});
  }, 1400);

  return {
    stop: () => {
      clearTimeout(closeTimer);
      oscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      });
      void ctx.close?.().catch(() => {});
    },
  };
}
