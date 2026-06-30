-- ============================================================================
-- SEED — demo poll for development / realtime testing
-- Idempotent: keyed on join_code so re-running won't duplicate.
-- ============================================================================

insert into public.polls (title, status, join_code, duration_seconds, chart_type)
values ('Demo — Mejor equipo', 'draft', 'DEMO42', 180, 'bar_race')
on conflict (join_code) do nothing;

insert into public.teams (poll_id, name, color, position)
select p.id, t.name, t.color, t.position
from public.polls p
cross join (values
  ('Equipo Aurora',  '#FFE600', 0),
  ('Equipo Cosmos',  '#00C389', 1),
  ('Equipo Nebula',  '#7DB8FF', 2),
  ('Equipo Quasar',  '#FF6B6B', 3)
) as t(name, color, position)
where p.join_code = 'DEMO42'
  and not exists (select 1 from public.teams where poll_id = p.id);
