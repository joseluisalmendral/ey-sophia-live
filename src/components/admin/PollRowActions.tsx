"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QrCode } from "@/components/atoms/QrCode";
import { CopyButton } from "./CopyButton";
import { voteUrl, screenUrl } from "./links";
import { deletePoll } from "@/app/admin/(panel)/poll-actions";

/**
 * Per-poll quick actions for the list row: configure / live control / analytics,
 * open the voter & projector URLs in a new tab, a QR popover with copy buttons,
 * and a confirm-gated delete (removes the poll and — via FK cascade — its teams
 * and votes) so old polls don't pile up.
 */
export function PollRowActions({
  pollId,
  joinCode,
}: {
  pollId: string;
  joinCode: string;
}) {
  const router = useRouter();
  const [showQr, setShowQr] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const vUrl = voteUrl(joinCode);
  const sUrl = screenUrl(joinCode);

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deletePoll(pollId);
      if (!res.ok) {
        setDeleteError(res.error ?? "No se pudo eliminar la votación.");
        return;
      }
      setConfirmDelete(false);
      router.refresh();
    });
  }

  const linkCls =
    "inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-small font-medium text-text-dim transition-colors hover:text-text";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/admin/${pollId}`} className={linkCls}>
        Configurar
      </Link>
      <Link
        href={`/admin/${pollId}?tab=live`}
        className="inline-flex h-9 items-center rounded-md border border-power-green/40 px-3 text-small font-medium text-power-green transition-colors hover:bg-power-green/10"
      >
        Control en vivo
      </Link>
      <Link href={`/admin/${pollId}/analytics`} className={linkCls}>
        Analíticas
      </Link>
      <a href={sUrl} target="_blank" rel="noreferrer" className={linkCls}>
        Pantalla ↗
      </a>
      <a href={vUrl} target="_blank" rel="noreferrer" className={linkCls}>
        Votar ↗
      </a>
      <button
        type="button"
        onClick={() => setShowQr((v) => !v)}
        className={linkCls}
        aria-expanded={showQr}
      >
        QR
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="inline-flex h-9 items-center rounded-md border border-[#FF6B6B]/40 px-3 text-small font-medium text-[#FF9E9E] transition-colors hover:bg-[#FF6B6B]/10"
      >
        Eliminar
      </button>

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label="Confirmar eliminación de la votación"
          className="mt-2 flex w-full flex-col gap-3 rounded-lg border border-[#FF6B6B]/40 bg-[#FF6B6B]/5 p-4"
        >
          <p className="text-small text-text">
            ¿Eliminar esta votación? Se borrarán sus equipos y votos. Esta
            acción no se puede deshacer.
          </p>
          {deleteError && (
            <p role="alert" className="text-small text-[#FF9E9E]">
              {deleteError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-[#FF6B6B] px-4 text-small font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(false);
                setDeleteError(null);
              }}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md border border-white/15 px-4 text-small text-text-dim hover:text-text disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showQr && (
        <div className="mt-2 flex w-full flex-col items-center gap-3 rounded-lg border border-white/10 bg-surface p-4 sm:w-auto">
          <QrCode value={vUrl} size={160} />
          <div className="flex flex-col gap-2">
            <CopyButton value={vUrl} label="Copiar URL de votación" />
            <CopyButton value={sUrl} label="Copiar URL de pantalla" />
            <CopyButton value={joinCode} label={`Copiar código ${joinCode}`} />
          </div>
        </div>
      )}
    </div>
  );
}

export default PollRowActions;
