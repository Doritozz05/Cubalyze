# Plan — Reconstrucción desde cero (rama `algortihms`)

> **Estado:** Fase 0 ✅ **ejecutada** (2026-08-07) · Fases 1-2 pendientes · **Rama:** `algortihms`
>
> Objetivo: **sin romper el pipeline de stats** (que funciona), borrar todo el sistema
> de reconocimiento/reconstrucción actual (que no funciona), y rehacer la reconstrucción
> desde cero usando el propio pipeline de stats: dado `setup + inspection + solución`,
> devolver fases, pares F2L con color, rotaciones, OLL/PLL y skips — prácticamente lo
> mismo que produce el smartcube, pero sin timestamps.

---

## 1. Diagnóstico actual

La rama `algortihms` trae ~342k líneas nuevas respecto a `main`. Se dividen en **tres mundos**
con suerte muy distinta:

| Mundo | Qué contiene | Estado |
|---|---|---|
| **Stats (pipeline de análisis)** | `TimelineBuilder → PhaseSplitter → MetricsAggregator` + métricas (TPS, pauses, fluidity, efficiency, rotations, redundancy) + `derived/*` + `ColorPhaseDetector` (detección de fases por geometría de stickers: ve cross blanco en D, cualquier color, CN) | ✅ Funciona (en `main` y aquí) |
| **Reconocimiento de casos / reconstrucción** | `algorithm-db/src/recognition/*` (`reconstructionAnalyzer`, `conventions`, `rotationGroup`, `signatures`, `caseIndex`) + el puente `analysis-engine/src/recognition/solveRecognition.ts` + sus tests + `scripts/debug-oll5.ts` | ❌ No funciona / "canonical condition rarísimas" |
| **Catálogo de algoritmos (Algorithm DB)** | Seed `cfop-f2l/oll/pll/cls/ell/sv/coll/wv/antipll`, `methodRegistry` (incl. método "Advanced 3x3"), `caseGenerator`, `casePresentation`, `auf.ts`, `caseVerifier` | ✅ Se queda (pestaña Algorithms, training, database lo consumen) |

**Dependencia del reconocimiento:** nada fuera de ese stack importa los módulos de
`recognition` (verificado con búsqueda). El único consumidor externo es
`solveRecognition.ts`, que solo usa `analyzeReconstruction`. El corte es limpio.

### Respuestas a tus preguntas

**¿Qué es `moveNotation.ts` y no existe ya algo bueno en el repo?**
Es el **tokenizador** de strings de reconstrucción reales (CubeRoot / Quest / lo que pegues):
normaliza primes Unicode (`’ ′ ´`), movimientos pegados (`U2U`), giros numerados (`R3 → R'`),
separadores `↑ ·`, grupos `()`, y expande wide moves (`r → R M'`). Es **la única parte buena
de `recognition`**: tiene su test (`moveNotation.test.ts`) y es exactamente lo que la Fase 2
necesita para parsear tu string. En el repo ya existe `expandWideMoves` y `CubeState.applySequence`
en `math-core`, pero **ninguno** maneja el texto sucio de una reconstrucción real; `moveNotation`
es la capa que los envuelve. **Recomendación:** rescatarlo y moverlo a `math-core` (ver Fase 0.3),
en vez de borrarlo con el resto. Si prefieres no rescatar nada, en Fase 2 se reescribe un
tokenizer equivalente (~90 líneas), pero es tirar código que ya funciona y está testeado.

**¿El catálogo de algs y los scripts de generación?** Se quedan tal cual (tú lo confirmaste).
Solo se borran los *debugs raros*: `scripts/debug-oll5.ts` (referencia `../pruebas/speedcubedboll.html`)
y los tests de reconocimiento que ya no tendrán código que probar.

**¿Qué era la pregunta de la "API recon"?** Se refería a si en Fase 2 la nueva función
`analyzeSolveText()` se queda solo como función headless (se llama desde código, devuelve datos)
o si además se añade ya una caja de "pegar reconstrucción" en la vista web de Reconstructions.
**Decisión: headless primero** (Fase 2); el pegado en web queda como Fase 3 opcional, reutilizando
`ReplaySection`/`ReplayEngine` sin tocar el flujo smartcube.

---

## Fase 0 — Limpieza profunda (borrar lo que no funciona)

Resultado: la rama queda **solo con stats + catálogo de algs, sin detección de casos**.

### 0.1 Borrar

- `packages/algorithm-db/src/recognition/` → **todos** los archivos:
  - `reconstructionAnalyzer.ts` (el "horrible")
  - `conventions.ts`, `rotationGroup.ts`, `signatures.ts`, `caseIndex.ts`
  - `moveNotation.ts` → **rescatar** (ver 0.3), no borrar en silencio
- `packages/algorithm-db/src/__tests__/recognition/`:
  - `reconstruction-2510.test.ts`, `f2l-invariance.test.ts`, `ollPll-recognition.test.ts`,
    `rotationGroup.test.ts` → borrar
  - `moveNotation.test.ts` → se mueve con `moveNotation`
- `packages/analysis-engine/src/recognition/solveRecognition.ts` + test
  (`__tests__/recognition/solveRecognition.test.ts`)
- `scripts/debug-oll5.ts` (debug raro; ver knip en 0.4)
- **Exports** en `packages/algorithm-db/src/index.ts`: el bloque
  `// ─── Reconstruction recognition pipeline ───` (tokenize…, rotationGroup…, conventions…,
  signatures…, caseIndex…, analyzeReconstruction…)
- **Exports** en `packages/analysis-engine/src/index.ts`: el bloque
  `// ─── Reconstruction Case Recognition ───` (`recognizeSolve` y tipos)
- `packages/analysis-engine/package.json`: quitar la dependencia `@cubeforge/algorithm-db`
  (se añadió en esta rama solo para `solveRecognition`)

### 0.2 NO tocar (lo que funciona / lo que se queda)

- **Stats:** `analysis-engine` completo salvo lo listado arriba — `TimelineBuilder`,
  `PhaseSplitter` (con `ColorPhaseDetector`), `MetricsAggregator`, todas las métricas, `derived/*`.
  El `PhaseSplitter` de esta rama se queda **tal cual** (es mejora sobre `main`: detecta cross
  blanco en D mediante geometría, como tu ejemplo).
- **math-core:** `CubeState` (incl. moves extendidos — los necesita `expandWideMoves`),
  `FaceletStringConverter`, `StateMatcher`, `cfopMasks`, `MoveTransformer`.
- **Catálogo:** `algorithm-db` salvo `recognition/` — seed, `methodRegistry` (incl. "Advanced 3x3"),
  `caseGenerator`, `casePresentation`, `auf.ts`, `caseVerifier`, `moveMetrics`, tests scdb.
- **Web / smartcube:** `useSolveSession`, `useSolveCompletion`, `solveAnalysisCoordinator`,
  Insights, `ReplaySection`, vista Reconstructions (JSON estático de `public/reconstructions/`).
- `pruebas/` (local, **gitignored**): fuera de git; no se borra. Los backups `backup_2026*.zip`
  se pueden archivar aparte si se quiere, pero no afecta al repo.

### 0.3 Rescatar `moveNotation` (con su test)

- Mover a **`packages/math-core/src/notation/moveNotation.ts`** (importa `expandWideMoves` de
  math-core, ya es su casa natural; no crea ciclos porque math-core no depende de nadie).

**⚠️ Hueco encontrado (2026-08-07):** `tokenize` trataba `↑` y `·` como separadores, pero **no
`↓` ni `.`** — y CubeRoot los usa muchísimo (p.ej. `x'↓R U2 R U'`, `R U'.R U' …`).
`tokenize("x'↓R U2 R U'")` devolvía `["x'↓R", "U2", "R", "U'"]` (un token roto) en vez de
`["x'", "R", "U2", "R", "U'"]`. Esto también explica el `↓` que aparecía en la web de
Reconstructions: el JSON bakeado (`public/reconstructions/*`) guardó el `moves` crudo sin
normalizar (el build script `pruebas/scripts/build-recon-web-data.ts` partió por `//` pero no
limpió los separadores), y `reconData.notationToReplayMoves` solo partía por espacios → un token
`x'↓R` generaba un evento fantasma con face `'x'` en el replay.

**✅ Aplicado ya (2026-08-07):** regex ampliado a `/\[↑·↓.\]/g` + test nuevo
(`moveNotation.test.ts`), y normalización de separadores al cargar los records en la web
(`reconData.normalizeReconSeparators` + split endurecido en `notationToReplayMoves`). Al mover
el módulo a math-core en esta fase solo se traslada, ya corregido.
- Re-exportar desde `packages/math-core/src/index.ts`:
  `tokenize, foldAdjacentSameFace, stripRotations, leadingUMoves, withoutLeadingUMoves,
  isRotation, isFaceMove, isUMove, joinMoves`.
- Mover el test a `packages/math-core/src/__tests__/moveNotation.test.ts`.
- **Nota Fase 2:** la detección de pares F2L necesita helpers puros de rotación (mapa de caras
  por rotación para nombrar slots FR/FL/BL/BR). **Ya no hay que reimplementar nada**: el
  sistema de orientación de math-core (`OrientationTable` con mapas x/y/z verificados contra
  `CubeState` + `compose`/`inverse`) + `conjugateToBaseFrame` (ver "Bug del replay" abajo)
  cubren eso. No se rescata `rotationGroup` entero.

### 0.4 Ajustes de configuración

- `knip.jsonc`: el comentario `scripts/*.ts = debug scripts (debug-oll5)` y el `entry` dejan de
  ser ciertos → cambiar a `entry: ["scripts/*.cjs"]` (quedan `find-orphans.cjs` y `lint-lines.cjs`,
  que sí están cableados: `lint:lines` en `package.json` y knip).

**Nota de ejecución (2026-08-07):** al borrar `caseIndex` quedaron huérfanos los exports
`*_SUBSET_ID` de los seed (`cfop-f2l/oll/pll/cls/ell/sv/coll/wv/antipll`) — único consumidor era
el índice borrado —, así que se eliminaron (knip los marcaba como unused exports). El catálogo de
algs no se tocó. También se quitó la dep `@cubeforge/algorithm-db` de `analysis-engine` (pnpm-lock
actualizado).

### 0.5 Validación de la Fase 0

```bash
pnpm --filter @cubeforge/algorithm-db typecheck && pnpm --filter @cubeforge/algorithm-db test
pnpm --filter @cubeforge/analysis-engine typecheck && pnpm --filter @cubeforge/analysis-engine test
pnpm --filter @cubeforge/math-core typecheck && pnpm --filter @cubeforge/math-core test
pnpm knip
```

Criterio de salida: **0 imports rotos, tests verdes en math-core/algorithm-db/analysis-engine**,
sin menciones a `recognizeSolve|analyzeReconstruction|findCrossOnDFrames|applyColorRemap` fuera
de nada.

---

## Bug del replay de Reconstructions — ✅ arreglado (2026-08-07, antes de la Fase 1)

**Síntoma:** en la vista web de Reconstructions el replay no resolvía el cubo: aplicaba el
scramble y los moves de la solución, pero el cubo quedaba sin resolver.

**Diagnóstico (confirmado con tests, no a ojo):** las reconstrucciones por texto escriben los
moves **en el frame del solver** (después de la rotación de inspección `x2 y'`).
`reconData.notationToReplayMoves` descartaba las rotaciones y soltaba los moves tal cual, en el
frame del cubo → `scramble + moves ≠ resuelto`. En el smartcube esto no pasa porque los moves
BLE ya son **físicos** (frame-independientes) y el `orientationTimeline` solo remapea las
**etiquetas** de display — por eso "en stats rota y se muestra bien" y aquí no.

**Fix (reutilización, sin duplicar matemática):**
- `OrientationTable.rotationEntryFor(token)` (nuevo, ~8 líneas): expone la búsqueda de las 9
  rotaciones base x/x'/x2/y/…/z2 que ya existían internamente.
- `math-core/notation/conjugateToBaseFrame.ts` (nuevo, ~30 líneas): camina los tokens,
  mantiene el grip acumulado y reescribe cada move del frame del solver al frame del cubo con
  `MoveTransformer.toRaw` (el mismo remap display→raw que ya usa el sistema de dynamic
  notation). Las rotaciones se consumen como actualizaciones del grip.
- `reconData.notationToReplayMoves`: `expandWideMoves` → `conjugateToBaseFrame` → eventos.
  `rotationFrame.ts` (versión scratch) se **borró**: era duplicado del sistema existente.

**⚠️ Hallazgo importante (el dato real lo cazó):** la composición del grip es
`grip = compose(rotaciónNueva, grip)` — el giro nuevo va **primero**. Empíricamente, tras
rotar `z` y luego `y`, el grip correcto es `compose(y, z)` (verificado contra `CubeState`:
`scramble + conjugado` termina **exactamente resuelto**, mientras el enfoque literal del
pipeline viejo solo daba "rotación de resuelto" — nunca quitaba el grip). Los tests de ida y
vuelta sintéticos **no** detectan este orden (son auto-consistentes); solo un solve real con
inspección genuina (`z y` de CubeRoot 2510) lo revela.

**Validación:** `conjugateToBaseFrame.test.ts` con el solve real 2510 (inspección `z y` +
rotaciones mid-solve `x' y' y'` → exactamente resuelto), solve sintético con rotación a mitad,
casos hand-computed y pass-through; `OrientationTable.test.ts` con `rotationEntryFor`;
math-core 522/522, typecheck web 0 errores, eslint limpio. Scope: solo la vista Reconstructions
(`reconData.ts`) — el flujo smartcube no usa `conjugateToBaseFrame` y no se toca.

---

## Bug 2 — Moves "perdidos" y cubos que no resuelven en Reconstructions — ✅ arreglado (2026-08-07)

**Síntoma:** tras el fix de conjugación, "algunos cubos se resuelven y otros no", la tabla de
Steps decía 66 moves y el replay 61 ("5 moves perdidos").

**Causa raíz (2 cosas, verificadas con los datos reales de los chunks):**
1. **Tokens pegados de CubeRoot** (`U'D`, `UD`, `U2U` — **727 + 439 ocurrencias** en los
   chunks): la web partía solo por espacios, así que `U'D` se interpretaba como `U` y se
   **perdía la `D'`** → el cubo no resolvía. `tokenize` (math-core) ya los parte bien.
2. **Las 5 rotaciones** (`z y x' y' y'`): el engine 3D no puede animar x/y/z; la conjugación
   las pliega en los moves. El contador del replay (61) no coincidía con la tabla (66).
   **El smartcube hace exactamente lo mismo** (rotaciones = cambios de orientación
   silenciosos que no cuentan como moves).

**Fix (opción smartcube, elegida por el usuario):**
- `tokenize` ahora también: expande grupos con multiplicador `(F D)3` → `F D F D F D`
  (108 records con este patrón), y descarta comentarios `// ...` (reconz los incrusta).
- `reconData.normalizeReconMoves` (reemplaza el split naive): tokeniza + conjuga por fase
  con grip secuencial (`conjugatePhaseStream` nuevo en math-core), conserva solo face moves
  (filtro `FACE_MOVE_RE`), y guarda `record.rotationCount` (todas las rotaciones del stream).
- Scrambles con separadores (`↓F2`) también se limpian con `tokenize` en el load.
- La tabla de Steps y el replay muestran ahora **exactamente lo mismo** (moves de cara,
  conteos conjugados), y el chip "Rotations" del header muestra el contador derivado.

**Métricas reales (chunks 0-3, 970 records 3x3 CFOP):**
| Camino | Resuelve |
|---|---|
| Antes (split naive) | **4.9%** |
| Ahora (tokenize + conjugación, web-realista) | **25.7%** |
| + búsqueda de grip en las 24 orientaciones | 39.0% |
| pipeline viejo (check literal tolerante) | 87.4% (contaba "rotación de resuelto" = cubo **no** resuelto físicamente) |

**Limitación conocida (documentada, no es bug):** el **76%** de los records CFOP tienen wide
moves (`u`, `r`, `f'`…) en la solución; su componente de slice no se puede animar en el
engine 3D (ni se conjuga). Esos records no resuelven visualmente de forma exacta — es la
causa dominante del resto de no-resueltos (junto a transcripciones imperfectas de Quest que
eliminan rotaciones). Arreglarlo = soporte de slices en el engine (fuera de alcance; se puede
revisar en Fase 2+).

**Gotchas para Fase 2 (`analyzeSolveText`):** (a) `tokenize` no expande paréntesis anidados
con multiplicador (`(F (D))2` deja un dígito suelto — filtrar con un regex de face move al
consumir); (b) `useCrossScramble.ts` tiene su propia copia local del split naive — si esa ruta
recibe notación con pegados, sufre el mismo bug; (c) el scramble se filtra con `FACE_MOVE_RE`
al cargar, igual que las fases.

---

## Fase 1 — Mejoras del PhaseSplitter: XCross y reconocimiento (sin casos)

Base: el `PhaseSplitter` actual ya emite por fase (`Cross/F2L/OLL/PLL`) con
`completionIndex`, `skipped`, `transitionMs`, y `ColorPhaseDetector` ya devuelve
`crossFace + crossColor`. Sobre eso:

### 1.1 XCross / XXCross

- **Detección:** en el índice de completación del Cross, evaluar los 4 slots F2L
  (esquina+arista en su hueco, orientadas) **en el frame del cross** que ya deriva
  `ColorPhaseDetector` (`crossFace`). Si al completarse el cross hay **1 par resuelto** →
  `XCross`; **2** → `XXCross`.
- **Atribución:** los moves del par resuelto pertenecen a la fase Cross (el cross incluyó la
  inserción). No se re-segmenta; solo se etiqueta y se informa del par.
- **Salida:** ampliar `PhaseDetectionReport` (en `packages/types/src/analysis.ts`) con:
  - `crossType: 'plain' | 'xcross' | 'xxcross'`
  - `xcrossPairs: Array<{ slot: 'FR'|'FL'|'BL'|'BR'; color: FaceLetter }>`
  - `crossColor: FaceLetter` (ya está `crossFace`; añadir el color)
  - El helper de slot-completion vive en math-core (`notation/rotationFrame.ts`, 0.3) y se
    reutiliza aquí y en Fase 2.

### 1.2 Otros reconocimientos (sin nombres de caso)

- **Color de cada par F2L:** derivado del frame del cross (el slot FR muestra el color de su
  cara derecha, etc.) → se expone por par en la Fase 2.
- **Rotaciones por fase:** ya existe `RotationCounter` en métricas; asegurar que el report
  expone las rotaciones (x/y/z) agrupadas por fase.
- **Skips:** `PhaseSplitter` ya marca `phase.skipped` cuando OLL/PLL completan en el mismo move
  que la fase anterior (OLL skip / PLL skip / OLL+PLL skip). Solo falta exponerlos de forma
  explícita en el report (`skips: ('oll'|'pll')[]`).

### 1.3 Tests de la Fase 1

- Scramble conocido donde cross+primer par se resuelven en la misma secuencia → `crossType:
  'xcross'` y el slot correcto.
- Caso cross puro → `'plain'`.
- Skips: solve sin OLL (PLL directo) → `skips: ['oll']`.
- Determinismo e invariantes del report (`complete`, `finalStateSolved`, `confidence`).

---

## Fase 2 — Nueva reconstrucción: `setup + inspection + solución` → datos

La idea central que pediste: **si la detección de fases ya funciona (smartcube), solo hay que
darle el string** — se aplica el scramble, la inspección y la solución, y el mismo pipeline
de stats produce la reconstrucción "a nuestra manera". **Sin** detección de casos (F2L nº,
OLL/PLL por nombre) — eso queda para más adelante.

### 2.1 Input (tu formato exacto)

```ts
export interface SolveTextInput {
  setup: string;        // scramble tal cual: "B' R2 D' L2 D L2 R2 U F2 U' B2 U' B' L F2 U' F' U' B R' U2"
  inspection: string;   // rotaciones: "x2 y'" — punto de partida, NO cuentan como moves
  solution: string;     // secuencia completa, con o sin "//": "R' D R // W Cross\nU L' U L ..."
  method?: MethodId;    // default 'CFOP'
  totalTimeMs?: number; // opcional → solo para calcular TPS (no hay timestamps por move)
}
```

El texto con `//` se parsea para **mostrar** los nombres de fase (`W Cross`, `F2L 1 (GO)`, …)
pero **no se confía en ellos**: las fases se detectan por estado, igual que en el smartcube.
Si falta `//` no pasa nada (solución plana). Se tolera el formato sucio de CubeRoot/Quest
(primes Unicode, `↑ ·`, pegados, wide moves) gracias al tokenizador de `moveNotation`.

### 2.2 Pipeline (nuevo módulo headless)

`packages/analysis-engine/src/reconstruction/analyzeSolveText.ts`:

1. `tokenize(setup)` → `tokenize(inspection)` → `tokenize(solution)` (moveNotation, ya en math-core).
2. **Replay:** `CubeState` = solved → aplicar scramble → aplicar inspección (rotaciones al cubo,
   registradas aparte) → aplicar cada token de solución (las rotaciones del solve se aplican y
   se registran en orden, como smartcube).
3. **Timeline sintético:** construir un `SolveTimeline` **estándar** (mismo shape que el del
   smartcube) con timestamps uniformes (o derivados de `totalTimeMs` si se pasa) para que
   `PhaseSplitter`, las métricas y el `ReplayEngine` lo consuman **sin cambios**.
4. `PhaseSplitter.splitAndAnnotate(timeline, CFOPDefinition, { colorNeutral: true })` →
   `PhaseDetectionReport` (fases, completions, skips, XCross de la Fase 1).
5. **Pares F2L:** dentro del segmento F2L, detectar las 4 completaciones de slots en el frame
   del cross (`notation/rotationFrame.ts`) → por par: `slot (FR/FL/BL/BR)`, `color`, `moves`,
   `auf` (leading-U), `premade`.
6. **OLL/PLL:** desde las fases + `skipped` + estado final (`finalStateSolved`).
7. **Salida:** `SolveTimeline` (para replay/3D) + `SolveReconstruction` (datos semánticos).

### 2.3 Output

```ts
export interface SolveReconstruction {
  method: 'CFOP';
  inspection: string;                       // "x2 y'"
  crossColor: FaceLetter;                   // p.ej. 'W' → color del cross
  cross: { moves: string[]; type: 'plain'|'xcross'|'xxcross'; xcrossPair?: SlotName };
  pairs: {                                 // 1..4, en orden de resolución
    slot: 'FR'|'FL'|'BL'|'BR';             // relativo al frame del solver
    color: FaceLetter;                     // color del par (frame del cross)
    moves: string[];                       // moves del par (sin tiempo)
    auf: string[];                         // leading-U si existe
    premade: boolean;                      // par ya formado al empezar el slot
  }[];
  rotations: { token: string; moveIndex: number }[];   // como smartcube
  oll: { moves: string[]; skipped: boolean } | null;
  pll: { moves: string[]; skipped: boolean } | null;
  finalSolved: boolean;
  warnings: PhaseDetectionWarning[];        // reusar las de PhaseSplitter
  totalTimeMs?: number; tps?: number;       // solo si totalTimeMs
}
```

- `analyzeSolveText(input): { timeline: SolveTimeline; reconstruction: SolveReconstruction }`
- Export desde `packages/analysis-engine/src/index.ts`. **Sin** dependencia de
  `algorithm-db` (se elimina la dep de la Fase 0).
- El `SolveTimeline` resultante es 100% compatible con `ReplaySection`/`ReplayEngine`/3D →
  el smartcube real **no se toca en ningún momento** (flujo `useSolveSession` intacto).

### 2.4 Tests de la Fase 2

- **Tu ejemplo exacto** (`x2 y'` + `R' D R // W Cross` + 4 F2L + OLL + PLL) →
  asserts: cross = `[R' D R]`, 4 pares con slots/colores correctos, OLL/PLL detectados,
  `finalSolved: true`.
- **Separadores CubeRoot**: `tokenize("x'↓R U2 R U'")` → `["x'", "R", "U2", "R", "U'"]`;
  `↑`, `·`, `.` y `↓` nunca deben filtrarse como moves.
- Sin marcadores `//`; rotaciones dentro de F2L; skips; primes Unicode/pegados; solución plana;
  setup incoherente → `finalSolved: false` + warning honesto (nunca inventar).
- Determinismo (misma entrada → misma salida).
- Benchmark informal: < 30 ms para una solve de 60 moves (mismo orden que el pipeline actual).

---

## Fase 3 — (opcional) UI de pegado y futuro

- **Pegado en web:** caja de texto en `ReconstructionsView` → `analyzeSolveText()` →
  render con `ReplaySection` existente (el adaptador `reconToSolve` de `reconData.ts` ya da el
  shape a `Solve`; se reemplaza por el output real en vez de JSON bakeado).
- **Futuro (solo si la base está sólida):** detección de casos con nombres (F2L nº, OLL/PLL)
  rehaciendo `signatures`/`caseIndex` limpios sobre el catálogo que sí se quedó. No antes.

---

## Orden de ejecución y validación

| Paso | Comando | Salida |
|---|---|---|
| Fase 0 | borrados + `typecheck/test` (algorithm-db, analysis-engine, math-core) + `knip` | rama = stats + catálogo, sin detección |
| Fase 1 | tests de `PhaseSplitter` + nuevo `report.crossType` | XCross/XXCross + skips + colores |
| Fase 2 | `analyzeSolveText` + tests (incl. tu ejemplo) | API headless estable |

Cada fase en su propio commit, para poder revertir por separado.

## Riesgos y notas

- **No romper smartcube:** la Fase 2 construye el `SolveTimeline` estándar; el flujo real de
  solves no se toca. La Fase 0 solo elimina código **sin consumidores** (verificado).
- **Catálogo intocable:** `seed/*`, `methodRegistry`, `caseGenerator`, `casePresentation`,
  `auf.ts`, `caseVerifier` quedan como están — la pestaña Algorithms y training siguen igual.
- **`pruebas/`:** local y gitignored; los scripts `build-recon-web-data.ts` y los crawls no
  están en git. Si quieres regenerar `public/reconstructions/`, ese script vive fuera del repo
  (o se versiona en Fase 3 al hacer la UI de pegado).
- **`moveNotation`:** si decides no rescatar nada de `recognition/`, se reescribe el tokenizer
  en Fase 2 (trabajo extra, mismo resultado).
