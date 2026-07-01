"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { EyBeam } from "@/components/brand/EyBeam";

/**
 * Admin magic-link login — /admin/login
 *
 * Sends a one-time magic link via Supabase OTP. The link returns to
 * /auth/confirm?next=/admin which establishes the session, then bounces here-to
 * /admin. Allowlist enforcement happens AFTER auth in the admin layout (and at
 * the DB via is_admin()): a non-allowlisted email can sign in but is then shown
 * a clear "No autorizado" screen.
 *
 * SITE_URL resolves from NEXT_PUBLIC_SITE_URL, falling back to localhost for dev.
 */

function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

type Phase = "idle" | "sending" | "sent" | "error";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
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
          {phase === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full bg-power-green/15 text-3xl"
              >
                📬
              </div>
              <h2 className="font-display text-h3 font-bold text-text">
                Revisá tu correo
              </h2>
              <p className="text-small text-text-dim">
                Te enviamos un enlace de acceso a{" "}
                <span className="font-medium text-text">{email}</span>. Abrilo en
                este mismo dispositivo para entrar.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setMessage(null);
                }}
                className="mt-2 text-small text-focus underline-offset-2 hover:underline"
              >
                Usar otro correo
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-small font-medium text-text-dim">
                  Correo de administrador
                </span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu.correo@empresa.com"
                  className="h-12 rounded-lg border border-white/15 bg-surface px-4 text-body text-text placeholder:text-text-dim/60 focus:border-focus focus:outline-none"
                />
              </label>

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

              <p className="text-center text-micro text-text-dim">
                Sin contraseñas. Te enviamos un enlace de un solo uso.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
