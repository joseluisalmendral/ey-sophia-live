import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { EyBeam } from "@/components/brand/EyBeam";

/**
 * ChannelStandby — the premium waiting board a technician channel shows while
 * no poll is assigned (/tv/[slug] with poll_id NULL).
 *
 * Deliberately calm and self-explanatory for the room: cosmic ShaderBackground,
 * the SophIA wordmark treatment, and a discreet "channel ready" line so the
 * technician knows the projector is correctly plugged in and simply waiting for
 * the admin to assign a poll from the panel.
 */
export function ChannelStandby({ slug }: { slug: string }) {
  return (
    <ShaderBackground>
      <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden px-8 text-center">
        <div className="flex flex-col items-center gap-8">
          <EyBeam surface="dark" size={72} label="" />
          <div className="flex flex-col items-center gap-3">
            <h1 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-black tracking-tight text-text">
              Soph<span className="text-sophia-purple">IA</span>{" "}
              <span className="text-ey-yellow">Live</span>
            </h1>
            <p className="text-[clamp(1rem,2vw,1.5rem)] font-semibold text-text-dim">
              Canal listo — esperando asignación
            </p>
          </div>
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5">
            <span
              aria-hidden
              className="h-2 w-2 animate-pulse rounded-full bg-power-green"
            />
            <span className="font-mono text-small uppercase tracking-widest text-text-dim">
              {slug}
            </span>
          </div>
        </div>
      </main>
    </ShaderBackground>
  );
}

export default ChannelStandby;
