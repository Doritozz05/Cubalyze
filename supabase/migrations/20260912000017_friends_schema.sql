-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 8 · F8.1 — Esquema social: amistades, bloqueos, visibilidad y límites.
--
-- Es la primera vez que el sistema guarda un hecho entre DOS cuentas. Tres
-- decisiones estructurales, cada una con su porqué:
--
--   • `friendships` con PAR CANÓNICO (`user_low` / `user_high`), una sola fila
--     por pareja. La simetría es una propiedad de la fila, no un acuerdo entre
--     dos filas que pueden desincronizarse: aceptar es UN `UPDATE`, y el
--     `check (user_low < user_high)` hace imposible el par duplicado invertido
--     a nivel de motor. La alternativa (dos filas espejo) es la fuente clásica
--     de "amistad aceptada solo en un sentido" y de filas huérfanas al borrar.
--
--   • `friend_blocks` SEPARADA de `friendships`. El bloqueo es asimétrico y
--     debe sobrevivir sin amistad: meterlo como `status` en una fila simétrica
--     obligaría a elegir arbitrariamente quién es `user_low` para representar un
--     hecho dirigido, y borrar la amistad se llevaría el bloqueo por delante,
--     dejando que la persona bloqueada vuelva a solicitar.
--
--   • `profile_visibility` SEPARADA de `profiles`. No es normalización: es
--     corrección. `profiles` se escribe desde el dispositivo a través del bloque
--     de `sync_apply`, cuyo `on conflict do update set` enumera las columnas.
--     Una columna de consentimiento ahí sería sobrescrita por el siguiente push
--     de un cliente que no la conoce (con su valor por defecto): un dispositivo
--     viejo apagaría tu visibilidad, o un payload manipulado la encendería. El
--     consentimiento es estado de SERVIDOR: se escribe por RPC y el motor de
--     sync no lo ve.
--
-- Y una decisión de privilegios, deliberada y contraria al convenio de la casa:
-- **estas tablas no conceden NADA a `anon`/`authenticated`**. El convenio del
-- proyecto es "SELECT es el único privilegio de la API" (el pull lee por REST),
-- pero aquí no hay pull: el acceso es siempre por RPC `security definer`, que
-- devuelve la proyección ya filtrada. Sin grants, no hay política de fila que un
-- error futuro pueda dejar demasiado abierta: no hay fila alcanzable.
--
-- (Las tablas nacen con SELECT por el ACL por defecto que dejó la migración 14,
-- así que el `revoke` de abajo NO es decorativo: sin él, `friendships` sería
-- legible por REST con la única defensa de una política.)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Amistades y solicitudes (una fila por pareja) ─────────────────────────
create table if not exists public.friendships (
  user_low     uuid not null references auth.users(id) on delete cascade,
  user_high    uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending',   -- 'pending' | 'accepted'
  message      text not null default '',          -- saludo, ≤ 200 chars (RPC)
  created_at   bigint not null default 0,
  responded_at bigint,
  updated_at   bigint not null default 0,
  primary key (user_low, user_high),
  constraint friendships_order check (user_low < user_high),
  constraint friendships_requester_in_pair check (requested_by in (user_low, user_high))
);

-- La PK cubre las búsquedas por `user_low`; el otro lado necesita su índice.
create index if not exists idx_friendships_high
  on public.friendships (user_high);
-- El badge de solicitudes y la lista de amigos filtran por estado.
create index if not exists idx_friendships_high_status
  on public.friendships (user_high, status);

-- ── Bloqueos (dirigidos, sin amistad) ─────────────────────────────────────
create table if not exists public.friend_blocks (
  blocker    uuid not null references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null default 0,
  primary key (blocker, blocked)
);

create index if not exists idx_friend_blocks_blocked
  on public.friend_blocks (blocked);

-- ── Consentimiento por ámbito ─────────────────────────────────────────────
-- Defaults (decisión de producto 2026-09-12): la identidad mínima se comparte
-- al aceptar (es lo que hace reconocible una lista de amigos); estadísticas y
-- armario NO se comparten nunca solos.
create table if not exists public.profile_visibility (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  share_profile  boolean not null default true,
  share_stats    boolean not null default false,
  share_locker   boolean not null default false,
  allow_requests boolean not null default true,
  updated_at     bigint not null default 0
);

-- ── Límite de ritmo (ventana fija por actor y acción) ─────────────────────
create table if not exists public.friend_rate_limits (
  actor        uuid not null references auth.users(id) on delete cascade,
  action       text not null,      -- 'request' | 'photo_urls' | …
  window_start bigint not null,    -- inicio de la ventana, en ms
  count        int not null default 0,
  primary key (actor, action, window_start)
);

-- Limpieza de ventanas viejas: se apoya en el mismo criterio que la retención
-- de tombstones (pendiente de mover a `pg_cron`, auditoría P5).
create index if not exists idx_friend_rate_limits_window
  on public.friend_rate_limits (window_start);

-- ═══════════════════════════════════════════════════════════════════════════
-- `are_friends` — el predicado de la fase.
--
-- NO se concede a `authenticated`: con EXECUTE público es un oráculo ("¿X y Y
-- son amigos?" sobre pares ajenos). Es un helper INTERNO de las funciones que
-- lo llaman, y todas ellas son `security definer` y comparan siempre contra
-- `auth.uid()`.
--
-- Devuelve false si hay un bloqueo en CUALQUIER dirección: bloquear corta la
-- amistad por los dos lados sin necesidad de una segunda comprobación.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null
     and b is not null
     and a <> b
     and exists (
       select 1 from public.friendships f
       where f.status = 'accepted'
         and f.user_low  = least(a, b)
         and f.user_high = greatest(a, b)
     )
     and not exists (
       select 1 from public.friend_blocks bl
       where (bl.blocker = a and bl.blocked = b)
          or (bl.blocker = b and bl.blocked = a)
     );
$$;

revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security + privilegios.
--
-- RLS se activa en las cuatro aunque no haya grants: es la segunda capa, y las
-- políticas documentan la intención (`friend_rate_limits` no tiene política
-- alguna — deny total, es maquinaria interna).
--
-- Políticas SOLO de lectura: la escritura no se concede a ningún rol de API,
-- porque toda mutación pasa por las RPC de la migración 18. Si algún día
-- alguien añadiera un `grant`, seguiría leyendo únicamente lo suyo.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.friendships        enable row level security;
alter table public.friend_blocks      enable row level security;
alter table public.profile_visibility enable row level security;
alter table public.friend_rate_limits enable row level security;

drop policy if exists "friendships_participant_select" on public.friendships;
create policy "friendships_participant_select" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_low, user_high));

drop policy if exists "friend_blocks_blocker_select" on public.friend_blocks;
create policy "friend_blocks_blocker_select" on public.friend_blocks
  for select to authenticated
  -- Solo el que bloquea ve su lista. El bloqueado no recibe acuse: es lo que
  -- espera quien bloquea por seguridad.
  using (blocker = (select auth.uid()));

drop policy if exists "profile_visibility_owner_select" on public.profile_visibility;
create policy "profile_visibility_owner_select" on public.profile_visibility
  for select to authenticated
  using (user_id = (select auth.uid()));

-- `friend_rate_limits`: sin política → nadie por REST, ni leyendo.

-- ── Privilegios: cero para los roles de API ───────────────────────────────
-- El `revoke` es imprescindible: estas tablas nacieron con el SELECT que el ACL
-- por defecto de la migración 14 concede a `anon`/`authenticated`.
revoke all on public.friendships, public.friend_blocks,
  public.profile_visibility, public.friend_rate_limits
from anon, authenticated;

-- `service_role` (mantenimiento, soporte, borrado de cuenta) sí conserva todo.
grant all on public.friendships, public.friend_blocks,
  public.profile_visibility, public.friend_rate_limits
to service_role;

notify pgrst, 'reload schema';
