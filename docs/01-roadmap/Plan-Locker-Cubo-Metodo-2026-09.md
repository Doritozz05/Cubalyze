# Plan — Método por evento, Locker en la BD, cubo por solve y pieza del dock

> Estado: **fases 1–4 hechas, commiteadas y pusheadas** (2026-09-12). Rama:
> `feat/cube-collection` (renombrada desde `exp/`: ya no es un experimento).
> Alcance de este documento: **fases 1–4**. Las fases 5–8 (identificación
> automática del smart cube, sincronización del Locker, bitácora de setups y
> estante público) quedan **fuera** y no bloquean nada: el diseño deja los
> ganchos puestos (`cube_label`, `updated_at`, `source`). La 5 ya tiene plan
> propio: [Plan-Fase5-SmartCube-Locker-2026-09.md](./Plan-Fase5-SmartCube-Locker-2026-09.md).
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

### 3.5 Estado: **hecha** (2026-09-12)

> `pnpm typecheck` 33/33, suite completa en verde (274 ficheros / 3 058 tests),
lint limpio en lo tocado y build de produccion OK.

Lo construido, y lo que cambio respecto al plan de arriba:

- **Migracion `034_gear_collection`** y `GearRepository` (con tests contra
  sqlite-wasm real, incluida la cascada que sustituye a `removeCategory` y el
  re-alojo de items al borrar un tipo). Los tipos de dominio del repo usan
  arrays `readonly` para que el modelo web pase sus objetos tal cual, sin capa
  de mapeo que se desincronice.
- **`collectionModel.ts` SI se toco** (el plan decia que no): las fotos pasan de
  ser cadenas base64 a ser referencias `{id, width, height, addedAt}`. Es el
  cambio que hace posible la separacion blob/fila. La pureza se mantiene: cero
  I/O en el modelo, y los helpers nuevos (`normalizePhotoRefs`,
  `unwrapCollectionPayload`, `legacyPhotoStrings`, `formatBytes`) tienen tests
  propios.
- **El store sigue siendo zustand**, pero respaldado por SQLite en vez de
  `localStorage`: `hydrate()` lee las filas, cada accion calcula el estado puro
  siguiente y se persiste **solo el diff** (`collectionPersistence.ts`,
  funcion pura con tests). Nada de `replaceAll` en el camino normal: reescribir
todo subiria el `updated_at` de cada fila y, cuando el Locker sincronice, empujaria
  la coleccion entera en cada tecla. El conector es inyectable
  (`createCollectionStore(connect)`), que es lo que permite probar el
  orquestado entero sin Worker ni OPFS.
- **Las exclusiones no son filas**: viven en `app_meta`
  (`locker_excluded_categories`), junto con la bandera `locker_initialized` que
  evita re-sembrar un armario que el usuario ha vaciado a proposito.
- **Las fotos legacy se convierten sin canvas**: un data URL base64 se decodifica
  a mano y sus bytes se guardan tal cual (sin re-comprimir, sin perder calidad).
  Solo un data URL no base64 cae al pipeline de canvas. El import es, por
  tanto, testeable sin DOM y conserva el original.
- **El fichero de backup** (`collectionTransfer.ts`) lleva un side-car
  `photos` con las DOS rendiciones en base64, indexado por `itemId:photoId`, de
  modo que reimportar reconstruye las mismas claves y ninguna tarjeta queda
  apuntando a un blob que no existe. Acepta ademas las dos formas antiguas
  (estado suelto y fotos como cadenas) y descarta las referencias cuyos bytes no
  estan (mejor un backup sin la foto que un backup roto).
- **`requestSync()` si se llama** tras cada escritura (el plan decia que no): no
  es para subir el Locker — sus tablas no estan registradas en el motor todavia
  — sino para bumpear `dataRevision`, que es lo que hace que la otra pestaña (o
  el otro dispositivo, al terminar un ciclo) relea las filas. Sin eso, dos
  pestañas abiertas se pisarian.
- **UI**: `ItemMedia` gana el estado "hay foto pero los bytes aun no han
  llegado" (shimmer, nunca el render 3D primero, que hacia saltar la rejilla);
  `PhotoImage` resuelve una referencia a imagen y se usa en la ficha y la
  galeria; el editor guarda las fotos al elegirlas bajo el id que el item va a
  tener (para poder previsualizarlas antes de guardar) y el borrado de los
  blobs que la edicion descarta ocurre despues del guardado, nunca dentro del
  editor (cancelar no puede romper una foto guardada). Ademas: lectura de
  almacenamiento en el menu y export/import tambien en la hoja de navegacion
  tactil, que antes no tenia ninguna forma de sacar un backup.
- **Sin cobertura honesta**: el reescalado por canvas (`processPhotoBlob`) no se
  prueba en Node (no hay canvas); si su aritmetica pura (`fitWithin`,
  `pickJpegQuality`, `fitsBudget`) y todo el resto del camino.
- **Borrado de cuenta**: `wipeAccountLocalData` ahora vacia tambien las tablas
  del Locker, los blobs de IndexedDB, la clave `locker_*` de `app_meta` y el
  blob antiguo de `localStorage` (que guarda fotos en base64). Sin esto, el
  armario del usuario borrado sobrevivia al borrado de cuenta y, al quedar
  `locker_initialized` a cero, el blob antiguo se habria re-importado solo.

---

## 4. Fase 3 — `cube_id`, cubo activo y la pieza del dock

> Estado: **hecha** (2026-09-12). `pnpm typecheck` 33/33, suite completa
> **3092 pasan / 0 fallan** (12 saltados), lint sin errores en `apps/web`,
> `packages/database` y `packages/sync-engine`, y build de producción OK.
> Sin commit hasta que el usuario lo pida (se hizo al cerrar la fase).

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

**Cómo llega el área a quien ya tenía un dock personalizado.** El orden del dock
persistido solo se sanea, nunca se amplía: añadir `cube` en cada arranque
resucitaría la pieza que alguien quitó a propósito. Así que la llegada es
versionada de una sola vez — `CURRENT_WIDGET_STORE_VERSION = 9`, y
`addAreasIntroducedAfter(order, oldVersion)` coloca `cube` justo después de
`puzzle` **solo cuando el layout persistido es anterior a la v9**. Si el ancla
(`puzzle`) ya no está, cae al final; si el área ya está, no se toca. Es una
función pura y con tests propios (incluida la no-mutación del array de entrada).

**Icono.** La pieza usa `Cuboid` (un cubo limpio) tanto en el trigger como en la
variante icono y en el explorador de piezas; la fila "Abrir Locker" de la hoja
usa `ArrowUpRight` (es una acción, no un cubo). Se descartó `Boxes` (los tres
cubos apilados) porque ensuciaba la barra.

### 4.4 Qué pasa si NO eliges cubo (el comportamiento por defecto)

Es la pregunta importante, así que va explícita. El orden de decisión, en
`resolveActiveCube`:

1. **Elección explícita** en este dispositivo (`app_meta.active_cube_<evento>`),
   si ese item sigue siendo candidato. La elección **no se sincroniza**: el móvil
y el escritorio pueden estar delante de cubos distintos, y se atribuye en el
momento del solve.
2. Si no hay elección (o el elegido ya no vale): el primer item con
   **`primary` (Main) de ese evento**.
3. Si no hay ningún Main: el **último cubo** de ese evento visto en un solve
   anterior.
4. Si no hay nada de lo anterior: **`null`**, es decir el solve se guarda con
   `cube_id`/`cube_label` **NULL**. Nunca se inventa un cubo.

Los tres estados posibles son distintos a propósito:

- **Nunca elegido** → se resuelve por 2/3/4 y la pieza muestra lo que tocaría.
- **"Sin cubo" elegido a mano** (`NO_CUBE`) → manda sobre los fallbacks: los
   solves de ese evento se registran sin atribución y la pieza lo dice. Es una
decisión, no un olvido.
- **El elegido desapareció** (vendido, borrado, movido a otro evento) → la pieza
   cae al fallback y avisa (`cube.unavailable`); nunca se sigue atribuyendo a un
   cubo que no está en tu mano.

Un solve **virtual** no lleva cubo nunca (el simulador no es tu cubo físico) y un
evento sin cubos registrados (p. ej. Pyraminx) guarda los solves sin atribución:
no hay nada que elegir y la pieza es una puerta al Locker. Los solves
**importados** tampoco llevan cubo: no había attribution cuando se registraron.

### 4.5 Tests de la fase

- `views/Collection/__tests__/activeCube.test.ts` (17): candidatos por evento,
  OH nunca mezclado con 333, vendidos fuera, item directo bajo categoría sin
  evento, tipo sin `puzzleCategory`, categoría no-cubo, prioridad elegido →
  Main → reciente, `NO_CUBE`, y `cubeAttribution` vacío cuando no hay cubo.
- `stores/__tests__/activeCubeStore.test.ts` (5): hidratación desde el prefijo de
  `app_meta`, valores vacíos descartados, set/clear persistido (fila en blanco,
  no borrada), degradación sin BD y `hydrate` idempotente.
- `widgets/dock/dockAreasRegistry.test.ts` (10): registro coherente, `cube` tras
  `puzzle` en el default, llegada en la v9, idempotencia, ancla ausente, layout
  ya actual, no-mutación y la migración completa del store.
- `packages/database/src/__tests__/solve-cube-attribution.test.ts` (8): columnas
  nullable + índice contra sqlite-wasm real, ida y vuelta en `insert`,
  `insertMany` y `update` (incluido **vaciar** el cubo), y —lo importante— que
  **no hay FK** a `gear_items`: borrar el cubo del Locker no toca el histórico y
  un solve de un item que no existe localmente se escribe igual.
- `packages/sync-engine`: 2 casos nuevos en `mappers.test.ts` (ida y vuelta de
  `cube_id`/`cube_label`, NULL en vez de `"undefined"`, y fila anterior a las
  columnas) y el bloque `L)` de `sync.integrity.test.ts` (4): el push lleva la
  atribución, el pull la devuelve en otro dispositivo, un solve sin cubo queda
  NULL en la nube, y —el que evita el fallo silencioso— el `sync_apply` de
  `20260912000010` **declara y escribe** ambas columnas, con la comprobación de
  que el resto de la función es idéntico al de `20260902000007`.

Además, tres tests que leían los binds por índice (`db.test.ts`,
`db.demo.test.ts`, `db.edgeCases.test.ts`, `pull.test.ts`) pasaron a **derivar el
índice de la propia sentencia SQL**: al añadir dos columnas quedaron apuntando a
otro valor, que es exactamente el fallo silencioso que había que evitar en el
futuro.

### 4.6 Deuda saldada de paso

`AppShell.tsx` tenía un `view as any` en el menú contextual que dejaba el lint de
`apps/web` en rojo (1 error preexistente). Ahora es `view as ViewId` con un
comentario que explica por qué el resolver sigue desacoplado del union.

---

---

## 5. Fase 4 — Stats por cubo (derivadas, nunca sincronizadas)

> Estado: **hecha, sin commit** (2026-09-12, a la espera del visto bueno).
> `pnpm typecheck` 33/33, suite completa **3115 pasan / 0 fallan** (12 saltados),
> lint sin errores y build de producción OK. **No toca ni el esquema de la nube
> ni el sync**: no hay nada que migrar ni que desplegar por esta fase.

### 5.1 El diseño, en una frase

`computeStats`/`averageOf` ya reciben arrays, así que esto es un **filtro** sobre
el histórico, no un contador: ADR-029 §2 dice que los agregados **se recalculan
por replay, nunca se sincronizan**, porque un contador sincronizado se
desincroniza en cuanto un dispositivo edita un penalty offline y entonces mientes
en los dos sitios. `solves` en memoria es **de la sesión activa**, así que el
histórico por cubo no se puede sacar de ahí: va por consulta.

### 5.2 Datos

Dos métodos en `SolvesRepository`, apoyados en `idx_solves_cube` (035):

- `findByCube(cubeId)` — todo el histórico de un cubo, **cronológico** (mismo
  orden que `findAll`, para que nadie tenga que invertir nada) y sin demo.
- `summarizeCubes()` — **una** consulta agrupada para toda la rejilla
  (`COUNT(*)` + `MAX(timestamp)` por `cube_id`). Preguntar por tarjeta serían N
  consultas por render.

### 5.3 Derivación pura

`views/Collection/cubeStats.ts`: `cubeStatsFor(rows)` → `count`, `valid`, `best`
(con el id del solve y su timestamp), `mean`, `bestAo5`, `bestAo12` y
`lastUsedAt`. Tres decisiones deliberadas:

- **Reutiliza `averageOf`**, no reinventa el recorte: un Ao5 de un cubo tiene que
  significar exactamente lo mismo que el Ao5 de la sesión, o los dos números
  discreparán sobre los mismos cinco solves.
- **"Mejor Ao5" es el mejor de TODA la historia**, no el de los últimos cinco
  (que es lo que muestra la cabecera de sesión). Son preguntas distintas.
- **Es insensible al orden**: ordena por timestamp una vez, así que pasar el
  array tal como lo da la app (nuevo→viejo) no puede dar un Ao5 equivocado.

`formatLastUsed` usa `Intl.RelativeTimeFormat` en vez de claves de traducción:
el navegador ya sabe decir "hace 3 días" en cada idioma que soporta, y cadenas
escritas a mano serían una cosa más que mantener y estarían mal en cualquier
idioma que no hayamos traducido.

### 5.4 Presentación

- **Ficha del item** (solo categorías `cube`, que son las únicas que pueden ser
  destino de una atribución): sección "Solves" con el recuento en la cabecera y
  una tabla con la misma gramática que la de especificaciones — mejor single,
  mejor Ao5, mejor Ao12, media y último uso. Con cero solves: un vacío honesto
  que explica cómo hacer que aparezcan.
- **Rejilla**: un contador discreto en el pie de cada tarjeta, con **una sola**
  consulta agrupada por rejilla (no una por tarjeta). Se omite cuando es 0: un
  "0 solves" en un catálogo de cincuenta cosas es ruido.
- **Caché por revisión**: los dos hooks (`useCubeStats`, `useCubeUsage`) leen
  `syncStore.dataRevision`, que cambia en cada escritura local y en cada ciclo de
  sync (incluido el de otra pestaña), así que los números se refrescan justo
  cuando las filas podrían haber cambiado y un re-render por otro motivo no
  cuesta nada. Un fallo de BD no rompe el Locker: se degrada a "sin números".

### 5.5 Tests de la fase

`views/Collection/__tests__/cubeStats.test.ts` (18): vacío, todo-DNF, DNF que no
gana el mejor single, ventana incompleta, +2 en single y media, independencia del
orden, mejor ventana de la historia (no la última), Ao12, ventana que es DNF
(descartada, no Infinity), un único DNF tolerado porque el recorte se lo come,
último uso, ayudantes de penalty y el formateador relativo en EN y ES (incluido
"yesterday" y un reloj que va hacia atrás).

`packages/database`: 5 casos nuevos en `solve-cube-attribution.test.ts` (13 en
total) contra sqlite-wasm real — `findByCube` solo con los de ese cubo y en
orden, sin demo, ids inexistentes, `summarizeCubes` en una pasada con los no
atribuidos fuera y el demo también, resumen vacío, y el caso que justifica todo
el diseño: **un cubo borrado del Locker sigue respondiendo**.

### 5.6 Los filtros de Insights (cubo + método), en el mismo paso

Van juntos porque comparten hueco y porque uno **revive** el otro: el arreglo de
la Fase 1 (`passesMethodFilter`) era correcto pero **latente**, porque ningún
control asignaba `filters.methods`. Ahora hay uno.

- **De dónde salen las opciones.** De **la historia**, no de listas fijas ni del
  Locker: un método que solo tú usas aparece (Petrus, ZZ), y un cubo con 0 solves
  no ensucia el selector. Además, un cubo **borrado del Locker sigue siendo
  filtrable** porque sus solves existen y su label está congelado en la fila.
- **Regla de exclusión, igual para los dos.** Con un filtro activo, un solve
  **sin** ese dato queda fuera: un 2×2 no es un voto de CFOP y un solve sin cubo
  no es un solve con ese cubo. Lo importante es que así **el recuento de la
  opción coincide con lo que el filtro deja pasar** ("GAN 12 · 2" muestra dos
  filas, no tres).
- **El evento manda sobre el cubo.** Un cubo pertenece a un evento, así que
  cambiar de evento **limpia el filtro de cubo** (`mergeStatsFilters`, pura y
  con test): sin eso quedaría un filtro que no puede casar nada y la lista se
  vaciaría sin motivo visible.
- **Nomenclatura.** En Insights "Cube" ya significaba *evento* (`dashboard.cube`
  → 3×3). El nuevo control es **"My cube" / "Mi cubo"**, para que no haya dos
  cosas distintas llamadas igual.

Revivido el filtro de método, la deuda de la Fase 1 queda cerrada: ya no hay
código correcto sin efecto visible en esta área.

### 5.7 Tests de los filtros

`hooks/__tests__/statsCubeFilter.test.ts` (21): pasa-todo sin selección, solo el
cubo elegido, exclusión de los no atribuidos, coherencia entre el recuento de la
opción y lo que deja pasar el filtro, opciones derivadas de la historia
(incluido un cubo ya borrado del Locker y el fallback al id sin label), el
**escenario exacto de la Fase 1** (un 2×2 no se cuela en un filtro CFOP), la
combinación Y de método + cubo, las cinco reglas de `mergeStatsFilters`
(incluida la no-mutación) y la lista de métodos de un evento sin métodos.

### 5.8 Un footgun cerrado de paso

`DEFAULT_FILTERS` contenía un `Set`, así que hacer `{ ...DEFAULT_FILTERS }`
repartía **el mismo Set** a todas las instancias del hook y a `reset()`. Nada lo
mutaba (los toggles crean un Set nuevo), pero era suerte, no diseño. Ahora el
objeto compartido **ya no existe**: `freshFilters()` construye Sets nuevos en
cada llamada y es la única puerta al estado inicial y al reset, así que la
versión anterior del footgun ya no es siquiera expresable.

### 5.9 Filtros unificados + el cubo en la fila (2026-09-12)

Dos mejoras sobre lo anterior, sin tocar ni una línea de `packages/statistics`.

**El modelo: una dimensión, un control.** `activeFilter` era UN union
excluyente (`"clean" | "+2" | "DNF" | "smart" | "virtual"`) que mezclaba dos
preguntas distintas — la penalización de un solve y cómo se grabó — así que
elegir "Smart" escondía todos los +2. Ahora son dimensiones independientes que
se aplican con Y: `penalty` (single-select, porque un solve es limpio O +2 O
DNF), `sources`, `methods` y `cubeId` (multi-select / single-select según
corresponda).

**La UI: una barra, un popover, un chip por dimensión.** El resultado tiene
control segmentado permanente (es lo que más se usa); el resto vive en un
popover con **una sección por dimensión** (`SolveFilters.tsx`). Las opciones y
sus recuentos salen siempre de la historia, así que añadir una dimensión futura
es una sección + un predicado: los recuentos, el badge del disparador y los
chips quitables se derivan de `filters`, y no pueden desincronizarse.
`countActiveFilters` es la única fuente de "hay algo filtrando".
Reset **no** está en el popover a propósito: limpia también la búsqueda y el
orden, así que vive junto al buscador.

**El cubo, en la ficha (no en la lista).** `CubeBadge` (átomo compartido)
muestra el nombre congelado junto a los chips de penalización / método / origen
en la **cabecera del detalle del solve** (`SolveAnalysisPanel`), que es la
columna derecha de Insights y también la vista táctil. **No** va en las filas
de ninguna lista: ahí repetiría el mismo nombre columna abajo y añadiría ruido
(sobre todo "Sin cubo" en todo el histórico anterior a la Fase 3). En la ficha,
un solve sin atribuir muestra un "Sin cubo" apagado y **nunca un hueco**: la
ausencia de dato es información y es justo lo que la ficha debe decir.

**Un bug encontrado y borrado.** El orden `pbDelta` ("PB gap") comparaba
`(a − pb) − (b − pb)` con un único `pb`, o sea `a − b`: era **idéntico a
"Fastest"** (un DNF cae al final en ambos). Opción duplicada que no hacía nada,
fuera. La clave `list.sortPbGap` y las dos que quedaron huérfanas
(`list.filterByCube`, `list.allCubes`) se retiran de `en`/`es`.

**Tests nuevos** (`statsFilterDimensions.test.ts`, 22): el `all` como ausencia
de filtro, `clean` como "ninguna penalización", normalización de casos legacy
(`dnf`, `plus2`), la no-filtración cruzada entre `+2` y `DNF`, el origen vacío,
la exclusión de los no atribuidos, los recuentos y opciones derivados, la
independencia de dimensiones (el bug del modelo viejo: penalización y origen
como Y, no como elección única) y que `freshFilters()` reparte Sets
independientes.

---

## 6. Riesgos y límites honestos

- Esta doc diseña sobre la mecánica **verificada** del migrador y del reloj
  local; el SQL de la 033 debe validarse con el test de migración antes de
  confiar en él.
- Los límites de cuota son cálculo, no medición en este navegador.
- **Migraciones de nube aplicadas el 2026-09-12** (008, 009, 010) con la CLI,
  en orden y verificadas por SQL, no por el mensaje de éxito:
  - `solves.cube_id` / `cube_label` existen, `text` nullable, e
    `idx_solves_user_cube (user_id, cube_id)` también;
  - hay **un solo** `sync_apply(jsonb)` (el `create or replace` no dejó
    overload) y su cuerpo declara `cube_id text` y escribe
    `cube_label = excluded.cube_label`;
  - la reparación dejó `222` 491/491 en NULL, `pyram` 27/27 en NULL y **`333`
    intacto con sus 27 CFOP**; 627 filas antes y después (ninguna perdida);
  - push real simulado a través de `sync_apply`: el solve entró con su
    `cube_id`/`cube_label`, y un push **obsoleto** (mismo id, `updated_at`
    menor, sin cubo) fue **rechazado** por el guard LWW — el cubo sobrevivió.
  Backup previo de las 505 filas que la 008 destruye en
  `%TEMP%/cubeforge-method-repair-backup-20260912.json` (fuera del repo).
- **Riesgo residual anotado, no arreglado.** En `sync_apply` el LWW usa
  `excluded.updated_at >= solves.updated_at`, así que un cliente **anterior a la
  Fase 3** que reenvíe una fila ya sincronizada con el MISMO `updated_at` puede
  escribir `cube_id = NULL` encima de una atribución existente. Hace falta un
  push completo desde un build viejo (reset local, re-link) y solo en empate,
  pero existe; la salida limpia sería distinguir "clave ausente" de "clave
  nula" en el recordset antes de pisar un valor.
- Nota de contabilidad: `applied_solves` cuenta filas **procesadas**, no
  modificadas (suma 1 aunque el guard rechace la escritura). Es cosmético: el
  watermark avanza por el lote enviado, no por la respuesta.
- El preview en vivo no es posible en este entorno (dev server HTTPS con
  certificado autofirmado y la pestaña de preview exige loopback HTTP), así que
  el repaso visual de la pieza del dock y del Locker móvil es manual.

---

## 7. Fuera de alcance (fases 5–8) y ganchos ya puestos

Ordenadas por **valor/esfuerzo**, no por número. Dos son pequeñas y de altísimo
rendimiento, una es la grande de verdad y la última depende de ella.

### 7.1 Fase 5 — el cubo se identifica solo (esfuerzo BAJO, valor ALTO)

**Diseñada a detalle en
[Plan-Fase5-SmartCube-Locker-2026-09.md](./Plan-Fase5-SmartCube-Locker-2026-09.md).**

`vendor`/`model` y el MAC de GAN **ya llegan** en el handshake BLE y no los lee
nadie (y el firmware y la fecha de producción se descartan en el propio
adaptador). Con eso: al conectar, la app sabe qué cubo físico es y puede ofrecer
"este es mi GAN 12 — vincúlalo a ese objeto del Locker", que es exactamente el
paso que hoy se hace a mano en la pieza del dock. El hardware pasa a ser la
fuente de verdad de la atribución y la elección manual queda como respaldo
(stackmat, solves tecleados, un cubo nuevo sin catalogar). Es la fase que más
cierra el círculo "hardware → dato" y la que hace que la app se sienta una app
de speedcubing y no un timer con extras. Riesgo real: hace falta un catálogo de
modelos y un plan honesto para el cubo desconocido.

El plan de detalle confirma lo que este resumen solo intuía: **no hace falta
tocar `solves`, ni el sync, ni la nube**, porque la identidad del hardware se
traduce a una escritura en el `activeCubeStore` que ya existe, y el vínculo es
una columna más de una tabla de gear que todavía no sincroniza.

### 7.2 Fase 7 — bitácora de setups (esfuerzo BAJO-MEDIO, valor ALTO)

Por cubo: lubricante, tensión, fecha de cada cambio. Es lo genuinamente
**no genérico** — ni Steam ni Discogs lo tienen — y se apoya en lo que acaba de
aterrizar: con las stats por cubo ya calculadas por replay, "¿fue mejor después
del cambio de muelle?" es comparar dos ventanas de solves que ya sabemos
recorrer. Tabla hija de `gear_items`, una línea de tiempo en la ficha y, si
apetece, un antes/después en la tabla de métricas. Mucho valor por poco código.

### 7.3 Fase 6 — sincronizar el Locker (esfuerzo ALTO, valor MEDIO-ALTO)

La grande: tabla espejo de categorías/tipos/ítems, RLS, mappers, tombstones y
`sync_apply` (ADR-029), **más** las fotos. Decisión importante ya tomada en el
diseño: las fotos van a **Supabase Storage**, no a una columna en base64 —
columnas de blobs en un LWW son una trampa. Su valor es cambiar de dispositivo o
reinstalar sin perder la colección, y compartir gear. Es la única fase donde un
error se lleva por delante una colección entera, así que merece el mismo trato
riguroso que la Fase 2 (esquema compatible, fotos referenciadas, tests contra
SQLite real). Hoy el Locker es local por dispositivo y las **dos personas** que
usan la app pueden vivir así una temporada sin dolor.

### 7.4 Fase 8 — estante público compartible (esfuerzo BAJO técnicamente, valor MEDIO, y DEPENDE de la 6)

Un enlace público de solo lectura con tu colección (y quizá tus PBs por cubo).
El trabajo no es la UI, es el producto y el permiso: ruta sin sesión, token de
compartir, opt-in explícito y decidir qué es público. El detalle que la coloca
la última: **necesita la Fase 6**, porque el servidor no tiene la colección —
sin espejo en la nube no hay nada que servir. Se puede tener una maqueta con
datos locales, pero no es la fase.

**Orden recomendado:** 5 y 7 (pequeñas, alto rendimiento, y ninguna toca datos
delicados) → 6 (la que requiere diseño y cuidado) → 8.
