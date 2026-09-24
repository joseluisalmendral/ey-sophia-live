-- ============================================================================
-- Per-poll assistant (Broqui) configuration — WP4.
--
-- Broqui (the projector-only mascot co-host) speaks on an ambient cadence
-- U[min,max] seconds between lines, on top of event-driven lines. This adds
-- the three settings the admin controls per poll plus a freshness stamp the
-- projector-only /api/poll/[id]/assistant endpoint reports.
--
-- Additive only: every new column has a safe default, so rows created by the
-- currently deployed code (which knows nothing about these columns) remain
-- valid, and the currently deployed code keeps working unmodified until the
-- app is redeployed with the E4 changes.
-- ============================================================================

alter table public.polls
  add column assistant_enabled boolean not null default true,
  add column assistant_min_interval_s smallint not null default 14
    check (assistant_min_interval_s between 6 and 120),
  add column assistant_max_interval_s smallint not null default 28
    check (assistant_max_interval_s between 8 and 120),
  add column assistant_updated_at timestamptz not null default now();

-- max must clear min by at least 2s (matches src/lib/assistant/scheduler.ts
-- validateInterval/sanitizeInterval, which enforce the same rule client/server).
alter table public.polls
  add constraint polls_assistant_interval_spread_check
    check (assistant_max_interval_s >= assistant_min_interval_s + 2);

comment on column public.polls.assistant_enabled is
  'Live on/off switch for the projector-only Broqui co-host. Toggled from admin Live Control; read by /api/poll/[id]/assistant (~5s polling, projector only).';
comment on column public.polls.assistant_min_interval_s is
  'Minimum seconds between Broqui ambient lines (6-120s; a 6s floor is also enforced client-side as a last line of defence).';
comment on column public.polls.assistant_max_interval_s is
  'Maximum seconds between Broqui ambient lines (8-120s; must be >= assistant_min_interval_s + 2).';
comment on column public.polls.assistant_updated_at is
  'Bumped only when an assistant_* column actually changes; lets the projector-only config endpoint report a freshness fingerprint without a full poll payload.';

-- Bump assistant_updated_at only when an assistant_* column actually changes
-- (mirrors touch_screen_channel in 20260702130000_screen_channels.sql), so an
-- unrelated poll edit (title, chart type, teams…) never perturbs it.
create or replace function public.touch_poll_assistant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.assistant_enabled is distinct from old.assistant_enabled)
     or (new.assistant_min_interval_s is distinct from old.assistant_min_interval_s)
     or (new.assistant_max_interval_s is distinct from old.assistant_max_interval_s) then
    new.assistant_updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_poll_assistant_touch on public.polls;
create trigger trg_poll_assistant_touch
before update on public.polls
for each row execute function public.touch_poll_assistant();
