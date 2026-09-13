-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 8 · F8.2 + F8.3 — La superficie de amigos.
--
-- Aquí vive TODO lo que un usuario puede hacer o ver respecto a otro. Las
-- tablas de la migración 17 no conceden nada a los roles de API: sin estas
-- funciones, no hay camino. Eso concentra la auditoría en un solo fichero.
--
-- Invariantes de cada función pública, sin excepción:
--   1. `security definer` + `set search_path = public` (nadie puede cambiar lo
--      que la función resuelve con un `search_path` propio).
--   2. `auth.uid()` obligatorio: sin sesión, excepción.
--   3. Puerta de amistad explícita (`are_friends`) y de visibilidad
--      (`profile_visibility`) para cualquier dato ajeno.
--   4. Lista blanca de campos: lo que no está en el `jsonb_build_object` no
--      existe para el otro lado. `serial`, `smart_id`, precios, `notes` y
--      `links` NO se construyen aquí — no es que se filtren después, es que
--      nunca se leen.
--   5. Respuesta ENVOLVENTE (`{ok, reason, …}`) y nunca una excepción por un
--      estado de producto esperable (ya no me quiere, no existe, está cerrado).
--      Excepción solo para lo anómalo: sin sesión.
--   6. `share_profile` es una puerta de verdad: el perfil extendido (bio, país,
--      métodos, rompecabezas principal, avatar en base64) solo sale por
--      `friend_profile_json`, y solo cuando el dueño lo comparte. Todo lo demás
--      — solicitudes pendientes, bloqueos, la lista de amigos de alguien que lo
--      cerró — proyecta `friend_profile_min_json` (identidad y nada más).
--
-- También vive aquí `handle_claim`, aunque sea identidad y no amigos: es la
-- única función pública que necesita el freno de intentos, y el freno es de
-- esta capa. La alternativa era una llamada hacia delante desde la migración
-- 16 (aplicable solo si el juego completo va junto), y no compensa.
--
-- Sobre privacidad y enumeración: `friend_request_send` a un handle que no
-- existe y a uno que te ha bloqueado devuelven LO MISMO (`not_found`), para no
-- dar acuse al bloqueado. `closed` sí es distinto: es un estado de
-- consentimiento que el dueño ha elegido publicar, no un bloqueo.
--
-- Fórmulas de estadística: replican `@cubeforge/statistics` (computeStats /
-- effectiveTime) y `useProfileStats`, NO se reinterpretan. Es el riesgo R1 del
-- plan: dos implementaciones de la misma cuenta divergen si alguien "mejora"
-- una sola. Cualquier cambio aquí exige el test de paridad de §10.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Utilidades internas ───────────────────────────────────────────────────

/** Inicio de la ventana actual, en ms. */
create or replace function public.friend_window_start(p_window_ms bigint)
returns bigint
language sql
immutable
set search_path = public
as $$
  select ((extract(epoch from now()) * 1000)::bigint / p_window_ms) * p_window_ms;
$$;

/**
 * Consume una ficha de la ventana actual y dice si sigue dentro del límite.
 * Ventana fija: simple, barata y suficiente para frenar a un cliente que
 * automatiza. El conteo se incrementa SIEMPRE (también cuando ya se pasó), así
 * que insistir no reinicia nada.
 *
 * La retención vive aquí, no en un cron: `pg_cron` es un cambio pendiente
 * (auditoría P5) y una tabla de cuotas sin limpieza crece una fila por
 * actor/acción/ventana para siempre. El `delete` usa el prefijo `actor` de la
 * clave primaria, así que es un escaneo de índice corto, y solo conserva las
 * ventanas de los últimos 7 días — nadie mira más atrás.
 */
create or replace function public.friend_rate_check(
  p_action text,
  p_limit int,
  p_window_ms bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c int;
begin
  if uid is null then
    return false;
  end if;

  delete from public.friend_rate_limits
  where actor = uid
    and window_start < public.friend_window_start(p_window_ms) - 7 * 86400000;

  insert into public.friend_rate_limits (actor, action, window_start, count)
  values (uid, p_action, public.friend_window_start(p_window_ms), 1)
  on conflict (actor, action, window_start)
    do update set count = public.friend_rate_limits.count + 1
  returning count into c;
  return c <= p_limit;
end $$;

/** JSONB tolerante: una columna de texto con JSON corrupto no debe reventar. */
create or replace function public.jsonb_or_empty(p_raw text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_raw is null or btrim(p_raw) = '' then
    return '[]'::jsonb;
  end if;
  begin
    return p_raw::jsonb;
  exception when others then
    return '[]'::jsonb;
  end;
end $$;

-- ── Proyecciones de perfil ───────────────────────────────────────────────
-- Hay DOS formas de ver a una persona, y la diferencia no es cosmética:
--
--   • `friend_profile_min_json` — la IDENTIDAD, y solo la identidad: lo
--     imprescindible para pintar una tarjeta (nombre, handle, tipo de avatar y
--     el `user_id`, que es la semilla del CubeMark). Es lo que ve cualquier
--     relación activa — una solicitud enviada o recibida, un bloqueo — y
--     también un amigo que ha cerrado su perfil.
--
--     Deliberadamente NO incluye `avatar_data` (puede ser una foto en base64:
--     bytes privados a los que una solicitud pendiente no da derecho; la
--     tarjeta pinta el identicon derivado de `user_id`), ni bio, país,
--     métodos, `main_puzzle` o `created_at`.
--
--   • `friend_profile_json` — la identidad MÁS el perfil extendido (bio, país,
--     métodos, rompecabezas principal, alta). Es lo que ve un amigo cuando su
--     dueño comparte perfil.
--
-- Y una sola puerta que decide entre las dos:
--
--   • `friend_visible_profile_json` — completa si el dueño comparte perfil,
--     mínima si lo cerró. Es la que usan las listas de amigos: así
--     `share_profile` significa algo (antes se ignoraba en `friend_list` y
--     `avatar_data`, país y métodos salían igual, con el interruptor apagado).
--     `friend_profile` NO la usa: ahí "cerrado" tiene que ser `not_shared`
--     explícito, porque la página de perfil muestra un estado, no una tarjeta.

/** Identidad mínima: tarjeta de cualquier relación activa. */
create or replace function public.friend_profile_min_json(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'handle', p.handle,
    'avatar_kind', p.avatar_kind
  )
  from public.profiles p
  where p.user_id = p_user;
$$;

/** Perfil extendido: se construye aquí y en ningún otro sitio. */
create or replace function public.friend_profile_json(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'handle', p.handle,
    'bio', p.bio,
    'avatar_kind', p.avatar_kind,
    'avatar_data', p.avatar_data,
    'main_puzzle', p.main_puzzle,
    'declared_methods', public.jsonb_or_empty(p.declared_methods),
    'country', p.country,
    'created_at', p.created_at
  )
  from public.profiles p
  where p.user_id = p_user;
$$;

/** La proyección de un AMIGO: extendida si comparte perfil, mínima si no. */
create or replace function public.friend_visible_profile_json(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(
      (select v.share_profile from public.profile_visibility v where v.user_id = p_owner),
      true
    ) then public.friend_profile_json(p_owner)
    else public.friend_profile_min_json(p_owner)
  end;
$$;

-- Sin EXECUTE para nadie: son maquinaria interna de las funciones de abajo.
revoke all on function public.friend_window_start(bigint) from public, anon, authenticated;
revoke all on function public.friend_rate_check(text, int, bigint) from public, anon, authenticated;
revoke all on function public.jsonb_or_empty(text) from public, anon, authenticated;
revoke all on function public.friend_profile_min_json(uuid) from public, anon, authenticated;
revoke all on function public.friend_profile_json(uuid) from public, anon, authenticated;
revoke all on function public.friend_visible_profile_json(uuid) from public, anon, authenticated;

-- ── Identidad ─────────────────────────────────────────────────────────────
-- `handle_claim` vivía en la migración 16 (formato canónico, unicidad,
-- trigger). Se movió aquí por una razón de orden: necesita `friend_rate_check`,
-- y un `create function` que llame a algo definido dos migraciones más adelante
-- es una referencia hacia delante (funciona en un `db push` completo, revienta
-- si alguien aplica la 16 sola). Aquí ya existe todo lo anterior.
--
-- Única vía de la UI para fijar un handle: comprueba y escribe en la MISMA
-- transacción (sin "check-then-set"), y devuelve el sello de servidor que el
-- cliente debe adoptar localmente para que el pull no lo traiga de vuelta.
--
-- El error `taken` revela que un handle existe — es inherente a "añadir por
-- handle" (residual aceptado y documentado en el plan, §6.4). Lo que NO se
-- acepta es la adivinación masiva: el formato exacto acota el espacio, y el
-- freno de intentos (dos ventanas: ráfaga horaria y techo diario) acota el
-- ritmo. Sin él, `taken` era un oráculo ilimitado: se podía barrer el
-- diccionario de handles a la velocidad de la red y, de paso, dejar la tabla
-- de intentos como residuo de escrituras.
--
-- Residual aceptado (auditoría B4): dos claims concurrentes de la MISMA cuenta
-- con handles distintos pueden devolver `ok` los dos — el índice serializa las
-- transacciones y gana la última que escribe. El "perdedor" no miente sobre el
-- estado de SU transacción (en ese instante el handle era suyo), y su cliente
-- converge al handle vigente en el siguiente pull, porque el sello es de
-- servidor y estrictamente creciente. Bloquear la fila antes de responder no
-- cambiaría quién gana, solo añadiría una espera.
create or replace function public.handle_claim(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  stamped bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Freno ANTES de tocar nada: una comprobación de disponibilidad y un intento
  -- de reserva cuestan lo mismo. La ventana horaria frena el barrido; la diaria
  -- pone un techo que sobrevive a cambiar de hora.
  if not public.friend_rate_check('claim_hour', 30, 3600000)
     or not public.friend_rate_check('claim_day', 200, 86400000) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  clean := public.normalize_handle(p_handle);
  if clean is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Ya es tuyo: idempotente (reintentos, doble clic, dos dispositivos).
  if exists (
    select 1 from public.profiles where user_id = uid and lower(handle) = clean
  ) then
    return jsonb_build_object('ok', true, 'handle', clean, 'unchanged', true);
  end if;

  -- Disponibilidad explícita. El trigger `profiles_protect_handle` NO lanza
  -- cuando el handle es de otro: reescribe `NEW.handle` y deja pasar la fila
  -- con el handle anterior. Eso es lo que mantiene el lote de sync a salvo,
  -- pero significa que un `insert … on conflict` aquí podría "tener éxito" sin
  -- haber escrito nada — y devolver `ok` mientras el handle sigue siendo otro.
  -- Por eso hay tres capas y no una:
  --   1. esta comprobación (da el motivo y la sugerencia),
  --   2. el índice único (carrera real entre dos transacciones concurrentes,
  --      que atrapa el `exception` de abajo),
  --   3. la relectura posterior (cubre cualquier veto silencioso del trigger).
  if exists (
    select 1 from public.profiles p
    where p.user_id <> uid and lower(p.handle) = clean
  ) then
    return jsonb_build_object(
      'ok', false, 'reason', 'taken', 'suggestion', public.handle_suggestion(clean)
    );
  end if;

  insert into public.profiles (user_id, handle, created_at, updated_at)
  values (uid, clean, now_ms, now_ms)
  on conflict (user_id) do update
    -- Sello de servidor, estrictamente creciente: el pull del propio
    -- dispositivo tiene que ver este cambio como nuevo.
    set handle = clean,
        updated_at = greatest(public.profiles.updated_at + 1, now_ms)
  returning updated_at into stamped;

  -- Capa 3: se verifica lo que quedó escrito, no lo que se pretendía escribir.
  if (select lower(handle) from public.profiles where user_id = uid) <> clean then
    return jsonb_build_object(
      'ok', false, 'reason', 'taken', 'suggestion', public.handle_suggestion(clean)
    );
  end if;

  return jsonb_build_object('ok', true, 'handle', clean, 'updated_at', stamped);

exception
  when unique_violation then
    -- Carrera perdida entre dos claims concurrentes: el índice único decide.
    return jsonb_build_object(
      'ok', false,
      'reason', 'taken',
      'suggestion', public.handle_suggestion(clean)
    );
end $$;

-- Permisos: en el bloque central de la superficie pública, al final del
-- fichero. Un solo sitio donde auditar qué alcanza `authenticated`.

-- ── Solicitudes ───────────────────────────────────────────────────────────

/**
 * Enviar una solicitud por handle exacto.
 *
 * La respuesta lleva la IDENTIDAD MÍNIMA del destino (`friend_profile_min_json`),
 * nunca su perfil: quien pregunta aún no es amigo, y su `share_profile` no
 * puede decidir nada sobre la puerta que él ya eligió abrir (`allow_requests`).
 *
 * Auto-aceptación (decisión D1, 2026-09-12): si la otra persona YA te había
 * solicitado, la intención es mutua y la fila pasa a `accepted` en la misma
 * transacción. Esa es la única vía por la que una amistad nace sin que nadie
 * pulse "aceptar".
 */
create or replace function public.friend_request_send(
  p_handle text,
  p_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text;
  target uuid;
  low uuid;
  high uuid;
  existing public.friendships%rowtype;
  raced_status text;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  msg text := left(coalesce(p_message, ''), 200);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.friend_rate_check('request', 20, 86400000) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  clean := public.normalize_handle(p_handle);
  if clean is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select user_id into target from public.profiles where lower(handle) = clean;
  if target is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if target = uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- Bloqueo en cualquier dirección: misma respuesta que "no existe". Que quien
  -- bloquea no aparezca es justo lo que espera quien bloquea.
  if exists (
    select 1 from public.friend_blocks b
    where (b.blocker = uid and b.blocked = target)
       or (b.blocker = target and b.blocked = uid)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if not coalesce(
    (select allow_requests from public.profile_visibility where user_id = target),
    true
  ) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  low := least(uid, target);
  high := greatest(uid, target);

  select * into existing from public.friendships
  where user_low = low and user_high = high;

  if found then
    if existing.status = 'accepted' then
      return jsonb_build_object('ok', false, 'reason', 'already_friends');
    end if;

    if existing.requested_by = uid then
      -- Idempotente: repetir la solicitud no cambia nada (y no molesta al otro).
      return jsonb_build_object('ok', false, 'reason', 'pending');
    end if;

    -- D1: intención mutua → amistad.
    update public.friendships
    set status = 'accepted',
        responded_at = now_ms,
        updated_at = now_ms
    where user_low = low and user_high = high;

    return jsonb_build_object(
      'ok', true,
      'accepted', true,
      'target', public.friend_profile_min_json(target)
    );
  end if;

  -- Carrera real: dos solicitudes cruzadas pueden no verse entre sí (READ
  -- COMMITTED: cada statement tiene su propia foto) y las dos llegan hasta
  -- aquí. Antes, la segunda moría con un `unique_violation` sin capturar → 500
  -- → el cliente lo contaba como "sin conexión" por algo que era, literalmente,
  -- una amistad naciendo. El `on conflict` convierte el único conflicto posible
  -- (la PK del par) en lo que la intención cruzada significa: aceptar. Si la
  -- fila con la que choca es mi propia solicitud pendiente, el `where` la deja
  -- intacta y la respuesta es `pending` (idempotente), no un error.
  insert into public.friendships
    (user_low, user_high, requested_by, status, message, created_at, updated_at)
  values (low, high, uid, 'pending', msg, now_ms, now_ms)
  on conflict (user_low, user_high) do update
    set status = 'accepted',
        responded_at = now_ms,
        updated_at = greatest(public.friendships.updated_at + 1, now_ms)
    where public.friendships.status = 'pending'
      and public.friendships.requested_by <> uid
  returning status into raced_status;

  if raced_status is null then
    -- Chocamos con una fila que no era aceptable: mi propia solicitud pendiente,
    -- o una amistad que otra transacción acaba de aceptar. Releer y decir la
    -- verdad en vez de suponer.
    select status into raced_status from public.friendships
     where user_low = low and user_high = high;

    if raced_status = 'accepted' then
      return jsonb_build_object('ok', false, 'reason', 'already_friends');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end if;

  return jsonb_build_object(
    'ok', true,
    'accepted', raced_status = 'accepted',
    'target', public.friend_profile_min_json(target)
  );
end $$;

/** Aceptar una solicitud RECIBIDA (la que envió el otro). */
create or replace function public.friend_request_accept(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  updated int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.friendships
  set status = 'accepted', responded_at = now_ms, updated_at = now_ms
  where user_low = least(uid, p_other)
    and user_high = greatest(uid, p_other)
    and status = 'pending'
    and requested_by = p_other;   -- solo se acepta lo que el OTRO envió

  get diagnostics updated = row_count;
  if updated = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_pending');
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Rechazar una solicitud recibida. Rechazar no deja rastro. */
create or replace function public.friend_request_decline(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  removed int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.friendships
  where user_low = least(uid, p_other)
    and user_high = greatest(uid, p_other)
    and status = 'pending'
    and requested_by = p_other;

  get diagnostics removed = row_count;
  return jsonb_build_object('ok', removed > 0, 'removed', removed);
end $$;

/** Cancelar una solicitud propia aún sin responder. */
create or replace function public.friend_request_cancel(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  removed int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.friendships
  where user_low = least(uid, p_other)
    and user_high = greatest(uid, p_other)
    and status = 'pending'
    and requested_by = uid;

  get diagnostics removed = row_count;
  return jsonb_build_object('ok', removed > 0, 'removed', removed);
end $$;

-- ── Gestión ───────────────────────────────────────────────────────────────

/**
 * Eliminar a un amigo. Silencioso a propósito (D6): el otro simplemente deja de
 * verte. La fila es la misma para los dos (par canónico), así que la amistad
 * desaparece de verdad en los dos sentidos, sin media fila huérfana.
 */
create or replace function public.friend_remove(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  removed int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.friendships
  where user_low = least(uid, p_other)
    and user_high = greatest(uid, p_other)
    and status = 'accepted';

  get diagnostics removed = row_count;
  return jsonb_build_object('ok', removed > 0, 'removed', removed);
end $$;

/**
 * Bloquear: inserta el bloqueo y revoca CUALQUIER vínculo del par (amistad o
 * solicitud, en cualquier estado) en la misma transacción. Sin esa revocación
 * el bloqueo dejaría una amistad viva que `are_friends` ya niega, pero que
 * seguiría apareciendo en listas y correos de estado.
 */
create or replace function public.friend_block(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_other is null or p_other = uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- Un uuid que no es de nadie responde como cualquier otro "no existe" de la
  -- fase. Antes, el INSERT chocaba con la FK y lanzaba: un 500 que además
  -- delataba la existencia del uuid por el tipo de error.
  if not exists (select 1 from public.profiles where user_id = p_other) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  insert into public.friend_blocks (blocker, blocked, created_at)
  values (uid, p_other, now_ms)
  on conflict (blocker, blocked) do nothing;

  delete from public.friendships
  where user_low = least(uid, p_other)
    and user_high = greatest(uid, p_other);

  return jsonb_build_object('ok', true);
end $$;

/**
 * Desbloquear. NO restaura la amistad (D3): el bloqueo es una puerta de un solo
 * sentido, y volver a ser amigos exige una solicitud nueva.
 */
create or replace function public.friend_unblock(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  removed int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.friend_blocks
  where blocker = uid and blocked = p_other;

  get diagnostics removed = row_count;
  return jsonb_build_object('ok', removed > 0, 'removed', removed);
end $$;

-- ── Visibilidad ───────────────────────────────────────────────────────────

create or replace function public.privacy_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.profile_visibility%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v from public.profile_visibility where user_id = uid;
  return jsonb_build_object(
    -- Sin fila ⇒ defaults de producto: identidad sí, armario y stats no.
    'share_profile', coalesce(v.share_profile, true),
    'share_stats', coalesce(v.share_stats, false),
    'share_locker', coalesce(v.share_locker, false),
    'allow_requests', coalesce(v.allow_requests, true)
  );
end $$;

create or replace function public.privacy_set(
  p_share_profile boolean,
  p_share_stats boolean,
  p_share_locker boolean,
  p_allow_requests boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.profile_visibility
    (user_id, share_profile, share_stats, share_locker, allow_requests, updated_at)
  values
    (uid, coalesce(p_share_profile, true), coalesce(p_share_stats, false),
     coalesce(p_share_locker, false), coalesce(p_allow_requests, true), now_ms)
  on conflict (user_id) do update set
    share_profile = excluded.share_profile,
    share_stats = excluded.share_stats,
    share_locker = excluded.share_locker,
    allow_requests = excluded.allow_requests,
    updated_at = excluded.updated_at;

  return public.privacy_get();
end $$;

-- ── Proyecciones ──────────────────────────────────────────────────────────

/**
 * Quién hay a cada lado, con su estado. Todo en una llamada (badge incluido).
 *
 * Cada cubo lleva la proyección que le corresponde, y no la misma para todos:
 * un amigo ve el perfil si su dueño lo comparte; una solicitud pendiente o un
 * bloqueo ven solo la identidad mínima. `share_profile` sale del `jsonb` en el
 * mismo sitio en el que se decide, así que no hay forma de colar el perfil
 * extendido por descuido.
 */
create or replace function public.friend_list()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  with pairs as (
    select
      f.status,
      f.requested_by,
      f.message,
      f.created_at,
      case when f.user_low = uid then f.user_high else f.user_low end as other
    from public.friendships f
    where (f.user_low = uid or f.user_high = uid)
      and not exists (
        select 1 from public.friend_blocks b
        where (b.blocker = uid and b.blocked = case when f.user_low = uid then f.user_high else f.user_low end)
           or (b.blocked = uid and b.blocker = case when f.user_low = uid then f.user_high else f.user_low end)
      )
  ),
  shaped as (
    select
      p.status,
      p.requested_by = uid as outgoing,
      p.message,
      p.created_at,
      -- Amigos: perfil extendido si lo comparte, identidad mínima si lo cerró.
      public.friend_visible_profile_json(p.other) as profile,
      -- Pendientes: SIEMPRE identidad mínima. Una solicitud no da derecho al
      -- perfil (ni a la foto de avatar en base64) de quien todavía no te ha
      -- aceptado, y menos si tiene `share_profile` apagado.
      public.friend_profile_min_json(p.other) as min_profile,
      -- Ámbitos compartidos: se muestran como distintivos en la tarjeta, sin
      -- necesidad de traer ni un dato más.
      coalesce((select v.share_stats from public.profile_visibility v where v.user_id = p.other), false) as shares_stats,
      coalesce((select v.share_locker from public.profile_visibility v where v.user_id = p.other), false) as shares_locker
    from pairs p
  )
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile', s.profile,
        'shares', jsonb_build_object('stats', s.shares_stats, 'locker', s.shares_locker)
      ) order by s.profile ->> 'display_name')
      from shaped s where s.status = 'accepted'
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile', s.min_profile, 'message', s.message, 'created_at', s.created_at
      ) order by s.created_at desc)
      from shaped s where s.status = 'pending' and s.outgoing = false
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile', s.min_profile, 'message', s.message, 'created_at', s.created_at
      ) order by s.created_at desc)
      from shaped s where s.status = 'pending' and s.outgoing = true
    ), '[]'::jsonb),
    'blocked', coalesce((
      -- Bloquear es una defensa, no una puerta trasera al perfil: la lista de
      -- bloqueados proyecta la MISMA identidad mínima que una solicitud. Antes
      -- devolvía el perfil extendido, así que `friend_block` + `friend_list`
      -- era un lector de perfiles para cualquier `user_id` conocido.
      select jsonb_agg(public.friend_profile_min_json(b.blocked) order by b.created_at desc)
      from public.friend_blocks b where b.blocker = uid
    ), '[]'::jsonb)
  ) into result;

  return jsonb_build_object(
    'ok', true,
    'list', result,
    'counts', jsonb_build_object(
      'friends', jsonb_array_length(result -> 'friends'),
      'incoming', jsonb_array_length(result -> 'incoming')
    )
  );
end $$;

/** El perfil de un amigo (o el propio, que siempre es visible). */
create or replace function public.friend_profile(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.profile_visibility%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_other <> uid and not public.are_friends(uid, p_other) then
    return jsonb_build_object('ok', false, 'reason', 'not_friends');
  end if;

  select * into v from public.profile_visibility where user_id = p_other;
  if p_other <> uid and not coalesce(v.share_profile, true) then
    return jsonb_build_object('ok', false, 'reason', 'not_shared');
  end if;

  return jsonb_build_object(
    'ok', true,
    'profile', public.friend_profile_json(p_other),
    'visibility', jsonb_build_object(
      'stats', coalesce(v.share_stats, false),
      'locker', coalesce(v.share_locker, false)
    )
  );
end $$;

/**
 * El escaparate: el armario de un amigo, en modo lectura.
 *
 * Lista blanca, no filtro posterior: `serial`, `smart_id`, `price_amount`,
 * `price_currency`, `notes` y `links` **no se leen**. Los ítems demo quedan
 * fuera (un armario sembrado no es un armario real).
 *
 * Paginado por keyset sobre `(category_id, id)` — el orden del índice que la
 * Fase 6 dejó creado — para que una colección de cientos de ítems no llegue en
 * una sola respuesta. La taxonomía (categorías y tipos) es pequeña y viene
 * siempre, para que el cliente pueda pintar el árbol en la primera página.
 */
create or replace function public.friend_locker(
  p_other uuid,
  p_after_category text default null,
  p_after_id text default null,
  p_limit int default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.profile_visibility%rowtype;
  lim int := least(greatest(coalesce(p_limit, 60), 1), 100);
  items jsonb;
  next_category text;
  next_id text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_other <> uid and not public.are_friends(uid, p_other) then
    return jsonb_build_object('ok', false, 'reason', 'not_friends');
  end if;

  select * into v from public.profile_visibility where user_id = p_other;
  if p_other <> uid and not coalesce(v.share_locker, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_shared');
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id,
      'category_id', g.category_id,
      'type_id', g.type_id,
      'name', g.name,
      'brand', g.brand,
      'model', g.model,
      'finish', g.finish,
      'palette', public.jsonb_or_empty(g.palette),
      'status', g.status,
      'condition', g.condition,
      'tags', public.jsonb_or_empty(g.tags),
      'photos', public.jsonb_or_empty(g.photos),
      'is_primary', g.is_primary,
      'is_favorite', g.is_favorite,
      'rating', g.rating,
      'quantity', g.quantity,
      'acquired_at', g.acquired_at
    ) order by g.category_id, g.id), '[]'::jsonb)
  into items
  from (
    select g.*
    from public.gear_items g
    where g.user_id = p_other
      and g.is_demo = 0
      and (
        p_after_id is null
        or (g.category_id, g.id) > (coalesce(p_after_category, ''), p_after_id)
      )
    order by g.category_id, g.id
    limit lim
  ) g;

  if jsonb_array_length(items) = lim then
    next_category := items -> -1 ->> 'category_id';
    next_id := items -> -1 ->> 'id';
  end if;

  return jsonb_build_object(
    'ok', true,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'kind', c.kind, 'icon', c.icon, 'accent', c.accent
      ) order by c.id)
      from public.gear_categories c
      where c.user_id = p_other and c.is_demo = 0
    ), '[]'::jsonb),
    'types', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'category_id', t.category_id, 'name', t.name,
        'puzzle_category', t.puzzle_category
      ) order by t.id)
      from public.gear_types t
      where t.user_id = p_other and t.is_demo = 0
    ), '[]'::jsonb),
    'items', items,
    'next', case
      when next_id is null then null
      else jsonb_build_object('category_id', next_category, 'id', next_id)
    end
  );
end $$;

/**
 * Estadísticas agregadas de un amigo.
 *
 * NUNCA devuelve solves. No hay ningún campo con filas de `solves` en esta
 * respuesta: lo que viaja son cuentas (best, worst, media, Ao5, Ao12, tiempo
 * total, racha y un mapa de calor de conteos diarios). Scrambles, notas, movimientos,
 * análisis, ids de solve y sesiones no se leen siquiera.
 *
 * Fórmulas copiadas del motor del cliente (`@cubeforge/statistics`):
 *   · efectivo = time_ms + 2000 si el penalizador es +2; DNF no cuenta.
 *   · Ao5/Ao12 = media recortada de las N MÁS RECIENTES, quitando la mejor y la
 *     peor (trim = ceil(N/20) = 1 para 5 y 12). Más de `trim` DNFs ⇒ media DNF.
 *   · El conjunto es el de las solves de SESIONES no-demo (que es lo que suma el
 *     cliente), no el de solves con `is_demo = 0`: son filtros distintos y la
 *     diferencia es deliberada, no un descuido.
 *
 * Codificación en el cable: las medias que pueden ser DNF van como `{ms: n}`,
 * `{dnf: true}` o `null` (datos insuficientes) — explícito, en vez de depender
 * de Infinity, que JSONB ni siquiera puede representar como número.
 */
create or replace function public.friend_stats(
  p_other uuid,
  p_window_days int default 365
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.profile_visibility%rowtype;
  by_puzzle jsonb;
  overall jsonb;
  heatmap jsonb;
  streak int := 0;
  last_active bigint;
  days int := least(greatest(coalesce(p_window_days, 365), 1), 365);
  rec record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_other <> uid and not public.are_friends(uid, p_other) then
    return jsonb_build_object('ok', false, 'reason', 'not_friends');
  end if;

  select * into v from public.profile_visibility where user_id = p_other;
  if p_other <> uid and not coalesce(v.share_stats, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_shared');
  end if;

  -- ── Por rompecabezas ────────────────────────────────────────────────────
  with base as (
    select
      sv.puzzle_type as puzzle,
      case
        when upper(btrim(coalesce(sv.penalty, ''))) = 'DNF' then null
        when upper(btrim(coalesce(sv.penalty, ''))) in ('+2', 'PLUS2', 'PLUS_TWO')
          then sv.time_ms + 2000
        else sv.time_ms
      end as eff,
      sv.timestamp
    from public.solves sv
    join public.sessions s
      on s.user_id = sv.user_id and s.id = sv.session_id and s.is_demo = 0
    where sv.user_id = p_other
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'puzzle', b.puzzle,
      'total', b.total,
      'count', b.count,
      'best', b.best,
      'worst', b.worst,
      'mean', b.mean,
      'session_time', b.session_time,
      'best_at', b.best_at,
      'ao5', public.puzzle_average(p_other, b.puzzle, 5),
      'ao12', public.puzzle_average(p_other, b.puzzle, 12)
    ) order by b.total desc), '[]'::jsonb)
  into by_puzzle
  from (
    select
      puzzle,
      count(*) as total,
      count(eff) as count,
      min(eff) as best,
      max(eff) as worst,
      avg(eff) as mean,
      coalesce(sum(eff), 0) as session_time,
      (array_agg(timestamp order by eff asc))[1] as best_at
    from base
    group by puzzle
  ) b;

  -- ── Global ──────────────────────────────────────────────────────────────
  with base as (
    select
      case
        when upper(btrim(coalesce(sv.penalty, ''))) = 'DNF' then null
        when upper(btrim(coalesce(sv.penalty, ''))) in ('+2', 'PLUS2', 'PLUS_TWO')
          then sv.time_ms + 2000
        else sv.time_ms
      end as eff,
      sv.timestamp
    from public.solves sv
    join public.sessions s
      on s.user_id = sv.user_id and s.id = sv.session_id and s.is_demo = 0
    where sv.user_id = p_other
  )
  select jsonb_build_object(
    'total', count(*),
    'count', count(eff),
    'best', min(eff),
    'worst', max(eff),
    'mean', avg(eff),
    'session_time', coalesce(sum(eff), 0),
    'last_active_at', max(timestamp)
  )
  into overall
  from base;

  last_active := (overall ->> 'last_active_at')::bigint;

  -- ── Mapa de calor: conteos diarios (UTC), del más antiguo al más reciente ─
  -- El cliente agrupa por fecha UTC (`toISOString().slice(0,10)`), así que aquí
  -- se hace igual; el conteo incluye DNF (es actividad, no rendimiento).
  with daily as (
    select (to_timestamp(sv.timestamp / 1000.0) at time zone 'utc')::date as d,
           count(*) as c
    from public.solves sv
    join public.sessions s
      on s.user_id = sv.user_id and s.id = sv.session_id and s.is_demo = 0
    where sv.user_id = p_other
      and sv.timestamp >= (extract(epoch from now()) - (days + 1) * 86400) * 1000
    group by 1
  ),
  series as (
    select generate_series(days - 1, 0, -1) as off
  )
  select jsonb_agg(coalesce((
    select d.c from daily d
    where d.d = (now() at time zone 'utc')::date - series.off
  ), 0) order by series.off desc)
  into heatmap
  from series;

  -- ── Racha: días consecutivos con actividad, hoy o ayer ──────────────────
  -- Misma regla que `computeStreak`: un día sin resolver solo rompe la racha
  -- cuando ya ha pasado entero (si hoy aún no hay nada, se cuenta desde ayer).
  for rec in
    with daily as (
      select (to_timestamp(sv.timestamp / 1000.0) at time zone 'utc')::date as d
      from public.solves sv
      join public.sessions s
        on s.user_id = sv.user_id and s.id = sv.session_id and s.is_demo = 0
      where sv.user_id = p_other
        and sv.timestamp >= (extract(epoch from now()) - 400 * 86400) * 1000
      group by 1
    )
    select gs as off,
           exists (
             select 1 from daily
             where daily.d = (now() at time zone 'utc')::date - gs
           ) as active
    from generate_series(0, 399) as gs
    order by gs
  loop
    if rec.active then
      streak := streak + 1;
    elsif rec.off = 0 then
      continue;   -- hoy todavía sin actividad: no rompe la racha
    else
      exit;
    end if;
  end loop;

  -- Sin `owner`: la identidad ya viaja en `friend_list`/`friend_profile`, y
  -- repetir aquí el perfil extendido era una segunda puerta sin puerta —
  -- `friend_stats` exige `share_stats`, no `share_profile`, así que un amigo
  -- con el perfil cerrado lo recibía igual por esta vía.
  return jsonb_build_object(
    'ok', true,
    'overall', overall,
    'by_puzzle', by_puzzle,
    'streak_days', streak,
    'heatmap', coalesce(heatmap, '[]'::jsonb)
  );
end $$;

/**
 * Media recortada de las N solves más recientes de un rompecabezas.
 * Devuelve `null` (datos insuficientes), `{"dnf": true}` o `{"ms": n}`.
 */
create or replace function public.puzzle_average(
  p_user uuid,
  p_puzzle text,
  p_n int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  trim_n int := ceil(p_n::numeric / 20)::int;   -- 1 para Ao5 y Ao12
  window_size int;
  dnf_count int;
  avg_eff double precision;
begin
  select count(*), count(*) filter (where eff is null)
  into window_size, dnf_count
  from (
    select case
        when upper(btrim(coalesce(sv.penalty, ''))) = 'DNF' then null
        when upper(btrim(coalesce(sv.penalty, ''))) in ('+2', 'PLUS2', 'PLUS_TWO')
          then sv.time_ms + 2000
        else sv.time_ms
      end as eff
    from public.solves sv
    join public.sessions s
      on s.user_id = sv.user_id and s.id = sv.session_id and s.is_demo = 0
    where sv.user_id = p_user
      and sv.puzzle_type = p_puzzle
    order by sv.timestamp desc, sv.id desc
    limit p_n
  ) w;

  if window_size < p_n then
    return null;
  end if;
  if dnf_count > trim_n then
    return jsonb_build_object('dnf', true);
  end if;

  -- El recorte tiene que ocurrir DENTRO de una subconsulta con su propio
  -- ORDER BY: un `order by eff` en la misma consulta que el `avg(eff)` es una
  -- columna sin agregar y Postgres lo rechaza (42803). El orden ascendente con
  -- los nulos al final coloca los DNF como peores, que es como los trata
  -- `effectiveTime` (Infinity) y por tanto el recorte los descarta igual.
  select avg(eff) into avg_eff
  from (
    select eff
    from (
      select case
          when upper(btrim(coalesce(sv.penalty, ''))) = 'DNF' then null
          when upper(btrim(coalesce(sv.penalty, ''))) in ('+2', 'PLUS2', 'PLUS_TWO')
            then sv.time_ms + 2000
          else sv.time_ms
        end as eff
      from public.solves sv
      join public.sessions s
        on s.user_id = sv.user_id and s.id = sv.session_id and s.is_demo = 0
      where sv.user_id = p_user
        and sv.puzzle_type = p_puzzle
      order by sv.timestamp desc, sv.id desc
      limit p_n
    ) w
    where eff is not null
    order by eff asc
    offset trim_n
    limit p_n - 2 * trim_n
  ) trimmed;

  if avg_eff is null then
    return jsonb_build_object('dnf', true);
  end if;
  return jsonb_build_object('ms', round(avg_eff));
end $$;

revoke all on function public.puzzle_average(uuid, text, int) from public, anon, authenticated;

-- ── Permisos de la superficie pública ─────────────────────────────────────
-- Un único sitio donde auditar todo lo que alcanza `authenticated`. Cada
-- entrada tiene su `revoke` (PUBLIC trae EXECUTE por defecto) y su `grant`.
revoke all on function public.handle_claim(text) from public, anon;
revoke all on function public.friend_request_send(text, text) from public, anon;
revoke all on function public.friend_request_accept(uuid) from public, anon;
revoke all on function public.friend_request_decline(uuid) from public, anon;
revoke all on function public.friend_request_cancel(uuid) from public, anon;
revoke all on function public.friend_remove(uuid) from public, anon;
revoke all on function public.friend_block(uuid) from public, anon;
revoke all on function public.friend_unblock(uuid) from public, anon;
revoke all on function public.privacy_get() from public, anon;
revoke all on function public.privacy_set(boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.friend_list() from public, anon;
revoke all on function public.friend_profile(uuid) from public, anon;
revoke all on function public.friend_locker(uuid, text, text, int) from public, anon;
revoke all on function public.friend_stats(uuid, int) from public, anon;

grant execute on function public.handle_claim(text) to authenticated;
grant execute on function public.friend_request_send(text, text) to authenticated;
grant execute on function public.friend_request_accept(uuid) to authenticated;
grant execute on function public.friend_request_decline(uuid) to authenticated;
grant execute on function public.friend_request_cancel(uuid) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friend_block(uuid) to authenticated;
grant execute on function public.friend_unblock(uuid) to authenticated;
grant execute on function public.privacy_get() to authenticated;
grant execute on function public.privacy_set(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.friend_list() to authenticated;
grant execute on function public.friend_profile(uuid) to authenticated;
grant execute on function public.friend_locker(uuid, text, text, int) to authenticated;
grant execute on function public.friend_stats(uuid, int) to authenticated;

notify pgrst, 'reload schema';
