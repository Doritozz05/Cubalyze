-- ═══════════════════════════════════════════════════════════════════════════
-- API grants — fix for the REST 401 on every table.
--
-- The original migration ran with "Automatically expose new tables" disabled
-- in the dashboard, so Supabase never granted table privileges to the API
-- roles. SELECT is the ONLY table privilege the app needs (pull reads via
-- REST; writes go exclusively through sync_apply).
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.solves, public.sessions,
  public.training_attempts, public.training_sessions, public.training_tasks,
  public.skill_progress, public.sync_tombstones
to anon, authenticated;

-- Re-expose the tables to PostgREST after the grant changes.
notify pgrst, 'reload schema';
