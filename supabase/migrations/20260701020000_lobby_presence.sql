-- ----------------------------------------------------------------------------
-- Lobby presence authorization
--
-- The lobby "joined count" (AC-8) uses Supabase Realtime PRESENCE on a channel
-- named `lobby:<poll_id>`. Realtime Authorization (RLS on realtime.messages) is
-- enabled on this project, so PRESENCE on a PRIVATE channel requires the client
-- to both RECEIVE (select) and WRITE (insert) presence messages for the topic.
--
-- Unlike the `poll:%` tally channel (receive-only; only DB triggers emit), the
-- lobby channel is presence-only and clients MUST be able to insert their own
-- presence state. Presence carries no sensitive data (just an opaque key + role
-- + timestamp), so anon+authenticated may insert/select on lobby:% topics.
-- This is scoped strictly to the 'presence' + 'broadcast' extensions on lobby:%.
-- ----------------------------------------------------------------------------

create policy "lobby presence receive"
on realtime.messages
for select
to anon, authenticated
using (
  realtime.messages.extension in ('presence', 'broadcast')
  and realtime.topic() like 'lobby:%'
);

create policy "lobby presence write"
on realtime.messages
for insert
to anon, authenticated
with check (
  realtime.messages.extension in ('presence', 'broadcast')
  and realtime.topic() like 'lobby:%'
);
