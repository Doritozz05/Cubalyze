-- ═══════════════════════════════════════════════════════════════════════════
-- Restore service_role privileges on the sync tables.
--
-- The hardening migration revoked writes from anon/authenticated only, but
-- the project was created with "Automatically expose new tables" disabled,
-- so service_role never received its standard grants either. service_role is
-- the trusted server-side admin role (edge functions, admin tasks) and is
-- supposed to have full access — the standard Supabase default.
-- ═══════════════════════════════════════════════════════════════════════════

grant select, insert, update, delete on public.profiles, public.solves,
  public.sessions, public.training_attempts, public.training_sessions,
  public.training_tasks, public.skill_progress, public.sync_tombstones
to service_role;
