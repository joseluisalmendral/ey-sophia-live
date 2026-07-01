"use client";

import { useEffect } from "react";

/**
 * Global error boundary — replaces the ROOT layout when an error is thrown in
 * the root layout/template itself, so it must render its own <html>/<body> and
 * cannot rely on the Tailwind theme being present. Everything is inline-styled
 * with the cosmic palette so the fallback always renders on brand.
 */

const COSMIC_DEEP = "#0B1026";
const OFF_WHITE = "#F6F6FA";
const TEXT_DIM = "#C4C4CD";
const EY_YELLOW = "#FFE600";
const EY_CONFIDENT = "#1A1A24";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
          textAlign: "center",
          backgroundColor: COSMIC_DEEP,
          color: OFF_WHITE,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 8,
            borderRadius: 9999,
            backgroundColor: EY_YELLOW,
          }}
        />
        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800 }}>
          Algo salió mal
        </h1>
        <p style={{ margin: 0, maxWidth: 360, color: TEXT_DIM }}>
          Se produjo un error crítico. Reintentá; si continúa, actualizá la
          página.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            height: 48,
            padding: "0 24px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "1rem",
            backgroundColor: EY_YELLOW,
            color: EY_CONFIDENT,
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
