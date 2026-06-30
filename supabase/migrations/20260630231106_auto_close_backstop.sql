-- ============================================================================
-- AUTO-CLOSE BACKSTOP (pg_cron)
-- Primary auto-close is compute-on-read inside cast_vote(). This is the
-- belt-and-suspenders path for the empty-room case (no client reading).
--
-- The poll status trigger (trg_poll_status_change) emits the 'status' broadcast
-- automatically when these rows flip to 'closed'.
--
-- NOTE: if pg_cron is unavailable on this tier the cron.schedule call below
-- will fail; in that case this migration is removed and compute-on-read in
-- cast_vote() remains the resilient primary mechanism.
-- ============================================================================

create extension if not exists pg_cron;

create or replace function public.close_expired_polls()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.polls
     set status = 'closed'
   where status = 'open'
     and closes_at is not null
     and now() > closes_at;
$$;

revoke execute on function public.close_expired_polls() from public;

select cron.schedule(
  'close-expired-polls',
  '*/30 * * * * *',                 -- every 30 seconds
  $$select public.close_expired_polls();$$
);
