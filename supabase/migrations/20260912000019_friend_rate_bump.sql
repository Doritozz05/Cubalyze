-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 8 · F8.5 — Contador de cuota para la Edge Function de fotos.
--
-- `friend_rate_check` (migración 18) resuelve el límite para las RPC, pero no
-- sirve aquí por una razón concreta: es `security definer` y deriva el actor de
-- `auth.uid()`. Una Edge Function corre con la **service role** y sin claims de
-- usuario, así que `auth.uid()` es null y no habría contador. Además está
-- revocada para `authenticated` a propósito (nadie debe poder consumir la cuota
-- de otro).
--
-- Se añade por tanto una variante EXPLÍCITA y de un solo uso:
--   · recibe el actor como parámetro (la función ya sabe quién es: lo verificó
--     con `auth.getUser(token)` antes de llegar aquí);
--   · está concedida SOLO a `service_role`;
--   · comparte tabla y semántica con `friend_rate_check` (ventana fija, el
--     contador se incrementa SIEMPRE, así que insistir no reinicia la ventana).
--
-- Sin esto, el firmante de fotos sería la única superficie de la fase sin
-- freno: cada llamada firma hasta 120 objetos y consume egress.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.friend_rate_bump(
  p_actor uuid,
  p_action text,
  p_window_ms bigint,
  p_limit int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c int;
begin
  -- Un actor nulo no es un error de producto: es una llamada mal construida.
  -- Se deniega (fail closed) en vez de contar en una fila fantasma.
  if p_actor is null or p_action is null or p_window_ms is null or p_window_ms <= 0 then
    return false;
  end if;

  -- Misma retención que `friend_rate_check` (migración 18): 7 días de ventanas,
  -- usando el prefijo `actor` de la PK. La cuota de la Edge Function no puede
  -- dejar la tabla creciendo sin fin por el hecho de no pasar por el RPC.
  delete from public.friend_rate_limits
  where actor = p_actor
    and window_start < public.friend_window_start(p_window_ms) - 7 * 86400000;

  insert into public.friend_rate_limits (actor, action, window_start, count)
  values (p_actor, p_action, public.friend_window_start(p_window_ms), 1)
  on conflict (actor, action, window_start)
    do update set count = public.friend_rate_limits.count + 1
  returning count into c;

  return c <= coalesce(p_limit, 1);
end $$;

-- Solo la service role. `authenticated` NO puede consumir la cuota de nadie
-- (ni la suya por esta vía: para eso está `friend_rate_check`, que sí conoce
-- `auth.uid()`).
revoke all on function public.friend_rate_bump(uuid, text, bigint, int)
  from public, anon, authenticated;
grant execute on function public.friend_rate_bump(uuid, text, bigint, int)
  to service_role;

notify pgrst, 'reload schema';
