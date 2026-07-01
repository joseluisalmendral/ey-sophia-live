-- ============================================================================
-- get_poll_analytics — PII-free aggregate analytics for the admin dashboard.
--
-- SECURITY DEFINER + is_admin()-gated. Returns ONLY aggregates (totals, per-team
-- counts/%, votes-over-time buckets, peak). NEVER exposes raw votes; anon still
-- has no SELECT on public.votes. Reads votes server-side because the function
-- owner bypasses RLS, but the is_admin() guard ensures only allowlisted admins
-- can invoke it.
--
-- Returns a single JSONB document so the client gets one round-trip:
-- {
--   "poll_id", "title", "status",
--   "total_votes",
--   "bucket_seconds",                       -- size of each time bucket
--   "teams":   [ { team_id, name, color, count, pct } ],   -- pct = whole number
--   "buckets": [ { bucket, t, count } ],    -- votes per time bucket (cumulative-friendly)
--   "peak":    { bucket, t, count } | null  -- the busiest bucket
-- }
-- ============================================================================

create or replace function public.get_poll_analytics(p_poll_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total        int;
  v_bucket_secs  int := 10;          -- 10s buckets; coarse enough, no PII
  v_anchor       timestamptz;        -- bucket origin = opens_at (fallback: min vote / created_at)
  v_teams        jsonb;
  v_buckets      jsonb;
  v_peak         jsonb;
  v_title        text;
  v_status       text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select title, status, opens_at, created_at
    into v_title, v_status, v_anchor, v_anchor
    from public.polls
   where id = p_poll_id;

  if not found then
    raise exception 'poll_not_found';
  end if;

  -- Re-read explicitly so we can fall back when opens_at is null (never opened).
  select p.title, p.status,
         coalesce(p.opens_at,
                  (select min(v.created_at) from public.votes v where v.poll_id = p_poll_id),
                  p.created_at)
    into v_title, v_status, v_anchor
    from public.polls p
   where p.id = p_poll_id;

  select count(*) into v_total from public.votes where poll_id = p_poll_id;

  -- Per-team counts + whole-number percentage of total.
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'team_id', t.id,
             'name',    t.name,
             'color',   t.color,
             'count',   coalesce(tt.count, 0),
             'pct',     case when v_total > 0
                             then round(coalesce(tt.count, 0)::numeric * 100 / v_total)::int
                             else 0 end
           )
           order by coalesce(tt.count, 0) desc, t.position asc
         ), '[]'::jsonb)
    into v_teams
    from public.teams t
    left join public.team_tallies tt on tt.team_id = t.id
   where t.poll_id = p_poll_id;

  -- Votes-over-time buckets relative to the anchor. Each bucket = v_bucket_secs.
  with b as (
    select floor(extract(epoch from (v.created_at - v_anchor)) / v_bucket_secs)::int as bucket,
           count(*)::int as cnt,
           min(v.created_at) as t
      from public.votes v
     where v.poll_id = p_poll_id
     group by 1
  )
  select coalesce(jsonb_agg(
           jsonb_build_object('bucket', bucket, 't', t, 'count', cnt)
           order by bucket
         ), '[]'::jsonb)
    into v_buckets
    from b;

  -- Peak bucket (busiest interval), or null if no votes.
  with b as (
    select floor(extract(epoch from (v.created_at - v_anchor)) / v_bucket_secs)::int as bucket,
           count(*)::int as cnt,
           min(v.created_at) as t
      from public.votes v
     where v.poll_id = p_poll_id
     group by 1
  )
  select to_jsonb(x)
    into v_peak
    from (
      select bucket, t, cnt as count
        from b
       order by cnt desc, bucket asc
       limit 1
    ) x;

  return jsonb_build_object(
    'poll_id',        p_poll_id,
    'title',          v_title,
    'status',         v_status,
    'total_votes',    v_total,
    'bucket_seconds', v_bucket_secs,
    'teams',          v_teams,
    'buckets',        v_buckets,
    'peak',           v_peak
  );
end;
$$;

revoke execute on function public.get_poll_analytics(uuid) from public, anon;
grant  execute on function public.get_poll_analytics(uuid) to authenticated;
