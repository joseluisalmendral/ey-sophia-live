-- Fix: cast_vote must return the distinct 'closed' result for a poll whose
-- status is 'closed' (manual OR auto), not collapse it into 'not_open'.
--
-- Contract (engram #926 / spec FR-V5): cast_vote returns
--   'ok' | 'already_voted' | 'not_open' | 'closed' | 'invalid_team' | 'not_found'.
-- Previously any non-open status returned 'not_open', so a manually-closed poll
-- reported 'not_open' instead of 'closed'. Clients collapse both to the same
-- rejected UI, so this is not user-visible, but it violated the documented
-- contract and made the API semantically wrong for any future consumer/analytics.
--
-- Behaviour after this migration:
--   status = 'open' + past closes_at  -> auto-close, return 'closed'
--   status = 'closed'                 -> return 'closed'
--   status = 'draft' | 'countdown'    -> return 'not_open'
-- Everything else (team validation, dedup, insert) is unchanged.

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
  v_team_poll  uuid;
begin
  -- Lock the poll row so concurrent auto-close decisions are consistent.
  select status, closes_at, opens_at
    into v_status, v_closes_at, v_opens_at
    from public.polls
   where id = p_poll_id
   for update;

  if not found then
    return 'not_found';
  end if;

  -- Compute-on-read auto-close: open + past closes_at => flip to closed.
  if v_status = 'open' and v_closes_at is not null and now() > v_closes_at then
    update public.polls set status = 'closed' where id = p_poll_id;
    -- status broadcast is emitted by the polls status trigger.
    return 'closed';
  end if;

  -- Distinguish a genuinely-closed poll from a not-yet-open one so the API
  -- result matches the documented contract (spec FR-V5).
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
