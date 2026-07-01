"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { EyBeam } from "@/components/brand/EyBeam";
import { siteUrl } from "@/lib/utils/siteUrl";

/**
 * Admin login — /admin/login
 *
 * PRIMARY: email + password via signInWithPassword. Admins are created by the
 * owner with a pre-confirmed auth user, so they can sign in directly with the
 * shared password — no email confirmation step.
 *
 * SECONDARY: magic link via signInWithOtp (kept as a fallback). The link returns
 * to /auth/confirm?next=/admin which establishes the session, then bounces to
 * /admin.
 *
 * Allowlist enforcement happens AFTER auth in the admin layout (and at the DB via
 * is_admin()): a non-allowlisted user can sign in but is then shown a clear "No
 * autorizado" screen.
 */

type PasswordPhase = "idle" | "signing" | "error";
type MagicPhase = "idle" | "sending" | "sent" | "error";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic">("password");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <EyBeam surface="dark" size={60} />
          <div>
            <h1 className="font-display text-h1 font-extrabold text-text">
              Panel de administración
            </h1>
            <p className="mt-1 text-small text-text-dim">
              SophIA Live · acceso solo para administradores
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-surface-raised p-6 shadow-[var(--shadow-e2)]">
          {mode === "password" ? (
            <PasswordForm
              onSuccess={() => router.push("/admin")}
              onUseMagicLink={() => setMode("magic")}
            />
          ) : (
            <MagicLinkForm onUsePassword={() => setMode("password")} />
          )}
        </div>
      </div>
    </main>
  );
}

function PasswordForm({
  onSuccess,
  onUseMagicLink,
}: {
  onSuccess: () => void;
  onUseMagicLink: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<PasswordPhase>("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) return;

    setPhase("signing");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });

    if (error) {
      setPhase("error");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-email"
          className="text-small font-medium text-text-dim"
        >
          Correo de administrador
        </label>
        <input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu.correo@empresa.com"
          className="h-12 rounded-lg border border-white/15 bg-surface px-4 text-body text-text placeholder:text-text-dim/60 focus:border-focus focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-password"
          className="text-small font-medium text-text-dim"
        >
          Contraseña
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            className="h-12 w-full rounded-lg border border-white/15 bg-surface px-4 pr-24 text-body text-text placeholder:text-text-dim/60 focus:border-focus focus:outline-none"
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
      </div>

      {phase === "error" && (
        <p
          role="alert"
          className="rounded-md bg-[#FF6B6B]/10 px-3 py-2 text-small text-[#FF9E9E]"
        >
          Email o contraseña incorrectos.
        </p>
      )}

      <button
        type="submit"
        disabled={phase === "signing" || !email.trim() || !password}
        className="h-12 rounded-lg bg-ey-yellow font-display text-body font-bold text-ey-confident transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {phase === "signing" ? "Entrando…" : "Entrar"}
      </button>

      <button
        type="button"
        onClick={onUseMagicLink}
        className="text-center text-small text-focus underline-offset-2 hover:underline"
      >
        o entra con un enlace mágico
      </button>
    </form>
  );
}

function MagicLinkForm({ onUsePassword }: { onUsePassword: () => void }) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<MagicPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setPhase("sending");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${siteUrl()}/auth/confirm?next=/admin`,
      },
    });

    if (error) {
      setPhase("error");
      setMessage(error.message);
      return;
    }
    setPhase("sent");
  }

  if (phase === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-power-green/15 text-3xl"
        >
          📬
        </div>
        <h2 className="font-display text-h3 font-bold text-text">
          Revisa tu correo
        </h2>
        <p className="text-small text-text-dim">
          Te hemos enviado un enlace de acceso a{" "}
          <span className="font-medium text-text">{email}</span>. Ábrelo en este
          mismo dispositivo para entrar.
        </p>
        <button
          type="button"
          onClick={onUsePassword}
          className="mt-2 text-small text-focus underline-offset-2 hover:underline"
        >
          Entrar con contraseña
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="magic-email"
          className="text-small font-medium text-text-dim"
        >
          Correo de administrador
        </label>
        <input
          id="magic-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu.correo@empresa.com"
          className="h-12 rounded-lg border border-white/15 bg-surface px-4 text-body text-text placeholder:text-text-dim/60 focus:border-focus focus:outline-none"
        />
      </div>

      {phase === "error" && message && (
        <p
          role="alert"
          className="rounded-md bg-[#FF6B6B]/10 px-3 py-2 text-small text-[#FF9E9E]"
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={phase === "sending" || !email.trim()}
        className="h-12 rounded-lg bg-ey-yellow font-display text-body font-bold text-ey-confident transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {phase === "sending" ? "Enviando…" : "Enviar enlace de acceso"}
      </button>

      <button
        type="button"
        onClick={onUsePassword}
        className="text-center text-small text-focus underline-offset-2 hover:underline"
      >
        Entrar con contraseña
      </button>
    </form>
  );
}
