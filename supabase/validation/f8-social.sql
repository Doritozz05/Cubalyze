-- Fase 8 — suite A: superficie, identidad, solicitudes, gestión y ritmo.
-- El comando bash lo envuelve: begin; <16><17><18> <este fichero> rollback;

select set_config('test.uid_a', (
  select user_id::text from public.profiles order by user_id limit 1
), true);
select set_config('test.uid_b', (
  select user_id::text from public.profiles
  where user_id <> (select user_id from public.profiles order by user_id limit 1)
  order by user_id limit 1
), true);

-- Las cuentas son REALES (la FK a `auth.users` lo exige) y alguien probando la
-- UI puede haberles dejado rastro: una fila de `profile_visibility` con stats
-- compartidos hacía fallar la sección (6) aunque el código estuviera bien, y
-- una amistad o un bloqueo harían fallar la (5). Se borra el residuo de AMBAS
-- cuentas al empezar; todo va dentro del `rollback` del corredor, no se pierde
-- nada.
delete from public.friendships
 where user_low in (current_setting('test.uid_a')::uuid, current_setting('test.uid_b')::uuid)
    or user_high in (current_setting('test.uid_a')::uuid, current_setting('test.uid_b')::uuid);
delete from public.friend_blocks
 where blocker in (current_setting('test.uid_a')::uuid, current_setting('test.uid_b')::uuid)
    or blocked in (current_setting('test.uid_a')::uuid, current_setting('test.uid_b')::uuid);
delete from public.profile_visibility
 where user_id in (current_setting('test.uid_a')::uuid, current_setting('test.uid_b')::uuid);

-- ═══ (1) La superficie: qué alcanza `authenticated` y qué no ═════════════
do $$
declare t text;
begin
  foreach t in array array['friendships', 'friend_blocks', 'profile_visibility', 'friend_rate_limits']
  loop
    if has_table_privilege('authenticated', 'public.' || t, 'select')
       or has_table_privilege('anon', 'public.' || t, 'select') then
      raise exception 'FAIL grants: % es legible por los roles de API', t;
    end if;
  end loop;

  if has_function_privilege('authenticated', 'public.are_friends(uuid,uuid)', 'execute') then
    raise exception 'FAIL grants: are_friends es un oraculo publico';
  end if;
  if has_function_privilege('authenticated', 'public.friend_profile_json(uuid)', 'execute') then
    raise exception 'FAIL grants: friend_profile_json es publica';
  end if;
  if has_function_privilege('authenticated', 'public.normalize_handle(text)', 'execute') then
    raise exception 'FAIL grants: normalize_handle es publica';
  end if;
  if has_function_privilege('authenticated', 'public.friend_rate_check(text,int,bigint)', 'execute') then
    raise exception 'FAIL grants: friend_rate_check es publica';
  end if;

  if not has_function_privilege('authenticated', 'public.friend_list()', 'execute') then
    raise exception 'FAIL grants: friend_list no es ejecutable';
  end if;
  if not has_function_privilege('authenticated', 'public.handle_claim(text)', 'execute') then
    raise exception 'FAIL grants: handle_claim no es ejecutable';
  end if;

  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname in ('friendships', 'friend_blocks', 'profile_visibility', 'friend_rate_limits')
      and c.contype = 'f' and c.confdeltype <> 'c'
  ) then
    raise exception 'FAIL fk: alguna FK social no es ON DELETE CASCADE';
  end if;
end $$;

-- ═══ (2) Identidad ═══════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare res jsonb;
begin
  res := public.handle_claim('f8_test_a');
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL handle A: %', res; end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);
do $$
declare res jsonb;
begin
  res := public.handle_claim('f8_test_b');
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL handle B: %', res; end if;
end $$;

-- ═══ (3) Puerta cerrada ══════════════════════════════════════════════════
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare b uuid := current_setting('test.uid_b')::uuid; res jsonb;
begin
  res := public.friend_profile(b);
  if res ->> 'reason' <> 'not_friends' then raise exception 'FAIL puerta perfil: %', res; end if;
  res := public.friend_locker(b);
  if res ->> 'reason' <> 'not_friends' then raise exception 'FAIL puerta armario: %', res; end if;
  res := public.friend_stats(b);
  if res ->> 'reason' <> 'not_friends' then raise exception 'FAIL puerta stats: %', res; end if;
  if (res::text like '%by_puzzle%') then raise exception 'FAIL puerta: fuga de estructura'; end if;
end $$;

-- ═══ (4) Privacidad por defecto ══════════════════════════════════════════
do $$
declare res jsonb;
begin
  res := public.privacy_get();
  if (res ->> 'share_profile')::boolean is not true then raise exception 'FAIL privacidad: perfil off'; end if;
  if (res ->> 'share_stats')::boolean is not false then raise exception 'FAIL privacidad: stats on'; end if;
  if (res ->> 'share_locker')::boolean is not false then raise exception 'FAIL privacidad: armario on'; end if;
  if (res ->> 'allow_requests')::boolean is not true then raise exception 'FAIL privacidad: solicitudes off'; end if;
end $$;

-- ═══ (5) Solicitud, listas y aceptación ══════════════════════════════════
do $$
declare res jsonb; own uuid;
begin
  res := public.friend_request_send('@F8_TEST_B');
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL solicitud: %', res; end if;
  if (res ->> 'accepted')::boolean is not false then raise exception 'FAIL solicitud: auto-acepto sin cruce'; end if;
  if (res -> 'target' ->> 'handle') <> 'f8_test_b' then raise exception 'FAIL solicitud: destino %', res; end if;

  res := public.friend_request_send('f8_test_b');
  if res ->> 'reason' <> 'pending' then raise exception 'FAIL solicitud repetida: %', res; end if;

  res := public.friend_request_send('f8_test_a');
  if res ->> 'reason' <> 'self' then raise exception 'FAIL solicitud self: %', res; end if;
  res := public.friend_request_send('nadie_existe_9999');
  if res ->> 'reason' <> 'not_found' then raise exception 'FAIL solicitud inexistente: %', res; end if;
  res := public.friend_request_send('ab');
  if res ->> 'reason' <> 'invalid' then raise exception 'FAIL solicitud invalida: %', res; end if;

  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'outgoing') <> 1 then
    raise exception 'FAIL lista A: salientes %', res -> 'list' -> 'outgoing';
  end if;
  if (res -> 'counts' ->> 'incoming')::int <> 0 then raise exception 'FAIL lista A: entrantes'; end if;

  -- Quien ENVÍA no puede aceptar: solo se acepta lo que el otro envió.
  own := (res -> 'list' -> 'outgoing' -> 0 -> 'profile' ->> 'user_id')::uuid;
  res := public.friend_request_accept(own);
  if (res ->> 'ok')::boolean is not false then
    raise exception 'FAIL aceptar lo propio: %', res;
  end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);
do $$
declare a uuid := current_setting('test.uid_a')::uuid; res jsonb;
begin
  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'incoming') <> 1 then
    raise exception 'FAIL lista B: entrantes %', res -> 'list' -> 'incoming';
  end if;
  if (res -> 'counts' ->> 'incoming')::int <> 1 then raise exception 'FAIL badge B'; end if;
  if (res -> 'list' -> 'incoming' -> 0 -> 'profile' ->> 'handle') <> 'f8_test_a' then
    raise exception 'FAIL solicitud entrante: sin perfil';
  end if;

  res := public.friend_request_accept(a);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL aceptar: %', res; end if;

  res := public.friend_request_accept(a);
  if (res ->> 'ok')::boolean is not false then raise exception 'FAIL aceptar dos veces: %', res; end if;

  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'friends') <> 1 then raise exception 'FAIL amistad no creada'; end if;
  if (res -> 'counts' ->> 'friends')::int <> 1 then raise exception 'FAIL contador de amigos'; end if;
end $$;

-- ═══ (6) Amigos: perfil sí, stats y armario no ═══════════════════════════
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare b uuid := current_setting('test.uid_b')::uuid; res jsonb;
begin
  res := public.friend_profile(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL perfil amigo: %', res; end if;
  if res -> 'profile' ->> 'handle' <> 'f8_test_b' then raise exception 'FAIL perfil amigo: handle'; end if;
  if (res -> 'visibility' ->> 'stats')::boolean is not false then raise exception 'FAIL visibilidad stats'; end if;

  res := public.friend_stats(b);
  if res ->> 'reason' <> 'not_shared' then raise exception 'FAIL stats sin permiso: %', res; end if;
  res := public.friend_locker(b);
  if res ->> 'reason' <> 'not_shared' then raise exception 'FAIL armario sin permiso: %', res; end if;
end $$;

-- ═══ (7) Eliminar: silencioso, y los ámbitos se cierran ══════════════════
do $$
declare b uuid := current_setting('test.uid_b')::uuid; res jsonb;
begin
  res := public.friend_remove(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL eliminar: %', res; end if;

  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'friends') <> 0 then raise exception 'FAIL eliminar: sigue amigo'; end if;

  res := public.friend_stats(b);
  if res ->> 'reason' <> 'not_friends' then raise exception 'FAIL tras eliminar: %', res; end if;
end $$;

-- ═══ (8) Cruce de solicitudes = amistad (D1) ═════════════════════════════
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);
do $$
declare res jsonb;
begin
  res := public.friend_request_send('f8_test_a');
  if (res ->> 'accepted')::boolean is not false then
    raise exception 'FAIL cruce: auto-acepto sin que A enviara';
  end if;
  if (res -> 'target' ->> 'handle') <> 'f8_test_a' then raise exception 'FAIL cruce: destino %', res; end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare res jsonb;
begin
  res := public.friend_request_send('f8_test_b');
  if (res ->> 'accepted')::boolean is not true then
    raise exception 'FAIL D1: la solicitud cruzada no auto-acepto: %', res;
  end if;

  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'friends') <> 1 then raise exception 'FAIL D1: no quedo amistad'; end if;
  if jsonb_array_length(res -> 'list' -> 'outgoing') <> 0
     or jsonb_array_length(res -> 'list' -> 'incoming') <> 0 then
    raise exception 'FAIL D1: quedaron solicitudes colgando';
  end if;
end $$;

-- ═══ (9) Bloqueo y desbloqueo ════════════════════════════════════════════
do $$
declare b uuid := current_setting('test.uid_b')::uuid; res jsonb;
begin
  res := public.friend_block(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL bloquear: %', res; end if;

  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'friends') <> 0 then raise exception 'FAIL bloquear: sigue la amistad'; end if;
  if jsonb_array_length(res -> 'list' -> 'blocked') <> 1 then raise exception 'FAIL bloquear: sin lista'; end if;

  res := public.friend_locker(b);
  if res ->> 'reason' <> 'not_friends' then raise exception 'FAIL bloquear: sigue viendo el armario'; end if;

  -- Bloquear dos veces no rompe ni duplica.
  res := public.friend_block(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL bloquear dos veces: %', res; end if;
  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'blocked') <> 1 then raise exception 'FAIL bloquear dos veces: duplicado'; end if;

  -- Ni se puede uno bloquear a sí mismo.
  res := public.friend_block(current_setting('test.uid_a')::uuid);
  if res ->> 'reason' <> 'self' then raise exception 'FAIL bloquear self: %', res; end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);
do $$
declare res jsonb;
begin
  -- Quien bloqueó no aparece: misma respuesta que un handle inexistente.
  res := public.friend_request_send('f8_test_a');
  if res ->> 'reason' <> 'not_found' then
    raise exception 'FAIL bloqueado: recibio acuse (%)', res;
  end if;

  res := public.friend_list();
  if (res::text like '%f8_test_a%') then raise exception 'FAIL bloqueado: A aparece en su lista'; end if;
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL bloqueado: lista rota'; end if;
  if (res -> 'counts' ->> 'incoming')::int <> 0 then raise exception 'FAIL bloqueado: badge'; end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare b uuid := current_setting('test.uid_b')::uuid; res jsonb;
begin
  res := public.friend_unblock(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL desbloquear: %', res; end if;

  -- Desbloquear NO restaura la amistad (D3).
  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'friends') <> 0 then
    raise exception 'FAIL D3: desbloquear restauro la amistad';
  end if;
  if jsonb_array_length(res -> 'list' -> 'blocked') <> 0 then raise exception 'FAIL desbloquear: sigue bloqueado'; end if;
end $$;

-- ═══ (9.bis) `share_profile` es una puerta de verdad ════════════════════
-- La auditoría (A2/N1) encontró que el consentimiento se ignoraba en todas las
-- proyecciones menos `friend_profile`: una solicitud pendiente y hasta la lista
-- de amigos entregaban bio, avatar en base64, país y métodos con el interruptor
-- apagado. Aquí se apaga y se persiguen señuelos por cada camino.

-- Señuelos en el perfil de B. Son datos de PERFIL, no de visibilidad: se
-- escriben directos para que la prueba sea sobre qué sale, no sobre qué se
-- guarda.
reset role;
update public.profiles
   set bio = 'BIO-SECRETA',
       country = 'ES',
       avatar_kind = 'photo',
       avatar_data = 'data:image/png;base64,AAA',
       declared_methods = '["CFOP"]',
       main_puzzle = '222'
 where user_id = current_setting('test.uid_b')::uuid;
set local role authenticated;

-- B cierra su perfil pero deja solicitudes y stats abiertas: el caso exacto
-- que se filtraba.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);
do $$
declare res jsonb;
begin
  res := public.privacy_set(false, true, true, true);
  if (res ->> 'share_profile')::boolean is not false then
    raise exception 'FAIL (9.bis): no se pudo cerrar el perfil: %', res;
  end if;
end $$;

-- A pide amistad: la respuesta lleva identidad mínima, nunca el perfil.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare
  b uuid := current_setting('test.uid_b')::uuid;
  res jsonb;
  target jsonb;
  txt text;
begin
  res := public.friend_request_send('f8_test_b');
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL (9.bis) solicitud: %', res; end if;
  target := res -> 'target';
  if target ->> 'handle' <> 'f8_test_b' then raise exception 'FAIL (9.bis): sin identidad %', res; end if;
  if target ->> 'user_id' <> b::text then raise exception 'FAIL (9.bis): sin user_id %', res; end if;

  txt := target::text;
  if position('BIO-SECRETA' in txt) > 0 then raise exception 'FAIL (9.bis): bio en la solicitud'; end if;
  if position('data:image/png' in txt) > 0 then raise exception 'FAIL (9.bis): avatar en la solicitud'; end if;
  if position('CFOP' in txt) > 0 then raise exception 'FAIL (9.bis): metodos en la solicitud'; end if;
  if target ? 'bio' or target ? 'avatar_data' or target ? 'declared_methods'
     or target ? 'country' or target ? 'main_puzzle' or target ? 'created_at' then
    raise exception 'FAIL (9.bis): la solicitud lleva claves de perfil %', target;
  end if;

  -- Y lo mismo en la lista de salientes.
  res := public.friend_list();
  txt := (res -> 'list' -> 'outgoing')::text;
  if position('BIO-SECRETA' in txt) > 0 or position('data:image/png' in txt) > 0
     or position('CFOP' in txt) > 0 then
    raise exception 'FAIL (9.bis): fuga en la lista de salientes';
  end if;
end $$;

-- B acepta: sigue con el perfil cerrado, así que A ve identidad y nada más.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);
do $$
declare a uuid := current_setting('test.uid_a')::uuid; res jsonb; txt text;
begin
  res := public.friend_list();
  txt := (res -> 'list' -> 'incoming')::text;
  if position('BIO-SECRETA' in txt) > 0 or position('data:image/png' in txt) > 0 then
    raise exception 'FAIL (9.bis): fuga en la lista de entrantes';
  end if;

  res := public.friend_request_accept(a);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL (9.bis) aceptar: %', res; end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare
  b uuid := current_setting('test.uid_b')::uuid;
  res jsonb;
  txt text;
begin
  -- Amigo con el perfil cerrado: la tarjeta sigue viva (identidad), el perfil
  -- extendido no sale.
  res := public.friend_list();
  txt := (res -> 'list' -> 'friends')::text;
  if position('f8_test_b' in txt) = 0 then raise exception 'FAIL (9.bis): falta la identidad del amigo'; end if;
  if position('BIO-SECRETA' in txt) > 0 then raise exception 'FAIL (9.bis): bio del amigo cerrado'; end if;
  if position('data:image/png' in txt) > 0 then raise exception 'FAIL (9.bis): avatar del amigo cerrado'; end if;
  if position('CFOP' in txt) > 0 then raise exception 'FAIL (9.bis): metodos del amigo cerrado'; end if;

  -- La página de perfil dice el motivo, en vez de devolver la mitad.
  res := public.friend_profile(b);
  if res ->> 'reason' <> 'not_shared' then raise exception 'FAIL (9.bis) perfil cerrado: %', res; end if;

  -- `friend_stats` comparte stats, NO perfil: antes colaba el perfil entero por
  -- su campo `owner`.
  res := public.friend_stats(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL (9.bis) stats: %', res; end if;
  if res ? 'owner' then raise exception 'FAIL (9.bis): stats sigue llevando owner'; end if;
  txt := res::text;
  if position('BIO-SECRETA' in txt) > 0 or position('data:image/png' in txt) > 0
     or position('CFOP' in txt) > 0 then
    raise exception 'FAIL (9.bis): el perfil cerrado sale por las estadisticas';
  end if;

  -- Y el armario sigue funcionando sin arrastrar perfil.
  res := public.friend_locker(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL (9.bis) armario: %', res; end if;
  if res ? 'owner' then raise exception 'FAIL (9.bis): el armario lleva owner'; end if;

  -- Un uuid que no es de nadie responde `not_found`, no un 500 de FK.
  res := public.friend_block('ffffffff-0000-4000-8000-000000000000'::uuid);
  if res ->> 'reason' <> 'not_found' then raise exception 'FAIL (9.bis) bloqueo inexistente: %', res; end if;

  -- Y bloquear no puede ser un lector de perfiles: la lista de bloqueados
  -- proyecta identidad mínima.
  res := public.friend_block(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL (9.bis) bloquear: %', res; end if;
  res := public.friend_list();
  txt := (res -> 'list' -> 'blocked')::text;
  if position('BIO-SECRETA' in txt) > 0 or position('data:image/png' in txt) > 0 then
    raise exception 'FAIL (9.bis): la lista de bloqueados filtra el perfil';
  end if;

  res := public.friend_unblock(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL (9.bis) desbloquear: %', res; end if;
end $$;

-- ═══ (10) Límite de ritmo ════════════════════════════════════════════════
do $$
declare res jsonb; i int; limited boolean := false;
begin
  for i in 1..25 loop
    res := public.friend_request_send('f8_test_b');
    if res ->> 'reason' = 'rate_limited' then
      limited := true;
      exit;
    end if;
  end loop;
  if not limited then raise exception 'FAIL rate limit: 25 solicitudes sin frenar'; end if;
end $$;

reset role;
select 'Fase 8 · suite A — TODAS LAS ASERCIONES PASAN' as resultado;
