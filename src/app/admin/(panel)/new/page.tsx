import Link from "next/link";
import { PollConfigForm, type PollConfigInitial } from "@/components/admin/PollConfigForm";
import { generateJoinCode } from "@/components/admin/joinCode";
import { INTERVAL_DEFAULTS } from "@/lib/assistant/scheduler";

/**
 * New poll — /admin/new
 *
 * Renders the config form in create mode with sensible defaults and a
 * pre-generated memorable join code. On submit the action creates the poll and
 * redirects to /admin/[poll].
 */

export const dynamic = "force-dynamic";

export default function NewPollPage() {
  const initial: PollConfigInitial = {
    title: "",
    joinCode: generateJoinCode(5),
    countdownSeconds: 5,
    durationSeconds: null,
    chartType: "bar_race",
    showLegend: true,
    showNames: true,
    anonymousDisplay: false,
    tieRule: "first_to_count",
    teams: [
      { name: "", color: "#FFE600" },
      { name: "", color: "#96d3b4" },
    ],
    // Broqui is opt-in: new polls start with the mascot OFF.
    assistantEnabled: false,
    assistantMinSeconds: INTERVAL_DEFAULTS.min,
    assistantMaxSeconds: INTERVAL_DEFAULTS.max,
  };

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin" className="text-small text-text-dim hover:text-text">
          ← Votaciones
        </Link>
        <h1 className="mt-2 font-display text-h1 font-extrabold text-text">
          Nueva votación
        </h1>
      </div>
      <PollConfigForm initial={initial} />
    </div>
  );
}
