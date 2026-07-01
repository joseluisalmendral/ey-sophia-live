"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClaims, isAdmin } from "@/lib/supabase/auth";

/**
 * Manage the admins allowlist. Insert/delete on public.admins are RLS-gated to
 * is_admin(); we also guard at the action entry. Email is the primary key, so
 * inserts dedupe naturally (upsert with ignore on conflict).
 */

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  revalidatePath("/admin/admins");
  return { ok: true };
}

/** The currently signed-in admin's email (for "don't remove yourself" warnings). */
export async function currentAdminEmail(): Promise<string | null> {
  const claims = await getClaims();
  return claims?.email ?? null;
}
