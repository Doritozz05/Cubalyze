# Auditoría de seguridad — Supabase, cuentas y sync (2026-09-12)

> **Estado real:** auditoría ejecutada contra el proyecto linkado
> `upojrxcohcdjlofnirrv` (Postgres 17.6) con la CLI de Supabase. **3 hallazgos
> corregidos y desplegados** (migración `20260912000015`), **5 pendientes** con
> plan de remediación (§7) y **2 residuales aceptados** a conciencia (§8).
> Rama `feat/cube-collection`. Nada commiteado.

## 0. Resumen ejecutivo

El veredicto es incómodo de resumir en una palabra, así que lo separo por
superficie:

| Superficie | Veredicto | Por qué |
|---|---|---|
| **Aislamiento entre usuarios** (RLS) | **Sólido** | 11/11 tablas con RLS y política de propietario; ninguna `USING (true)`; `anon`/`authenticated` solo `SELECT`; escrituras solo por RPC. |
| **Integridad del sync** (el corazón del producto) | **Tenía un fallo crítico** | Un solo sello temporal en el futuro apagaba el sync de todos los dispositivos del usuario, para siempre y en silencio. **Corregido y probado.** |
| **Disponibilidad / cuota** | **Mejorable** | Sin backoff ni sondeo adaptativo: ~960 peticiones/hora por pestaña abierta, también con la API caída. |
| **Ciclo de vida de la cuenta** | **Correcto** | OAuth PKCE, validación de JWT, purga de Storage y borrado local en cascada. |
| **Cabeceras web** | **Con una grieta** | CSP buena en general, pero `connect-src` abierto a *cualquier* https (y la doc dice lo contrario). |

La lección de fondo: **los datos estaban bien protegidos, pero el protocolo que
los mueve no estaba blindado**. RLS impide que otro usuario te toque una fila; no
impide que *tu propio* dispositivo envenene el cursor que todos tus dispositivos
usan para sincronizarse.

## 1. Metodología y evidencia

Sin Docker no hay Postgres local, pero `supabase db query --linked` permite
ejecutar SQL contra el remoto dentro de `begin; … rollback;`. **Toda** prueba de
esta auditoría se hizo así: no destructiva, sobre el esquema real y con el rol
real (`authenticated` + claims JWT), que es exactamente el camino que usa
PostgREST.

- Inventario: `pg_policies`, `information_schema.{columns,routine_privileges}`,
  `pg_indexes`, `pg_proc`, `storage.buckets`.
- Pruebas de comportamiento: payloads parciales, sellos en el futuro, LWW
  viejo/nuevo, tombstones fuera de orden, escrituras cruzadas entre usuarios.
- Linter: `supabase db advisors --linked` (solo marca el `SECURITY DEFINER` de
  `sync_apply`, que es intencional; y una opción de Auth fuera de alcance).
- Lado cliente: lectura línea por línea de `packages/sync-engine`,
  `packages/database/repositories`, `apps/web/src/services`, `vercel.json`,
  `index.html` y la Edge Function `delete-account`.

## 2. Lo que está bien (verificado, no asumido)

Merece constar porque condiciona los arreglos: no había que reforzar la
autorización, sino el protocolo.

| Control | Evidencia |
|---|---|
| RLS de propietario en las 11 tablas | `pg_policies`: `qual = with_check = (user_id = (select auth.uid()))`, `cmd = ALL`, ninguna permisiva. `(select auth.uid())` es initplan: se evalúa una vez por consulta. |
| Escrituras fuera de RLS | `authenticated` solo tiene `SELECT`; un `INSERT` directo da `42501 permission denied` (comprobado). Todo pasa por `sync_apply`. |
| `sync_apply` no confía en el payload | Exige `auth.uid()`, comprueba `rec.user_id = uid::text` en **los 11 bloques** e inserta con `uid`, no con el `user_id` recibido. Un payload con el id de otro usuario se descarta (`skipped`) sin tocar ninguna fila (probado). |
| Guardián de payload | `sync_payload_guard` acota 8 MB y 4 000 filas **antes** de materializar nada; el cliente bate a 500 filas/RPC (`push.ts`). |
| Storage | Bucket `locker-photos` **privado**, `file_size_limit` 1 MiB, MIME `jpeg/png/webp`, 4 políticas por carpeta `{uid}/…`. `anon` no tiene ninguna. |
| Aislamiento físico | PK partida por `user_id` en todas las tablas; `ON DELETE CASCADE` desde `auth.users`. |
| Ciclo de cuenta | OAuth por **PKCE** (sin tokens en la URL/historial), `delete-account` valida el JWT con `getUser(token)`, purga `{uid}/` de Storage y borra; el cliente borra su copia local y regenera identidad anónima. |
| Sin FK en la nube | Decisión documentada (migración 11): un push con el hijo antes que el padre no puede colgar el lote. La integridad referencial vive en el cliente. |

## 3. Hallazgos corregidos

### C1 · CRÍTICO — El cursor de pull se envenenaba para siempre

**Vector.** `sync_apply` no acotaba `updated_at`. Cualquier dispositivo con el
reloj adelantado (o un cliente manipulado) podía subir **una sola fila** con un
sello lejano, y ocurrían dos cosas, ambas irreversibles:

1. **Ganaba el LWW para siempre.** El predicado es
   `excluded.updated_at >= tabla.updated_at`: con `99999999999999` (año 5138)
   almacenado, ninguna edición posterior de ningún otro dispositivo puede pasar.
2. **Cegaba el pull de todos.** El pull avanza su watermark al **máximo** de las
   filas descargadas (`pull.ts`, `maxWm`). Al descargar la fila envenenada, cada
   dispositivo fija su cursor en el año 5138 y **deja de descargar esa tabla**.
   El sync sigue diciendo `idle`. No hay autoreparación: no existe ningún camino
   en el motor que reinicie un watermark.

**Prueba (transacción revertida, Postgres real).** Un dispositivo sube un solve
con `updated_at = 99999999999999`; otro, con el reloj correcto, registra tres
solves reales:

```
rows_visible_to_a_fresh_pull_cursor → 0
```

Los tres solves reales son invisibles para siempre. Y el perfil:

```
display_name │ updated_at
future-clock │ 9.9999999999999e+13     ← la edición legítima posterior se descartó
```

**Arreglo (migración 15).** `least(<sello>, now_ms + 5min)` en los 11 bloques.
Se **acota, no se rechaza**, y esa decisión es deliberada: rechazar lanzaría una
excepción y, como el RPC es atómico, abortaría el lote entero — el mismo cuelgue
que el guardián de M13 existe para evitar. La gracia de 5 min deja intacto el
desfase normal entre dispositivos (NTP) y reduce la ventana de daño de "para
siempre" a 5 minutos. Como el predicado LWW compara con `excluded.updated_at`,
que ya viene acotado, un sello futuro **sigue ganando su conflicto** (como debe)
pero se guarda en `now()`: nunca puede colarse en el cursor de nadie.

Además se comprobó que **ninguna fila existente está envenenada** (0 filas con
sello futuro en las 8 tablas), así que no hizo falta reparar datos.

### A1 · ALTO — Un payload parcial atascaba el sync completo

**Vector.** `jsonb_to_recordset` deja `NULL` en una clave **ausente**: no aplica
el `DEFAULT` de la tabla. Y pasar `NULL` explícito a una columna `NOT NULL`
viola la restricción. La migración 12 arregló esto para el Locker
(`coalesce`) pero **las siete tablas anteriores seguían expuestas**. El fallo es
peor de lo que parece por dos razones:

- El RPC es **atómico**: una sola fila mala revierte solve + sessions + profiles
  + training + Locker. Es decir, un problema en un campo secundario apaga *todo*.
- El watermark no avanza, así que el cliente reintenta el mismo lote en cada
  ciclo: **cuelgue permanente**.

**Prueba.** Un payload de `profiles` sin la clave `handle`:

```
ERROR: 23502: null value in column "handle" of relation "profiles" violates not-null constraint
CONTEXT: PL/pgSQL function sync_apply(jsonb) line 77 at SQL statement
```

**¿Se alcanza en la práctica?** El mapper actual siempre emite todas las claves,
así que no, con el cliente de hoy. El disparador realista es un **desfase de
versiones**: el service worker mantiene versiones antiguas vivas, y el día que se
añada a una tabla una columna `NOT NULL` (como se añadió `handle`), todo cliente
no actualizado deja de sincronizar del todo. Fue exactamente el fallo de M13.

**Arreglo.** `coalesce` en **toda** columna `NOT NULL` de los 11 bloques, con el
**mismo default que declara la tabla** (verificado contra
`information_schema.columns`), incluidas las claves de identidad y las duraciones
—que se rellenan pero **no se acotan** (§8, residual R1).

### H3 · BAJO-MEDIO — Tombstones que nunca se purgaban

**Vector.** `sync_tombstones.entity` no está restringido y la retención solo
reconoce las ocho entidades con rama de borrado físico. Un tombstone con
`entity = 'training_attempts'` (sin rama) caía en un `and (…)` siempre falso y
**se quedaba para siempre**. Crecimiento no acotado: 4 000 filas por llamada,
sin límite de llamadas.

**Arreglo.** La retención purga también las entidades desconocidas pasados 90
días. Deliberadamente **sin allow-list**: rechazar entidades desconocidas
reintroduciría A1 en el futuro.

## 4. Hallazgos pendientes

### A3 · ALTO — Sin control de cuota propio ni backoff

El poller del cliente ejecuta un **ciclo completo cada 45 s incondicionalmente**,
haya cambios o no (`sync.ts`, con un comentario explícito de que se hace así para
no perderse ediciones de otros dispositivos). Cada ciclo son **12 peticiones**:
1 RPC `sync_apply` + 11 consultas de pull (10 tablas + tombstones). Eso son
**~960 peticiones por hora y pestaña abierta**, y **no hay backoff**: si la API
devuelve error o se agota la cuota, el poller sigue disparando cada 45 s en cada
pestaña de cada dispositivo. La UI queda en `error` y reintenta indefinidamente.

Matices que no quiero exagerar: el razonamiento del comentario es correcto
(gatear solo por el flag local haría que este dispositivo no viera los cambios de
otros), la plataforma impone sus propios límites, y el coste real es más de
egress/latencia que de una cuota concreta que pueda citar. El problema es que no
hay **ningún** control de producto, ni adaptación al estado.

**Arreglo propuesto** (§7·P1): sondeo adaptativo (rápido con la pestaña visible y
actividad reciente, lento en reposo) + backoff exponencial con jitter ante
`429`/`5xx`/red caída, compartido entre pestañas. Se conserva la frescura
multi-dispositivo porque el intervalo solo se estira cuando no hay actividad.

### M1 · MEDIO — `profiles.handle` sin unicidad (bloquea la Fase 8)

`profiles` solo tiene PK por `user_id`: **nada impide dos usuarios con el mismo
handle**. En la Fase 8 (amigos, "ver stats y Locker") eso es suplantación
trivial: te registro el handle de otro y sus amigos te añaden.

Ojo con el arreglo obvio: un índice `UNIQUE` a secas **cuelga el sync**, porque
un `unique_violation` dentro de `sync_apply` revierte el lote y el watermark no
avanza — el mismo antipatrón que ya está documentado para `gear_items.smart_id`.
Necesita reserva previa en el cliente (`handle` reclamado antes de publicar) y un
manejador que reasigne en vez de fallar.

### M2 · MEDIO — Faltaba el índice `solves(user_id, session_id)` — **corregido**

La guarda de borrado de `sessions` filtra `solves` por `(user_id, session_id)` y
ese índice no existía. El `EXPLAIN` contra producción lo confirmó:

```
Index Scan using idx_solves_user_cube on solves sv
  Index Cond: (user_id = '…')
  Filter: ((updated_at > 1) AND (session_id = 'x'))
```

El planificador usa el índice de `cube_id` y **filtra** por `session_id`: cada
tombstone de sesión recorre el índice entero del usuario (100 000 solves = 100 000
entradas por borrado). Añadido en la migración 15.

### M3 · MEDIO — `connect-src` abierto y documentación que no coincide

`vercel.json` declara `connect-src 'self' https: wss:` — es decir, **cualquier**
host https. Si algún día entra un XSS, la exfiltración a un dominio del atacante
está permitida. Y `docs/10-security/README.md` afirma literalmente que el CSP
tiene "`connect-src` acotado", lo que hoy no es cierto: la documentación de
seguridad promete más de lo que la configuración cumple.

### M4 · MEDIO — Falta HSTS

`vercel.json` no envía `Strict-Transport-Security`. Vercel fuerza HTTPS, pero sin
HSTS el primer acceso por `http://` sigue siendo interceptable (SSL-strip).

### M5 · MEDIO — Logs en claro persistidos en `localStorage`

`boot/logCapture.ts` guarda hasta 400 entradas de consola en `localStorage` sin
redactar, y los caminos de auth/sync registran errores con `console.warn(err)`.
Es un buffer pensado para diagnóstico (con su visor), pero es persistencia en
claro de datos del usuario sin política de redacción ni caducidad.

### M6 · MEDIO — `signOut()` revoca la sesión de **todos** los dispositivos

`supabase.auth.signOut()` sin `scope` usa el default de supabase-js
(`global`): cerrar sesión en el portátil invalida los refresh tokens del móvil.
No es una vulnerabilidad —si acaso endurece— pero es una decisión de producto
tomada por defecto y sin documentar. Si se quiere el comportamiento por
dispositivo, hay que pasar `{ scope: 'local' }` explícitamente.

## 5. Hallazgos menores e informativos

| ID | Hallazgo | Nota |
|---|---|---|
| B1 | `Access-Control-Allow-Origin: *` en `delete-account` | Aceptable: la función no usa cookies, exige `Authorization: Bearer` y valida el JWT. No hay CSRF posible. Merece un comentario en el código. |
| B2 | `handle_new_user` es punto único de fallo | Si el `insert` del perfil falla, el alta entera falla. Es *fail-closed* (preferible a una cuenta sin perfil), pero conviene una reconciliación: el cliente puede crear el perfil si falta tras el login. |
| B3 | Privilegios DDL de más en las 11 tablas | `REFERENCES/TRIGGER/TRUNCATE` para `anon`/`authenticated` (default de Supabase que las migraciones previas no revocaron). **Ya corregido** en la migración 14; el linter no lo detecta. |
| B4 | Retención de tombstones en **cada** llamada a `sync_apply` | 8 subconsultas `NOT EXISTS` por RPC. Con muchos tombstones, coste por llamada. Mejor en un cron (`pg_cron`) que en el camino caliente. |
| B5 | `auth` no auditado en el dashboard | El código solo ofrece Google OAuth, así que las clases de fallo de contraseña (fuerza, enumeración, filtrado de credenciales) **no aplican** — pero eso es una propiedad de la *configuración*, no del repo. Hay que confirmar en el dashboard que email/password está deshabilitado y revisar la allow-list de redirect URLs. |

## 6. Estado tras el arreglo

Migración `20260912000015_sync_apply_hardening.sql` aplicada y **verificada por
SQL, no por el mensaje de éxito**:

- Paridad local↔remota **16/16**.
- `pg_get_functiondef` desplegada contiene el acotado (`max_stamp`) y los
  `coalesce` de id/duración/skill_id.
- `idx_solves_user_session` existe.
- **14/14 aserciones funcionales** en verde (transacción revertida): defaults del
  payload parcial, sello acotado y no retrocedido, la fila sigue visible al pull,
  LWW honesto intacto (viejo rechazado, nuevo aplicado), tombstone fantasma
  purgado, fila de otro usuario rechazada.
- Regresión nueva: sección **S** de `sync.integrity.test.ts`, que valida el
  **contrato completo** — toda columna `NOT NULL` coalescida, todo sello acotado
  y **ninguna duración acotada** — contra el SQL desplegado. Fue el test el que
  destapó el hueco residual de las claves de identidad antes de escribir el
  informe. `sync-engine`: 60/60 en verde. eslint limpio.

Efecto colateral bueno: con el sello acotado en el servidor, el cursor de pull ya
no puede saltar al futuro, lo que cierra de raíz la causa de **F17** (desincronía
por reloj adelantado) que quedaba pendiente del plan de Fase 6.

**Nota de trazabilidad (deliberada).** La migración 15 se aplicó con
`supabase db push` y, minutos después, el test de regresión de la sección S
destapó el hueco residual de las claves de identidad. Como `db push` no reejecuta
una migración ya registrada, la versión corregida se aplicó con
`supabase db query -f` y se verificó por SQL que el cuerpo desplegado coincide
con el fichero del repo. Se dice aquí para que quien audite no se encuentre una
migración cuyo contenido cambió después de aplicarse sin explicación: local y
remoto están alineados, y el mecanismo (editar + reaplicar a mano) es
precisamente el que la auditoría recomienda **no** usar como norma (§7·P0 y R6
del plan de Fase 6: falta un CI que aplique migraciones).

## 7. Plan de remediación priorizado

| Prio | Acción | Hallazgo | Riesgo si no se hace |
|---|---|---|---|
| **P0** | Migración 15 (hecha) | C1, A1, H3, M2 | Apagón de sync permanente y silencioso. |
| **P1** | Sondeo adaptativo + backoff exponencial con jitter, compartido entre pestañas, ante `429`/`5xx`/offline | A3 | Consumo sostenido y reintentos indefinidos con la API caída. |
| **P2** | Acotar `connect-src` al origen de Supabase (y `wss:` de realtime si aplica); añadir HSTS; alinear `docs/10-security/README.md` con la realidad | M3, M4 | Exfiltración si algún día hay XSS; SSL-strip; doc que miente. |
| **P3** | Reserva de `handle` en el cliente + reasignación en vez de fallo, **antes** de abrir la Fase 8 | M1 | Suplantación de identidad en el estante social. |
| **P4** | Redacción y caducidad en `logCapture` (y no registrar objetos de error completos) | M5 | PII en claro en el dispositivo. |
| **P5** | Mover la retención de tombstones a `pg_cron` | B4 | Coste por llamada creciente. |
| **P6** | Vigilancia: consulta de alerta si `max(sello) > now()` en cualquier tabla, y monitor de `skipped` en `sync_apply` | C1, A1 | Detección temprana de un nuevo vector de la misma familia. |
| **P7** | Verificaciones operativas en el dashboard (email/password off, redirect URLs, rate limits de Auth) + decidir `signOut` local vs global | B5, M6 | Suposiciones sin confirmar sobre la configuración real. |

**Orden recomendado:** P1 y P2 en la misma pasada (son las que quedan entre el
sistema actual y producción); P4 y P5 son baratas y se pueden intercalar; P3 es
**prerrequisito de la Fase 8**, no de la Fase 6; P6 y P7 son continuas.

## 8. Residuales aceptados a conciencia

**R1 — Un payload sin clave de identidad crea una fila con `id = ''`.**
`coalesce(..., '')` en `id`/`skill_id` no tiene default de tabla que reproducir,
así que se eligió entre tres males: revertir el lote (cuelgue total), saltar la
fila (pierde el dato sin avisar) o guardar una fila con clave vacía. Se eligió lo
tercero: **una fila basura propia e invisible** antes que un cuelgue de sync. El
mapper del cliente siempre emite el id, así que no se alcanza; y la alternativa
buena (`continue` + `skipped`, que el cliente ya convierte en error visible vía
`assertNoSkipped`) queda apuntada como refinamiento. La sección S fija la
invariante para que el cambio sea deliberado.

**R2 — Las duraciones no se acotan.** `time_ms` y `duration_ms` son duraciones,
no instantes: acotarlas corrompería el dato. Un cliente malicioso puede guardar
`time_ms = 9e18` en su propio solve. Es su propia fila, el guardián acota el
número de filas por llamada, y el daño se limita a sus estadísticas. Hay un test
que impide que alguien "arregle" esto por error acotando también las duraciones.

**Fuera de alcance, por honestidad:** no hay modelo de amenazas formal para el
cliente comprometido (un cliente manipulado siempre puede mentir *sobre sus
propios datos*, y el diseño local-first no pretende impedirlo); no hay auditoría
del runtime de la Edge Function ni de la cadena de build; y las afirmaciones
sobre configuración del dashboard (§5·B5) **no están verificadas** — están
listadas precisamente como pendientes de verificar, no como hechos.
