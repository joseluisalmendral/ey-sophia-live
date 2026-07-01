import { ShaderBackground } from "@/components/providers/ShaderBackground";

/**
 * Voter route skeleton — a tasteful mobile placeholder on brand while the poll
 * data loads. Pulses are pure `animate-pulse`; the global reduced-motion rule in
 * globals.css collapses them to static automatically.
 */
export default function VoteLoading() {
  return (
    <ShaderBackground>
      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-5 py-10">
        {/* SophIA-ish banner placeholder */}
        <div className="animate-pulse rounded-xl border border-white/10 bg-surface-raised/60 p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-white/10" />
            <div className="flex flex-col gap-2">
              <div className="h-6 w-28 rounded bg-white/10" />
              <div className="h-3 w-16 rounded bg-white/5" />
            </div>
          </div>
          <div className="mt-5 h-4 w-3/4 rounded bg-white/10" />
        </div>

        {/* Team card placeholders */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse flex items-center gap-3 rounded-lg border border-white/10 bg-surface-raised/50 px-4 py-4"
            >
              <div className="h-7 w-7 rounded-full bg-white/10" />
              <div className="h-4 flex-1 rounded bg-white/10" />
            </div>
          ))}
        </div>

        <span className="sr-only">Cargando votación…</span>
      </main>
    </ShaderBackground>
  );
}
