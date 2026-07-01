import type { PollStatus } from "@/lib/types";

/**
 * StatusBadge — compact poll-status pill. Status is never encoded in color
 * alone: each carries an explicit label and a small dot, so it reads under
 * pressure and for colorblind operators.
 */

const STYLES: Record<PollStatus, { label: string; dot: string; chip: string }> =
  {
    draft: {
      label: "Borrador",
      dot: "bg-ey-gray2",
      chip: "border-white/15 text-text-dim",
    },
    countdown: {
      label: "Cuenta atrás",
      dot: "bg-focus",
      chip: "border-focus/40 text-focus",
    },
    open: {
      label: "Abierta",
      dot: "bg-power-green",
      chip: "border-power-green/40 text-power-green",
    },
    closed: {
      label: "Cerrada",
      dot: "bg-ey-yellow",
      chip: "border-ey-yellow/40 text-ey-yellow",
    },
  };

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: PollStatus;
  size?: "sm" | "lg";
}) {
  const s = STYLES[status];
  const pad = size === "lg" ? "px-3 py-1.5 text-small" : "px-2.5 py-1 text-micro";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border font-medium uppercase tracking-wide ${pad} ${s.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

export default StatusBadge;
