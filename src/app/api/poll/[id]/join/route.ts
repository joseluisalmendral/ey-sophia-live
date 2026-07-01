import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createPublicReadClient,
  resolvePollFilter,
} from "@/lib/supabase/public-read";

/**
 * POST /api/poll/[id]/join — one-shot anonymous lobby join event.
 *
 * Replaces the voter-side presence WebSocket: while a phone sits in the lobby
 * it fires exactly ONE HTTP POST with its anonymous alias ("Vega 12"). The
 * projector polls the sibling GET /lobby endpoint for the feed. Zero realtime
 * connections on the voter path.
 *
 * The insert goes through the `join_lobby` RPC, which stamps the poll's
 * CURRENT run_seq server-side and only accepts joins while the poll is
 * pre-open (draft/countdown). Fire-and-forget semantics: the endpoint never
 * fails loudly — join ambience must never affect the voting flow.
 *
 * Abuse mitigation (proportional to a room event, not a bank):
 *  - The alias is validated server-side against a strict whitelist (letters
 *    incl. accents, digits, spaces; max 24 chars) — it is projected ON THE BIG
 *    SCREEN, so arbitrary strings are rejected outright.
 *  - Dedupe via an HMAC-signed httpOnly cookie scoped per poll+run (same
 *    pattern as /api/vote): a browser that already joined this run gets an
 *    idempotent ok without re-inserting, so inflating the counter/feed
 *    requires rotating cookies per request.
 *
 * `[id]` may be a poll UUID OR a short join code, matching /vote/[poll].
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

// Letters (any script incl. accented), digits and spaces only — the alias is
// rendered on the projector. Length capped at 24.
const ALIAS_MAX_LENGTH = 24;
const ALIAS_RE = /^[\p{L}\p{N} ]{1,24}$/u;

const COOKIE_PREFIX = "join_";

function getSecret(): string {
  const secret = process.env.VOTE_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    throw new Error(
      "Missing VOTE_SECRET (or CRON_SECRET fallback) for join cookie signing",
    );
  }
  return secret;
}

/** Cookie value format: `<token>.<base64url hmac>` (same scheme as /api/vote). */
function sign(token: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(token).digest("base64url");
  return `${token}.${mac}`;
}

/** Returns the verified token if the signed value is authentic, else null. */
function verify(signed: string | undefined, secret: string): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const token = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expected = createHmac("sha256", secret)
    .update(token)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? token : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  let alias: unknown;
  try {
    ({ alias } = (await request.json()) as { alias?: unknown });
  } catch {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400, headers: NO_STORE },
    );
  }
  const trimmedAlias =
    typeof alias === "string" ? alias.trim().slice(0, ALIAS_MAX_LENGTH) : "";
  if (!ALIAS_RE.test(trimmedAlias)) {
    return NextResponse.json(
      { error: "invalid_alias" },
      { status: 400, headers: NO_STORE },
    );
  }

  const supabase = createPublicReadClient();
  const { column, value } = resolvePollFilter(id);
  const { data: poll } = await supabase
    .from("polls")
    .select("id, run_seq")
    .eq(column, value)
    .maybeSingle<{ id: string; run_seq: number }>();

  if (!poll) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE },
    );
  }

  // Cheap server-side dedupe: one join per browser per poll RUN. The cookie
  // name is run-scoped so a relaunch (run_seq bump) naturally re-enables one
  // fresh join for phones still on the page.
  const secret = getSecret();
  const cookieName = `${COOKIE_PREFIX}${poll.id}_r${poll.run_seq}`;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const existingSigned = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  const existingToken = verify(
    existingSigned ? decodeURIComponent(existingSigned) : undefined,
    secret,
  );

  if (existingToken) {
    // Already joined this run — idempotent ok, no re-insert.
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const { error } = await supabase.rpc("join_lobby", {
    p_poll_id: poll.id,
    p_alias: trimmedAlias,
  });

  if (error) {
    // Ambience only — report a soft failure, never a 5xx page in the voter.
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: NO_STORE },
    );
  }

  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set({
    name: cookieName,
    value: sign(randomBytes(24).toString("base64url"), secret),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/poll",
    maxAge: 60 * 60 * 12, // 12h: covers the event, then discarded.
  });
  return res;
}
