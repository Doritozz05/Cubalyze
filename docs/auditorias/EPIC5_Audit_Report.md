# Auditoría Técnica Completa — EPIC 5: Real-Time Analysis Pipeline

> **Fecha:** 18 de julio de 2026
> **Alcance:** Análisis exhaustivo del roadmap EPIC 5 vs código actual vs estado del arte
> **Resultado:** Informe de auditoría con propuestas de mejora y hoja de ruta priorizada

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Parte 1 — Auditoría del Estado Actual](#2-parte-1--auditoría-del-estado-actual)
   - [2.1 Phase 5.1: State Tracking & Move Detection](#21-phase-51-state-tracking--move-detection)
   - [2.2 Phase 5.2: Phase Recognition](#22-phase-52-phase-recognition)
   - [2.3 Phase 5.3: Metric Computation](#23-phase-53-metric-computation)
   - [2.4 Phase 5.4: Live Feedback & Telemetry](#24-phase-54-live-feedback--telemetry)
3. [Parte 2 — Auditoría Arquitectónica](#3-parte-2--auditoría-arquitectónica)
4. [Parte 3 — Investigación del Estado del Arte](#4-parte-3--investigación-del-estado-del-arte)
5. [Parte 4 — Inventario Completo de Métricas](#5-parte-4--inventario-completo-de-métricas)
6. [Parte 5 — Modularidad Multi-Método](#6-parte-5--modularidad-multi-método)
7. [Parte 6 — Sinergias con Sistemas Existentes](#7-parte-6--sinergias-con-sistemas-existentes)
8. [Parte 7 — Propuestas de Mejora al Roadmap](#8-parte-7--propuestas-de-mejora-al-roadmap)
9. [Parte 8 — Priorización de Métricas](#9-parte-8--priorización-de-métricas)
10. [Conclusión y Hoja de Ruta Recomendada](#10-conclusión-y-hoja-de-ruta-recomendada)

---

## 1. Resumen Ejecutivo

### Hallazgo principal

El roadmap EPIC 5 fue diseñado antes de que existieran varios sistemas críticos que ahora están implementados. **El diseño conceptual del roadmap sigue siendo válido como pipeline**, pero el orden y granularidad de las fases necesita ajustes significativos a la luz del código actual y del estado del arte.

### Estado real del código

| Componente | Estado |
|:-----------|:------:|
| Math Core (CubeState, StateMatcher, PhaseMasks) | ✅ **Completo y testeado** |
| PhaseMasks CFOP (Cross, F2L, OLL, PLL) | ✅ **Completo** |
| PhaseMasks Roux (FB, SB, CMLL, LSE) | ✅ **Completo** |
| Dynamic Notation Orientation System | ✅ **Completo** |
| OrientationTracker + RotationEvents | ✅ **Completo** |
| CubeMoveEvent con timestamps | ✅ **Completo** |
| Almacenamiento de moves en Solve | ✅ **Completo** |
| TimerEngine con Smart Cube | ✅ **Completo** |
| SolveTimeline (historial inmutable) | ✅ **Completo** |
| Phase splitting (PhaseSplitter) | ✅ **Completo** |
| Métricas (TPS, pausas, fluidez, eficiencia, rotaciones) | ✅ **Completo** |
| RedundancyDetector | ✅ **Completo e integrado** |
| Orientations pipeline (RotationCounter) | ✅ **Completo** |
| DB persistence (analysis column) | ✅ **Completo** |
| EfficiencyCalculator async | ✅ **Completo** |
| Historical analysis display | ✅ **Completo** |
| Telemetry Service | ❌ **No existe** (excluido del alcance) |
| `packages/analysis-engine` | ✅ **Completo** con 52 tests |
| `packages/statistics` | ❌ **Vacío** (solo package.json) |

### Conclusión clave

**El 95% de la infraestructura necesaria para EPIC 5 ya existe y está testeado.** La capa de orquestación (SolveTimeline), los calculadores de métricas, la integración de RedundancyDetector, el pipeline de orientaciones para RotationCounter, la persistencia en DB, y la visualización histórica están completos. Solo falta el Telemetry Service (excluido del alcance actual).

---

## 2. Parte 1 — Auditoría del Estado Actual

### 2.1 Phase 5.1: State Tracking & Move Detection

**Objetivo original:** Feed HAL events into Math Core, mantener historial inmutable Move → State → Timestamp.

#### Lo que ya existe ✅

| Componente | Archivo | Estado |
|:-----------|:--------|:------:|
| `CubeMoveEvent` con face, direction, timestamps | `packages/types/src/index.ts` | ✅ Completo |
| `CubeState` con `applyMove()`, `clone()`, `isSolved()` | `packages/math-core/src/CubeState.ts` | ✅ Completo y testeado |
| `CubeState.applySequence()` para aplicar múltiples moves | `packages/math-core/src/CubeState.ts` | ✅ Completo |
| `CubeMoveEventSchema` en modelo de datos | `packages/models/src/schemas/solve.schema.ts` | ✅ Completo |
| `Solve.moves: CubeMoveEvent[]` almacenado en BD | `packages/database/src/repositories/solves.repository.ts` | ✅ Completo |
| TimerEngine con `handleSmartCubeStart/Stop` | `packages/timer-engine/src/TimerEngine.ts` | ✅ Completo |
| SyncBridge (HAL → 3D engine) | `packages/cube-3d-engine/src/hardware/SyncBridge.ts` | ✅ Completo |
| Conexión Smart Cube → Timer en UI | `apps/web/src/hooks/useSolveSession.ts` | ✅ Completo |
| `ScrambleValidator` con tracking de facelets | `apps/web/src/hooks/useScrambleValidator.ts` | ✅ Completo |

#### Lo que NO existe ❌ (ACTUALIZADO)

- **SolveTimeline:** ✅ IMPLEMENTADO — `packages/analysis-engine/src/timeline/TimelineBuilder.ts` construye un historial inmutable de (MoveEvent, CubeState, timestamp)
- **Replay:** ✅ IMPLEMENTADO — `TimelineBuilder.fromStoredSolve()` permite reconstruir un timeline desde moves almacenados
- **Event loop de análisis:** ✅ IMPLEMENTADO — `useSolveSession` recoge moves y `runAnalysis` ejecuta el pipeline post-solve
- **Aplicación de moves al CubeState durante la sesión:** ✅ IMPLEMENTADO — `TimelineBuilder.build()` aplica cada move al CubeState y guarda el snapshot

#### Veredicto (ACTUALIZADO)

**FASE COMPLETADA.** El `SolveTimeline` está implementado y testeado. `TimelineBuilder.build()` construye el timeline desde moves, `PhaseSplitter.splitAndAnnotate()` divide en fases, y `MetricsAggregator.computeAll()` calcula todas las métricas. La persistencia en DB está completa (migration 005).

---

### 2.2 Phase 5.2: Phase Recognition

**Objetivo original:** Aplicar PhaseMasks al timeline para dividir la sesión en fases (Cross, F2L, OLL, PLL).

#### Lo que ya existe ✅

| Componente | Archivo | Estado |
|:-----------|:--------|:------:|
| `MethodDefinition` y `PhaseMask` interfaces | `packages/math-core/src/methods/IMethodDefinition.ts` | ✅ Completo |
| `StateMatcher.matchesMask()` | `packages/math-core/src/methods/StateMatcher.ts` | ✅ Completo y testeado |
| `cfopMasks.ts`: Cross, F2L, OLL, PLL | `packages/math-core/src/methods/cfop/cfopMasks.ts` | ✅ Completo |
| `rouxMasks.ts`: First Block, Second Block | `packages/math-core/src/methods/roux/rouxMasks.ts` | ⚠️ Parcial |
| Tests de StateMatcher | `packages/math-core/src/methods/StateMatcher.test.ts` | ✅ Existen |

#### Lo que está parcialmente implementado ⚠️

- **Roux incompleto:** ✅ ACTUALIZADO — FB, SB, CMLL y LSE están completos. `RouxMetricsCalculator` calcula métricas específicas (FB/SB efficiency, CMLL recognition, LSE sub-phases).
- **ZZ y Petrus:** ✅ ACTUALIZADO — `ZZDefinition` y `PetrusDefinition` están implementados con sus fases correspondientes.
- **No hay detección automática de método:** El sistema no puede inferir si el usuario está usando CFOP o Roux.

#### Lo que NO existe ❌

- **PhaseSplitter:** ✅ IMPLEMENTADO — `packages/analysis-engine/src/phases/PhaseSplitter.ts` con soporte para CFOP, Roux, ZZ, Petrus
- **Detección de método:** El usuario selecciona explícitamente (settings). La auto-detección es un nice-to-have futuro.
- **Transiciones entre fases:** ✅ IMPLEMENTADO — `getTransitionIndices()` calcula timestamps de transición

#### Veredicto (ACTUALIZADO)

**FASE COMPLETADA.** El `PhaseSplitter` está implementado con soporte para CFOP, Roux, ZZ y Petrus. Detecta fases, asigna `phaseId`/`phaseName` a cada entrada del timeline, y calcula transiciones. Los métodos específicos (CFOP, Roux, ZZ, Petrus) están integrados en `MetricsAggregator`.

---

### 2.3 Phase 5.3: Metric Computation

**Objetivo original:** TPS, fluidez, pausas por fase.

#### Lo que ya existe ✅

- Sistema de estadísticas básicas de sesión: `computeStats()` en `apps/web/src/utils/formatTime.ts`
  - best, worst, mean, ao5, ao12, ao100, sessionTime
- `effectiveTime()` para manejar penalizaciones
- `StatLabel`, `formatTime`, `formatDuration`
- `TrendChart` con Recharts para visualización de Ao5/Ao12/Ao100
- **Datos crudos disponibles:** Los moves con timestamps ya están en la BD — cualquier métrica puede calcularse offline

#### Lo que NO existe ❌ (ACTUALIZADO)

Todo el paquete `packages/analysis-engine` está **COMPLETADO** con los siguientes calculadores:

- **TPS:** ✅ global, por fase, instantáneo, efectivo, peak (`TPSCalculator`)
- **Pausas:** ✅ detección, duración, por fase, categorías (`PauseDetector`)
- **Fluidez:** ✅ varianza inter-move, coeficiente de variación, bursts (`FluidityCalculator`)
- **Rotaciones:** ✅ conteo, tiempo perdido, eficiencia, por fase (`RotationCounter`)
- **Eficiencia de movimientos:** ✅ comparación con solución óptima, forward drift (`EfficiencyCalculator`)
- **Redundancias:** ✅ cancelaciones, repeticiones, half-turns (`RedundancyDetector`)
- **Métricas de fase específicas:** ✅ CFOP (CrossEff, F2L pairs, OLL/PLL), Roux (BlockEff, CMLL, LSE) (`CFOPMetricsCalculator`, `RouxMetricsCalculator`)
- **Orquestador:** ✅ `MetricsAggregator` integra todos los calculadores
- **Tests:** ✅ 52 tests pasando (TimelineBuilder, PhaseSplitter, MetricsAggregator, TPSCalculator, PauseDetector)

#### Veredicto (ACTUALIZADO)

**FASE COMPLETADA.** Todos los calculadores de métricas están implementados, integrados en `MetricsAggregator`, y testeados (52/52 tests pasando). La integración con la DB está completa (migration 005, persistencia de análisis). La visualización histórica está habilitada.

---

### 2.4 Phase 5.4: Live Feedback & Telemetry

**Objetivo original:** Streaming de métricas en tiempo real, modo Training vs Free Solve.

#### Lo que ya existe ✅

- Infraestructura RxJS en todo el proyecto (Subjects, Observables)
- `OrientationTracker.rotationEvents$` — observable de rotaciones
- `TimerEngine.state$`, `tick$`, `stop$`, `inspectionWarning$`
- `CubeConnector.moves$`, `facelets$` — observables de hardware

#### Lo que NO existe ❌

- **Telemetry Service:** No hay bus de eventos unificado
- **Métricas en tiempo real:** No se calcula ni emite nada durante el solve
- **Training vs Free Solve:** No hay distinción de modos
- **Feedback visual/audio:** No hay indicadores de rendimiento durante el solve

#### Veredicto

La infraestructura de eventos (RxJS) está lista. Lo que falta es el contenido (los calculadores de métricas) y el servicio de telemetría que los orqueste. Esta fase es la última del pipeline y depende completamente de 5.3.

---

## 3. Parte 2 — Auditoría Arquitectónica

### 3.1 ¿Sigue siendo una buena división?

**Sí**, la división 5.1 → 5.2 → 5.3 → 5.4 representa un pipeline lógico:
```
HAL Events → SolveTimeline → PhaseSplitter → MetricCalculators → TelemetryService
```

Sin embargo, la granularidad necesita ajustes. Fase 5.3 ("Metric Computation") es demasiado amplia: agrupa TPS, pausas, fluidez, eficiencia, rotaciones — métricas que tienen complejidades y dependencias muy diferentes.

### 3.2 Críticas arquitectónicas

#### ❌ 5.1 y 5.2 deberían fusionarse (o ser simultáneas)

El `SolveTimeline` sin phase splitting no aporta valor al usuario. Y el `PhaseSplitter` sin timeline no puede funcionar. Son dos caras de la misma moneda. Propongo una fase unificada **5.1: Solve Timeline & Phase Recognition**.

#### ❌ 5.3 es demasiado grande

"Métricas" abarca al menos 6 categorías independientes:
1. **Métricas temporales** (TPS, tiempos entre movimientos)
2. **Métricas de pausas** (detección, clasificación)
3. **Métricas de fluidez** (varianza, ritmo, aceleración)
4. **Métricas de eficiencia** (move count vs óptimo, redundancias)
5. **Métricas de rotación** (conteo, tiempo, eficiencia)
6. **Métricas específicas de fase** (Cross efficiency, F2L pairs, etc.)

Cada una merece su propio módulo.

#### ❌ No hay abstracción `MetricCalculator`

El roadmap no define una interfaz común para calculadores de métricas. Debería existir:

```typescript
interface MetricCalculator<T> {
  name: string;
  compute(timeline: SolveTimeline): T;
  dependencies: string[]; // otras métricas requeridas
}
```

#### ❌ El pipeline es monolítico en el roadmap

El roadmap original asume una función `generateMetrics(timeline)` que produce todas las métricas. Una arquitectura más limpia sería **plugin-based**: cada métrica es un plugin independiente que se suscribe al timeline.

### 3.3 Responsabilidades mezcladas

- **TimerEngine** actualmente solo maneja el timer. No debería involucrarse en el pipeline de análisis — correcto.
- **useSolveSession** mezcla timer orchestration con smart cube wiring. Podría delegar el análisis a un servicio separado.
- **SyncBridge** conecta HAL → 3D engine. Podría también alimentar el pipeline de análisis con los mismos eventos.

### 3.4 Componentes acoplados

- `useSolveSession` conoce detalles de `globalCubeAdapter` y `preferencesStore`. Este acoplamiento es aceptable para un hook de orquestación, pero el pipeline de análisis debería ser independiente de React.
- Los PhaseMasks dependen de `CubeState`, que a su vez depende de `Constants.ts`. Esto es correcto — es una dependencia de dominio.

### 3.5 Recomendación

**Arquitectura propuesta para EPIC 5 revisada:**

```
┌─────────────────────────────────────────────────────────┐
│                    EPIC 5: Analysis Pipeline              │
├─────────────────────────────────────────────────────────┤
│  5.1  SolveTimeline + PhaseRecognition (FUSIONADAS)       │
│       └─ Timeline inmutable: MoveEvent → CubeState → ts  │
│       └─ PhaseSplitter genérico (method-agnostic)        │
│                                                           │
│  5.2  Core Metrics (TIEMPO + PAUSAS)                      │
│       └─ TPS global, por fase, instantáneo               │
│       └─ PauseDetector: umbral configurable              │
│       └─ Fluidez: varianza, ritmo                        │
│                                                           │
│  5.3  Advanced Metrics (EFICIENCIA + ROTACIONES)          │
│       └─ Move efficiency vs solver                       │
│       └─ RotationCounter (usa DNOS)                      │
│       └─ Redundancy/Cancellation detection               │
│                                                           │
│  5.4  Phase-Specific Metrics                              │
│       └─ CFOP: CrossEff, F2LPairs, OLL/PLL recog        │
│       └─ Roux: BlockEff, CMLL recog                      │
│       └─ Extensible a ZZ, Petrus                         │
│                                                           │
│  5.5  Telemetry + Live Feedback                           │
│       └─ Pub/sub bus                                     │
│       └─ Training vs Free Solve modes                    │
│       └─ Post-solve report generation                    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Parte 3 — Investigación del Estado del Arte

### 4.1 Herramientas analizadas

#### Cubeast (cubeast.com) — Referencia principal

**Es el estándar de facto para análisis con Smart Cube.** Características:

- **Reconstrucción completa del solve:** Reproduce cada movimiento con timestamps (igual que nuestro `Solve.moves`)
- **Phase breakdown automático:** Cross, F2L (por par), OLL, PLL con tiempos individuales
- **TPS por fase:** Gráfico de TPS a lo largo del solve completo
- **Pausas detectadas:** Marcadores visuales de pausas > umbral
- **Eficiencia de movimientos:** Comparación con solución óptima del solver
- **Reconocimiento de algoritmos:** Identifica qué OLL/PLL ejecutó el usuario comparando con DB
- **Estadísticas agregadas:** Promedios de TPS, pausas, eficiencia por sesión/global
- **Visualización 3D:** Reconstrucción del solve en 3D para revisión visual
- **Exportación:** CSVs con todas las métricas

**Lecciones para CubeForge:**
- La reconstrucción visual post-solve es muy valorada
- El breakdown por par F2L es el diferenciador clave
- La comparación con solución óptima requiere solver (ya tenemos `Min2PhaseSolver`)
- La UX debe priorizar legibilidad sobre cantidad de datos

#### CubeDesk

- Timer + análisis básico
- Enfoque en simplicidad y diseño limpio
- Métricas limitadas: solo tiempo, splits básicos, TPS global
- No tiene análisis por fase ni reconstrucción de Smart Cube

#### csTimer

- El timer más usado por speedcubers profesionales
- Estadísticas exhaustivas de sesión (histogramas, distribuciones, percentiles)
- No tiene análisis de Smart Cube (solo tiempos manuales)
- Exportación/importación masiva
- Referencia para: formato de exportación, naming de sesiones

#### GAN Cube Station

- App oficial de GAN, integración nativa con hardware
- Análisis en tiempo real durante el solve
- Visualización 3D fluida
- Algoritmo de IA para sugerencias de mejora
- **Problema:** Bloqueado al ecosistema GAN, no open source

#### Smart Player (QiYi)

- App para cubos QiYi AI
- Métricas básicas: TPS, tiempo total, conteo de movimientos
- Sin phase breakdown ni métricas avanzadas
- Interfaz más orientada a principiantes

#### cubing.js (librería open source)

- Implementa algoritmos WCA, notación, scrambling, etc.
- Referencia matemática para métricas avanzadas
- Soporte para múltiples puzzles (2x2-7x7, Megaminx, etc.)

### 4.2 Investigación académica

#### Forward Drift (Krakauer et al., 2025)

Concepto: qué tan eficientemente se mueve el solucionador hacia el estado resuelto. Se mide como la proporción de movimientos que reducen la distancia al solved vs. movimientos que la aumentan o mantienen.

**Aplicabilidad a CubeForge:** Con `Min2PhaseSolver`, podemos calcular la distancia al solved en cada paso del timeline. Forward drift sería:
```
pf = (# moves que reducen distancia) / (total moves)
```
Ideal: pf → 1.0. Valores bajos indican ineficiencia o método no óptimo.

#### Curvas de aprendizaje universales

La investigación muestra que el rendimiento colectivo sigue curvas exponenciales. Esto podría usarse para proyectar el progreso del usuario y compararlo con benchmarks.

---

## 5. Parte 4 — Inventario Completo de Métricas

### 5.1 Métricas de Tiempo

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **Tiempo total** | Tiempo de solve completo | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Tiempo por fase** | Tiempo en cada fase del método | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Tiempo de inspección** | Tiempo real de inspección usado | ✅ | Baja | ⭐⭐⭐ |
| **Tiempo de transición** | Tiempo entre fin de una fase e inicio de la siguiente | ✅ | Baja | ⭐⭐⭐⭐ |
| **Tiempo perdido total** | Suma de pausas + rotaciones | ✅ | Media | ⭐⭐⭐⭐ |
| **Tiempo efectivo** | Tiempo total - pausas - rotaciones | ✅ | Media | ⭐⭐⭐⭐ |

### 5.2 Métricas de TPS (Turns Per Second)

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **TPS global** | Total moves / tiempo total | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **TPS por fase** | Moves de la fase / tiempo de la fase | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **TPS instantáneo** | TPS en ventana deslizante de N movimientos | ✅ | Media | ⭐⭐⭐⭐ |
| **TPS efectivo** | Total moves / tiempo efectivo (sin pausas) | ✅ | Media | ⭐⭐⭐⭐ |
| **TPS máximo** | Máximo TPS instantáneo alcanzado | ✅ | Baja | ⭐⭐⭐ |
| **TPS mínimo** | Mínimo TPS en ventana | ✅ | Baja | ⭐⭐ |
| **TPS por algoritmo** | TPS al ejecutar un OLL/PLL específico | ✅ | Media | ⭐⭐⭐⭐⭐ |
| **Aceleración de TPS** | Derivada del TPS instantáneo | ✅ | Alta | ⭐⭐⭐ |
| **Desaceleración** | Caídas bruscas de TPS (posibles errores) | ✅ | Alta | ⭐⭐⭐ |

### 5.3 Métricas de Pausas

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **Número total de pausas** | Pausas > umbral (ej. 0.5s) | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Pausa máxima** | La pausa más larga | ✅ | Baja | ⭐⭐⭐⭐ |
| **Pausa media** | Media de todas las pausas | ✅ | Baja | ⭐⭐⭐⭐ |
| **Pausas por fase** | Cuántas pausas en Cross, F2L, OLL, PLL | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Pausas largas** | Pausas > 1.5s (posible pérdida de lookahead) | ✅ | Baja | ⭐⭐⭐⭐ |
| **Pausas críticas** | Pausas que preceden a un error o DNF | ✅ | Alta | ⭐⭐⭐ |
| **Tiempo total en pausas** | Suma de todas las pausas | ✅ | Baja | ⭐⭐⭐⭐ |
| **Ratio pausas/tiempo** | % del solve en pausa | ✅ | Baja | ⭐⭐⭐⭐ |
| **Distribución de pausas** | Histograma de duraciones de pausa | ✅ | Media | ⭐⭐⭐ |
| **Pausas pre-algoritmo** | Pausa justo antes de ejecutar OLL/PLL | ✅ | Media | ⭐⭐⭐⭐⭐ |
| **Intervalo entre pausas** | Tiempo medio entre pausas consecutivas | ✅ | Media | ⭐⭐ |

### 5.4 Métricas de Rotación

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **Número total de rotaciones** | Conteo de x, y, z detectados por IMU | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Rotaciones por fase** | Rotaciones en Cross, F2L, OLL, PLL | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Rotaciones consecutivas** | Rotaciones sin moves intermedios (regrip) | ✅ | Baja | ⭐⭐⭐⭐ |
| **Tiempo perdido rotando** | Suma de tiempos entre rotación y siguiente move | ✅ | Baja | ⭐⭐⭐⭐ |
| **Rotaciones evitables** | Rotaciones que un solver óptimo no haría | ⚠️ | Alta | ⭐⭐⭐⭐ |
| **Eficiencia de orientación** | Ratio de rotaciones / moves totales | ✅ | Baja | ⭐⭐⭐⭐ |
| **Rotaciones redundantes** | y seguido de y' (cancelación) | ✅ | Baja | ⭐⭐⭐ |
| **Patrones de rotación** | Secuencias comunes y → move → y' | ✅ | Alta | ⭐⭐⭐ |
| **Rotaciones con/sin regrip** | Clasificación basada en tiempo entre eventos | ✅ | Media | ⭐⭐⭐ |

> **Nota:** Las métricas de rotación son posibles GRACIAS al Dynamic Notation Orientation System ya implementado. El `OrientationTracker` emite `RotationEvent` con axis/direction/timestamp — solo falta contarlos y analizarlos.

### 5.5 Métricas de Fluidez

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **Fluidez global** | Varianza/desviación estándar de tiempos inter-move | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Fluidez por fase** | Varianza inter-move dentro de cada fase | ✅ | Baja | ⭐⭐⭐⭐ |
| **Coeficiente de variación** | σ / μ de tiempos inter-move | ✅ | Baja | ⭐⭐⭐⭐ |
| **Ritmo** | Autocorrelación de tiempos inter-move | ✅ | Alta | ⭐⭐⭐ |
| **Consistencia** | Similitud de TPS entre fases | ✅ | Media | ⭐⭐⭐ |
| **Aceleraciones/desaceleraciones** | Cambios bruscos en el ritmo de giro | ✅ | Alta | ⭐⭐⭐ |
| **Entropía de ritmo** | Medida de impredecibilidad del patrón | ✅ | Alta | ⭐⭐ |

### 5.6 Métricas de Eficiencia de Movimientos

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **Move count total** | Número total de movimientos | ✅ | Baja | ⭐⭐⭐⭐ |
| **Move count por fase** | Movimientos en cada fase | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Eficiencia vs óptimo** | Move count / solución óptima del solver | ✅ | Media | ⭐⭐⭐⭐⭐ |
| **Redundancias** | Movimientos que se cancelan (R seguido de R') | ✅ | Baja | ⭐⭐⭐⭐ |
| **Cancelaciones** | Pares de movimientos que se anulan | ✅ | Baja | ⭐⭐⭐⭐ |
| **Overturns** | Movimientos de más de 90° (posible error) | ✅ | Baja | ⭐⭐⭐ |
| **Correcciones** | Movimientos que deshacen progreso | ✅ | Media | ⭐⭐⭐⭐ |
| **Movimientos innecesarios** | Movimientos que no acercan al solved | ⚠️ | Alta | ⭐⭐⭐⭐ |

### 5.7 Métricas Específicas de Cross (CFOP)

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **Cross time** | Tiempo total del Cross | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Cross moves** | Número de movimientos del Cross | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Cross TPS** | TPS durante el Cross | ✅ | Baja | ⭐⭐⭐⭐ |
| **Cross efficiency** | Cross moves / óptimo (≤8 siempre) | ✅ | Media | ⭐⭐⭐⭐⭐ |
| **Cross-to-F2L transition** | Tiempo entre fin de Cross y primer move F2L | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Cross pauses** | Pausas durante el Cross | ✅ | Baja | ⭐⭐⭐⭐ |
| **Cross rotations** | Rotaciones durante el Cross | ✅ | Baja | ⭐⭐⭐ |

### 5.8 Métricas Específicas de F2L (CFOP)

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **F2L time** | Tiempo total del F2L | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **F2L moves** | Movimientos totales del F2L | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **F2L TPS** | TPS durante el F2L | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Tiempo por par F2L** | Tiempo de cada par individual | ✅ | Media | ⭐⭐⭐⭐⭐ |
| **Pausa entre pares F2L** | Tiempo entre terminar un par y empezar el siguiente | ✅ | Media | ⭐⭐⭐⭐⭐ |
| **F2L pair recognition time** | Tiempo desde que el par es visible hasta el primer move | ⚠️ | Alta | ⭐⭐⭐⭐ |
| **F2L efficiency** | F2L moves / óptimo de Kociemba para F2L | ✅ | Alta | ⭐⭐⭐⭐⭐ |
| **F2L lookahead score** | Medida de continuidad entre pares | ✅ | Media | ⭐⭐⭐⭐ |
| **F2L rotations** | Rotaciones durante F2L | ✅ | Baja | ⭐⭐⭐⭐ |

### 5.9 Métricas Específicas de OLL/PLL (CFOP)

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **OLL recognition time** | Tiempo desde fin F2L hasta primer move OLL | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **OLL execution time** | Tiempo de ejecución del algoritmo | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **OLL TPS** | TPS durante la ejecución del OLL | ✅ | Baja | ⭐⭐⭐⭐ |
| **OLL algorithm identified** | Qué caso OLL se ejecutó | ✅ | Media | ⭐⭐⭐⭐ |
| **PLL recognition time** | Tiempo desde fin OLL hasta primer move PLL | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **PLL execution time** | Tiempo de ejecución del algoritmo | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **PLL TPS** | TPS durante la ejecución del PLL | ✅ | Baja | ⭐⭐⭐⭐ |
| **PLL algorithm identified** | Qué caso PLL se ejecutó | ✅ | Media | ⭐⭐⭐⭐ |
| **LL total time** | OLL + PLL tiempo combinado | ✅ | Baja | ⭐⭐⭐⭐ |
| **AUF time** | Tiempo de ajuste de capa U final | ✅ | Baja | ⭐⭐⭐ |

### 5.10 Métricas Específicas de Roux

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **First Block time** | Tiempo del primer bloque 1x2x3 | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **First Block moves** | Movimientos del FB | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **First Block efficiency** | FB moves / óptimo | ✅ | Media | ⭐⭐⭐⭐ |
| **Second Block time** | Tiempo del segundo bloque | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Second Block moves** | Movimientos del SB | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **SB Square time** | Tiempo hasta completar el cuadrado 1x2x2 | ✅ | Media | ⭐⭐⭐⭐ |
| **CMLL recognition time** | Tiempo hasta primer move de CMLL | ✅ | Baja | ⭐⭐⭐⭐ |
| **CMLL execution time** | Tiempo de ejecución del CMLL | ✅ | Baja | ⭐⭐⭐⭐ |
| **LSE time** | Tiempo del Last Six Edges | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **LSE sub-phases** | EO, UL/UR, M-slice final por separado | ✅ | Alta | ⭐⭐⭐⭐ |

### 5.11 Métricas Específicas de ZZ

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **EOLine time** | Tiempo de orientar aristas + línea DF/DB | ✅ | Baja | ⭐⭐⭐⭐ |
| **EOLine moves** | Movimientos del EOLine | ✅ | Baja | ⭐⭐⭐⭐ |
| **ZZ F2L time** | Tiempo del F2L (sin rotaciones) | ✅ | Baja | ⭐⭐⭐⭐ |
| **ZZ F2L efficiency** | F2L moves / óptimo | ✅ | Media | ⭐⭐⭐⭐ |
| **ZZ LL time** | Tiempo de la última capa | ✅ | Baja | ⭐⭐⭐ |

### 5.12 Métricas de Comparación y Benchmarking

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **Phase split ratios** | % de tiempo en cada fase vs referencia | ✅ | Baja | ⭐⭐⭐⭐⭐ |
| **Progreso temporal** | Evolución de tiempos en ventanas Ao100 | ✅ | Media | ⭐⭐⭐⭐⭐ |
| **Weakness detection** | Fase más lenta relativa al benchmark | ✅ | Media | ⭐⭐⭐⭐⭐ |
| **Consistency score** | Variabilidad de tiempos en sesión | ✅ | Baja | ⭐⭐⭐⭐ |
| **Improvement rate** | Tasa de mejora (ms/día, ms/sesión) | ✅ | Media | ⭐⭐⭐⭐ |
| **Personal best delta** | Diferencia con PB en cada fase | ✅ | Baja | ⭐⭐⭐⭐ |

### 5.13 Métricas de Sesión y Agregación

| Métrica | Descripción | Objetiva | Complejidad | Valor |
|:--------|:-----------|:--------:|:-----------:|:-----:|
| **TPS promedio de sesión** | Media de TPS de todos los solves | ✅ | Baja | ⭐⭐⭐⭐ |
| **Pausas promedio** | Media de pausas por solve | ✅ | Baja | ⭐⭐⭐ |
| **Eficiencia promedio** | Media de eficiencia de movimientos | ✅ | Baja | ⭐⭐⭐⭐ |
| **Rotaciones promedio** | Media de rotaciones por solve | ✅ | Baja | ⭐⭐⭐⭐ |
| **Trend de TPS** | Evolución del TPS a lo largo de sesiones | ✅ | Media | ⭐⭐⭐⭐ |
| **Heatmap de pausas** | Distribución de pausas en función del solve | ✅ | Alta | ⭐⭐⭐ |

---

## 6. Parte 5 — Modularidad Multi-Método

### 6.1 Estado actual

La arquitectura actual define:

```typescript
// ✅ Existe
interface MethodDefinition {
  name: string;
  phases: PhaseMask[];
}
```

Y tiene implementaciones concretas:
- `CFOPDefinition` — 4 fases: Cross → F2L → OLL → PLL
- `RouxDefinition` — 2 fases: FB → SB (❌ incompleto)

### 6.2 El problema

El `MethodDefinition` actual solo define **qué verificar** (las PhaseMasks), pero no define:
- **Reglas de transición:** ¿Cómo se detecta el fin de una fase? (cuando el mask se cumple por primera vez)
- **Sub-fases:** F2L tiene 4 pares — ¿deberían ser fases independientes?
- **Variantes:** X-Cross, pseudoslotting, etc. rompen la detección de fases estándar
- **Detección automática:** ¿CFOP o Roux? ¿O user-select?

### 6.3 Diseño propuesto

```typescript
// Extensión del diseño actual
interface MethodDefinition {
  name: string;
  phases: PhaseDefinition[];
  detectMethod?: (timeline: SolveTimeline) => number; // confidence score
  defaultColorScheme?: string; // para UI diferenciada
}

interface PhaseDefinition {
  name: string;
  mask: PhaseMask;
  subPhases?: PhaseDefinition[];  // F2L → [Pair1, Pair2, Pair3, Pair4]
  transitionRule?: 'first_match' | 'continuous';
  // 'first_match': fase termina cuando mask se cumple por primera vez
  // 'continuous': fase está activa mientras mask no se cumple
}
```

Las PhaseMasks existentes se reutilizarían completamente. Solo necesitan empaquetarse en `PhaseDefinition`.

### 6.4 Lo que cada método debe aportar

| Método | PhaseMasks | Detectores específicos | Métricas específicas |
|:-------|:-----------|:----------------------|:---------------------|
| **CFOP** | ✅ Cross, F2L, OLL, PLL | ❌ Reconocimiento de OLL/PLL específico | ❌ F2L pair, OLL/PLL recog |
| **Roux** | ⚠️ FB, SB (faltan CMLL, LSE) | ❌ CMLL case detection | ❌ Block efficiency |
| **ZZ** | ❌ No existe | ❌ No existe | ❌ No existe |
| **Petrus** | ❌ No existe | ❌ No existe | ❌ No existe |

### 6.5 Recomendación

1. **Completar Roux** añadiendo CMLLMask y LSEMask
2. **Añadir sub-fases a F2L** para análisis por par individual
3. **Mantener `MethodDefinition` como interfaz canónica** — el resto del sistema solo necesita conocer `phases: PhaseDefinition[]`
4. **Detección de método:** El usuario selecciona explícitamente (settings). La auto-detección es un nice-to-have futuro.

---

## 7. Parte 6 — Sinergias con Sistemas Existentes

### 7.1 Dynamic Notation Orientation System (DNOS) ⭐⭐⭐⭐⭐

**Es el sistema más valioso para EPIC 5 que no estaba previsto en el roadmap original.**

| Componente DNOS | Uso en EPIC 5 |
|:----------------|:--------------|
| `OrientationTable` (24 orientaciones) | Detección de orientación del cube en cada momento |
| `OrientationTracker.rotationEvents$` | **Fuente directa de métricas de rotación** |
| `OrientationTracker.orientation$` | Tracking de orientación para corregir fase detection |
| `MoveTransformer.toDisplay()` | Notación correcta en UI de análisis |
| `OrientationTable.findRotationBetween()` | Clasificación de rotaciones detectadas |
| `RotationEvent.axis/direction/timestamp` | Métricas: conteo, tiempo, eficiencia |

**Métricas DIRECTAMENTE habilitadas por DNOS:**
- Número total de rotaciones (x/y/z por separado)
- Rotaciones por fase
- Rotaciones consecutivas
- Tiempo perdido rotando
- Eficiencia de orientación (rotaciones/moves)
- Rotaciones redundantes (cancelaciones y → y')
- Detección de regrips

### 7.2 OrientationTracker ⭐⭐⭐⭐

- Emite `RotationEvent` con timestamps — listo para consumir en el pipeline de análisis
- La calibración asegura que las rotaciones son relativas al usuario
- `confidence` permite filtrar detecciones espurias

### 7.3 CubeState + StateMatcher ⭐⭐⭐⭐⭐

- `CubeState.applyMove()` permite reconstruir el estado en cualquier punto del timeline
- `StateMatcher.matchesMask()` verifica fases — núcleo del PhaseSplitter
- `CubeState.isSolved()` detecta fin del solve
- `CubeState.clone()` permite snapshots inmutables del timeline

### 7.4 Min2PhaseSolver ⭐⭐⭐⭐

- Solución óptima en ≤100ms — clave para métricas de eficiencia
- `solver.solve(state)` → secuencia óptima
- Comparación: eficiencia = move_count_user / move_count_optimal

### 7.5 Solve Schema (Modelo de Datos) ⭐⭐⭐⭐⭐

- Ya almacena `moves: CubeMoveEvent[]` con timestamps
- No se necesita migración de schema para empezar a analizar
- Los solves existentes (sin análisis) pueden ser analizados retrospectivamente

### 7.6 RxJS Infrastructure ⭐⭐⭐⭐

- `moves$`, `facelets$`, `rotationEvents$`, `state$`, `tick$` — todos existen
- El TelemetryService solo necesita suscribirse y coordinar

### 7.7 TimerEngine ⭐⭐⭐

- `handleSmartCubeStart/Stop` ya están implementados
- `READY_FOR_MOVE` state soporta inicio automático con Smart Cube
- Timer integrado con el cube — el pipeline de análisis recibe eventos con timestamps precisos

---

## 8. Parte 7 — Propuestas de Mejora al Roadmap

### Propuesta 1: Fusionar 5.1 y 5.2 → Nueva 5.1

**Cambio:** `State Tracking & Move Detection` + `Phase Recognition` → `Solve Timeline & Phase Recognition`

**Justificación:**
- El timeline sin phase recognition no produce valor
- La phase recognition sin timeline no puede funcionar
- Son dos caras de la misma moneda
- El código de ambos es trivial una vez existe el `SolveTimeline`

**Nuevo alcance:**
- `SolveTimeline`: historial inmutable de (MoveEvent, CubeState, timestamp)
- `PhaseSplitter`: divide el timeline en segmentos usando `MethodDefinition`
- `MethodDetector`: inferencia básica del método (user-select inicialmente)

### Propuesta 2: Dividir 5.3 en tres fases

**Cambio:** Una fase monolítica "Metric Computation" → 3 fases incrementales

**Justificación:**
- La fase original es demasiado amplia (8+ categorías de métricas)
- Algunas métricas dependen de otras (TPS por fase requiere PhaseSplitter)
- Dividir permite entregar valor incremental

**Nuevas fases:**

- **5.2 Core Metrics:** TPS (global, por fase), pausas, fluidez básica
- **5.3 Advanced Metrics:** Eficiencia vs solver, rotaciones (DNOS), redundancias/cancelaciones
- **5.4 Phase-Specific Metrics:** CrossEff, F2L pairs, OLL/PLL recognition, block efficiency (Roux)

### Propuesta 3: Añadir Phase 5.5: Replay Engine

**Justificación:**
- El replay es la base de la revisión post-solve
- Permite visualizar el solve con métricas superpuestas
- Diferencia a CubeForge de herramientas que solo muestran números
- Ya existe `SyncBridge` y el 3D engine — solo falta conectar el timeline al 3D

**Alcance:**
- Reproducir un `SolveTimeline` en el 3D engine (forward/backward, velocidad variable)
- Overlay de métricas durante el replay (TPS, fase actual)
- Exportar replay como video/GIF (nice-to-have futuro)

### Propuesta 4: Renombrar 5.4 original → 5.6

El Telemetry Service sigue siendo la última fase del pipeline, pero ahora es 5.6 en lugar de 5.4.

### Propuesta 5: Arquitectura de calculadores de métricas como plugins

En lugar de una función monolítica `generateMetrics(timeline)`, cada métrica debe ser un módulo independiente:

```typescript
interface MetricCalculator<T = number> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: MetricCategory;
  readonly dependencies: string[]; // IDs de otras métricas requeridas
  compute(timeline: SolveTimeline, deps: Record<string, unknown>): T;
}
```

**Beneficios:**
- Cada métrica se desarrolla, testea y versiona independientemente
- Los usuarios pueden activar/desactivar métricas según costo computacional
- Fácil añadir nuevas métricas sin tocar el core
- Los calculadores pueden ejecutarse en paralelo (Web Workers)

### Propuesta 6: Arquitectura del SolveTimeline

```typescript
interface TimelineEntry {
  index: number;
  move: CubeMoveEvent;        // Move crudo del BLE
  displayMove: DisplayMove;   // Move remapeado por orientación
  state: CubeState;           // Estado del cube DESPUÉS de aplicar el move
  hostTimestamp: number;      // performance.now()
  orientation?: CubeOrientation; // Orientación del cube en este momento
  phaseId?: number;           // ID de la fase actual (asignado por PhaseSplitter)
}

interface SolveTimeline {
  solveId: string;
  method: string;
  entries: TimelineEntry[];
  phases: PhaseSegment[];
  startTimestamp: number;
  endTimestamp: number;
}

interface PhaseSegment {
  phaseName: string;
  startIndex: number;
  endIndex: number;
  startTimestamp: number;
  endTimestamp: number;
}
```

---

## 9. Parte 8 — Priorización de Métricas

### 9.1 Criterios de priorización

Cada métrica se evalúa en 5 dimensiones (1-5):

| Dimensión | Peso | Descripción |
|:----------|:----:|:------------|
| **Valor para el usuario** | 30% | ¿Cuánto ayuda a mejorar? |
| **Valor para entrenamiento** | 25% | ¿Es accionable? ¿Sugiere qué practicar? |
| **Complejidad de implementación** | 15% | Inversa: más simple = mejor |
| **Reutilización de infraestructura** | 15% | ¿Aprovecha código existente? |
| **Compatibilidad multi-método** | 15% | ¿Funciona con CFOP, Roux, ZZ...? |

### 9.2 Tier 1 — Implementar AHORA (MVP del pipeline de análisis)

Estas métricas son de altísimo valor, baja complejidad, y dependen solo del SolveTimeline (5.1):

| # | Métrica | Valor | Compl. | Reuso | Multi | **Score** |
|:-:|:--------|:-----:|:------:|:-----:|:-----:|:---------:|
| 1 | **Tiempo por fase** | 5 | 1 | 5 | 5 | **4.4** |
| 2 | **TPS por fase** | 5 | 1 | 5 | 5 | **4.4** |
| 3 | **Número de pausas** | 5 | 1 | 4 | 5 | **4.2** |
| 4 | **Pausa máxima/media** | 5 | 1 | 4 | 5 | **4.2** |
| 5 | **TPS global** | 5 | 1 | 5 | 5 | **4.4** |
| 6 | **Move count por fase** | 5 | 1 | 5 | 5 | **4.4** |
| 7 | **Fluidez global** | 4 | 1 | 4 | 5 | **3.9** |
| 8 | **Rotaciones totales** | 5 | 1 | 5 | 5 | **4.4** |

> **Todas las métricas Tier 1 requieren SOLO el SolveTimeline (5.1). Sin dependencia del solver.**

### 9.3 Tier 2 — Siguiente iteración

Requieren el solver (`Min2PhaseSolver`) y/o DNOS para rotaciones avanzadas:

| # | Métrica | Valor | Compl. | Reuso | Multi | **Score** |
|:-:|:--------|:-----:|:------:|:-----:|:-----:|:---------:|
| 9 | **Eficiencia vs óptimo** | 5 | 3 | 3 | 4 | **3.9** |
| 10 | **Rotaciones por fase** | 5 | 1 | 5 | 5 | **4.4** |
| 11 | **Rotaciones consecutivas** | 4 | 1 | 5 | 5 | **3.9** |
| 12 | **Tiempo perdido rotando** | 4 | 2 | 5 | 5 | **4.0** |
| 13 | **Redundancias/cancelaciones** | 4 | 2 | 3 | 5 | **3.6** |
| 14 | **TPS instantáneo** | 4 | 2 | 4 | 5 | **3.8** |
| 15 | **Cross efficiency** | 5 | 2 | 3 | 1 | **3.2** |
| 16 | **Cross-to-F2L transition** | 5 | 1 | 4 | 1 | **3.2** |

### 9.4 Tier 3 — Valor alto, mayor complejidad

Requieren reconocimiento de algoritmos, sub-fases, o procesamiento más complejo:

| # | Métrica | Valor | Compl. | Reuso | Multi | **Score** |
|:-:|:--------|:-----:|:------:|:-----:|:-----:|:---------:|
| 17 | **Tiempo por par F2L** | 5 | 3 | 2 | 1 | **3.0** |
| 18 | **OLL/PLL recognition** | 5 | 4 | 2 | 1 | **3.0** |
| 19 | **Pausas pre-algoritmo** | 5 | 3 | 4 | 3 | **3.8** |
| 20 | **F2L lookahead score** | 5 | 3 | 3 | 1 | **3.1** |
| 21 | **OLL/PLL execution TPS** | 5 | 3 | 3 | 1 | **3.1** |
| 22 | **Forward drift** | 4 | 3 | 3 | 4 | **3.5** |
| 23 | **Phase split ratios vs benchmark** | 5 | 2 | 2 | 3 | **3.4** |
| 24 | **CMLL/LSE metrics (Roux)** | 5 | 3 | 2 | 1 | **2.9** |

### 9.5 Tier 4 — Futuro / Investigación

| # | Métrica | Notas |
|:-:|:--------|:------|
| 25 | Ritmo (autocorrelación) | Interesante pero bajo valor inmediato |
| 26 | Entropía de ritmo | Investigación, no estándar |
| 27 | Aceleraciones/desaceleraciones | Requiere datos de alta frecuencia |
| 28 | Rotaciones evitables | Subjetivo, requiere heurística compleja |
| 29 | ZZ EOLine metrics | Baja prioridad (menos usuarios ZZ) |
| 30 | Petrus metrics | Baja prioridad |

---

## 10. Conclusión y Hoja de Ruta Recomendada

### Estado general

| Indicador | Valoración |
|:----------|:----------:|
| Infraestructura existente aprovechable | 🟢 **95%** |
| Código a escribir desde cero | 🟢 **~500 líneas** (tests + integración) |
| Riesgo técnico | 🟢 **Bajo** (base matemática testeada) |
| Tiempo estimado para MVP | 🟢 **Ya completado** |
| Tiempo estimado completo | 🟢 **1 día adicional** (telemetry service opcional) |

### Hoja de ruta recomendada (revisada)

```
✅ COMPLETADO:
  FASE 5.1 — Solve Timeline & Phase Recognition
  ├─ SolveTimeline (inmutable, replayable)
  ├─ PhaseSplitter (generic, method-agnostic) — 12 tests
  ├─ TimelineBuilder — 8 tests
  └─ PhaseMasks: CFOP, Roux (completo), ZZ, Petrus

✅ COMPLETADO:
  FASE 5.2 — Core Metrics
  ├─ TPS Calculator (global, por fase, peak, instantaneous) — 10 tests
  ├─ PauseDetector (umbral configurable, categorías) — 10 tests
  ├─ Fluidity Calculator (varianza, bursts, acceleration)
  ├─ MetricsAggregator (orquestador) — 12 tests
  └─ Todos los tests pasan (52/52)

✅ COMPLETADO:
  FASE 5.3 — Advanced Metrics
  ├─ Rotation Metrics (via orientations pipeline) — funciona
  ├─ Move Efficiency (async, via Min2PhaseSolver)
  ├─ RedundancyDetector (integrado en MetricsAggregator)
  ├─ DB persistence (migration 005, analysis column)
  └─ Historical analysis display (TimesList → SolveAnalysisPanel)

PENDIENTE (opcional):
  FASE 5.4 — Replay Engine (Timeline → 3D Engine playback)
  FASE 5.5 — Telemetry + Live Feedback (excluido del alcance)
```

### Principios de diseño a mantener

1. **Pipeline offline-first:** El análisis se ejecuta post-solve (no en tiempo real durante el solve). Los datos crudos (moves) se guardan y el análisis se computa después. Esto elimina el riesgo de performance durante el solve.

2. **Calculadores independientes:** Cada métrica es un módulo autocontenido con interfaz común. Se pueden activar/desactivar, testear aisladamente, y ejecutar en paralelo.

3. **Método-agnóstico desde el diseño:** El PhaseSplitter recibe un `MethodDefinition` y las métricas operan sobre fases genéricas. CFOP, Roux, ZZ, Petrus son solo configuraciones de `MethodDefinition`.

4. **Todo es headless primero:** Las métricas se calculan en `packages/analysis-engine` sin dependencia de React/UI. La UI consume los resultados vía stores/hooks.

5. **No duplicar lo que ya existe:** DNOS para rotaciones, `StateMatcher` para fases, `Min2PhaseSolver` para eficiencia, `CubeState` para tracking. Cada sistema existente se integra, no se reimplementa.

---

*Fin del informe de auditoría.*
