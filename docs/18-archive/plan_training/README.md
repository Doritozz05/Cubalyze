# CubeForge — Plan de Entrenamiento (Training System)

> **Documento de diseño del sistema de entrenamiento.**
> Fecha: Julio 2026
> Estado: Implementación base completada (2026-08) — ver [REFACTOR_PLAN.md](./REFACTOR_PLAN.md)
> para el estado fase a fase (Fases 1-6 ejecutadas: métricas honestas, baseline v2,
> tipos unificados, catálogo real, timer compartido, `useTrainingEngine` adoptado en
> Drill/Recognize + vistas thin (Plain/Blind/LSE/EO) vía `usePracticeSession`, vistas
> partidas, `masteryLevel` de 5 niveles). Pendiente: verificación browser final.

---

## Índice

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Modo 1: Algorithm Drill](#3-modo-1-algorithm-drill)
4. [Modo 2: Cross Trainer](#4-modo-2-cross-trainer)
5. [Modo 3: F2L Trainer](#5-modo-3-f2l-trainer)
6. [Modo 4: Full Solve Modular](#6-modo-4-full-solve-modular)
7. [Modo 5: Recall &amp; Memorization](#7-modo-5-recall--memorization)
8. [Modo 6: Challenges &amp; Gamification](#8-modo-6-challenges--gamification)
9. [Progress Tracking &amp; SRS](#9-progress-tracking--srs)
10. [UI/UX del Training Tab](#10-uiux-del-training-tab)
11. [Integración con el ecosistema](#11-integración-con-el-ecosistema)
12. [Plan de Implementación](#12-plan-de-implementación)

---

## 1. Visión General

El sistema de entrenamiento es el **core value proposition** de CubeForge según el PRD. Unifica los 5 layers del producto: timer, smart cube, análisis, algoritmo DB, y entrenamiento en una experiencia cohesiva.

### Principios de diseño

1. **No es un catálogo** — no basta con ver algoritmos, hay que practicarlos
2. **Datos reales del usuario** — el entrenamiento se alimenta de los solves reales, no de supuestos
3. **Progresión natural** — del drill aislado al solve completo con phase targets
4. **Agujeros detectados automáticamente** — el sistema identifica debilidades sin que el usuario las configure
5. **Gamificación inteligente** — challenges diarios, streaks, sin grind vacío

### Entry points

| Desde                    | Acción                                    | Resultado                                  |
| ------------------------ | ------------------------------------------ | ------------------------------------------ |
| **Algorithms tab** | Click en cualquier caso → "Practice This" | Training tab abierto con ese caso preset   |
| **Training tab**   | Navegación directa                        | Dashboard completo con métodos y progreso |
| **Insights**       | Click en "Improve this phase"              | Training mode específico para fase débil |
| **AI Coach**       | Recomendación automática                 | Training plan personalizado                |

---

## 2. Arquitectura del Sistema

```
packages/training/src/
├── TrainingEngine.ts              ← Core: orquesta modos de entrenamiento
├── modes/
│   ├── AlgorithmDrill.ts          ← Modo 1: drill de algoritmos
│   ├── CrossTrainer.ts            ← Modo 2: cross (plain, X, CN, blind)
│   ├── F2LTrainer.ts              ← Modo 3: F2L slots, look-ahead
│   ├── FullSolveTrainer.ts        ← Modo 4: solve completo con targets
│   ├── RecallTrainer.ts           ← Modo 5: memorización + SRS
│   └── ChallengeGenerator.ts      ← Modo 6: challenges diarios
├── progress/
│   ├── ProgressTracker.ts         ← Almacena tiempos/accuracy por caso
│   ├── SpacedRepetition.ts        ← SM-2 adaptado a speedcubing
│   └── WeaknessDetector.ts        ← Analiza solves reales → recomienda
├── verification/
│   ├── CaseVerifier.ts            ← ¿El usuario resolvió el caso correcto?
│   └── StateComparer.ts           ← Compara estado esperado vs real
└── generation/
    ├── SetupGenerator.ts          ← Genera scramble para caso específico
    └── ScenarioBuilder.ts         ← Construye escenarios multi-fase
```

### Dependencias (ya implementadas)

```
training → algorithm-db (schema, seed data, caseGenerator)
         → math-core (CubeState, StateMatcher, PhaseMask)
         → solver-engine (Min2PhaseSolver)
         → analysis-engine (PhaseSplitter, metrics)
         → timer-engine
         → state (user preferences, session management)
```

### Interfaces clave

```typescript
// Resultado de un intento de entrenamiento
interface TrainingAttempt {
  id: string;
  userId: string;
  caseId: string;
  mode: TrainingMode;
  timestamp: number;
  timeMs: number;
  moves: string[];
  tps: number;
  correct: boolean;        // ¿Resolvió el caso correcto?
  expectedAlg: string[];   // Algoritmo que debía ejecutar
  actualState: string;     // Facelet del estado resultante
  expectedState: string;   // Facelet del estado esperado
  hintsUsed: number;
}

// Progreso por algoritmo
interface AlgorithmProgress {
  caseId: string;
  attempts: number;
  successes: number;
  bestTime: number;
  avgTime: number;
  lastPracticed: number;
  mastery: number;         // 0-100 basado en tiempo + consistencia
  nextReview: number;      // Timestamp para SRS
}

// Sesión de entrenamiento
interface TrainingSession {
  id: string;
  mode: TrainingMode;
  startedAt: number;
  endedAt?: number;
  attempts: TrainingAttempt[];
  config: TrainingConfig;
}
```

[Ver documento completo de interfaces →](./INTERFACES.md)
[Ver documento de arquitectura detallada →](./ARCHITECTURE.md)

---

## 3. Modo 1: Algorithm Drill

### Descripción

El equivalente a csTimer trainer, pero con verificación automática, tracking de progreso, y múltiples variantes.

### Sub-modos

| Sub-modo             | Descripción                                     | Métricas clave                   |
| -------------------- | ------------------------------------------------ | --------------------------------- |
| **Single**     | Practica un caso específico hasta dominarlo     | Tiempo, TPS, accuracy, tendencia  |
| **Random**     | Saca casos aleatorios del subset                 | Media, desviación, tasa de fallo |
| **Sequential** | Recorre todos los casos del subset en orden      | Cobertura, progreso               |
| **Weakness**   | Prioriza casos con peor tiempo/highest fail rate | Mejora vs baseline                |

SELECION DE ALGS tambien.

### Flujo

1. Usuario selecciona: subset (OLL/PLL/COLL/CMLL/F2L/ZBLL)
2. Filtros opcionales: dificultad, tags, casos específicos, solo no dominados
3. Sistema genera scramble que lleva al caso exacto
4. Timer corre (manual o smart cube)
5. Usuario ejecuta algoritmo + AUF
6. Verificación automática:
   - ¿Quedó el cubo resuelto?
   - ¿Era el algoritmo correcto para ese caso?
   - Si falla: ¿qué caso resultó en su lugar?
7. Feedback inmediato: tiempo, TPS, eficiencia (HTM vs esperado)
8. Se guarda en progreso

### UX

```
┌──────────────────────────────────────────────────────┐
│  ALGORITHM DRILL  │  OLL  │  21/57 mastered  │  85%  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐  ┌────────────────────────┐   │
│  │                  │  │  R U R' U R U2 R'      │   │
│  │   Diagrama 2D    │  │                        │   │
│  │   del caso       │  │  [Show/Hide]  🔒       │   │
│  │                  │  │  [☐ Reveal if fail]    │   │
│  │   OLL 21         │  │                        │   │
│  │   H case         │  │  💡 [AI Hint]          │   │
│  └──────────────────┘  │                        │   │
│                         │  Setup: R U R' U'     │   │
│  ⏱️ 1.24s              │                        │   │
│  📊 TPS 8.1  ✅        │  [Skip]  [Done]        │   │
│                         └────────────────────────┘   │
│                                                      │
│  Session: 15/50  │  🔥 Streak: 7 correct  │  ⏱ Avg: 1.31s
│                                                      │
│  ┌─── Últimos intentos ───────────────────────────┐ │
│  │  ✅ 1.24s  ✅ 1.31s  ❌ 1.89s  ✅ 1.18s       │ │
│  │  ✅ 1.22s  ✅ 1.35s  ✅ 1.28s  ✅ 1.19s       │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Verificación de casos

```typescript
class CaseVerifier {
  /**
   * Verifica si el usuario resolvió el caso correctamente.
   * @param initialScramble - Scramble que llevó al caso
   * @param userMoves - Movimientos ejecutados por el usuario
   * @param expectedAlg - Algoritmo esperado (opcional, para comparación)
   * @returns Resultado de la verificación
   */
  static verify(
    initialState: CubeState,  // Estado después del setupScramble
    userMoves: string[],
    expectedAlg?: string[],
  ): VerificationResult {
    const result = initialState.clone();
    result.applySequence(userMoves.join(' '));
  
    return {
      solved: result.isSolved(),
      remaining: result,  // Qué estado quedó si no está resuelto
      efficiency: expectedAlg 
        ? userMoves.length / expectedAlg.length 
        : undefined,
      aufRequired: this.detectAuf(result),
    };
  }
}
```

---

## 4. Modo 2: Cross Trainer

### Descripción

La cruz es la fase más infravalorada y donde más tiempo se puede ganar. Múltiples sub-modos enfocados en dominio de cross.

### 4a. Plain Cross

**Flujo:**

1. Scramble completo
2. Timer corre mientras resuelves solo la cruz
3. Sistema detecta automáticamente cuándo la cruz está completa (PhaseSplitter)
4. Mide: tiempo, movimientos, eficiencia vs óptimo

**Métricas:**

- Movimientos vs óptimo (Min2Phase resuelve solo la cruz)
- Tiempo de inspección (primer movimiento)
- TPS durante cross
- Eficiencia: `(optimalMoves / actualMoves) * 100`

**Características:**

- 🔍 **Show Optimal**: calcula con Min2Phase la mejor cruz posible
- 💡 **AI Hint**: "Intenta poner la arista BL con R' F' en vez de L' B" (detecta redundancia)
- ✅ **Objetivo**: ≤ 8 movimientos, < 2s

### 4b. X-Cross (Cross + 1 F2L Pair)

**Flujo:**

1. Scramble completo
2. Resolver cruz + un par F2L simultáneamente
3. Sistema detecta cuándo se completó cruz + 1 slot

**Métricas:**

- Tiempo total
- Movimientos extra vs cross plain
- Relación tiempo extra vs ahorro en F2L

### 4c. Color-Neutral (CN) Cross

**Flujo:**

1. Scramble mostrado SIN indicar cross face
2. Usuario elige qué cara usar
3. Sistema evalúa: ¿era la óptima? ¿tiempo de decisión?

**Métricas:**

- Tiempo de reconocimiento (scramble → primer turn)
- Cross face elegida vs optimal
- Precisión de la decisión

### 4d. Cross + Transition

**Flujo:**

1. Scramble completo
2. Resolver cruz
3. Sistema cronometra: cross → **pausa hasta primer par F2L**
4. Objetivo: < 0.3s de transición

**Métrica estrella:** `cross_to_f2l_pause`

### 4e. Blind Cross

**Flujo:**

1. 15s de inspección (WCA-style)
2. Usuario cierra los ojos / aparta la vista
3. Resuelve la cruz sin mirar
4. Sistema mide precisión + correcciones necesarias

**Métricas:**

- ¿Cruz completada correctamente?
- Número de correcciones
- Tiempo vs regular cross

### UX Cross Trainer

```
┌──────────────────────────────────────────────────────┐
│  CROSS TRAINER  │  Session: 15 solves               │
├──────────────────────────────────────────────────────┤
│  [Plain] [X-Cross] [CN] [Blind] [Transition]         │
├──────────────────────────────────────────────────────┤
│  Scramble: F R U2 L' B R' D' F2 L2 B2 R2...        │
│                                                      │
│  ⏱️ 2.34s  │  Moves: 9  │  Optimal: 7  │  Eff: 78% │
│  TPS: 3.8  │  Inspection: 1.2s  │  Pause→F2L: 0.4s │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  🔍 Show Optimal Solution                     │   │
│  │  ┌────────────────────────────────────────┐  │   │
│  │  │  D' R' F D2 R' F R   (7 HTM)          │  │   │
│  │  │  Tu solución usa R2 F' R2 → prueba     │  │   │
│  │  │  F' D' R' D2 (3 moves menos)           │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Progreso: ████████░░ 72% (8 solves ≤ 8 moves)     │
└──────────────────────────────────────────────────────┘
```

---

## 5. Modo 3: F2L Trainer

### Descripción

F2L = 60% del tiempo total. Múltiples dimensiones de entrenamiento.

### 5a. Slot Drills

**Sub-modos:**

- **Single slot**: practica un slot específico (FR, FL, BR, BL)
- **Front slots**: solo FR + FL
- **Back slots**: solo BR + BL (los más difíciles)
- **Random slot**: slot aleatorio cada vez

**Métricas:**

- Reconocimiento: tiempo hasta primer move del par
- Ejecución: tiempo del par completo
- Eficiencia: movimientos del par vs óptimo
- TPS por par

### 5b. F2L Case Recognition

**Flujo:**

1. Se muestra el estado del cubo (o diagrama 2D)
2. Usuario debe identificar qué caso F2L es
3. Timer de reconocimiento (no de ejecución)
4. Múltiple choice o input libre

**Objetivo:** Romper el hábito de "pensar mientras turn" — reconocer el caso antes de tocar el cubo.

### 5c. Look-Ahead Training ⭐ (VENTAJA COMPETITIVA)

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
- Tracking de: pares correctos, correcciones necesarias

#### Transition Zone

- Mide el gap entre cross→F2L y entre cada par F2L
- **Heatmap** de dónde pierdes tiempo en las transiciones
- Objetivo: < 0.3s entre cada par

### 5d. Multi-Slot / Advanced

- **Cross + 2 pares**: resolver cruz + 2 pares específicos
- **Pseudo-slotting**: entrenamiento para pares rotados
- **Keyhole**: técnicas de keyhole para casos difíciles
- **Empty slot**: usar slot vacío como buffer

```
┌──────────────────────────────────────────────────────┐
│  F2L TRAINER  │  Look-Ahead  │  Metronome: 120 BPM  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─── Metrónomo ─────────────────────────────────┐   │
│  │  🥁  🥁  🥁  🥁  🥁  🥁  🥁  🥁  🥁  🥁    │   │
│  │  🔴 ❌ 🔴 ✅ 🔴 ✅ 🔴 ✅ 🔴 ❌ 🔴 ✅       │   │
│  │  On-beat: 7/10  │  Avg TPS: 1.9               │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ⏱️ 8.45s  │  Pairs: 4/4  │  Transition: 0.28s avg  │
│  Pause ratio: 12%  │  Look-ahead score: B+           │
│                                                      │
│  💡 "Tu pausa entre pair 2 y 3 fue de 0.8s —        │
│      enfócate en tracking del próximo par mientras   │
│      ejecutas el actual."                            │
└──────────────────────────────────────────────────────┘
```

---

## 6. Modo 4: Full Solve Modular

### Descripción

Solve completo pero con objetivos configurables por fase.

### 6a. Phase Targeting

```
Selecciona objetivos por fase:
┌─ Cross:  < 2.0s  ──  ████████░░  (actual: 2.4s)
├─ F2L:    < 6.0s  ──  ██████░░░░  (actual: 7.1s)
├─ OLL:    < 1.5s  ──  ███████░░░  (actual: 1.8s)
└─ PLL:    < 1.2s  ──  ████████░░  (actual: 1.5s)
```

**Flujo:**

1. Usuario configura targets por fase
2. Scramble → solve completo
3. Sistema descompone: Cross ✅ / F2L ❌ / OLL ✅ / PLL ❌
4. Muestra dónde se falló el target

**Visualización:**

- Verde: fase dentro del target
- Rojo: fase fuera del target
- Barra de tiempo total vs objetivo

### 6b. Move Limit

- "Resuelve el cubo en menos de 55 movimientos"
- Sistema trackea HTM en vivo
- Warning visual cuando te estás pasando
- Post-solve: eficiencia de movimientos

### 6c. TPS Challenge

- "Mantén TPS > 8.0 durante todo el solve"
- Muestra TPS en vivo durante la ejecución
- Post-solve: dónde bajó el TPS (fase específica)
- Medal: Oro > 10 TPS, Plata > 8 TPS, Bronce > 6 TPS

### 6d. Rotationless

- Penalización por rotaciones de cubo (x/y/z)
- Objetivo: 0 rotaciones
- Tracking: número de rotaciones, tiempo perdido estimado

---

## 7. Modo 5: Recall & Memorization

### Descripción

Enfocado en aprender algoritmos NUEVOS, no en speed.

### 5a. Learn Mode (4 steps)

```
Step 1 ── Show ─────────────────────
┌──────────────────────────────────┐
│  Algoritmo: R U R' U R U2 R'    │
│  ┌──────────┐  ┌──────────────┐ │
│  │ Diagrama │  │ Repite 3x   │ │
│  │ del caso │  │ [Click when │ │
│  │          │  │  ready]     │ │
│  └──────────┘  └──────────────┘ │
└──────────────────────────────────┘

Step 2 ── Drill ────────────────────
┌──────────────────────────────────┐
│  Scramble generado → caso exacto │
│                                  │
│  Algoritmo visible abajo         │
│  ⏱️ (no cronometrado)            │
│                                  │
│  Intento: 2/3  ✅ ✅             │
└──────────────────────────────────┘

Step 3 ── Recall ──────────────────
┌──────────────────────────────────┐
│  Scramble generado → caso exacto │
│                                  │
│  Algoritmo OCULTO                │
│  ⏱️ TIMER CORRIENDO              │
│                                  │
│  [Reveal] si no te acuerdas      │
│  (cuenta como hint, sin penalizar│
│   tiempo pero sí accuracy)       │
└──────────────────────────────────┘

Step 4 ── Verify ──────────────────
┌──────────────────────────────────┐
│  ✅ ¡Correcto! (R U R' U R U2 R')│
│  ⏱️ 2.34s  📊 TPS 3.8           │
│                                  │
│  → Algoritmo aprendido           │
│  → Programar revisión SRS        │
└──────────────────────────────────┘
```

### 5b. Spaced Repetition (SM-2 adaptado)

**Factores de scheduling:**

- Tiempo del último intento
- Accuracy (correcto/incorrecto)
- TPS relativo a tu media
- Días desde último practice
- Número de recalls exitosos consecutivos

**Fórmula de prioridad:**

```
priority = (1 - mastery) * 0.4 
         + (1 - daysSinceLastReview / 30) * 0.3 
         + (avgTime / bestTime - 1) * 0.2 
         + (failRate) * 0.1
```

**Daily Queue:**

```
📋 Today's Training Queue
┌──────────────────────────────────────┐
│  🔴 OLL 21  ── Last: 3d ago  ── 78% │  ← High priority
│  🟡 PLL Aa  ── Last: 2d ago  ── 85% │
│  🟢 OLL 5   ── Last: 1d ago  ── 92% │  ← Low priority
│  🆕 OLL 33  ── New! Learn mode       │  ← New algorithm
└──────────────────────────────────────┘
```

### 5c. Recognition Training (Flash Mode)

- Te muestran el caso (diagrama o cubo virtual) por 0.5s
- Debes identificar qué caso es (múltiple choice o input)
- **Métrica**: recognition time + accuracy
- Rompe el cuello de botella de "reconocer el caso" vs "ejecutar el alg"

---

## 8. Modo 6: Challenges & Gamification

### 8a. Daily Challenges

```typescript
interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  targets: ChallengeTier[];
  generated: number;     // Timestamp
  expires: number;       // Timestamp (24h)
}

type ChallengeType =
  | 'pll-gauntlet'     // Todos los PLLs seguidos
  | 'oll-marathon'     // X OLLs en Y tiempo
  | 'cross-efficiency' // X solves con ≤ 8 moves de cross
  | 'tps-burst'        // Mantener TPS > X por Y solves
  | 'look-ahead'       // Zero pausas en Y solves
  | 'no-rotations'     // Resolver sin rotaciones
  | 'recall'           // Ejecutar X algoritmos de memoria
  | 'streak'           // Mayor racha de solves correctos
  | 'custom';          // Definido por el usuario
```

**Ejemplos:**

```
🏆 "PLL Gauntlet" — 21 PLLs seguidos
   Oro: < 45s  |  Plata: < 55s  |  Bronce: < 70s
   Tu récord: 52.3s (Plata) 🥈

🏆 "Cross Efficiency" — 20 solves
   Oro: media < 2.0s  |  Plata: < 2.5s  |  Bronce: < 3.0s

🏆 "Zero Pause" — 10 solves
   Sin pausas > 0.3s entre fases
```

### 8b. Streaks & Milestones

```
🔥 Racha actual: 12 días
🏆 Mejor racha: 47 días

Logros:
┌──────────────────────────────────────────┐
│  🥇 Dominaste 40/57 OLLs                │
│  🥈 100 solves de PLL sin fallo         │
│  🥉 Top 10% en Cross eficiencia         │
│  🆕 "Speed Demon" — TPS > 10 en OLL     │
└──────────────────────────────────────────┘
```

### 8c. Weakness Detection Automática

El sistema analiza los solves REALES del usuario (no solo training) y genera un plan personalizado:

```typescript
class WeaknessDetector {
  /**
   * Analiza los últimos N solves y detecta debilidades.
   */
  static analyze(solves: Solve[]): WeaknessReport {
    return {
      slowestPhase: 'OLL',         // Fase más lenta relativa a su media
      worstTransition: 'cross→F2L', // Transición más lenta
      highRotations: true,          // Muchas rotaciones en F2L
      lowTpsPhase: 'PLL',           // TPS más bajo en esta fase
      recommendations: [
        {
          mode: TrainingMode.AlgorithmDrill,
          subset: 'OLL',
          reason: 'OLL es 30% más lento que F2L',
        },
        {
          mode: TrainingMode.CrossTransition,
          reason: 'Transición Cross→F2L promedio 0.8s',
        },
      ],
    };
  }
}
```

**Training Plan generado:**

```
📋 TU PLAN DE ENTRENAMIENTO (generado por análisis de datos reales)
Semana 1: Cross eficiencia (8 solves/día)
Semana 2: Cross→F2L transitions (10 solves/día)
Semana 3: OLL recognition drill (15 min/día)
Semana 4: Full solve con phase targets
```

---

## 9. Progress Tracking & SRS

### 9.1 ProgressTracker

```typescript
class ProgressTracker {
  /** Registra un intento y actualiza mastery del algoritmo. */
  async recordAttempt(attempt: TrainingAttempt): Promise<void>;
  
  /** Obtiene progreso de un algoritmo específico. */
  getProgress(caseId: string): AlgorithmProgress;
  
  /** Obtiene ranking de algoritmos por debilidad. */
  getWeakestAlgorithms(limit: number): AlgorithmProgress[];
  
  /** Obtiene progreso global del usuario. */
  getGlobalProgress(): GlobalProgress;
}

interface GlobalProgress {
  totalAlgorithms: number;
  masteredAlgorithms: number;  // mastery > 80
  learningAlgorithms: number;  // mastery between 30-80
  newAlgorithms: number;       // mastery < 30 or never attempted
  
  // Por subset
  bySubset: Record<string, SubsetProgress>;
  
  // Sesiones completadas
  totalTrainingSessions: number;
  totalTrainingSolves: number;
  currentStreak: number;
  bestStreak: number;
}
```

### 9.2 SpacedRepetition (SM-2 adaptado)

```typescript
class SpacedRepetition {
  /**
   * Calcula la próxima fecha de revisión para un algoritmo
   * usando SM-2 adaptado a speedcubing.
   */
  scheduleNextReview(progress: AlgorithmProgress): number;
  
  /**
   * Genera la cola de hoy: algoritmos a repasar ordenados por prioridad.
   */
  generateDailyQueue(limit?: number): AlgorithmProgress[];
  
  /**
   * Calcula el factor de facilidad (EF) para un algoritmo.
   * Baja si el usuario falla, sube si acierta consistentemente.
   */
  computeEaseFactor(history: TrainingAttempt[]): number;
}
```

**Adaptaciones SM-2 para speedcubing:**

- Calificación no es 0-5 subjetiva, sino basada en datos reales (tiempo, accuracy, TPS)
- "Acierto" = cubo resuelto + algoritmo correcto
- Factor extra: consistencia (desviación estándar de tiempos recientes)
- Si TPS mejora significativamente → espaciar más

### 9.3 Base de datos

```typescript
// Schema en IndexedDB (vía database package)
interface TrainingProgressRow {
  userId: string;
  caseId: string;
  attempts: number;
  successes: number;
  bestTime: number;
  totalTime: number;          // Para calcular media sin re-sumarlos
  lastPracticed: number;
  mastery: number;
  easeFactor: number;
  interval: number;           // Días hasta próxima revisión
  nextReview: number;
  history: string;            // JSON serializado de últimos N intentos
}

interface TrainingSessionRow {
  id: string;
  userId: string;
  mode: string;
  subsetId: string;
  startedAt: number;
  endedAt: number;
  attemptIds: string[];       // IDs de los intentos de la sesión
  config: string;             // JSON serializado
}
```

---

## 10. UI/UX del Training Tab

### 10.1 Training Dashboard (vista principal)

```
┌───────────────────────────────────────────────────────────────┐
│  🏋️ TRAINING  │  [Algorithms] [Cross] [F2L] [Recall] [Full] │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  📊 Overview                                            │ │
│  │                                                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ ││
│  │  │  CFOP    │  │  Roux    │  │  ZZ      │  │ Petrus │ ││
│  │  │  80%     │  │  70%     │  │  30%     │  │  -     │ ││
│  │  │ ▌▌▌▌▌▌▌▌│  │ ▌▌▌▌▌▌▌ │  │ ▌▌▌      │  │        │ ││
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ ││
│  │                                                         │ │
│  │  🔥 12-day streak  │  📈 +15% this week  │  🏆 47 PB   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  📋 Today's Queue (SRS)                                 │ │
│  │                                                         │ │
│  │  🔴 OLL 21 ─── 3d ago ─── 78% ─── [Practice Now]      │ │
│  │  🟡 PLL Aa ─── 2d ago ─── 85% ─── [Practice Now]      │ │
│  │  🟢 OLL 5  ─── 1d ago ─── 92% ─── [Practice Now]      │ │
│  │  🆕 OLL 33 ─── NEW ─── [Learn Mode]                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  🏆 Daily Challenge                                     │ │
│  │  "PLL Gauntlet — 21 PLLs seguidos bajo 55s" 🥈        │ │
│  │  [Start Challenge]                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  💡 AI Recommendation                                   │ │
│  │  "Tu OLL es 30% más lento que tu F2L y tienes 17 OLLs  │ │
│  │   sin dominar. Prueba 15 min de OLL Drill al día."     │ │
│  │  [Start Training Plan →]                                │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### 10.2 Sub-modes detail

Cuando entras a un modo específico desde los tabs, se muestra:

```
┌─ ALGORITHMS ──────────────────────────────────────────┐
│  Subset: OLL  │  Filter: [All] [Not Mastered] [New]  │
│  ┌──────────────────────────────────────────────┐     │
│  │  Grid de casos (similar al practice actual)   │     │
│  │  Cada caso muestra: diagrama + mastery %     │     │
│  │  Click → detail panel con [Practice This]     │     │
│  └──────────────────────────────────────────────┘     │
│  [Quick Drill — Random OLL]                         │
└──────────────────────────────────────────────────────┘

┌─ CROSS ────────────────────────────────────────────────┐
│  Mode: [Plain] [X-Cross] [CN] [Blind] [Transition]   │
│  Stats: 85 solves │ 68% ≤ 8 moves │ avg 2.1s        │
│  [Start Cross Session]                                │
└──────────────────────────────────────────────────────┘

┌─ F2L ──────────────────────────────────────────────────┐
│  Mode: [Slots] [Recognition] [Look-Ahead] [Advanced]  │
│  Look-Ahead sub: [Metronome] [Slow-Mo] [Blind] [Trans]│
│  [Start F2L Session]                                  │
└──────────────────────────────────────────────────────┘
```

### 10.3 Navigation desde Algorithms

Cuando estás en el **Algorithms tab**:

1. Ves un caso en la grid
2. Haces click → se abre el detail panel
3. El detail panel tiene un botón **"Practice This Case"**
4. Click → navega al Training tab con:
   - Modo: Algorithm Drill
   - Caso preseleccionado
   - SetupScramble cargado y listo
   - Diagrama + algoritmo visible

---

## 11. Integración con el ecosistema

### 11.1 Análisis post-solve existente

El training NO reemplaza el análisis post-solve. Se alimentan mutuamente:

```
Análisis (Epic 5)                      Training (Epic 6)
      │                                      │
      │   WeaknessDetector.analyze() ────────┤
      │   (detecta fases lentas,             │
      │    tiempos de transición,            │
      │    TPS bajo por fase)                │
      │                                      │
      │   Recomendación:                     │
      │   "Práctica OLL Drill" ────────────> │  Genera sesión
      │                                      │  de OLL drill
      │                           ──────────>│  
      │   Nuevos solves de training          │  Se guardan como
      │   alimentan el análisis              │  solves normales
```

### 11.2 Smart Cube

- Todo el training funciona con smart cube (BLE tracking)
- Y también con timer manual
- Detección automática: si smart cube conectado → tracking de movimientos reales
- Si manual → solo tiempo + auto-verificación post-solve

### 11.3 Análisis de entrenamiento

Los solves de training se guardan como solves normales con un tag `source: 'training'`.
Esto permite:

- Ver estadísticas de entrenamiento separadas
- Incluirlas en análisis general si el usuario quiere
- Tracking de progreso en el tiempo (no solo drilling aislado)

### 11.4 AI Coach (Epic 8)

El AI Coach consumirá:

- WeaknessReport para generar recomendaciones en lenguaje natural
- ProgressTracker para personalizar planes semanales
- DailyQueue para sugerir qué practicar hoy

---

## 12. Plan de Implementación

### Fase 1: Core Engine (2-3 semanas)

| Componente          | Descripción                        | Dependencias                |
| ------------------- | ----------------------------------- | --------------------------- |
| `TrainingEngine`  | Clase headless que orquesta modos   | algorithm-db, math-core     |
| `TrainingSession` | Manejo de sesiones de entrenamiento | TrainingEngine              |
| `CaseVerifier`    | Verificación de casos resueltos    | math-core (CubeState)       |
| `SetupGenerator`  | Generación de scrambles para casos | algorithm-db, solver-engine |

### Fase 2: Algorithm Drill (1-2 semanas)

| Componente                          | Descripción                                     |
| ----------------------------------- | ------------------------------------------------ |
| `AlgorithmDrill.ts`               | Modo 1 completo                                  |
| `DrillUI`                         | Componente React con timer + diagrama + feedback |
| Integración con Practice Dashboard | Botón "Practice This" + flujo completo          |

### Fase 3: Progress Tracking (1 semana)

| Componente                 | Descripción                            |
| -------------------------- | --------------------------------------- |
| `ProgressTracker.ts`     | Registro y consulta de progreso         |
| Schema en database package | Tablas IndexedDB para training progress |
| `AlgorithmProgress` hook | React hook para leer/escribir progreso  |

### Fase 4: Cross Trainer (1 semana)

| Componente           | Descripción                                                  |
| -------------------- | ------------------------------------------------------------- |
| `CrossTrainer.ts`  | Modo 2 (todos los sub-modos)                                  |
| Cross detection      | Usar PhaseSplitter para detectar cuándo cross está completo |
| Optimal cross solver | Min2Phase para calcular cross óptimo                         |

### Fase 5: F2L Trainer (1-2 semanas)

| Componente        | Descripción                               |
| ----------------- | ------------------------------------------ |
| `F2LTrainer.ts` | Modo 3 (slots, look-ahead, metronome)      |
| Metronome engine  | Sistema de beats + validación de timing   |
| Pair detection    | Detectar cuándo un par F2L está completo |

### Fase 6: SRS + Full Solve (1 semana)

| Componente              | Descripción                       |
| ----------------------- | ---------------------------------- |
| `SpacedRepetition.ts` | SM-2 adaptado                      |
| `FullSolveTrainer.ts` | Modo 4 (phase targets, move limit) |
| `RecallTrainer.ts`    | Modo 5 (learn, recall, flash)      |

### Fase 7: Challenges + UI final (1-2 semanas)

| Componente                        | Descripción                           |
| --------------------------------- | -------------------------------------- |
| `ChallengeGenerator.ts`         | Modo 6                                 |
| `WeaknessDetector.ts`           | Análisis automático de solves reales |
| Training Dashboard UI             | Vista completa con todos los tabs      |
| Integración Algorithms↔Training | Navegación bidireccional              |

### Total estimado: 8-12 semanas

---

## Referencias

- [PRD Part 9 — Training System](../00-product/PRD.md)
- [PRD Part 10 — Algorithm Database](../00-product/PRD.md)
- [Master Roadmap — Epic 6](../01-roadmap/Master_Roadmap.md)
- [TDD-04-Solver-Engine](../05-tdd/TDD-04-Solver-Engine.md)
- [Algorithm DB Schema](../../packages/algorithm-db/src/schema.ts)
- [Case Generator](../../packages/algorithm-db/src/caseGenerator.ts)
- [PhaseSplitter](../../packages/analysis-engine/src/phases/PhaseSplitter.ts)
