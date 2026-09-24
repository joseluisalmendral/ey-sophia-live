import type { Metadata } from "next";
import { guardLab } from "../guard";
import { MascotLab } from "./MascotLab";
import { EXPRESSIONS, type Expression } from "@/components/mascot/expressions";

/**
 * /lab/mascot — Broqui review & QA gallery (no Supabase, no data hooks).
 *
 * Guarded in production: only reachable on previews / locally, or when
 * ENABLE_LAB=1 is set explicitly. Query params preset the big stage so QA
 * scripts can screenshot a given state: ?expr=smug&size=360&talking=1&reduced=1
 */

export const metadata: Metadata = {
  title: "Broqui · Laboratorio",
  robots: { index: false, follow: false },
};

const SIZES = new Set([96, 200, 360]);

function pick<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export default async function MascotLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  guardLab();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const size = Number(one("size"));
  return (
    <MascotLab
      initialExpression={pick<Expression>(one("expr"), EXPRESSIONS) ?? "idle"}
      initialSize={SIZES.has(size) ? (size as 96 | 200 | 360) : 200}
      initialTalking={one("talking") === "1"}
      initialReduced={one("reduced") === "1"}
      initialGrid={one("grid") !== "0"}
    />
  );
}
