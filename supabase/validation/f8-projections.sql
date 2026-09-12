-- Fase 8 — suite B: las proyecciones (escaparate y estadísticas).
-- El comando bash lo envuelve: begin; <16><17><18> <este fichero> rollback;
--
-- Usuarios SINTÉTICOS, no reales: los dos perfiles de producción tienen
-- solves, así que sus agregados no son un número fijo y cualquier aserción
-- sobre `total`/`best`/`ao5` sería frágil (o falsa). El fixture se crea dentro
-- de la transacción y el `rollback` lo borra entero.
--
-- El trigger `on_auth_user_created` crea la fila de `profiles`, así que basta
-- con el INSERT en `auth.users`.

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('f8000000-0000-4000-8000-0000000000a1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'f8-suite-a@test.local', 'x', now(), now(), now()),
  ('f8000000-0000-4000-8000-0000000000b1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'f8-suite-b@test.local', 'x', now(), now(), now());

select set_config('test.uid_a', 'f8000000-0000-4000-8000-0000000000a1', true);
select set_config('test.uid_b', 'f8000000-0000-4000-8000-0000000000b1', true);


-- ═══ Setup: identidad, amistad y datos con señuelos ══════════════════════
-- Orden importante: los DOS tienen que tener handle antes de que A pida nada.
-- Un handle sin reclamar devuelve `not_found` (y eso es lo correcto: no
-- distinguimos "no existe" de "existe sin identidad pública").
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

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare res jsonb;
begin
  res := public.friend_request_send('f8_test_b');
  if (res ->> 'ok')::boolean is not true and res ->> 'reason' <> 'already_friends' then
    raise exception 'FAIL setup solicitud: %', res;
  end if;
end $$;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);
do $$
declare a uuid := current_setting('test.uid_a')::uuid; res jsonb;
begin
  res := public.friend_request_accept(a);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL setup aceptar: %', res; end if;
  res := public.friend_list();
  if jsonb_array_length(res -> 'list' -> 'friends') <> 1 then
    raise exception 'FAIL setup amistad: %', (res -> 'list' -> 'friends');
  end if;
end $$;

reset role;
insert into public.gear_categories (user_id, id, name, kind, icon, accent, is_demo, created_at, updated_at)
values (current_setting('test.uid_b')::uuid, 'f8_cat', 'Cubos', 'cube', 'Box', null, 0, 1, 1);

insert into public.gear_items
  (user_id, id, category_id, type_id, name, brand, model, finish, serial, smart_id,
   palette, acquired_at, price_amount, price_currency, notes, links, photos, tags,
   status, condition, is_primary, is_favorite, rating, quantity, is_demo, created_at, updated_at)
values
  (current_setting('test.uid_b')::uuid, 'f8_item_1', 'f8_cat', null, 'GAN 12 Maglev', 'GAN', '12',
   'UV', 'SERIAL-SECRETO', 'AABBCCDDEEFF', '["#ff0000"]', '2024-03-11', 99.99, 'EUR',
   'NOTA-PRIVADA', '["https://tienda.example/pedido/123"]',
   '[{"id":"p1","width":1280,"height":1280,"addedAt":1}]', '["main"]',
   'owned', 'good', 1, 1, 9.5, 1, 0, 1, 1),
  (current_setting('test.uid_b')::uuid, 'f8_item_2', 'f8_cat', null, 'MoYu WRM v10', 'MoYu', 'v10',
   null, null, null, '[]', null, null, null, null, '[]', '[]', '[]',
   'owned', null, 0, 0, null, 1, 0, 2, 2),
  (current_setting('test.uid_b')::uuid, 'f8_item_3', 'f8_cat_2', null, 'YJ MGC 4x4', 'YJ', 'MGC',
   null, null, null, '[]', null, null, null, null, '[]', '[]', '[]',
   'wishlist', null, 0, 0, null, 1, 0, 3, 3),
  (current_setting('test.uid_b')::uuid, 'f8_item_demo', 'f8_cat', null, 'CUBO DEMO', null, null,
   null, null, null, '[]', null, null, null, null, '[]', '[]', '[]',
   'owned', null, 0, 0, null, 1, 1, 4, 4);

-- Una sesión y unas cuantas solves de B, para que las agregadas tengan qué
-- agregar. Los señuelos de una solve (scramble, nota) NO deben salir nunca.
insert into public.sessions (user_id, id, name, created_at, updated_at, is_demo)
values (current_setting('test.uid_b')::uuid, 'f8_sess', 'F8', 1, 1, 0);

insert into public.solves
  (user_id, id, session_id, time_ms, timestamp, scramble, penalty, source, note, moves,
   puzzle_type, is_demo, created_at, updated_at)
values
  (current_setting('test.uid_b')::uuid, 'f8_s1', 'f8_sess', 10000, 100000,
   'R U R-ESCRAMBLE', 'none', 'manual', 'NOTA-DE-SOLVE', '[]', '333', 0, 1, 1),
  (current_setting('test.uid_b')::uuid, 'f8_s2', 'f8_sess', 12000, 200000,
   'F R U', '+2', 'manual', null, '[]', '333', 0, 2, 2),
  (current_setting('test.uid_b')::uuid, 'f8_s3', 'f8_sess', 9000, 300000,
   'U R', 'DNF', 'manual', null, '[]', '333', 0, 3, 3),
  (current_setting('test.uid_b')::uuid, 'f8_s4', 'f8_sess', 8000, 400000,
   'L U', 'none', 'manual', null, '[]', '333', 0, 4, 4),
  (current_setting('test.uid_b')::uuid, 'f8_s5', 'f8_sess', 7000, 500000,
   'R L', 'none', 'manual', null, '[]', '333', 0, 5, 5),
  (current_setting('test.uid_b')::uuid, 'f8_s6', 'f8_sess', 5000, 600000,
   'B U', 'none', 'manual', null, '[]', '222', 0, 6, 6);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_b'))::text, true);
do $$
declare res jsonb;
begin
  res := public.privacy_set(true, true, true, true);
  if (res ->> 'share_locker')::boolean is not true then raise exception 'FAIL privacy_set: %', res; end if;
end $$;

-- ═══ (1) El escaparate: lista blanca ═════════════════════════════════════
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.uid_a'))::text, true);
do $$
declare b uuid := current_setting('test.uid_b')::uuid; res jsonb; txt text;
begin
  res := public.friend_locker(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL armario: %', res; end if;

  -- Solo el armario de B: nada de A (que no tiene gear en esta transacción).
  if (res -> 'items')::text like '%f8_item_%' and b is null then
    raise exception 'FAIL armario: imposible';
  end if;

  txt := res::text;

  -- Señuelos: si aparecen, la lista blanca no es una lista blanca.
  if position('SERIAL-SECRETO' in txt) > 0 then raise exception 'FAIL fuga: valor de serial'; end if;
  if position('AABBCCDDEEFF' in txt) > 0 then raise exception 'FAIL fuga: valor de smart_id'; end if;
  if position('NOTA-PRIVADA' in txt) > 0 then raise exception 'FAIL fuga: valor de notes'; end if;
  if position('tienda.example' in txt) > 0 then raise exception 'FAIL fuga: links'; end if;
  if position('99.99' in txt) > 0 then raise exception 'FAIL fuga: precio'; end if;
  if position('"serial"' in txt) > 0 or position('"smart_id"' in txt) > 0 then
    raise exception 'FAIL fuga: claves sensibles';
  end if;
  if position('"price_amount"' in txt) > 0 or position('"price_currency"' in txt) > 0 then
    raise exception 'FAIL fuga: claves de precio';
  end if;
  if position('"notes"' in txt) > 0 or position('"links"' in txt) > 0 then
    raise exception 'FAIL fuga: claves de notas/enlaces';
  end if;
  if position('"user_id"' in txt) > 0 then raise exception 'FAIL fuga: user_id'; end if;

  -- Lo que SÍ debe estar.
  if position('GAN 12 Maglev' in txt) = 0 then raise exception 'FAIL armario: falta el nombre'; end if;
  if position('#ff0000' in txt) = 0 then raise exception 'FAIL armario: falta la paleta'; end if;
  if position('p1' in txt) = 0 then raise exception 'FAIL armario: falta la referencia de foto'; end if;
  if position('CUBO DEMO' in txt) > 0 then raise exception 'FAIL armario: salio un item demo'; end if;
  if jsonb_array_length(res -> 'items') <> 3 then
    raise exception 'FAIL armario: % items (esperado 3)', jsonb_array_length(res -> 'items');
  end if;
  if jsonb_array_length(res -> 'categories') <> 1 then raise exception 'FAIL armario: taxonomia'; end if;
end $$;

-- ═══ (2) Paginación por keyset ═══════════════════════════════════════════
do $$
declare
  b uuid := current_setting('test.uid_b')::uuid;
  page1 jsonb;
  page2 jsonb;
  page3 jsonb;
begin
  page1 := public.friend_locker(b, null, null, 2);
  if jsonb_array_length(page1 -> 'items') <> 2 then
    raise exception 'FAIL pagina 1: % items', jsonb_array_length(page1 -> 'items');
  end if;
  -- El cursor apunta al ÚLTIMO item servido (keyset, no offset).
  if (page1 -> 'next' ->> 'id') <> (page1 -> 'items' -> 1 ->> 'id') then
    raise exception 'FAIL pagina 1: cursor mal puesto';
  end if;

  page2 := public.friend_locker(b, page1 -> 'next' ->> 'category_id', page1 -> 'next' ->> 'id', 2);
  if jsonb_array_length(page2 -> 'items') <> 1 then
    raise exception 'FAIL pagina 2: % items', jsonb_array_length(page2 -> 'items');
  end if;
  -- Última página: «next» es JSON null (la clave está, el valor no).
  if (page2 -> 'next' ->> 'id') is not null then raise exception 'FAIL pagina 2: sobra cursor'; end if;
  if page2 -> 'items' -> 0 ->> 'id' = page1 -> 'items' -> 0 ->> 'id' then
    raise exception 'FAIL paginacion: duplicado';
  end if;
  if page2 -> 'items' -> 0 ->> 'id' = page1 -> 'items' -> 1 ->> 'id' then
    raise exception 'FAIL paginacion: duplicado';
  end if;

  -- Y el tope de página está acotado (p_limit se satura a 100).
  page3 := public.friend_locker(b, null, null, 100000);
  if jsonb_array_length(page3 -> 'items') <> 3 then raise exception 'FAIL tope de pagina'; end if;
end $$;

-- ═══ (3) Estadísticas agregadas, sin una sola fila de solve ══════════════
do $$
declare
  b uuid := current_setting('test.uid_b')::uuid;
  res jsonb;
  txt text;
  p333 jsonb;
begin
  res := public.friend_stats(b);
  if (res ->> 'ok')::boolean is not true then raise exception 'FAIL stats: %', res; end if;

  txt := res::text;
  if position('R-ESCRAMBLE' in txt) > 0 then raise exception 'FAIL stats: fuga de scramble'; end if;
  if position('NOTA-DE-SOLVE' in txt) > 0 then raise exception 'FAIL stats: fuga de nota'; end if;
  if position('"scramble"' in txt) > 0 then raise exception 'FAIL stats: clave scramble'; end if;
  if position('"solves"' in txt) > 0 then raise exception 'FAIL stats: viajan solves'; end if;
  if position('"session_id"' in txt) > 0 then raise exception 'FAIL stats: clave session_id'; end if;
  if position('"moves"' in txt) > 0 then raise exception 'FAIL stats: clave moves'; end if;
  if position('"analysis"' in txt) > 0 then raise exception 'FAIL stats: clave analysis'; end if;
  if position('"note"' in txt) > 0 then raise exception 'FAIL stats: clave note'; end if;
  if position('"id"' in txt) > 0 then raise exception 'FAIL stats: ids de solve'; end if;

  -- Forma del contrato.
  if not (res ? 'by_puzzle') or not (res ? 'overall') then raise exception 'FAIL stats: forma'; end if;
  if jsonb_array_length(res -> 'heatmap') <> 365 then
    raise exception 'FAIL stats: heatmap de % dias', jsonb_array_length(res -> 'heatmap');
  end if;
  -- `owner` YA NO EXISTE en la respuesta: la identidad viaja en el directorio y
  -- en el perfil, y repetirla aquí era una segunda puerta al perfil extendido
  -- que `share_stats` no protege (auditoría A2/N1).
  if res ? 'owner' then raise exception 'FAIL stats: la respuesta lleva owner'; end if;

  -- Los números del 3x3, calculados a mano sobre las solves de arriba
  -- (10000, 12000+2000, DNF, 8000, 7000): efectivas 10000/14000/-/8000/7000.
  select value into p333
  from jsonb_array_elements(res -> 'by_puzzle') as e
  where e ->> 'puzzle' = '333';

  if (p333 ->> 'total')::int <> 5 then raise exception 'FAIL stats 333: total %', p333 ->> 'total'; end if;
  if (p333 ->> 'count')::int <> 4 then raise exception 'FAIL stats 333: count %', p333 ->> 'count'; end if;
  if (p333 ->> 'best')::int <> 7000 then raise exception 'FAIL stats 333: best %', p333 ->> 'best'; end if;
  if (p333 ->> 'worst')::int <> 14000 then raise exception 'FAIL stats 333: worst %', p333 ->> 'worst'; end if;
  if (p333 ->> 'session_time')::int <> 39000 then raise exception 'FAIL stats 333: suma %', p333 ->> 'session_time'; end if;
  -- Ao5 de las 5 más recientes (s5..s1): 7000, 8000, DNF, 14000, 10000 →
  -- un DNF entra en el recorte (trim 1) → media de 8000, 10000, 14000.
  if (p333 -> 'ao5' ->> 'ms')::int <> 10667 then raise exception 'FAIL stats 333: ao5 %', p333 -> 'ao5'; end if;
  -- Ao12: solo hay 5 solves del 3x3 → no hay datos suficientes.
  if (p333 -> 'ao12') <> 'null'::jsonb then raise exception 'FAIL stats 333: ao12 %', p333 -> 'ao12'; end if;

  -- El 2x2 tiene una sola solve: ni Ao5 ni Ao12.
  if (res -> 'overall' ->> 'total')::int <> 6 then
    raise exception 'FAIL stats: total global %', res -> 'overall' ->> 'total';
  end if;

  -- La racha: las solves están en 1970 (timestamps 100000..600000 ms), así que
  -- no hay actividad reciente.
  if (res ->> 'streak_days')::int <> 0 then raise exception 'FAIL stats: racha'; end if;
end $$;

reset role;
select 'Fase 8 · suite B — TODAS LAS ASERCIONES PASAN' as resultado;
