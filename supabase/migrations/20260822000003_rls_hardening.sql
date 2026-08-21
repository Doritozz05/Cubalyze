-- ═══════════════════════════════════════════════════════════════════════════
-- RLS hardening — resolves the Supabase database linter findings
-- (database-linter 0028 / 0029 / 0003):
--
--  1. `handle_new_user` and `rls_auto_enable` are SECURITY DEFINER functions
--     meant to run ONLY as triggers. The linter found them callable via
--     /rest/v1/rpc by `anon` and `authenticated` (functions default to
--     EXECUTE granted to PUBLIC). Revoke EXECUTE — triggers keep working
--     (they run as the owning role, which always has EXECUTE).
--
--  2. `sync_apply` stays executable by `authenticated` ON PURPOSE: it is the
--     app's single write path (REST writes are revoked; see 0001_api_grants).
--     It is defensively written — `security definer` with a pinned
--     search_path, `user_id = auth.uid()` verified per row, and LWW guards —
--     so the linter warning for it is a known, intentional exception.
--
--  3. RLS policies re-evaluate auth.uid() (a current_setting() lookup) once
--     PER ROW. Wrapping it in a subselect `(select auth.uid())` turns it into
--     an initplan: evaluated ONCE per query. Same semantics, faster at scale.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Trigger-only SECURITY DEFINER functions are no longer callable ──────
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ) then
    revoke all on function public.handle_new_user() from anon, authenticated;
    revoke all on function public.handle_new_user() from public;
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke all on function public.rls_auto_enable() from anon, authenticated;
    revoke all on function public.rls_auto_enable() from public;
  end if;
end $$;

-- ── 3. Initplan-optimized policies (auth.uid() evaluated once per query) ───
do $$
declare t text;
begin
  foreach t in array array['profiles','solves','sessions','training_attempts','training_sessions','training_tasks','skill_progress','sync_tombstones']
  loop
    execute format('drop policy if exists "owner_all_%s" on public.%I', t, t);
    execute format(
      'create policy "owner_all_%s" on public.%I for all
       using (user_id = (select auth.uid()))
       with check (user_id = (select auth.uid()))',
      t, t
    );
  end loop;
end $$;
