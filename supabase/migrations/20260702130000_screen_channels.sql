-- ============================================================================
-- SCREEN CHANNELS — stable projector URLs with an admin-assignable poll.
--
-- Use case: before the workshop the admin hands the room technician ONE stable
-- URL (/tv/<slug>). The technician opens it on the projector and never touches
-- it again. From the panel, the admin assigns whichever poll is up next to the
-- channel; the screen switches by itself (client polls a tiny CDN-cached
-- endpoint and refreshes when the assignment changes).
--
-- Design notes:
--  - slug is the PK (human-friendly, appears in the URL). Lowercase kebab-case
--    enforced by a CHECK so the route can 404 malformed slugs cheaply.
--  - poll_id is nullable: NULL = "channel on standby". ON DELETE SET NULL means
--    deleting a poll returns its channel to standby automatically.
--  - updated_at bumps on every UPDATE (trigger) so clients can detect a
--    re-assignment even when the poll_id value itself is unchanged.
--  - No realtime policy/trigger here on purpose: the consumer is ONE projector,
--    so a ~5s CDN-cached poll of /api/channel/<slug> is the guaranteed and
--    sufficient switch mechanism (mirrors the voter status-polling pattern).
-- ============================================================================

create table if not exists public.screen_channels (
  slug       text primary key
               check (slug ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$'),
  poll_id    uuid references public.polls(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Data API grants (cloud no longer auto-exposes new tables); RLS gates rows.
grant select on public.screen_channels to anon, authenticated;
grant insert, update, delete on public.screen_channels to authenticated;

alter table public.screen_channels enable row level security;

-- Public read (the projector page and the channel endpoint are anonymous).
create policy "screen_channels public read"
  on public.screen_channels for select
  to anon, authenticated
  using (true);

-- Admin-only writes.
create policy "screen_channels admin insert"
  on public.screen_channels for insert
  to authenticated
  with check (public.is_admin());
create policy "screen_channels admin update"
  on public.screen_channels for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "screen_channels admin delete"
  on public.screen_channels for delete
  to authenticated
  using (public.is_admin());

-- Bump updated_at on every update so assignment changes are always detectable.
create or replace function public.touch_screen_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_screen_channel_touch on public.screen_channels;
create trigger trg_screen_channel_touch
before update on public.screen_channels
for each row execute function public.touch_screen_channel();

-- Seed the default channel handed to the room technician.
insert into public.screen_channels (slug) values ('directo')
on conflict (slug) do nothing;
