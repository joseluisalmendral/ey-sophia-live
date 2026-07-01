import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { EyBeam } from "@/components/brand/EyBeam";

/**
 * Projector route skeleton — a centered, restrained brand mark and skeleton bars
 * while the screen data loads. Pulses collapse to static under the global
 * reduced-motion rule in globals.css.
 */
export default function ScreenLoading() {
  return (
    <ShaderBackground>
      <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center gap-10 px-12 py-16">
        <div className="animate-pulse">
          <EyBeam surface="dark" size={96} />
        </div>

        {/* Skeleton tally bars */}
        <div className="flex w-full max-w-3xl flex-col gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-5">
              <div className="h-10 w-10 rounded-full bg-white/10" />
              <div className="h-8 flex-1 rounded-full bg-white/10" />
            </div>
          ))}
        </div>

        <span className="sr-only">Cargando pantalla…</span>
      </main>
    </ShaderBackground>
  );
}
