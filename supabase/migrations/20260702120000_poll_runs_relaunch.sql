-- ============================================================================
-- POLL RUNS + RELAUNCH — archive results and restart a closed poll cleanly.
--
-- Problem: a closed poll could only be reopened by flipping status back, which
-- ACCUMULATED old votes, and the 12h per-device cookies blocked re-voting.
--
-- Solution:
--   1) polls.run_seq — monotonically increasing "launch number" per poll. Vote
--      dedup cookies are scoped per run (vt_<pollId>_r<seq>) so every relaunch
--      lets everyone vote again without waiting for cookie expiry.
--   2) poll_runs — immutable snapshot of each finished launch (ordered results
--      jsonb + totals + timestamps). Admin-only via RLS; no anon access.
--   3) relaunch_poll(p_poll_id) — SECURITY DEFINER RPC, admin-gated:
--      lock the poll, require status='closed', snapshot current results into
--      poll_runs, wipe votes, zero tallies, bump run_seq, reset the poll to a
--      clean draft (opens_at/closes_at NULL). The closed->draft status change
--      fires the existing trg_poll_status_change broadcast on poll:<id>.
--   4) Run label rename via column-level UPDATE grant + admin RLS policy (no
--      dedicated RPC needed — cleaner and the RLS wall is identical).
--
-- Does NOT touch cast_vote or set_poll_status.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. polls.run_seq
-- ----------------------------------------------------------------------------

alter table public.polls
  add column if not exists run_seq int not null default 1;

-- ----------------------------------------------------------------------------
-- 2. poll_runs — archived launches
-- ----------------------------------------------------------------------------

create table if not exists public.poll_runs (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls(id) on delete cascade,
  seq         int not null,
  label       text,
  started_at  timestamptz,                       -- opens_at of the archived run (null if never opened)
  ended_at    timestamptz not null default now(),
  total_votes int not null,
  results     jsonb not null,                    -- [{team_id,name,color,position,count}] ordered desc
  created_at  timestamptz default now(),
  unique (poll_id, seq)
);

create index if not exists idx_poll_runs_poll on public.poll_runs(poll_id);

alter table public.poll_runs enable row level security;

-- Admin-only surface: SELECT + label rename + DELETE. No anon grants at all.
-- INSERT has no grant/policy on purpose — rows are created only by the
-- SECURITY DEFINER relaunch_poll() below.
grant select, delete on public.poll_runs to authenticated;
grant update (label) on public.poll_runs to authenticated;

create policy "poll_runs admin read"
  on public.poll_runs for select
  to authenticated
  using (public.is_admin());

create policy "poll_runs admin update"
  on public.poll_runs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "poll_runs admin delete"
  on public.poll_runs for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. relaunch_poll — archive current results, reset the poll to a clean draft.
--    Returns the NEW run_seq. Raises on: not_authorized / poll_not_found /
--    poll_not_closed (the FOR UPDATE lock + closed check make a double click
--    safe: the second call fails cleanly instead of double-archiving).
-- ----------------------------------------------------------------------------

create or replace function public.relaunch_poll(p_poll_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status   text;
  v_opens_at timestamptz;
  v_seq      int;
  v_results  jsonb;
  v_total    int;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  -- Lock the poll row so concurrent relaunch attempts serialize.
  select status, opens_at, run_seq
    into v_status, v_opens_at, v_seq
    from public.polls
   where id = p_poll_id
   for update;

  if not found then
    raise exception 'poll_not_found';
  end if;

  if v_status <> 'closed' then
    raise exception 'poll_not_closed';
  end if;

  -- Snapshot current results (same shape/order as get_results). A 0-vote
  -- relaunch is allowed: the snapshot simply carries count 0 per team.
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'team_id',  r.team_id,
               'name',     r.name,
               'color',    r.color,
               'position', r.team_position,
               'count',    r.count
             )
             order by r.count desc, r.team_position asc
           ),
           '[]'::jsonb
         ),
         coalesce(sum(r.count), 0)
    into v_results, v_total
    from (
      select t.id as team_id, t.name, t.color, t.position as team_position,
             coalesce(tt.count, 0) as count
        from public.teams t
        left join public.team_tallies tt on tt.team_id = t.id
       where t.poll_id = p_poll_id
    ) r;

  insert into public.poll_runs (poll_id, seq, started_at, total_votes, results)
  values (p_poll_id, v_seq, v_opens_at, v_total, v_results);

  -- Wipe the live vote state for the next run.
  delete from public.votes where poll_id = p_poll_id;
  update public.team_tallies set count = 0 where poll_id = p_poll_id;

  -- Reset to a clean draft and bump the run sequence. closed->draft fires the
  -- existing status trigger broadcast on poll:<id>.
  update public.polls
     set run_seq   = v_seq + 1,
         status    = 'draft',
         opens_at  = null,
         closes_at = null
   where id = p_poll_id;

  return v_seq + 1;
end;
$$;

revoke execute on function public.relaunch_poll(uuid) from public;
grant execute on function public.relaunch_poll(uuid) to authenticated;
