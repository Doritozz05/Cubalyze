-- ═══════════════════════════════════════════════════════════════════════════
-- Reserva del nombre NUEVO en la lista de handles — `cubalyze`
--
-- La lista de nombres que nadie puede reclamar vive dentro de
-- `public.normalize_handle()`, definida en `20260912000016_handle_identity.sql`
-- (ya aplicada). Reserva `cubeforge` —el nombre histórico, que NO se libera
-- nunca— y no reservaba `cubalyze`: el nombre nuevo era reclamable por
-- cualquiera justo después del cambio de marca.
--
-- POR QUÉ UN FICHERO NUEVO Y NO UNA EDICIÓN DE LA 16
-- El CLI registra las migraciones por su id. Un fichero ya aplicado **no se
-- vuelve a ejecutar** en el proyecto hosteado, pero sí se ejecutaría en una base
-- nueva (otro entorno local, un proyecto reconstruido): editar la 16 dejaría dos
-- bases con el mismo historial y contenido distinto, en silencio. `create or
-- replace` sobre la MISMA firma es la forma correcta — idempotente, sin tocar
-- datos, y ningún llamador se entera.
--
-- QUÉ NO HACE
--   • No libera `cubeforge` (sigue reservado; la lista solo crece).
--   • No modifica ni borra ninguna fila de `public.profiles`.
--   • No cambia la firma, el `immutable` ni el `search_path` de la función.
--
-- Contrato vigilado en `packages/sync-engine/src/__tests__/`
-- `handle-reservation.contract.test.ts`: la lista EFECTIVA (la última
-- definición, no este fichero por su nombre) debe seguir conteniendo los dos
-- nombres, y la 16 está fijada por hash para que nadie la «arregle» en su sitio.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── ¿Hay alguien usando ya el nombre nuevo? ───────────────────────────────
-- Reservar impide reclamarlo, pero NO expulsa a quien ya lo tuviera: nada aquí
-- toca `profiles`. Si existiera un titular, aplicar la reserva en silencio
-- dejaría la marca en manos de esa cuenta sin que nadie se enterara, así que se
-- falla en voz alta: la migración aborta (y con ella el `db push`, sin aplicar
-- nada) diciendo el `user_id` que hay que revisar.
--
-- Salida: mira ese perfil y decide — reasignarle otro handle desde la app, o
-- aceptarlo a sabiendas — y vuelve a empujar. Una migración que falla no queda
-- registrada, así que se puede reintentar sin efectos colaterales.
do $$
declare
  holder uuid;
begin
  select p.user_id into holder
  from public.profiles p
  where lower(p.handle) = 'cubalyze'
  limit 1;

  if holder is not null then
    raise exception
      'El handle reservado "cubalyze" ya pertenece al usuario % — revísalo antes de aplicar la reserva',
      holder;
  end if;
end $$;

-- ── Formato canónico (copia literal de la 16, con `cubalyze` de más) ──────
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
    'admin', 'administrator', 'support', 'cubeforge', 'cubalyze', 'system', 'root',
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

-- `create or replace` conserva dueño y permisos, pero se vuelve a cerrar el
-- acceso de forma explícita: la autoridad sobre el formato es de una sola
-- función y de nadie más. `handle_claim` es `security definer` y la llama como
-- dueño, así que sigue funcionando igual.
revoke all on function public.normalize_handle(text) from public, anon, authenticated;
