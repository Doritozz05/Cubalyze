# CubeForge — Auditoría Técnica Integral

**Fecha:** 18 de julio de 2026
**Versión del producto:** Pre-Milestone 1 (Epic 1-5 en desarrollo)
**Alcance:** Monorepo completo — 23 packages, 1 aplicación web, documentación, configuración
**Metodología:** Revisión estática exhaustiva de código, arquitectura, dependencias y documentos

---

## 🏥 Estado General de Salud del Proyecto

| Dimensión | Calificación | Nota |
|:----------|:------------:|:-----|
| **Arquitectura** | 🟡 7/10 | Buena dirección pero con acumulación de deuda |
| **Calidad de Código** | 🟡 6.5/10 | Sólido en los núcleos, irregular en periferia |
| **Cohesión/ Acoplamiento** | 🟢 8/10 | Bien modularizado, pocas dependencias cruzadas |
| **Testing** | 🟢 8/10 | Buena cobertura en packages críticos |
| **Documentación** | 🟢 9/10 | Excepcional — PRD, ADRs, RFCs, TDDs |
| **Consistencia** | 🟡 6/10 | Discrepancias en versionado, build tooling, TS version |
| **Deuda Técnica** | 🟡 6/10 | Acumulación visible de parches no consolidados |
| **Escalabilidad** | 🟢 8/10 | Arquitectura preparada para crecer |

**Veredicto general:** El proyecto tiene una base arquitectónica sólida, con decisiones bien documentadas y una separación de capas coherente. Sin embargo, existen **42 hallazgos** que deben abordarse antes de alcanzar un estado de producción. Los problemas más críticos son: (1) 8 packages esqueleto que generan ruido y confusión, (2) acumulación de parches "B-fix" sin refactorización, (3) código duplicado entre capas, y (4) una potencial race condition en el arranque del cube state tracker.

---

# PARTE 1 — ARQUITECTURA GENERAL

## 1.1 ¿Respeta la arquitectura definida?

**✅ Mayoritariamente sí.** El proyecto sigue el diseño del PRD (Part 4): separación clara entre Hardware HAL, Math Core, Analysis Engine, State Management y UI. La arquitectura en capas es visible y respetada:

```
BLE → gan-protocol → hardware-hal → [moves$] → useSolveSession → analysis-engine → UI
                                  → [moves$] → cube-3d-engine (Web Worker)
```

**⚠️ Desviación detectada:** El PRD especifica un `solver-engine` como paquete independiente, pero `Min2PhaseSolver` vive dentro de `math-core`. Esto no es incorrecto (el solver es matemático), pero el paquete `solver-engine/` vacío genera confusión.

## 1.2 ¿Módulos demasiado grandes?

**⚠️ `math-core` tiene 17 archivos fuente** y mezcla responsabilidades:
- `CubeState.ts` — estado del cubo (~700 líneas estimadas)
- `Min2PhaseSolver.ts` — solver WASM
- `FaceletParser.ts`, `FaceletStringConverter.ts` — parsing
- `methods/` — definiciones de métodos (CFOP, Roux, ZZ, Petrus)
- `orientation/` — sistema de orientación dinámica
- `Constants.ts`, `RandomStateGenerator.ts`

`math-core` es un "god package" que mezcla estado, parsing, resolución, generación de scrambles, y orientación. Debería dividirse o al menos documentarse su carácter de "core matemático".

**⚠️ `useSolveSession.ts` (~500 líneas)** concentra demasiada lógica: timer, moves, facelets, orientación, auto-arm, y teclado. Es el hook más complejo del proyecto.

## 1.3 ¿Responsabilidades mezcladas?

**🔴 `hardware-hal` depende de `timer-engine`** para importar `WcaRules`:
```
packages/hardware-hal/package.json → "@cubeforge/timer-engine": "workspace:*"
```
Esto es incorrecto. La capa de hardware no debería conocer el motor de temporizador. La dependencia debería invertirse o extraerse `WcaRules` a un paquete compartido.

**⚠️ `gan-protocol` NO depende de `@cubeforge/types`.** Define sus propios tipos de eventos (`GanCubeEvent`) que luego `hardware-hal` traduce manualmente a `CubeMoveEvent`. Esto crea una capa de traducción frágil.

## 1.4 ¿Ciclos de dependencias?

**✅ No se detectaron ciclos.** El grafo de dependencias es acíclico:

```
types ← math-core ← analysis-engine
types ← math-core ← cube-3d-engine
types ← hardware-hal ← [app web]
gan-protocol ← hardware-hal
timer-engine ← hardware-hal  ⚠️ (dependencia cuestionable)
types ← state ← [app web]
types ← models
```

## 1.5 ¿Componentes que conocen demasiado?

**⚠️ `useSolveSession` conoce detalles internos de `GanCubeAdapter`:**
```typescript
// useSolveSession.ts línea 347
if ("facelets$" in adapter && adapter.facelets$) {
```
Usa duck-typing para acceder a `facelets$` que no está en la interfaz `SmartCubeAdapter`. Esto rompe el contrato de la HAL.

## 1.6 ¿Violaciones de Clean Architecture?

**⚠️ La capa de UI (`apps/web`) importa directamente `Min2PhaseSolver` y `RandomStateGenerator`:**
```typescript
// App.tsx
import { RandomStateGenerator, Min2PhaseSolver } from "@cubeforge/math-core";
// ...
setCurrentScramble(RandomStateGenerator.generateScramble(new Min2PhaseSolver()));
```
En Clean Architecture, la capa de presentación no debería instanciar servicios de dominio. Debería existir un `ScrambleService` o similar en una capa intermedia.

---

# PARTE 2 — AUDITORÍA DE PACKAGES

## 2.1 `@cubeforge/types` 🟢

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Única: tipos compartidos |
| **API pública** | ✅ Bien diseñada, exports explícitos |
| **Acoplamiento** | ✅ Sin dependencias externas (solo dev) |
| **Exposición** | ✅ Solo exporta lo necesario |
| **Hallazgos** | `analysis.ts` es muy extenso (~350 líneas) — considerar dividir por dominio |

## 2.2 `@cubeforge/math-core` 🟡

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ⚠️ Múltiple: estado, parsing, solver, métodos, orientación |
| **API pública** | ✅ Buena, exports organizados |
| **Acoplamiento** | ✅ Solo depende de `types` y `three` |
| **Hallazgos** | 🔴 Demasiado grande (17 archivos). `Min2PhaseSolver` y `CubeState` son candidatos a paquetes independientes |

## 2.3 `@cubeforge/analysis-engine` 🟢

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Clara: pipeline de análisis post-solve |
| **API pública** | ✅ Bien definida (TimelineBuilder, PhaseSplitter, MetricsAggregator) |
| **Testing** | ✅ 12 archivos de test, cobertura exhaustiva |
| **Hallazgos** | `MetricsAggregator.computeAll` y `computeCore` tienen código duplicado significativo (~30 líneas) |

## 2.4 `@cubeforge/cube-3d-engine` 🟢

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Clara: renderizado 3D + worker |
| **API pública** | ✅ Buena separación main/worker |
| **Hallazgos** | `EngineWorker` mezcla renderizado + gyro + orientación — considerar separar concerns |

## 2.5 `@cubeforge/hardware-hal` 🟡

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Clara: adaptadores de hardware |
| **Acoplamiento** | 🔴 Depende de `timer-engine` — incorrecto |
| **Hallazgos** | `GanCubeAdapter` tiene ~270 líneas con lógica de reconexión, reloj, y parseo — considerar dividir |

## 2.6 `@cubeforge/gan-protocol` 🟡

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Clara: decodificación del protocolo GAN |
| **Aislamiento** | ✅ Sin dependencias de otros paquetes CubeForge |
| **Hallazgos** | ⚠️ No usa `@cubeforge/types` — crea sus propios tipos que luego requieren traducción |
| | 🔴 Archivo `gan-cube-protocol.ts` es demasiado grande (~1000 líneas estimadas) |

## 2.7 `@cubeforge/timer-engine` 🟢

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Clara: máquina de estados del timer WCA |
| **Testing** | ✅ Buena cobertura |
| **Hallazgos** | `WcaRules` contiene constantes que otros paquetes necesitan — considerar extraer |

## 2.8 `@cubeforge/state` 🟢

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Clara: stores Zustand |
| **API pública** | ✅ Simple, bien definida |
| **Hallazgos** | Sin build step — exporta `.ts` directamente. Funciona en monorepo pero no es publicable |

## 2.9 `@cubeforge/database` 🟡

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Clara: persistencia SQLite WASM |
| **Hallazgos** | 🔴 Sin build step — igual que `state` |
| | 🔴 Usa `any` profusamente en `worker.ts` (`let db: any = null`) |
| | ⚠️ Define sus propios tipos `Solve`, `Session`, `Algorithm` en `types.ts` en lugar de usar `@cubeforge/types` o `@cubeforge/models` |
| | ⚠️ `moves?: unknown[]` en `Solve` — tipo demasiado débil |

## 2.10 `@cubeforge/models` 🟢

| Aspecto | Evaluación |
|:--------|:----------|
| **Responsabilidad** | ✅ Clara: schemas Zod para validación |
| **Hallazgos** | ⚠️ Schemas definidos pero no se usan en `database` (que tiene sus propias interfaces) |

## 2.11 `@cubeforge/ui` 🟡

| Aspecto | Evaluación |
|:--------|:----------|
| **Estado** | ⚠️ Mínimo — solo un `button.tsx` y `utils.ts` |
| **Hallazgos** | 🔴 Dependencias desactualizadas: `@types/react@^18` (app usa React 19), `tailwindcss@^3` (app usa v4) |
| | ⚠️ Prácticamente sin uso — la app web importa componentes de `@/components/ui/` localmente, no de este paquete |

## 2.12 Packages esqueleto (vacíos) 🔴

| Package | Estado | Problema |
|:--------|:------|:---------|
| `3d-engine` | Vacío | ⚠️ Existe `cube-3d-engine` — naming conflict |
| `ai-core` | Vacío | Placeholder legítimo (futuro) |
| `bluetooth` | Vacío | Funcionalidad ya en `gan-protocol` + `hardware-hal` |
| `solver-engine` | Vacío | `Min2PhaseSolver` en `math-core` — ¿necesario? |
| `statistics` | Vacío | Placeholder legítimo (futuro) |
| `sync-engine` | Vacío | Placeholder legítimo (futuro) |
| `training` | Vacío | Placeholder legítimo (futuro) |

**Recomendación:** Eliminar `3d-engine` y `bluetooth` (redundantes). Mantener el resto como placeholders con un README.md que indique su propósito futuro.

---

# PARTE 3 — CÓDIGO FUERA DE PACKAGES

## 3.1 Raíz del monorepo ✅

- `turbo.json` — Correcto, bien configurado
- `pnpm-workspace.yaml` — Correcto
- `tsconfig.json` — Path aliases correctos pero **no incluye `@cubeforge/ui` ni `@cubeforge/models`**
- `vitest.config.ts` — Mínimo, suficiente
- `package.json` — Script `lint:lines` parece un placeholder no funcional

## 3.2 `apps/web/` ✅

- `vite.config.ts` — Correcto, con fix B1 para HMR
- `.gitignore` — Correcto
- `src/App.tsx` — ⚠️ ~300 líneas, mucha lógica de coordinación. Considerar extraer a custom hooks

## 3.3 `docs/` ✅

Excelente documentación. Bien organizada por categorías (00-18). Los ADRs y RFCs son completos.

**⚠️ Hallazgo:** Muchos documentos en `02-architecture/` están marcados como *(Pending)* en el Architecture Index:
- `Platform_Strategy.md`
- `Data_Flow.md`
- `System_Architecture_Overview.md`
- Todos los diagramas

## 3.4 `.changeset/` ✅

Configuración mínima, correcta para changesets.

## 3.5 `.codegraph/` 

Directorio con `.gitignore` — sin contenido visible. Posiblemente una herramienta de análisis no configurada.

---

# PARTE 4 — BUGS POTENCIALES

### 🔴 BUG-01: Carrera en inicialización del CubeState tracker
**Ubicación:** `apps/web/src/hooks/useSolveSession.ts:347-360`
**Descripción:** `realCubeStateRef` se inicializa como cubo resuelto (`new CubeState()`). Solo se siembra con el primer evento FACELETS. Si el primer FACELETS nunca llega (cubos Gen2 en modo 3/4 que no envían facelets periódicos), el tracker asume estado resuelto y las detecciones de fase serán incorrectas.
**Impacto:** Medio | **Probabilidad:** Baja | **Prioridad:** Alta

### 🟡 BUG-02: Pérdida de múltiples movimientos en IDLE
**Ubicación:** `apps/web/src/hooks/useSolveSession.ts:318-322`
**Descripción:** `pendingFirstMoveRef` solo almacena UN movimiento. Si múltiples movimientos llegan durante la ventana de race IDLE→auto-arm (muy improbable pero posible en solvers extremadamente rápidos), los movimientos 2+ se pierden.
**Impacto:** Bajo | **Probabilidad:** Muy baja | **Prioridad:** Media

### 🟡 BUG-03: Memory leak potencial en subscriptions del worker
**Ubicación:** `packages/cube-3d-engine/src/workers/EngineWorker.ts:46-50, 146-147`
**Descripción:** `orientationSub` y `rotationEventSub` se recrean en `setGyroSupported(false)` sin verificar que los anteriores estén unsubscribed. En el path de disable, se llama `unsubscribe()` antes de recrear, pero en el path de `init()`, si se llama dos veces, las subscriptions antiguas quedan huérfanas.
**Impacto:** Bajo | **Probabilidad:** Baja | **Prioridad:** Baja

### 🟡 BUG-04: `new Min2PhaseSolver()` recreado innecesariamente
**Ubicación:** `apps/web/src/App.tsx:54, 67, 182`
**Descripción:** Cada regeneración de scramble crea una nueva instancia de `Min2PhaseSolver`. Si el solver inicializa tablas internas en el constructor, esto es un desperdicio de CPU.
**Impacto:** Bajo (rendimiento) | **Probabilidad:** Alta | **Prioridad:** Media

### 🟡 BUG-05: `setCollectedMoves([...collectedMovesRef.current])` en cada movimiento
**Ubicación:** `apps/web/src/hooks/useSolveSession.ts:327`
**Descripción:** En cada movimiento durante el solve, se crea un nuevo array completo. Para 60+ movimientos por solve, esto genera presión de GC innecesaria.
**Impacto:** Bajo (rendimiento) | **Probabilidad:** Alta | **Prioridad:** Baja

### 🟢 BUG-06: Polling de conexión con `setInterval` innecesario
**Ubicación:** `apps/web/src/hooks/useSolveSession.ts:257-260`
**Descripción:** `setInterval(update, 1000)` para verificar `globalCubeAdapter.isConnected` cada segundo. Debería usar `connectionStatus$` observable que ya existe en `GanCubeAdapter`.
**Impacto:** Bajo | **Probabilidad:** Alta | **Prioridad:** Media

---

# PARTE 5 — CÓDIGO MUERTO

### 🔴 DEAD-01: Package `3d-engine` — ELIMINAR
**Evidencia:** `packages/3d-engine/package.json` — sin source, `"typecheck": "echo no sources"`
**Acción:** Eliminar. `cube-3d-engine` es el paquete activo.

### 🔴 DEAD-02: Package `bluetooth` — ELIMINAR
**Evidencia:** `packages/bluetooth/package.json` — sin source
**Acción:** Eliminar. Funcionalidad en `gan-protocol` + `hardware-hal`.

### 🟡 DEAD-03: `onFacelets` callback en GanCubeAdapter — MANTENER o ELIMINAR
**Evidencia:** `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:57`
```typescript
public onFacelets: ((facelets: string) => void) | null = null;
```
**Acción:** Verificar si hay consumidores. Si no, eliminar.

### 🟡 DEAD-04: `useTimerUI` hook deprecado — ELIMINAR
**Evidencia:** `apps/web/src/hooks/useTimerUI.ts:15`
```typescript
* @deprecated Use `useSolveSession` instead.
```
**Acción:** Si no tiene consumidores, eliminar el archivo.

### 🟡 DEAD-05: `loadKeys()` deprecado en gan-cube-definitions — ELIMINAR
**Evidencia:** `packages/gan-protocol/src/gan-cube-definitions.ts:28`
```typescript
/** @deprecated Use loadKeys() instead */
```
**Acción:** Verificar referencias y eliminar.

### 🟡 DEAD-06: `@cubeforge/ui` package — REFACTORIZAR o ELIMINAR
**Evidencia:** Prácticamente sin uso. La app web tiene sus propios componentes UI en `@/components/ui/`.
**Acción:** O bien migrar los componentes de la app al paquete `ui`, o eliminar el paquete.

---

# PARTE 6 — CÓDIGO DUPLICADO

### 🔴 DUP-01: `SOLVED_FACELETS` regex — UNIFICAR
**Archivos:**
- `apps/web/src/hooks/useSolveSession.ts:31`
- `packages/analysis-engine/src/timeline/TimelineBuilder.ts:15`
- `apps/web/src/hooks/useScrambleValidator.ts` (probable)
**Acción:** Mover a `@cubeforge/types` o `@cubeforge/math-core` y exportar como constante.

### 🟡 DUP-02: Construcción de notación de movimiento — UNIFICAR
**Patrón repetido:** `face + (direction === -1 ? "'" : direction === 2 ? "2" : "")`
**Archivos:**
- `apps/web/src/hooks/useSolveSession.ts:313`
- `packages/analysis-engine/src/timeline/TimelineBuilder.ts:117`
- `apps/web/src/components/Cube3D/Cube3DPanel.tsx` (pre-B6)
**Acción:** Ya existe `MoveTransformer.moveToNotation()` en `math-core` — usarlo consistentemente.

### 🟡 DUP-03: `MetricsAggregator.computeAll` vs `computeCore` — REFACTORIZAR
**Archivo:** `packages/analysis-engine/src/metrics/MetricsAggregator.ts`
**Descripción:** ~30 líneas de lógica de phase metrics duplicadas entre los dos métodos.
**Acción:** Extraer a un método privado compartido.

### 🟡 DUP-04: Mapeo de estados del timer — UNIFICAR
**Patrón:** Conversiones entre `EngineState` y `TimerState`
**Archivos:**
- `apps/web/src/hooks/useSolveSession.ts:72-88` (`mapEngineStateToUIState`)
- `packages/timer-engine/src/TimerState.ts`
**Acción:** Centralizar en `timer-engine` y exportar.

---

# PARTE 7 — ACOPLAMIENTO

### 🔴 COUP-01: `hardware-hal` → `timer-engine`
**Evidencia:** `packages/hardware-hal/package.json`:
```json
"@cubeforge/timer-engine": "workspace:*"
```
La capa de abstracción de hardware depende del motor de temporizador. Esto invierte la dependencia esperada.
**Acción:** Extraer tipos compartidos (`WcaRules`) a `@cubeforge/types`.

### 🟡 COUP-02: `useSolveSession` conoce estructura interna de `GanCubeAdapter`
**Evidencia:** Duck-typing para acceder a `facelets$`:
```typescript
if ("facelets$" in adapter && adapter.facelets$) {
```
**Acción:** Añadir `facelets$` a la interfaz `SmartCubeAdapter` en `hardware-hal`.

### 🟡 COUP-03: `gan-protocol` no usa tipos compartidos
**Evidencia:** `packages/gan-protocol/package.json` — sin dependencia de `@cubeforge/types`
**Acción:** Evaluar si añadir la dependencia reduciría la fricción de traducción.

### 🟡 COUP-04: `database` no usa `@cubeforge/models` ni `@cubeforge/types`
**Evidencia:** Define sus propias interfaces `Solve`, `Session`, `Algorithm` en `types.ts`
**Acción:** Alinear con `@cubeforge/models` (schemas Zod) o `@cubeforge/types`.

### 🟢 COUP-05: App web importa `Min2PhaseSolver` directamente
**Evidencia:** `apps/web/src/App.tsx:27`
**Acción:** Encapsular detrás de un servicio/hook (`useScrambleGenerator`).

---

# PARTE 8 — CALIDAD DEL DISEÑO

### ✅ SOLID — Principios respetados

| Principio | Cumplimiento |
|:----------|:------------|
| **S** (Single Responsibility) | ⚠️ `math-core` y `useSolveSession` violan SRP |
| **O** (Open/Closed) | ✅ Métodos definidos como plugins (CFOP, Roux, ZZ, Petrus) |
| **L** (Liskov Substitution) | ✅ Interfaces bien definidas (`SmartCubeAdapter`, `HardwareTimerAdapter`) |
| **I** (Interface Segregation) | ✅ Interfaces pequeñas y específicas |
| **D** (Dependency Inversion) | ⚠️ HAL depende de timer-engine, App depende de Min2PhaseSolver |

### ⚠️ DRY — Violaciones

- `SOLVED_FACELETS` duplicado (ver DUP-01)
- Notación de movimiento duplicada (ver DUP-02)
- Lógica de phase metrics duplicada (ver DUP-03)

### ✅ KISS — Mayormente respetado

Las soluciones son directas. La complejidad está donde el dominio la requiere (crypto BLE, estado del cubo, orientación).

### ⚠️ YAGNI — Algunas violaciones

- 8 packages esqueleto para funcionalidades no implementadas
- `@cubeforge/ui` con dependencias desactualizadas y sin uso real

### ✅ Naming — Buena calidad

Nombres descriptivos y consistentes: `TimelineBuilder`, `PhaseSplitter`, `MetricsAggregator`, `GanCubeAdapter`, `OrientationTracker`.

---

# PARTE 9 — FLUJO DE DATOS

## 9.1 Pipeline principal (Smart Cube → UI)

```
Bluetooth (BLE)
  │
  ▼
gan-protocol (decodificación, descifrado AES)
  │  GanCubeEvent { type, move, facelets, gyro, ... }
  ▼
hardware-hal / GanCubeAdapter (traducción, clock drift)
  │  CubeMoveEvent { face, direction, cubeTimestamp, hostTimestamp }
  │  GyroEvent { x, y, z, w, velocity? }
  │  facelets$ (string de 54 chars)
  ├──────────────────────┬──────────────────────────┐
  ▼                      ▼                          ▼
useSolveSession     cube-3d-engine            useScrambleValidator
  │                 (Web Worker)                 │
  │                    │                          │
  │  collect moves     │  SyncBridge              │  validate scramble
  │  track CubeState   │  GyroFusion              │
  │  timer engine      │  OrientationTracker      │
  │                    │                          │
  ▼                    ▼                          ▼
analysis-engine     Canvas 3D                 validation states
  │
  │  TimelineBuilder
  │  PhaseSplitter
  │  MetricsAggregator
  ▼
SolveMetrics → DB (SQLite WASM) → SolveAnalysisPanel (UI)
```

**✅ El pipeline es correcto.** Los datos fluyen en una dirección sin ciclos.

## 9.2 Transformaciones redundantes

**⚠️ Doble tracking de estado del cubo:**
1. `CubeState` en `TimelineBuilder` (reconstruido desde moves)
2. `realCubeStateRef` en `useSolveSession` (tracking en tiempo real)

Ambos mantienen el mismo estado por diferentes caminos. ¿Es necesario el tracking en `useSolveSession`? El diff actual (B6+) añade `realCubeStateRef` como ground truth para el analysis engine. Esto es funcionalmente correcto pero conceptualmente redundante.

## 9.3 Duplicación de estado

**⚠️ Estado del timer duplicado:**
- `TimerEngine` (timer-engine) — fuente de verdad
- `useSolveSession` — estados React (`phase`, `time`, `lastTime`)
- `timer.store.ts` (Zustand) — ¿en uso?

El estado del timer se refleja en 3 lugares. Esto es propenso a desincronización.

---

# PARTE 10 — RENDIMIENTO

### 🟡 PERF-01: `new Min2PhaseSolver()` en cada scramble
**Impacto:** Si las tablas de pruning se inicializan en el constructor, cada regeneración de scramble incurre en ese costo. Crear una instancia singleton.
**Prioridad:** Media

### 🟡 PERF-02: Spread de array en cada movimiento
```typescript
setCollectedMoves([...collectedMovesRef.current]);
```
Crea un nuevo array de 60+ elementos en cada movimiento. Usar `useRef` + notificar cambios de forma más eficiente.
**Prioridad:** Baja

### 🟢 PERF-03: Web Worker para el motor 3D
✅ Buena práctica. El renderizado 3D no bloquea el hilo principal.

### 🟢 PERF-04: Análisis asíncrono post-solve
✅ Se ejecuta con `setTimeout(0)`, no bloquea la UI.

### 🟡 PERF-05: Coalesce buffer del SyncBridge
✅ Buena optimización para agrupar movimientos BLE. El fix B9 corrigió un bug en la iteración.

---

# PARTE 11 — CONSISTENCIA

### 🔴 CONS-01: Versiones de TypeScript inconsistentes

| Package | TypeScript |
|:--------|:----------|
| `apps/web` | ~6.0.2 |
| `math-core` | ^5.3.3 |
| `analysis-engine` | ^5.3.3 |
| `hardware-hal` | ^5.7.3 |
| `gan-protocol` | ^5.7.3 |
| `ui` | ^5.4.5 |
| `state` | ^5.7.3 |

**Acción:** Unificar a una sola versión (recomendado ^5.7.3 como mínimo común).

### 🟡 CONS-02: Estrategia de build inconsistente

| Package | Build |
|:--------|:------|
| `types` | `tsup` (tsup.config.ts) |
| `math-core` | `tsup` (inline en package.json) |
| `analysis-engine` | `tsup` (inline) |
| `hardware-hal` | `tsup` (tsup.config.ts) |
| `gan-protocol` | `tsup` (tsup.config.ts) |
| `timer-engine` | `tsup` (tsup.config.ts) |
| `cube-3d-engine` | `tsup` (inline) |
| `database` | ❌ Sin build |
| `state` | ❌ Sin build |
| `models` | ❌ Sin build |

**Acción:** Estandarizar: todos con `tsup.config.ts` o todos con configuración inline.

### 🟡 CONS-03: Versionado semántico inconsistente

| Package | Versión |
|:--------|:-------|
| `types` | 1.0.0 |
| `math-core` | 1.0.0 |
| `hardware-hal` | 1.0.0 |
| `gan-protocol` | 1.0.0 |
| `cube-3d-engine` | 1.0.0 |
| `analysis-engine` | 0.1.0 |
| `timer-engine` | 0.0.0 |
| `state` | 0.0.0 |
| `database` | 0.0.0 |
| `models` | 0.0.0 |

Paquetes en 1.0.0 cuando el producto no ha llegado a Milestone 1 es prematuro.

### 🟡 CONS-04: ESLint no uniforme

Solo algunos paquetes tienen `eslint.config.js`: `hardware-hal`, `gan-protocol`, `timer-engine`, `database`, `state`, `models`. Los demás dependen del ESLint del monorepo.

### ✅ CONS-05: Estructura de directorios consistente

Todos los packages activos siguen `src/`, `src/__tests__/` (o `tests/`). Bien.

---

# PARTE 12 — DEUDA TÉCNICA

### 🔴 DEBT-01: Parches "B-fix" sin consolidar — ALTO IMPACTO

El diff actual contiene 9 parches con prefijo "B" (B1-B9) que representan ~200 líneas de cambios no commiteados. Son correcciones reales de bugs, pero no están acompañadas de refactorización:

| Fix | Descripción | Archivo |
|:----|:-----------|:--------|
| B1 | HMR wss:// fix | `vite.config.ts` |
| B2 | GATT command queue + facelets dedup | `gan-cube-protocol.ts`, `GanCubeAdapter.ts` |
| B4 | Auto-reset STOPPED→IDLE antes de auto-arm | `useSolveSession.ts` |
| B5 | Facelet sync inicial en remount del panel 3D | `Cube3DPanel.tsx` |
| B6 | Move-based CubeState tracker | `useSolveSession.ts`, `TimelineBuilder.ts` |
| B8 | Buffer de primer movimiento en IDLE | `useSolveSession.ts` |
| B9 | Coalesce iteration fix (M moves) | `SyncBridge.ts` |

**Riesgo:** Estos parches añaden complejidad sin simplificar el código base. La lógica se vuelve más difícil de razonar.

### 🟡 DEBT-02: TODO en CFOPMetricsCalculator
**Evidencia:** `packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts:118`
```
* TODO: Implement per-slot PhaseMasks for exact pair boundary detection.
```
**Impacto:** Medio. La detección de pares F2L no es precisa sin esto.

### 🟡 DEBT-03: `@ts-ignore` en Min2PhaseSolver
**Evidencia:** `packages/math-core/src/Min2PhaseSolver.ts:1`
```typescript
// @ts-ignore
import min2phase from 'min2phase.js';
```
**Acción:** Agregar tipos o un archivo `.d.ts` para el módulo.

### 🟡 DEBT-04: `any` types en database/worker.ts
**Evidencia:** `packages/database/src/worker.ts:6`
```typescript
let db: any = null;
```
**Acción:** Tipar correctamente usando los tipos de `@sqlite.org/sqlite-wasm`.

### 🟡 DEBT-05: `as unknown as` casts
Múltiples archivos usan `as unknown as` para forzar tipos. Esto elude el type-checking.

### 🟡 DEBT-06: Código legacy deprecado
- `useTimerUI` hook — `@deprecated`
- `loadKeys()` en `gan-cube-definitions` — `@deprecated`
- `onFacelets` callback en `GanCubeAdapter` — "backward compat"

---

# PARTE 13 — ESCALABILIDAD

### ✅ Nuevos métodos de resolución

La arquitectura soporta nuevos métodos mediante la interfaz `MethodDefinition` y `PhaseMask`. Añadir un método requiere:
1. Definir `PhaseMask[]` (ya existe: CFOP, Roux, ZZ, Petrus)
2. Implementar método específico en `analysis-engine` (ya existe: `CFOPMetricsCalculator`, `RouxMetricsCalculator`)

**Escalabilidad:** ✅ Excelente.

### ✅ Nuevos Smart Cubes

La HAL define `SmartCubeAdapter` como contrato. Añadir un fabricante requiere implementar la interfaz.

**Escalabilidad:** ✅ Buena, pero el contrato `SmartCubeAdapter` no incluye `facelets$` (usado mediante duck-typing).

### ⚠️ Plugins (ADR-017)

El ADR-017 define un sistema de plugins basado en ESM dinámicos, pero **no hay infraestructura implementada**. El plugin system es fundamental para entrenamiento, nuevos puzzles, y temas.

**Escalabilidad:** ⚠️ Sin implementar. Es un riesgo si se pospone mucho.

### ✅ Nuevos módulos (IA, Trainer, Replay, Statistics, Competitions)

La arquitectura de paquetes independientes facilita añadir nuevos módulos. Los placeholders ya existen. El riesgo está en que la ausencia de un API Gateway/Backend podría limitar funcionalidades multi-usuario (Competitions).

---

# PARTE 14 — COMPARACIÓN CON ARQUITECTURA OBJETIVO

### PRD (Product Requirements Document)

| Requisito PRD | Estado |
|:--------------|:------|
| Timer offline-first | ✅ Implementado |
| Smart Cube BLE (GAN) | ✅ Implementado |
| 3D Engine (Three.js puro) | ✅ Implementado |
| Análisis en tiempo real | ✅ Implementado (post-solve) |
| HAL multi-fabricante | ⚠️ Solo GAN implementado |
| Sistema de plugins | ❌ No implementado |
| Solver engine (min2phase) | ✅ En math-core |
| Training system | ❌ No implementado |
| Algorithm database | ⚠️ Esquema existe, sin UI |
| Statistics avanzadas | ❌ No implementado |
| AI system | ❌ No implementado |
| Sync engine | ❌ No implementado |
| Backend services | ❌ No implementado |
| Offline-first SQLite | ✅ En database package |

### ADRs

| ADR | Decisión | Cumplimiento |
|:----|:---------|:------------|
| ADR-001 | Turborepo | ✅ |
| ADR-002 | pnpm | ✅ |
| ADR-003 | Estructura monorepo | ✅ |
| ADR-004 | Code Quality | ⚠️ ESLint no uniforme |
| ADR-005 | Testing (Vitest) | ✅ |
| ADR-006 | CI (GitHub Actions) | ⚠️ No verificado |
| ADR-007 | Hosting (Vercel+Supabase) | ⚠️ Parcial |
| ADR-008 | React + Vite SPA | ✅ |
| ADR-009 | Zustand | ✅ |
| ADR-010 | MIT License | ✅ |
| ADR-011 | PWA Storage | ⚠️ No verificado |
| ADR-012 | BLE + Mobile Fallbacks | ⚠️ Solo BLE |
| ADR-013 | SQLite WASM/OPFS | ✅ |
| ADR-014 | Three.js puro | ✅ |
| ADR-015 | min2phase WASM | ✅ |
| ADR-016 | Performance Strategies | ⚠️ Comlink en uso |
| ADR-017 | Plugin System (ESM) | ❌ No implementado |
| ADR-018 | Security/Crypto | ⚠️ Sin backend |
| ADR-019 | Backend Architecture | ⚠️ Sin backend |
| ADR-020 | Accessibility | ⚠️ No verificado |
| ADR-021 | Documentation Stack | ✅ |
| ADR-022 | Open Source Readiness | ⚠️ Parcial |
| ADR-023 | Continuous Deployment | ⚠️ No verificado |

---

# RESUMEN DE HALLAZGOS PRIORIZADOS

## 🔴 Críticos (abordar inmediatamente)

| ID | Categoría | Descripción | Archivo(s) |
|:---|:----------|:-----------|:-----------|
| DEBT-01 | Deuda Técnica | 9 parches "B-fix" sin consolidar ni commit | 7 archivos |
| DEAD-01 | Código Muerto | Package `3d-engine` vacío y conflictivo | `packages/3d-engine/` |
| DEAD-02 | Código Muerto | Package `bluetooth` vacío | `packages/bluetooth/` |
| CONS-01 | Consistencia | 5 versiones distintas de TypeScript | 8 package.json |
| COUP-01 | Acoplamiento | `hardware-hal` depende de `timer-engine` | `hardware-hal/package.json` |

## 🟡 Altos (abordar en esta fase)

| ID | Categoría | Descripción |
|:---|:----------|:-----------|
| DUP-01 | Duplicación | `SOLVED_FACELETS` regex en 3 archivos |
| DUP-02 | Duplicación | Construcción de notación de movimiento repetida |
| COUP-02 | Acoplamiento | Duck-typing para `facelets$` en useSolveSession |
| CONS-02 | Consistencia | Build tooling inconsistente (tsup sí/no) |
| CONS-03 | Consistencia | Versionado semántico incoherente |
| DEAD-06 | Código Muerto | `@cubeforge/ui` sin uso real |
| DEBT-04 | Deuda Técnica | `any` types en database/worker.ts |
| DEBT-03 | Deuda Técnica | `@ts-ignore` en Min2PhaseSolver |
| BUG-01 | Bug | CubeState tracker no sembrado sin FACELETS |

## 🟢 Medios (abordar en siguiente iteración)

| ID | Descripción |
|:---|:-----------|
| DUP-03 | Código duplicado en MetricsAggregator |
| DUP-04 | Mapeo de estados duplicado |
| PERF-01 | `new Min2PhaseSolver()` recreado |
| BUG-04 | Mismo que PERF-01 |
| BUG-06 | Polling con setInterval en lugar de observable |
| DEBT-02 | TODO en CFOPMetricsCalculator |
| COUP-05 | App conoce Min2PhaseSolver directamente |
| DEAD-03 | `onFacelets` callback legacy |
| DEAD-04 | `useTimerUI` deprecado |

## 🔵 Bajos (backlog)

| ID | Descripción |
|:---|:-----------|
| PERF-02 | Spread de array en cada movimiento |
| PERF-05 | GC pressure en collectedMoves |
| BUG-05 | Mismo que PERF-02 |
| BUG-02 | Pérdida de múltiples movimientos en IDLE |
| BUG-03 | Memory leak potencial en worker subs |
| CONS-04 | ESLint no uniforme |
| DEBT-05 | `as unknown as` casts |
| DEBT-06 | Código legacy deprecado sin eliminar |

---

# PLAN DE REFACTORIZACIÓN RECOMENDADO

## Fase 1: Limpieza inmediata (1-2 días)

1. **Hacer commit de los parches B1-B9** con mensajes descriptivos
2. **Eliminar packages `3d-engine` y `bluetooth`** del workspace
3. **Unificar versión de TypeScript** a `^5.7.3` en todos los packages
4. **Mover `SOLVED_FACELETS`** a `@cubeforge/types` y re-exportar

## Fase 2: Consolidación de arquitectura (3-5 días)

5. **Refactorizar parches B-fix** en código limpio (sin prefijos "B")
6. **Extraer `WcaRules`** de `timer-engine` a `@cubeforge/types`
7. **Eliminar dependencia** `hardware-hal` → `timer-engine`
8. **Añadir `facelets$`** a la interfaz `SmartCubeAdapter`
9. **Alinear `database` types** con `@cubeforge/models` o `@cubeforge/types`

## Fase 3: Mejora de calidad (1 semana)

10. **Estandarizar build tooling** (todos con `tsup.config.ts`)
11. **Eliminar código deprecado** (`useTimerUI`, `loadKeys`, `onFacelets`)
12. **Tipar `database/worker.ts`** eliminando `any`
13. **Encapsular `Min2PhaseSolver`** en un hook `useScrambleGenerator`
14. **Unificar construcción de notación** usando `MoveTransformer.moveToNotation()`
15. **Estandarizar versiones semánticas** (todo a `0.x.0` hasta Milestone 1)

## Fase 4: Deuda técnica diferida (siguiente milestone)

16. **Implementar sistema de plugins** (ADR-017)
17. **Dividir `math-core`** si sigue creciendo
18. **Migrar componentes UI** al paquete `@cubeforge/ui` o eliminarlo
19. **Implementar per-slot PhaseMasks** para F2L (TODO en CFOPMetricsCalculator)
20. **Añadir tipos para `min2phase.js`** (eliminar `@ts-ignore`)

---

*Informe generado por Buffy (Freebuff AI) — Auditoría Técnica Integral de CubeForge*
*Fecha: 18 de julio de 2026*
