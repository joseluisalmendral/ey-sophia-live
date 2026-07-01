import { NextResponse } from "next/server";
import { createSecretClient } from "@/lib/supabase/server";

/**
 * Cron keep-alive — prevents Supabase's free-tier project from being paused
 * after 7 days of inactivity. Vercel Cron hits this daily (see vercel.json) and
 * we run a trivial SELECT so the Postgres project registers activity.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We verify it
 * with a constant-time comparison and return 401 on any mismatch so the endpoint
 * cannot be abused as an open DB ping.
 */
export const runtime = "nodejs";

/** Constant-time string compare; false when lengths differ. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || !authHeader || !timingSafeEqual(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Stateless secret client: no cookies, safe for a session-less cron. The query
  // itself is what matters (it warms the DB); a benign error still returns 200.
  const supabase = createSecretClient();
  const { error } = await supabase.from("polls").select("id").limit(1);

  if (error) {
    console.error("[cron/keepalive] select failed:", error.message);
  }

  return NextResponse.json({ ok: true });
}
