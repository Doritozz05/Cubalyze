-- ═══════════════════════════════════════════════════════════════════════════
-- Tombstone LWW + physical deletion.
--
-- The previous sync_apply only INSERTED into sync_tombstones, so a deleted
-- row never left the cloud: a brand-new device pulled tombstone (no-op) THEN
-- pulled the row itself and resurrected it, and deleted rows accumulated in
-- the cloud forever.
--
-- New contract (mirrored client-side in applyRemoteTombstones):
--   • a tombstone PHYSICALLY deletes the row, but ONLY when the row was not
--     edited after the tombstone (updated_at <= deleted_at);
--   • a row edited after the delete survives — the newer edit wins LWW and is
--     re-inserted by the editing device on its next push.
--
-- The row blocks are processed BEFORE the tombstone block; both orders
-- converge because a surviving edit re-inserts the row.
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
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(payload -> 'solves') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'solves') as x(
      user_id text, id text, session_id text, time_ms bigint, timestamp bigint, scramble text,
      penalty text, method text, source text, note text, moves text, orientation_timeline text,
      analysis_engine_version text, analysis text, puzzle_type text, is_demo int, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.solves (user_id, id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at)
        values (uid, rec.id, rec.session_id, rec.time_ms, rec.timestamp, rec.scramble, rec.penalty, rec.method, rec.source, rec.note, rec.moves, rec.orientation_timeline, rec.analysis_engine_version, rec.analysis, rec.puzzle_type, rec.is_demo, rec.created_at, rec.updated_at)
        on conflict (id) do update set
          session_id = excluded.session_id, time_ms = excluded.time_ms, timestamp = excluded.timestamp,
          scramble = excluded.scramble, penalty = excluded.penalty, method = excluded.method,
          source = excluded.source, note = excluded.note, moves = excluded.moves,
          orientation_timeline = excluded.orientation_timeline,
          analysis_engine_version = excluded.analysis_engine_version, analysis = excluded.analysis,
          puzzle_type = excluded.puzzle_type, updated_at = excluded.updated_at
        where excluded.updated_at >= public.solves.updated_at and public.solves.user_id = uid;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'sessions') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'sessions') as x(
      user_id text, id text, name text, puzzle_type text, created_at bigint, updated_at bigint, is_demo int
    )
    loop
      if rec.user_id = uid::text then
        insert into public.sessions (user_id, id, name, puzzle_type, created_at, updated_at, is_demo)
        values (uid, rec.id, rec.name, rec.puzzle_type, rec.created_at, rec.updated_at, rec.is_demo)
        on conflict (id) do update set
          name = excluded.name, puzzle_type = excluded.puzzle_type, updated_at = excluded.updated_at
        where excluded.updated_at >= public.sessions.updated_at and public.sessions.user_id = uid;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'profiles') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'profiles') as x(
      user_id text, display_name text, handle text, bio text, avatar_kind text, avatar_data text,
      main_puzzle text, declared_methods text, country text, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.profiles (user_id, display_name, handle, bio, avatar_kind, avatar_data, main_puzzle, declared_methods, country, created_at, updated_at)
        values (uid, rec.display_name, rec.handle, rec.bio, rec.avatar_kind, rec.avatar_data, rec.main_puzzle, rec.declared_methods, rec.country, rec.created_at, rec.updated_at)
        on conflict (user_id) do update set
          display_name = excluded.display_name, handle = excluded.handle, bio = excluded.bio,
          avatar_kind = excluded.avatar_kind, avatar_data = excluded.avatar_data,
          main_puzzle = excluded.main_puzzle, declared_methods = excluded.declared_methods,
          country = excluded.country, updated_at = excluded.updated_at
        where excluded.updated_at >= public.profiles.updated_at;
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
        on conflict (id) do update set
          review_grade = excluded.review_grade, updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_attempts.updated_at and public.training_attempts.user_id = uid;
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
        on conflict (id) do update set
          completed_at = excluded.completed_at, duration_ms = excluded.duration_ms,
          smart_cube_used = excluded.smart_cube_used, status = excluded.status, updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_sessions.updated_at and public.training_sessions.user_id = uid;
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
        on conflict (id) do update set
          title = excluded.title, description = excluded.description, start_date = excluded.start_date,
          repeat = excluded.repeat, days_of_week = excluded.days_of_week, color = excluded.color,
          updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_tasks.updated_at and public.training_tasks.user_id = uid;
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

        -- LWW physical delete: the tombstone only removes the row when the
        -- row was not edited after the delete. A newer edit survives and is
        -- re-inserted by the editing device on its next push.
        if rec.entity = 'solves' then
          delete from public.solves
          where user_id = uid and id = rec.entity_id and updated_at <= rec.deleted_at;
        elsif rec.entity = 'sessions' then
          -- A session with a child solve edited after the tombstone must
          -- survive (mirrors the client-side guard); otherwise the newer
          -- solve would be orphaned cloud-side and dropped on fresh links.
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
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.sync_apply(jsonb) from public;
grant execute on function public.sync_apply(jsonb) to authenticated;
