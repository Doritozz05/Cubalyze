# Plan — Fase 6: el Locker se sincroniza (y sus fotos llegan a Storage)

> Estado: **FASE COMPLETA el 2026-09-12** — nube ejecutada y verificada
> (migraciones 11–14 aplicadas) **y** lado cliente implementado y probado
> (migración local 037 + `038`, repositorio, motor, servicio de fotos, 316
> tests nuevos o adaptados en `@cubeforge/database`, `@cubeforge/sync-engine` y
> la web). En la auditoría de esta ejecución aparecieron **cuatro bugs reales
> más** (F15–F18), dos de ellos en el núcleo del sync y anteriores a esta fase:
> todos corregidos y con test que los fija (§7, §10).
> Rama `feat/cube-collection`. Continúa
> [Plan-Locker-Cubo-Metodo-2026-09.md](./Plan-Locker-Cubo-Metodo-2026-09.md)
> (fases 1–4) y [Plan-Fase5-SmartCube-Locker-2026-09.md](./Plan-Fase5-SmartCube-Locker-2026-09.md)
> (fase 5). Alcance: **sincronizar el Locker y sus fotos**. No incluye la
> bitácora de setups (fase 7, descartada) ni el sistema de amigos (fase 8),
> aunque §6 lo deja preparado.
>
> Contexto: hoy el Locker vive en SQLite local (`gear_categories`/`gear_types`/
> `gear_items`, migración 034, más `gear_items.smart_id` de la 036) y las fotos
> en IndexedDB. Nada sale del dispositivo. La Fase 6 es la fase con mayor
> potencial de pérdida de datos del plan: un error aquí se lleva por delante la
> colección entera, así que se le exige el mismo rigor que a la Fase 2.

---

## 0. Veredicto ejecutivo

**Técnicamente viable, y con menos obra de la que sugiere su tamaño**, porque la
Fase 2 dejó el Locker con forma "sync-ready" (`id TEXT PK`, `created_at`,
`updated_at`, `is_demo`) y la arquitectura de sync ya está probada y en
producción (7 tablas, tombstones, LWW, watermarks, RLS). La Fase 6 no inventa un
modelo: **extiende el existente** con tres tablas espejo y un canal nuevo para
las fotos.

Lo que cambia de verdad respecto a `solves`/`training_*` son dos cosas, y ambas
son las que hay que tratar con cuidado:

1. **Jerarquía con cascada local.** `gear_items → gear_types → gear_categories`
   tiene FKs con `ON DELETE CASCADE`/`SET NULL`. SQLite corre con
   `foreign_keys = ON` pero con `recursive_triggers` **OFF** (worker.ts:643/683),
   así que un borrado en cascada **no dispara los triggers de tombstone** de los
   hijos. Sin corregirlo, borrar una categoría dejaría en la nube sus tipos e
   items, y el siguiente pull los **resucitaría** en el otro dispositivo (§7,
   F1/F2).
2. **Binarios.** Las fotos no pueden ir en una columna sincronizada (una columna
   de blobs bajo LWW es una trampa: el push reescribe la foto entera en cada
   edición de la fila). Van a **Supabase Storage** con un canal propio, de modo
   que el row-sync solo mueve *referencias* (`{id,width,height,addedAt}`), como
   ya hace hoy (§3.2).

**Resultado:** la Fase 6 se entrega en **cuatro migraciones de nube**
(`20260912000011..14`, ya **aplicadas y verificadas** contra el Postgres real),
**una migración local** (`037`), la extensión del motor (`sync-engine`) y un
servicio de fotos en el web. El plan detalla cada pieza; la nube ya está lista,
el cliente aún no (§8, §10).

---

## 1. Diagnóstico verificado (CLI & base de datos, 2026-09-12)

Todo lo de esta tabla es **medido**, no supuesto.

| Comprobación | Resultado |
|---|---|
| CLI de Supabase | `2.109.1` (hay `2.117.0` disponible; sin `--experimental` fallan los comandos de Storage) |
| Sesión CLI | iniciada (`supabase projects list` ve la organización) |
| Proyecto linkado | `upojrxcohcdjlofnirrv` — "Doritozz05's Project", org `uuunqvtbmwbwofpaohcw`, West EU (Ireland) |
| Motor de base de datos | PostgreSQL **17.6** (x86_64, gcc 15.2.0) |
| Storage | API v1.70.4, **0 buckets** al empezar (el bucket del Locker se crea en §10) |
| REST | PostgREST v14.15 |
| Migraciones locales vs remotas | **11 / 11 coinciden** (`supabase migration list --linked`); no hay deriva |
| Tablas en `public` | 8: `profiles`, `solves`, `sessions`, `skill_progress`, `sync_tombstones`, `training_attempts`, `training_sessions`, `training_tasks` |
| Tablas `gear_*` en la nube | **no existían** al empezar (`GET /rest/v1/gear_items` → HTTP 404 `PGRST205`); se crean y verifican en §10 |
| `GET /rest/v1/solves` (control) | HTTP 200 `[]` — la anon key + RLS responden bien |
| Usuarios reales | **2** (`select count(*) from auth.users`) |
| Extensiones | `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp` (sin `pg_cron`, sin `pgtap`) |
| Variables de entorno web | solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (anon es pública por diseño; **no** hay service_role en el repo — correcto) |
| Docker | **no instalado** → no se puede `supabase start`; los tests de Postgres no pueden correr en local, sí los de sqlite-wasm |
| `supabase db query --linked` | disponible y **acepta `begin; … rollback;`** → validación no destructiva contra el esquema real |

### 1.1 Veredicto de viabilidad

- **Aplicar las migraciones era viable**: `supabase db push --dry-run --linked`
  confirmó que solo subirían las nuevas, en orden.
- **Validar el SQL antes de aplicar es viable**: las migraciones se han
  ejecutado contra el Postgres real dentro de `begin; … rollback;` y han pasado
  sin error (§10). Esto incluye `create policy … on storage.objects`, que es la
  parte que suele fallar por permisos.
- **No es viable hoy**: probar el SQL en un Postgres local (no hay Docker) ni
  hacer un test de integración real de Storage sin credenciales de servicio
  (§9, limitación honesta).
- **Viabilidad de la Fase 8**: confirmada en diseño (§6); la Fase 6 no concede
  ninguna lectura ajena, así que la Fase 8 es aditiva (una política y una
  proyección), no una reescritura.

### 1.2 Estado tras la ejecución (2026-09-12)

| Comprobación | Resultado |
|---|---|
| Migraciones aplicadas | 4 nuevas (`20260912000011..14`); **15 / 15** en paridad local↔remota |
| Tablas del Locker | `gear_categories`, `gear_types`, `gear_items` existen, con PK `(user_id, id)`, RLS y sus índices |
| Políticas RLS | 3 de propietario en las tablas; 4 en `storage.objects` (`select/insert/update/delete`, solo `authenticated`) |
| Bucket | `locker-photos`, `public = false`, límite 1 MB, MIME `jpeg/png/webp` |
| Privilegios de API | `anon`/`authenticated` **solo `SELECT`** en `public` (se corrigió el exceso DDL, §5.6); `service_role` conserva los 7 |
| `sync_apply` | lleva los tres bloques de gear, los tombstones y la retención; guardián de payload activo |
| Prueba funcional end-to-end | payload parcial (defaults), LWW rechazando un push obsoleto, tombstone posterior borra item+tipo, tombstone anterior **no** borra, guardián rechazando 4 001 filas — todo en transacciones revertidas |
| Datos reales | intactos: `solves` y `sync_tombstones` con sus filas, `gear_items` a 0 |

---

## 2. Estado previo y flujo global (cómo encaja con el resto)

### 2.1 Qué dejó cada fase

| Fase | Dejó | Consecuencia para la 6 |
|---|---|---|
| 1 | `method` por evento + reparación de datos | irrelevante para gear |
| 2 | Locker en SQLite (034) + fotos en IndexedDB + `updated_at` en las tres tablas | **el cimiento**: las filas ya tienen la forma del sync |
| 3 | `solves.cube_id`/`cube_label` (035 + nube 009/010) | el histórico ya referencia gear **sin FK**: borrar un item no toca la historia |
| 4 | stats por cubo derivadas + filtros | **no se sincroniza nada nuevo**: los agregados siguen siendo replay local (ADR-029 §2) |
| 5 | `gear_items.smart_id` (036) + identidad por hardware | `smart_id` viaja con la fila; el vínculo se reconstruye en el otro dispositivo |

### 2.2 El flujo global del sync (ya en producción) y dónde entra el Locker

```
write local ──► trigger SQLite (028/037) ──► app_meta.sync_dirty = '1'
                                          └► sync_tombstones (solo DELETE)
     │
     ▼
requestSync() [debounce 2 s]  +  poller 45 s / online / visibility
     │
     ▼
SyncEngine.doSync()  ── Web Locks "cubeforge-sync" (una pestaña a la vez)
     │
     ├─ push: por tabla, páginas de 500, cursor (updated_at, id)
     │        └─ RPC sync_apply(payload)  [security definer, LWW por fila,
     │                                      verifica user_id = auth.uid()]
     │        └─ tombstones al final (RPC) y purga local
     │
     └─ pull: tombstones primero (watermark propio), luego 7 tablas
              `.from(t).select('*').eq('user_id',uid).gt(updated_at,wm)`
              └─ LWW local por fila; el watermark avanza al máximo visto
```

La Fase 6 inserta el Locker en **tres puntos** de ese flujo y añade un cuarto
canal paralelo para los binarios:

```
                          ┌───────────────────────────────────────────┐
   Fase 6 (row-sync)  ───►│ + gear_categories  (1.º, es el padre)      │
                          │ + gear_types       (2.º)                   │
                          │ + gear_items       (3.º)                   │
                          └───────────────────────────────────────────┘
                          ┌───────────────────────────────────────────┐
   Fase 6 (binarios)  ───►│ Supabase Storage  bucket locker-photos     │
                          │ {uid}/{itemId}/{photoId}/{full|thumb}.jpg  │
                          │ (subida/bajada/GC con su propio cursor)    │
                          └───────────────────────────────────────────┘
```

**Nada más cambia**: `solves`, el análisis, las stats, la atribución por cubo y
los filtros siguen exactamente igual. El sync de gear es ortogonal.

### 2.3 Por qué las fotos NO van en la fila

`gear_items.photos` es un JSON de referencias. Si en su lugar se sincronizara
base64 en una columna, cada edición del item (renombrarlo, cambiar el estado)
reenviaría **todos** sus bytes, y el LWW podría revertir una foto por una
edición concurrente de otra columna. Storage rompe ese acoplamiento: el row-sync
mueve un JSON de ~80 bytes por foto y los bytes viajan una sola vez.

---

## 3. Modelado de datos y Storage

### 3.1 Tablas de nube (`20260912000011_gear_sync_schema.sql`, escrito)

Espejo 1:1 de las tablas locales + `user_id` + RLS. **Sin FKs entre ellas y sin
CHECK constraints**, por las mismas razones que `solves.session_id` no tiene FK:
el orden de los bloques de un payload nunca debe poder hacer fallar un push, y
un CHECK que un cliente viejo no conozca abortaría el lote y atascaría el sync.

| Tabla | PK | Columnas | Índices |
|---|---|---|---|
| `gear_categories` | `(user_id, id)` | `name, kind, icon, accent, is_demo, created_at, updated_at` | `(user_id, updated_at)` |
| `gear_types` | `(user_id, id)` | `category_id, name, puzzle_category, is_demo, created_at, updated_at` | `(user_id, updated_at)`, `(user_id, category_id)` |
| `gear_items` | `(user_id, id)` | `category_id, type_id, name, brand, model, finish, serial, smart_id, palette, acquired_at, price_amount, price_currency, notes, links, photos, tags, status, condition, is_primary, is_favorite, rating, quantity, is_demo, created_at, updated_at` | `(user_id, updated_at)`, `(user_id, category_id)`, `(user_id, type_id)`, `(user_id, smart_id) where smart_id is not null` |

Decisiones con nombre propio:

- **`smart_id` con índice NO único.** La regla de producto es "un `smart_id`
  pertenece a un item", pero un índice único haría que dos dispositivos que
  vinculan el mismo cubo a items distintos provocasen un `unique_violation`
  dentro de `sync_apply`: el lote falla, el watermark no avanza y el sync queda
  atascado. La unicidad se defiende en el cliente (donde ocurre la vinculación,
  `Plan-Fase5` §5.3) y se reporta con el chequeo de integridad.
- **Sin FK y sin CHECK**, ya explicado.
- **`price_amount`/`rating` en `double precision`** (el `REAL` local) para no
  perder precisión en el viaje de ida y vuelta.
- **RLS por propietario y por comando** (aunque aquí baste `for all`), porque
  las políticas permisivas se **OR-ean**: la Fase 8 podrá añadir una política
  `select` de amistad sin reescribir la del propietario.
- Los roles de API reciben **solo `SELECT`**; las escrituras pasan por
  `sync_apply`. `service_role` recibe acceso completo (misma decisión que
  20260822000002).

### 3.2 Storage (`20260912000013_locker_photos_bucket.sql`, escrito)

**Bucket privado `locker-photos`.** Convención de ruta:

```
{user_id}/{item_id}/{photo_id}/full.jpg     ← ~600 KB (1280 px, imageUtils)
{user_id}/{item_id}/{photo_id}/thumb.jpg    ← ~30 KB  (≤320 px)
```

- **La primera carpeta ES la partición de RLS**, así que las políticas no leen
  ninguna tabla: comparan `(storage.foldername(name))[1]` con `auth.uid()`.
- **Privado (`public = false`)**: privacidad y control de egress. La Fase 8
  servirá el estante con URLs firmadas de corta vida generadas en el servidor,
  nunca abriendo el bucket.
- **Límites**: `file_size_limit = 1 MB` por objeto (deja margen para una foto
  grande sin permitir un RAW) y `allowed_mime_types = {image/jpeg, image/png,
  image/webp}`. El recorte real de bytes lo hace el navegador **antes** de
  subir (`imageUtils`); aquí solo hay una valla.
- **Políticas por operación** (select/insert/update/delete, todas
  `to authenticated`): la Fase 8 añadirá una `select` sin reescribir nada.
  `anon` no recibe ninguna.
- Al subir se fija `contentType` y `cacheControl: '31536000'` (inmutable,
  `photoId` único) para que las repeticiones se sirvan del CDN: el egress
  cacheado tiene su propio cupo y sale mucho más barato (§5.4).

### 3.3 Estado de subida: dónde vive y por qué

El "¿esta foto ya está en Storage?" **no** puede vivir en la fila sincronizada:
cualquier marca de subida dentro de `gear_items.photos` cambiaría `updated_at`,
lo que provocaría un push, un pull en el otro dispositivo, otra marca… un bucle.
Por eso se añade una tabla **local (no sincronizada)** en la migración 037:

```sql
CREATE TABLE IF NOT EXISTS gear_photo_sync (
  photo_key    TEXT PRIMARY KEY,      -- "<itemId>:<photoId>"
  item_id      TEXT NOT NULL,
  photo_id     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | synced | missing
  content_hash TEXT NOT NULL DEFAULT '',
  full_bytes   INTEGER NOT NULL DEFAULT 0,
  thumb_bytes  INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER NOT NULL DEFAULT 0,
  uploaded_at  INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT
);
CREATE INDEX IF NOT EXISTS idx_gear_photo_sync_status
  ON gear_photo_sync(status, last_attempt_at);
CREATE INDEX IF NOT EXISTS idx_gear_photo_sync_item
  ON gear_photo_sync(item_id);
```

`content_hash` (SHA-256 de los bytes, o `size:addedAt` como atajo) evita volver
a subir una foto que no cambió. `status = 'missing'` marca "el otro dispositivo
referencia esta foto pero todavía no la subió" (404): se reintenta con backoff,
nunca bloquea el resto del ciclo.

---

## 4. Mecanismo de sincronización y desincronización

### 4.1 Resolución de conflictos

Se mantiene **row-sync LWW** (ADR-029 §1), sin CRDT y sin event sourcing, porque
el Locker no tiene conflictos de incremento (a diferencia de un contador de
entrenamiento): dos ediciones del mismo item resuelven por `updated_at` mayor,
que es exactamente lo que ya hace el resto de la app.

- **Push**: `insert … on conflict (user_id,id) do update set … where
  excluded.updated_at >= tabla.updated_at`. Un dispositivo obsoleto no puede
  pisar una fila más nueva.
- **Pull**: se aplica la fila solo si su `updated_at` es mayor que el local; si
  el local es más nuevo, se deja y el siguiente push lo sube.
- **Borrados**: `sync_tombstones` con LWW físico (`delete … where updated_at <=
  deleted_at`). Un item editado *después* del borrado sobrevive (y se
  reinserta), que es la semántica ya probada en `solves`.
- **Fotos**: inmutable por `photoId`; nunca hay conflicto de contenido. Solo hay
  ausencia (404 → reintento) o presencia.

### 4.2 Orden de operaciones (obligatorio)

| Momento | Orden | Por qué |
|---|---|---|
| Push | `profiles` → … → `gear_categories` → `gear_types` → `gear_items` → tombstones | el padre antes que el hijo; los tombstones al final (y solo tras haber subido las ediciones que ganan al borrado) |
| Pull | tombstones → `gear_categories` → `gear_types` → `gear_items` | SQLite **sí** tiene FKs locales (`PRAGMA foreign_keys = ON`): un item insertado antes que su categoría/tipo fallaría. Es el mismo fallo que ya documenta `pull.ts` para `sessions`→`solves` |
| Fotos | subir **antes** de empujar las referencias nuevas; descargar después de aplicar las filas | si la referencia llega antes que los bytes, el otro dispositivo ve un 404 y lo reintenta; al revés, es peor experiencia |

### 4.3 Offline / online y estado de sincronización

La app ya es offline-first: escribir en el Locker sin red no cambia nada (el
dirty flag queda a `1` y el poller/online reanuda). Lo que la Fase 6 añade es
**visibilidad honesta** del estado, que hoy no existe para el Locker:

| Estado | Significado | UI |
|---|---|---|
| `synced` | todo arriba y abajo | nada (o un check discreto) |
| `pending` | hay filas/fotos esperando | "3 items y 5 fotos por subir" |
| `syncing` | ciclo en curso | spinner |
| `error` | el último ciclo falló | último error + "Reintentar" |
| `desynced` | reintentos agotados / drift detectado | ofrecer **Resincronizar** |

### 4.4 Desincronización: qué es y cómo se sale

Se considera **desincronizado** cuando (a) el ciclo lleva N fallos seguidos, o
(b) el chequeo de integridad detecta incoherencias (items huérfanos, duplicados
de `smart_id`, fotos vacías persistentes). Salidas, de menos a más:

1. **Reintento con backoff** (automático).
2. **Resincronizar (barato)**: borrar los **watermarks de pull** y hacer un pull
   completo. Es seguro e idempotente: el LWW local deja lo más nuevo y el push
   sube lo que quedó por debajo. No toca datos.
3. **Resincronizar (duro, con confirmación)**: borrar también los watermarks de
   push y reempujar todo. Un re-push completo es seguro porque `>=` acepta la
   igualdad (reescribir los mismos valores es idempotente) y rechaza lo más
   viejo. Se ofrece solo con aviso explícito.
4. **Chequeo de integridad** (nuevo, también útil en la Fase 8): una consulta
   barata que devuelve conteos por tabla del servidor para comparar con los
   locales y detectar drift sin descargar nada.

Eventos de desconexión / desincronización, en tabla:

| Evento | Comportamiento |
|---|---|
| Se cae la red a mitad de un push | el watermark avanzó por lote ya aplicado; solo se reenvía el lote fallido |
| Otra pestaña sincroniza a la vez | Web Locks: la segunda no hace nada (`ifAvailable`), los watermarks hacen que un ciclo saltado sea no-op |
| `storage.objects` 404 al bajar una foto | `status='missing'`, backoff, reintento; no bloquea filas |
| La subida de una foto falla y la fila ya se empujó | la referencia existe, el otro dispositivo espera; cuando suba, se reconcilia |
| Borrado de cuenta | se borran filas locales + blobs + **objetos de Storage** (la Edge Function debe vaciar el prefijo `{uid}/`) |
| `fresh` claim (empezar de cero) | **hoy NO borra el Locker** — hay que arreglarlo (§7, F3) |

---

## 5. Hardening, seguridad y cuota

### 5.1 RLS

- **Tablas**: `owner_all_*` por propietario con `(select auth.uid())` (initplan,
  una evaluación por consulta, no por fila — lección de la 0003).
- **Storage**: cuatro políticas de carpeta, solo `authenticated`; `anon` sin
  política (deny-by-default).
- **`sync_apply`**: `security definer` con `search_path` fijado, y verifica
  `rec.user_id = auth.uid()` **fila a fila**; si no coincide, la salta y la
  cuenta en `skipped`, y el cliente **no avanza el watermark** si hay skips
  (`assertNoSkipped`), de modo que una fila rechazada nunca se pierde en
  silencio.
- **Prohibido** el `select *` servido a amigos sobre la fila base: `serial` y
  `smart_id` son datos de hardware que no deben filtrarse (§6).

### 5.2 Guardián de payload (nuevo, en `20260912000012`)

`sync_apply` materializaba el JSON entero con `jsonb_to_recordset` antes de
rechazar una sola fila. El guardián valida **antes** de tocar tablas:

| Límite | Valor | Por qué |
|---|---|---|
| Forma | objeto JSON | no arrays sueltos |
| Tamaño | 8 MB | un cliente comprometido no puede forzar materializar megabytes |
| Filas totales | 4 000 / llamada | el cliente bate a 500; un envío legítimo nunca se acerca |

### 5.3 Batching y debouncing

- **Push ya batcheado** a 500 filas por RPC (BATCH en `push.ts`).
- **Debounce ya existente** de 2 s (`scheduleSync`) + coalescing del store: el
  Locker persiste **solo el diff** (`collectionPersistence`), así que escribir
  en el editor no reescribe la colección.
- **Fotos**: subida/bajada **secuencial con concurrencia limitada (2–3)** y
  **presupuesto por ciclo** (p. ej. 20 objetos), para no disparar 300 peticiones
  de Storage de golpe. El resto espera al siguiente ciclo.

### 5.4 Cuota de API (free tier: 1 GB Storage, 5 GB egress/mes, 500 MB DB)

| Riesgo de cuota | Mitigación |
|---|---|
| 12 peticiones REST por ciclo de pull × cada 45 s × cada pestaña | **subir el poll a 60–90 s adaptativo**, uno solo por pestaña (Web Locks ya lo hace) y `sync_pull` batcheado (§8.4, opcional) |
| Re-descarga de fotos | `cacheControl` inmutable + `content_hash` para no re-subir |
| Fotos gigantes | límite de 1 MB/objeto, 1280 px y thumb aparte; **tope por usuario** (p. ej. 250 MB ≈ 400 fotos) con medidor en la UI |
| `storage.list()` en cada ciclo (caro) | el barrido de huérfanos corre **como mucho 1 vez al día** y con presupuesto |
| Egress por listar/duplicar | el pull de fotos es *bajo demanda* y por referencia faltante, no un espejo completo |
| Peticiones abusivas | guardián (§5.2) + límites de la plataforma |

### 5.5 Cache local

Los watermarks **son** la caché de red (solo baja lo nuevo). En la UI, el
Locker ya se hidrata en el store y se refresca por `dataRevision`; las fotos se
cachean en IndexedDB + object URLs ref-contadas. La Fase 6 no necesita caché
nueva; necesita **no invalidarla** (escribir solo el diff).

### 5.6 Privilegios DDL: el agujero que el linter no ve (corregido)

Supabase concede por defecto `ALL` sobre cada tabla nueva de `public` a `anon`
y `authenticated`. Las migraciones previas revocaron `INSERT/UPDATE/DELETE`
tabla a tabla, pero **dejaron `REFERENCES`, `TRIGGER` y `TRUNCATE`**: medido el
2026-09-12, **las 11 tablas** (incluidas las tres del Locker) los concedían a
ambos roles, y el *database linter* no lo reporta porque no audita privilegios
de tabla.

`TRUNCATE` **no lo filtra RLS**, así que es el único de los tres que importa de
verdad (los otros dos son superficie sin caso de uso). Se corrige en
`20260912000014_revoke_ddl_privileges.sql`:

```sql
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables
  from anon, authenticated;
```

El segundo bloque hace que una tabla futura **nazca** con `SELECT` para los
roles de API (que es lo que cada migración vuelve a conceder explícitamente),
en vez de con `ALL`. `service_role` no se toca. Verificado tras aplicar:
`anon`/`authenticated` tienen 1 privilegio (`SELECT`) y `service_role` 7.

---

## 6. Compatibilidad con la Fase 8 (amigos, ver stats y Locker)

La Fase 8 necesita **que el servidor tenga la colección** (por eso depende de la
6) y **permisos de lectura ajena**. La Fase 6 no debe cerrarle ninguna puerta:

1. **Ninguna lectura ajena en la 6.** Las políticas son de propietario, así que
   la 8 es aditiva. Fase 8 añadirá, por ejemplo, una política `select` apoyada
   en una tabla `friendships` y un helper `public.is_friend(owner uuid)`.
2. **Columnas sensibles fuera de alcance.** `serial` y `smart_id` viven en la
   fila base. Si la 8 concediera `SELECT` sobre filas de amigos, filtraría la
   MAC del cubo. Decisión: **la 8 comparte a través de una proyección** (función
   `security definer` o vista `security_invoker = false`) que devuelve solo
   `name, brand, model, finish, palette, photos, status, tags…` y **nunca**
   `serial`/`smart_id`/`price_*`/`notes`. La Fase 6 crea los índices
   `(user_id, category_id)` que esa proyección necesitará.
3. **Stats ajenas** (solves) es el otro camino de la 8; no requiere cambios en
   la 6 (los solves ya sincronizan) pero sí su propia proyección y su opt-in.
4. **Fotos compartidas**: URLs firmadas de corta vida generadas en servidor. El
   bucket **nunca** se hace público (privacidad + egress).
5. **El chequeo de integridad** (§4.4) se diseña genérico por tabla para que la
   8 lo reutilice como "estado del locker de un amigo" sin duplicar consultas.

Riesgo de refactor evitado: si en la 6 se hubiera optado por un `for all` único
o por un bucket público, la 8 habría exigido reescribir políticas y cambiar la
forma de servir fotos. No se hace.

---

## 7. Auditoría línea por línea: hallazgos y correcciones

Estos son los puntos donde la implementación ingenua se rompe. Cada uno lleva su
corrección concreta; son el corazón de la fase.

**F1 — La cascada local no dispara tombstones.** `worker.ts:643/683` pone
`PRAGMA foreign_keys = ON` **después** de migrar, y nunca `recursive_triggers`
(por defecto OFF). Por tanto `DELETE FROM gear_categories` borra en cascada
tipos e items **sin ejecutar** sus `AFTER DELETE`. La nube conservaría los hijos
y el siguiente pull los resucitaría.
→ **Corrección:** el repositorio no delega en la cascada; borra **explícito y en
orden** (items → types → category) para que cada fila dispare su trigger. Es el
mismo patrón que `deleteSession` usa hoy para los solves. Alternativa
(descartada como principal): activar `recursive_triggers` globalmente, que
cambia el comportamiento de todas las cascadas del esquema.

**F2 — `deleteType` no propaga el re-alojo.** Hoy `ON DELETE SET NULL` re-cuelga
los items en su categoría **sin** tocar `updated_at`, y el push selecciona
`updated_at > watermark`: los items re-alojados **nunca se suben**. El otro
dispositivo los mantiene apuntando a un tipo que ya no existe.
→ **Corrección:** `deleteType` hace un `UPDATE gear_items SET type_id = NULL,
updated_at = <nuevo sello>` (con el reloj local, `nextLocalStamps`) antes de
borrar el tipo. El re-alojo viaja.

**F3 — `wipeLocal()` (claim "empezar de cero") no vacía el Locker.**
`SyncEngine.wipeLocal()` borra solves, sesiones, training, calendario y skills,
pero **no** gear ni fotos. Un "fresh" subiría acto seguido el Locker local a la
cuenta que el usuario pidió empezar de cero.
→ **Corrección:** añadir `GearRepository.clear()`, `clearAllPhotos()` y el
`local_clock_gear_*` a `wipeLocal()` (y purgar tombstones, como ya hace).

**F4 — `hasCloudData()` no ve el Locker.** Decide si se muestra el diálogo de
reclamación. Si la cuenta tiene Locker pero cero solves (un usuario que solo
colecciona), el diálogo no aparece y el merge sería silencioso.
→ **Corrección:** incluir `gear_items` (no categorías vacías) en
`SYNCABLE_TABLES`; contar items, no categorías.

**F5 — `replaceAll` (import/reset) fabrica tombstones que borran lo recién
importado.** `replaceAll` llama a `clear()` (que dispara `AFTER DELETE` y crea
un tombstone por id) y **luego** reinserta los mismos ids. En el push, los
bloques de fila van **antes** que los tombstones, pero el `deleted_at` del
tombstone puede quedar por encima del nuevo `updated_at` (milisegundos), y el
`delete … where updated_at <= deleted_at` borra en la nube la fila que se acaba
de subir; el siguiente pull la borra localmente. Pérdida de la importación.
→ **Corrección:** tras un `replaceAll`, **purgar de `sync_tombstones` los ids
reinsertados** (o no pasar por `clear()` cuando se preservan ids). Test
dedicado.

**F6 — Orden de pull con FKs locales.** Insertar un `gear_item` antes que su
categoría/tipo falla con `SQLITE_CONSTRAINT_FOREIGNKEY` y bloquea el pull para
siempre (se reintenta cada ciclo). Igual que el `sessions`→`solves` ya
documentado.
→ **Corrección:** `TABLE_DEFS` en orden categorías → tipos → items, más un
**guarda de huérfanos** que descarta (con aviso) una fila cuyo padre no existe
ni en la nube ni localmente, y avanza el watermark igual que hace `pull.ts` con
los solves huérfanos.

**F7 — `sync_apply` ignora columnas no declaradas.** Lección de M13
(20260912000010): `jsonb_to_recordset` con lista explícita. Si una columna de
gear no se declara, el push "parece" funcionar y el dato nunca sale del
dispositivo.
→ **Corrección:** las 26 columnas de `gear_items` (y las 9/8 de categorías y
tipos) están declaradas y escritas en `20260912000012`. Test que compara la
lista declarada con el mapper.

**F8 — Retención de tombstones sin gear.** El bloque de 90 días no conoce las
entidades nuevas; sus tombstones se acumularían.
→ **Corrección:** incluido en `20260912000012`.

**F9 — Borrado de cuenta deja las fotos en Storage.** `storage.objects` no tiene
FK a `auth.users`; el cascade borra las filas pero no los objetos.
→ **Corrección:** `delete-account` lista y borra el prefijo `{uid}/` (con
presupuesto y `remove([...])` en lotes), además del `wipeAccountLocalData()` que
ya vacía IndexedDB.

**F10 — El poller multiplica peticiones.** El ciclo hace 1 petición por tabla
(8 hoy, 11 con gear) + tombstones cada 45 s por pestaña.
→ **Corrección (parte de la fase):** poll adaptativo (60–90 s, y saltar si el
documento está oculto). **Mejora opcional diseñada** (§8.4): un `sync_pull`
batcheado.

**F11 — `updated_at` de categorías/tipos no está en el modelo de dominio.** El
mapper necesita el valor real; `rowToCategory`/`rowToType` hoy lo descartan.
→ **Corrección:** leerlo en el repo y exponerlo (o, mínimo, que el mapper lo lea
de la fila), sin romper `collectionModel` (que es puro).

**F12 — `is_demo` en gear.** Las tablas lo tienen; el repo nunca lo escribe. Un
gear demo creado en un dispositivo viajaría como no-demo.
→ **Corrección:** incluirlo en el mapper con default 0, o documentarlo como
inactivo. (Decisión: incluirlo, espejo 1:1.)
**F13 — Privilegios DDL de más en los roles de API.** Las 11 tablas concedían
`REFERENCES`/`TRIGGER`/`TRUNCATE` a `anon` y `authenticated`, y `TRUNCATE` no
pasa por RLS. No lo detecta el linter de Supabase.
→ **Corrección:** `20260912000014` (revoca en las existentes y en el ACL por
defecto). **Hallado y corregido durante esta auditoría** (§5.6, §10).

**F14 — Un payload parcial rompía el push entero.** `jsonb_to_recordset` con
declaración explícita deja `NULL` en una clave **ausente** (no aplica el
`DEFAULT` de la tabla). El primer `insert` de una categoría sin `is_demo`
violaba el `NOT NULL` y `sync_apply` **abortaba el lote**, dejando el sync
atascado. Apareció en la prueba funcional end-to-end.
→ **Corrección:** `coalesce` en toda columna `NOT NULL` de los tres bloques de
gear. Además de arreglar el payload parcial, blinda el alta futura de columnas
(una columna nueva que un cliente viejo no envíe ya no puede atascar el sync).
**Bug real encontrado y corregido en esta auditoría** (§10).

---

### 7.1 Hallazgos de la ejecución del cliente (2026-09-12, todos corregidos)

**F15 — SQLite aborta cualquier conflicto dentro de un trigger disparado por un
UPSERT. Bug real, en producción, anterior a esta fase.**
Un trigger `AFTER INSERT/UPDATE` que escribe el flag dirty con
`INSERT OR REPLACE INTO app_meta` es **ilegal** cuando el statement que lo
dispara es la rama `DO UPDATE` de un `INSERT … ON CONFLICT`: SQLite se niega a
resolver *cualquier* conflicto dentro de ese trigger — también uno que el
sub-statement resolvería solo con `OR REPLACE` o `OR IGNORE` — y aborta el
statement **exterior** con
`SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed: app_meta.key`.
Consecuencia medida: `CalendarRepository.upsert` (que sí usa `ON CONFLICT`)
**lanzaba al editar cualquier tarea del calendario por segunda vez** y la
edición no llegaba ni a la base de datos ni a la nube; los `upsert` del Locker
habrían fallado exactamente igual.
→ **Corrección:** el flag se escribe con `INSERT … ON CONFLICT(key) DO UPDATE`
(la única forma que SQLite acepta en ese contexto). La 037 nace ya correcta y la
nueva migración local **`038_upsert_safe_dirty_triggers`** recrea con ese idioma
los ocho triggers de la 028/031 que ya estaban desplegados. Test de regresión
(`sync-trigger-safety.test.ts`) que además impide reintroducir el patrón.
**Bug real encontrado y corregido en esta auditoría.**

**F16 — El eco de un tombstone destruía la edición más reciente (pérdida de
datos real, en el núcleo del sync).**
Al aplicar un tombstone remoto, el `DELETE` local dispara el trigger y crea un
tombstone **nuevo** con `deleted_at = MAX(now, OLD.updated_at + 1)` — es decir,
con un sello **más reciente** que el que lo provocó. Ese eco se subía en el
siguiente ciclo y, al llegar a la nube, `updated_at <= deleted_at` ya se cumplía
para la fila que otro dispositivo había editado **después** del borrado: la
borraba físicamente en la nube, para todos los dispositivos y para siempre. Es
exactamente lo contrario de la garantía del borrado condicional (LWW).
Reproducido en un test de dos dispositivos (`N) … no echo escalation`),
comprobando que la fila editada desaparecía de la nube.
→ **Corrección:** quien aplica un tombstone remoto borra en local y **no
anuncia nada** (`repositories/tombstone-echo.ts`). El guardián
«¿esta fila está realmente condenada?» es deliberado: un dispositivo que ya
había borrado la fila por su cuenta conserva su tombstone pendiente, o el
borrado nunca llegaría a la nube y la fila resucitaría en el siguiente pull.
Aplicado a los ocho deletes versionados (solves, sessions, tasks, skills,
training_sessions y las tres del Locker).
**Bug real encontrado y corregido en esta auditoría.**

**F17 — Un dispositivo rezagado puede resucitar una fila que la nube ya borró
(límite conocido, NO corregido).**
El watermark de push va por detrás del de pull: las filas que acaban de bajarse
se re-suben una vez (el ciclo de más que ya documenta el test A). Si entre la
bajada y esa subida otro dispositivo borra la fila, la re-subida la **recrea**
en la nube. Antes del arreglo de F16 el eco acababa matándola otra vez (a costa
de destruir ediciones nuevas); ahora la fila vuelve a vivir y el borrado se
pierde (el tombstone original ya está por detrás del watermark y no se
re-aplica). Medido en el test `N`: la categoría borrada reaparece en la nube y
en el dispositivo A.
→ **Corrección propuesta (siguiente iteración, no en esta fase):** en
`sync_apply`, rechazar el `insert` cuando existe un tombstone con
`deleted_at >= excluded.updated_at` ("un tombstone igual o posterior gana"). Es
una regla de una línea por tabla, del lado servidor, que no afecta a la
resurrección legítima: una edición posterior al borrado lleva un `updated_at`
mayor y sigue ganando. Requiere migración de nube nueva (función `sync_apply`
recreada) y su validación por rollback.
**Bug real NO corregido — documentado con repro exacto.**

**F18 — Borrar una categoría es definitivo en local aunque un hijo se editara
después (límite de diseño).**
Borrar la categoría es borrar el **padre**: sin él un item no tiene sitio en
esta base de datos (el FK cascada), así que un item editado en otro dispositivo
después del borrado sobrevive en la nube pero se pierde en el dispositivo que
recibe el tombstone — y no puede volver a bajarse mientras la categoría no
exista (la guarda de huérfanos lo descarta). Recuperarlo exigiría un contenedor
alternativo ("Recuperados"), que es una decisión de producto.
→ **Decisión:** se mantiene el comportamiento actual (coherente con
`sessions`→`solves`, que ya hace lo mismo) y se fija con un test explícito
(`N) deleting a CATEGORY is final for BOTH devices`), de modo que cambiarlo sea
deliberado y no accidental.
**Comportamiento fijado con test.**

---

## 8. Plan de ejecución por capas

### 8.1 Migración local `037_gear_sync` (paquete `@cubeforge/database`)

Añade, en `packages/database/src/migrations/migrations.ts`, tres bloques:

1. La tabla `gear_photo_sync` (§3.3).
2. Los **triggers de tombstone** sobre las tres tablas, con el idioma exacto de
   la 031 (ms + floor `OLD.updated_at + 1`, y `WHEN (OLD.is_demo = 0)`):

```sql
DROP TRIGGER IF EXISTS trg_tombstone_gear_items;
CREATE TRIGGER IF NOT EXISTS trg_tombstone_gear_items
AFTER DELETE ON gear_items
FOR EACH ROW
WHEN (OLD.is_demo = 0)
BEGIN
  INSERT OR REPLACE INTO sync_tombstones (entity, entity_id, deleted_at)
  VALUES (
    'gear_items', OLD.id,
    MAX(CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), OLD.updated_at + 1)
  );
END;
-- idénticos para gear_types y gear_categories
```

3. Los **triggers de dirty** (`AFTER INSERT`/`AFTER UPDATE` →
   `app_meta.sync_dirty = '1'`) sobre las tres tablas, con el idioma
   **UPSERT-seguro** de F15 (`INSERT … ON CONFLICT(key) DO UPDATE`), **no** el
   `INSERT OR REPLACE` de la 028: los `upsert` del Locker usan `ON CONFLICT` y
   SQLite aborta cualquier resolución de conflicto dentro de un trigger
   disparado por esa rama. La 028 se corrige para el resto de tablas en la
   migración local nueva `038_upsert_safe_dirty_triggers`.

> El invariante del test de migraciones ("toda migración toca
> CREATE/ALTER/DROP") se cumple sin allowlist: hay `CREATE TABLE`/`CREATE
> TRIGGER`.

### 8.2 Repositorio (`GearRepository`)

- `findCategoriesSince`/`findTypesSince`/`findItemsSince(wm, {limit,
  afterUpdatedAt, afterId})` (cursor keyset como `SolvesRepository`).
- `findUpdatedAts(table, ids)` y `findExistingCategoryIds`/`findExistingTypeIds`
  por lotes de 400 (LWW del pull y guarda de huérfanos, sin N+1).
- `upsertCategory/Type/Item` que escriben el `updated_at` de la nube **tal
  cual** salvo con `{ local: true }`, que toma el sello monotónico.
- `deleteCategory`/`deleteType` corregidos (F1/F2).
- `delete*IfNotNewer` sin eco de tombstone (F16).
- `replaceAll` purga tombstones de los ids reinsertados (F5).
- Ledger de fotos (`loadPhotoSyncStates`, `upsertPhotoSyncState`, …) y `clear()`
  (que vacía también el ledger) para wipe/claim.

### 8.3 Motor (`packages/sync-engine`)

| Fichero | Cambio |
|---|---|
| `types.ts` | +3 entidades en `SyncableEntity` y `SYNCABLE_TABLES` |
| `mappers.ts` | `gearCategoryToCloudRow`/`cloudRowToGearCategory` y análogos (categorías, tipos, items) |
| `push.ts` | tres `pushPageable` en orden padre→hijo |
| `pull.ts` | +3 entradas en `TABLE_DEFS` (orden) y sus casos en `applyRows` con guarda de huérfanos |
| `tombstones.ts` | casos `gear_*` en `applyRemoteTombstones` |
| `SyncEngine.ts` | `wipeLocal()` con gear+fotos (F3); `hasCloudData()` con gear (F4) |

### 8.4 Servicio de fotos (web, `collectionPhotoSync.ts`) — implementado

`runPhotoSync()` se engancha al final de **cada ciclo de filas** (y al claim
«empezar de cero»), no a un temporizador propio: las referencias que acaban de
llegar son las que hay que bajar, y las que acaban de irse las que hay que
subir. Dentro del servicio:

- `planPhotoSync()` — función **pura** (sin I/O) que decide qué subir, qué bajar
  y qué reconciliar; toda la política (huella, backoff, huérfanos) se prueba sin
  red.
- Subida/bajada con `PhotoStoragePort` (objeto real: bucket privado
  `locker-photos`, `cacheControl` de un año porque la ruta es inmutable) y
  `PhotoBlobStore` (IndexedDB).
- Presupuesto de `MAX_OBJECTS_PER_CYCLE = 20` objetos (una foto = 2: `full` y
  `thumb`), huella `widthxheight@addedAt` para no re-subir lo que no cambió,
  backoff exponencial (30 s/2 min/10 min) **en ambas direcciones**, y throttle
  de 15 s dentro de la pestaña.
- Reconcilización: un ledger cuyo `photo` ya no está referenciado en ningún item
  se borra de Storage y del ledger (nunca al revés: la **referencia** manda; si
  faltan los bytes se conserva y se reintenta).

**Mejora opcional (misma fase, si se quiere):** RPC `sync_pull(watermarks
jsonb)` que devuelve en **una** respuesta todas las tablas con filas nuevas.
Reduce ~11 peticiones a 1 por ciclo y hace el poll mucho más barato. Se diseña
con límite por tabla para no materializar historiales enormes; si se implementa,
`pull.ts` conserva el camino actual como fallback. Se marca como
*no imprescindible*: la corrección va primero.

### 8.5 Nube y Storage

1. **Aplicar** las migraciones (`supabase db push --linked`) — **hecho**, §10.
2. **Verificar** post-push (SQL, no el mensaje de éxito):
   tablas + RLS + grants + política de Storage + conteos.
3. **Probar** el ciclo real con un usuario (subir/bajar/borrar una foto,
   dos dispositivos).

### 8.6 Web

- `collectionStore.ts`: `requestSync()` ya se llama en cada escritura del
  Locker; se mantiene.
- `services/sync.ts`: `runPhotoSync` en el callback de ciclo, `clearLocalPhotos`
  en los hooks del motor, y `wipeLocal` limpiando el Locker.
- **Pendiente (UI, no bloquea nada):** un indicador propio del Locker
  (pendiente/subiendo/bajando/error). Hoy el estado que ya existe
  (`syncStore.status`, en Ajustes → Cuenta) cubre el ciclo de filas, y las
  fotos no tienen contador visible. El medidor de almacenamiento
  (`estimateCollectionStorage`) sigue mostrando solo lo local.

---

## 9. Tests

**`packages/database` (sqlite-wasm real, con `PRAGMA foreign_keys = ON`):**
- migración 037: triggers presentes, `deleted_at` con floor, `is_demo` no
  genera tombstone, `gear_photo_sync` con sus índices.
- cascada explícita: borrar una categoría produce **tres** tombstones (item,
  tipo, categoría) — el test que evita F1.
- `deleteType` re-aloja con sello nuevo (F2) y el item queda por encima del
  watermark.
- `replaceAll` no deja tombstones que maten lo reimportado (F5).

**`packages/sync-engine` (extiende `sync.integrity.test.ts`, dos dispositivos):**
- ida y vuelta de las tres tablas; el orden padre→hijo no falla con FKs.
- push obsoleto rechazado por LWW; pull más nuevo gana; pull más viejo se ignora.
- tombstone de item borra; item editado después del borrado sobrevive.
- huérfano cloud-side se descarta sin bloquear el ciclo (F6).
- `hasCloudData` con solo Locker (F4); `wipeLocal` deja el Locker y las fotos
  vacíos (F3).
- el mapper y la lista declarada en `sync_apply` cubren las mismas columnas
  (F7): un test que falle si divergen.

**SQL/nube (manual, documentado en `supabase/README.md`):**
- Las migraciones en `begin; … rollback;` (ya ejecutado, §10).
- Tras aplicar: `select` de políticas/permisos, `GET` con anon (debe dar 401/404
  sobre bucket privado) y con usuario (200), y el guardián rechazando 4 001
  filas.

**Limitación honesta:** sin Docker no hay Postgres local ni Storage local; el
camino de Storage se prueba en el proyecto cloud con un usuario real, no en CI.

---

## 10. Ejecución realizada y pendiente

**Aplicado a la nube y verificado (2026-09-12):**

1. Diagnóstico completo por CLI y por SQL al remoto (§1).
2. Escritura de **cuatro** migraciones de nube:
   - `20260912000011_gear_sync_schema.sql` — tablas + RLS + grants + índices
   - `20260912000012_gear_sync_apply.sql` — sync_apply con gear + guardián
   - `20260912000013_locker_photos_bucket.sql` — bucket + políticas Storage
   - `20260912000014_revoke_ddl_privileges.sql` — hardening de privilegios (F13)
3. **Validación de las cuatro contra el Postgres 17.6 real** dentro de
   `begin; … rollback;` (sin error, incluidas las políticas sobre
   `storage.objects`), y `supabase db push --dry-run --linked`.
4. **`supabase db push --linked`**: las cuatro aplicadas. Paridad **15/15**.
5. **Verificación por SQL, no por el mensaje de éxito**: 3 tablas, 3 políticas
   de propietario, 4 políticas de Storage, bucket privado de 1 MB con sus MIME,
   `anon`/`authenticated` con `SELECT` únicamente, `service_role` con 7
   privilegios.
6. **Prueba funcional end-to-end** (transacciones revertidas): payload parcial
   con defaults correctos, push obsoleto **rechazado** por LWW, tombstone
   posterior borra item+tipo (la categoría sobrevive), tombstone anterior al
   edit **no** borra, y el guardián rechaza 4 001 filas y un payload no-objeto.
7. **Datos reales intactos** al terminar: `solves` y `sync_tombstones` con sus
   filas, `gear_items` a 0.

> Nota de proceso: como `20260912000012` se aplicó y luego se corrigió (F14),
> la migración se re-aplicó con
> `supabase migration repair --linked --status reverted 20260912000012` +
> `supabase db push --linked --include-all`. Es un camino válido **solo**
> porque la migración aún no tenía ningún cliente consumiéndola; una vez el
> código esté desplegado, cualquier cambio va en una migración **nueva**.

**Implementado y verificado el 2026-09-12 (código cliente, §8):**

1. **Migración local `037_gear_sync`**: tabla `gear_photo_sync`, triggers de
tombstone (ms + floor, `is_demo` exento) y triggers de dirty sobre las tres
tablas.
2. **Migraciones locales `038`** (F15) y el arreglo de ecos (F16) en los ocho
deletes versionados.
3. **`GearRepository`** completo: cursores `find*Since` con paginación keyset,
`findUpdatedAts`, `findExistingCategoryIds`/`findExistingTypeIds`, upserts
idempotentes, `deleteCategory`/`deleteType` corregidos (F1/F2), `replaceAll`
con purga de tombstones (F5), ledger de fotos y `clear()`.
4. **Motor**: `mappers.ts` (los tres mapeos en ambos sentidos), `push.ts`
(padre→hijo, por lotes), `pull.ts` (`TABLE_DEFS` en orden + guardas de
huérfanos por categoría/tipo), `tombstones.ts`, `types.ts`, `SyncEngine.ts`
(`wipeLocal` con Locker + fotos, `hasCloudData` contando items).
5. **Servicio de fotos** (`collectionPhotoSync.ts`): subida/bajada/reconciliación
con puertos inyectables, presupuesto por ciclo, huella de contenido, backoff en
ambas direcciones y throttle dentro de la pestaña; enganchado al ciclo de filas
y al claim «empezar de cero» desde `services/sync.ts`.
6. **`delete-account`**: purga del prefijo `{uid}/` en Storage (F9).

Verificación ejecutada (todo en verde):

```bash
npx vitest run packages/database        # 257 tests (19 ficheros)
npx vitest run packages/sync-engine     #  59 tests (5 ficheros)
npx vitest run apps/web/src             # 774 tests (72 ficheros)
npx vitest run packages/state packages/training packages/statistics \
               packages/analysis-engine packages/timer-engine   # 617 tests
cd apps/web && npx tsc -b               # typecheck limpio
```

Tests nuevos de esta fase: `gear.repository.test.ts` (21, incluidos cascada,
re-alojo, purga de tombstones, cursores y ledger), `sync-trigger-safety.test.ts`
(8, F15 y la regla editar≠borrar), `collectionPhotoSync.test.ts` (14, plan y
orquestador con puertos falsos) y las secciones M–R de
`sync-engine/src/__tests__/sync.integrity.test.ts` (10, dos dispositivos).

**Lo único que queda:** la prueba manual con un usuario real en dos
dispositivos (subir una foto en uno y verla en el otro), que necesita el
proyecto cloud y no puede correr en CI:

```bash
# con la app en marcha y sesión iniciada en dos navegadores/perfiles
# 1) crear categoría + item + foto en A  2) comprobar la descarga en B
# 3) borrar la foto en A                 4) comprobar el borrado en B
# 5) supabase storage ls en el proyecto linkado (objetos con prefijo {uid}/)
```

Antes de tocar cualquier migración de nube ya aplicada, comprobar deriva:

```bash
supabase migration list --linked   # local debe igualar remoto
```

---

## 11. Riesgos y límites honestos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Un bug de sync borra la colección entera | RLS de propietario + LWW + tombstones LWW + backup/export ya existente + validación previa y tests; **nada de migraciones destructivas en la nube** |
| R2 | Duplicados de `smart_id` entre dispositivos | sin índice único (evita cuelgues), reconciliación en el cliente + chequeo de integridad |
| R3 | Fotos huérfanas en Storage | GC diario + borrado en `delete-account` |
| R4 | Cuota del free tier (1 GB Storage / 5 GB egress) | límites por objeto y por usuario, cache inmutable, presupuesto por ciclo |
| R5 | Sin Postgres/Storage local (no Docker) | validación por rollback contra el remoto + integración manual; CI de nube inexistente (se puede añadir, hoy no hay) |
| R6 | Migración de nube aplicada a mano y sin CI | `supabase migration list` como comprobación de deriva antes de tocar nada |
| R7 | El poller gasta cuota con muchas pestañas | Web Locks + poll adaptativo (y `sync_pull` opcional) |
| R8 | Conflicto real de edición simultánea del mismo item | LWW por fila, documentado y aceptado; sin CRDT en v1 |
| R9 | **F17**: un dispositivo rezagado resucita en la nube una fila ya borrada (el borrado se pierde) | documentado con repro; el arreglo es la guarda de tombstone en `sync_apply` (§7.1, siguiente iteración de nube) |
| R10 | **F18**: el borrado de una categoría gana en local sobre un hijo editado después | comportamiento fijado con test; recuperarlo exigiría un contenedor "Recuperados" (decisión de producto) |

**Lo que este plan NO resuelve (y lo dice):** compartir el Locker con amigos
(fase 8), la bitácora de setups (fase 7, descartada), un CI que aplique
migraciones, y la prueba de Storage en CI.

---

## 12. Fuera de alcance

- **Fase 8**: amigos, ver stats, ver Locker. Depende de esta (§6).
- **Fase 7** (bitácora de setups): descartada; `gear_items` ya guarda
  suficiente para retomarla sin migración.
- Preferencias de UI (tema, idioma, layout) siguen device-local.
- Catálogo de algoritmos con contenido de usuario: fuera (RFC-024 §Unresolved).

---

## 13. Auditoría de seguridad posterior (misma fecha)

Inmediatamente después de cerrar la Fase 6 se hizo una auditoría de seguridad
crítica de todo el sistema (base de datos, cuentas y sync/desync):
**[`../10-security/Auditoria-2026-09-12.md`](../10-security/Auditoria-2026-09-12.md)**.
Encontró **un fallo crítico de integridad del sync que este plan no había
contemplado** y que afectaba por igual a las tablas anteriores al Locker: los
sellos temporales no se acotaban en la nube, así que una sola fila con el reloj
adelantado fijaba el cursor de pull **de todos los dispositivos del usuario** en
el futuro, apagando el sync para siempre y sin síntoma visible (la UI seguía
diciendo `idle`). Corregido, probado y desplegado en la migración
`20260912000015`, junto con la null-safety de payloads parciales (la lección de
M13, aplicada ahora a las 7 tablas antiguas, no solo al Locker) y el índice que
faltaba en `solves`.

Consecuencias para este plan:

- **R9 (F17) queda resuelta de raíz**: el cursor ya no puede saltar al futuro
  porque es el servidor el que acota el sello. Se mantiene documentada como
  residual del dispositivo que *arrastra* el reloj mal (su divergencia queda
  confinada a sus propias filas, no se propaga).
- **R7 (cuota por pestañas) pasa a ser el riesgo abierto más alto** y sube a
  prioridad P1 en el plan de remediación de la auditoría: el poller actual hace
  un ciclo completo cada 45 s aunque no haya cambios, sin backoff ante error.
- **R4** sigue en pie, con el matiz de que el consumo sostenido del poller es
  hoy mayor que el de las fotos.
- **Prerrequisito nuevo para la Fase 8**: la unicidad de `profiles.handle`. Sin
  ella, el estante social permite suplantación trivial; y el índice único a
  secas cuelga el sync (mismo antipatrón documentado en §3 para `smart_id`), así
  que necesita reserva previa en el cliente.
