-- ============================================================================
-- Bootstrap the first admin so is_admin() works for the initial operator.
-- is_admin() checks auth.jwt()->>'email' against public.admins; without at least
-- one row, NO authenticated user could pass the allowlist (chicken-and-egg).
-- Idempotent: re-running is a no-op.
-- ============================================================================

insert into public.admins (email)
values ('joseluis.fernandez@thepower.education')
on conflict (email) do nothing;
