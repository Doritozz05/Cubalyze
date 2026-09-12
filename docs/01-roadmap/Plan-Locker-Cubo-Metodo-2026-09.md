# Plan — Método por evento, Locker en la BD, cubo por solve y pieza del dock

> Estado: **en ejecución** (2026-09-12). Rama: `exp/cube-collection`.
> Alcance de este documento: **fases 1–4**. Las fases 5–8 (identificación
> automática del smart cube, sincronización del Locker, bitácora de setups y
> estante público) quedan **fuera** y no bloquean nada: el diseño deja los
> ganchos puestos (`cube_label`, `updated_at`, `source`).
> Contexto: el Locker nació como prototipo en `localStorage` y los solves
> guardan un `method` que es una copia de la preferencia global, así que un
> 2×2 registra "CFOP". Esta es la corrección ordenada de las dos cosas.

---

## 0. Decisiones cerradas

| # | Decisión | Porqué |
|---|---|---|
| D1 | El método se guarda en **333 y 333oh**; el resto de eventos (222, pyram, y los que vengan: 444, clock, minx…) **no llevan método**. | OH es familia 3×3 y su evento ya declara `CFOP`/`Roux` en `analysis.methods`. |
| D2 | La regla es **"¿el evento declara métodos?"**, nunca "¿es este método válido aquí?". | El registro declara *capacidad de análisis*, no lo que el usuario puede usar: si alguien resuelve con ZZ, eso es un hecho y se guarda. |
| D3 | Fotos a **1280 px / ~600 KB** + **thumbnail ≤ 320 px** aparte; **blobs en IndexedDB**, nunca base64 en almacenamiento ni en una columna sincronizada. | IndexedDB da ~1 GB en Safari iOS y hasta el 80 % del disco libre en Chrome, frente a los ~5 MB (UTF-16, compartidos) de `localStorage`. La rejilla móvil de 2 columnas usa el thumbnail para no decodificar un 1280 px. |
| D4 | `solves.cube_id` **+ `cube_label`**, y **sin FK** a la tabla de gear. | Lección de la migración 032: borrar un objeto del armario no puede reescribir ni bloquear la historia. El label deja la fila legible incluso en la nube, donde la tabla de gear todavía no existe. |
| D5 | El **cubo activo es estado del dispositivo** (`app_meta`), no preferencia sincronizada. | Qué cubo tienes en la mano es de este dispositivo, no de tu cuenta. El histórico sí es dato (va en `solves`). |
| D6 | Un solve **`source: "virtual"` nunca lleva cubo**. | Un solve virtual no se hace con un cubo físico. |
| D7 | **Local primero**: el Locker entra en SQLite; su sincronización se difiere (fase 6). | El sync es la parte más delicada del repo (ADR-029); el valor está en tener los datos en el sistema profesional, no en moverlos. |

---

## 1. Estado actual verificado (con su localización)

| Hallazgo | Dónde |
|---|---|
| `method` es la **preferencia global** y se estampa en cada solve de cada evento | `packages/state/src/store.ts` (`method`, default `'CFOP'`) → `useSolveCompletion.ts:114`, `useManualSolves.ts:36` |
| La columna es **nullable y sin CHECK**, local y nube, con mapeo 1:1 | `migrations.ts` (001, reconstruida en 032) · `supabase/…/20260821000000_accounts.sql:39` · `sync-engine/src/mappers.ts:41,83` |
| El **filtro por método** deja pasar los solves sin método cuando hay filtro activo | `useStatsFilters.ts:96-101` (`if (s.method && …)`) |
| El filtro **no tiene UI que lo active** hoy (`filters.methods` nunca se rellena) | `useStatsFilters.ts:28,39` · `InsightsDashboard.tsx:164` (sin `initial`) |
| El análisis profundo solo corre para `"333"` | `useSolveCompletion.ts:180` |
| La re-análisis ya está gateada por tipo, pero con el literal `"333"` y no por `phaseAnalysis` | `SolveAnalysisPanel.tsx:167` |
| El push va por **watermark** (`updated_at > wm`) y la nube aplica **LWW** (`excluded.updated_at >= solves.updated_at`) | `solves.repository.ts:183` · `push.ts:79` · `20260821000000_accounts.sql:218` |
| Las migraciones locales corren **una a una en transacción con ROLLBACK** | `worker.ts:236-270` |
| El reloj monotónico por tabla sella `max(now, prev+1, floor+1)`; **031** existe porque sellar con `julianday('now')` pierde la LWW | `repositories/local-clock.ts` · `migrations.ts` (`031_tombstone_clock_floor`) |
| `public.solves` **no tiene triggers de `updated_at`** | `supabase/…/accounts.sql` (solo el trigger de alta de usuario) |
| **No hay CI** que aplique migraciones de Supabase | `.github/workflows/` |
| `CollectionType.puzzleCategory` ya es el puente tipo → evento | `collectionModel.ts:60-68` |
| `dockAreaOrder` se persiste y **las áreas nuevas no se añaden solas** | `widgetStore.ts:222-231` (`migratePersistedWidgetState`) |
| `solves` en memoria es **por sesión** (`findAll(sessionId)`) | `usePersistentSession.ts:648` |
| `computeStats`/`averageOf`/`computeBpaWpa` ya reciben arrays → filtrar por cubo no toca `statistics` | `packages/statistics/src/index.ts` |
| `deviceModel`/`vendor` del smart cube **no los lee nadie** (gancho de la fase 5) | `CubeConnector.tsx:63` |

---

## 2. Fase 1 — El método deja de ser global (y la historia se repara)

> Estado: **hecha** (2026-09-12). `tsc -b --force` limpio, build de producción
> OK, suite completa en verde (270 ficheros / 2 996 tests) y lint sin nada
> nuevo en los ficheros tocados.

### 2.1 Regla y puntos de escritura

Una única función pura decide, en `utils/puzzleUtils.ts`, y TODOS los sitios
que sellan método pasan por ella:

```
methodForEvent(puzzleType, preferred) =>
  isPuzzleType(puzzleType) && getEvent(puzzleType).analysis.methods.length
    ? preferred
    : undefined
```

| Punto de escritura | Cómo lo usa |
|---|---|
| `useSolveCompletion.ts` (timer, smart y virtual) | `capturedPersistedMethod` para la fila; `capturedMethod` (la preferencia) se queda como entrada del análisis, que solo corre en 3×3 |
| `useManualSolves.ts` (alta manual + hoja "+") | `methodForEvent(puzzleCategoryToType(puzzle), …)` |
| `importSolves.ts` → `toSolveInput` | única puerta de entrada de ficheros externos (DataSection la usa para los tres formatos) |

Dos efectos de coherencia que van con la regla:

- `ManualSolveSheet` **oculta el selector de método** cuando el evento no tiene
  (y su `defaultMethod` pasa a `SolveMethod \| undefined` por toda la cadena
  `App → AppShell → StageOverlays → sheet`). Sin esto la UI mentiría: elegirías
  CFOP en un 2×2 y no se guardaría.
- `AnalysisSection` (Ajustes) lo dice en su cabecera: aplica a 3×3 y 3×3 OH, el
  resto de eventos no guardan método.

No se toca `useSolveSession.ts` (`method: methodPref` en el resultado del
engine): **nadie lo consume** hoy y cambiar superficie muerta es riesgo sin
beneficio. Se anota aquí para no repetir el análisis.

### 2.2 El filtro de método (el detalle que faltaba)

`if (s.method && filters.methods.size > 0 && !filters.methods.has(s.method))`
significaba "un solve sin método **nunca** se filtra". Con 2×2 y Pyraminx ya sin
método, un filtro de "CFOP" los mostraría porque *no* son CFOP: al revés de lo
que pide el usuario. Ahora la regla vive en `passesMethodFilter(solve, métodos)`
(exportada para poder probarla: en este proyecto no se renderizan hooks en los
tests) y se aplica con el verbo correcto:

- selección **vacía** → no hay filtro, pasa todo;
- selección **no vacía** → un solve sin método **no pasa**.

Se hace en esta fase porque es la misma semántica, y con test propio (hoy el
filtro no tiene UI que lo active, así que el bug es latente, no visible).

### 2.3 Reparación de datos (local + nube)

**Local — migración `033_repair_method_scope`** (transaccional como todas):

```sql
UPDATE solves SET method = NULL,
  updated_at = MAX(updated_at + 1,
                   CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
WHERE method IS NOT NULL AND puzzle_type NOT IN ('333', '333oh');

INSERT OR REPLACE INTO app_meta (key, value) VALUES ('local_clock_solves',
  CAST(MAX(
    COALESCE((SELECT CAST(value AS INTEGER) FROM app_meta WHERE key = 'local_clock_solves'), 0),
    COALESCE((SELECT MAX(updated_at) FROM solves), 0)) AS TEXT));
```

- El sello va **floored** y el reloj local (`local_clock_solves`) se avanza
  después: si no, el siguiente edit local de una fila reparada nacería por
  debajo de su propio `updated_at` y **perdería la LWW contra la nube** — el
  fallo exacto que arregló la 031.
- Sellar es lo que hace que la corrección **viaje**: el push es
  `updated_at > watermark`.
- Guardar un respaldo (`_backup_*`) es opcional: lo que se reescribe es una
  etiqueta demostrablemente falsa, y el patrón de respaldo queda disponible si
  hiciera falta.

**Nube — `supabase/migrations/20260912000008_repair_method_scope.sql`**: un
`update public.solves set method = null where …` equivalente. Es **data-only,
idempotente y sin DDL**; no toca `updated_at` (no hay triggers que lo hagan),
así que no perturba watermarks. Lo aplica el usuario: no hay CI para esto.

**Propiedad que hace seguro el orden:** las dos reparaciones convergen a `NULL`
y son idempotentes, así que da igual qué se ejecute primero. Residuo honesto y
autocorregible: un dispositivo con la versión vieja que **nunca haya
sincronizado** puede *insertar* filas con CFOP en 2×2 (el LWW frena las
sobrescrituras, no los inserts); su propia migración local las limpiará cuando
se actualice.

**Antes de ejecutar:** `SELECT puzzle_type, method, count(*) … GROUP BY 1,2` y
exportar. La reescritura es irreversible por diseño (el valor previo era falso;
no hay nada que restaurar).

### 2.4 Tests de la fase

- `apps/web/src/utils/__tests__/methodScope.test.ts` — la regla pura: 3×3 y
  3×3 OH conservan; 222/pyram/clock/minx/skewb/sq1/444/777 y los códigos
  heredados (`3x3x3`, `2x2`) devuelven `undefined`; se conserva cualquier
  método elegido (ZZ, Petrus) y hay un **guard de drift** que recorre
  `EVENT_REGISTRY` y exige que la regla siga al registro.
- `packages/database/src/__tests__/method-scope-repair.test.ts` — la 033
  contra sqlite-wasm real, 7 casos: limpieza, filas intactas, **sello nuevo**
  (incluido un `updated_at` por delante del reloj de pared), reloj local por
  delante del mayor sello, el reloj local nunca retrocede, **idempotencia** y
  registro en `_migrations`.
- `apps/web/src/hooks/__tests__/statsMethodFilter.test.ts` — el filtro.
- `apps/web/src/utils/__tests__/importSolves.test.ts` — casos nuevos: un 2×2
  con `method: "CFOP"` entra sin método, un 3×3 con `Roux` lo conserva.
- `packages/database/src/__tests__/migrations.test.ts` — el invariante
  "toda migración toca CREATE/ALTER/DROP" ahora reconoce la clase *data
  repair* con una **allowlist explícita** (`033_repair_method_scope`), así que
  una migración nueva de solo `UPDATE` falla el test hasta que se declara a
  propósito.

### 2.5 Qué **no** se toca en esta fase

Ni el pipeline de análisis (sigue siendo 333-only; que 333oh guarde método no
lo habilita, y se deja explícito en el código), ni los tiempos, ni las reglas de
PB, ni los datos de demo (son todos 3×3). El campo `method` de `useSolveSession`
se deja como está (nadie lo lee).

---

## 3. Fase 2 — El Locker entra en la BD (SQLite/OPFS) con fotos en IndexedDB

### 3.1 Esquema

`gear_categories`, `gear_types`, `gear_items` (tags/links/palette en columnas
JSON, como ya hace `analysis` en `solves`). Se crean **con forma compatible con
el sync** aunque el sync llegue después (`id TEXT PK`, `created_at`,
`updated_at`, `is_demo`) para que añadirlo sea una migración limpia y no una
reconstrucción como la 032.

### 3.2 Capa de datos

Repositorio nuevo + hook `useGearCollection` con el patrón que ya funciona
(`useCalendarTasks`: leer del repo, re-leer con `useDataRevision()`, escribir
vía repo). **`collectionModel.ts` no se toca**: es puro, tiene 32 tests y solo
cambia el borde de persistencia. No se llama a `requestSync()` todavía: las
tablas no están registradas en el motor y marcarlas sucias sería trabajo
inútil (se añade en la fase 6, junto con el registro).

### 3.3 Fotos

Store IndexedDB `cubeforge-collection` siguiendo `backgroundMediaStore`, **dos
blobs por foto** (thumbnail ≤320 px para la rejilla, 1280 px para la ficha) y
los datos en la fila solo como referencias (`{id, width, height, addedAt}`) más
el orden. Resolución por object URL en un hook que revoca al desmontar; borrado
del item → borrado de sus blobs; barrido de huérfanos al arrancar; se respeta el
`navigator.storage.persist()` que ya pide la app para OPFS. El render 3D
(`cubeSnapshotService`) no se toca: foto > cubo 3D > esqueleto sigue igual.

### 3.4 Datos actuales y export

Import **de una sola pasada** desde `cubeforge-locker` al primer arranque (los
data URLs pasan a blobs) y **la clave de `localStorage` no se borra nunca**:
queda como red de seguridad. El export/import JSON sigue llevando las fotos en
base64 **solo dentro del fichero** (nunca en almacenamiento). Las fotos **no
viajan entre dispositivos** en esta fase y la UI lo dice.

---

## 4. Fase 3 — `cube_id`, cubo activo y la pieza del dock

### 4.1 Datos

Migración local: `solves.cube_id TEXT` + `solves.cube_label TEXT` + índice en
`cube_id`. Se estampa en `useSolveCompletion.ts` (donde ya se capturan
`source`/`puzzleType`), en `useManualSolves.ts` y en el import. Reglas: `virtual`
→ sin cubo; `smart`/`manual` → cubo activo; si el cubo activo no pertenece al
evento activo, **se anula en vez de mentir**. Añadir el campo implica modelo
zod, `DBSolve`, `UISolve`, `toUISolve`, insert/update/rowToSolve del repo y
export.

### 4.2 El cubo activo

`app_meta`, clave por código de evento, con dos fallbacks: primero un item
marcado **`primary`** (Main) para ese evento, luego el **último usado**. Es la
primera cosa que **consume de verdad** el flag Main.

### 4.3 La pieza del dock

`DOCK_AREAS` + `pieces/index.ts` + el mapa de `Header.tsx` + i18n del namespace
`dock` (label y descripción para el explorador). Filtra por **evento activo**
(la cadena `type.puzzleCategory → puzzleCategoryToType()`) y **solo
`status: 'owned'`**: un cubo vendido o prestado no está en tu mano; si el activo
deja de estar en propiedad, cae al último válido con aviso discreto. Estado
vacío por evento con acceso al Locker. Desktop: `Select` como el puzzle. Táctil:
chip en la cabecera + hoja (`TouchPanel`), como la navegación del Locker.
Y el detalle que casi se olvida: **inyectar el área solo si el orden del dock
persistido es exactamente el default antiguo**; si se personalizó, aparece en el
explorador y no reordena el workspace (regla que el repo ya documenta).

---

## 5. Fase 4 — Stats por cubo (derivadas, nunca sincronizadas)

`computeStats`, `averageOf` y `computeBpaWpa` ya reciben arrays, así que esto es
un **filtro**: dos consultas nuevas en el repo (`findByCube`, `countByCube` con
el índice) y un hook cacheado por revisión. `solves` en memoria es por sesión,
así que el histórico no se puede sacar de ahí. Se muestran en la ficha del item
(solves, mejor single, mejor ao5, último uso) y como badge discreto en la pieza.
Opcional barato: filtro por cubo en Insights copiando el de método. Recuerda
ADR-029 §2: los agregados **se recalculan por replay, nunca se sincronizan**.

---

## 6. Riesgos y límites honestos

- Esta doc diseña sobre la mecánica **verificada** del migrador y del reloj
  local; el SQL de la 033 debe validarse con el test de migración antes de
  confiar en él.
- Los límites de cuota son cálculo, no medición en este navegador.
- Sin CI para Supabase: las migraciones de nube las aplica el usuario.
- El preview en vivo no es posible en este entorno (dev server HTTPS con
  certificado autofirmado y la pestaña de preview exige loopback HTTP), así que
  el repaso visual de la pieza del dock y del Locker móvil es manual.

---

## 7. Fuera de alcance (fases 5–8) y ganchos ya puestos

5. Identificación automática del smart cube al conectar (`vendor`/`model` y MAC
   de GAN ya llegan y no los lee nadie).
6. Sincronización del Locker (ADR-029: tabla espejo, RLS, mappers, tombstones y
   `sync_apply`), que es lo que hace viajar las fotos — y probablemente
   Supabase Storage, no una columna.
7. Bitácora de setups (lubricante/tensión/fecha por cubo): lo genuinamente no
   genérico, y lo que no tiene ni Steam ni Discogs.
8. Estante público compartible.
