-- ============================================================================
-- EY SophIA Live Voting — initial schema
-- Tables, RLS, Broadcast-from-DB triggers, RPCs, Realtime Authorization.
-- Postgres 17 / Supabase. Realtime mode: Broadcast-from-Database (realtime.send).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

create table if not exists public.polls (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  status           text not null default 'draft'
                     check (status in ('draft','countdown','open','closed')),
  countdown_seconds int,
  duration_seconds  int,
  opens_at         timestamptz,
  closes_at        timestamptz,
  chart_type       text not null default 'bar_race'
                     check (chart_type in ('bar_race','donut','columns')),
  show_legend      boolean not null default true,
  show_names       boolean not null default true,
  tie_rule         text not null default 'first_to_count'
                     check (tie_rule in ('first_to_count','double_crown')),
  join_code        text unique,
  created_by       uuid,
  created_at       timestamptz default now()
);

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  name       text not null,
  color      text not null,
  position   int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  voter_token text not null,
  created_at  timestamptz default now(),
  unique (poll_id, voter_token)
);

create table if not exists public.team_tallies (
  team_id uuid primary key references public.teams(id) on delete cascade,
  poll_id uuid not null references public.polls(id) on delete cascade,
  count   int not null default 0
);

create table if not exists public.admins (
  email text primary key
);

-- Indexes (votes by poll, teams by poll, tallies by poll)
create index if not exists idx_votes_poll   on public.votes(poll_id);
create index if not exists idx_votes_team    on public.votes(team_id);
create index if not exists idx_teams_poll    on public.teams(poll_id);
create index if not exists idx_tallies_poll  on public.team_tallies(poll_id);

-- ----------------------------------------------------------------------------
-- 2. HELPER: is_admin()
--    True when the verified JWT email exists in admins. SECURITY DEFINER so it
--    can read admins regardless of caller RLS. search_path='' for safety.
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where email = (select auth.jwt() ->> 'email')
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. DATA API GRANTS
--    Past 2026-05-30 the cloud default no longer auto-exposes new tables, so we
--    grant explicitly. RLS (below) is what actually gates row access.
-- ----------------------------------------------------------------------------

grant select on public.polls        to anon, authenticated;
grant select on public.teams        to anon, authenticated;
grant select on public.team_tallies to anon, authenticated;

-- Admin write surface (RLS still gates by is_admin()).
grant insert, update, delete on public.polls  to authenticated;
grant insert, update, delete on public.teams  to authenticated;
grant insert, update, delete on public.admins to authenticated;
grant select on public.admins to authenticated;

-- votes: no direct table grants to anon/authenticated. All writes go through
-- the SECURITY DEFINER cast_vote() RPC, all reads only via aggregates.

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.polls        enable row level security;
alter table public.teams        enable row level security;
alter table public.votes        enable row level security;
alter table public.team_tallies enable row level security;
alter table public.admins       enable row level security;

-- polls: public read; admin write
create policy "polls public read"   on public.polls for select to anon, authenticated using (true);
create policy "polls admin insert"  on public.polls for insert to authenticated with check (public.is_admin());
create policy "polls admin update"  on public.polls for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "polls admin delete"  on public.polls for delete to authenticated using (public.is_admin());

-- teams: public read; admin write
create policy "teams public read"   on public.teams for select to anon, authenticated using (true);
create policy "teams admin insert"  on public.teams for insert to authenticated with check (public.is_admin());
create policy "teams admin update"  on public.teams for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "teams admin delete"  on public.teams for delete to authenticated using (public.is_admin());

-- team_tallies: public read; no client writes (trigger via SECURITY DEFINER only)
create policy "tallies public read" on public.team_tallies for select to anon, authenticated using (true);

-- votes: NO policies for anon/authenticated => all direct access denied.
--        Inserts happen only through cast_vote() (SECURITY DEFINER).
--        Admins may read raw votes for analytics.
create policy "votes admin read"    on public.votes for select to authenticated using (public.is_admin());

-- admins: only admins can read/manage the allowlist
create policy "admins admin read"   on public.admins for select to authenticated using (public.is_admin());
create policy "admins admin insert" on public.admins for insert to authenticated with check (public.is_admin());
create policy "admins admin update" on public.admins for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins admin delete" on public.admins for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. REALTIME AUTHORIZATION
--    Broadcast-from-DB on PRIVATE channels named 'poll:<id>'.
--    Clients may RECEIVE (select) broadcasts on poll:% topics. They are NOT
--    granted insert on realtime.messages, so only the DB triggers can emit.
-- ----------------------------------------------------------------------------

create policy "poll broadcast receive"
on realtime.messages
for select
to anon, authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'poll:%'
);

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS — Broadcast-from-DB
-- ----------------------------------------------------------------------------

-- 6a. teams INSERT -> auto-create team_tallies row at count 0
create or replace function public.on_team_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.team_tallies (team_id, poll_id, count)
  values (new.id, new.poll_id, 0)
  on conflict (team_id) do nothing;
  return new;
end;
$$;

create trigger trg_team_insert
after insert on public.teams
for each row execute function public.on_team_insert();

-- 6b. votes INSERT -> atomic tally increment + absolute-value broadcast
create or replace function public.on_vote_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.team_tallies
     set count = count + 1
   where team_id = new.team_id
   returning count into v_count;

  perform realtime.send(
    jsonb_build_object(
      'type',    'tally',
      'poll_id', new.poll_id,
      'team_id', new.team_id,
      'count',   v_count
    ),
    'tally',                          -- event
    'poll:' || new.poll_id::text,     -- topic
    true                              -- private channel
  );

  return new;
end;
$$;

create trigger trg_vote_insert
after insert on public.votes
for each row execute function public.on_vote_insert();

-- 6c. polls UPDATE of status -> broadcast status event
create or replace function public.on_poll_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform realtime.send(
      jsonb_build_object(
        'type',      'status',
        'poll_id',   new.id,
        'status',    new.status,
        'closes_at', new.closes_at,
        'opens_at',  new.opens_at
      ),
      'status',
      'poll:' || new.id::text,
      true
    );
  end if;
  return new;
end;
$$;

create trigger trg_poll_status_change
after update on public.polls
for each row execute function public.on_poll_status_change();

-- ----------------------------------------------------------------------------
-- 7. RPCs (SECURITY DEFINER, search_path='')
-- ----------------------------------------------------------------------------

-- 7a. cast_vote — the only anon write path into votes.
--     Compute-on-read auto-close, status gating, dedup, team validation.
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

-- 7b. set_poll_status — admin-gated state machine + timestamp stamping.
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
  v_duration int;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if p_status not in ('draft','countdown','open','closed') then
    raise exception 'invalid_status: %', p_status;
  end if;

  select duration_seconds into v_duration from public.polls where id = p_poll_id;
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
  else
    update public.polls set status = p_status where id = p_poll_id;
  end if;
end;
$$;

revoke execute on function public.set_poll_status(uuid, text) from public;
grant execute on function public.set_poll_status(uuid, text) to authenticated;

-- 7c. get_results — public ordered results (teams + counts desc).
create or replace function public.get_results(p_poll_id uuid)
returns table (
  team_id       uuid,
  name          text,
  color         text,
  team_position int,
  count         int
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.color, t.position, coalesce(tt.count, 0) as count
  from public.teams t
  left join public.team_tallies tt on tt.team_id = t.id
  where t.poll_id = p_poll_id
  order by coalesce(tt.count, 0) desc, t.position asc;
$$;

revoke execute on function public.get_results(uuid) from public;
grant execute on function public.get_results(uuid) to anon, authenticated;
