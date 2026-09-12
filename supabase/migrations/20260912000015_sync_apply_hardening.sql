-- ═══════════════════════════════════════════════════════════════════════════
-- Auditoría de seguridad 2026-09-12 — hardening de sync_apply.
--
-- Tres hallazgos, todos corregidos aquí, todos verificados contra el Postgres
-- real antes de aplicarse (ver docs/10-security/Auditoria-2026-09-12.md):
--
-- H1 · El pull cursor se envenenaba para siempre (CRÍTICO).
--      `sync_apply` no acotaba `updated_at` / `deleted_at`. Un dispositivo con
--      el reloj mal (o un cliente manipulado) podía subir una sola fila con
--      `updated_at = 99999999999999` (año 5138) y GANABA el LWW contra
--      cualquier edición posterior de cualquier otro dispositivo. Peor: el
--      pull avanza su watermark al MÁXIMO de las filas descargadas, así que
--      TODOS los dispositivos del usuario fijaban su cursor en el año 5138 y
--      a partir de ahí no volvían a descargar nada de esa tabla — un apagón
--      de sync permanente y silencioso (la UI dice "idle").
--      Demostrado: tras el envenenamiento, `updated_at > 99999999999999`
--      devuelve 0 filas para siempre.
--      Arreglo: `least(<sello>, now_ms + 5min)`. Se ACOTA, no se rechaza, a
--      propósito: rechazar lanzaría una excepción y, como el RPC es atómico,
--      abortaría el lote entero — el mismo cuelgue que el guardián de M13
--      existe para evitar. La gracia de 5 min deja intacto el desfase normal
--      entre dispositivos (NTP) y acota la ventana de daño a 5 min en vez de
--      a "para siempre". Como el predicado LWW compara con `excluded.updated_at`
--      y esa expresión ya viene acotada, un sello futuro sigue ganando su
--      conflicto (como debe) pero se guarda en `now()`, así que nunca puede
--      colarse en el cursor de nadie.
--
-- H2 · Un payload parcial atascaba el sync entero (ALTO).
--      `jsonb_to_recordset` deja NULL en una clave AUSENTE (no aplica el
--      DEFAULT de la tabla), así que pasar NULL explícito a una columna
--      NOT NULL viola la restricción. La migración 12 arregló esto para el
--      Locker (`coalesce`) pero las siete tablas anteriores seguían expuestas:
--      un cliente con una versión antigua (el service worker mantiene versiones
--      vivas) que no conociese, por ejemplo, `profiles.handle`, hacía fallar el
--      lote ENTERO — solves, training y Locker incluidos — y el watermark no
--      avanzaba: cuelgue permanente hasta actualizar la app.
--      Arreglo: `coalesce` con el MISMO default que declara la tabla, en cada
--      columna NOT NULL de los once bloques.
--
-- H3 · Tombstones de entidades desconocidas nunca se purgaban (BAJO).
--      `entity` no está restringido y la retención solo reconoce las ocho
--      entidades con rama de borrado físico, así que un tombstone con
--      `entity = 'training_attempts'` (no hay rama) caía en un `and (…)` falso
--      y se quedaba para siempre. Un cliente podía inflar la tabla a 4 000
--      filas por llamada, sin límite de llamadas.
--      Arreglo: la retención purga también cualquier entidad fuera de la lista
--      conocida pasados 90 días. Sin allow-list: rechazar entidades
--      desconocidas reintroduciría H2 en el futuro.
--
-- Y un índice que faltaba: la guarda de borrado de `sessions` filtra
-- `solves` por `(user_id, session_id)` y no existía ese índice, así que cada
-- tombstone de sesión de un usuario con 100 000 solves recorría el índice
-- entero del usuario. El EXPLAIN contra producción lo confirmó (`Index Scan
-- using idx_solves_user_cube` + `Filter: session_id = ...`).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── H3 (índice) ───────────────────────────────────────────────────────────
create index if not exists idx_solves_user_session
  on public.solves (user_id, session_id);

-- ── H1 + H2 + H3: sync_apply ──────────────────────────────────────────────
create or replace function public.sync_apply(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  -- Reloj del servidor: única fuente de verdad para acotar sellos. Un
  -- dispositivo no puede pisarlo porque `search_path` está fijado y la función
  -- es security definer.
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  -- Tolerancia de desfase entre relojes. Por encima de esto, el sello se acota.
  max_stamp bigint := now_ms + 300000; -- +5 min
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

  -- Convención de todos los bloques:
  --   coalesce(rec.x, <default de la tabla>)   → columna NOT NULL (H2)
  --   least(..., max_stamp)                    → sello temporal   (H1)
  -- Nunca se usa `least` sobre una DURACIÓN (time_ms, duration_ms): esas no
  -- son instantes y acotarlas corrompería el dato.
  --
  -- Las CLAVES DE IDENTIDAD (`id`, `skill_id`) tampoco tienen default, así que
  -- también van con `coalesce(..., '')`. Un payload sin id queda como UNA fila
  -- con clave '' en vez de revertir el lote: es un intercambio deliberado
  -- (una fila basura propia e invisible) contra un cuelgue de sync total. El
  -- mapper del cliente siempre emite el id, así que no se alcanza en la
  -- práctica, y el test de regresión de S) fija la invariante.

  -- ── solves ──────────────────────────────────────────────────────────────
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
        values (uid, coalesce(rec.id, ''),
          coalesce(rec.session_id, ''),
          -- Duración, NO instante: se rellena por defecto pero nunca se acota.
          coalesce(rec.time_ms, 0),
          least(coalesce(rec.timestamp, 0), max_stamp),
          coalesce(rec.scramble, ''),
          coalesce(rec.penalty, 'none'),
          rec.method, rec.cube_id, rec.cube_label,
          coalesce(rec.source, 'manual'),
          rec.note,
          coalesce(rec.moves, '[]'),
          rec.orientation_timeline, rec.analysis_engine_version, rec.analysis,
          coalesce(rec.puzzle_type, '333'),
          coalesce(rec.is_demo, 0),
          least(coalesce(rec.created_at, 0), max_stamp),
          least(coalesce(rec.updated_at, 0), max_stamp))
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

  -- ── sessions ────────────────────────────────────────────────────────────
  if jsonb_typeof(payload -> 'sessions') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'sessions') as x(
      user_id text, id text, name text, created_at bigint, updated_at bigint, is_demo int
    )
    loop
      if rec.user_id = uid::text then
        insert into public.sessions (user_id, id, name, created_at, updated_at, is_demo)
        values (uid, coalesce(rec.id, ''),
          coalesce(rec.name, ''),
          least(coalesce(rec.created_at, 0), max_stamp),
          least(coalesce(rec.updated_at, 0), max_stamp),
          coalesce(rec.is_demo, 0))
        on conflict (user_id, id) do update set
          name = excluded.name, updated_at = excluded.updated_at
        where excluded.updated_at >= public.sessions.updated_at;
        applied_sessions := applied_sessions + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  -- ── profiles (upsert por user_id) ───────────────────────────────────────
  if jsonb_typeof(payload -> 'profiles') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'profiles') as x(
      user_id text, display_name text, handle text, bio text, avatar_kind text, avatar_data text,
      main_puzzle text, declared_methods text, country text, identicon_seed text,
      created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.profiles (user_id, display_name, handle, bio, avatar_kind, avatar_data, main_puzzle, declared_methods, country, identicon_seed, created_at, updated_at)
        values (uid,
          coalesce(rec.display_name, ''),
          coalesce(rec.handle, ''),
          coalesce(rec.bio, ''),
          coalesce(rec.avatar_kind, 'identicon'),
          rec.avatar_data,
          coalesce(rec.main_puzzle, '333'),
          coalesce(rec.declared_methods, '[]'),
          coalesce(rec.country, ''),
          rec.identicon_seed,
          least(coalesce(rec.created_at, 0), max_stamp),
          least(coalesce(rec.updated_at, 0), max_stamp))
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

  -- ── training_attempts (LWW solo sobre review_grade) ─────────────────────
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
        values (uid, coalesce(rec.id, ''),
          coalesce(rec.exercise_id, ''),
          coalesce(rec.method_id, ''),
          rec.phase_id, rec.subset_id, rec.case_id,
          coalesce(rec.scramble, ''),
          coalesce(rec.time_ms, 0),
          coalesce(rec.verdict, 'correct'),
          coalesce(rec.play_mode, 'manual'),
          rec.expected_moves, rec.executed_moves, rec.tps, rec.move_count, rec.optimal_moves,
          rec.rotation_count, rec.inspection_ms, rec.review_grade, rec.session_id,
          coalesce(rec.metric_kind, 'execution'),
          least(coalesce(rec.timestamp, 0), max_stamp),
          least(coalesce(rec.updated_at, 0), max_stamp))
        on conflict (user_id, id) do update set
          review_grade = excluded.review_grade, updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_attempts.updated_at;
        applied_attempts := applied_attempts + 1;
      else
        skipped := skipped + 1;
      end if;
    end loop;
  end if;

  -- ── training_sessions ───────────────────────────────────────────────────
  if jsonb_typeof(payload -> 'training_sessions') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'training_sessions') as x(
      user_id text, id text, exercise_id text, method_id text, phase_id text, subset_id text,
      started_at bigint, completed_at bigint, duration_ms bigint, smart_cube_used int, status text, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.training_sessions (user_id, id, exercise_id, method_id, phase_id, subset_id, started_at, completed_at, duration_ms, smart_cube_used, status, updated_at)
        values (uid, coalesce(rec.id, ''),
          coalesce(rec.exercise_id, ''),
          coalesce(rec.method_id, ''),
          rec.phase_id, rec.subset_id,
          least(coalesce(rec.started_at, 0), max_stamp),
          least(coalesce(rec.completed_at, 0), max_stamp),
          coalesce(rec.duration_ms, 0),
          coalesce(rec.smart_cube_used, 0),
          coalesce(rec.status, 'active'),
          least(coalesce(rec.updated_at, 0), max_stamp))
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

  -- ── training_tasks (tareas del calendario) ──────────────────────────────
  if jsonb_typeof(payload -> 'training_tasks') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'training_tasks') as x(
      user_id text, id text, title text, description text, start_date text, repeat text,
      days_of_week text, color text, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.training_tasks (user_id, id, title, description, start_date, repeat, days_of_week, color, created_at, updated_at)
        values (uid, coalesce(rec.id, ''),
          coalesce(rec.title, ''),
          coalesce(rec.description, ''),
          coalesce(rec.start_date, ''),
          coalesce(rec.repeat, 'none'),
          coalesce(rec.days_of_week, '[]'),
          coalesce(rec.color, 'blue'),
          least(coalesce(rec.created_at, 0), max_stamp),
          least(coalesce(rec.updated_at, 0), max_stamp))
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

  -- ── skill_progress (el sello es completed_at, no updated_at) ────────────
  if jsonb_typeof(payload -> 'skill_progress') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'skill_progress') as x(
      user_id text, skill_id text, completed_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.skill_progress (user_id, skill_id, completed_at)
        values (uid, coalesce(rec.skill_id, ''),
          least(coalesce(rec.completed_at, 0), max_stamp))
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
        values (uid, coalesce(rec.id, ''), coalesce(rec.name, ''), coalesce(rec.kind, 'gear'), coalesce(rec.icon, 'Box'), rec.accent,
          coalesce(rec.is_demo, 0),
          least(coalesce(rec.created_at, 0), max_stamp),
          least(coalesce(rec.updated_at, 0), max_stamp))
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
        values (uid, coalesce(rec.id, ''), coalesce(rec.category_id, ''), coalesce(rec.name, ''), rec.puzzle_category,
          coalesce(rec.is_demo, 0),
          least(coalesce(rec.created_at, 0), max_stamp),
          least(coalesce(rec.updated_at, 0), max_stamp))
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
        values (uid, coalesce(rec.id, ''), coalesce(rec.category_id, ''), rec.type_id, coalesce(rec.name, ''), rec.brand, rec.model, rec.finish, rec.serial, rec.smart_id,
          coalesce(rec.palette, '[]'), rec.acquired_at, rec.price_amount, rec.price_currency, rec.notes,
          coalesce(rec.links, '[]'), coalesce(rec.photos, '[]'), coalesce(rec.tags, '[]'),
          coalesce(rec.status, 'owned'), rec.condition,
          coalesce(rec.is_primary, 0), coalesce(rec.is_favorite, 0), rec.rating,
          coalesce(rec.quantity, 1),
          coalesce(rec.is_demo, 0),
          least(coalesce(rec.created_at, 0), max_stamp),
          least(coalesce(rec.updated_at, 0), max_stamp))
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

  -- ── tombstones ──────────────────────────────────────────────────────────
  if jsonb_typeof(payload -> 'tombstones') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'tombstones') as x(
      user_id text, entity text, entity_id text, deleted_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.sync_tombstones (user_id, entity, entity_id, deleted_at)
        values (uid,
          coalesce(rec.entity, ''),
          coalesce(rec.entity_id, ''),
          least(coalesce(rec.deleted_at, 0), max_stamp))
        on conflict (user_id, entity, entity_id) do update set deleted_at = excluded.deleted_at
        where excluded.deleted_at >= public.sync_tombstones.deleted_at;

        -- LWW physical delete (de 0004/0005/0010/0012): el tombstone solo borra
        -- la fila si esa fila no se editó DESPUÉS del borrado.
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

  -- ── Retención de tombstones (>90 días y sin fila destino) ───────────────
  -- H3: la última condición recoge entidades que no tienen rama de borrado
  -- (p. ej. `training_attempts`), que antes caían en un `and (…)` siempre falso
  -- y se acumulaban para siempre.
  delete from public.sync_tombstones st
  where st.user_id = uid
    and st.deleted_at < (extract(epoch from now()) - 90 * 86400) * 1000
    and (
      st.entity not in (
        'solves', 'sessions', 'training_tasks', 'skill_progress',
        'training_sessions', 'gear_categories', 'gear_types', 'gear_items'
      )
      or (st.entity = 'solves' and not exists (
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
