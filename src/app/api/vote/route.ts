import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSecretClient } from "@/lib/supabase/server";

/**
 * POST /api/vote  — the anti-fraud vote path (Axis A: one vote per device).
 *
 * Body: { pollId: string, teamId: string }
 *
 * Device identity is an ephemeral, per-poll-RUN, HMAC-signed httpOnly cookie
 * `vt_<pollId>_r<runSeq>`. The token is httpOnly on purpose: JS can never read
 * it, so it can't be copied/forged client-side. The cookie's ONLY purpose is
 * delivering the requested service (vote once) => strictly-necessary,
 * consent-exempt. The run sequence is read SERVER-SIDE from polls.run_seq
 * (never trusted from the body), so relaunching a poll (run_seq bump) instantly
 * re-enables voting for every device: old-run cookies simply stop matching and
 * expire on their own.
 *
 * Flow:
 *  1. Read & verify the signed cookie. If missing/invalid, mint a fresh random
 *     token, HMAC-sign it, and set the cookie (httpOnly + Secure + SameSite=Lax,
 *     path-scoped to this poll's vote calls).
 *  2. Call `cast_vote(p_poll_id, p_team_id, p_voter_token)` via the SECRET
 *     server client. The DB's UNIQUE(poll_id, voter_token) is the real wall.
 *  3. Return { result } where result ∈
 *     'ok' | 'already_voted' | 'not_open' | 'closed' | 'invalid_team'.
 *
 * ALWAYS responds with `Cache-Control: private, no-store` so a per-user vote
 * response (and its Set-Cookie) is never cached by the CDN across users.
 *
 * Signing secret: VOTE_SECRET if set, else CRON_SECRET (already present in
 * .env.local). Document a dedicated VOTE_SECRET for production rotation.
 */

export const runtime = "nodejs";

type CastVoteResult =
  | "ok"
  | "already_voted"
  | "not_open"
  | "closed"
  | "invalid_team";

const COOKIE_PREFIX = "vt_";
const NO_STORE = "private, no-store";

function getSecret(): string {
  const secret = process.env.VOTE_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    throw new Error(
      "Missing VOTE_SECRET (or CRON_SECRET fallback) for vote cookie signing",
    );
  }
  return secret;
}

/** Cookie value format: `<token>.<base64url hmac>`. */
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

function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", NO_STORE);
  return res;
}

export async function POST(request: Request): Promise<NextResponse> {
  let pollId: string;
  let teamId: string;
  try {
    const body = (await request.json()) as {
      pollId?: unknown;
      teamId?: unknown;
    };
    if (typeof body.pollId !== "string" || typeof body.teamId !== "string") {
      return jsonNoStore({ error: "invalid_body" }, { status: 400 });
    }
    pollId = body.pollId;
    teamId = body.teamId;
  } catch {
    return jsonNoStore({ error: "invalid_body" }, { status: 400 });
  }

  const secret = getSecret();

  // Resolve the poll's current run server-side (secret client, RLS-exempt).
  // The run scopes the dedup cookie name; a relaunch bumps run_seq and thereby
  // invalidates every previous-run cookie without any migration.
  const supabase = createSecretClient();
  const { data: pollRow, error: pollRowError } = await supabase
    .from("polls")
    .select("run_seq")
    .eq("id", pollId)
    .maybeSingle<{ run_seq: number }>();

  if (pollRowError) {
    return jsonNoStore({ error: "vote_failed" }, { status: 502 });
  }
  if (!pollRow) {
    return jsonNoStore({ error: "poll_not_found" }, { status: 404 });
  }

  const runSeq = pollRow.run_seq;
  const cookieName = `${COOKIE_PREFIX}${pollId}_r${runSeq}`;

  // Parse cookies from the request header (Route Handler, no next/headers needed).
  const cookieHeader = request.headers.get("cookie") ?? "";
  const existingSigned = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  let token = verify(
    existingSigned ? decodeURIComponent(existingSigned) : undefined,
    secret,
  );

  let mintCookie: string | null = null;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    mintCookie = sign(token, secret);
  }

  // Cast the vote. DB is law: UNIQUE(poll_id, voter_token) blocks doubles.
  const { data, error } = await supabase.rpc("cast_vote", {
    p_poll_id: pollId,
    p_team_id: teamId,
    p_voter_token: token,
  });

  if (error) {
    return jsonNoStore({ error: "vote_failed" }, { status: 502 });
  }

  const result = data as CastVoteResult;
  const res = jsonNoStore({ result });

  // Set the signed cookie only when we minted a fresh token. Path-scoped to the
  // API so it travels with vote calls; ephemeral via Max-Age.
  if (mintCookie) {
    res.cookies.set({
      name: cookieName,
      value: mintCookie,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/vote",
      maxAge: 60 * 60 * 12, // 12h: covers the event, then discarded.
    });
  }

  // On a confirmed vote, drop a READABLE (non-httpOnly) marker scoped to /vote
  // so the vote page's server component can render the "already voted" view on
  // reload. This is NOT a security wall — the signed httpOnly run-scoped cookie
  // above remains the only anti-fraud guard. The marker carries no team
  // identity (neutral signal only), is path-scoped to /vote (the dedup
  // cookie's /api/vote path never reaches the page), and is run-scoped too so a
  // relaunch renders the fresh voting cards instead of "already voted".
  if (result === "ok") {
    res.cookies.set({
      name: `voted_${pollId}_r${runSeq}`,
      value: "1",
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/vote",
      maxAge: 60 * 60 * 12, // Match the dedup cookie lifetime.
    });
  }

  return res;
}
