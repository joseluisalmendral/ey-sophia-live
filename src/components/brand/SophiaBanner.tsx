import Image from "next/image";
import { EyBeam } from "./EyBeam";

/**
 * SophiaBanner — the reusable EY SophIA co-brand banner.
 *
 * Cosmic gradient field with the EY beam, the "SophIA" wordmark, and thePower
 * co-brand logo. Two variants:
 * - `hero`: large, used at the top of the voter/projector surfaces.
 * - `confirmation`: compact, used on the post-vote confirmation screen.
 *
 * thePower green is expressed only via the logo (it sits in its own footer row,
 * never adjacent to the EY yellow beam).
 */

export interface SophiaBannerProps {
  variant?: "hero" | "confirmation";
  /** Optional intro copy shown under the wordmark on the hero variant. */
  tagline?: string;
  className?: string;
}

export function SophiaBanner({
  variant = "hero",
  tagline,
  className,
}: SophiaBannerProps) {
  const isHero = variant === "hero";

  return (
    <section
      className={[
        "relative isolate overflow-hidden rounded-xl",
        "bg-cosmic-deep",
        // Hero stays compact on mobile so the content/action below keeps focus.
        isHero ? "px-6 py-6 sm:px-8 sm:py-8" : "px-5 py-6",
        className ?? "",
      ].join(" ")}
      style={{
        backgroundImage:
          "radial-gradient(ellipse 90% 120% at 15% -10%, color-mix(in srgb, var(--color-cosmic-700) 70%, transparent) 0%, transparent 55%), radial-gradient(ellipse 80% 100% at 100% 0%, color-mix(in srgb, var(--color-cosmic-mid) 90%, transparent) 0%, transparent 60%)",
        boxShadow: "var(--shadow-e2)",
      }}
    >
      {/* Soft brand glow, kept far from the beam so the yellow stays the highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-ey-yellow) 22%, transparent) 0%, transparent 70%)",
        }}
      />

      <div
        className={[
          "relative flex flex-col",
          // Hero: centered, tighter composition; confirmation keeps its original layout.
          isHero ? "items-center gap-3 text-center" : "gap-5",
        ].join(" ")}
      >
        <div className={["flex items-center", isHero ? "gap-3" : "gap-4"].join(" ")}>
          <EyBeam surface="dark" size={isHero ? 44 : 38} label="EY" />
          <div className={["flex flex-col", isHero ? "items-start" : ""].join(" ")}>
            <span
              className="font-display font-extrabold leading-none tracking-tight text-text"
              style={{ fontSize: isHero ? "var(--text-h2)" : "var(--text-h3)" }}
            >
              Soph
              <span className="text-sophia-purple">IA</span>
            </span>
            <span className="text-micro uppercase tracking-[0.22em] text-text-dim">
              EN VIVO
            </span>
          </div>
        </div>

        {isHero && tagline && (
          <p className="max-w-md text-balance text-body font-medium leading-snug text-text">
            {tagline}
          </p>
        )}

        {/* Co-brand footer row — thePower logo, set apart from the beam */}
        <div
          className={[
            "flex items-center gap-2 pt-1 text-micro text-text-dim",
            isHero ? "justify-center" : "",
          ].join(" ")}
        >
          <span>en colaboración con</span>
          {/* White chip so thePower's dark-navy logo stays legible on the cosmic bg */}
          <span className="inline-flex items-center rounded-[12px] bg-white px-2.5 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.28)] ring-1 ring-black/5">
            <Image
              src="/brand/thepower-logo.webp"
              alt="thePower"
              width={isHero ? 96 : 72}
              height={isHero ? 24 : 18}
              priority={isHero}
            />
          </span>
        </div>
      </div>
    </section>
  );
}

export default SophiaBanner;
