"use client";

import { Component, type ReactNode, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useReducedMotionPref } from "@/lib/motion/useReducedMotionPref";

/**
 * MeshGradient is the heaviest dependency on the page (WebGL/OGL). Lazy-load it
 * so it never lands in the initial bundle. `ssr: false` because it only renders
 * client-side behind the `useShader` gate; the StaticCosmic CSS floor already
 * paints synchronously, so no `loading` fallback is needed.
 */
const MeshGradient = dynamic(
  () => import("@paper-design/shaders-react").then((m) => m.MeshGradient),
  { ssr: false },
);

/**
 * ShaderBackground — the cosmic mesh-gradient stage behind every premium
 * surface.
 *
 * A slow, living deep-navy mesh (cosmic-deep -> cosmic-mid -> cosmic-700) with a
 * single restrained ember of EY-yellow far in one corner, so the stage breathes
 * without ever competing with the yellow leader/winner highlight on top.
 *
 * Performance + resilience:
 *  - DPR-capped via `maxPixelCount` so a 4K projector doesn't melt the GPU.
 *  - Renders the static CSS cosmic gradient under `prefers-reduced-motion`,
 *    before client mount, and if the WebGL shader throws (caught by a real error
 *    boundary) — the shader is pure enhancement, never a hard dependency.
 *
 * Children render above the shader in a normal stacking context.
 */

export interface ShaderBackgroundProps {
  children?: ReactNode;
  className?: string;
  /** Override the animation speed (0 = frozen). */
  speed?: number;
}

// Cosmic mesh palette: deep navy base, a navy-violet lift, and a single faint
// EY-yellow ember. Kept low-saturation so the foreground yellow always wins.
const COSMIC_COLORS = ["#0B1026", "#141A33", "#1E2647", "#2A2156", "#3A3410"];

// Cap total shader pixels (~ DPR cap). 2.1M ≈ 1080p at DPR 1; plenty for a
// projector while keeping fill-rate sane.
const MAX_PIXELS = 2_100_000;

/** Client-mount flag via useSyncExternalStore (no setState-in-effect). */
const noopSubscribe = () => () => {};
function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}

/** Static gradient that matches the global body base — the always-safe floor. */
function StaticCosmic() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundColor: "var(--color-cosmic-deep)",
        backgroundImage:
          "radial-gradient(ellipse 120% 90% at 50% -10%, var(--color-cosmic-700) 0%, var(--color-cosmic-mid) 38%, var(--color-cosmic-deep) 72%), radial-gradient(circle at 88% 8%, color-mix(in srgb, var(--color-ey-yellow) 10%, transparent) 0%, transparent 30%)",
      }}
    />
  );
}

/** Error boundary: a WebGL failure degrades silently to the static floor. */
class ShaderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function ShaderBackground({
  children,
  className,
  speed = 0.18,
}: ShaderBackgroundProps) {
  const reduced = useReducedMotionPref();
  const mounted = useIsMounted();
  const useShader = mounted && !reduced;

  return (
    <div
      className={["relative isolate min-h-[100dvh]", className ?? ""].join(" ")}
    >
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
        {/* Always render the static floor; the shader paints over it when live. */}
        <StaticCosmic />
        {useShader && (
          <ShaderBoundary>
            <MeshGradient
              className="absolute inset-0 h-full w-full opacity-90"
              colors={COSMIC_COLORS}
              speed={speed}
              distortion={0.85}
              swirl={0.55}
              maxPixelCount={MAX_PIXELS}
              minPixelRatio={1}
            />
          </ShaderBoundary>
        )}
        {/* Vignette to seat the foreground and kill banding. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 100% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%)",
          }}
        />
      </div>
      {children}
    </div>
  );
}

export default ShaderBackground;
