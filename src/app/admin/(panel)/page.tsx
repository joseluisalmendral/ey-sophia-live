import Link from "next/link";
import { listPolls } from "./poll-data";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PollRowActions } from "@/components/admin/PollRowActions";

/**
 * Poll list — /admin
 *
 * Lists every poll with its status, join code and creation date, plus quick
 * links to configure, run live control, view analytics, and open the voter /
 * projector URLs (with QR + copy). "Nueva votación" creates a fresh poll.
 */

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function AdminPollsPage() {
  const polls = await listPolls();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-extrabold text-text">
            Votaciones
          </h1>
          <p className="mt-1 text-small text-text-dim">
            {polls.length === 0
              ? "Todavía no hay votaciones."
              : `${polls.length} ${polls.length === 1 ? "votación" : "votaciones"}`}
          </p>
        </div>
        <Link
          href="/admin/new"
          className="inline-flex h-11 items-center rounded-lg bg-ey-yellow px-5 font-display text-body font-bold text-ey-confident transition-opacity hover:opacity-90"
        >
          + Nueva votación
        </Link>
      </div>

      {polls.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-surface-raised/50 p-12 text-center">
          <p className="text-body text-text-dim">
            Crea tu primera votación para empezar.
          </p>
          <Link
            href="/admin/new"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-ey-yellow px-5 font-display font-bold text-ey-confident transition-opacity hover:opacity-90"
          >
            + Nueva votación
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {polls.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-white/10 bg-surface-raised p-4 shadow-[var(--shadow-e1)] transition-colors hover:border-white/20"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/${p.id}`}
                      className="truncate font-display text-h3 font-bold text-text hover:text-ey-yellow"
                    >
                      {p.title}
                    </Link>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-micro text-text-dim">
                    <span className="font-mono uppercase tracking-widest text-text">
                      {p.joinCode}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(p.createdAt)}</span>
                  </div>
                </div>
                <PollRowActions pollId={p.id} joinCode={p.joinCode} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
