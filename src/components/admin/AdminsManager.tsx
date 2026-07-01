"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  createAdminWithPassword,
  removeAdmin,
} from "@/app/admin/(panel)/admins/admin-actions";

/**
 * AdminsManager — list, add (email + password), and remove allowlisted admins.
 *
 * Adding an admin creates a pre-confirmed Supabase Auth user (no verification
 * email) and adds the email to the allowlist, so the new admin can sign in with
 * the shared password immediately. The owner sets a password or generates a
 * strong one; the credentials are shown ONCE (with copy) so they can be shared.
 *
 * Remove is confirm-gated. Removing your own account carries an extra warning.
 * The server refuses to remove the last remaining admin (lockout protection) and
 * best-effort deletes the underlying auth user.
 */

const MIN_PASSWORD_LENGTH = 10;

/** Credentials shown once after a successful add, for the owner to copy/share. */
interface CreatedCredentials {
  email: string;
  password: string;
  status: "created" | "existing";
}

export function AdminsManager({
  admins,
  currentEmail,
}: {
  admins: string[];
  currentEmail: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCredentials | null>(null);

  function onGenerate() {
    setPassword(generatePassword());
    setShowPassword(true);
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    const value = email.trim().toLowerCase();
    if (!value) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    startTransition(async () => {
      const res = await createAdminWithPassword(value, password);
      if (!res.ok) {
        setError(humanError(res.error));
        return;
      }
      setCreated({
        email: value,
        password,
        status: res.status ?? "created",
      });
      setEmail("");
      setPassword("");
      setShowPassword(false);
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
      <form onSubmit={onAdd} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="new-admin-email"
            className="text-small font-medium text-text-dim"
          >
            Correo del nuevo administrador
          </label>
          <input
            id="new-admin-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nuevo.admin@empresa.com"
            className="h-11 rounded-lg border border-white/15 bg-surface px-3 text-body text-text placeholder:text-text-dim/60 focus:border-focus focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="new-admin-password"
            className="text-small font-medium text-text-dim"
          >
            Contraseña (mínimo {MIN_PASSWORD_LENGTH} caracteres)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                id="new-admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña para compartir"
                aria-describedby="new-admin-password-hint"
                className="h-11 w-full rounded-lg border border-white/15 bg-surface px-3 pr-24 text-body text-text placeholder:text-text-dim/60 focus:border-focus focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-micro text-text-dim hover:text-text"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <button
              type="button"
              onClick={onGenerate}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-white/15 px-4 font-display text-small font-medium text-text hover:border-focus hover:text-text"
            >
              Generar
            </button>
          </div>
          <p id="new-admin-password-hint" className="text-micro text-text-dim">
            El administrador entrará con este correo y contraseña. No se envía
            ningún email de confirmación.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending || !email.trim() || password.length < MIN_PASSWORD_LENGTH}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-ey-yellow px-5 font-display font-bold text-ey-confident transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear administrador"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-small text-[#FF9E9E]">
          {error}
        </p>
      )}

      {created && (
        <CredentialsCard
          credentials={created}
          onDismiss={() => setCreated(null)}
        />
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

/** One-time credentials panel shown after creating an admin, with copy buttons. */
function CredentialsCard({
  credentials,
  onDismiss,
}: {
  credentials: CreatedCredentials;
  onDismiss: () => void;
}) {
  const combined = `${credentials.email} · ${credentials.password}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-power-green/30 bg-power-green/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-body font-bold text-text">
            {credentials.status === "existing"
              ? "Usuario ya existente"
              : "Administrador creado"}
          </h3>
          <p className="mt-1 text-small text-text-dim">
            {credentials.status === "existing"
              ? "Ese usuario ya existía; lo añadí a administradores y actualicé su contraseña. Comparte estas credenciales de forma segura."
              : "Comparte estas credenciales de forma segura. No volverán a mostrarse."}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar credenciales"
          className="rounded-md px-2 py-1 text-small text-text-dim hover:text-text"
        >
          ✕
        </button>
      </div>

      <dl className="flex flex-col gap-2">
        <CopyRow label="Correo" value={credentials.email} />
        <CopyRow label="Contraseña" value={credentials.password} mono />
      </dl>

      <CopyButton
        value={combined}
        className="inline-flex h-9 w-fit items-center rounded-md bg-ey-yellow px-3 text-small font-medium text-ey-confident hover:opacity-90"
        idleLabel="Copiar ambos"
        doneLabel="Copiado ✓"
      />
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-surface px-3 py-2">
      <div className="min-w-0">
        <dt className="text-micro text-text-dim">{label}</dt>
        <dd
          className={`truncate text-body text-text ${mono ? "font-mono" : ""}`}
        >
          {value}
        </dd>
      </div>
      <CopyButton
        value={value}
        className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-micro text-text-dim hover:text-text"
        idleLabel="Copiar"
        doneLabel="✓"
      />
    </div>
  );
}

function CopyButton({
  value,
  className,
  idleLabel,
  doneLabel,
}: {
  value: string;
  className?: string;
  idleLabel: string;
  doneLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard may be unavailable (insecure context); ignore silently.
        }
      }}
      className={className}
    >
      {copied ? doneLabel : idleLabel}
    </button>
  );
}

/** Generate a strong random password (>= MIN_PASSWORD_LENGTH) using WebCrypto. */
function generatePassword(length = 16): string {
  // Ambiguous chars (0/O, 1/l/I) omitted for shareability.
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?";
  const target = Math.max(length, MIN_PASSWORD_LENGTH);
  const bytes = new Uint32Array(target);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < target; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

function humanError(code?: string): string {
  switch (code) {
    case "invalid_email":
      return "El correo no es válido.";
    case "weak_password":
      return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    case "cannot_remove_last_admin":
      return "No puedes quitar al último administrador.";
    case "not_authorized":
      return "No tienes permisos para esta acción.";
    default:
      return code ?? "Error";
  }
}

export default AdminsManager;
