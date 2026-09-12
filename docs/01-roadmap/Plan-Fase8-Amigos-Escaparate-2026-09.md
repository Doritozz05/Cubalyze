# Plan — Fase 8: amigos, perfil de amigo y escaparate

> Estado: **F8.0–F8.3 implementadas y validadas contra la nube** (2026-09-12),
> **sin aplicar**: migraciones 16–18 y el cliente de identidad. **Falta toda la
> UI** (§9, F8.4–F8.8). Rama `feat/fase8-friends`, creada desde `main` justo
> después del squash-merge de la Fase 6 (`b5749aef`).
>
> Ejecución, hallazgos y residuales: **§14**.
>
> Continúa [Plan-Fase6-Sync-Locker-2026-09.md](./Plan-Fase6-Sync-Locker-2026-09.md)
> §6 (compatibilidad ya preparada) y
> [../10-security/Auditoria-2026-09-12.md](../10-security/Auditoria-2026-09-12.md)
> §7·P3 (la unicidad de `handle` es **prerrequisito** de esta fase).
>
> Alcance: **agregar amigos, gestionarlos, ver su perfil y ver su escaparate**.
> Fuera: daily scramble, retos, carreras y chat (§13, con los ganchos que deja
> puestos este diseño).

---

## 1. Qué es la Fase 8 y por qué ahora

La Fase 6 puso el Locker en la nube: categorías, tipos, ítems y fotos ya viven en
Supabase con RLS de propietario. **Hasta ahí, toda la nube es un espejo de lo
tuyo**: no existe en el esquema ni una sola consulta por la que un usuario lea
datos de otro. La Fase 8 es la primera vez que el sistema abre lectura ajena, y
por eso es la fase **más delicada de la historia del proyecto**: un error de
permisos aquí no corrompe datos, los **expone**.

El roadmap la llama "estante público", pero el producto que se ha pedido es más
estricto y más seguro: **solo tus amigos ven tu armario**. Nada es visible para
un desconocido. Eso convierte el diseño en un problema de *consentimiento y
proyección* más que de pantallas.

Las tres cosas que la hacen viable hoy y no hace un mes:

1. **El servidor ya tiene la colección** (Fase 6). Sin datos en la nube no hay
   nada que enseñar, y por eso esta fase *depende* de la anterior.
2. **La Fase 6 no cerró ninguna puerta**: las políticas son de propietario y por
   comando, así que añadir una vía de lectura para amigos es **aditivo** — las
   políticas permisivas se OR-ean, no se sustituyen. El bucket sigue privado y
   las columnas sensibles (`serial`, `smart_id`) siguen en la fila base.
3. **La auditoría dejó identificado el bloqueante** (M1): `profiles.handle` no
   tiene unicidad. En un estante social, eso es suplantación trivial.

---

## 2. Alcance

### Dentro de la fase

| # | Capacidad | Notas |
|---|---|---|
| 1 | Buscar a alguien por `handle` y **enviar solicitud** (con mensaje opcional) | Búsqueda exacta, nunca por prefijo |
| 2 | **Aceptar / rechazar** solicitudes entrantes y **cancelar** las enviadas | |
| 3 | **Sección de Amigos**: lista, solicitudes pendientes, badge en el nav | |
| 4 | **Ver perfil** de un amigo: identidad + stats agregadas | Solo agregados, nunca solves crudos |
| 5 | **Ver su escaparate**: su Locker en modo lectura, con las fotos que comparte | Columnas en lista blanca |
| 6 | **Gestionar**: eliminar amigo, bloquear, desbloquear | Borrar es asimétrico y silencioso |
| 7 | **Privacidad**: opt-in explícito por ámbito (perfil / stats / Locker) | Nada compartido por defecto |
| 8 | **Endurecimiento**: RPC, rate limiting, anti-enumeración, URLs firmadas | §6 |

### Fuera (y por qué)

- **Daily scramble, retos, carreras 1v1, rankings**: §13. Necesitan presencia,
  tiempo real y un modelo de resultado que no existe; meterlos aquí
  multiplicaría la superficie antes de tener la base cerrada.
- **Chat / mensajes**: es un producto entero (moderación, notificaciones,
  almacenamiento). El mensaje de la solicitud es texto de una línea, no un chat.
- **Escaparate público** (visible para cualquiera con un enlace): el pedido es
  "solo amigos". La arquitectura lo permitiría después como una proyección más,
  pero cambiaría el régimen de privacidad y merece su propia fase.
- **Comentarios, likes, "vitrina de la semana"**: social por encima de lo
  social; primero que ver y quién ve.

---

## 3. Lo que ya está decidido (heredado de la Fase 6)

No hay que volver a discutirlo; el diseño de la 6 lo dejó cerrado:

- **Compartir es por proyección, no por fila.** La Fase 8 **no** concede `SELECT`
  sobre `gear_items` a nadie. Expone funciones que devuelven un JSON con una
  lista blanca de campos. `serial` y `smart_id` nunca salen de la fila base.
- **El bucket nunca se hace público.** Las fotos se sirven con URLs firmadas de
  vida corta.
- **Los índices que la proyección necesita ya existen**: `idx_gear_items_user_category`,
  `idx_gear_items_user_type`, `idx_gear_types_user_category`.
- **El chequeo de integridad es genérico por tabla**, así que la Fase 8 puede
  reutilizarlo como "estado del escaparate de un amigo" sin duplicar consultas.

---

## 4. Modelo de datos

Cuatro tablas nuevas. Todas `enable row level security`, todas **sin grants** a
`anon`/`authenticated` (§6.1): solo se tocan a través de RPC `security definer`.

### 4.1 `public.friendships` — una fila por par, con **orden canónico**

```sql
create table if not exists public.friendships (
  user_low     uuid not null references auth.users(id) on delete cascade,
  user_high    uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending',   -- 'pending' | 'accepted'
  message      text not null default '',          -- saludo opcional, ≤ 200 chars
  created_at   bigint not null default 0,
  responded_at bigint,
  updated_at   bigint not null default 0,
  primary key (user_low, user_high),
  constraint friendships_order check (user_low < user_high),
  constraint friendships_requester_in_pair check (requested_by in (user_low, user_high))
);
create index if not exists idx_friendships_high on public.friendships (user_high);
```

**Por qué el par canónico** (`least(a,b)` / `greatest(a,b)`) en vez de la forma
clásica de dos filas espejo:

- La simetría **es una propiedad de la fila**, no un acuerdo entre dos filas que
  pueden desincronizarse. El bug clásico ("amistad aceptada en un sentido" o una
  fila huérfana al borrar) desaparece por construcción: aceptar es **un**
  `UPDATE`, no una danza de dos escrituras que puede quedar a medias.
- `check (user_low < user_high)` hace imposible el par duplicado invertido a
  nivel de motor, no de aplicación.
- `requested_by` distingue "enviada" de "recibida" **dentro** de la fila, así que
  la UI sabe qué mostrar sin una segunda tabla.

**Decisiones derivadas**:

- **Solicitud cruzada = auto-aceptar** (D1, **decidido: sí**): si B envía
  solicitud mientras A tiene una pendiente hacia B, la intención es mutua y la
  fila pasa a `accepted` en la misma transacción, con `requested_by` intacto para
  el histórico. No hay estado intermedio ni dos filas que comparar.
- **Caducidad** (D2, abierto): una pendiente sin respuesta en 30 días se
  descarta (perezosamente al leer, o por `pg_cron`, ver §12·D5).

### 4.2 `public.friend_blocks` — dirigido y persistente

```sql
create table if not exists public.friend_blocks (
  blocker    uuid not null references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null default 0,
  primary key (blocker, blocked)
);
create index if not exists idx_friend_blocks_blocked on public.friend_blocks (blocked);
```

**Por qué una tabla aparte y no un `status = 'blocked'` en `friendships`:** el
bloqueo es **asimétrico** y debe sobrevivir **sin** amistad. Meterlo en la fila
simétrica obligaría a elegir arbitrariamente quién es `user_low` para representar
un hecho dirigido, y una amistad borrada se llevaría el bloqueo por delante —
dejando que la persona bloqueada vuelva a solicitar. Separado, la semántica es
clara: *el bloqueo es del que bloquea, la amistad es de los dos*.

Semántica completa:

- Bloquear **elimina** cualquier amistad o solicitud del par y, desde entonces,
  `friend_request_send` hacia el blocker devuelve el mismo error genérico que un
  handle inexistente: **quien bloquea no aparece** (sin acuse, que es lo que
  espera quien bloquea por seguridad).
- El bloqueado **no ve** al blocker ni en su lista ni en búsqueda.
- Desbloquear **no restaura** la amistad (D3, **decidido: no**): el bloqueo es
  una puerta de un solo sentido y volver a ser amigos exige una solicitud nueva.

### 4.3 `public.profile_visibility` — el consentimiento, fuera de `profiles`

```sql
create table if not exists public.profile_visibility (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  share_profile  boolean not null default true,   -- identidad: se comparte al aceptar
  share_stats    boolean not null default false,
  share_locker   boolean not null default false,
  allow_requests boolean not null default true,   -- admitir solicitudes nuevas
  updated_at     bigint not null default 0
);
```

**Por qué NO son columnas de `profiles`** — y esto es lo importante, no un
capricho de normalización: `profiles` **se escribe desde el dispositivo** a
través del bloque de `sync_apply`, cuyo `on conflict do update set` enumera las
columnas (`display_name`, `handle`, `bio`, `avatar_kind`, …). Cualquier columna
nueva que no esté en esa lista se queda con el valor recibido… y si la añadiéramos
a la lista, el `sync_apply` la **sobrescribiría con lo que diga el payload local**
en cada push de un cliente antiguo (que no conoce el flag y enviaría su default).
Es decir: un dispositivo viejo apagaría tu consentimiento, o un payload manipulado
lo encendería. La visibilidad es **estado de servidor**, se escribe por RPC y el
motor de sync no la ve. Tabla aparte, y el problema no existe.

Defaults (D4, **decidido**): `share_profile = true` — la identidad mínima es lo
que se muestra al aceptar y es lo que hace reconocible una lista de amigos —,
`share_stats = false`, `share_locker = false`. **El armario y las estadísticas no
se comparten nunca solos**; el perfil sí, y quien quiera cerrarlo también puede.

### 4.4 `handle`: unicidad, reserva y el único cambio en `sync_apply`

Es el prerrequisito de la auditoría (M1/P3) y hay que hacerlo bien porque el
arreglo obvio rompe el sync:

```sql
-- Parcial: las filas SIN handle (todas las actuales) no colisionan entre sí.
create unique index if not exists uq_profiles_handle
  on public.profiles (lower(handle))
  where handle <> '';
```

Un `unique` a secas **colgaría el sync por dos motivos distintos**: (a) no se
podría ni crear si dos filas comparten `handle = ''` — que es el default de la
columna y lo que inserta el trigger de alta, así que toda fila que no haya
reclamado uno colisionaría con las demás; y (b) después, un `unique_violation`
dentro de `sync_apply` revertiría **el lote entero**, el watermark no avanzaría y
el usuario quedaría atascado para siempre — exactamente el antipatrón ya
documentado para `gear_items.smart_id`.

**El patrón parcial es la pieza que lo hace viable**, y el ciclo completo es:

1. **Reserva en el cliente antes de publicar** (`handle_claim(text)`): normaliza
   (a-z, 0-9, `_`, 3-20), comprueba y devuelve `{ok:true}` o
   `{ok:false, reason:'taken'|'invalid'|'reserved', suggestion:'...'}`.
   Se apoya en el índice único para ser atómica; no hay "check-then-set".
2. ~~**`sync_apply` tolera el conflicto en vez de morir** con un savepoint y un
   contador `handle_conflicts` nuevo en la respuesta.~~
   **Cambiado (F8.0, ver §14.2).** La protección es un **trigger `BEFORE INSERT
   OR UPDATE`** (`profiles_protect_handle`) que reescribe `NEW.handle`: nunca
   vacía un handle almacenado (regla A) y nunca roba el de otra cuenta (regla B).
   Un trigger `BEFORE` que reescribe `NEW` **no puede lanzar**, así que ningún
   conflicto de identidad puede tumbar un lote de `sync_apply` — y protege a
   *todos* los escritores (el RPC, PostgREST y `service_role`), no solo al que
   pasa por el savepoint. `sync_apply` no cambia ni una línea.
3. **El cliente adopta el sello del servidor** (`claimHandle`, §14.3):
   `handle_claim` devuelve `updated_at` y el cliente escribe su fila local con
   ESE sello, no con uno propio. Reclamar un handle no es un error de sync ni
   una tarea de UI diferida: es una operación del motor, y su resultado se
   propaga como cualquier otro cambio (el pull lo confirma).
4. **Migración de los usuarios existentes**: medido contra la nube hoy
   (`select count(*) … from profiles`) — **2 perfiles, 1 con handle, 0
   duplicados**, así que el índice se puede crear **sin limpieza previa** y hay
   un handle que respetar. Los que están en `''` quedan fuera del índice parcial
   hasta que lo reclamen. El primer arranque con la fase activa ofrece elegir
   handle (con sugerencia derivada del nombre); sin handle **no** se puede
   enviar ni recibir solicitudes, pero **todo lo demás de la app sigue
   funcionando igual**. No hay migración forzosa ni pantalla bloqueante.

Nota de implementación: el subbloque de excepción solo se usa en la fila cuyo
handle cambia; el camino normal no paga el savepoint.

### 4.5 `public.friend_rate_limits` — el freno anti-abuso

```sql
create table if not exists public.friend_rate_limits (
  actor      uuid not null references auth.users(id) on delete cascade,
  action     text not null,        -- 'request' | 'search' | 'photo_urls'
  window_start bigint not null,
  count      int not null default 0,
  primary key (actor, action, window_start)
);
```

Ventana fija por hora/día. La retención NO espera a `pg_cron` (auditoría P5):
cada consumo borra sus propias ventanas de más de 7 días usando el prefijo
`actor` de la PK, así que la tabla no crece sin fin sin depender de un job.
Los límites concretos son decisión de producto (§12·D5); arranque propuesto:
**20 solicitudes/día**, **30 intentos de handle/hora + 200/día**, **30 firmas de
URL por minuto** (el cliente firma la página entera en UNA llamada, así que 30
sobran), **200 amigos máximo**. Al superarse, error tipado `rate_limited` (la UI
lo dice sin drama).

### 4.6 `are_friends` y las proyecciones

```sql
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and f.user_low  = least(a, b)
      and f.user_high = greatest(a, b)
  )
  and not exists (select 1 from public.friend_blocks bl
                  where (bl.blocker = a and bl.blocked = b)
                     or (bl.blocker = b and bl.blocked = a));
$$;

revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
```

**`are_friends` NO se concede a `authenticated`.** Es un oráculo: con ejecución
pública, cualquiera podría preguntar "¿X es amigo de Y?" sobre pares ajenos. Se
queda como helper interno de las funciones que la llaman (que son `security
definer` y **siempre** comparan contra `auth.uid()`).

Las tres proyecciones (§5) siguen el mismo molde:

```sql
create function public.friend_locker(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not public.are_friends(me, p_user) then
    return jsonb_build_object('ok', false, 'reason', 'not_friends');   -- sin filtrar por qué
  end if;
  if not coalesce((select share_locker from public.profile_visibility where user_id = p_user), false) then
    return jsonb_build_object('ok', false, 'reason', 'not_shared');
  end if;
  return jsonb_build_object('ok', true, 'locker', /* … lista blanca … */);
end $$;
revoke all on function public.friend_locker(uuid) from public, anon;
grant execute on function public.friend_locker(uuid) to authenticated;
```

Detalle deliberado: **`not_friends` y `not_shared` son respuestas distintas pero
ninguna revela datos**. La primera evita que un desconocido deduzca "existe y
tiene algo"; la segunda es información que el amigo ya tiene (que el ámbito está
cerrado) y es la que permite mostrar "no comparte su Locker".

### 4.7 Índices

`friendships` se consulta por ambos lados (`user_low = me` usa la PK; `user_high =
me` necesita `idx_friendships_high`). `friend_blocks` igual por `blocker` (PK) y
`blocked`. Las proyecciones de Locker se apoyan en los índices
`(user_id, category_id)` / `(user_id, type_id)` que la Fase 6 ya creó.

---

## 5. Privacidad: exactamente qué se comparte

Esta tabla es el contrato de la fase. Lo que no está aquí, no sale.

### Las DOS proyecciones de perfil (rework 2026-09-12, auditoría A2/N1)

El contrato tiene dos formas, no una, y cada camino usa la suya. Antes había una
sola (`friend_profile_json`) y `share_profile` se ignoraba en todas partes menos
en `friend_profile`: el interruptor apagado no cambiaba nada en la práctica.

| Proyección | Campos | Quién la recibe |
|---|---|---|
| `friend_profile_min_json` (identidad) | `user_id`, `display_name`, `handle`, `avatar_kind` | Solicitudes pendientes (entrantes y salientes), lista de bloqueados, `friend_request_send.target`, y la lista de amigos de quien tiene el perfil cerrado |
| `friend_profile_json` (extendida) | identidad + `bio`, `avatar_data`, `main_puzzle`, `declared_methods`, `country`, `created_at` | Amigos, y solo si su dueño comparte perfil |
| `friend_visible_profile_json` | la que toque según `share_profile` | La lista de amigos (una sola puerta, para que no haya dos respuestas) |

**Por qué el avatar en base64 NO viaja a una solicitud:** `avatar_data` puede ser
una foto subida, no una semilla. La tarjeta pinta el CubeMark derivado de
`user_id`, así que reconocer a alguien no cuesta bytes privados. Y
`friend_stats` ya no lleva `owner`: repetir ahí el perfil era una segunda puerta
que solo exigía `share_stats`.

### Perfil (`friend_profile`, requiere amistad + `share_profile`)

`display_name`, `handle`, `bio`, `avatar_kind`, `avatar_data`, `main_puzzle`,
`declared_methods`, `country`, `created_at`.

`bio` es texto que el usuario escribe para que lo lean: se comparte. `avatar_data`
es la foto base64 cuando `avatar_kind = 'photo'` (y la semilla del identicon
cuando no lo es).

### Locker (`friend_locker`, requiere amistad + `share_locker`)

| Se comparte | Se retiene |
|---|---|
| `id`, `category_id`, `type_id`, `name`, `brand`, `model`, `finish`, `palette`, `status`, `condition`, `tags`, `is_primary`, `is_favorite`, `rating`, `quantity`, `acquired_at`, `photos` (**referencias**, no URLs) | `serial` (número impreso), `smart_id` (dirección Bluetooth), `price_amount`, `price_currency`, `notes` (texto libre: puede llevar nombres, direcciones de tienda, números de pedido), `links`, y `user_id` |

Además: **los ítems `is_demo = 1` se excluyen** (un Locker sembrado de demo no es
un armario real), igual que las categorías/tipos demo que los contengan.

Sobre las categorías y tipos: `id`, `name`, `kind`, `icon`, `accent` y
(`puzzle_category` en tipos). Son taxonomía, no datos personales.

### Stats (`friend_stats`, requiere amistad + `share_stats`)

Por rompecabezas: `count`, `best`, `worst`, `ao5`, `ao12`, `mean`,
`totalTimeMs`, `bestSingleAt`. Globales: `streakDays`, `lastActiveAt`,
`totalSolveTimeMs`, `solvesCount`. Y **nada más**: ni un solve individual, ni
scrambles, ni `note`, ni `moves`, ni `analysis`, ni `orientation_timeline`.

**Riesgo real de esta sección (R1):** las stats agregadas son una **segunda
implementación** de las mismas fórmulas que el cliente ya tiene en
`computeStats` (`@cubeforge/statistics`). Si las dos divergen, el amigo ve un PB
que tú no ves — y eso se percibe como que la app miente. Mitigación:
(a) escribir las fórmulas una vez en el plan y usarlas como especificación,
(b) un **test de paridad** que compare el agregado de SQL contra `computeStats`
sobre el mismo conjunto de solves, (c) excluir `is_demo` en ambos lados y tratar
`+2`/`DNF` con la misma regla (`effectiveTime`).

### El JSON exacto de cada proyección (y lo que nunca aparece)

**Ninguna respuesta contiene filas de `solves`.** No existe ningún campo
`solves` con un array de solves en ninguna de las tres funciones. Ésa es la
respuesta corta a "¿se muestra toda la base de datos de solves?": **no, ni una
fila**. Lo que viaja son agregados calculados en SQL, y literalmente esto:

```jsonc
// friend_stats(owner) — sin `owner`: la identidad viaja en el directorio y en el
// perfil, y repetirla aquí era una segunda puerta al perfil extendido que
// `share_stats` no protege.
{
  "ok": true,
  "overall": { "solves": 4210, "totalTimeMs": 51230000,
               "streakDays": 12, "lastActiveAt": 1757600000000 },
  "byPuzzle": [
    { "puzzle": "333", "count": 3120, "best": 8320, "worst": 45010,
      "ao5": 12450, "ao12": 13110, "mean": 14980,
      "totalTimeMs": 42000000, "bestAt": 1756999000000 },
    { "puzzle": "222", "count": 640, "best": 2140, "worst": 9810, ... }
  ],
  "heatmap": [0, 3, 5, 0, 8, ...]   // 365 conteos DIARIOS; ni un tiempo
}
```

Y lo que **no** está en esa respuesta, aunque exista en la tabla: `scramble`,
`note`, `moves`, `orientation_timeline`, `analysis`, `cube_id`, `session_id` y,
por supuesto, los `id` de solve. Un amigo no puede enumerar tus solves; no hay
por donde pedirlos.

```jsonc
// friend_locker(owner) — páginas de 60 ítems
{
  "ok": true,
  "categories": [ { "id": "cat_cubes", "name": "Cubes", "kind": "cube",
                    "icon": "Box", "accent": "#7c5cff" } ],
  "types":      [ { "id": "t_333", "category_id": "cat_cubes",
                    "name": "3x3", "puzzle_category": "333" } ],
  "items": [
    { "id": "it_gan12", "category_id": "cat_cubes", "type_id": "t_333",
      "name": "GAN 12 Maglev", "brand": "GAN", "model": "12 Maglev",
      "finish": "UV", "palette": ["#f43b2f", "#ffffff", ...],
      "status": "owned", "condition": "good",
      "tags": ["main", "magnetic"], "is_primary": 1, "is_favorite": 1,
      "rating": 9.5, "quantity": 1, "acquired_at": "2024-03-11",
      "photos": [ { "id": "p_1", "width": 1280, "height": 1280,
                    "addedAt": 1710000000000 } ] }
  ],
  "nextCursor": "cat_cubes|it_zhanchi"
}
```

`photos` son **referencias** (`GearPhotoRef`, el mismo tipo que ya viaja en la
colección local), no URLs. La ruta se deriva de la convención del bucket
(`{owner}/{itemId}/{photoId}/{full|thumb}.jpg`) y **la URL firmada no viene de
aquí**: el cliente la pide a la función de borde, en lote, solo para las fotos
que están de verdad en pantalla (§6.3). Es lo que impide que abrir un perfil
dispare 1 200 firmas de una colección con muchas fotos.

```jsonc
// friend_profile(owner)
{
  "ok": true,
  "profile": { "display_name": "Javi", "handle": "dorito", "bio": "…",
               "avatar_kind": "identicon", "avatar_data": "…",
               "main_puzzle": "333", "declared_methods": ["CFOP", "Roux"],
               "country": "ES", "created_at": 1690000000000 },
  "visibility": { "stats": true, "locker": false }   // para pintar las pestañas
}
```

Y la regla que cierra el tema en una línea: **el escaparate enseña el armario,
no el historial.** Un cubo, una foto y una etiqueta son identidad; un solve con
su scramble, su nota y sus tiempos es la vida de alguien.

---

## 6. Seguridad

### 6.1 La superficie son RPC, no tablas

Las cuatro tablas nuevas se crean con RLS activo y **sin ningún grant** a `anon`
ni a `authenticated`. Consecuencia buscada: aunque la API REST esté expuesta, no
hay ninguna ruta por la que un cliente lea `friendships`, `friend_blocks`,
`profile_visibility` o `friend_rate_limits`. Se entra **solo** por RPC
`security definer`, que es donde vive cada regla.

Esto se aparta del convenio de la casa ("`SELECT` es el único privilegio de los
roles de API") y es deliberado: `SELECT` sobre `friendships` obligaría a una
política de fila correcta, y la UI necesita **además** el perfil del otro lado
joinado. Una función devuelve lo que hay que ver, ya proyectado, con una sola
regla que auditar.

### 6.2 La superficie completa de escritura

Todas `security definer`, `set search_path = public`, `auth.uid()` obligatorio,
y con estas validaciones:

| RPC | Valida |
|---|---|
| `handle_claim(p_handle)` | formato, longitud, reservado, **doble freno de intentos** (30/hora + 200/día: sin él `taken` era un oráculo de existencia a coste cero), unicidad atómica. Vive en la migración 18, no en la 16: necesita `friend_rate_check`, y llamarlo desde la 16 sería una referencia hacia delante |
| `friend_request_send(p_handle, p_message)` | handle exacto, no a sí mismo, `allow_requests` del destinatario, no bloqueo en ningún sentido, no amistad ya existente, rate limit, auto-aceptar si hay solicitud inversa (D1) |
| `friend_request_accept(p_other)` | existe fila `pending`, `requested_by <> me` |
| `friend_request_decline(p_other)` | existe fila `pending`, `requested_by <> me`; **borra la fila** (rechazar no deja rastro) |
| `friend_request_cancel(p_other)` | existe fila `pending`, `requested_by = me` |
| `friend_remove(p_other)` | existe amistad `accepted`; borra la fila; **no notifica** al otro (D6, decidido) |
| `friend_block(p_other)` | no a sí mismo, existe la cuenta (`not_found` en vez del 500 de la FK); inserta bloqueo **y** borra amistad/solicitud del par en la misma transacción |
| `friend_unblock(p_other)` | existe bloqueo; solo borra el bloqueo (D3) |
| `privacy_set(...)` | booleans; `updated_at` |

Lecturas: `friend_list()` (aceptados + entrantes + salientes con la proyección de
perfil de cada uno y el `pending` count para el badge), `friend_profile`,
`friend_locker`, `friend_stats`, `privacy_get()`, `handle_claim` como
comprobación de disponibilidad.

### 6.3 Fotos: función de borde, no política de Storage

El bucket `locker-photos` tiene hoy políticas de propietario por carpeta
(`(storage.foldername(name))[1] = auth.uid()::text`). La tentación es añadir una
política `select` de amistad; **se descarta** por cuatro razones concretas:

1. Conceder `SELECT` sobre la carpeta del amigo permite **listar** sus objetos:
   el cliente podría enumerar todos los `photo_id` de su colección aunque no se
   los pidiéramos.
2. La política evaluaría `are_friends()` **por objeto**, dentro del motor de
   Storage, en cada comprobación.
3. No habría forma de acotar la **cuántas** ni de frenar a un cliente que pida
   miles de URLs.
4. El TTL y el revalidado no se podrían centralizar (una URL firmada ya emitida
   sobrevive a que dejes de ser amigo hasta que caduque).

En su lugar: **Edge Function `friend-photo-urls`**, ya en producción el patrón de
Función de borde con `delete-account`:

- valida el JWT del llamante (nunca `service_role` en el cliente),
- comprueba amistad + `share_locker` **para el dueño solicitado**,
- emite URLs firmadas **de un lote** de rutas (tope por llamada, p. ej. 60) con
  **TTL 60 s**, aplicando el rate limit de `photo_urls`,
- devuelve `{ url, expiresAt }` por ruta, y el cliente cachea por
  `(owner, item, photo)` revalidando antes de que caduque.

El bucket sigue privado y sigue sin tener ni una política para amigos.

### 6.4 Anti-enumeración y anti-abuso

- **Búsqueda por handle exacto**, nunca por prefijo ni por nombre. Un "buscar
  amigos" que devuelve listas es un directorio de usuarios, y eso no es lo que se
  ha pedido.
- **Respuesta uniforme**: `friend_request_send` a un handle inexistente y a uno
  bloqueado devuelven **el mismo** resultado. No hay acuse de bloqueo.
- **Rate limit** por actor y acción (§4.5), con error tipado.
- **Residual aceptado (R2)**: que un handle exista es, por definición, deducible
  al añadir a alguien. Lo que se evita es automatizarlo (exacto + límite de
  intentos) y que sirva para saber *más* que la existencia.
- **Tamaño de payload**: `friend_locker` de una colección grande se pagina
  (cursor por `(category_id, id)`), porque un amigo con 400 ítems y 1 200 fotos
  no debe llegar en una sola respuesta.

### 6.5 Lo que NO se toca (y por qué)

- **`sync_apply` solo cambia en el handle** (§4.4). El escaparate es una
  proyección, no una tabla sincronizada.
- **El pull no cambia.** No hay datos de amigos en el motor LWW.
- **`delete-account`** ya purga Storage; al borrar la cuenta, las FKs
  `on delete cascade` se llevan amistades, bloqueos y visibilidad. Hay que
  **verificar** que la purga de fotos sigue ocurriendo antes o después del
  cascade (hoy purga por prefijo `${uid}/`, no depende de las tablas).

### 6.6 Dos deudas de la auditoría que conviene cerrar aquí

- **P2 (CSP)**: `connect-src 'self' https: wss:` es demasiado amplio. Una fase
  que introduce lectura de datos de otras personas sube el coste de un XSS;
  acotar `connect-src` al origen de Supabase (y `wss:` si algún día hay realtime)
  es el momento.
- **P1 (sondeo adaptativo)**: ver el escaparate de un amigo invita a dejar la
  pestaña abierta, y el poller actual hace un ciclo completo cada 45 s sin
  backoff. Ya es el riesgo operativo más alto; con tráfico social lo es más.

---

## 7. Cómo encaja con el local-first

Regla de la fase, en una línea: **los datos de amigos son estado de servidor y
viven en memoria, nunca en la SQLite local.**

Por qué no materializar el Locker ajeno en la base local:

- El motor de pull asume `user_id = auth.uid()` en cada mapper y cada cursor; una
  fila ajena rompería los watermarks y el chequeo de integridad.
- `wipeLocal()` / el flujo de "empezar de cero" tendría que razonar sobre filas
  que no son del usuario.
- Los `id` de gear son `TEXT` libres: **nada impide** que el ítem de un amigo
  colisione con uno tuyo (misma marca + misma categoría → mismo id derivado en
  su dispositivo). Guardarlos juntos exigiría reescribir claves locales.

Consecuencias de UX, que hay que aceptar y diseñar en vez de esconder:

- La sección de amigos **necesita red**. Sin conexión muestra la última lista
  cacheada (en memoria + un cache ligero de la lista, con TTL) y un aviso claro.
- El escaparate de un amigo **no** entra en el flujo offline; es una vista online.
- Tu Locker sigue siendo local-first y funcionando sin red, exactamente igual que
  hoy.

---

## 8. UI: sección de amigos, perfil y escaparate

Objetivo declarado: que sea **bonita**. La fase se gana o se pierde aquí, porque
el backend correcto no se ve.

### 8.0 El recorrido completo, de principio a fin

Así es la fase entera vista desde el usuario. Nueve pasos, y en cada uno lo que
ocurre por debajo:

1. **Reclamas tu handle** (Ajustes, o la primera vez que abres Amigos). Mientras
   no tengas uno, la sección social está apagada pero **todo lo demás de la app
   es idéntico**: tu Locker, tus stats y tu sync no dependen de esto.
   → `handle_claim('dorito')`.
2. **Decides qué compartes.** Ajustes → Privacidad: perfil (encendido),
   estadísticas (apagado), armario (apagado), admitir solicitudes (encendido).
   Con una **vista previa "así te ve un amigo"**, que es la mejor defensa contra
   la sensación de estar expuesto sin saberlo.
3. **Buscas a alguien y le envías una solicitud.** Escribes el handle exacto
   (`@ana`) → `friend_request_send` → la tarjeta dice "solicitud enviada". Si ella
   ya te había solicitado, **se acepta sola** (D1) y ninguno de los dos ve un
   paso extra.
4. **Ella acepta** (o la habéis enviado a la vez). La fila pasa a `accepted`.
5. **Sección Amigos.** Dos bloques: **Solicitudes** (entrantes con su mensaje y
   `Aceptar`/`Rechazar`; enviadas con `Cancelar`) y **Amigos**, con la rejilla de
   tarjetas. El **badge del nav** sale del mismo `friend_list()`, sin llamada
   extra.
6. **Abres su perfil.** Identidad (avatar, `@handle`, país, rompecabezas
   principal, métodos) y, **solo si comparte stats**, los agregados de §5. La
   pestaña **Escaparate** aparece siempre, pero con su estado explicado si el
   ámbito está cerrado: "Ana no comparte su armario" en lugar de una pestaña
   ausente.
7. **Ves su escaparate.** Sus cubos renderizados **en 3D real** con el mismo
   servicio que usa tu Locker (`cubeSnapshotService`), sus fotos por URL firmada
   en lote, agrupado por las mismas categorías y tipos que ya conoces. Sin un
   solo control de edición: en modo lectura, no un Locker ajeno con los botones
   desactivados.
8. **Gestionas.** Desde la tarjeta o el perfil: **eliminar amigo** (él no recibe
   aviso, simplemente deja de verte; D6) o **bloquear** (desaparece para los dos
   y no podrá volver a solicitar; desbloquear **no** restaura la amistad, D3).
9. **Y nada más.** No hay feed, ni chat, ni notificaciones. La fase hace cuatro
   cosas —añadir, gestionar, ver el perfil, ver el armario— y las hace bien.

El orden en que esto se construye está en §9: primero la identidad (`handle`),
luego el esquema y las funciones, y solo entonces la UI. La UI es la última capa
a propósito: pintar antes de cerrar el contrato de campos significa repintar.

### 8.1 Navegación

Nueva vista `friends` en `ViewId` (`apps/web/src/components/Layout/sidebar.constants.ts`)
con su entrada en `NAV_GROUPS` y etiqueta en el namespace `nav`, **con badge**
del número de solicitudes entrantes (el dato ya viaja en `friend_list()`, así que
el badge no necesita una llamada extra).

### 8.2 Pantalla 1 — Amigos

- Cabecera con contadores (amigos / pendientes) y un **campo de añadir por
  handle** con autocompletado *exacto* (sin sugerencias de otras personas).
- **Solicitudes**: entrantes (avatar, handle, mensaje, `Aceptar` / `Rechazar`) y
  enviadas (con `Cancelar`). Es la pantalla donde vive la acción.
- **Amigos**: rejilla de tarjetas — avatar/identicon, `display_name`, `@handle`,
  rompecabezas principal, país, y un pie con 3 mini-datos (mejor single, nº de
  solves, ítems compartidos si comparten Locker). La tarjeta entera abre el perfil.
- **Sin sesión**: la sección no desvía a Ajustes. Muestra el estado "los amigos
  viven en tu cuenta" con un botón **Continuar con Google** que arranca el OAuth
  desde aquí mismo, porque lo que el usuario ha venido a hacer (añadir a
  alguien) necesita cuenta y una cuenta es un clic.
- **Estado vacío**: "todavía no tienes amigos" con una ilustración y el
  formulario de añadir ya visible encima. Sin microcopy de relleno.
- **Menú por tarjeta**: ver perfil, eliminar amigo, bloquear (con confirmación y
  texto que explique que bloquear no avisa al otro).

### 8.3 Pantalla 2 — Perfil del amigo

Reutiliza lo que ya existe, que es mucho y bueno:

- `ProfileHero` + `StatStrip` (`components/Identity/`) para la identidad.
- La rejilla de stats con la misma tipografía que el perfil propio, pero con
  **solo agregados** (§5) y un distintivo "compartido por @handle" para que quede
  claro que es dato ajeno.
- `ActivityHeatmap` (o su equivalente agregado) para el mapa de actividad
  reciente, si `share_stats`.
- Una pestaña **Escaparate** (ver 8.4). Si el amigo no comparte, esa pestaña se
  muestra en su sitio con un estado de privacidad explicado, no oculta: ocultarla
  haría creer que no tiene nada.
- Acciones: eliminar amigo / bloquear, en un menú de la cabecera.

### 8.4 Pantalla 3 — El escaparate

Es la vista estrella de la fase. Reutiliza la infraestructura del Locker:

- **Rejilla** con `ItemCard` en modo lectura (sin edición, sin drag) y las mismas
  agrupaciones que el Locker propio: por categoría (con `CategoryTabs`) y con el
  árbol de tipos a la izquierda en escritorio.
- **Cubos en 3D reales**, no iconos: `cubeSnapshotService` (`LOCKER_CUBE_CAMERA`,
  renders serializados en una única instancia offscreen) ya resuelve esto; el
  escaparate usa exactamente el mismo servicio, así que el cubo del amigo se ve
  igual de bien que el tuyo.
- **Fotos** vía `PhotoImage` con URLs firmadas (§6.3): esqueletos mientras llegan
  y una única llamada al lote visible (no una por foto).
- **Chips** de estado/condición/tags y favoritos destacados. Lo que **no**
  aparece: precio, notas, serial, ningún enlace.
- Cabecera con el nombre del dueño, contadores por categoría y un conmutador
  "solo favoritos" / "todos".
- **Modo lectura de verdad**: ningún control de edición, y el detalle
  (`ItemDetailPanel`) en modo `readOnly` — hay que añadir el flag, hoy asume
  propiedad.

### 8.5 Privacidad, en Ajustes

Un bloque nuevo en la pantalla de Settings: tu handle (con reclamación si no lo
tienes) y qué compartes (`perfil`, `stats`, `Locker`), más quién puede solicitar
amistad. La lista de bloqueados vive en la sección de Amigos, junto al resto de
la gestión. Mientras hay una escritura en vuelo se muestra "Guardando…" y nada
más: no hay texto estático que prometa dónde viven los ajustes.

### 8.6 i18n y accesibilidad

- Namespace nuevo `friends` en `en.json` y `es.json`. El test
  `apps/web/src/i18n/index.test.ts` ("es.json mirrors the en.json key structure")
  ya obliga a la paridad, así que no hay que inventar la red de seguridad.
- Sin texto hardcodeado; `ParseKeys<'friends'>` para las claves tipadas.
- Accesibilidad: la tarjeta de amigo y la de ítem son accionables con teclado;
  los estados de privacidad no se comunican solo por color.

---

## 9. Plan por capas

Cada capa se puede mergear sola y deja la app funcionando.

| Capa | Entregable | Verificación |
|---|---|---|
| **F8.0** · Prerrequisito `handle` | Migración: índice único parcial; `handle_claim`; `handle_conflicts` en `sync_apply` (con savepoint); cliente que limpia y reasigna; UI de reclamación en Ajustes | Prueba contra Postgres real (rollback): dos claims del mismo handle, handle vacío repetido, conflicto dentro de `sync_apply` **no** aborta el lote y el watermark avanza |
| **F8.1** · Esquema social | `friendships`, `friend_blocks`, `profile_visibility`, `friend_rate_limits`, `are_friends`; RLS activo; **sin grants** | Inventario de grants en la nube: 0 privilegios para `anon`/`authenticated` en las 4 tablas |
| **F8.2** · RPC | Las 12 funciones de §6.2 + `friend_list`; rate limits; paginación del Locker | Matriz de seguridad §10 ejecutada en transacciones revertidas con dos usuarios reales |
| **F8.3** · Proyecciones | `friend_profile`, `friend_locker`, `friend_stats` con lista blanca | Test de contrato: **ningún** campo fuera de §5 aparece en el JSON; los ítems demo no salen |
| **F8.4** · Servicio cliente | Cliente tipado de las RPC, cache de lista con TTL, adaptadores al modelo de colección existente | Tests unitarios de adaptadores y de estados (offline, no compartido, no amigo) |
| **F8.5** · Fotos | Edge Function `friend-photo-urls` + cache con revalidación | Test de la función: sin amistad → 403; lote por encima del tope → rechazado; TTL correcto |
| **F8.6** · UI Amigos | Vista `friends`, badge, solicitudes, tarjetas, estados vacíos, i18n | Tests de componente + revisión visual en claro/oscuro y móvil |
| **F8.7** · UI Perfil + escaparate | Perfil de amigo, pestaña Escaparate, `ItemDetailPanel` en modo lectura, fotos firmadas | Paridad visual con el Locker propio; prueba real con dos cuentas |
| **F8.8** · Cierre | P2 (CSP) y P1 (sondeo adaptativo) de la auditoría; documentación; prueba a dos dispositivos | Las dos suites completas; `EXPLAIN` de las consultas del escaparate sin seq scans |

Orden obligatorio: **F8.0 antes que nada** (sin unicidad no se puede construir
identidad), y F8.1→F8.3 antes de cualquier UI, porque el contrato de campos debe
estar cerrado antes de pintarlo.

Estado a 2026-09-12: **F8.0 ✅, F8.1 ✅, F8.2 ✅ y F8.3 ✅** en el motor y en la
base de datos (migraciones `16`, `17` y `18`, validadas contra el Postgres real
en transacciones revertidas — §14.1). **F8.4–F8.8 pendientes**: nada de esto
tiene UI todavía, y por eso tampoco se ha aplicado a la nube (una migración sin
pantalla que la use solo añade superficie).

---

## 10. Pruebas

### Matriz de seguridad (contra Postgres real, en transacciones revertidas)

Dos usuarios reales (`A`, `B`) y un tercero (`C`), como se hizo en la Fase 6:

| # | Caso | Esperado |
|---|---|---|
| 1 | `C` llama `friend_locker(B)` | `not_friends`, **cero** datos |
| 2 | `A` y `B` amigos, `B.share_locker = false` | `not_shared`, cero datos |
| 3 | `A` y `B` amigos, `share_locker = true` | Locker sin `serial`, `smart_id`, precios, `notes`, `links` |
| 4 | `C` llama `are_friends(A, B)` | `permission denied` (no concedida) |
| 5 | `A` bloquea a `B`; `B` solicita | mismo resultado que handle inexistente; sin amistad creada |
| 6 | `A` bloquea a `B` (eran amigos) | la amistad desaparece para los dos; el escaparate deja de verse |
| 7 | `A` y `B` amigos; `A` elimina a `B` | el escaparate de `B` deja de verse; `B` no recibe aviso |
| 8 | Solicitud a sí mismo | rechazada |
| 9 | 21ª solicitud en el día | `rate_limited` |
| 10 | `A` y `B` se solicitan a la vez | **una** fila, auto-aceptada (D1) si se aprueba |
| 11 | `handle_claim` de un handle tomado | `taken` + sugerencia; **no** se modifica nada |
| 12 | `sync_apply` con handle en conflicto | `handle_conflicts = 1`, lote aplicado, watermark avanza |
| 13 | Paginación del Locker: 400 ítems | todas las páginas, sin duplicados ni huecos |
| 14 | `delete-account` | amistades, bloqueos y visibilidad desaparecen; fotos purgadas |
| 15 | `friend_request_send` a un handle **sin reclamar** | `not_found` (no distinguimos "no existe" de "existe sin identidad pública") |
| 16 | `handle_claim` de un handle que ya tiene otro titular | `taken` + sugerencia; su fila queda intacta (probado también a través de `sync_apply`) |
| 17 | Un dispositivo con el perfil local **más nuevo** que la nube abre la app | adopta el handle de la cuenta sin pisar sus campos ni su sello (§14.4) |

Cubierto hoy por las dos suites en vivo (`supabase/.freebuff/f82a-social.sql`,
`f82b-projections.sql`): 1–11, 13–17, más la matriz de grants y RLS. Pendiente
para F8.4–F8.8: 12 (ya no aplica: no hay `handle_conflicts`) y los casos que
necesitan la Edge Function de fotos y la UI.

### Pruebas de regresión

- **Paridad de stats** (R1): agregado SQL ≡ `computeStats` sobre el mismo conjunto.
- **Contrato de campos**: lista blanca de §5, con una prueba que falle el día que
  alguien añada una columna al JSON sin decidirla (mismo espíritu que el test de
  "claves del mapper vs columnas declaradas" de la Fase 6).
- **RLS por tabla**: `pg_policies` sin ningún `using (true)` y cero grants.
- **i18n**: paridad en/es automática por el test existente.
- **UI**: estados vacíos, no-amigo, no-compartido, offline, errores de rate limit.

---

## 11. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Las stats de la nube divergen de las locales | Fórmulas escritas una vez + test de paridad |
| R2 | Enumeración de usuarios | Handle exacto + rate limit (residual aceptado y documentado) |
| R3 | Una URL firmada sobrevive a que dejes de ser amigo | TTL 60 s; el peor caso es un minuto de exposición, no indefinido |
| R4 | Usuarios existentes sin handle | Todo opcional salvo lo social; UI de reclamación no bloqueante |
| R5 | La fase crece hacia "red social" | Alcance §2 cerrado; el resto a §13 |
| R6 | Privacidad mal entendida por el usuario ("¿esto quién lo ve?") | Etiquetas explícitas en cada ámbito + vista previa de "cómo te ve un amigo" |
| R7 | Egress de fotos (plan gratuito: 5 GB) | Lote por llamada, TTL corto, cache de navegador, solo lo visible |
| R8 | El Locker del amigo se ve obsoleto (no hay pull) | Refresco al abrir + nota de "actualizado hace X", nunca prometer tiempo real |
| R9 | Complejidad de UI en móvil | La Collection ya tiene layout táctil: reutilizarlo en vez de inventar |
| R10 | Bloqueo percibido como "no funciona" | Textos claros: bloquear no avisa, y desbloquear no restaura la amistad |
| R11 | Un cliente manipulado publica un handle **con formato inválido** (saltándose `handle_claim`) | `sync_apply` solo garantiza **unicidad**, no formato (§14.5). El daño es cosmético y propio; se cierra el día que haya moderación real |
| R12 | El `handle_claim` revela que un handle existe (`taken`) | Inherente a "añadir por handle". Mitigado con formato exacto y rate limit (R2); no hay listado ni búsqueda por prefijo |

---

## 12. Decisiones abiertas

Cuatro cerradas por el usuario el 2026-09-12; §4–§6 ya las asume como firme.

| # | Decisión | Estado |
|---|---|---|
| **D1** | ¿Solicitud cruzada = auto-aceptar? | ✅ **Decidido: sí.** La fila pasa a `accepted` en la misma transacción |
| **D2** | ¿Caducan las solicitudes? | ⏳ Abierto (recomendado: 30 días, limpieza perezosa o `pg_cron`) |
| **D3** | ¿Desbloquear restaura la amistad? | ✅ **Decidido: no.** Se vuelve a solicitar |
| **D4** | ¿`share_profile` por defecto? | ✅ **Decidido: on.** Stats y armario siguen apagados |
| **D5** | Límites numéricos (solicitudes/día, amigos máx, TTL de la firma) | ⏳ Abierto (20 / 200 / 60 s, ajustables) |
| **D6** | ¿Avisar al eliminar un amigo? | ✅ **Decidido: no avisa**, simétrico al bloqueo |
| **D7** | ¿Se comparten los ítems `sold` / `wishlist`? | ⏳ Abierto (recomendado: sí, con su chip) |

---

## 13. El futuro social (y los ganchos que deja esto)

Lo que viene después —daily scramble, retar a un amigo, carreras 1v1, rankings—
**no** se construye aquí, pero esta fase no debe cerrarle la puerta:

- **`friendships` es el ancla**: cualquier reto futuro referencia un par de
  usuarios que ya son amigos, y la comprobación de amistad (`are_friends`) es la
  misma.
- **Presencia**: un reto necesita "¿está conectado?". No hace falta ahora, pero
  conviene **no** meter `last_seen` en `profiles` (mismo argumento que §4.3: el
  sync lo pisotearía); si llega, será su propia tabla o Realtime.
- **Realtime**: el escaparate no lo necesita (refresco al abrir). Las carreras
  sí, y entonces habrá que revisar el `wss:` de la CSP (P2) a propósito.
- **Moderación**: el día que haya retos y resultados compartidos hará falta
  reportar y bloquear desde más sitios. El bloqueo de esta fase ya es la
  primitiva correcta sobre la que construir.

Lo que **no** hay que hacer ahora aunque sea tentador: chat, feed, comentarios,
notificaciones push, presencia. Cada uno es una fase, no una pantalla.

---

## 14. Ejecución (F8.0–F8.7, 2026-09-12)

### 14.1 Qué se ha construido y cómo se ha verificado

| Artefacto | Contenido |
|---|---|
| `supabase/migrations/20260912000016_handle_identity.sql` | `normalize_handle`, `handle_suggestion`, índice único parcial `uq_profiles_handle`, trigger `profiles_protect_handle` (reglas A y B), RPC `handle_claim` |
| `supabase/migrations/20260912000017_friends_schema.sql` | `friendships` (una fila por par, `check (user_low < user_high)`), `friend_blocks`, `profile_visibility`, `friend_rate_limits`, `are_friends`, RLS de propietario y **cero grants** |
| `supabase/migrations/20260912000018_friends_rpc.sql` | La superficie RPC completa (solicitudes, gestión, `friend_list`, `privacy_*`, las tres proyecciones con lista blanca, `puzzle_average`) |
| `supabase/migrations/20260912000019_friend_rate_bump.sql` | `friend_rate_bump(p_actor, …)`: el mismo contador de ventana fija que `friend_rate_check`, pero con actor **explícito** — un `service_role` de Edge Function no tiene `auth.uid()` |
| `supabase/functions/friend-photo-urls/index.ts` | La Edge Function (F8.5): valida JWT + amistad + `share_locker`, verifica que cada `photo_id` **pertenece de verdad** al `gear_items.photos` del dueño, y firma en lote con TTL 60 s, cuota 30/min y fallo **cerrado** |
| `packages/sync-engine/src/handle.ts` | `claimHandle`: llama al RPC y adopta el sello del servidor localmente |
| `packages/sync-engine/src/pull.ts` | Adopción del handle de la cuenta cuando el perfil local es más nuevo (el hallazgo de §14.4) |
| `apps/web/src/services/friends.ts` | La superficie de cliente completa: RPC tipadas (`friend_*`, `privacy_*`), mapeo `snake_case → camelCase` y **fallos como valores** (`FriendsResult`), no excepciones. Ninguna tabla se lee directamente |
| `apps/web/src/hooks/useFriends.ts` | Bindings React: directorio como store de módulo (`useSyncExternalStore`, TTL 30 s, petición compartida), detalle por selección, privacidad y `claimHandle` |
| `apps/web/src/views/Friends/**` | La sección (tabs Amigos/Solicitudes/Bloqueados), la ficha de amigo (perfil + stats + escaparate), la tarjeta de reclamación de handle, el formulario de añadir y las tarjetas del escaparate con cubo 3D |
| `apps/web/src/components/Settings/sections/PrivacySection.tsx` | La pantalla de consentimiento en Ajustes: handle + los cuatro interruptores, con escritura optimista que **se revierte** si el servidor la rechaza |

**Verificación en vivo (no simulada).** Tres suites SQL contra el Postgres
linkado, cada una dentro de `begin … rollback` (no queda ni una fila), en
**`supabase/validation/`** y ejecutables con `supabase/validation/run.sh` (ver
su README para qué cubre cada una y por qué existen habiendo tests en el repo):

- `validation/f8-identity.sql` — índice parcial, formato (reservados, `@`,
  longitud), reglas A y B, idempotencia, sello creciente y la relectura que
  impide un `ok` mentiroso.
- `validation/f8-social.sql` — grants/RLS de las 4 tablas nuevas, las
tres puertas (`not_friends` antes de la amistad), formato del handle
(`@F8_TEST_B`, `nadie_existe_9999`, `ab`), auto-aceptación de la solicitud
cruzada, idempotencia de aceptar dos veces, eliminación, bloqueo
(desbloqueo **no** restaura) y el cruce de bloqueo contra solicitud.
- `validation/f8-projections.sql` — el escaparate con señuelos
(`SERIAL-SECRETO`, `AABBCCDDEEFF`, `NOTA-PRIVADA`, `tienda.example`, `99.99`) que
**no** pueden aparecer en el JSON, paginación keyset (cursor = último ítem
servido, tope saturado a 100), taxonomía, ítems demo fuera, y las agregadas
exactas del 3x3 (total 5, count 4, best 7000, worst 14000, suma 39000, ao5
10667, ao12 nulo por falta de datos, racha 0).

Ambas pasan con la migración `15` (el hardening de la auditoría) delante, así que
la composición con lo ya desplegado está probada. Los usuarios de la suite B son
**sintéticos** (`insert into auth.users`, borrados por el rollback): los dos
perfiles de producción tienen solves reales, así que sus agregados no son un
número fijo y una aserción absoluta sobre ellos habría sido frágil o falsa.

En el repo: `packages/sync-engine` 66 tests (5 ficheros) con la sección **T**
nueva; `pnpm test` 27/27 tareas, `typecheck:all` y `lint:lines` limpios.

Las suites son **reproducibles desde el repo** y no un artefacto de sesión: se
movieron de un directorio temporal a `supabase/validation/` precisamente porque
un documento que apunta a ficheros que no existen no es verificable por nadie.

### 14.2 El savepoint de `sync_apply` se descartó (a favor del trigger)

El §4.4 preveía capturar el `unique_violation` dentro del bloque de `profiles` de
`sync_apply` con un savepoint y contar `handle_conflicts`. Se descartó por dos
razones medidas, no estéticas: **(1)** un trigger `BEFORE` que reescribe `NEW` no
puede lanzar, así que no hay ninguna forma de atascar el lote, y protege a todos
los escritores en vez de solo a ese; y **(2)** habría implicado reescribir 500
líneas de una función que hoy funciona para cambiar 15. El resultado funcional
que prometía el plan se conserva íntegro: un conflicto de identidad nunca es un
error fatal de sync.

Los dos caminos del `on conflict … do update` están cubiertos: el UPDATE (rules
A y B) y el INSERT de una fila que aún no existía (un handle ya tomado entra
vacío, que es un estado válido: "sin identidad pública").

### 14.3 El sello del servidor, no el del dispositivo

`claimHandle` escribe la fila local con el `updated_at` **que devuelve el
servidor**, no con `Date.now()`. Es la diferencia entre que la identidad exista
también en la app o solo en la nube: con un sello local, la fila local quedaría
"más nueva" que la de la nube, el LWW local ganaría y el pull nunca entregaría
el handle. El watermark de push **no** se adelanta: así una edición local
pendiente (nombre, bio) no pierde su turno en la cola.

### 14.4 Hallazgo: el handle no llegaba a los dispositivos "más nuevos"

El más grave de la fase hasta ahora, y no estaba en el plan. **Un segundo
dispositivo no llega con el handle de la cuenta: llega con un perfil local por
defecto sellado con su propio `Date.now()`**, que suele ser más nuevo que el
sello de la reclamación del primero. El pull de `profiles` aplica por LWW
estricto (`local.updated_at < cloud.updated_at`), así que esa fila **nunca** se
aplicaba: la UI mostraba "sin handle" para una cuenta que sí lo tenía.

Y no se arreglaba sola: los sellos ya habían convergido y el cursor de pull no
vuelve a mirar una fila por debajo del watermark. **Silencioso y permanente**,
exactamente la misma clase de fallo que el cursor envenenado de la auditoría.

Lo encontré escribiendo el test antes del arreglo: las dos aserciones fallaron
(`expected '' to be 'ana'`) con el código desplegado. La corrección está en el
pull: si el perfil local no es más viejo, **se adopta solo el `handle`** (nunca
el resto de la fila) y se conserva el sello local, así que no se pisa ninguna
edición pendiente ni se reabre el ciclo de sync. Que el servidor mande en esta
columna no es una excepción al LWW: es la única columna que el servidor **sí**
arbitra (él decide titularidad y unicidad), y un handle local sin reclamar no es
una edición, es una petición.

Tres tests nuevos lo fijan (sección T): la adopción con sello más nuevo, que el
push posterior no borra el handle de la nube (regla A), y que reclamar adopta el
sello exacto del servidor y no gasta un push.

### 14.5 Residuales aceptados

- **`sync_apply` solo garantiza unicidad, no formato** (R11): un cliente
  manipulado puede publicar `handle = 'x'` saltándose `handle_claim`. El daño es
  cosmético y propio, y el trigger garantiza que no roba el de nadie.
- **`not_found` para un handle sin reclamar**: revela que ese handle no tiene
  identidad pública. Es la respuesta correcta (no distinguimos "no existe" de
  "existe sin handle") y es consistente con el bloqueo, que devuelve lo mismo.
- **El fake del test reimplementa `normalize_handle`**: no puede importar SQL. Si
  diverge, lo detectan las suites en vivo — que es precisamente por lo que se
  ejecutan contra el Postgres real y no contra el fake.

### 14.6 Un bug real encontrado por la propia suite (`puzzle_average`)

La suite B no compilaba la función: `select avg(eff) … order by eff` con un
`ORDER BY` sobre una columna sin agregar → **42803**. El recorte del ao5/ao12
tiene que ocurrir dentro de una subconsulta con su propio orden. Arreglado, y la
paridad con `averageOf` del cliente es exacta por construcción: mismo
`ceil(n/20)` de recorte, `DNF → null` ordenado al final (que en `averageOf` es
`Infinity`, así que el recorte lo descarta igual) y `dnf > trim → DNF`.

### 14.7 Desplegado, y qué queda

**Las migraciones 16–19 están aplicadas a la nube** (`supabase migration list
--linked` las muestra en Local y Remote) y la Edge Function `friend-photo-urls`
está `ACTIVE` (versión 1). La prueba de que lo desplegado es lo probado: las
cuatro suites se ejecutan también con `--deployed`, que **quita el prefijo de
migraciones** y ejerce el esquema que realmente vive en Supabase. Las cuatro
pasan.

El pipeline completo queda verde de punta a punta: `lint:lines` (0 violaciones
nuevas, 22 allowlisted), `lint` (0 errores), `typecheck` (27/27 paquetes),
`test` (27/27 tareas; `sync-engine` 66 tests) y `build` (13/13).

Lo único que **no** está cerrado son tres decisiones de producto de §12, que no
son código:

1. **D2** — caducidad de solicitudes de amistad (hoy no caducan).
2. **D5** — límites numéricos (nº máximo de amigos, de solicitudes por ventana).
3. **D7** — si el escaparate incluye ítems `sold`/`wishlist` (hoy la lista
   blanca los sirve; ocultarlos sería un `where` en `friend_locker`).

Y una capacidad de §8.5 que se dejó fuera por alcance: la **vista previa "así te
ve un amigo"** dentro de Ajustes. El código que la necesitaría ya existe
(las tres proyecciones aceptan `owner = auth.uid()`, que es la ruta que usa la
propia suite); es una pantalla, no un cambio de contrato.

### 14.9 Deudas técnicas medidas, con criterio de disparo

Ninguna bloquea la fase. Se dejan escritas con la condición que las convertiría
en trabajo, en vez de como "mejoras" sin umbral:

1. **Índice `(user_id, is_demo, category_id, id)` en `gear_items` (P8).** No se
   aplica: `idx_gear_items_user_category` ya sirve el filtro y un armario de
   cientos de ítems no ordena de verdad. Se aplica si un `explain analyze` de
   `friend_locker` con datos reales muestra un sort/filter que domina el coste.
2. **`friend_list` calcula dos proyecciones por fila (N4).** Hoy la lista está
   acotada por el máximo de amigos (200) y el coste es lineal sin subconsultas
   repetidas; se reescribe con `case` cuando
deje de serlo.
3. **Reintento de firmas con reloj adelantado (N3, aplicado).** El timer solo se
   rearma cuando al lote le queda más vida que el margen (`delay >=
   REFRESH_MARGIN_MS`), así que un desfase de reloj no puede convertirse en un
   bucle de 15 s contra la Edge Function.

### 14.8 Ajustes de producto en la UI (2026-09-12)

Tres correcciones pedidas tras ver la sección montada, ya aplicadas:

1. **El estado sin sesión ya no manda a Ajustes.** Ofrece **Continuar con
   Google** (`friends.signedOut.continueWithGoogle`), reutilizando
   `GoogleIcon` y `useAccount().signInWithGoogle` — el mismo flujo que `/auth`,
   sin página intermedia. Se deshabilita si `configured` es falso y muestra el
   motivo, en vez de un botón que no haría nada.
2. **Fuera el microcopy del estado vacío** (`empty.hint` "Solo tus amigos ven tu
   Armario" y `empty.refresh` "Actualizar"): el bloque se queda en título,
   descripción e ilustración.
3. **Fuera la nota estática de privacidad** (`privacy.note`) tanto en la sección
   de Amigos como en Ajustes; en Ajustes queda solo el indicador "Guardando…"
   mientras la escritura está en vuelo.

Las tres claves retiradas se borraron de `en.json` y `es.json` (no se dejan
claves muertas) y el chequeo de uso confirma que ninguna vista las referencia
ya: 113 claves usadas, todas presentes en ambos idiomas.

4. **El atajo *¿qué comparto?* abre Privacidad, no Perfil.** `MainStage`
   reutilizaba el mismo callback para dos destinos distintos (el editor de
   perfil que pide `ProfileView` y los cuatro interruptores de consentimiento
   que pide Amigos), así que el atajo aterrizaba en un sitio que no responde a
   su pregunta. Ahora hay una entrada propia por destino
   (`onOpenPrivacySettings` → `initialSection='privacy'`) y el prop de la vista
   se llama como lo que hace. Un test puro (`settings.constants.test.ts`) fija
   que los ids por los que se abre Ajustes existen, porque un id que
   desaparece no falla: cae en silencio a `general`.

5. **El badge de solicitudes entrantes del nav, que §8.1 pedía, ya existe.**
   `LeftSidebar` lee el mismo store de directorio que la pantalla
   (`friend_list` ya trae `counts.incoming`, así que no cuesta una llamada
   extra) y se actualiza tras aceptar/bloquear porque las mutaciones fuerzan
   el refresh. Sin sesión no se intenta la lectura (`{ enabled }`): el rail
   está montado siempre y una RPC sin cuenta solo puede volver 401.

6. **La sección *Privacidad y amigos* desaparece de Ajustes sin sesión.** El
   handle y los cuatro interruptores viven en el servidor tras una cuenta, así
   que sin sesión la sección solo podía mostrar "no disponible":
   `visibleSettingsSections(hasAccount)` la filtra y el diálogo entero (barra
   lateral, select móvil, índice de animación y contenido) usa esa lista, para
   que ninguna parte pueda discrepar. Verificado en el navegador sin sesión: 16
   secciones, cero apariciones de la cadena "Privacidad" en el DOM. *Cuenta*
   sigue ahí, que es donde está el botón de Google: la puerta no se cierra, se
   deja de ofrecer la habitación que necesita llave.
