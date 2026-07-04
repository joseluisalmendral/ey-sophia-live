-- Anonymous display mode: when enabled, the projector hides team identities
-- (names + colors) during lobby/countdown/open and only reveals them in the
-- closing reveal scene. Presentation-only flag: voting, tallies and RLS are
-- untouched (polls is already publicly readable by anon).
alter table polls
  add column anonymous_display boolean not null default false;

comment on column polls.anonymous_display is
  'When true, the big screen anonymizes team names/colors during voting; identities are revealed only at the final reveal.';
