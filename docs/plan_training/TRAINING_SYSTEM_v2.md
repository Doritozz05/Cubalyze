# CubeForge — Sistema de Entrenamiento (v2: Method-First)

> **Documento de diseño del sistema de entrenamiento orientado a métodos.**
> Fecha: Julio 2026
> Estado: Borrador de diseño — pendiente de implementación
> 
> **Diferencia clave con v1:** El sistema ya no tiene modos hardcodeados (Cross, F2L, OLL, PLL).  
> En lugar de eso, los **métodos** (CFOP, Roux, ZZ, Petrus, etc.) son la entrada principal.  
> Cada método define sus propias fases/sub-métodos, y los modos de entrenamiento se adaptan a cada fase.

---

## Índice

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Jerarquía de Navegación](#3-jerarquía-de-navegación)
4. [Método 1: CFOP](#4-método-1-cfop)
5. [Método 2: Roux](#5-método-2-roux)
6. [Método 3: ZZ](#6-método-3-zz)
7. [Método 4: Petrus](#7-método-4-petrus)
8. [Modos de Entrenamiento Transversales](#8-modos-de-entrenamiento-transversales)
9. [Progress Tracking & SRS](#9-progress-tracking--srs)
10. [UI/UX del Training Dashboard](#10-uiux-del-training-dashboard)
11. [Integración con el Ecosistema](#11-integración-con-el-ecosistema)
12. [Plan de Implementación](#12-plan-de-implementación)

---

## 1. Visión General

El sistema de entrenamiento es el **core value proposition** de CubeForge según el PRD. Unifica los 5 layers del producto: timer, smart cube, análisis, algoritmo DB, y entrenamiento en una experiencia cohesiva.

### Principios de diseño

1. **Method-First** — El punto de entrada son los métodos, no las fases CFOP
2. **Cada método es único** — CFOP tiene Cross/F2L/OLL/PLL; Roux tiene Blocks/CMLL/LSE; etc.
3. **Modos transversales** — Algorithm Drill, Full Solve, Recall, Challenges funcionan para cualquier método/fase
4. **Datos reales del usuario** — el entrenamiento se alimenta de los solves reales, no de supuestos
5. **Progresión natural** — del drill aislado al solve completo con phase targets
6. **Agujeros detectados automáticamente** — el sistema identifica debilidades sin que el usuario las configure
7. **Gamificación inteligente** — challenges diarios, streaks, sin grind vacío

### Entry points

| Desde | Acción | Resultado |
|---|---|---|
| **Algorithms tab** | Click en cualquier caso → "Practice This" | Training tab abierto con ese método, fase y caso preset |
| **Training tab** | Navegación directa → selección de método | Dashboard del método con sus fases y progreso |
| **Insights** | Click en "Improve this phase" | Training mode específico para fase débil (con método detectado) |
| **AI Coach** | Recomendación automática | Training plan personalizado para el método del usuario |

---

## 2. Arquitectura del Sistema

```
packages/training/src/
├── TrainingEngine.ts              ← Core: orquesta modos de entrenamiento
│
├── methods/
│   ├── CFOPMethod.ts              ← Definición de fases CFOP + config
│   ├── RouxMethod.ts              ← Definición de fases Roux + config
│   ├── ZZMethod.ts                ← Definición de fases ZZ + config
│   ├── PetrusMethod.ts            ← Definición de fases Petrus + config
│   └── MethodRegistry.ts          ← Registro central de métodos disponibles
│
├── modes/                         ← Modos transversales (funcionan para cualquier método)
│   ├── AlgorithmDrill.ts          ← Drill de algoritmos (OLL, PLL, CMLL, COLL...)
│   ├── PhaseTrainer.ts            ← Entrenamiento de fase específica (Cross, First Block, EOLine...)
│   ├── FullSolveTrainer.ts        ← Solve completo con targets por fase
│   ├── RecallTrainer.ts           ← Memorización + SRS
│   └── ChallengeGenerator.ts      ← Challenges diarios
│
├── progress/
│   ├── ProgressTracker.ts         ← Almacena tiempos/accuracy por caso
│   ├── SpacedRepetition.ts        ← SM-2 adaptado a speedcubing
│   └── WeaknessDetector.ts        ← Analiza solves reales → recomienda
│
├── verification/
│   ├── CaseVerifier.ts            ← ¿El usuario resolvió el caso correcto?
│   └── StateComparer.ts           ← Compara estado esperado vs real
│
└── generation/
    ├── SetupGenerator.ts          ← Genera scramble para caso específico
    └── ScenarioBuilder.ts         ← Construye escenarios multi-fase
```

### Mapeo Methods ↔ data del sistema

```typescript
// Cada método se registra con sus fases y configuraciones
interface RegisteredMethod {
  methodId: string;                       // e.g. "cfop", "roux", "zz", "petrus"
  name: string;                           // e.g. "CFOP"
  phases: PhaseDefinition[];              // Fases ordenadas del método
  defaultTrainingMode: TrainingMode;      // Modo por defecto al entrar
  supportedSubsets: string[];             // Subsets de algorithm-db que aplican
}

interface PhaseDefinition {
  id: string;                             // e.g. "cross", "f2l", "oll", "pll"
  name: string;                           // e.g. "Cross"
  icon: string;                           // Icono para UI
  description: string;
  sortOrder: number;
  hasAlgorithms: boolean;                 // ¿Tiene algoritmos asociados? (OLL sí, Cross no siempre)
  visualizationMode: 'case-focus' | 'full-cube' | 'highlight-pieces' | '2d-diagram';
  subsets: string[];                      // Subsets de algorithm-db relevantes
  trainingModes: {
    drill: DrillConfig;
    transition?: TransitionConfig;        // Config de transición hacia la siguiente fase
  };
}
```

### Interfaces transversales

```typescript
// Resultado de un intento de entrenamiento
interface TrainingAttempt {
  id: string;
  userId: string;
  methodId: string;          // ← Nuevo: el método al que pertenece
  phaseId: string;           // ← Nuevo: la fase específica
  caseId: string;
  mode: TrainingMode;
  timestamp: number;
  timeMs: number;
  moves: string[];
  tps: number;
  correct: boolean;
  expectedAlg: string[];
  actualState: string;
  expectedState: string;
  hintsUsed: number;
}

// Progreso por algoritmo (con método y fase)
interface AlgorithmProgress {
  methodId: string;          // ← Nuevo
  phaseId: string;           // ← Nuevo
  caseId: string;
  attempts: number;
  successes: number;
  bestTime: number;
  avgTime: number;
  lastPracticed: number;
  mastery: number;           // 0-100
  nextReview: number;
}

// Progreso por método
interface MethodProgress {
  methodId: string;
  methodName: string;
  phases: PhaseProgress[];
  overallMastery: number;
}

interface PhaseProgress {
  phaseId: string;
  phaseName: string;
  masteredAlgorithms: number;
  totalAlgorithms: number;
  avgTime: number;
  bestTime: number;
}

// Sesión de entrenamiento
interface TrainingSession {
  id: string;
  methodId: string;          // ← Nuevo
  phaseId: string;           // ← Nuevo
  mode: TrainingMode;
  startedAt: number;
  endedAt?: number;
  attempts: TrainingAttempt[];
  config: TrainingConfig;
}
```

---

## 3. Jerarquía de Navegación

La navegación va de lo general a lo específico en 3 niveles:

```
NIVEL 1: TRAINING DASHBOARD
┌──────────────────────────────────────────────────────────────────┐
│  🏋️ TRAINING                                                    │
│                                                                  │
│  ┌─── Selecciona un método ──────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │   CFOP   │  │   Roux   │  │    ZZ    │  │  Petrus  │ │  │
│  │  │   80%    │  │   70%    │  │   30%    │  │   45%    │ │  │
│  │  │ ████████ │  │ ███████  │  │ ███      │  │ █████    │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  │                                                           │  │
│  │  ┌───────────────────────────────────────────────────┐   │  │
│  │  │  📋 Today's Queue (SRS) — global                 │   │  │
│  │  │  🔴 OLL 21   CFOP  3d ago  78%                   │   │  │
│  │  │  🟡 CMLL A2  Roux 2d ago  85%                   │   │  │
│  │  │  🆕 EOLine   ZZ   NEW   [Learn]                  │   │  │
│  │  └───────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  🏆 Daily Challenge (multi-method)                       │  │
│  │  🔥 Streaks + Logros globales                            │  │
│  │  💡 AI Recommendation (basada en tu método principal)    │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

NIVEL 2: DASHBOARD DEL MÉTODO (al hacer click en CFOP/Roux/ZZ/Petrus)
┌──────────────────────────────────────────────────────────────────┐
│  CFOP  │  80% global  │  🔥 12-day streak                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── Fases del método ─────────────────────────────────────┐   │
│  │                                                          │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │   │
│  │  │ Cross  │  │  F2L   │  │  OLL   │  │  PLL   │        │   │
│  │  │  85%   │  │  75%   │  │  60%   │  │  90%   │        │   │
│  │  │ ██████ │  │ █████  │  │ █████  │  │ ██████ │        │   │
│  │  │8.0 avg │  │6.5 avg │  │1.8 avg │  │1.2 avg │        │   │
│  │  └────┬───┘  └────┬───┘  └────┬───┘  └────┬───┘        │   │
│  │       │            │            │            │           │   │
│  │       ▼            ▼            ▼            ▼           │   │
│  │  [Drill]     [Drill]      [Drill]      [Drill]          │   │
│  │  [Train]     [Train]      [Train]      [Train]          │   │
│  │  [Trans]     [Recog]      [Recall]     [Recall]         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── Phase Targets (Full Solve) ────────────────────────────┐  │
│  │  Cross: <2.0s ████████░░ (2.4s)    PLL: <1.2s ████████░░ │  │
│  │  F2L:  <6.0s ██████░░░░ (7.1s)    OLL: <1.5s ███████░░░ │  │
│  │  Total: <10.7s  Actual: 12.8s                            │  │
│  │  [Start Full Solve]                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── SRS Queue (CFOP only) ───────────────────────────────┐   │
│  │  🔴 OLL 21  ── 3d ago ── 78%                           │   │
│  │  🟡 PLL Aa  ── 2d ago ── 85%                           │   │
│  │  🆕 OLL 33  ── NEW                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

NIVEL 3: ENTRENAMIENTO DE FASE (al hacer click en Drill/Train de una fase)
┌──────────────────────────────────────────────────────────────────┐
│  CFOP  ›  OLL  │  Drill  │  21/57 mastered  │  85%              │
├──────────────────────────────────────────────────────────────────┤
│  (Contenido específico de Algorithm Drill/Phase Trainer/Recall)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Método 1: CFOP

### Fases del método

| # | Fase | Subsets | Icon | Training Modes disponibles |
|---|------|---------|------|--------------------------|
| 1 | Cross | Cross | ❌ | PhaseTrainer (Plain, X-Cross, CN, Blind, Transition) |
| 2 | F2L | F2L | 🧩 | PhaseTrainer (Slots, Recognition, Look-Ahead), AlgorithmDrill |
| 3 | OLL | OLL, COLL, Winter Variation, VLS | 🔵 | AlgorithmDrill, Recall, FlashRecognition |
| 4 | PLL | PLL, ZBLL | 🔄 | AlgorithmDrill, Recall, FlashRecognition |

### 4.1 Cross Trainer (fase Cross)

**Flujo general:**
1. Usuario selecciona una fase (Cross) + sub-modo
2. Sistema genera scramble
3. Timer corre mientras resuelve solo la cruz
4. Sistema detecta automáticamente cuándo la cruz está completa (PhaseSplitter con masks CFOP)
5. Mide: tiempo, movimientos, eficiencia vs óptimo

**Sub-modos:**

| Sub-modo | Descripción | Métricas clave |
|---|---|---|
| **Plain** | Cruz normal | Movs vs óptimo, tiempo inspección, TPS |
| **X-Cross** | Cruz + 1 par F2L simultáneo | Tiempo total, movs extra vs plain |
| **CN** | Color-Neutral: no indica cross face | Tiempo decisión, face elegida vs óptima |
| **Blind** | 15s inspección → resolver sin mirar | Precisión, correcciones |
| **Transition** | Pausa cross → F2L | `cross_to_f2l_pause` (target: < 0.3s) |

**UX:**
```
┌──────────────────────────────────────────────────────────────────┐
│  CFOP › CROSS  │  [Plain] [X-Cross] [CN] [Blind] [Transition]   │
├──────────────────────────────────────────────────────────────────┤
│  Scramble: D R' F U2 L' B R' D' F2 L2 B2 R2...                 │
│                                                                  │
│  ┌──────────────────────┐   ┌────────────────────────┐          │
│  │                      │   │  ⏱ 2.34s               │          │
│  │   3D CUBE            │   │  Moves: 9/7 optimal    │          │
│  │   (Highlight Pieces) │   │  Eff: 78%              │          │
│  │                      │   │  Inspection: 1.2s      │          │
│  │   Aristas cross      │   │  TPS: 3.8              │          │
│  │   resaltadas en      │   │  Pause→F2L: 0.4s      │          │
│  │   colores            │   │                        │          │
│  └──────────────────────┘   │  [Show Optimal]        │          │
│                             │  💡 [AI Hint]          │          │
│                             └────────────────────────┘          │
│                                                                  │
│  Progreso: ████████░░ 72% (8 solves ≤ 8 moves)                 │
└──────────────────────────────────────────────────────────────────┘
```

**Visualización 3D:** Highlight Pieces — 4 aristas de la cruz resaltadas, resto semi-transparente.

### 4.2 F2L Trainer (fase F2L)

**Sub-modos:**

| Sub-modo | Descripción |
|---|---|
| **Slots** | Single slot (FR/FL/BR/BL), Front slots, Back slots, Random |
| **Recognition** | Mostrar caso → identificar (múltiple choice) |
| **Look-Ahead** | Metronome (BPM), Slow-Mo (TPS limitado), Blind Pair, Transition |

**Look-Ahead Training ⭐ (VENTAJA COMPETITIVA)**

Ningún entrenador actual hace esto bien.

#### Metronome Mode
- Metrónomo a X BPM (ej: 120 BPM = 2 turns/second)
- El usuario debe girar AL RITMO del metrónomo
- Si gira fuera de ritmo → feedback visual (rojo) + contador de misses
- **Objetivo**: forzar look-ahead porque no puedes ir más rápido que el beat
- Progresión: 120 BPM → 150 BPM → 180 BPM → 210 BPM

#### Slow-Mo Mode
- Sistema limita TPS máximo a 2.0 (advertencia si excede)
- Mide: pausas totales, tiempo de "mirar"
- **Paradoja**: yendo más lento, aprendes a no pausar
- Métrica: pause ratio = tiempo pausado / tiempo total

#### Blind Pair
- Scramble → inspeccionas 5s
- Resuelves 1 par F2L SIN mirar el cubo
- Feedback: ¿acertaste? ¿tiempo? ¿eficiencia?

#### Transition Zone
- Mide el gap entre cross→F2L y entre cada par F2L
- **Heatmap** de dónde pierdes tiempo
- Objetivo: < 0.3s entre cada par

```
┌──────────────────────────────────────────────────────────────────┐
│  CFOP › F2L  │  Look-Ahead  │  Metronome: 120 BPM               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── Metrónomo ─────────────────────────────────────────────┐  │
│  │  🥁  🥁  🥁  🥁  🥁  🥁  🥁  🥁  🥁  🥁               │  │
│  │  🔴 ✅ 🔴 ✅ 🔴 ✅ 🔴 ✅ 🔴 ❌ 🔴 ✅                  │  │
│  │  On-beat: 7/10  │  Avg TPS: 1.9                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⏱️ 8.45s  │  Pairs: 4/4  │  Transition: 0.28s avg             │
│  Pause ratio: 12%  │  Look-ahead score: B+                      │
│                                                                  │
│  💡 "Tu pausa entre pair 2 y 3 fue de 0.8s — enfócate          │
│      en tracking del próximo par mientras ejecutas el actual."   │
└──────────────────────────────────────────────────────────────────┘
```

**Visualización 3D:** Highlight Pieces — slot vacío + piezas del par resaltadas.

### 4.3 OLL / PLL Drill (fases OLL, PLL)

Usan el **AlgorithmDrill** transversal:

| Sub-modo | Descripción | Métricas clave |
|---|---|---|
| **Single** | Practica un caso específico | Tiempo, TPS, accuracy, tendencia |
| **Random** | Saca casos aleatorios del subset | Media, desviación, tasa de fallo |
| **Sequential** | Recorre todos los casos en orden | Cobertura, progreso |
| **Weakness** | Prioriza casos con peor tiempo | Mejora vs baseline |

**Flujo:**
1. Seleccionas subset (OLL/PLL/COLL/ZBLL)
2. Sistema genera scramble que lleva al caso exacto
3. Timer corre (manual o smart cube)
4. Usuario ejecuta algoritmo + AUF
5. Verificación automática
6. Feedback inmediato
7. Se guarda en progreso

```
┌──────────────────────────────────────────────────────────────────┐
│  CFOP › OLL  │  Drill  │  21/57 mastered  │  85%                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌────────────────────────┐               │
│  │                  │  │  R U R' U R U2 R'      │               │
│  │   Diagrama 2D    │  │                        │               │
│  │   del caso       │  │  [Show/Hide]  🔒       │               │
│  │                  │  │  [☐ Reveal if fail]    │               │
│  │   OLL 21         │  │                        │               │
│  │   H case         │  │  💡 [AI Hint]          │               │
│  └──────────────────┘  │                        │               │
│                         │  Setup: R U R' U'     │               │
│  ⏱️ 1.24s              │                        │               │
│  📊 TPS 8.1  ✅        │  [Skip]  [Done]        │               │
│                         └────────────────────────┘               │
│                                                                  │
│  Session: 15/50  │  🔥 Streak: 7 correct  │  ⏱ Avg: 1.31s      │
│                                                                  │
│  ┌─── Últimos intentos ───────────────────────────────────────┐ │
│  │  ✅ 1.24s  ✅ 1.31s  ❌ 1.89s  ✅ 1.18s  ✅ 1.22s       │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Visualización 3D:**
- OLL/COLL: Case Focus (solo U face en color, resto gris)
- PLL/ZBLL: Full Cube (todas las caras)

---

## 5. Método 2: Roux

### Fases del método

| # | Fase | Subsets | Training Modes disponibles |
|---|------|---------|--------------------------|
| 1 | First Block | First Block | PhaseTrainer (Block Building, Efficiency, CN, Blind) |
| 2 | Second Block | Second Block | PhaseTrainer (Block Building, Efficiency, Look-Ahead) |
| 3 | CMLL | CMLL | AlgorithmDrill, Recall, FlashRecognition |
| 4 | LSE | LSE | PhaseTrainer (EO, UL/UR, M-slice, Transition) |

### 5.1 First Block Trainer

**Adaptación del PhaseTrainer para blockbuilding:**

| Sub-modo | Descripción |
|---|---|
| **Block Building** | Construir primer bloque (1x2x3) eficientemente |
| **Efficiency** | Minimizar movimientos vs óptimo |
| **CN** | Color-Neutral: elegir el color óptimo para el bloque |
| **Blind** | Inspección 15s → resolver sin mirar |

**Métricas:**
- Movimientos vs solución óptima (calculada con solver)
- Tiempo de inspección (primer movimiento)
- TPS durante block building
- Eficiencia: `(optimalMoves / actualMoves) * 100`

**Visualización 3D:** Highlight Pieces — piezas del primer bloque resaltadas.

### 5.2 Second Block Trainer

**Sub-modos:**
- **Block Building**: Construir segundo bloque usando el primero como base
- **Look-Ahead**: Mantener tracking de piezas mientras se ejecuta
- **Efficiency**: vs óptimo

**Métrica especial:** `first_to_second_pause` — gap entre bloques

### 5.3 CMLL Drill

Idéntico a Algorithm Drill de CFOP-OLL, pero con los 42 casos CMLL.

**Visualización 3D:** Case Focus — solo U face, ignorando M-slice.

### 5.4 LSE Trainer

**Sub-modos:**

| Sub-modo | Descripción |
|---|---|
| **EO** | Edge Orientation en M-slice |
| **UL/UR** | Posicionar edges UL y UR |
| **M-slice** | Finalizar M-slice eficientemente |
| **Full LSE** | LSE completo con phase targets internos |
| **Transition** | Gap CMLL → LSE |

**Visualización 3D:** Highlight Pieces — edges relevantes resaltados.

```
┌──────────────────────────────────────────────────────────────────┐
│  ROUX › LSE  │  Full LSE  │  EO: 4/6 edges oriented             │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐   ┌────────────────────────┐          │
│  │                      │   │  ⏱ 3.12s               │          │
│  │   3D CUBE            │   │  EO: 0.8s  ✅           │          │
│  │   (LSE Focus)        │   │  UL/UR: 1.2s  ✅        │          │
│  │                      │   │  M-slice: 1.1s  ❌      │          │
│  │   EO: ✅             │   │                        │          │
│  │   UL/UR: tracking    │   │  TPS: 6.8              │          │
│  │                      │   │  Eff: 82%              │          │
│  └──────────────────────┘   │                        │          │
│                              │  [Show Optimal LSE]   │          │
│                              │  💡 [AI Hint]         │          │
│                              └────────────────────────┘          │
│                                                                  │
│  Progreso LSE: ████████░░ 72%  │  Best: 2.84s                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Método 3: ZZ

### Fases del método

| # | Fase | Subsets | Training Modes disponibles |
|---|------|---------|--------------------------|
| 1 | EOLine | EOLine | PhaseTrainer (Plain, CN, Blind, Transition→F2L) |
| 2 | F2L (ZZ) | F2L | PhaseTrainer (Slots, Look-Ahead, Rotationless) |
| 3 | Last Layer | OCLL, ZZLL, COLL | AlgorithmDrill, Recall, FlashRecognition |

### 6.1 EOLine Trainer

**Particularidades ZZ:** EOLine = orientar edges + colocar línea DF/DB.

| Sub-modo | Descripción |
|---|---|
| **Plain** | EOLine normal, eficiencia vs óptimo |
| **CN** | Color-Neutral (elegir mejor orientación) |
| **Blind** | 15s inspección → resolver sin mirar |
| **Transition** | Pausa EOLine → F2L |

**Métrica clave:** EO detection time + Line placement efficiency

**Visualización 3D:** Highlight Pieces — edges mal orientados en rojo, edges de línea resaltados.

### 6.2 F2L (ZZ) Trainer

**Diferencia con CFOP F2L:** Sin rotaciones de cubo (solo R, U, L moves).

**Sub-modos:**
- **Slots**: Single/Front/Back/Random
- **Look-Ahead**: Metronome, Slow-Mo, Blind Pair (adaptados a solo RUL)
- **Rotationless**: Penalización si usas rotaciones

### 6.3 Last Layer (ZZ)

- **OCLL**: 7 casos (edges ya orientados por EOLine)
- **ZZLL**: 169 casos (más complejo que CFOP PLL)
- **COLL**: 42 casos (orientar + permutar esquinas)

Usan AlgorithmDrill estándar.

---

## 7. Método 4: Petrus

### Fases del método

| # | Fase | Subsets | Training Modes disponibles |
|---|------|---------|--------------------------|
| 1 | 2x2x2 Block | 2x2x2 Block | PhaseTrainer (Block Building, Efficiency, CN) |
| 2 | 2x2x3 Block | 2x2x3 Block | PhaseTrainer (Extension, Efficiency) |
| 3 | EO | EO | PhaseTrainer (Edge Orientation) |
| 4 | F2L (Petrus) | F2L | PhaseTrainer (Slots) |
| 5 | Last Layer | COLL, EPLL | AlgorithmDrill, Recall |

### 7.1 Block Trainers (2x2x2 y 2x2x3)

**Sub-modos block building:**
- **Block Building**: Construir bloque eficientemente
- **Efficiency**: Minimizar movimientos
- **CN**: Color-Neutral para 2x2x2

**Visualización 3D:** Highlight Pieces — piezas del bloque resaltadas.

### 7.2 EO Trainer (Edge Orientation Petrus)

**Diferencia con ZZ EO:** En Petrus, EO se hace después del 2x2x3, con F/B moves.

- Mostrar edges mal orientados (solo los que no son F/B)
- Timer de reconocimiento + ejecución

---

## 8. Modos de Entrenamiento Transversales

Estos modos funcionan para **cualquier método y fase** que tenga algoritmos asociados.

### 8.1 Algorithm Drill

**Descripción:** Drill de algoritmos para cualquier subset (OLL, PLL, CMLL, COLL, OCLL, ZBLL, ZZLL...).

**Sub-modos transversales:**
- **Single**: Practica un caso específico
- **Random**: Casos aleatorios del subset
- **Sequential**: Recorre todos los casos en orden
- **Weakness**: Prioriza casos con peor rendimiento

**Verificación automática:**
```typescript
class CaseVerifier {
  static verify(
    initialState: CubeState,
    userMoves: string[],
    expectedAlg?: string[],
  ): VerificationResult {
    const result = initialState.clone();
    result.applySequence(userMoves.join(' '));
    return {
      solved: result.isSolved(),
      remaining: result,
      efficiency: expectedAlg
        ? userMoves.length / expectedAlg.length
        : undefined,
      aufRequired: this.detectAuf(result),
    };
  }
}
```

### 8.2 Full Solve Modular

**Descripción:** Solve completo con objetivos configurables por fase **del método seleccionado**.

**Phase Targeting adaptativo:**
```
Si método = CFOP:
  ┌─ Cross: < 2.0s  ████████░░ (actual: 2.4s)
  ├─ F2L:   < 6.0s  ██████░░░░ (actual: 7.1s)
  ├─ OLL:   < 1.5s  ███████░░░ (actual: 1.8s)
  └─ PLL:   < 1.2s  ████████░░ (actual: 1.5s)

Si método = Roux:
  ┌─ First Block:  < 2.5s  ██████░░░░ (actual: 3.1s)
  ├─ Second Block: < 2.0s  ████████░░ (actual: 2.4s)
  ├─ CMLL:         < 1.5s  ███████░░░ (actual: 1.7s)
  └─ LSE:          < 2.0s  ████████░░ (actual: 2.2s)

Si método = ZZ:
  ┌─ EOLine:  < 3.0s  ██████░░░░ (actual: 3.8s)
  ├─ F2L:     < 6.0s  ████████░░ (actual: 6.8s)
  └─ LL:      < 2.0s  ███████░░░ (actual: 2.3s)
```

**Sub-modos transversales:**
- **Phase Targets**: Objetivos por fase configurable
- **Move Limit**: Resolver en ≤ X movimientos
- **TPS Challenge**: Mantener TPS > X
- **Rotationless**: 0 rotaciones (ZZ por defecto)

### 8.3 Recall & Memorization

**Descripción:** Aprender algoritmos NUEVOS con flujo de 4 pasos.

**Learn Mode (4 steps):**

```
Step 1 ── SHOW ─────────────────────
┌──────────────────────────────────┐
│  Algoritmo: R U R' U R U2 R'    │
│  ┌──────────┐  ┌──────────────┐ │
│  │ Diagrama │  │ Repite 3x   │ │
│  │ del caso │  │ [Click when │ │
│  │          │  │  ready]     │ │
│  └──────────┘  └──────────────┘ │
└──────────────────────────────────┘

Step 2 ── DRILL ────────────────────
┌──────────────────────────────────┐
│  Scramble generado → caso exacto │
│  Algoritmo visible               │
│  ⏱️ (no cronometrado)            │
│  Intento: 2/3  ✅ ✅             │
└──────────────────────────────────┘

Step 3 ── RECALL ──────────────────
┌──────────────────────────────────┐
│  Scramble generado → caso exacto │
│  Algoritmo OCULTO 🔒             │
│  ⏱️ TIMER CORRIENDO              │
│  [Reveal] si no te acuerdas      │
└──────────────────────────────────┘

Step 4 ── VERIFY ──────────────────
┌──────────────────────────────────┐
│  ✅ ¡Correcto! (R U R' U R U2 R')│
│  ⏱️ 2.34s  📊 TPS 3.8           │
│  → Programar revisión SRS en 1d  │
└──────────────────────────────────┘
```

**Flash Recognition Mode:**
- Caso mostrado por 0.5s → se oculta
- Múltiple choice: ¿qué caso era?
- Métrica: recognition time + accuracy

### 8.4 Challenges & Gamification

**Daily Challenges multi-método:**

```typescript
type ChallengeTypeCFOP =
  | 'pll-gauntlet'     // Todos los PLLs seguidos
  | 'oll-marathon'     // X OLLs en Y tiempo
  | 'cross-efficiency' // X solves con ≤ 8 moves de cross
  | 'f2l-lookahead'    // Zero pausas en F2L

type ChallengeTypeRoux =
  | 'cmll-gauntlet'    // Todos los CMLLs seguidos
  | 'block-efficiency'  // X solves con ≤ X moves por bloque
  | 'lse-speedrun'      // LSE completo en < X tiempo

type ChallengeTypeZZ =
  | 'eoline-efficiency' // EO + Line en ≤ X moves
  | 'zzll-marathon'     // X ZZLLs seguidos
  | 'rotationless'      // Solves sin rotaciones
```

**Streaks & Milestones:**
```
🔥 Racha actual: 12 días
🏆 Mejor racha: 47 días

Logros:
┌──────────────────────────────────────────┐
│  🥇 Dominaste 40/57 OLLs (CFOP)         │
│  🥈 100 solves PLL sin fallo  (CFOP)    │
│  🥉 Top 10% en Block Efficiency (Roux)  │
│  🆕 "EOLine Master" — EOLine < 10 moves │
└──────────────────────────────────────────┘
```

### 8.5 Weakness Detection Automática

El sistema analiza los solves REALES del usuario **para el método que usa**:

```typescript
class WeaknessDetector {
  static analyze(solves: Solve[], method: RegisteredMethod): WeaknessReport {
    // Detecta fase más lenta relativa a su media
    // Detecta worst transition entre fases
    // Genera recomendaciones específicas del método
    return {
      methodId: method.methodId,
      slowestPhase: 'OLL',
      worstTransition: 'cross→F2L',
      highRotations: true,
      lowTpsPhase: 'PLL',
      recommendations: [
        {
          mode: TrainingMode.AlgorithmDrill,
          phaseId: 'oll',
          reason: 'OLL es 30% más lento que F2L',
        },
      ],
    };
  }
}
```

---

## 9. Progress Tracking & SRS

### 9.1 ProgressTracker

```typescript
class ProgressTracker {
  async recordAttempt(attempt: TrainingAttempt): Promise<void>;
  
  // Progreso por caso
  getProgress(methodId: string, caseId: string): AlgorithmProgress;
  
  // Progreso por método
  getMethodProgress(methodId: string): MethodProgress;
  
  // Ranking de debilidades por método
  getWeakestAlgorithms(methodId: string, limit: number): AlgorithmProgress[];
  
  // Progreso global
  getGlobalProgress(): GlobalProgress;
}

interface GlobalProgress {
  methods: Record<string, MethodProgress>;  // Progreso por método
  totalTrainingSessions: number;
  totalTrainingSolves: number;
  currentStreak: number;
  bestStreak: number;
}
```

### 9.2 SpacedRepetition (SM-2 adaptado)

```typescript
class SpacedRepetition {
  scheduleNextReview(progress: AlgorithmProgress): number;
  generateDailyQueue(limit?: number): DailyQueueItem[];
}

interface DailyQueueItem {
  methodId: string;
  phaseId: string;
  caseId: string;
  priority: number;
  lastPracticed: number;
  mastery: number;
  reason: 'overdue' | 'weak' | 'new' | 'review';
}
```

**Fórmula de prioridad (unificada):**
```
priority = (1 - mastery) * 0.4 
         + (1 - daysSinceLastReview / 30) * 0.3 
         + (avgTime / bestTime - 1) * 0.2 
         + (failRate) * 0.1
```

**Daily Queue (filtrable por método):**
```
📋 Today's Queue
┌──────────────────────────────────────┐
│  🔴 OLL 21  ── CFOP ── 3d ── 78%   │
│  🟡 CMLL A2 ── Roux ── 2d ── 85%   │
│  🟢 PLL Aa  ── CFOP ── 1d ── 92%   │
│  🆕 EOLine  ── ZZ ── NEW ── Learn   │
└──────────────────────────────────────┘

Filtros: [All] [CFOP] [Roux] [ZZ] [Petrus]
```

### 9.3 Base de datos

```typescript
// Schema en IndexedDB (vía database package)
interface TrainingProgressRow {
  userId: string;
  methodId: string;          // ← Nuevo
  phaseId: string;           // ← Nuevo
  caseId: string;
  attempts: number;
  successes: number;
  bestTime: number;
  totalTime: number;
  lastPracticed: number;
  mastery: number;
  easeFactor: number;
  interval: number;
  nextReview: number;
  history: string;           // JSON de últimos N intentos
}

interface TrainingSessionRow {
  id: string;
  userId: string;
  methodId: string;          // ← Nuevo
  phaseId: string;           // ← Nuevo
  mode: string;
  startedAt: number;
  endedAt: number;
  attemptIds: string[];
  config: string;
}
```

---

## 10. UI/UX del Training Dashboard

### 10.1 Vista Principal: Method Grid

```
┌──────────────────────────────────────────────────────────────────┐
│  🏋️ TRAINING  │  [📊 Overview] [📋 Queue] [🏆 Challenges]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── Select your method ──────────────────────────────────┐    │
│  │                                                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │    │
│  │  │  🟦     │  │  🟩     │  │  🟨     │  │  🟪   │ │    │
│  │  │  CFOP   │  │  Roux   │  │   ZZ    │  │ Petrus│ │    │
│  │  │  80%    │  │  70%    │  │  30%    │  │  45%  │ │    │
│  │  │ ████████│  │ ███████ │  │ ███     │  │ █████ │ │    │
│  │  │         │  │         │  │         │  │       │ │    │
│  │  │ PB: 8.2s│  │ PB: 9.1s│  │ PB: 12s│  │ PB: 14│ │    │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │    │
│  │                                                         │    │
│  │  [Start Full Solve] [Quick Drill by Method ▼]          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─── Today's Queue ────────────────────────────────────────┐   │
│  │  🔴 OLL 21 ── CFOP ── 3d ago ── 78%  [Practice Now]    │   │
│  │  🟡 CMLL A2 ── Roux ── 2d ago ── 85%  [Practice Now]   │   │
│  │  🆕 EOLine ── ZZ ── NEW ── [Learn Mode]                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── Daily Challenge ───────────────────────────────────────┐  │
│  │  🏆 "PLL Gauntlet" (CFOP) — 21 PLLs < 55s 🥈            │  │
│  │  [Start Challenge]                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── AI Recommendation ─────────────────────────────────────┐  │
│  │  💡 "Tu OLL (CFOP) es 30% más lento que tu F2L.          │  │
│  │      Tienes 17 OLLs sin dominar. Prueba 15 min de         │  │
│  │      OLL Drill al día."                                   │  │
│  │  [Start Training Plan →]                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 10.2 Vista por Método: Phase Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  🟦 CFOP  │  80% global  │  🔥 12d streak  │  PB: 8.2s        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── Phases ───────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  ┌── Cross ──┐  ┌── F2L ───┐  ┌── OLL ───┐  ┌── PLL ─┐│   │
│  │  │ ████████  │  │ ██████   │  │ ██████   │  │ ████████││   │
│  │  │ 85%       │  │ 75%      │  │ 60%      │  │ 90%     ││   │
│  │  │ avg 2.1s  │  │ avg 6.5s │  │ avg 1.8s │  │ avg 1.2s││   │
│  │  │           │  │          │  │           │  │         ││   │
│  │  │ [Train]   │  │ [Train]  │  │ [Drill]  │  │ [Drill] ││   │
│  │  │ [Stats]   │  │ [Stats]  │  │ [Recall] │  │ [Recall]││   │
│  │  └───────────┘  └──────────┘  └──────────┘  └─────────┘│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── Phase Targets ─────────────────────────────────────────┐  │
│  │  Cross: <2.0s ████████░░ (2.4s)    PLL: <1.2s ████████░░ │  │
│  │  F2L:  <6.0s ██████░░░░ (7.1s)    OLL: <1.5s ███████░░░ │  │
│  │  Total: <10.7s  Actual: 12.8s  [Full Solve →]            │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 10.3 Navegación Algorithms ↔ Training

**Desde Algorithms tab:**
1. Ves un caso en la grid con su método/fase (e.g., OLL 21 ∈ CFOP)
2. Click → se abre detail panel
3. El detail panel tiene **"Practice This Case"**
4. Click → navega al Training tab con:
   - Método: CFOP
   - Fase: OLL
   - Modo: Algorithm Drill (Single)
   - Caso preseleccionado: OLL 21
   - SetupScramble cargado

**Botón en CaseDetailPanel:**
```
┌─────────────────────────────────────┐
│  Algorithms for this case (3)      │
│                                     │
│  ┌─── Alg 1 (default) ──────────┐  │
│  │  R U R' U R U2 R'     ✅    │  │
│  │  HTM: 7  QTM: 11            │  │
│  │  Method: CFOP › OLL         │  │  ← Nuevo: muestra método
│  │                              │  │
│  │  [▶ Practice This Algorithm] │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Quick Drill Button:**
```
┌──────────────────────────────────────────────────┐
│  [Quick Drill ▼]                                 │
│  ├── CFOP › Random OLL                           │
│  ├── CFOP › Random PLL                           │
│  ├── Roux › Random CMLL                          │
│  ├── ZZ   › Random OCLL                          │
│  └── Petrus › Random COLL                        │
└──────────────────────────────────────────────────┘
```

---

## 11. Integración con el Ecosistema

### 11.1 Análisis post-solve (Epic 5)

El training NO reemplaza el análisis post-solve. Se alimentan mutuamente:

```
Análisis (Epic 5)                      Training (v2 Method-First)
      │                                      │
      │   WeaknessDetector.analyze() ────────┤
      │   (detecta fases lentas,             │
      │    tiempos de transición,            │
      │    TPS bajo por fase,                │
      │    identifica método del usuario)    │
      │                                      │
      │   Recomendación:                     │
      │   "CFOP › OLL lento" ─────────────>  │  Genera sesión
      │                                      │  de OLL drill (CFOP)
      │                           ──────────>│  
      │   Nuevos solves de training          │  Se guardan como
      │   alimentan el análisis              │  solves normales
      │   (con methodId y phaseId)            │
```

### 11.2 Method Detection Automática

El sistema puede **detectar qué método usa el usuario** analizando sus solves:

- Si usa CFOP: busca patrones de cross + F2L + OLL + PLL
- Si usa Roux: busca bloques + CMLL + LSE
- Si usa ZZ: busca EO + F2L sin rotaciones

Esto permite:
1. Sugerir el método correcto automáticamente
2. Adaptar las recomendaciones del AI Coach
3. Configurar los phase targets automáticos

### 11.3 Smart Cube

- Todo el training funciona con smart cube (BLE tracking)
- Y también con timer manual
- Detección automática: si smart cube conectado → tracking de movimientos reales
- Si manual → solo tiempo + auto-verificación post-solve

### 11.4 AI Coach (Epic 8)

El AI Coach consumirá:
- WeaknessReport (con methodId) → recomendaciones en lenguaje natural
- ProgressTracker (por método) → planes semanales personalizados
- DailyQueue → sugerir qué practicar hoy, filtrado por método principal

---

## 12. Plan de Implementación

### Fase 1: Core Engine + Method Registry (2-3 semanas)

| Componente | Descripción | Dependencias |
|---|---|---|
| `MethodRegistry.ts` | Registro central de métodos + fases | algorithm-db (methodRegistry.ts) |
| `TrainingEngine` | Core que orquesta modos | method-registry, math-core |
| `TrainingSession` | Manejo de sesiones multi-método | TrainingEngine |
| `CaseVerifier` | Verificación de casos (genérico) | math-core (CubeState) |
| `SetupGenerator` | Generación de scrambles | algorithm-db, solver-engine |

### Fase 2: Método CFOP completo (2 semanas)

| Componente | Descripción |
|---|---|
| `CFOPMethod.ts` | Definición de fases + config | 
| `PhaseTrainer` (Cross) | Entrenamiento de cross (todos los sub-modos) |
| `PhaseTrainer` (F2L) | Slots, look-ahead, metronome |
| `AlgorithmDrill` (OLL/PLL) | Drill genérico con subsets CFOP |
| `FullSolveTrainer` | Solve completo con phase targets CFOP |

### Fase 3: Métodos Roux + ZZ + Petrus (2-3 semanas)

| Componente | Descripción |
|---|---|
| `RouxMethod.ts` | First Block, Second Block, CMLL, LSE |
| `ZZMethod.ts` | EOLine, F2L (RUL), LL |
| `PetrusMethod.ts` | 2x2x2, 2x2x3, EO, F2L, LL |
| PhaseTrainers específicos | Block building, EO, LSE |

### Fase 4: Progress Tracking + SRS (1 semana)

| Componente | Descripción |
|---|---|
| `ProgressTracker.ts` | Registro multi-método |
| Schema database | IndexedDB con methodId + phaseId |
| `SpacedRepetition.ts` | SM-2 adaptado (genérico) |
| `WeaknessDetector.ts` | Análisis multi-método |

### Fase 5: Recall + Challenges (1-2 semanas)

| Componente | Descripción |
|---|---|
| `RecallTrainer.ts` | Learn, Recall, Flash (genérico) |
| `ChallengeGenerator.ts` | Challenges multi-método |
| Daily/Streaks/Achievements | UI + tracking |

### Fase 6: UI Completa (2-3 semanas)

| Componente | Descripción |
|---|---|
| Training Dashboard UI | Method grid + phase cards + SRS queue |
| Method Phase View | Tabs de fases + targets |
| Mode Views | Drill, Full Solve, Recall, Challenges |
| Navigation bridge | Algorithms ↔ Training bi-direccional |

### Total estimado: 10-16 semanas

---

## Referencias

- [PRD — Training System](../00-product/PRD.md)
- [Master Roadmap — Epic 6](../01-roadmap/Master_Roadmap.md)
- [Method Registry](../../packages/algorithm-db/src/methodRegistry.ts)
- [PhaseSplitter (analysis-engine)](../../packages/analysis-engine/src/phases/PhaseSplitter.ts)
- [TDD-04-Solver-Engine](../05-tdd/TDD-04-Solver-Engine.md)
- [v1 Original — Training Plan](./README.md)
