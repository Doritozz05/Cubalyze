# Multi-Puzzle 3D Architecture

**Fecha**: 2026-08-31
**Estado**: Propuesto (pendiente de revisión — rama `feat/multi-puzzle-3d`)
**Ámbito**: `packages/cube-3d-engine` + seam web (`useCube3D`, `Cube3DPanel`)
**Filosofía**: Diseño avanzado para soportar cualquier puzzle (NxN, Pyraminx, Skewb, Megaminx, FTO, Square-1, Clock) en el panel 3D de forma **modular**, sin romper el motor actual y con riesgo mínimo. Cada puzzle nuevo = 1 carpeta + 1 registro.

---

## 1. Contexto

El motor 3D actual (`cube-3d-engine`) es un motor de **cubo axis-alineado**:

- `CubeModel` + `CubeMeshFactory` + `RotationEngine` construyen cubies en un grid cúbico y los giran por capas (ejes x/y/z, ±90°).
- La única "perilla" de puzzle es `order` (2×2 y 3×3; generalizado a cualquier N en la rama `feat/multi-puzzle-3d`).
- Todo lo demás (escena, cámara, gyro, estilos, picking, replay) es genérico y **reutilizable**.
- Los puzzles no-cúbicos (Pyraminx, Skewb, Megaminx, FTO…) **no tienen modelo 3D**: hoy, seleccionar Pyraminx renderiza un cubo 3×3 (bug silencioso documentado en `Plan_Eventos_WCA_2026-08.md`, fase D2).

**Objetivo**: preparar el terreno para que añadir un puzzle sea declarativo — "escribir un builder y registrarlo" — conectándolo al panel 3D, sin tocar el core existente ni cambiar el comportamiento actual.

---

## 2. Método profesional (estudio)

Patrón común en los simuladores maduros (Twisty.js, pCubes, csTimer/cube.js):

> **"puzzle = definición + registro"**: cada puzzle declara su geometría, ejes de giro, partición de piezas por slice, notación y estado; el programa lo *ensambla* desde un registro.

Arquitectura en tres capas:

1. **Infraestructura de escena genérica** — cámara, luces, picking, loop de render, gyro, estilos. Ya existe y es agnóstica (`SceneManager`, `WebGLContextManager`, `GyroFusion`, `OrientationTracker`, `cubeSkins`).
2. **Por familia** — mesh factory + modelo + rotación + estado de cada puzzle. Los NxN comparten UNA familia parametrizada por `order`; cada puzzle no-cúbico tiene su propia carpeta.
3. **Por evento** — scramble, reglas, análisis. Ya existe en `packages/events` (registry + providers).

Familias (taxonomía por mecanismo de giro + geometría):

| Familia | Eventos | Ejes / giro | Motor |
|---|---|---|---|
| NxN cube (face-turning) | 222–777 (+OH/BLD) | 3 ejes, ±90° | **Uno solo, param por `order`** |
| Tetraedro vertex-turning | Pyraminx | 4 ejes por vértice, ±120° | Propio |
| Cubo corner-turning | Skewb | 4 ejes por esquina, ±120° | Propio |
| Dodecaedro face-turning | Megaminx | 12 ejes, ±72° | Propio |
| Octaedro face-turning | FTO | 8 ejes, ±120° | Propio |
| Cuboid shape-shifting | Square-1 | 2 capas + slice, 30° | Propio |
| Reloj de agujas | Clock | Ruedas + pines | Propio |

---

## 3. Arquitectura objetivo

```
EventSpec (packages/events)  ── mapeo en apps/web ──▶  Puzzle3DSpec
                                                          │
                          createPuzzle3DEngine(spec, opts) ▼
                    ┌──────────────────────────────────────────────┐
                    │   puzzle/registry.ts  (kind → builder)      │
                    └──────┬──────────────┬──────────────┬─────────┘
                      nxn-cube          pyraminx        skewb…
              (familia: CubeModel +     (carpeta propia: Model + MeshFactory + Rotation + builder)
               CubeMeshFactory +
               RotationEngine,          cada builder se registra solo al importar
               param por order)
```

Principios:

- **Honestidad estilo events registry**: un `Puzzle3DKind` puede estar *declarado* sin estar *implementado*; `createPuzzle3DEngine` de un kind sin builder lanza un error claro (nunca un cubo 3×3 silencioso).
- **Cero cambios de comportamiento**: el camino legacy (`order`) sigue siendo el default; la nueva ruta (`puzzle` spec) es opt-in.
- **Sin churn**: no se mueve ningún archivo existente; el terreno nuevo vive en `puzzle/`.

---

## 4. Contrato (código nuevo en `cube-3d-engine/src/puzzle/`)

### `types.ts`

```ts
import type { Cube3DEngineOptions } from '../core/Cube3DEngine';

/** Familias de puzzles. Solo las registradas son construibles
 *  (declarado ≠ implementado). */
export type Puzzle3DKind =
  | 'nxn-cube'   // 2×2–7×7+: un motor, parametrizado por order
  | 'pyraminx'   // tetraedro vertex-turning (4 ejes, ±120°)
  | 'skewb'      // cubo corner-turning (4 ejes por esquina, ±120°)
  | 'megaminx'   // dodecaedro face-turning (12 ejes, ±72°)
  | 'fto'        // octaedro face-turning (8 ejes)
  | 'sq1'        // square-1
  | 'clock';     // clock

/** Qué puzzle construir (unión discriminada). */
export type Puzzle3DSpec =
  | { kind: 'nxn-cube'; order: number }
  | { kind: Exclude<Puzzle3DKind, 'nxn-cube'> };

/** Opciones de construcción — todo lo de Cube3DEngineOptions salvo order
 *  (el order viene en el spec). Sin duplicar campos: Omit. */
export type Puzzle3DBuildOptions = Omit<Cube3DEngineOptions, 'order'>;

export interface Puzzle3DEngineFactory {
  readonly kind: Puzzle3DKind;
  build(spec: Puzzle3DSpec, options: Puzzle3DBuildOptions): Cube3DEngine;
}
```

### `registry.ts`

```ts
const builders = new Map<Puzzle3DKind, Puzzle3DEngineFactory>();

export function registerPuzzle3D(factory: Puzzle3DEngineFactory): void {
  if (builders.has(factory.kind)) {
    throw new Error(`Puzzle3D "${factory.kind}" is already registered`);
  }
  builders.set(factory.kind, factory);
}

export function getPuzzle3DFactory(kind: Puzzle3DKind): Puzzle3DEngineFactory | undefined {
  return builders.get(kind);
}

export function listPuzzle3DKinds(): Puzzle3DKind[] {
  return [...builders.keys()];
}

export function createPuzzle3DEngine(
  spec: Puzzle3DSpec,
  options: Puzzle3DBuildOptions,
): Cube3DEngine {
  const factory = builders.get(spec.kind);
  if (!factory) {
    throw new Error(`Puzzle3D "${spec.kind}" has no registered 3D builder yet`);
  }
  return factory.build(spec, options);
}

/** Test hook — restaura el registro base. */
export function resetPuzzle3DRegistry(): void {
  builders.clear();
}
```

### `nxn.ts` (la familia NxN se auto-registra, patrón `scrambleProviders`)

```ts
import { Cube3DEngine } from '../core/Cube3DEngine';
import { registerPuzzle3D } from './registry';
import type { Puzzle3DEngineFactory, Puzzle3DSpec } from './types';

export const nxnPuzzle3DFactory: Puzzle3DEngineFactory = {
  kind: 'nxn-cube',
  build(spec, options) {
    if (spec.kind !== 'nxn-cube') {
      throw new Error('nxn-cube factory received a non-nxn spec');
    }
    return new Cube3DEngine({ ...options, order: spec.order });
  },
};

export function registerNxnPuzzle3D(): void {
  registerPuzzle3D(nxnPuzzle3DFactory);
}

// Self-register al importar (mismo patrón que scrambleProviders en apps/web).
registerNxnPuzzle3D();
```

### Exports (`src/index.ts`)

```ts
// Puzzle registry (multi-puzzle terrain)
export * from './puzzle/types';
export * from './puzzle/registry';
export * from './puzzle/nxn';
```

---

## 5. File layout ("cada cosa en su lugar")

```
packages/cube-3d-engine/src/
├── core/            # infra escena + cubo NxN (existente, NO se mueve)
├── animation/       # rotación por pivotes (existente)
├── hardware/ replay/ styles/ workers/   # (existentes)
├── puzzle/          # NUEVO: terreno multi-puzzle
│   ├── types.ts     # Puzzle3DKind, Puzzle3DSpec, Puzzle3DBuildOptions, Puzzle3DEngineFactory
│   ├── registry.ts  # register / get / create / list / reset(test)
│   ├── nxn.ts       # builder de la familia nxn (auto-registrado)
│   └── __tests__/registry.test.ts
├── pyraminx/        # FUTURO P1: PyraminxModel + PyraminxMeshFactory + Rotation + builder
├── skewb/           # FUTURO P2
├── megaminx/ fto/ sq1/ clock/   # FUTUROS
```

Web (seam opt-in, cero cambio de comportamiento):

- `apps/web/src/hooks/useCube3D.ts` — prop opcional `puzzle?: Puzzle3DSpec`; si está presente usa `createPuzzle3DEngine`, si no, el camino legacy con `order`.
- `apps/web/src/components/Cube3D/Cube3DPanel.tsx` — prop opcional `puzzle?: Puzzle3DSpec` que pasa a `useCube3D`.
- `AppShell` / `puzzleUtils` **no cambian** hasta que exista un builder para el kind correspondiente (evita romper el render actual).

---

## 6. Plan por fases

### P0 — Terreno multi-puzzle (esta entrega)

1. `puzzle/types.ts`, `puzzle/registry.ts`, `puzzle/nxn.ts` (+ `registerNxnPuzzle3D` exportado y auto-registro).
2. Exports en `index.ts`.
3. `puzzle/__tests__/registry.test.ts`: nxn registrado; kind declarado sin builder lanza error honesto; registro duplicado lanza; dispatch de spec+options al factory; `afterEach` restaura el registro (test hook).
4. Seam web: `useCube3D` + `Cube3DPanel` aceptan `puzzle?` opcional.
5. Verificación: suite del engine (264 tests), typecheck del paquete y de `web`, `cubeKeybinds.test.ts`.

**Aceptación P0**: `createPuzzle3DEngine({ kind: 'nxn-cube', order: 4 }, opts)` ≡ `new Cube3DEngine({ ...opts, order: 4 })`; todos los callers actuales (con `order`) idénticos.

### P1 — Pyraminx (primer puzzle no-cúbico)

1. Carpeta `pyraminx/`: `PyraminxMeshFactory` (4 tips + 4 esquinas + 6 aristas, stickers triangulares, 4 colores), `PyraminxModel` (estado lógico = `PyraminxState` de `solver-engine` como fuente de verdad), rotación por ejes de vértice (±120°, patrón de pivotes existente parametrizado con `Vector3` arbitrario).
2. Builder `pyraminx.ts` registrado en el registry.
3. Web: `puzzleUtils` mapea `Pyraminx` → spec y el panel lo usa (desaparece el cubo 3×3 silencioso).

### P2+ — Skewb, Megaminx, FTO, Square-1, Clock

Mismo patrón que P1, uno por fase. Cada uno: carpeta propia + builder + tests.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper la API pública de `Cube3DEngine` | No se toca el core. Todo aditivo (prop opcional); camino legacy por defecto |
| Churn por mover archivos/imports | No se mueve nada existente; solo la carpeta `puzzle/` nueva |
| Registro global compartido | Patrón ya probado en el repo (`scrambleProviders` self-register); `resetPuzzle3DRegistry()` solo para tests; tests deterministas |
| Pyraminx hoy renderiza como 3×3 (bug silencioso) | No se toca hasta tener el motor pyraminx; queda documentado. Cambiarlo antes rompería el panel |
| Tree-shaking / knip | Exports mínimos y usados (tests incluidos en el análisis) |
| Romper la suite | Red de seguridad: 264 tests del engine + typecheck web + `cubeKeybinds` (28 tests) |
| Acoplar el motor 3D al registro de eventos | Los `Puzzle3DKind` viven en cube-3d-engine; el mapeo category→spec vive en `apps/web` (fases posteriores) |
| Estado lógico duplicado (PyraminxState en solver-engine vs math-core) | Reutilizar `PyraminxState`/tablas de solver-engine como fuente de verdad; no duplicar en math-core |

---

## 8. Criterios de aceptación (global)

1. `createPuzzle3DEngine({ kind: 'nxn-cube', order: N }, opts)` construye el mismo engine que `new Cube3DEngine({ ...opts, order: N })` para N=2..7.
2. Un `Puzzle3DKind` declarado sin builder lanza un error claro (nunca un cubo 3×3 silencioso).
3. Registro duplicado → throw.
4. Todos los callers existentes (que pasan `order`) se comportan idéntico (suite verde).
5. Añadir un puzzle nuevo no requiere tocar `core/`, `animation/` ni `apps/web` más allá del seam de props.

---

## 9. Decisiones abiertas

| Decisión | Opciones | Cuándo |
|---|---|---|
| Mapeo category→spec en `puzzleUtils` (web) | Por categoría vs por `EventSpec.puzzleKind` futuro | P1 |
| Contrato común de engine (`Puzzle3DEngine` interface) | Crearlo cuando exista el 2º builder (P1) | P1 |
| Añadir `puzzleKind` a `EventSpec` en `packages/events` | Sí (fuente de verdad única) vs mantenerlo en web | P1 |
| Facelets por orden N en math-core | Solo si se necesita sync de estado absoluto | P1/P2 |

---
