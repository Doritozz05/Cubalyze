-- Fase 8 · F8.5 — El contador de cuota del firmante de fotos (migración 19).
-- El comando bash lo envuelve: begin; <15><16><17><18><19> <este fichero> rollback;

-- ── (1) Privilegios: solo la service role ─────────────────────────────────
do $$
begin
  if has_function_privilege(
    'authenticated', 'public.friend_rate_bump(uuid,text,bigint,int)', 'execute'
  ) then
    raise exception 'FAIL grants: authenticated puede consumir la cuota ajena';
  end if;
  if has_function_privilege(
    'anon', 'public.friend_rate_bump(uuid,text,bigint,int)', 'execute'
  ) then
    raise exception 'FAIL grants: anon puede consumir la cuota ajena';
  end if;
  if not has_function_privilege(
    'service_role', 'public.friend_rate_bump(uuid,text,bigint,int)', 'execute'
  ) then
    raise exception 'FAIL grants: la service role no puede ejecutarla (la Edge Function fallaría)';
  end if;
end $$;

-- ── (2) Semántica de ventana fija ─────────────────────────────────────────
-- Ventana de una hora para que la prueba no dependa del cambio de minuto.
do $$
declare
  -- Un usuario REAL: `friend_rate_limits.actor` tiene FK a `auth.users`, así que
  -- un actor inventado no puede ni contar (y eso es correcto: nadie puede
  -- sembrar la tabla con uuids arbitrarios).
  friend_rate_bump_actor uuid := (select id from auth.users order by id limit 1);
  ok1 boolean;
  ok2 boolean;
  ok3 boolean;
  ok4 boolean;
  stored int;
begin
  ok1 := public.friend_rate_bump(friend_rate_bump_actor, 'unit_test', 3600000, 2);
  ok2 := public.friend_rate_bump(friend_rate_bump_actor, 'unit_test', 3600000, 2);
  ok3 := public.friend_rate_bump(friend_rate_bump_actor, 'unit_test', 3600000, 2);
  ok4 := public.friend_rate_bump(friend_rate_bump_actor, 'unit_test', 3600000, 2);

  if ok1 is not true then raise exception 'FAIL: la primera llamada debe permitirse'; end if;
  if ok2 is not true then raise exception 'FAIL: la segunda debe permitirse (límite 2)'; end if;
  if ok3 is not false then raise exception 'FAIL: la tercera debe denegarse'; end if;
  -- Insistir no reinicia la ventana: la cuarta sigue denegada.
  if ok4 is not false then raise exception 'FAIL: insistir ha reiniciado la ventana'; end if;

  -- …y el contador sí se incrementa incluso denegando (la ventana no se
  -- "perdona" por reintentar).
  select frl.count into stored from public.friend_rate_limits frl
  where frl.actor = friend_rate_bump_actor and frl.action = 'unit_test';
  if stored <> 4 then raise exception 'FAIL: contador % (esperado 4)', stored; end if;
end $$;

-- ── (3) Un actor nulo deniega (fail closed) ───────────────────────────────
do $$
begin
  if public.friend_rate_bump(null, 'unit_test', 3600000, 5) is not false then
    raise exception 'FAIL: un actor nulo no debe permitir nada';
  end if;
  if public.friend_rate_bump(
    (select id from auth.users order by id limit 1), 'unit_test', 0, 5
  ) is not false then
    raise exception 'FAIL: una ventana inválida no debe permitir nada';
  end if;
end $$;

-- ── (4) Retención de ventanas ─────────────────────────────────────────────
-- La tabla de cuotas no puede crecer sin fin: cada consumo borra sus propias
-- ventanas de más de 7 días. Se siembra una vieja a mano (la tabla tiene FK a
-- auth.users, así que el actor es una cuenta real) y se comprueba que el
-- siguiente consumo se la lleva por delante SIN tocar la ventana actual.
do $$
declare
  -- `v_actor`, no `actor`: una variable con el mismo nombre que la columna
  -- hace ambiguo cada `values (actor, …)` y Postgres aborta con 42702.
  v_actor uuid := (select id from auth.users order by id limit 1);
  stale_start bigint := ((extract(epoch from now()) * 1000)::bigint) - 8 * 86400000;
  probe boolean;
begin
  insert into public.friend_rate_limits (actor, action, window_start, count)
  values (v_actor, 'retention_probe', stale_start, 1)
  on conflict (actor, action, window_start) do nothing;

  probe := public.friend_rate_bump(v_actor, 'retention_probe', 3600000, 5);
  if probe is not true then raise exception 'FAIL retencion: el consumo fallo'; end if;

  if exists (
    select 1 from public.friend_rate_limits frl
    where frl.actor = v_actor and frl.action = 'retention_probe'
      and frl.window_start = stale_start
  ) then
    raise exception 'FAIL retencion: la ventana de 8 dias sigue ahi';
  end if;

  -- …y la ventana actual sí existe: se borró lo viejo, no todo.
  if not exists (
    select 1 from public.friend_rate_limits frl
    where frl.actor = v_actor and frl.action = 'retention_probe'
      and frl.window_start = public.friend_window_start(3600000)
  ) then
    raise exception 'FAIL retencion: falta la ventana actual';
  end if;
end $$;

select 'Fase 8 · suite F8.5 — TODAS LAS ASERCIONES PASAN' as resultado;
