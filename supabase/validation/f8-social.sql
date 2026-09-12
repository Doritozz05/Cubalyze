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
