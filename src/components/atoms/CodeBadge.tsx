/**
 * CodeBadge — the big, memorable join code shown on the projector lobby (and
 * echoed small elsewhere). Monospaced, wide letter-spacing, EY-yellow accent on
 * the cosmic surface so it reads from the back of a room.
 *
 * Sizes:
 *  - `hero`: projector-scale, for the lobby big screen.
 *  - `inline`: compact, for headers/footers.
 */

export interface CodeBadgeProps {
  code: string;
  size?: "hero" | "inline";
  /** Small caption above the code, e.g. "Join code". */
  caption?: string;
  className?: string;
}

export function CodeBadge({
  code,
  size = "hero",
  caption,
  className,
}: CodeBadgeProps) {
  const isHero = size === "hero";
  return (
    <div
      className={[
        "inline-flex flex-col items-center gap-1.5",
        className ?? "",
      ].join(" ")}
    >
      {caption && (
        <span
          className={[
            "uppercase tracking-[0.28em] text-text-dim",
            isHero ? "text-small" : "text-micro",
          ].join(" ")}
        >
          {caption}
        </span>
      )}
      <span
        className={[
          "rounded-lg border border-ey-yellow/30 bg-ey-yellow/5 font-display font-extrabold uppercase tabular-nums tracking-[0.18em] text-ey-yellow",
          isHero ? "px-6 py-3 text-display" : "px-3 py-1.5 text-h3",
        ].join(" ")}
        style={isHero ? { textShadow: "0 0 24px rgba(255,230,0,0.35)" } : undefined}
      >
        {code}
      </span>
    </div>
  );
}

export default CodeBadge;
