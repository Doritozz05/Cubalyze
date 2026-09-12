-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 6 — el Locker llega a la nube (esquema).
--
-- Espejo de las tablas locales gear_categories / gear_types / gear_items
-- (migración local 034 + columna smart_id de la 036), más la columna de
-- partición `user_id` y RLS. Mismo modelo que el resto de tablas sincronizadas
-- (ver 20260821000000_accounts.sql y ADR-029): row-sync LWW con watermarks y
-- tombstones, y los borrados viajan como filas de sync_tombstones.
--
-- Decisiones no obvias, y por qué:
--
--   • SIN foreign keys entre las tres tablas. Es la misma decisión que ya se
--     tomó para solves.session_id: el orden de los bloques de un payload no
--     puede hacer fallar un push, y la integridad referencial la garantiza el
--     cliente, que sí tiene FKs locales. Con FKs en la nube, un push que
--     llegase con el hijo antes que el padre abortaría el lote entero.
--
--   • SIN CHECK constraints. La nube es almacenamiento tolerante: un CHECK que
--     un cliente viejo no conoce (un `status` nuevo, o `condition` que aún no
--     existía) rechazaría la fila y atascaría el sync del usuario hasta que
--     actualizara. La validación de dominio vive en el cliente, que es donde
--     el dato se escribe.
--
--   • `smart_id` con índice NO único a propósito. La regla de producto es "un
--     smart_id pertenece a un item" (Plan-Fase5 §5.1), pero un índice único
--     haría que dos dispositivos que vinculan el mismo cubo a items distintos
--     provocasen un unique_violation dentro de sync_apply: el lote falla, el
--     watermark no avanza y el sync queda atascado para siempre. La unicidad
--     se defiende en el cliente (donde la vinculación ocurre) y se reporta con
--     el chequeo de integridad, no se convierte en un cuelgue del sync.
--
--   • `price_amount` / `rating` son double precision (el REAL local) para no
--     perder precisión al ir y volver; el resto de columnas espeja el tipo
--     local 1:1.
--
-- Fase 8 (amigos, ver stats y Locker): esta migración NO abre lectura ajena.
-- Las políticas son de propietario y por comando (no un `for all` monolítico),
-- y las columnas sensibles (serial, smart_id) viven en la fila base, así que
-- la Fase 8 compartirá a través de una proyección firmada (función security
-- definer / vista) en vez de conceder SELECT sobre estas filas. Ver el plan,
-- §6, para el porqué y el cómo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Categorías ────────────────────────────────────────────────────────────
create table if not exists public.gear_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null default '',
  kind text not null default 'gear',
  icon text not null default 'Box',
  accent text,
  is_demo integer not null default 0,
  created_at bigint not null default 0,
  updated_at bigint not null default 0,
  primary key (user_id, id)
);

-- ── Tipos (opcionalmente colgados de una categoría de puzzle) ─────────────
create table if not exists public.gear_types (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  category_id text not null default '',
  name text not null default '',
  puzzle_category text,
  is_demo integer not null default 0,
  created_at bigint not null default 0,
  updated_at bigint not null default 0,
  primary key (user_id, id)
);

-- ── Items ─────────────────────────────────────────────────────────────────
create table if not exists public.gear_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  category_id text not null default '',
  type_id text,
  name text not null default '',
  brand text,
  model text,
  finish text,
  -- Serial impreso por el fabricante y dirección Bluetooth del smart cube: dos
  -- hechos distintos (un cubo puede tener los dos). No se sincronizan como
  -- "públicos": la proyección de la Fase 8 los omite.
  serial text,
  smart_id text,
  palette text not null default '[]',
  acquired_at text,
  price_amount double precision,
  price_currency text,
  notes text,
  links text not null default '[]',
  photos text not null default '[]',
  tags text not null default '[]',
  status text not null default 'owned',
  condition text,
  is_primary integer not null default 0,
  is_favorite integer not null default 0,
  rating double precision,
  quantity integer not null default 1,
  is_demo integer not null default 0,
  created_at bigint not null default 0,
  updated_at bigint not null default 0,
  primary key (user_id, id)
);

-- ── Índices ───────────────────────────────────────────────────────────────
-- El cursor de pull es (user_id, updated_at) en las tres; los demás sirven a
-- la Fase 8 (locker de un amigo por categoría) y a la resolución del vínculo
-- de hardware por smart_id.
create index if not exists idx_gear_categories_user_updated
  on public.gear_categories (user_id, updated_at);
create index if not exists idx_gear_types_user_updated
  on public.gear_types (user_id, updated_at);
create index if not exists idx_gear_types_user_category
  on public.gear_types (user_id, category_id);
create index if not exists idx_gear_items_user_updated
  on public.gear_items (user_id, updated_at);
create index if not exists idx_gear_items_user_category
  on public.gear_items (user_id, category_id);
create index if not exists idx_gear_items_user_type
  on public.gear_items (user_id, type_id);
create index if not exists idx_gear_items_user_smart
  on public.gear_items (user_id, smart_id)
  where smart_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security — cada usuario solo ve / escribe sus propias filas.
-- Políticas por comando (aunque aquí `for all` baste) para que la Fase 8 pueda
-- AÑADIR una política SELECT de amistad sin reescribir la de propietario:
-- las políticas permisivas se OR-ean, no se sustituyen.
-- `(select auth.uid())` = initplan, se evalúa una vez por consulta (misma
-- decisión que 20260822000003_rls_hardening.sql).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.gear_categories enable row level security;
alter table public.gear_types enable row level security;
alter table public.gear_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['gear_categories', 'gear_types', 'gear_items']
  loop
    execute format('drop policy if exists "owner_all_%s" on public.%I', t, t);
    execute format(
      'create policy "owner_all_%s" on public.%I for all
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t, t
    );
  end loop;
end $$;

-- ── Grants ────────────────────────────────────────────────────────────────
-- SELECT es el ÚNICO privilegio de tabla que reciben los roles de API (el pull
-- lee por REST); las escrituras pasan exclusivamente por sync_apply. Misma
-- política que 20260822000001/0002.
revoke insert, update, delete on
  public.gear_categories, public.gear_types, public.gear_items
from anon, authenticated;

grant select on
  public.gear_categories, public.gear_types, public.gear_items
to anon, authenticated;

grant select, insert, update, delete on
  public.gear_categories, public.gear_types, public.gear_items
to service_role;

notify pgrst, 'reload schema';
