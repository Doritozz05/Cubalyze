-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 6 — sync_apply aprende el Locker (y se defiende de payloads abusivos).
--
-- Recrea public.sync_apply(jsonb) llevando el cuerpo de 20260912000010
-- (solve + cube_id/cube_label) y añade tres cosas:
--
--   1. Los bloques de gear_categories / gear_types / gear_items, con el mismo
--      contrato LWW (excluded.updated_at >= tabla.updated_at) y validación
--      user_id = auth.uid() por fila. Las columnas se DECLARAN en
--      jsonb_to_recordset: es la lección de M13 (20260912000010) — una clave
--      que no se declara se ignora en silencio y el dato nunca sale del
--      dispositivo.
--
--   2. Los tombstones de las tres entidades nuevas. Sin este `elsif`, un item
--      borrado en un dispositivo resucitaría en los demás: el pull solo
--      devuelve filas, y la única forma de propagar un borrado es este
--      borrado físico condicionado (LWW: la fila solo cae si no se editó
--      después del borrado).
--
--   3. Un guardián de payload (public.sync_payload_guard). Un cliente
--      comprometido o con un bug podía enviar un JSON arbitrariamente grande:
--      jsonb_to_recordset lo materializaría entero antes de que el LWW
--      rechazase una sola fila. El guardián acota tamaño (8 MB), forma y
--      número de filas (4 000 por llamada) ANTES de tocar ninguna tabla, con
--      el cliente batiendo a 500 filas por RPC (push.ts, BATCH = 500), así
--      que un envío legítimo nunca se acerca al límite.
--
-- La retención de tombstones (>90 días y sin fila destino) aprende las tres
-- entidades nuevas; si no, los tombstones de gear se acumularían para siempre.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Guardián de payload ───────────────────────────────────────────────────
-- `stable` (no `immutable`) porque va con `set search_path`: la volatilidad
-- no aporta nada y así no se coloca en el camino de la evaluación inmutable.
create or replace function public.sync_payload_guard(payload jsonb)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  k text;
  total int := 0;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'sync_apply: payload must be a JSON object';
  end if;

  if octet_length(payload::text) > 8388608 then
    raise exception 'sync_apply: payload exceeds 8 MB';
  end if;

  for k in select jsonb_object_keys(payload) loop
    if jsonb_typeof(payload -> k) = 'array' then
      total := total + jsonb_array_length(payload -> k);
    end if;
  end loop;

  if total > 4000 then
    raise exception 'sync_apply: payload carries % rows (max 4000 per call)', total;
  end if;
end $$;

-- Interno de sync_apply (security definer): nadie más lo necesita.
revoke all on function public.sync_payload_guard(jsonb) from public;

-- ── sync_apply ────────────────────────────────────────────────────────────
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
  applied_gcategories bigint := 0;
  applied_gtypes bigint := 0;
  applied_gitems bigint := 0;
  applied_tombstones bigint := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  perform public.sync_payload_guard(payload);

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

  -- ── Locker: categorías → tipos → items (padres primero) ─────────────────
  if jsonb_typeof(payload -> 'gear_categories') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'gear_categories') as x(
      user_id text, id text, name text, kind text, icon text, accent text,
      is_demo int, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.gear_categories (user_id, id, name, kind, icon, accent, is_demo, created_at, updated_at)
        -- coalesce en toda columna NOT NULL: `jsonb_to_recordset` deja NULL en
        -- una clave AUSENTE (no aplica el default de la tabla), así que un
        -- payload parcial abortaría el lote entero y atascaría el sync.
        values (uid, rec.id, coalesce(rec.name, ''), coalesce(rec.kind, 'gear'), coalesce(rec.icon, 'Box'), rec.accent, coalesce(rec.is_demo, 0), coalesce(rec.created_at, 0), coalesce(rec.updated_at, 0))
        on conflict (user_id, id) do update set
          name = excluded.name, kind = excluded.kind, icon = excluded.icon,
          accent = excluded.accent, updated_at = excluded.updated_at
        where excluded.updated_at >= public.gear_categories.updated_at;
        applied_gcategories := applied_gcategories + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'gear_types') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'gear_types') as x(
      user_id text, id text, category_id text, name text, puzzle_category text,
      is_demo int, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.gear_types (user_id, id, category_id, name, puzzle_category, is_demo, created_at, updated_at)
        values (uid, rec.id, coalesce(rec.category_id, ''), coalesce(rec.name, ''), rec.puzzle_category, coalesce(rec.is_demo, 0), coalesce(rec.created_at, 0), coalesce(rec.updated_at, 0))
        on conflict (user_id, id) do update set
          category_id = excluded.category_id, name = excluded.name,
          puzzle_category = excluded.puzzle_category, updated_at = excluded.updated_at
        where excluded.updated_at >= public.gear_types.updated_at;
        applied_gtypes := applied_gtypes + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'gear_items') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'gear_items') as x(
      user_id text, id text, category_id text, type_id text, name text, brand text, model text,
      finish text, serial text, smart_id text, palette text, acquired_at text, price_amount double precision,
      price_currency text, notes text, links text, photos text, tags text, status text, condition text,
      is_primary int, is_favorite int, rating double precision, quantity integer,
      is_demo int, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.gear_items (user_id, id, category_id, type_id, name, brand, model, finish, serial, smart_id, palette, acquired_at, price_amount, price_currency, notes, links, photos, tags, status, condition, is_primary, is_favorite, rating, quantity, is_demo, created_at, updated_at)
        values (uid, rec.id, coalesce(rec.category_id, ''), rec.type_id, coalesce(rec.name, ''), rec.brand, rec.model, rec.finish, rec.serial, rec.smart_id, coalesce(rec.palette, '[]'), rec.acquired_at, rec.price_amount, rec.price_currency, rec.notes, coalesce(rec.links, '[]'), coalesce(rec.photos, '[]'), coalesce(rec.tags, '[]'), coalesce(rec.status, 'owned'), rec.condition, coalesce(rec.is_primary, 0), coalesce(rec.is_favorite, 0), rec.rating, coalesce(rec.quantity, 1), coalesce(rec.is_demo, 0), coalesce(rec.created_at, 0), coalesce(rec.updated_at, 0))
        on conflict (user_id, id) do update set
          category_id = excluded.category_id, type_id = excluded.type_id, name = excluded.name,
          brand = excluded.brand, model = excluded.model, finish = excluded.finish,
          serial = excluded.serial, smart_id = excluded.smart_id, palette = excluded.palette,
          acquired_at = excluded.acquired_at, price_amount = excluded.price_amount,
          price_currency = excluded.price_currency, notes = excluded.notes, links = excluded.links,
          photos = excluded.photos, tags = excluded.tags, status = excluded.status,
          condition = excluded.condition, is_primary = excluded.is_primary,
          is_favorite = excluded.is_favorite, rating = excluded.rating, quantity = excluded.quantity,
          updated_at = excluded.updated_at
        where excluded.updated_at >= public.gear_items.updated_at;
        applied_gitems := applied_gitems + 1;
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

        -- LWW physical delete (carried forward from 0004/0005/0010): the
        -- tombstone only removes the row when the row was not edited after
        -- the delete. A newer edit survives and is re-inserted by the
        -- editing device on its next push.
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
        elsif rec.entity = 'gear_items' then
          delete from public.gear_items
          where user_id = uid and id = rec.entity_id and updated_at <= rec.deleted_at;
        elsif rec.entity = 'gear_types' then
          delete from public.gear_types
          where user_id = uid and id = rec.entity_id and updated_at <= rec.deleted_at;
        elsif rec.entity = 'gear_categories' then
          delete from public.gear_categories
          where user_id = uid and id = rec.entity_id and updated_at <= rec.deleted_at;
        end if;

        applied_tombstones := applied_tombstones + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  -- M4: tombstone retention carried forward (see 0005/0010) + gear entities.
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
      or (st.entity = 'gear_categories' and not exists (
        select 1 from public.gear_categories g where g.user_id = st.user_id and g.id = st.entity_id))
      or (st.entity = 'gear_types' and not exists (
        select 1 from public.gear_types g where g.user_id = st.user_id and g.id = st.entity_id))
      or (st.entity = 'gear_items' and not exists (
        select 1 from public.gear_items g where g.user_id = st.user_id and g.id = st.entity_id))
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
      'gear_categories', applied_gcategories,
      'gear_types', applied_gtypes,
      'gear_items', applied_gitems,
      'tombstones', applied_tombstones
    )
  );
end $$;

revoke all on function public.sync_apply(jsonb) from public;
grant execute on function public.sync_apply(jsonb) to authenticated;

notify pgrst, 'reload schema';
