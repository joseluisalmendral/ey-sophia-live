"use server";

import { revalidatePath } from "next/cache";
import { createClient, createSecretClient } from "@/lib/supabase/server";
import { getClaims, isAdmin } from "@/lib/supabase/auth";

/**
 * Manage the admins allowlist. Insert/delete on public.admins are RLS-gated to
 * is_admin(); we also guard at the action entry. Email is the primary key, so
 * inserts dedupe naturally (upsert with ignore on conflict).
 *
 * Admins are created with a real Supabase Auth user (email + password) via the
 * Admin API (service_role, server-only). Users are created pre-confirmed
 * (email_confirm: true) so NO verification email is sent and they can sign in
 * with the shared password immediately.
 */

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

/** Result of creating an admin with credentials — surfaces a status the UI can explain. */
export interface CreateAdminResult extends AdminActionResult {
  /** "created" = new auth user made; "existing" = auth user already existed, added to allowlist. */
  status?: "created" | "existing";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

/**
 * Create an admin with email + password (owner flow).
 *
 * 1. Guards: caller MUST be an admin (never callable by anon/non-admin).
 * 2. Creates a pre-confirmed auth user via the Admin API (no email sent).
 * 3. Adds the email to the `admins` allowlist (is_admin() then passes).
 *
 * If the auth user already exists, we DON'T hard-fail: we still ensure the email
 * is in the allowlist (so an existing user becomes an admin) and, when a password
 * is supplied, reset it via updateUserById so the owner can share fresh creds.
 */
export async function createAdminWithPassword(
  email: string,
  password: string,
): Promise<CreateAdminResult> {
  if (!(await isAdmin())) return { ok: false, error: "not_authorized" };

  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return { ok: false, error: "invalid_email" };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "weak_password" };
  }

  const secret = createSecretClient();

  // Create the auth user pre-confirmed so no verification email is ever sent.
  const { error: createErr } = await secret.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
  });

  let status: "created" | "existing" = "created";

  if (createErr) {
    // Treat "already registered" as recoverable: promote the existing user to
    // admin and (best-effort) reset their password to the shared one.
    if (isAlreadyExistsError(createErr.message, createErr.status)) {
      status = "existing";
      const userId = await findAuthUserIdByEmail(normalized);
      if (userId) {
        await secret.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
        });
      }
    } else {
      return { ok: false, error: createErr.message };
    }
  }

  // Ensure the email is in the allowlist regardless of create-vs-existing.
  const supabase = await createClient();
  const { error: allowlistErr } = await supabase
    .from("admins")
    .upsert(
      { email: normalized },
      { onConflict: "email", ignoreDuplicates: true },
    );
  if (allowlistErr) return { ok: false, error: allowlistErr.message };

  revalidatePath("/admin/admins");
  return { ok: true, status };
}

/**
 * Add an existing person as admin by email only (allowlist-only, legacy path).
 * Kept for callers that just want to promote an already-registered user without
 * setting a password.
 */
export async function addAdmin(email: string): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "not_authorized" };
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return { ok: false, error: "invalid_email" };

  const supabase = await createClient();
  // upsert with ignoreDuplicates so re-adding an existing admin is a no-op.
  const { error } = await supabase
    .from("admins")
    .upsert({ email: normalized }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/admins");
  return { ok: true };
}

export async function removeAdmin(email: string): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "not_authorized" };
  const normalized = email.trim().toLowerCase();

  // Refuse to remove the LAST admin (would lock everyone out).
  const supabase = await createClient();
  const { data: all } = await supabase.from("admins").select("email");
  if ((all ?? []).length <= 1) {
    return { ok: false, error: "cannot_remove_last_admin" };
  }

  const { error } = await supabase.from("admins").delete().eq("email", normalized);
  if (error) return { ok: false, error: error.message };

  // Best-effort: also delete the underlying auth user so access is fully revoked
  // (removing from the allowlist alone already revokes admin rights via
  // is_admin(); this cleans up the credential too). Non-fatal if it fails.
  const userId = await findAuthUserIdByEmail(normalized);
  if (userId) {
    const secret = createSecretClient();
    await secret.auth.admin.deleteUser(userId);
  }

  revalidatePath("/admin/admins");
  return { ok: true };
}

/** The currently signed-in admin's email (for "don't remove yourself" warnings). */
export async function currentAdminEmail(): Promise<string | null> {
  const claims = await getClaims();
  return claims?.email ?? null;
}

/** Look up an auth user's id by email via the Admin API. Returns null if not found. */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const secret = createSecretClient();
  // listUsers is paginated; scan pages until we find the email or run out.
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await secret.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (match) return match.id;
    if (data.users.length < perPage) break; // last page
  }
  return null;
}

/** Whether an Admin API error means the email already has an auth user. */
function isAlreadyExistsError(message: string, status?: number): boolean {
  const m = message.toLowerCase();
  return (
    status === 422 ||
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("already exists") ||
    m.includes("email_exists") ||
    m.includes("user already")
  );
}
