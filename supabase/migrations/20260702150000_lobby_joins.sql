-- ============================================================================
-- lobby_joins — HTTP join feed for the projector lobby (replaces presence WS).
--
-- WHY: every voter phone used to open a realtime PRESENCE websocket while
-- sitting in the lobby, eating into the free plan's concurrent-connection cap.
-- Joins are now a single one-shot INSERT (via RPC) and the projector POLLS a
-- CDN-cacheable HTTP endpoint for {count, latest aliases}. Zero websockets on
-- the voter path, one origin hit every couple of seconds on the screen path.
--
-- RUN SCOPING: rows carry the poll's run_seq at insert time. relaunch_poll
-- (untouched) bumps polls.run_seq, so reads — which filter by the CURRENT
-- run_seq — naturally drop the previous run's joins with no cleanup job.
--
-- PRIVACY: rows hold only an anonymous, client-generated alias ("Vega 12")
-- and a timestamp — no PII, no tokens. Ephemeral room ambience only.
-- ============================================================================

create table if not exists public.lobby_joins (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.polls(id) on delete cascade,
  alias     text not null,
  run_seq   int  not null default 1,
  joined_at timestamptz not null default now()
);

-- Read pattern: current-run joins for one poll, newest first.
create index if not exists idx_lobby_joins_poll_run
  on public.lobby_joins (poll_id, run_seq, joined_at desc);

alter table public.lobby_joins enable row level security;

-- Anonymous read of the (non-sensitive) join feed. Writes go ONLY through the
-- join_lobby RPC so run_seq is always stamped server-side — no direct INSERT
-- grant for clients.
grant select on public.lobby_joins to anon, authenticated;

create policy "lobby_joins public read"
  on public.lobby_joins for select to anon, authenticated using (true);

-- ----------------------------------------------------------------------------
-- join_lobby — one-shot anonymous join event.
-- Stamps the poll's CURRENT run_seq; only accepted while the poll is pre-open
-- (draft/countdown — the lobby). Alias is length-capped defensively.
-- ----------------------------------------------------------------------------
create or replace function public.join_lobby(
  p_poll_id uuid,
  p_alias   text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status  text;
  v_run_seq int;
begin
  select status, run_seq into v_status, v_run_seq
    from public.polls where id = p_poll_id;

  if not found then
    raise exception 'poll_not_found';
  end if;

  -- The lobby only exists pre-open; late/replayed posts are silently ignored.
  if v_status not in ('draft', 'countdown') then
    return;
  end if;

  if p_alias is null or length(trim(p_alias)) = 0 then
    return;
  end if;

  insert into public.lobby_joins (poll_id, alias, run_seq)
  values (p_poll_id, left(trim(p_alias), 40), v_run_seq);
end;
$$;

revoke execute on function public.join_lobby(uuid, text) from public;
grant execute on function public.join_lobby(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- get_lobby_joins — current-run join feed for one poll, newest first.
-- Capped at 500 rows: enough for an accurate room count at event scale while
-- bounding the payload.
-- ----------------------------------------------------------------------------
create or replace function public.get_lobby_joins(p_poll_id uuid)
returns table (
  alias     text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select lj.alias, lj.joined_at
  from public.lobby_joins lj
  join public.polls p on p.id = lj.poll_id
  where lj.poll_id = p_poll_id
    and lj.run_seq = p.run_seq
  order by lj.joined_at desc
  limit 500;
$$;

revoke execute on function public.get_lobby_joins(uuid) from public;
grant execute on function public.get_lobby_joins(uuid) to anon, authenticated;
