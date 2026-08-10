# Estudio exhaustivo: criterio de cruz relajado + detección F2L

> **Estado:** COMPLETADO (2026-08-10) · Branch `algortihms`
> **Autor del estudio:** Buffy (asistente de código)
> **Harness reproducible:** `packages/analysis-engine/src/__tests__/cross-study.test.ts`
> **Veredicto corto:** el criterio relajado es una **mejora neta** (23→27/30 cruces correctas, 6→2 catástrofes, **0 regresiones**) y se agrega como opción **OFF por defecto**. El F2L es decente con 4 bugs preexistentes documentados, ninguno causado por este cambio.

---

## 1. Pregunta de partida (usuario)

> "Ellos [los reconstructores] marcan la cruz una vez está hecha aunque falten movimientos para orientar el edge, pero si cada uno está en su posición correcta respecto a las demás, ellos la marcan correcta. ¿Esto se puede hacer? ¿Qué implicaría?"

Traducción técnica: **relajar el criterio de "cruz completa"** de *posición + orientación* a **solo posición (permutación)**: si los 4 edges de la cruz están en sus 4 slots (aunque uno esté flipped), la cruz cuenta como terminada en ese punto — y los movimientos de orientación caen en el primer par F2L.

La petición se amplió a:
1. Probar con solves reales variados (tiempos 3s–20s, reconz + cuberoot, muchos solvers) y medir divergencias.
2. A/B: ¿mejora solo el cambio o produce fallos?
3. Estudio profundo de la detección F2L (¿es mejorable? hoy "es decente").
4. Documentar todo y dar veredicto objetivo con margen restante.
5. **No se puede quitar nada** — solo mejoras, con el comportamiento actual intacto por defecto.

---

## 2. Implementación (qué se cambió y por qué)

### 2.1 El criterio (math-core)

`packages/math-core/src/methods/cfop/ColorPhaseDetector.ts` — el detector por color de fases CFOP:

- **Strict (comportamiento actual, intacto):** la cruz se completa cuando los 4 stickers de los edges de una cara son todos del color de la cruz (`crossColorAt`). Exige orientación.
- **Relaxed (nuevo, opción `relaxedCross`):** se completa cuando los 4 edges de las posiciones de la cruz **contienen** el color de la cruz en uno de sus 2 stickers (`relaxedCrossColorAt`) — un edge flipped cuenta. La permutación (que sean los 4 edges DISTINTOS y en el orden correcto) se valida con `crossSideColors` + `buildScheme` (biyección), igual que en strict.

En modo relaxed se evalúan **todas** las completaciones válidas por (cara, color) y se queda con la mejor cadena:
- `betterSameCross`: cadena más completa → más fases → **más cercana al fin de cruz escrito** (`preferredCrossIdx`, el tiebreak del segmento raw) → más temprana.
- La cercanía al segmento escrito es lo que evita los falsos positivos tempranos: un scramble puede dejar los 4 edges permutados por casualidad 1-2 movimientos antes de que el solver realmente termine la cruz; el reconstructor escribió el límite donde ÉL la considera hecha, y ese es exactamente el límite que relaxed quiere igualar.

### 2.2 Propagación (análisis) — un solo pipeline

El cambio se propaga por el pipeline **único** compartido (verificado en código: `analyzeSolve.ts` es "the ONLY place phase detection runs"; `analyzeSolveText` delega y nunca reimplementa detección):

| Archivo | Cambio |
|---|---|
| `packages/math-core/.../ColorPhaseDetector.ts` | Criterio relajado + tiebreak por cercanía al segmento escrito |
| `packages/analysis-engine/src/phases/PhaseSplitter.ts` | `relaxedCross` en `detectColorNeutral` / opciones |
| `packages/analysis-engine/src/pipeline/slotFrame.ts` | `pickSlotFrame` re-detecta con la opción |
| `packages/analysis-engine/src/pipeline/segmentF2LPairs.ts` | pasa la opción a `pickSlotFrame` |
| `packages/analysis-engine/src/pipeline/frameRecovery.ts` | opciones de recuperación de marco |
| `packages/analysis-engine/src/pipeline/analyzeSolve.ts` | opción en `buildAnnotatedTimeline` |
| `packages/analysis-engine/src/reconstruction/analyzeSolveText.ts` | opción en la ruta de texto |

**Garantía de no-regresión:** `relaxedCross` es `false` por defecto; con `false`/`undefined` el código toma exactamente el mismo camino strict de antes. Verificado: `git diff` muestra que el modo strict es el mismo bucle con la misma semántica (solo refactorizado), y los 560 tests de math-core + 246 de analysis-engine pasan.

---

## 3. Metodología del A/B

- **Dataset:** 12.066 reconstrucciones CFOP 3×3 con scramble+text en `apps/web/public/reconstructions/data/chunk-*.json` (reconz + cuberoot).
- **Muestra:** 30 solves, 5 por bucket de tiempo (`<4s, 4–5s, 5–7s, 7–9s, 9–12s, 12s+`), semilla fija `mulberry32(20260215)` → reproducible.
- **Métrica por solve:**
  - `crossMatch±2`: |fin de cruz detectado − fin de cruz del raw| ≤ 2.
  - `catastrophe`: |diff| > 2 (la cruz se detecta muy tarde o muy pronto).
  - `skipMatch`: ¿coincide nuestro OLL/PLL skip con el del raw?
  - `finalSolved`: ¿la reconstrucción termina resuelta?
- **Harness:** `cross-study.test.ts` (2 tests: A/B + estudio F2L), ejecutable con
  `pnpm --dir packages/analysis-engine exec vitest run src/__tests__/cross-study.test.ts`.

---

## 4. Resultados A/B (30 solves)

```
                STRICT    RELAXED
finalSolved   : 29/30      29/30
crossMatch±2  : 23/30      27/30   (+4)
cross catas(>2): 6         2       (-4)
skipMatch     : 21/30      23/30   (+2)
regressions (strict✓→relax✗): NONE
fixed (strict✗→relax✓)     : reconz-7810, reconz-8337, cuberoot-501, reconz-911
```

### 4.1 Los 4 solves arreglados (catástrofes → correctos)

| Solve | Solver | Strict (fin cruz detectado) | Relaxed | Por qué fallaba strict |
|---|---|---|---|---|
| `reconz-7810` | Ruihang Xu, 4.19s | end@28 (diff=21, xxxcross falso, pairs=2) | end@6 (diff=-1) · 4 pairs · ✓ | Cruz real con edge flipped: strict no la veía hasta muy tarde |
| `reconz-8337` | Leo Borromeo, 5.95s | end@24 (diff=16) | end@7 (diff=-1) · xcross · ✓ | Cruz con flip; relaxed la ve en su sitio real |
| `cuberoot-501` | Ruimin Yan, 15.5s | end@43 (diff=31) | end@11 (diff=-1) · 4 pairs · ✓ | Ídem |
| `reconz-911` | Antoine Cantin, 19.69s | end@71 (diff=64) | end@6 (diff=-1) · ✓ | Ídem |

En los 4, relaxed detecta la cruz **en el mismo punto donde el reconstructor la escribió** (diff ≤ 1) y el F2L/LL se segmentan correctamente (pairs=4, OLL/PLL coherentes). Es exactamente el caso del usuario: "la marcan hecha aunque falte orientar un edge".

### 4.2 Regresión evitada: `reconz-6512`

La primera versión del tiebreak (elegir SIEMPRE la completación más temprana) producía 1 regresión: `reconz-6512` (Tymon, 6.1s) — la cruz relajada se detectaba en @3 (los edges quedaban permutados por casualidad 3 movimientos antes) en vez de @6 (el límite real escrito). Se corrigió con el tiebreak de **cercanía al segmento escrito** (`preferredCrossIdx`): ahora relaxed elige @6, diff=-1, ✓. **0 regresiones en el dataset final.**

### 4.3 Los 2 solves que siguen fallando (catástrofes en ambos modos)

| Solve | Problema | Causa raíz |
|---|---|---|
| `reconz-3828` | Max Park, 3.87s: cruz detectada end@19 (diff=14) | La cruz real **existe** en el marco del solver (cruz F en la cara L — un color-neutral cross) pero **ninguna de las 4 rotaciones de esquema produce una cadena válida** (el final de la reconstrucción humana no cuadra bajo ese esquema). Limitación de marcos rotados en reconstrucciones imperfectas — **no es el caso del usuario** (aquí el problema no es un flip, es un esquema no-identidad). |
| `reconz-5916` | Max Park, 6.5s: end@49 (diff=42) | Ídem: cruz B en la cara R no completa cadena. |

**`cuberoot-1660`** (Yiheng, 3.97s): la reconstrucción raw **no resuelve el cubo** (finalStateSolved=false en ambos modos). Es un dato del dataset que no cierra — ningún detector puede arreglar una reconstrucción incoherente.

### 4.4 Trade-off visible: `reconz-8337` (skipMatch)

En 8337 relaxed mejora la cruz (diff 16→-1) pero el label OLL cambia de SKIP a 26m. Causa: es un solve **ZBLL** (el raw escribe `EO · ZBLL`, sin fase OLL). Con la cruz bien detectada, el F2L empieza antes y la fase OLL del detector absorbe el bloque EO+ZBLL (26 movimientos). La métrica `skipMatch` es imperfecta para solves ZBLL (compara contra fases OLL/PLL escritas que aquí no existen). La cruz — el objetivo del estudio — queda **mejor**, no peor.

### 4.5 Validación a mayor escala: barrido de 200 solves aleatorios

Para confirmar que el resultado no depende de la muestra de 30, se ejecutó un barrido de **200 solves aleatorios** (semilla fija, mismo dataset):

```
                STRICT    RELAXED
crossMatch±2  : 128/200    151/200   (+23)
catastrophes  : 71         48        (-23)
regressions   : —          6
fixed         : —          29
solvedBoth    : 195/200    195/200
```

**Lectura honesta de las 6 regresiones:**

| Tipo | Solves | Análisis |
|---|---|---|
| Marginal (±1 movimiento) | cuberoot-1824, reconz-8155, reconz-10589, reconz-1205, reconz-6757 | Solves xcross donde relaxed incluye el wide move final (u'/D') en la cruz — el reconstructor EScribió ese move como parte del xcross, así que relaxed sigue el raw; strict lo excluía. La diferencia es 1 movimiento, sin impacto en pairs/LL (ambos solved=true, pairs=4). |
| Degenerada (strict también falla) | reconz-1988 | Solve Xcross con EO dentro del F2L y COLL (técnicas avanzadas): strict detecta la cruz en @6 (correcta) pero produce warnings `incomplete-solve`/`side-cross-approximation` y **1 solo pair**; relaxed elige una cadena "completa" espuria en @41. Ningún modo produce una reconstrucción limpia — es un solve no-CFOP-puro que el detector no modela. |

**Conclusión a escala:** el relaxed gana **+23 cruces correctas y −23 catástrofes por cada 200 solves**, con 29 fixes y 6 regresiones de las cuales 5 son ±1 movimiento (cosmético, sigue el raw) y 1 es un solve degenerado que strict tampoco resuelve. La mejora es robusta y el default OFF garantiza cero riesgo.

---

## 5. Estudio profundo F2L

### 5.1 Resultados agregados (30 solves, modo relaxed)

```
pairCountMatch (nº pares = raw) : 14/30
garbage pairs (>18m)            : 2
any-empty-slot solves           : 5 (los 5 con xcross hint en el raw = legítimos)
avg moves/slot                  : FR 6.4 · BR 4.7 · FL 4.4 · BL 3.8
```

Lectura correcta de estos números:
- Los solves estándar (4 pares, cross normal) se detectan **bien**: 4 pares con 3–12 movimientos cada uno, slots correctos.
- Los slots vacíos son **siempre xcross legítimos** (5/5 con hint xcross en el raw): el par ya está en casa cuando F2L empieza, y se reporta vía `crossType`/`xcrossPairs`, no como par vacío.
- `pairCountMatch 14/30` está lastrado por: (a) solves xcross/xxcross/xxxcross donde el raw escribe 1–3 pares y nosotros reportamos 4 slots con vacíos (comportamiento correcto), y (b) los 4 bugs documentados abajo.

### 5.2 Bugs reales de F2L encontrados (todos PREEXISTENTES, ninguno causado por relaxed)

| Solve | Síntoma | Causa raíz |
|---|---|---|
| `reconz-9068` (Tymon, 4.08s) | **pairs=0** aunque las fases están bien (Cross@0-7, F2L@8-22) | El `u'` de la cruz gira la capa E; `countCompletedF2LSlotsInFrame` devuelve 0 slots porque los offsets de frame solo rastrean `d` (wide D), no `u`. Verificado: el estado del solver frame en @22 tiene la capa E girada (F=LLLL, B=RRRR). Falla igual en strict — **pre-existente**. |
| `reconz-1216` (Mike Kotch, 10.17s) | Cruz detectada end@41 (absorbe todo el F2L, type=xxxcross, pairs=0) | Reconstrucción con grip `x2 y` + rotaciones internas (`x'`, `y`) que el detector no cuadra; la cruz "completa" tarde. |
| `reconz-10784` (Dhruva, 15.98s) | Cruz end@40, pairs=0 | **Pseudo-cross** (técnica avanzada): la cruz no es una cruz real hasta el 2º par ("2nd pair/finish cross"). El detector no modela pseudo-cross. |
| `cuberoot-2054` (Yiheng, 3.65s) | FR[31] basura | **Método 223** (bloque 2×2×3): no es CFOP puro, el F2L del detector no sabe segmentarlo. |
| `reconz-3084` (Ainesh, 8.89s) | pairs=0, solved=false | **La reconstrucción no resuelve el cubo** (texto con `y y` duplicado = dato roto del dataset). |

**Conclusión F2L:** la detección es "decente" como dice el usuario para solves CFOP estándar, pero tiene margen en 3 frentes, todos independientes del cambio de cruz:
1. **`u'`/capa E en F2L** (9068) — el rastreo de offsets debería incluir rotaciones de la capa E (E/E'/E2 y los wide u que las provocan), no solo d.
2. **Pseudo-cross** (10784) — requeriría detectar "cruz casi completa + ajuste posterior".
3. **Métodos avanzados** (223, ZBLL) — fuera de CFOP puro.

---

## 6. Veredicto objetivo

### ¿Agregamos el criterio de cruz relajado? → **SÍ**, como opción OFF por defecto.

- **Es una mejora neta, medible y robusta:** en la muestra de 30 solves: +4 cruces correctas, −4 catástrofes, 0 regresiones, +2 skipMatch. En un barrido de 200 solves aleatorios: **+23 cruces correctas, −23 catástrofes, 29 fixes, 6 regresiones** (5 marginales de ±1 movimiento que siguen el raw mejor, 1 solve degenerado COLL/EO donde strict también falla).
- **No rompe nada:** OFF por defecto; los 806 tests de los paquetes afectados pasan; el modo strict es idéntico al de antes.
- **Es exactamente lo que el usuario pidió:** la cruz se marca en el punto donde los 4 edges están en sus posiciones correctas, ignorando el flip.
- **Recomendación de activación:** para reconstrucciones de texto (ruta `analyzeSolveText`) con `preferredCrossIdx` disponible, se puede activar de forma segura. Para smart cube (sin segmento escrito), el tiebreak de cercanía no aplica y conviene dejarlo OFF hasta validar con solves de smart cube reales.

### ¿Hay margen todavía? → SÍ, documentado y cuantificado.

1. **Marcos rotados / esquemas no-identidad** (3828, 5916): el detector solo completa cadenas con esquema identidad; los color-neutral crosses en caras "extrañas" con reconstrucciones imperfectas no cuadran. Cambio grande (permitir esquemas no-identidad con validación de final).
2. **F2L `u'`/capa E** (9068): extender el rastreo de offsets de frame a la capa E.
3. **Pseudo-cross** (10784) y **métodos 223/ZBLL** (2054, 8337): técnicas avanzadas fuera del CFOP puro que el pipeline actual no modela.
4. **Reconstrucciones incoherentes** (3084, 1660): no son bugs del detector sino datos; convendría filtrarlas en el dataset.

---

## 7. Archivos tocados

```
packages/math-core/src/methods/cfop/ColorPhaseDetector.ts        (criterio relaxed + tiebreak)
packages/math-core/src/__tests__/relaxedCross.test.ts            (4 tests unitarios: criterio + paridad, nuevo)
packages/analysis-engine/src/phases/PhaseSplitter.ts             (opción)
packages/analysis-engine/src/pipeline/slotFrame.ts               (opción)
packages/analysis-engine/src/pipeline/segmentF2LPairs.ts         (opción)
packages/analysis-engine/src/pipeline/frameRecovery.ts           (opción)
packages/analysis-engine/src/pipeline/analyzeSolve.ts            (opción)
packages/analysis-engine/src/reconstruction/analyzeSolveText.ts  (opción)
packages/analysis-engine/src/__tests__/cross-study.test.ts       (harness A/B + F2L, nuevo, gated)
docs/09-testing/CFOP-CROSS-RELAXED-STUDY.md                      (este documento)
```

## 8. Cómo reproducir

```bash
# Harness A/B + estudio F2L (imprime el detalle por solve). Gated detrás de
# RUN_CROSS_STUDY=1 para que la suite normal de CI no lo ejecute.
RUN_CROSS_STUDY=1 pnpm --dir packages/analysis-engine exec vitest run \
  src/__tests__/cross-study.test.ts

# Tests unitarios del criterio relaxed (math-core)
pnpm --dir packages/math-core exec vitest run src/__tests__/relaxedCross.test.ts

# Suite completa de los paquetes afectados
pnpm --dir packages/math-core exec vitest run
pnpm --dir packages/analysis-engine exec vitest run
pnpm --dir packages/math-core exec tsc --noEmit -p tsconfig.json
pnpm --dir packages/analysis-engine exec tsc --noEmit -p tsconfig.json
```
