-- Cuerpo del test F8.0. El comando bash lo envuelve:
--   begin;  <migración 16>  <este fichero>  rollback;
-- así que aquí no hay BEGIN/ROLLBACK y todo se revierte.
--
-- Solo se usan las dos cuentas reales (profiles.user_id tiene FK a auth.users,
-- así que no se pueden inventar filas). Los ids viajan en ajustes locales para
-- poder leerlos también con el rol `authenticated`.
--
-- Orden deliberado: primero las reglas (necesitan un handle no vacío), después
-- handle_claim y sync_apply, y al final la prueba del índice con el trigger
-- desactivado — porque las reglas tapan a propósito el unique_violation, así
-- que el índice solo se puede ver de verdad con el trigger fuera.

select set_config('test.uid_a', (
  select user_id::text from public.profiles order by user_id limit 1
), true);

select set_config('test.uid_b', (
  select user_id::text from public.profiles
  where user_id <> (select user_id from public.profiles order by user_id limit 1)
  order by user_id limit 1
), true);

do $$
begin
  if current_setting('test.uid_a', true) is null
     or current_setting('test.uid_b', true) is null then
    raise exception 'FALTA: hacen falta dos cuentas reales';
  end if;
end $$;

-- ── (1) normalize_handle ──────────────────────────────────────────────────
do $$
begin
  if public.normalize_handle('  @Dorito ') <> 'dorito' then raise exception 'FAIL norm: espacios/@'; end if;
  if public.normalize_handle('Dorito') <> 'dorito'      then raise exception 'FAIL norm: mayusculas'; end if;
  if public.normalize_handle('ab')      is not null     then raise exception 'FAIL norm: demasiado corto'; end if;
  if public.normalize_handle('a-na')    is not null     then raise exception 'FAIL norm: guion (no debe recortarse)'; end if;
  if public.normalize_handle('dórito')  is not null     then raise exception 'FAIL norm: acentos'; end if;
  if public.normalize_handle('admin')   is not null     then raise exception 'FAIL norm: reservado'; end if;
  if public.normalize_handle(repeat('a',21)) is not null then raise exception 'FAIL norm: demasiado largo'; end if;
  if public.normalize_handle('a b')     is not null     then raise exception 'FAIL norm: espacio interno'; end if;
  if public.normalize_handle(null)      is not null     then raise exception 'FAIL norm: null'; end if;
  if public.normalize_handle('cuber_01') <> 'cuber_01'  then raise exception 'FAIL norm: valido rechazado'; end if;
end $$;

-- ── (2) Reglas del trigger sobre las filas reales ─────────────────────────
do $$
declare a uuid := current_setting('test.uid_a')::uuid;
        b uuid := current_setting('test.uid_b')::uuid;
begin
  -- Punto de partida: dos handles libres y distintos.
  update public.profiles set handle = 'f8_a' where user_id = a;
  update public.profiles set handle = 'f8_b' where user_id = b;
  if (select handle from public.profiles where user_id = a) <> 'f8_a' then
    raise exception 'FAIL setup: no se pudo fijar el handle de A';
  end if;
  if (select handle from public.profiles where user_id = b) <> 'f8_b' then
    raise exception 'FAIL setup: no se pudo fijar el handle de B';
  end if;

  -- Regla A — un push sin handle (dispositivo nuevo) no borra el almacenado.
  update public.profiles set handle = '' where user_id = a;
  if (select handle from public.profiles where user_id = a) <> 'f8_a' then
    raise exception 'FAIL regla A: un push vacio borro el handle';
  end if;

  -- Regla B — nunca robar el handle de otra cuenta.
  update public.profiles set handle = 'f8_a' where user_id = b;
  if (select handle from public.profiles where user_id = b) <> 'f8_b' then
    raise exception 'FAIL regla B: se pudo robar el handle de otra cuenta';
  end if;
  if (select handle from public.profiles where user_id = a) <> 'f8_a' then
    raise exception 'FAIL regla B: el titular perdio su handle';
  end if;

  -- Y tampoco por mayúsculas.
  update public.profiles set handle = 'F8_A' where user_id = b;
  if (select handle from public.profiles where user_id = b) <> 'f8_b' then
    raise exception 'FAIL regla B: mayusculas esquivaron la proteccion';
  end if;
end $$;

-- ── (3) Rama INSERT: fila que aún no existía con un handle ajeno ──────────
do $$
declare a uuid := current_setting('test.uid_a')::uuid;
        b uuid := current_setting('test.uid_b')::uuid;
begin
  delete from public.profiles where user_id = b;
  insert into public.profiles (user_id, handle, created_at, updated_at)
  values (b, 'f8_a', 1, 1);
  if (select handle from public.profiles where user_id = b) <> '' then
    raise exception 'FAIL insert: una fila nueva se quedo el handle de otro';
  end if;

  -- Y sin conflicto, el handle sí entra.
  update public.profiles set handle = 'f8_b' where user_id = b;
  if (select handle from public.profiles where user_id = b) <> 'f8_b' then
    raise exception 'FAIL insert: un handle libre no se aplico';
  end if;
  if (select handle from public.profiles where user_id = a) <> 'f8_a' then
    raise exception 'FAIL insert: A perdio su handle';
  end if;
end $$;

-- ── (4) handle_claim como `authenticated` (el camino real del cliente) ────
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);

do $$
declare res jsonb;
begin
  res := public.handle_claim('  @F8_Claim_9x ');
  if (res ->> 'ok')::boolean is not true then
    raise exception 'FAIL claim libre: %', res;
  end if;
  if res ->> 'handle' <> 'f8_claim_9x' then
    raise exception 'FAIL claim formato: %', res;
  end if;
  if coalesce((res ->> 'updated_at')::bigint, 0) <= 0 then
    raise exception 'FAIL claim sello: %', res;
  end if;

  res := public.handle_claim('f8_claim_9x');
  if (res ->> 'ok')::boolean is not true or (res ->> 'unchanged')::boolean is not true then
    raise exception 'FAIL claim idempotente: %', res;
  end if;

  res := public.handle_claim('ab');
  if res ->> 'reason' <> 'invalid' then
    raise exception 'FAIL claim invalido: %', res;
  end if;

  res := public.handle_claim('admin');
  if res ->> 'reason' <> 'invalid' then
    raise exception 'FAIL claim reservado: %', res;
  end if;
end $$;

-- Tomado: lo pide la OTRA cuenta.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);

do $$
declare res jsonb;
begin
  res := public.handle_claim('f8_claim_9x');
  if res ->> 'reason' <> 'taken' then
    raise exception 'FAIL claim tomado: %', res;
  end if;
  if coalesce(res ->> 'suggestion', '') = '' then
    raise exception 'FAIL claim tomado: sin sugerencia %', res;
  end if;
end $$;

-- Sin sesión no se puede reclamar.
select set_config('request.jwt.claims', '', true);
do $$
begin
  begin
    perform public.handle_claim('f8_nobody');
    raise exception 'FAIL claim sin sesion: no excepciono';
  exception when others then
    if sqlerrm not like '%not authenticated%' then raise; end if;
  end;
end $$;

-- ── (5) sync_apply no puede borrar el handle reclamado ────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);

do $$
declare a text := current_setting('test.uid_a');
begin
  perform public.sync_apply(jsonb_build_object(
    'profiles', jsonb_build_array(jsonb_build_object(
      'user_id', a,
      'display_name', 'Push Test',
      'handle', '',
      'updated_at', (extract(epoch from now()) * 1000)::bigint + 1000
    ))
  ));
end $$;

reset role;

do $$
declare a uuid := current_setting('test.uid_a')::uuid;
begin
  if (select handle from public.profiles where user_id = a) <> 'f8_claim_9x' then
    raise exception 'FAIL sync_apply: el push vacio borro el handle';
  end if;
  if (select display_name from public.profiles where user_id = a) <> 'Push Test' then
    raise exception 'FAIL sync_apply: el resto del perfil no se aplico';
  end if;
end $$;

-- ── (6) El índice único: estructural y de comportamiento ──────────────────
do $$
declare d text;
begin
  select indexdef into d from pg_indexes where indexname = 'uq_profiles_handle';
  if d is null then
    raise exception 'FAIL indice: uq_profiles_handle no existe';
  end if;
  if d not like '%UNIQUE%' then
    raise exception 'FAIL indice: no es unico → %', d;
  end if;
  if d not like '%WHERE%handle%' then
    raise exception 'FAIL indice: no es parcial → %', d;
  end if;
end $$;

do $$
declare a uuid := current_setting('test.uid_a')::uuid;
        b uuid := current_setting('test.uid_b')::uuid;
begin
  -- Sin el trigger (que a propósito tapa el conflicto) se ve el índice: el
  -- duplicado revienta.
  alter table public.profiles disable trigger profiles_protect_handle;

  begin
    update public.profiles set handle = 'f8_claim_9x' where user_id = b;
    raise exception 'FAIL indice: se acepto un handle duplicado sin el trigger';
  exception when unique_violation then
    null;
  end;

  -- Y se ve que es PARCIAL: dos filas sin handle conviven.
  update public.profiles set handle = '' where user_id in (a, b);
  if (select count(*) from public.profiles where user_id in (a, b) and handle = '') <> 2 then
    raise exception 'FAIL indice: el indice no es parcial (no conviven dos vacios)';
  end if;

  alter table public.profiles enable trigger profiles_protect_handle;
end $$;

select 'F8.0 — TODAS LAS ASERCIONES PASAN' as resultado;
