"use client";

import { useEffect } from "react";
import { ShaderBackground } from "@/components/providers/ShaderBackground";
import { EyBeam } from "@/components/brand/EyBeam";

/**
 * Route error boundary — a branded cosmic full-screen fallback for uncaught
 * errors within the app tree (the root layout still wraps this one).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for observability; the digest is safe to log.
    console.error("[app/error]", error);
  }, [error]);

  return (
    <ShaderBackground>
      <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-6">
          <EyBeam surface="dark" size={64} />
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-h1 font-extrabold text-text">
              Algo salió mal
            </h1>
            <p className="max-w-sm text-body text-text-dim">
              Se produjo un error inesperado. Podés reintentar; si continúa,
              actualizá la página en unos segundos.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="h-12 rounded-lg bg-ey-yellow px-6 font-display text-body font-bold text-ey-confident transition-opacity hover:opacity-90"
          >
            Reintentar
          </button>
        </div>
      </main>
    </ShaderBackground>
  );
}
