-- ============================================================================
-- set_poll_status IDEMPOTENCY — a repeated transition must be a no-op.
--
-- QA-confirmed bug: a double click on "Cuenta atrás" or "Abrir" called
-- set_poll_status twice with the SAME target status. The second call
-- re-stamped opens_at/closes_at, so the projector count-in and the voter's
-- local open-flip timers jumped; worse, on an open->open repeat the fresh
-- closes_at was not even broadcast (the status trigger only fires on a status
-- CHANGE), leaving every surface counting down to a stale closes_at.
--
-- Fix: early return when the requested status equals the current status,
-- WITHOUT touching any timestamp. Everything else is preserved verbatim from
-- 20260701120000_countin_opensat_and_delete_policy.sql.
-- ============================================================================

create or replace function public.set_poll_status(
  p_poll_id uuid,
  p_status  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status    text;
  v_duration  int;
  v_countdown int;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if p_status not in ('draft','countdown','open','closed') then
    raise exception 'invalid_status: %', p_status;
  end if;

  -- Lock the row so two concurrent clicks serialize: the second one sees the
  -- already-applied status and returns without re-stamping.
  select status, duration_seconds, countdown_seconds
    into v_status, v_duration, v_countdown
    from public.polls where id = p_poll_id
    for update;
  if not found then
    raise exception 'poll_not_found';
  end if;

  -- IDEMPOTENT: requested status already applied -> no-op. Never re-stamp
  -- opens_at/closes_at (a re-stamp makes live timers jump and is not even
  -- broadcast, since the status trigger only fires on a status change).
  if v_status = p_status then
    return;
  end if;

  if p_status = 'open' then
    update public.polls
       set status    = 'open',
           opens_at  = now(),
           closes_at = case when v_duration is not null
                            then now() + make_interval(secs => v_duration)
                            else null end
     where id = p_poll_id;
  elsif p_status = 'countdown' then
    -- Stamp a FUTURE opens_at so both surfaces can count in to it. Falls back to
    -- now() when no countdown is configured (opens immediately on the backstop).
    update public.polls
       set status   = 'countdown',
           opens_at = case when v_countdown is not null and v_countdown > 0
                           then now() + make_interval(secs => v_countdown)
                           else now() end,
           closes_at = null
     where id = p_poll_id;
  else
    -- draft / closed: clear a still-FUTURE opens_at so a poll aborted mid-count-in
    -- never reports a future opens_at while not counting in (misleads consumers).
    -- A past opens_at on 'closed' is kept as the historical "when it opened" record;
    -- closes_at is left intact so the reveal timer/analytics remain correct.
    update public.polls
       set status   = p_status,
           opens_at = case
                        when p_status = 'draft' then null
                        when opens_at is not null and opens_at > now() then null
                        else opens_at
                      end
     where id = p_poll_id;
  end if;
end;
$$;

revoke execute on function public.set_poll_status(uuid, text) from public;
grant execute on function public.set_poll_status(uuid, text) to authenticated;
