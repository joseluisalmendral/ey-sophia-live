"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/auth";
import type { ChartType, PollStatus, TieRule } from "@/lib/types";
import { generateJoinCode, isValidJoinCode } from "@/components/admin/joinCode";
import { validateInterval } from "@/lib/assistant/scheduler";

/**
 * Admin mutations for polls, teams, status transitions, and the admins
 * allowlist. All run through the request-scoped authenticated SSR client, so
 * the DB's RLS (is_admin()) is the real wall; we also guard at the action entry
 * for a fast, clear failure on the server.
 *
 * Writes use the supabase client (RLS) for polls/teams/admins. Status changes
 * go through the set_poll_status RPC (stamps opens_at/closes_at correctly).
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Populated by createPoll so the caller can navigate to the new poll. */
  pollId?: string;
}

async function guard(): Promise<string | null> {
  return (await isAdmin()) ? null : "not_authorized";
}

interface TeamInput {
  id?: string; // present when editing an existing team
  name: string;
  color: string;
}

export interface PollFormInput {
  id?: string;
  title: string;
  joinCode: string;
  countdownSeconds: number | null;
  durationSeconds: number | null;
  chartType: ChartType;
  showLegend: boolean;
  showNames: boolean;
  anonymousDisplay: boolean;
  tieRule: TieRule;
  teams: TeamInput[];
  /**
   * Broqui on/off. The admin UI keeps ONE shared value for the config form
   * and the Live Control switch (PollWorkspace), so the form always submits
   * the CURRENT value and a save can never overwrite the live toggle.
   */
  assistantEnabled: boolean;
  assistantMinSeconds: number;
  assistantMaxSeconds: number;
}

/** Ensure the join code is unique (ignoring the poll being edited). */
async function ensureUniqueCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  code: string,
  excludePollId?: string,
): Promise<string> {
  let candidate = code.trim().toUpperCase();
  // Try up to a handful of times before giving up to a longer code.
  for (let attempt = 0; attempt < 8; attempt++) {
    const query = supabase
      .from("polls")
      .select("id")
      .eq("join_code", candidate);
    const { data } = await query;
    const clash = (data ?? []).some(
      (r: { id: string }) => r.id !== excludePollId,
    );
    if (!clash) return candidate;
    candidate = generateJoinCode(attempt < 4 ? 5 : 6);
  }
  return candidate;
}

export async function createPoll(input: PollFormInput): Promise<ActionResult> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  if (!input.title.trim()) return { ok: false, error: "title_required" };
  const intervalError = validateInterval({
    min: input.assistantMinSeconds,
    max: input.assistantMaxSeconds,
  });
  if (intervalError) return { ok: false, error: intervalError };

  const supabase = await createClient();
  const code = isValidJoinCode(input.joinCode)
    ? input.joinCode.trim().toUpperCase()
    : generateJoinCode(5);
  const uniqueCode = await ensureUniqueCode(supabase, code);

  const { data: poll, error } = await supabase
    .from("polls")
    .insert({
      title: input.title.trim(),
      join_code: uniqueCode,
      countdown_seconds: input.countdownSeconds,
      duration_seconds: input.durationSeconds,
      chart_type: input.chartType,
      show_legend: input.showLegend,
      show_names: input.showNames,
      anonymous_display: input.anonymousDisplay,
      tie_rule: input.tieRule,
      assistant_enabled: input.assistantEnabled,
      assistant_min_interval_s: input.assistantMinSeconds,
      assistant_max_interval_s: input.assistantMaxSeconds,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !poll) return { ok: false, error: error?.message ?? "insert_failed" };

  const teamsToInsert = input.teams
    .filter((t) => t.name.trim())
    .map((t, i) => ({
      poll_id: poll.id,
      name: t.name.trim(),
      color: t.color,
      position: i,
    }));

  if (teamsToInsert.length > 0) {
    const { error: teamErr } = await supabase.from("teams").insert(teamsToInsert);
    if (teamErr) return { ok: false, error: teamErr.message };
  }

  revalidatePath("/admin");
  return { ok: true, pollId: poll.id };
}

export async function updatePoll(input: PollFormInput): Promise<ActionResult> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  if (!input.id) return { ok: false, error: "missing_poll_id" };
  if (!input.title.trim()) return { ok: false, error: "title_required" };
  const intervalError = validateInterval({
    min: input.assistantMinSeconds,
    max: input.assistantMaxSeconds,
  });
  if (intervalError) return { ok: false, error: intervalError };

  const supabase = await createClient();
  const code = isValidJoinCode(input.joinCode)
    ? input.joinCode.trim().toUpperCase()
    : generateJoinCode(5);
  const uniqueCode = await ensureUniqueCode(supabase, code, input.id);

  const { error } = await supabase
    .from("polls")
    .update({
      title: input.title.trim(),
      join_code: uniqueCode,
      countdown_seconds: input.countdownSeconds,
      duration_seconds: input.durationSeconds,
      chart_type: input.chartType,
      show_legend: input.showLegend,
      show_names: input.showNames,
      anonymous_display: input.anonymousDisplay,
      tie_rule: input.tieRule,
      // The form submits the shared (current) Broqui value; only a real
      // boolean from the wire is written.
      ...(typeof input.assistantEnabled === "boolean"
        ? { assistant_enabled: input.assistantEnabled }
        : {}),
      assistant_min_interval_s: input.assistantMinSeconds,
      assistant_max_interval_s: input.assistantMaxSeconds,
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };

  // Reconcile teams: update existing, insert new, delete removed.
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("poll_id", input.id);
  const existingIds = new Set((existing ?? []).map((t: { id: string }) => t.id));
  const keptIds = new Set(
    input.teams.filter((t) => t.id).map((t) => t.id as string),
  );

  // Delete teams the admin removed.
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("teams")
      .delete()
      .in("id", toDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  // Upsert kept + new teams with their order.
  for (let i = 0; i < input.teams.length; i++) {
    const t = input.teams[i];
    if (!t.name.trim()) continue;
    if (t.id && existingIds.has(t.id)) {
      const { error: upErr } = await supabase
        .from("teams")
        .update({ name: t.name.trim(), color: t.color, position: i })
        .eq("id", t.id);
      if (upErr) return { ok: false, error: upErr.message };
    } else {
      const { error: insErr } = await supabase.from("teams").insert({
        poll_id: input.id,
        name: t.name.trim(),
        color: t.color,
        position: i,
      });
      if (insErr) return { ok: false, error: insErr.message };
    }
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/${input.id}`);
  return { ok: true, pollId: input.id };
}

export async function deletePoll(pollId: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  const supabase = await createClient();
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Archive the current results of a CLOSED poll as a poll_run and reset it to a
 * clean draft (0 votes, run_seq+1). The RPC locks the poll row and requires
 * status='closed', so a double click fails cleanly on the second call
 * ('poll_not_closed') instead of double-archiving.
 */
export async function relaunchPoll(pollId: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  const supabase = await createClient();
  const { error } = await supabase.rpc("relaunch_poll", { p_poll_id: pollId });
  if (error) {
    const msg = error.message.includes("poll_not_closed")
      ? "poll_not_closed"
      : error.message;
    return { ok: false, error: msg };
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/${pollId}`);
  return { ok: true };
}

/** Rename an archived run's label (RLS: admin-only, label column only). */
export async function renameRun(
  runId: string,
  label: string,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poll_runs")
    .update({ label: label.trim() || null })
    .eq("id", runId)
    .select("poll_id")
    .maybeSingle<{ poll_id: string }>();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "run_not_found" };
  revalidatePath(`/admin/${data.poll_id}`);
  return { ok: true, pollId: data.poll_id };
}

/** Matches the DB CHECK on screen_channels.slug (lowercase kebab-case). */
const CHANNEL_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

/**
 * Assign a poll to a technician channel (/tv/[slug]) — or clear it with null.
 * RLS ("screen_channels admin update", is_admin()) is the real wall; the
 * projector detects the change via /api/channel/[slug] and refreshes itself.
 */
export async function assignChannel(
  slug: string,
  pollId: string | null,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  if (!CHANNEL_SLUG_RE.test(slug)) return { ok: false, error: "invalid_slug" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screen_channels")
    .update({ poll_id: pollId })
    .eq("slug", slug)
    .select("slug")
    .maybeSingle<{ slug: string }>();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "channel_not_found" };

  revalidatePath("/admin");
  // Also revalidate the whole panel layout so the /admin/[poll] workspaces do
  // not keep a stale channel assignment in other sessions.
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function changeStatus(
  pollId: string,
  status: PollStatus,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  const supabase = await createClient();
  // set_poll_status stamps opens_at/closes_at and is admin-gated server-side.
  const { error } = await supabase.rpc("set_poll_status", {
    p_poll_id: pollId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/admin/${pollId}`);
  return { ok: true };
}

/**
 * Live Control's Broqui on/off switch — writes ONLY assistant_enabled (never
 * touches min/max pacing) so it stays a single, fast, optimistic toggle
 * distinct from the full config form save. RLS ("polls admin update",
 * is_admin()) is the real wall; `guard()` gives a fast, clear failure here.
 * The projector picks it up within ~5s via /api/poll/[id]/assistant polling.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSISTANT_TOGGLE_ERROR = "No se pudo cambiar a Broqui. Inténtalo de nuevo.";

export async function setAssistantEnabled(
  pollId: unknown,
  enabled: unknown,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  // Server actions are public endpoints: validate the wire values, never trust
  // the TypeScript signature.
  if (typeof enabled !== "boolean" || typeof pollId !== "string" || !UUID_RE.test(pollId)) {
    return { ok: false, error: ASSISTANT_TOGGLE_ERROR };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("polls")
    .update({ assistant_enabled: enabled })
    .eq("id", pollId);
  if (error) {
    console.error("[setAssistantEnabled] update failed", error.message);
    return { ok: false, error: ASSISTANT_TOGGLE_ERROR };
  }
  revalidatePath(`/admin/${pollId}`);
  return { ok: true };
}
