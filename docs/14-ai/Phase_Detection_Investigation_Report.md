# Investigación del Sistema de Reconocimiento de Fases

**Fecha:** 18 de julio de 2026
**Estado:** Investigación completada. No se ha implementado ninguna corrección.
**Archivo diagnóstico:** `packages/analysis-engine/src/__tests__/diagnostic-phase-detection.test.ts`
**Tests:** 105/105 pasando (incluyendo 7 tests diagnósticos nuevos)

---

## Resumen ejecutivo

El síntoma reportado ("Cross: 103 moves, 34.17 s" y F2L/OLL/PLL no detectados) se produce porque el `CrossMask` actual (`packages/math-core/src/methods/cfop/cfopMasks.ts`) **solo detecta la cruz en la cara D absoluta del cubo** (aristas DF, DR, DB, DL en sus posiciones exactas con `eo=0`). Esto es una definición **no color-neutral**: solo 1 de las 6 cruces posibles es reconocida. Si el usuario resuelve una cruz de cualquier otro color (y las 14 rotaciones x detectadas por el IMU sugieren fuertemente un solucionador color-neutral), la máscara no se satisface hasta que el cubo está **completamente resuelto** al final de la solve, produciendo exactamente el resultado observado.

---

## Parte 1 — Definición matemática de cada fase

### ¿Qué significa "haber terminado la Cross"?

En la comunidad del speedcubing (Speedsolving Wiki, WCA, fuentes profesionales como CubeSkills), **la cruz completada** se define como: **las 4 aristas de una cara (la cara inferior, D) correctamente posicionadas y orientadas con respecto al centro de dicha cara**. No hay restricción de color: cualquier cara del cubo es una cara de cruz válida para un solucionador color-neutral.

Consenso hallado en la investigación:

| Fuente | Definición de Cross completa |
|--------|------------------------------|
| **Speedsolving Wiki (CFOP)** | 4 aristas de la capa D orientadas y permutadas correctamente respecto al centro D |
| **Cubeast** | Detecta automáticamente el color de la cruz basándose en el estado final del cubo; soporta color-neutral |
| **CubeSkills** | "The cross is solved when the four edges are correctly placed on the bottom layer" |
| **CubeZone Cross Study** | Analiza la distribución de longitudes óptimas para cross de color fijo, opuesto, y neutral (≤8 movimientos en FTM) |
| **cubing.js (open source)** | Usa comparación de estado del cubo contra estados "goal" predefinidos |

### Definiciones para cada fase CFOP

| Fase | Definición matemática |
|------|----------------------|
| **Cross** | 4 aristas de la cara D (`{DF, DR, DB, DL}`) en sus posiciones de origen: `ep[DF]=DF ∧ ep[DR]=DR ∧ ep[DB]=DB ∧ ep[DL]=DL`, todas con `eo=0` |
| **F2L** | Cross + 4 pares esquina-arista de las dos primeras capas en sus posiciones: `ep[FR]=FR, ep[FL]=FL, ep[BR]=BR, ep[BL]=BL` y `cp[DFR]=DFR, cp[DLF]=DLF, cp[DBL]=DBL, cp[DRB]=DRB`, todos con `eo=0, co=0` |
| **OLL** | F2L + las 4 aristas de la capa U orientadas (`eo[U*]=0`) + las 4 esquinas de la capa U orientadas (`co[U*]=0`). Permutación de U no requerida |
| **PLL** | Cubo completamente resuelto (todas las piezas en sus posiciones de origen con orientación 0) |

---

## Parte 2 — Estado del arte

### ¿Cómo detectan fases otras herramientas?

| Herramienta | Mecanismo de detección | ¿Color-neutral? | ¿Determinista? |
|-------------|----------------------|-----------------|----------------|
| **Cubeast** | State-machine + comparación de facelets contra estados conocidos | **Sí** — auto-detecta el color de la cruz | Sí |
| **csTimer** | Pattern-matching basado en estado; requiere que el usuario conforme a splits predefinidos | Parcial | Sí |
| **Cube Explorer (Kociemba)** | Solver de dos fases; no detecta fases de CFOP, es un solver | N/A | Sí |
| **cubing.js** | Seguimiento de estado + comparación contra máscaras de "goal state" | Depende de la implementación | Sí |
| **kitsune-cube (GitHub)** | State-graph: parsea la secuencia, compara estado tras cada movimiento | Sí | Sí |
| **min2phase.js** | Solver; no segmenta fases — encuentra solución óptima | N/A | Sí |
| **Cubeforge (actual)** | `StateMatcher.matchesMask(state, mask)` — máscaras declarativas sobre `ep/eo/cp/co` | **NO** — solo cara D | Sí |

**Conclusión:** El enfoque de Cubeforge (máscaras declarativas + `StateMatcher`) es arquitectónicamente correcto y similar al estado del arte. El problema es que las máscaras actuales no son color-neutral ni rotation-aware.

---

## Parte 3 — Color Neutral

### Situación actual

El `CrossMask` **solo busca la cruz en la cara D absoluta**:

```typescript
// packages/math-core/src/methods/cfop/cfopMasks.ts
export const CrossMask: PhaseMask = {
  name: "Cross",
  edges: [
    { id: Edge.DF, requiredEp: Edge.DF, requiredEo: 0 },
    { id: Edge.DR, requiredEp: Edge.DR, requiredEo: 0 },
    { id: Edge.DB, requiredEp: Edge.DB, requiredEo: 0 },
    { id: Edge.DL, requiredEp: Edge.DL, requiredEo: 0 },
  ],
};
```

Esto significa: **5 de las 6 cruces color-neutral posibles son invisibles para el detector**.

### Evidencia profesional

- **Cubeast** soporta color-neutral y **auto-detecta** el color de la cruz basándose en el estado final del cubo.
- Speedcubers de élite (Max Park, Feliks Zemdegs, Yiheng Wang) son completamente color-neutral.
- Estadísticamente, un solucionador color-neutral ve la cruz óptima promediando ~4.8 movimientos vs. ~5.8 para solucionadores de un solo color (CubeZone Cross Study).
- La comunidad del speedcubing define "la cruz" como las 4 aristas de **cualquier** cara, no de un color específico.

### Diseño futuro necesario

Se requiere uno de estos enfoques:

1. **Máscaras color-neutral** — 6 máscaras de cruz (una por cara: D, U, F, B, L, R). `StateMatcher` verifica si **alguna** de las 6 está satisfecha.

2. **Rotación del estado del cubo** — Aplicar la orientación actual del cubo (`OrientationEntry.faceMap`) al estado antes de verificar la máscara. Esto permitiría mantener una sola máscara (siempre la cara D del usuario) y rotar el estado para alinearlo.

3. **Detección automática del color de cruz** — Como hace Cubeast: inspeccionar el estado final de la solve y determinar en qué cara se construyó la cruz.

---

## Parte 4 — Cross óptima

### Investigación

| Concepto | Valor/Dato |
|----------|-----------|
| **Longitud máxima de cross óptima** | **8 movimientos** (FTM — Face Turn Metric) |
| **God's Algorithm para cross** | No existe un algoritmo separado; es una búsqueda restringida al subproblema de 4 aristas |
| **Distribución para CN** | >99% de cruces resolubles en ≤6 movimientos |
| **Distribución para color fijo** | ~67% en ≤6 movimientos, máximo 8 |
| **Base de datos** | CubeZone Cross Study tiene tablas de distribución completas |
| **Herramientas de entrenamiento** | SpeedCubeDB Cross Trainer, Cubeast, varias apps móviles |

### Cálculo actual de Cross Efficiency

```typescript
// packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts
crossEfficiency = crossPhase.moveCount <= 8
  ? crossPhase.moveCount / 8
  : 8 / crossPhase.moveCount;  // ← esto da 8/103 = 0.078 en el caso del bug
```

Este cálculo asume **siempre 8 movimientos como referencia**, lo cual es una simplificación. Para un Trainer futuro, se debería:
- Calcular la cross **óptima real para el scramble específico** usando un solver restringido
- `crossEfficiency = optimalCrossMoves / userCrossMoves`
- También mostrar las soluciones óptimas como referencia para el usuario

---

## Parte 5 — Auditoría del algoritmo actual

### Flujo completo del pipeline

```
Smart Cube (BLE) → CubeMoveEvent[] → TimelineBuilder.build()
  ├─ state.applySequence(scramble)     // estado inicial = scramble
  ├─ Por cada move:                     // aplicar raw move to CubeState
  │  └─ state.applySequence(notation)  
  │  └─ snapshot = toSnapshot(state)    // guardar cp, co, ep, eo
  └─ entries: TimelineEntry[]           // (move, snapshot, timestamp)

PhaseSplitter.split(timeline, CFOPDefinition)
  ├─ Por cada entry:
  │  ├─ state = TimelineBuilder.fromSnapshot(entry.state)
  │  ├─ StateMatcher.matchesMask(state, CrossMask)   // ← ¿cruz D completa?
  │  ├─ Si true → crear PhaseSegment, avanzar a F2L
  │  ├─ StateMatcher.matchesMask(state, F2LMask)
  │  ├─ Si true → crear PhaseSegment, avanzar a OLL
  │  └─ ... (OLL, PLL)
  └─ phases: PhaseSegment[]

MetricsAggregator.computeAll(timeline, scramble)
  ├─ PauseDetector, TPSCalculator, FluidityCalculator, ...
  ├─ CFOPMetricsCalculator.compute(timeline)  → crossEfficiency, ollTPS, ...
  └─ SolveMetrics
```

### La condición que falla

El `CrossMask` verifica **4 condiciones específicas**:

```
ep[Edge.DF] == Edge.DF ∧ eo[Edge.DF] == 0
ep[Edge.DR] == Edge.DR ∧ eo[Edge.DR] == 0
ep[Edge.DB] == Edge.DB ∧ eo[Edge.DB] == 0
ep[Edge.DL] == Edge.DL ∧ eo[Edge.DL] == 0
```

En el `StateMatcher.matchesMask`:

```typescript
if (state.ep[rule.requiredEp] !== rule.id) return false;
if (rule.requiredEo !== undefined && state.eo[rule.requiredEp] !== rule.requiredEo) return false;
```

**Lo que inspecciona:** Las posiciones fijas DF, DR, DB, DL del array `ep/eo` (12 posiciones fijas correspondientes a las aristas del cubo en su marco de referencia de centros).

**Lo que NO inspecciona:** Las otras 5 caras (U, F, B, L, R), ni condiciones relativas ("4 aristas en la misma cara, orientadas").

---

## Parte 6 — Explicación del caso actual

### ¿Por qué Cross termina al final de la solve?

**Demostración matemática (reproducida en `diagnostic-phase-detection.test.ts`, Scenario 1):**

Para un scramble WCA de 23 movimientos con solve inversa, el detector registra:

```
Move  1: Cross:✗ F2L:✗ OLL:✗ PLL:✗ Solved:✗
Move  2: Cross:✗ F2L:✗ OLL:✗ PLL:✗ Solved:✗
...
Move 22: Cross:✗ F2L:✗ OLL:✗ PLL:✗ Solved:✗
Move 23: Cross:✓ F2L:✓ OLL:✓ PLL:✓ Solved:✓
```

**Resultado del PhaseSplitter:** 1 sola fase detectada: `Cross: moves 1-23 (23 moves)`

Las 4 máscaras (Cross, F2L, OLL, PLL) solo se satisfacen **simultáneamente** en el movimiento final. Esto ocurre porque:
- El `CrossMask` requiere la cruz en la cara D absoluta
- La solve (inversa del scramble) **no sigue la estructura CFOP** — construye la cruz en la cara D solo al final, cuando el cubo alcanza el estado resuelto
- Las 4 máscaras son subconjuntos progresivos del estado resuelto: Cross ⊂ F2L ⊂ OLL ⊂ PLL = Solved

**En el caso real del usuario (103 movimientos con 14 rotaciones x):**

La causa más probable es **Color Neutral**:
- El usuario construye una cruz de un color NO correspondiente a la cara D absoluta del cubo
- En el marco de referencia fijo (raw), esa cruz está en otra cara (probablemente U o F, dado el alto número de rotaciones x)
- El `CrossMask` (que solo mira la cara D) nunca se satisface
- Solo al final de la solve, cuando TODO el cubo está resuelto, la cara D también lo está → la máscara coincide

**Qué condición nunca se cumple:** `ep[Edge.DF]=Edge.DF ∧ ep[Edge.DR]=Edge.DR ∧ ep[Edge.DB]=Edge.DB ∧ ep[Edge.DL]=Edge.DL` — la cruz blanca/amarilla en la cara D absoluta.

**Qué estado nunca cambia:** Las 4 aristas de la cara D NO alcanzan sus posiciones de origen hasta el estado resuelto final.

**Qué evento nunca se produce:** La transición Cross → F2L, porque el `CrossMask` nunca se satisface en un punto intermedio de la solve.

**Qué transición no ocurre:** `PhaseSplitter` nunca avanza de `currentPhaseIdx=0` (Cross) a `currentPhaseIdx=1` (F2L).

### ¿Por qué el `CrossMask` solo se satisface al final?

La respuesta está en el **Scenario 3 del diagnóstico**: el `CrossMask` no es color-neutral. Demostramos que un estado del cubo con una cruz perfectamente construida en la cara U (todas las 4 aristas D-color en posiciones U, orientadas) **no satisface** el `CrossMask`:

```
D-face cross status: DF=UF(0) DR=UR(0) DB=UB(0) DL=UL(0)
U-face cross status: UF=DF(0) UR=DR(0) UB=DB(0) UL=DL(0)
CrossMask (D-face) satisfied? FALSE
```

---

## Parte 7 — Arquitectura Multi-Method

### Evaluación de la arquitectura actual

La arquitectura **SÍ es Multi-Method en su diseño conceptual**, pero tiene limitaciones en la implementación.

**Lo que funciona bien:**
- `MethodDefinition` + `PhaseMask[]` es genérico: CFOP, Roux, ZZ y Petrus tienen sus propias definiciones
- `PhaseSplitter.split()` es method-agnostic — solo depende de `StateMatcher.matchesMask(state, mask)`
- `MetricsAggregator.computeAll()` despacha a calculadoras específicas (`CFOPMetricsCalculator`, `RouxMetricsCalculator`) según el método
- `StateMatcher.matchesMask()` evalúa cualquier `PhaseMask` de forma declarativa

**Lo que no funciona:**

| Problema | Impacto |
|----------|---------|
| Las máscaras son **absolutas** (requieren posiciones exactas `requiredEp`/`requiredCp`) | No soportan cruces relativas ni color-neutral |
| Las máscaras están en el **marco de referencia fijo** (raw), no en el del usuario (display) | Rotaciones del cubo rompen la detección |
| `PhaseSplitter` es **greedy**: avanza al primer match | Si un match ocurre por accidente y luego se rompe, la fase queda mal segmentada |
| Roux RouxFullDefinition tiene 6 fases, pero RouxDefinition (simple) solo tiene 2 | Inconsistencia en granularidad |
| ZZ usa solo 3 fases (EOLine, F2L, LL) — no distingue OCLL vs PLL en la última capa | Métricas de LL poco detalladas |
| Petrus tiene 4 fases (2x2x2, 2x2x3, EO, F2L+LL) — correcto pero también absoluto | Mismo problema que CFOP |

**Verificación de que cada método puede definirse solo con fases + detectores + reglas + métricas:**

| Componente | Genérico | Específico por método |
|-----------|----------|----------------------|
| Definición de fases | `PhaseMask[]` en `MethodDefinition` | `cfopMasks.ts`, `rouxMasks.ts`, etc. |
| Detector | `StateMatcher.matchesMask()` | — (genérico) |
| Splitter | `PhaseSplitter.split()` | — (genérico) |
| Métricas | — | `CFOPMetricsCalculator`, `RouxMetricsCalculator` |
| Timeline | `TimelineBuilder.build()` | — (genérico) |

**Conclusión:** La separación de responsabilidades es correcta. El problema no es arquitectónico sino de la **definición de las máscaras** (son absolutas, no color-neutral, y están en el marco fijo).

---

## Parte 8 — Relación con el Trainer y funcionalidades futuras

### Capacidades necesarias y su estado actual

| Funcionalidad futura | Datos necesarios | ¿Ya en el pipeline? |
|---------------------|-----------------|---------------------|
| **Replay por fases** | `phaseId`/`phaseName` en cada `TimelineEntry` | ✅ Sí |
| **Tiempo por fase** | `PhaseSegment.durationMs` | ✅ Sí |
| **TPS por fase** | `PhaseMetrics.tps` | ✅ Sí |
| **Rotaciones por fase** | `RotationMetrics.byPhase` | ✅ Sí |
| **Pausas por fase** | `PauseMetrics.byPhase` | ✅ Sí |
| **Reconocimiento OLL/PLL** | `ollAlgorithmId`/`pllAlgorithmId` | ❌ Campos vacíos (TODO) |
| **Comparación con cross óptima** | Solución óptima de cross para el scramble | ❌ No implementado (usa constante 8) |
| **Comparación con F2L óptimo** | Solución óptima de F2L para el scramble | ❌ No implementado |
| **Cross training** | Múltiples soluciones óptimas de cross + visualización | ❌ No implementado |
| **AI Coach** | Historial de solves, patrones, debilidades por fase | ⚠️ Datos crudos disponibles, falta análisis |
| **Detección de algoritmo** | Secuencia de movimientos normalizada + base de datos de algoritmos | ❌ No implementado |

### Lo que el pipeline DEBE conservar desde ahora

- `CubeStateSnapshot` completo en cada entrada de la timeline — **ya se hace** ✅
- Orientación (`CubeOrientation`) en cada entrada — **ya se hace** ✅
- `hostTimestamp` y `cubeTimestamp` — **ya se hace** ✅
- `displayMove` (move remapeado a la perspectiva del usuario) — **ya se hace** ✅
- Scramble original — **ya se pasa** ✅

---

## Parte 9 — Métricas futuras por fase

### Métricas profesionales investigadas

Basado en Cubeast, CubeSkills, y la literatura del speedcubing:

**Cross:**
| Métrica | Definición | Actual |
|---------|-----------|--------|
| Tiempo | `durationMs` del PhaseSegment | ✅ |
| TPS | `moveCount / (durationMs/1000)` | ✅ |
| Movimientos | `moveCount` | ✅ |
| Eficiencia | `optimalMoves / userMoves` | ⚠️ Usa constante 8 |
| Cross óptima | Movimientos de la cross óptima para este scramble | ❌ |
| Soluciones alternativas | Múltiples cruces ≤ óptima+2 | ❌ |
| Regrips | Rotaciones durante la cross | ✅ (RotationCounter) |
| Pausas | Pausas durante la cross | ✅ |

**F2L:**
| Métrica | Definición | Actual |
|---------|-----------|--------|
| Tiempo total | `durationMs` | ✅ |
| TPS | `moveCount / time` | ✅ |
| Pares individuales | Tiempo, TPS, pausas por par | ⚠️ Heurístico (divide en 4) |
| Eficiencia | `optimalF2L / userF2L` | ❌ |
| Lookahead score | Varianza entre tiempos de pares | ✅ (basado en CV) |
| Rotaciones | Rotaciones durante F2L | ✅ |

**OLL:**
| Métrica | Definición | Actual |
|---------|-----------|--------|
| Recognition time | Gap entre último move de F2L y primer move de OLL | ✅ |
| Execution time | `durationMs - recognition` | ✅ |
| TPS | `moveCount / executionTime` | ✅ |
| Algoritmo usado | ID del algoritmo OLL reconocido | ❌ |
| Eficiencia del algoritmo | Comparación con algoritmo óptimo para ese caso | ❌ |
| AUF (Adjust U Face) | Movimientos U antes/después del algoritmo | ❌ |

**PLL:**
| Métrica | Definición | Actual |
|---------|-----------|--------|
| Recognition time | Gap entre último move de OLL y primer move de PLL | ✅ |
| Execution time | `durationMs - recognition` | ✅ |
| TPS | `moveCount / executionTime` | ✅ |
| Algoritmo usado | ID del algoritmo PLL reconocido | ❌ |
| Eficiencia | Comparación con óptimo | ❌ |
| AUF | Movimientos U de ajuste | ❌ |

---

## Parte 10 — Validación matemática

### Resultados del diagnóstico controlado

Se ejecutaron **7 escenarios** en `diagnostic-phase-detection.test.ts` (todos pasando):

**Scenario 1 — Scramble WCA realista (23 moves):**
- Cross/F2L/OLL/PLL: todos `✗` hasta el movimiento 23/23, donde todos pasan a `✓`
- PhaseSplitter detecta **1 fase**: Cross (moves 1-23, 100%)
- **BUG REPRODUCIDO:** `crossRatio = 1.0`

**Scenario 2 — D-misaligned cross:**
- Estado resuelto + `D` → `CrossMask = false`
- Las 4 aristas D están en la cara D pero permutadas

**Scenario 3 — Color Neutral cross en cara U:**
- `F2 R2 L2 B2` mueve las 4 aristas de la cruz D a la cara U (verificado matemáticamente contra las tablas de movimientos de `CubeState.ts`)
- `CrossMask` = **false** (la cruz en U es invisible)
- U-face cross status: `UF=DF(0) UR=DR(0) UB=DB(0) UL=DL(0)` ← cruz perfecta, no detectada

**Scenario 4 — 6 cruces posibles:**
- Solo 1 de 6 (la cara D) es detectada por `CrossMask`
- 5 de 6 cruces color-neutral son invisibles

**Scenario 5 — Sanity check:**
- Cubo resuelto: las 4 máscaras se satisfacen simultáneamente ✓

**Scenario 6 — Scramble de 4 movimientos:**
- Cross: move 1 (1 movimiento), F2L: moves 2-4
- Solo 2 fases detectadas de 4 esperadas
- Para scrambles cortos, la estructura CFOP del solve inverso es insuficiente

**Scenario 7 — Scramble que preserva D-cross (solo U moves):**
- Las 4 fases se detectan correctamente: Cross(1), F2L(1), OLL(1), PLL(2)
- Esto confirma que **el detector SÍ funciona** cuando el usuario sigue la convención de cruz en D

---

## Recomendaciones para la corrección

*Nota: estas son recomendaciones de arquitectura, no implementaciones. El usuario ha solicitado explícitamente no implementar correcciones todavía.*

### 1. Máscaras color-neutral (prioridad crítica)

Crear `CrossMask` para cada una de las 6 caras, o un mecanismo de "rotación de estado" que alinee la orientación del usuario con el marco de referencia fijo:

```typescript
// Opción A: 6 máscaras (simple, explícito)
const COLOR_NEUTRAL_CROSS_MASKS = [CrossMask_D, CrossMask_U, CrossMask_F, ...];

// Opción B: rotación del estado (elegante, compatible con IMU)
function matchesColorNeutralCross(state: CubeState, orientation: OrientationEntry): boolean {
  // Rotar el estado según la orientación actual
  const rotatedState = applyOrientation(state, orientation);
  return StateMatcher.matchesMask(rotatedState, CrossMask);
}
```

### 2. Aplicar rotaciones al CubeState (prioridad alta)

El `CubeState` actual no modela rotaciones de cubo completo (x, y, z). Para soportar la detección en el marco del usuario, se necesita:
- Método `CubeState.applyRotation(axis, direction)` que permute las piezas según una rotación de cubo completo
- O alternativamente, aplicar `faceMap` inverso durante `PhaseSplitter.split()`

### 3. PhaseSplitter no-greedy (prioridad media)

El algoritmo actual avanza irreversiblemente al primer match. Un enfoque más robusto:
- Registrar CANDIDATOS a transición de fase (no avanzar inmediatamente)
- Al final, seleccionar la secuencia de transiciones que maximice la segmentación correcta
- O usar el estado final (cubo resuelto) para validar la segmentación

### 4. Métricas por fase con solver (prioridad media)

- `optimalCrossMoves`: resolver solo la cross para el scramble dado
- `optimalF2LMoves`: resolver F2L para el scramble dado
- Comparar con los movimientos del usuario para calcular eficiencia real

### 5. Reconocimiento de algoritmos (prioridad baja, futuro)

- Base de datos de algoritmos OLL (57 casos) y PLL (21 casos)
- Normalizar la secuencia de movimientos (cancelar AUF, eliminar rotaciones)
- Hash lookup contra la base de datos

---

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `packages/math-core/src/methods/cfop/cfopMasks.ts` | Definición de `CrossMask`, `F2LMask`, `OLLMask`, `PLLMask` (absolutas, no color-neutral) |
| `packages/math-core/src/methods/StateMatcher.ts` | `matchesMask(state, mask)` — verifica `ep/eo/cp/co` contra `PhaseMask` |
| `packages/math-core/src/methods/IMethodDefinition.ts` | Interfaces `PhaseMask`, `EdgeRule`, `CornerRule`, `MethodDefinition` |
| `packages/analysis-engine/src/phases/PhaseSplitter.ts` | Algoritmo greedy de segmentación de fases |
| `packages/analysis-engine/src/timeline/TimelineBuilder.ts` | Construye `SolveTimeline` aplicando scramble + raw moves |
| `packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts` | Métricas CFOP (crossEfficiency, ollRecognition, etc.) |
| `packages/analysis-engine/src/metrics/MetricsAggregator.ts` | Orquestador de todas las calculadoras de métricas |
| `apps/web/src/hooks/useSolveSession.ts` | Flujo completo: BLE moves → análisis → métricas |
| `packages/analysis-engine/src/__tests__/diagnostic-phase-detection.test.ts` | **Test diagnóstico** que reproduce el bug (7 escenarios) |
| `packages/math-core/src/methods/StateMatcher.test.ts` | Tests existentes que confirman el comportamiento absoluto |
| `docs/02-architecture/Dynamic_Notation_Orientation_System.md` | Documentación del sistema de notación dinámica |
| `docs/00-product/PRD.md` | Documento de requisitos de producto |

---

*Informe generado tras investigación exhaustiva del sistema de reconocimiento de fases de Cubeforge. No se han realizado modificaciones al código de producción. El archivo `diagnostic-phase-detection.test.ts` contiene las pruebas controladas que demuestran matemáticamente el fallo.*
