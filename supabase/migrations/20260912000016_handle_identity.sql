-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 8 · F8.0 — Identidad: unicidad del handle, reserva y protección del titular.
--
-- Prerrequisito de la fase social (auditoría 2026-09-12 · M1/P3). Sin unicidad,
-- en el estante de amigos el handle es suplantación trivial: te registras con el
-- handle de otro y sus amigos te añaden.
--
-- Tres decisiones no obvias, y por qué:
--
--   • El índice único es PARCIAL (`where handle <> ''`). `handle` tiene
--     DEFAULT '' y es lo que inserta el trigger de alta de `auth.users`, así que
--     toda fila que no haya reclamado un handle comparte el mismo valor vacío:
--     un índice total no se podría ni crear (y de hecho lo verifiqué: hay 2
--     perfiles, 1 con handle, 0 duplicados). Lo vacío significa "sin identidad
--     pública", no "un identificador compartido por todos".
--
--   • Sin CHECK de formato en la columna. Es la misma regla que en el esquema
--     del Locker: un CHECK que un cliente no conoce rechaza la fila y, como
--     `sync_apply` es atómico, atasca el sync del usuario hasta que actualice.
--     El formato se valida en `handle_claim` (la única vía de la UI) y se
--     documenta como residual aceptado: `sync_apply` solo garantiza UNICIDAD.
--
--   • La protección del titular es un TRIGGER, no una cirugía en `sync_apply`.
--     El plan de Fase 8 (§4.4) preveía reescribir el bloque de `profiles` para
--     capturar el `unique_violation` con un savepoint. Se descarta por dos
--     razones medidas, no estéticas:
--       1. Un trigger BEFORE que reescribe `NEW.handle` **no puede lanzar**, así
--          que no hay forma de atascar el lote — y protege a TODOS los
--          escritores (sync_apply, REST, service_role, código futuro), no solo
--          al RPC.
--       2. Reescribir 500 líneas de `sync_apply` para cambiar 15 duplicaría el
--          riesgo de una migración que hoy funciona: el diff sería enorme y el
--          beneficio, ninguno.
--     Las dos reglas que impone el trigger:
--       A. Nunca VACIAR: un handle vacío entrante no borra el almacenado. Sin
--          esta regla, instalar la app en un segundo dispositivo (perfil local
--          por defecto, sellado con `Date.now()`) PUBLICARÍA ese handle vacío
--          antes del primer pull — el motor empuja antes de tirar — y borraría
--          el handle de la nube. Es un bug real y previo a esta fase.
--       B. Nunca ROBAR: un handle entrante que ya pertenece a otra cuenta no se
--          aplica; se conserva el almacenado. El titular actual siempre gana,
--          sin excepción.
--
-- Efecto buscado: pase lo que pase, **un handle pertenece a un titular y solo
-- se libera desde `handle_claim`** (que es también la vía de reclamo). Y ningún
-- camino puede convertir un conflicto de identidad en un sync atascado.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Formato canónico ──────────────────────────────────────────────────────
-- Reservados: nombres que, si alguien los reclamara, permitirían hacerse pasar
-- por la app o por su soporte. La lista es deliberadamente pequeña y se amplía
-- con una línea.
create or replace function public.normalize_handle(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  c text;
  reserved text[] := array[
    'admin', 'administrator', 'support', 'cubeforge', 'system', 'root',
    'moderator', 'mod', 'official', 'staff', 'help', 'api', 'www', 'me',
    'null', 'undefined', 'deleted', 'anonymous', 'guest'
  ];
begin
  if p_raw is null then
    return null;
  end if;
  c := lower(btrim(p_raw));
  if left(c, 1) = '@' then
    c := substr(c, 2);
  end if;
  -- Rechaza, no recorta: "a-na" no debe convertirse en "ana" en silencio
  -- (el usuario vería un handle distinto del que escribió).
  if c !~ '^[a-z0-9_]{3,20}$' then
    return null;
  end if;
  if c = any (reserved) then
    return null;
  end if;
  return c;
end $$;

-- Sugerencia libre derivada del handle pedido. Solo se usa cuando ya está
-- tomado, así que intenta pocas veces y devuelve null si no encuentra hueco
-- (la UI puede volver a pedir uno al usuario).
create or replace function public.handle_suggestion(p_clean text)
returns text
language plpgsql
-- Sin `stable`: llama a `random()`, que es volátil. Marcarla estable haría que
-- el planificador cachease el resultado y dos intentos devolvieran la misma
-- sugerencia ocupada.
security definer
set search_path = public
as $$
declare
  base text := left(coalesce(p_clean, 'cuber'), 15);
  candidate text;
  i int;
begin
  for i in 1..5 loop
    candidate := base || '_' || lpad(to_hex((random() * 65535)::int), 4, '0');
    if not exists (
      select 1 from public.profiles where lower(handle) = candidate
    ) then
      return candidate;
    end if;
  end loop;
  return null;
end $$;

revoke all on function public.normalize_handle(text) from public, anon, authenticated;
revoke all on function public.handle_suggestion(text) from public, anon, authenticated;

-- ── Unicidad ──────────────────────────────────────────────────────────────
-- Proveedor de la verdad de "un handle, una cuenta". `lower()` porque la
-- identidad pública no distingue mayúsculas (el formato canónico ya es
-- minúsculas; esto cubre a un escritor que no pase por `handle_claim`).
create unique index if not exists uq_profiles_handle
  on public.profiles (lower(handle))
  where handle <> '';

-- ── Protección del titular (reglas A y B) ─────────────────────────────────
create or replace function public.profiles_protect_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming text := coalesce(new.handle, '');
begin
  -- Alta de una fila que aún no existía (el INSERT de un `on conflict … do
  -- update` cuyo destino no estaba). No hay titular previo que conservar, así
  -- que un handle ya tomado se queda vacío: "sin identidad pública" es un
  -- estado válido, y esto evita el `unique_violation` que abortaría el lote.
  if tg_op = 'INSERT' then
    if incoming <> '' and exists (
      select 1 from public.profiles p
      where p.user_id <> new.user_id and lower(p.handle) = lower(incoming)
    ) then
      new.handle := '';
    end if;
    return new;
  end if;

  -- Regla A — nunca vaciar un handle existente.
  if incoming = '' and coalesce(old.handle, '') <> '' then
    new.handle := old.handle;
    return new;
  end if;

  -- Nada que proteger: sin handle almacenado, o el mismo handle.
  if incoming = '' or incoming = coalesce(old.handle, '') then
    return new;
  end if;

  -- Regla B — nunca robar: si ese handle ya tiene otro titular, se conserva
  -- el actual. La comprobación es una búsqueda por índice sobre la parte no
  -- vacía del índice único.
  if exists (
    select 1 from public.profiles p
    where p.user_id <> new.user_id and lower(p.handle) = lower(incoming)
  ) then
    new.handle := old.handle;
  end if;

  return new;
end $$;

-- Un BEFORE que reescribe NEW nunca lanza, así que un conflicto de identidad
-- no puede reventar el lote de `sync_apply` (ni ninguna otra escritura). Los
-- dos caminos del `on conflict … do update` están cubiertos: el UPDATE del
-- conflicto y el INSERT de la fila que aún no existía.
drop trigger if exists profiles_protect_handle on public.profiles;
create trigger profiles_protect_handle
  before insert or update on public.profiles
  for each row execute procedure public.profiles_protect_handle();

revoke all on function public.profiles_protect_handle() from public, anon, authenticated;

-- ── Reserva ───────────────────────────────────────────────────────────────
-- Única vía de la UI para fijar un handle: comprueba y escribe en la MISMA
-- transacción (sin "check-then-set"), y devuelve el sello de servidor que el
-- cliente debe adoptar localmente para que el pull no lo traiga de vuelta.
--
-- El error `taken` revela que un handle existe — es inherente a "añadir por
-- handle" (residual aceptado y documentado en el plan, §6.4). Lo que sí se
-- evita: prefijos, listas y adivinación masiva (formato exacto + rate limit en
-- la capa de amigos).
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

revoke all on function public.handle_claim(text) from public, anon;
grant execute on function public.handle_claim(text) to authenticated;

notify pgrst, 'reload schema';
