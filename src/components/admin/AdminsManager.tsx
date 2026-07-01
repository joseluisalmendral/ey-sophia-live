"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addAdmin, removeAdmin } from "@/app/admin/(panel)/admins/admin-actions";

/**
 * AdminsManager — list, add, and remove allowlisted admin emails.
 *
 * Remove is confirm-gated. Removing your own account carries an extra warning
 * (you would lose access on next sign-in). The server also refuses to remove the
 * last remaining admin (lockout protection).
 */
export function AdminsManager({
  admins,
  currentEmail,
}: {
  admins: string[];
  currentEmail: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!value) return;
    startTransition(async () => {
      const res = await addAdmin(value);
      if (!res.ok) {
        setError(humanError(res.error));
        return;
      }
      setEmail("");
      // Server action already revalidatePath("/admin/admins"); no manual refresh.
    });
  }

  function onRemove(target: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeAdmin(target);
      if (!res.ok) {
        setError(humanError(res.error));
        return;
      }
      setConfirming(null);
      // Server action already revalidatePath("/admin/admins"); no manual refresh.
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={onAdd}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-small font-medium text-text-dim">
            Añadir administrador (correo)
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nuevo.admin@empresa.com"
            className="h-11 rounded-lg border border-white/15 bg-surface px-3 text-body text-text placeholder:text-text-dim/60 focus:border-focus focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !email.trim()}
          className="inline-flex h-11 items-center rounded-lg bg-ey-yellow px-5 font-display font-bold text-ey-confident transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Añadir
        </button>
      </form>

      {error && (
        <p role="alert" className="text-small text-[#FF9E9E]">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {admins.map((a) => {
          const isSelf = currentEmail != null && a === currentEmail;
          return (
            <li
              key={a}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-surface-raised px-4 py-3"
            >
              <span className="flex items-center gap-2 text-body text-text">
                {a}
                {isSelf && (
                  <span className="rounded-pill bg-power-green/15 px-2 py-0.5 text-micro text-power-green">
                    tú
                  </span>
                )}
              </span>

              {confirming === a ? (
                <span className="flex items-center gap-2">
                  {isSelf && (
                    <span className="text-micro text-[#FF9E9E]">
                      Perderás tu acceso
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onRemove(a)}
                    className="inline-flex h-9 items-center rounded-md bg-[#FF6B6B] px-3 text-small font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-small text-text-dim hover:text-text"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(a)}
                  className="inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-small text-text-dim hover:border-[#FF6B6B]/50 hover:text-[#FF9E9E]"
                >
                  Quitar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function humanError(code?: string): string {
  switch (code) {
    case "invalid_email":
      return "El correo no es válido.";
    case "cannot_remove_last_admin":
      return "No puedes quitar al último administrador.";
    case "not_authorized":
      return "No tienes permisos para esta acción.";
    default:
      return code ?? "Error";
  }
}

export default AdminsManager;
