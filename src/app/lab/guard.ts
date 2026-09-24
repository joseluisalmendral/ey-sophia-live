import { notFound } from "next/navigation";

/**
 * /lab production guard: rehearsal routes are reachable on previews and
 * locally, and in production only when ENABLE_LAB=1 is set explicitly.
 * Call it at the top of every /lab page (server side, per request).
 */
export function guardLab(): void {
  if (process.env.VERCEL_ENV === "production" && process.env.ENABLE_LAB !== "1") {
    notFound();
  }
}
