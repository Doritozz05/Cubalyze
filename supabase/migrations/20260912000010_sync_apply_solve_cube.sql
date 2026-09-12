-- ═══════════════════════════════════════════════════════════════════════════
-- M13 — solve attribution reaches the cloud.
--
-- 20260912000009 added solves.cube_id / cube_label. That is necessary but NOT
-- sufficient: sync_apply reads the payload with `jsonb_to_recordset(...) as x(
-- <explicit column list>)`, so a key that is not DECLARED there is silently
-- ignored — the push would look successful and the attribution would never
-- leave the device.
--
-- This migration therefore recreates sync_apply with the two columns declared
-- and written, changing nothing else in the function.
--
--   • Old clients keep working: they do not send cube_id/cube_label, the
--     recordset leaves them NULL, and an LWW update writes NULL over NULL.
--   • New clients on a database that has NOT been migrated yet would push
--     rows whose cube keys are dropped — which is why both migrations ship
--     together and are applied in order.
--   • No data loss: the two columns are nullable and no existing value is
--     rewritten.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.sync_apply(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec record;
  skipped bigint := 0;
  applied_solves bigint := 0;
  applied_sessions bigint := 0;
  applied_profiles bigint := 0;
  applied_attempts bigint := 0;
  applied_tsessions bigint := 0;
  applied_ttasks bigint := 0;
  applied_skills bigint := 0;
  applied_tombstones bigint := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(payload -> 'solves') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'solves') as x(
      user_id text, id text, session_id text, time_ms bigint, timestamp bigint, scramble text,
      penalty text, method text, cube_id text, cube_label text, source text, note text, moves text,
      orientation_timeline text, analysis_engine_version text, analysis text, puzzle_type text,
      is_demo int, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.solves (user_id, id, session_id, time_ms, timestamp, scramble, penalty, method, cube_id, cube_label, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at)
        values (uid, rec.id, rec.session_id, rec.time_ms, rec.timestamp, rec.scramble, rec.penalty, rec.method, rec.cube_id, rec.cube_label, rec.source, rec.note, rec.moves, rec.orientation_timeline, rec.analysis_engine_version, rec.analysis, rec.puzzle_type, rec.is_demo, rec.created_at, rec.updated_at)
        on conflict (user_id, id) do update set
          session_id = excluded.session_id, time_ms = excluded.time_ms, timestamp = excluded.timestamp,
          scramble = excluded.scramble, penalty = excluded.penalty, method = excluded.method,
          cube_id = excluded.cube_id, cube_label = excluded.cube_label,
          source = excluded.source, note = excluded.note, moves = excluded.moves,
          orientation_timeline = excluded.orientation_timeline,
          analysis_engine_version = excluded.analysis_engine_version, analysis = excluded.analysis,
          puzzle_type = excluded.puzzle_type, updated_at = excluded.updated_at
        where excluded.updated_at >= public.solves.updated_at;
        applied_solves := applied_solves + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'sessions') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'sessions') as x(
      user_id text, id text, name text, created_at bigint, updated_at bigint, is_demo int
    )
    loop
      if rec.user_id = uid::text then
        insert into public.sessions (user_id, id, name, created_at, updated_at, is_demo)
        values (uid, rec.id, rec.name, rec.created_at, rec.updated_at, rec.is_demo)
        on conflict (user_id, id) do update set
          name = excluded.name, updated_at = excluded.updated_at
        where excluded.updated_at >= public.sessions.updated_at;
        applied_sessions := applied_sessions + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'profiles') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'profiles') as x(
      user_id text, display_name text, handle text, bio text, avatar_kind text, avatar_data text,
      main_puzzle text, declared_methods text, country text, identicon_seed text,
      created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.profiles (user_id, display_name, handle, bio, avatar_kind, avatar_data, main_puzzle, declared_methods, country, identicon_seed, created_at, updated_at)
        values (uid, rec.display_name, rec.handle, rec.bio, rec.avatar_kind, rec.avatar_data, rec.main_puzzle, rec.declared_methods, rec.country, rec.identicon_seed, rec.created_at, rec.updated_at)
        on conflict (user_id) do update set
          display_name = excluded.display_name, handle = excluded.handle, bio = excluded.bio,
          avatar_kind = excluded.avatar_kind, avatar_data = excluded.avatar_data,
          main_puzzle = excluded.main_puzzle, declared_methods = excluded.declared_methods,
          country = excluded.country, identicon_seed = coalesce(excluded.identicon_seed, public.profiles.identicon_seed),
          updated_at = excluded.updated_at
        where excluded.updated_at >= public.profiles.updated_at;
        applied_profiles := applied_profiles + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'training_attempts') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'training_attempts') as x(
      user_id text, id text, exercise_id text, method_id text, phase_id text, subset_id text, case_id text,
      scramble text, time_ms bigint, verdict text, play_mode text, expected_moves text, executed_moves text,
      tps real, move_count integer, optimal_moves integer, rotation_count integer, inspection_ms integer,
      review_grade text, session_id text, metric_kind text, timestamp bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.training_attempts (user_id, id, exercise_id, method_id, phase_id, subset_id, case_id, scramble, time_ms, verdict, play_mode, expected_moves, executed_moves, tps, move_count, optimal_moves, rotation_count, inspection_ms, review_grade, session_id, metric_kind, timestamp, updated_at)
        values (uid, rec.id, rec.exercise_id, rec.method_id, rec.phase_id, rec.subset_id, rec.case_id, rec.scramble, rec.time_ms, rec.verdict, rec.play_mode, rec.expected_moves, rec.executed_moves, rec.tps, rec.move_count, rec.optimal_moves, rec.rotation_count, rec.inspection_ms, rec.review_grade, rec.session_id, rec.metric_kind, rec.timestamp, rec.updated_at)
        on conflict (user_id, id) do update set
          review_grade = excluded.review_grade, updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_attempts.updated_at;
        applied_attempts := applied_attempts + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'training_sessions') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'training_sessions') as x(
      user_id text, id text, exercise_id text, method_id text, phase_id text, subset_id text,
      started_at bigint, completed_at bigint, duration_ms bigint, smart_cube_used int, status text, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.training_sessions (user_id, id, exercise_id, method_id, phase_id, subset_id, started_at, completed_at, duration_ms, smart_cube_used, status, updated_at)
        values (uid, rec.id, rec.exercise_id, rec.method_id, rec.phase_id, rec.subset_id, rec.started_at, rec.completed_at, rec.duration_ms, rec.smart_cube_used, rec.status, rec.updated_at)
        on conflict (user_id, id) do update set
          completed_at = excluded.completed_at, duration_ms = excluded.duration_ms,
          smart_cube_used = excluded.smart_cube_used, status = excluded.status, updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_sessions.updated_at;
        applied_tsessions := applied_tsessions + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'training_tasks') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'training_tasks') as x(
      user_id text, id text, title text, description text, start_date text, repeat text,
      days_of_week text, color text, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.training_tasks (user_id, id, title, description, start_date, repeat, days_of_week, color, created_at, updated_at)
        values (uid, rec.id, rec.title, rec.description, rec.start_date, rec.repeat, rec.days_of_week, rec.color, rec.created_at, rec.updated_at)
        on conflict (user_id, id) do update set
          title = excluded.title, description = excluded.description, start_date = excluded.start_date,
          repeat = excluded.repeat, days_of_week = excluded.days_of_week, color = excluded.color,
          updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_tasks.updated_at;
        applied_ttasks := applied_ttasks + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'skill_progress') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'skill_progress') as x(
      user_id text, skill_id text, completed_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.skill_progress (user_id, skill_id, completed_at)
        values (uid, rec.skill_id, rec.completed_at)
        on conflict (user_id, skill_id) do update set completed_at = excluded.completed_at
        where excluded.completed_at >= public.skill_progress.completed_at;
        applied_skills := applied_skills + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'tombstones') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'tombstones') as x(
      user_id text, entity text, entity_id text, deleted_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.sync_tombstones (user_id, entity, entity_id, deleted_at)
        values (uid, rec.entity, rec.entity_id, rec.deleted_at)
        on conflict (user_id, entity, entity_id) do update set deleted_at = excluded.deleted_at
        where excluded.deleted_at >= public.sync_tombstones.deleted_at;

        -- LWW physical delete (carried forward from 0004/0005): the tombstone
        -- only removes the row when the row was not edited after the delete.
        if rec.entity = 'solves' then
          delete from public.solves
          where user_id = uid and id = rec.entity_id and updated_at <= rec.deleted_at;
        elsif rec.entity = 'sessions' then
          delete from public.sessions s
          where s.user_id = uid and s.id = rec.entity_id and s.updated_at <= rec.deleted_at
            and not exists (
              select 1 from public.solves sv
              where sv.user_id = uid and sv.session_id = s.id
                and sv.updated_at > rec.deleted_at
            );
        elsif rec.entity = 'training_tasks' then
          delete from public.training_tasks
          where user_id = uid and id = rec.entity_id and updated_at <= rec.deleted_at;
        elsif rec.entity = 'skill_progress' then
          delete from public.skill_progress
          where user_id = uid and skill_id = rec.entity_id and completed_at <= rec.deleted_at;
        elsif rec.entity = 'training_sessions' then
          delete from public.training_sessions
          where user_id = uid and id = rec.entity_id and updated_at <= rec.deleted_at;
        end if;

        applied_tombstones := applied_tombstones + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  -- M4: tombstone retention carried forward (see 0005).
  delete from public.sync_tombstones st
  where st.user_id = uid
    and st.deleted_at < (extract(epoch from now()) - 90 * 86400) * 1000
    and (
      (st.entity = 'solves' and not exists (
        select 1 from public.solves s where s.user_id = st.user_id and s.id = st.entity_id))
      or (st.entity = 'sessions' and not exists (
        select 1 from public.sessions s where s.user_id = st.user_id and s.id = st.entity_id))
      or (st.entity = 'training_tasks' and not exists (
        select 1 from public.training_tasks t where t.user_id = st.user_id and t.id = st.entity_id))
      or (st.entity = 'skill_progress' and not exists (
        select 1 from public.skill_progress p where p.user_id = st.user_id and p.skill_id = st.entity_id))
      or (st.entity = 'training_sessions' and not exists (
        select 1 from public.training_sessions ts where ts.user_id = st.user_id and ts.id = st.entity_id))
    );

  return jsonb_build_object(
    'ok', true,
    'skipped', skipped,
    'applied', jsonb_build_object(
      'solves', applied_solves,
      'sessions', applied_sessions,
      'profiles', applied_profiles,
      'training_attempts', applied_attempts,
      'training_sessions', applied_tsessions,
      'training_tasks', applied_ttasks,
      'skill_progress', applied_skills,
      'tombstones', applied_tombstones
    )
  );
end $$;

revoke all on function public.sync_apply(jsonb) from public;
grant execute on function public.sync_apply(jsonb) to authenticated;

notify pgrst, 'reload schema';
