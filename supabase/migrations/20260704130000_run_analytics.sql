-- ============================================================================
-- RUN ANALYTICS — persist per-launch analytics and expose the lobby join curve.
--
-- Problem: get_poll_analytics computes from live public.votes, but
-- relaunch_poll DELETEs all votes when archiving a run, so detailed analytics
-- (votes-over-time buckets, peak, per-team split) were lost forever for every
-- past launch. lobby_joins DOES keep historical rows scoped by run_seq, but no
-- API exposed the join curve (needed to measure whether showing the lobby
-- counter on screen drives interest).
--
-- Solution:
--   1) poll_runs.analytics jsonb — full analytics snapshot taken by
--      relaunch_poll BEFORE wiping votes. Shape:
--        get_poll_analytics document (poll_id, title, status, total_votes,
--        bucket_seconds, teams[], buckets[], peak)
--        + "run_seq": int              -- the archived run's sequence
--        + "joins": join-curve doc     -- see get_lobby_join_curve below
--      Runs archived before this migration have analytics = NULL (the UI
--      falls back to the results snapshot).
--   2) get_lobby_join_curve(p_poll_id, p_run_seq default null) — is_admin()-
--      gated aggregate of lobby_joins for one run (default: current run).
--      Shape:
--        { "poll_id", "run_seq", "bucket_seconds": 15,
--          "total_joins": int,
--          "first_join": timestamptz | null, "last_join": timestamptz | null,
--          "buckets": [ { "bucket": int, "t": timestamptz, "count": int } ] }
--      Buckets are 15s wide, anchored at the run's first join. PII-free:
--      aggregates only, no aliases.
--   3) relaunch_poll — same behavior as before (verbatim), plus the analytics
--      snapshot insert. Live-run analytics stay correct as-is: votes are wiped
--      on every relaunch and opens_at is reset, so public.votes only ever
--      holds the CURRENT run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. poll_runs.analytics
-- ----------------------------------------------------------------------------

alter table public.poll_runs
  add column if not exists analytics jsonb;

comment on column public.poll_runs.analytics is
  'Snapshot of get_poll_analytics at relaunch time, plus run_seq and a "joins" lobby-join-curve doc. NULL for runs archived before 20260704130000.';

-- ----------------------------------------------------------------------------
-- 2. get_lobby_join_curve — lobby joins over time for one run.
-- ----------------------------------------------------------------------------

create or replace function public.get_lobby_join_curve(
  p_poll_id uuid,
  p_run_seq int default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bucket_secs int := 15;         -- 15s buckets; coarse enough, no PII
  v_run_seq     int;
  v_total       int;
  v_first       timestamptz;
  v_last        timestamptz;
  v_buckets     jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select coalesce(p_run_seq, run_seq) into v_run_seq
    from public.polls
   where id = p_poll_id;

  if not found then
    raise exception 'poll_not_found';
  end if;

  select count(*), min(joined_at), max(joined_at)
    into v_total, v_first, v_last
    from public.lobby_joins
   where poll_id = p_poll_id
     and run_seq = v_run_seq;

  -- Joins-over-time buckets anchored at the run's first join.
  with b as (
    select floor(extract(epoch from (lj.joined_at - v_first)) / v_bucket_secs)::int as bucket,
           count(*)::int as cnt,
           min(lj.joined_at) as t
      from public.lobby_joins lj
     where lj.poll_id = p_poll_id
       and lj.run_seq = v_run_seq
     group by 1
  )
  select coalesce(jsonb_agg(
           jsonb_build_object('bucket', bucket, 't', t, 'count', cnt)
           order by bucket
         ), '[]'::jsonb)
    into v_buckets
    from b;

  return jsonb_build_object(
    'poll_id',        p_poll_id,
    'run_seq',        v_run_seq,
    'bucket_seconds', v_bucket_secs,
    'total_joins',    v_total,
    'first_join',     v_first,
    'last_join',      v_last,
    'buckets',        v_buckets
  );
end;
$$;

revoke execute on function public.get_lobby_join_curve(uuid, int) from public, anon;
grant  execute on function public.get_lobby_join_curve(uuid, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. relaunch_poll — verbatim behavior + analytics snapshot before the wipe.
--    get_poll_analytics / get_lobby_join_curve are is_admin()-gated, which the
--    relaunch caller already passed (auth context is unchanged inside a
--    SECURITY DEFINER function), so the nested calls succeed.
-- ----------------------------------------------------------------------------

create or replace function public.relaunch_poll(p_poll_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status    text;
  v_opens_at  timestamptz;
  v_seq       int;
  v_results   jsonb;
  v_total     int;
  v_analytics jsonb;
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

  -- Snapshot detailed analytics BEFORE wiping votes: get_poll_analytics only
  -- sees the current run's votes (previous relaunches wiped older ones), and
  -- the join curve is scoped to this run_seq explicitly.
  v_analytics := public.get_poll_analytics(p_poll_id)
              || jsonb_build_object(
                   'run_seq', v_seq,
                   'joins',   public.get_lobby_join_curve(p_poll_id, v_seq)
                 );

  insert into public.poll_runs (poll_id, seq, started_at, total_votes, results, analytics)
  values (p_poll_id, v_seq, v_opens_at, v_total, v_results, v_analytics);

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
