-- ============================================================================
-- UX FIXES batch 2 — server-authoritative count-in + admin delete guarantee
--
-- 1) COUNT-IN as a FUTURE opens_at:
--    Previously set_poll_status('countdown') only flipped the status and left
--    opens_at NULL — opens_at was stamped = now() only at the moment of opening.
--    That left the projector count-in and the voter's local open-flip with NO
--    server-authoritative "opens at T" timestamp to derive from.
--
--    Now set_poll_status('countdown') stamps opens_at = now() + countdown_seconds
--    (when a countdown is configured), so BOTH surfaces derive the exact open
--    moment from a single server timestamp:
--      - projector shows a big count-in to opens_at (LobbyStage),
--      - each voter phone flips lobby -> cards locally at opens_at (instant, in
--        sync), with polling as the correction path.
--
--    Auto-open backstop: a poll in 'countdown' whose opens_at has passed flips to
--    'open' — via pg_cron (empty-room case) AND compute-on-read inside cast_vote
--    (a vote landing right at opens_at opens the poll and succeeds instead of
--    bouncing as 'not_open'). The existing status trigger broadcasts the flip, so
--    the realtime/polling contract is unchanged.
--
-- 2) ADMIN DELETE guarantee (idempotent):
--    Re-assert the polls DELETE policy for is_admin(). Teams/votes/team_tallies
--    already cascade on poll delete (verified), so removing a poll removes its
--    children. This block is a no-op guarantee on an already-correct DB.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a. set_poll_status — stamp a FUTURE opens_at on countdown.
-- ----------------------------------------------------------------------------
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
  v_duration  int;
  v_countdown int;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if p_status not in ('draft','countdown','open','closed') then
    raise exception 'invalid_status: %', p_status;
  end if;

  select duration_seconds, countdown_seconds
    into v_duration, v_countdown
    from public.polls where id = p_poll_id;
  if not found then
    raise exception 'poll_not_found';
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

-- ----------------------------------------------------------------------------
-- 1b. Auto-open backstop (pg_cron) — countdown whose opens_at has passed -> open.
--     Mirrors close_expired_polls. Stamps closes_at from duration at open time so
--     an auto-opened poll still auto-closes correctly.
-- ----------------------------------------------------------------------------
create or replace function public.open_due_polls()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.polls
     set status    = 'open',
         closes_at = case when duration_seconds is not null
                          then now() + make_interval(secs => duration_seconds)
                          else null end
   where status = 'countdown'
     and opens_at is not null
     and now() >= opens_at;
$$;

revoke execute on function public.open_due_polls() from public;

do $$
begin
  -- Only schedule when pg_cron is present (same tier caveat as the close backstop).
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'open-due-polls',
      '*/5 * * * * *',                 -- every 5s: keeps the count-in flip tight
      $cron$select public.open_due_polls();$cron$
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1c. cast_vote — compute-on-read auto-OPEN for a countdown past opens_at, so a
--     vote at the exact open moment opens the poll and is accepted.
-- ----------------------------------------------------------------------------
create or replace function public.cast_vote(
  p_poll_id    uuid,
  p_team_id    uuid,
  p_voter_token text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status     text;
  v_closes_at  timestamptz;
  v_opens_at   timestamptz;
  v_duration   int;
  v_team_poll  uuid;
begin
  -- Lock the poll row so concurrent open/close decisions are consistent.
  select status, closes_at, opens_at, duration_seconds
    into v_status, v_closes_at, v_opens_at, v_duration
    from public.polls
   where id = p_poll_id
   for update;

  if not found then
    return 'not_found';
  end if;

  -- Compute-on-read auto-OPEN: countdown + past opens_at => flip to open now.
  if v_status = 'countdown' and v_opens_at is not null and now() >= v_opens_at then
    update public.polls
       set status    = 'open',
           closes_at = case when v_duration is not null
                            then now() + make_interval(secs => v_duration)
                            else null end
     where id = p_poll_id
     returning status, closes_at into v_status, v_closes_at;
    -- status broadcast emitted by the polls status trigger.
  end if;

  -- Compute-on-read auto-close: open + past closes_at => flip to closed.
  if v_status = 'open' and v_closes_at is not null and now() > v_closes_at then
    update public.polls set status = 'closed' where id = p_poll_id;
    return 'closed';
  end if;

  -- Distinguish a genuinely-closed poll from a not-yet-open one (spec FR-V5).
  if v_status = 'closed' then
    return 'closed';
  end if;

  if v_status <> 'open' then
    return 'not_open';
  end if;

  -- Validate the team belongs to this poll.
  select poll_id into v_team_poll from public.teams where id = p_team_id;
  if v_team_poll is null or v_team_poll <> p_poll_id then
    return 'invalid_team';
  end if;

  begin
    insert into public.votes (poll_id, team_id, voter_token)
    values (p_poll_id, p_team_id, p_voter_token);
  exception
    when unique_violation then
      return 'already_voted';
  end;

  return 'ok';
end;
$$;

revoke execute on function public.cast_vote(uuid, uuid, text) from public;
grant execute on function public.cast_vote(uuid, uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Admin DELETE policy guarantee (idempotent). Cascades already cover children.
-- ----------------------------------------------------------------------------
drop policy if exists "polls admin delete" on public.polls;
create policy "polls admin delete"
  on public.polls for delete
  to authenticated
  using (public.is_admin());
