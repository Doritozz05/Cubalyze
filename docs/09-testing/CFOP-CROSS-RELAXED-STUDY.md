# Estudio exhaustivo: criterio de cruz relajado + detección F2L

> **Estado:** COMPLETADO + ACTIVADO (2026-08-10) · Branch `algortihms`
> **Autor del estudio:** Buffy (asistente de código)
> **Harness reproducible:** `packages/analysis-engine/src/__tests__/cross-study.test.ts` + `divergence-study.test.ts`
> **Veredicto corto:** el criterio relajado es una **mejora neta** — con la métrica correcta, **74 fixes y 0 regresiones** sobre 300 solves (antes de los fixes: 58 fixes / 1 regresión) — y se agregó como opción **OFF por defecto** (smart cube) pero **ACTIVADO en la ruta de reconstrucciones de texto de la web** (`relaxedCross: true`). Además se **arregló el bug de capa E en F2L** (reconz-9068: `u'` en la cruz + `d'` compensador) con un DP de frame medido desde el estado, sin cambiar el comportamiento por defecto del smart cube.

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
| `reconz-9068` (Tymon, 4.08s) | **pairs=0** aunque las fases están bien (Cross@0-7, F2L@8-22) | ~~El `u'` de la cruz gira la capa E; los offsets de frame solo rastrean `d` (wide D), no `u`~~ → **ARREGLADO** (ver §5.3). |
| `reconz-1216` (Mike Kotch, 10.17s) | Cruz detectada end@41 (absorbe todo el F2L, type=xxxcross, pairs=0) | Reconstrucción con grip `x2 y` + rotaciones internas (`x'`, `y`) que el detector no cuadra; la cruz "completa" tarde. |
| `reconz-10784` (Dhruva, 15.98s) | Cruz end@40, pairs=0 | **Pseudo-cross** (técnica avanzada): la cruz no es una cruz real hasta el 2º par ("2nd pair/finish cross"). El detector no modela pseudo-cross. |
| `cuberoot-2054` (Yiheng, 3.65s) | FR[31] basura | **Método 223** (bloque 2×2×3): no es CFOP puro, el F2L del detector no sabe segmentarlo. |
| `reconz-3084` (Ainesh, 8.89s) | pairs=0, solved=false | **La reconstrucción no resuelve el cubo** (texto con `y y` duplicado = dato roto del dataset). |

**Conclusión F2L:** la detección es "decente" como dice el usuario para solves CFOP estándar. Queda margen en 2 frentes, ambos independientes del cambio de cruz:
1. **Pseudo-cross** (10784) — requeriría detectar "cruz casi completa + ajuste posterior".
2. **Métodos avanzados** (223, ZBLL) — fuera de CFOP puro.

### 5.3 FIX — bug de capa E en F2L (reconz-9068)

**Síntoma:** la reconstrucción de Tymon pone un **`u'` dentro de la cruz** (xcross `L D L' U' R u' U R`) y un **`d'` dentro del 3er par**. Un `u'` rota la capa E junto con U — el bloque D+E NO acaba donde un acumulador de tokens predeciría, y el `d'` del F2L **compensa** esa rotación. El rastreo por tokens (`solverFrameOffsets`, solo `d`) sumaba ambas rotaciones y corrompía el análisis de slots → pairs=0.

**Causa raíz:** el frame de F2L (bloque D+E) no se puede acumular desde los tokens; hay que **medirlo desde el estado**. La rotación real del bloque queda reflejada en las piezas: se elige, por índice, la rotación D/E que maximiza los slots en casa.

**Fix (state-based, DP Viterbi):**
- `bestFrameRotationSequence` en `slotDetection.ts`: secuencia de rotaciones D/E sobre el tramo F2L que **maximiza la suma de slots** con penalización por cambio de frame (`changePenalty=2` por unidad de rotación). Un DP de 16 estados resuelve la ambigüedad índice-a-índice (9068 @7: 1/1 y 3/3 empatan a 1 slot; solo el tramo completo decide) y captura automáticamente:
  - **regrips reales persistentes** (reconz-12340: el `d` del par 4 mantiene el bloque rotado hasta el final → el marco rotado muestra el 4º par),
  - **compensaciones** (9068: el `d'` devuelve el bloque a identidad → el DP lee el frame compensado del estado).
- Los 3 consumidores (`segmentF2LPairs`, `pickSlotFrame`, el check xcross de `PhaseSplitter`) comparten el mismo DP sobre el mismo tramo → nunca divergen.
- **Rendimiento:** `countCompletedF2LSlotsInFrame` se reescribió sin conversión de facelets (check directo sobre arrays de permutación, equivalente exacto verificado contra un oráculo de facelets en 3840 combinaciones — y **más correcto** que el camino viejo en esquemas ambiguos U↔D, que identificaba piezas por set de colores y perdía la orientación). El DP usa además un camino por preimagen que no materializa los estados rotados. Coste por solve: ~30ms (antes ~160ms con el primer DP naive).

**Resultado:** 9068 → **xcross (FR) + 3 pares (BL, BR, FL) coincidiendo token a token con el raw** (`L' U' L` · `d' R' U2' R U R' U' R` · `U' L' U L`). 12340 sigue perfecto (xcross BL + 3 pares con el `d` del 4º par). 1296 indiferente.

**Tests:** `packages/math-core/src/__tests__/frameRotation.test.ts` (8 tests: equivalencia contra oráculo, fast path ≡ materializado, DP sintético persistente/compensado/identidad) + `packages/analysis-engine/src/__tests__/reconz-9068-e-layer.test.ts` (regresión end-to-end con fixture autocontenido).

---

## 6. Veredicto objetivo

### ¿Agregamos el criterio de cruz relajado? → **SÍ**, como opción OFF por defecto.

- **Es una mejora neta, medible y robusta:** con la **métrica correcta** (la misma `conjugatePhaseStream` que usa el pipeline, ±2): sobre 300 solves aleatorios deterministas (semilla 314159), **74 fixes (strict✗→relax✓) y 0 regresiones (strict✓→relax✗)**, bothGood=211, bothBad=15. Las "6 regresiones" del barrido aproximado eran artefactos del conteo: con la métrica correcta los 6 keys resultan **fixes** (relaxed acierta el raw donde strict se desvía ±1).
- El **fix del tiebreak** (en relaxed, preferir la cercanía al fin de cruz escrito por encima de la completitud de la cadena) eliminó la única regresión real (reconz-727, solve COLL): de 58 fixes / 1 regresión a **72 fixes / 0 regresiones**, y el fix de capa E lo dejó en **74 fixes / 0 regresiones**.
- **No rompe nada:** OFF por defecto; los 810 tests de los paquetes afectados pasan; el modo strict es idéntico al de antes.
- **Es exactamente lo que el usuario pidió:** la cruz se marca en el punto donde los 4 edges están en sus posiciones correctas, ignorando el flip.
- **ACTIVADO en la ruta de texto (2026-08-10):** `apps/web/src/views/Reconstructions/reconData.ts` (`deriveReconStats`, la fuente de `ourDetection` compartida) y `OurDetectionPanel.tsx` (fallback defensivo) pasan ahora `relaxedCross: true`. Es seguro porque la ruta de texto siempre computa `preferredCrossIdx` desde el segmento de cruz escrito (0 regresiones medido en 300 solves). El smart cube (`useSolveSession` → `analyzeSolve`) **sigue OFF** (sin segmento escrito, el tiebreak de cercanía no aplica).

### ¿Hay margen todavía? → SÍ, documentado y cuantificado.

1. **Marcos rotados / esquemas no-identidad** (3828, 5916): el detector solo completa cadenas con esquema identidad; los color-neutral crosses en caras "extrañas" con reconstrucciones imperfectas no cuadran. Cambio grande (permitir esquemas no-identidad con validación de final).
2. **Pseudo-cross** (10784, 4319, 11663, 3467, …): el detector no modela "cruz casi completa + ajuste dentro del 1er/2º par". Ver §4.6.
3. **Métodos 223/ZBLL** (2054, 8337, 11047, 2678, …): técnicas avanzadas fuera del CFOP puro que el pipeline actual no modela.
4. **Reconstrucciones incoherentes** (3084, 1660): no son bugs del detector sino datos; convendría filtrarlas en el dataset.

### 4.6 Los 15 bothBad restantes — taxonomía (300 solves, ambos modos fallan)

El estudio ampliado imprime la lista completa de ambosBad (los solves donde NI strict NI relaxed igualan el fin de cruz escrito dentro de ±2):

```
bothGood 211 · relaxedGood(FIX) 74 · strictGood(REGR) 0 · bothBad 15 · sin cruz escrita 0
```

Los 15 se descomponen en 3 categorías — **ninguna es CFOP estándar puro**:

| Categoría | Solves | Por qué no dan igual |
|---|---|---|
| **Pseudo-cross / partial cross** (la cruz NO está completa al final del bloque escrito) | reconz-4319 (`pseudo cross` + `3rd pair+fix cross`), reconz-11663 (`pseudo xcross`), reconz-3467 (`partial cross` + `3rd pair+finish cross`), reconz-2164, reconz-10412, reconz-7155, reconz-2546, reconz-6938 | El solver deja la cruz a propósito SIN terminar (3 edges + el 4º fuera de lugar); la cruz solo se completa DENTRO del 1er-3er par (`M2' U2' M2' …` en 4319). NINGÚN criterio de "cruz completa" puede igualar el fin del bloque escrito — la cruz no existe como fase completa antes del F2L. Fix requerido: un detector de pseudo-cross (nueva feature, no un ajuste del criterio). |
| **Convención xxcross/xxxcross** | reconz-5828, reconz-6371, reconz-7155 | El reconstructor escribe la cruz como bloque corto (solo los 4 edges) y los pares por separado; nuestro detector reporta la cruz extendida hasta donde completan los pares pre-resueltos (xcross/xxcross/xxxcross). La etiqueta `crossType` del panel YA muestra el tipo correcto — es una diferencia de etiquetado, no de detección. |
| **Última capa avanzada (ZBLL/ZBLS/1LLL/EOLS)** | reconz-11047 (`4th pair/ZBLS` + `ZBLL`), reconz-2678 (`4th pair/EOLS` + `ZBLL`), reconz-8236, cuberoot-574 (`1LLL-F`), reconz-5828 | El par 4 incluye EO/ZBLS y la LL es de una mirada; la cadena canónica OLL→PLL del detector no se alinea con las etiquetas raw. Métodos avanzados — fuera del alcance actual (CFOP puro). |

**Conclusión:** el relaxed con tiebreak por segmento escrito ya está en su máximo para CFOP estándar (0 regresiones). Los 15 restantes son técnicas no-CFOP-puro; reducirlos requiere (en orden de valor/riesgo): (1) detector de pseudo-cross, (2) mapear el bloque de cruz del raw solo a los moves de cruz (dejar los pares en F2L) en solves xcross, (3) soporte ZBLL/223 — los tres son features nuevas, no mejoras del criterio actual.

---

## 7. Archivos tocados

```
packages/math-core/src/methods/cfop/ColorPhaseDetector.ts        (criterio relaxed + tiebreak)
packages/math-core/src/methods/cfop/slotDetection.ts             (contador directo sin facelets, DP de frame, fast path por preimagen)
packages/math-core/src/__tests__/relaxedCross.test.ts            (4 tests unitarios: criterio + paridad, nuevo)
packages/math-core/src/__tests__/frameRotation.test.ts           (8 tests: equivalencia oráculo + fast path + DP, nuevo)
packages/analysis-engine/src/phases/PhaseSplitter.ts             (opción + DP de frame en xcross)
packages/analysis-engine/src/pipeline/slotFrame.ts               (opción + DP de frame en picker)
packages/analysis-engine/src/pipeline/segmentF2LPairs.ts         (opción + DP de frame en el scan de pares)
packages/analysis-engine/src/pipeline/frameRecovery.ts           (opción)
packages/analysis-engine/src/pipeline/analyzeSolve.ts            (opción)
packages/analysis-engine/src/reconstruction/analyzeSolveText.ts  (opción)
packages/analysis-engine/src/__tests__/cross-study.test.ts       (harness A/B + F2L, nuevo, gated)
packages/analysis-engine/src/__tests__/divergence-study.test.ts  (harness A/B con métrica correcta, nuevo, gated)
packages/analysis-engine/src/__tests__/reconz-9068-e-layer.test.ts (regresión capa E, nuevo)
apps/web/src/views/Reconstructions/reconData.ts                 (relaxedCross: true en la ruta de texto)
apps/web/src/views/Reconstructions/OurDetectionPanel.tsx        (relaxedCross: true en el fallback)
docs/09-testing/CFOP-CROSS-RELAXED-STUDY.md                      (este documento)
```

## 8. Cómo reproducir

```bash
# Harness A/B + estudio F2L (imprime el detalle por solve). Gated detrás de
# RUN_CROSS_STUDY=1 para que la suite normal de CI no lo ejecute.
RUN_CROSS_STUDY=1 pnpm --dir packages/analysis-engine exec vitest run \
  src/__tests__/cross-study.test.ts

# Divergencia strict vs relaxed con la métrica correcta (300 solves). Gated
# detrás de RUN_DIVERGENCE_STUDY=1. Imprime el resumen (74 fixes / 0
# regresiones / 15 bothBad) Y la lista completa de bothBad (✗✗) con sus
# etiquetas raw para auditar por qué no dan igual.
RUN_DIVERGENCE_STUDY=1 pnpm --dir packages/analysis-engine exec vitest run \
  src/__tests__/divergence-study.test.ts

# Tests unitarios del criterio relaxed + frame D/E (math-core)
pnpm --dir packages/math-core exec vitest run src/__tests__/relaxedCross.test.ts
pnpm --dir packages/math-core exec vitest run src/__tests__/frameRotation.test.ts

# Regresión end-to-end del fix de capa E
pnpm --dir packages/analysis-engine exec vitest run src/__tests__/reconz-9068-e-layer.test.ts

# Suite completa de los paquetes afectados
pnpm --dir packages/math-core exec vitest run
pnpm --dir packages/analysis-engine exec vitest run
pnpm --dir packages/math-core exec tsc --noEmit -p tsconfig.json
pnpm --dir packages/analysis-engine exec tsc --noEmit -p tsconfig.json
```
