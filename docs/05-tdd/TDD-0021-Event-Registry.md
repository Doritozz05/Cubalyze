# TDD-0021 — Event Registry (Fase A1 del Plan de Eventos WCA)

**Fecha**: 2026-08-15
**Fase**: A1 del [Plan_Eventos_WCA_2026-08](../01-roadmap/Plan_Eventos_WCA_2026-08.md)
**Estado**: Borrador (requiere ADR para la decisión de ubicación del paquete)
**Tipo**: Aditivo puro — **no modifica ninguna ruta de ejecución existente**.

---

## 1. Objetivo

Declarar de forma tipada y centralizada **qué es cada evento/puzzle** (identidad, provider de scramble, perfil de reglas WCA, capacidad de análisis, estado), sin cambiar el comportamiento de 3×3 ni de 2×2.

## 2. Contrato de no-regresión (requisito del producto)

La A1 **solo añade**: un paquete nuevo, sus tipos, el registro estático y sus tests. No toca:
- `packages/database` (repos, migraciones, SQL) — **nada**.
- `packages/analysis-engine`, `packages/statistics`, `packages/math-core`, `packages/timer-engine` — **nada**.
- `apps/web/src/utils/puzzleUtils.ts` (scrambles), `WcaRules.ts`, el selector, sesiones, stats, import/export — **nada**.

**Verificación obligatoria al cierre** (exit gate): suite de tests completa + typecheck de todo el monorepo pasando sin cambios de código en las rutas existentes.

El registro es **código muerto hasta la A4/A5/A6** (que lo consumirán manteniendo salidas byte-idénticas para 2×2/3×3).

## 3. Decisión de ubicación (ADR pendiente — recomendación del TDD)

**Recomendación**: nuevo paquete headless `packages/events` (sin dependencias de runtime salvo el tipo `Penalty` de `@cubeforge/timer-engine`), espejo del estilo de `packages/algorithm-db` (tsup + vitest + `type: module`).

- `packages/types` queda descartado como hogar del registro: hoy es un paquete de tipos puros (`analysis.ts`, `orientation.ts`) y el registro mezcla tipos + **datos estáticos** (18 specs con labels, formatos, fechas WCA) — contamina la SSoT de tipos.
- `packages/events` puede ser consumido por `web`, `desktop` y los paquetes de análisis sin ciclos (nadie depende de él; él solo depende de `timer-engine` para `Penalty`).
- Alternativa aceptable si se prefiere no crear paquete: `packages/types/src/events/` (el registro como módulo del paquete de tipos). Se decide en ADR antes de implementar.

## 4. Diseño del EventSpec

```ts
// packages/events/src/spec.ts

/** Códigos WCA (lista oficial agosto 2026 + FTO planificado). */
export const WCA_EVENT_CODES = [
  '222', '333', '333bf', '333fm', '333mbf', '333oh',
  '444', '444bf', '555', '555bf', '666', '777',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
  'fto', // efectivo 2027-01-02
] as const;
export type WcaEventCode = (typeof WCA_EVENT_CODES)[number];

/**
 * Valor canónico de `puzzle_type` en la DB (solves/sessions).
 * '3x3x3' y '2x2x2' son LOS MISMOS strings que se persisten hoy — no cambian.
 */
export type PuzzleType =
  | '2x2x2' | '3x3x3' | '4x4x4' | '5x5x5' | '6x6x6' | '7x7x7'
  | '333oh' | '333bf' | '333fm' | '333mbf' | '444bf' | '555bf'
  | 'clock' | 'minx' | 'pyram' | 'skewb' | 'sq1' | 'fto';

export type WcaAttemptFormat = 'a5' | 'bo3' | 'bo1' | 'mo3' | 'bo2';

export type EventStatus = 'available' | 'planned' | 'removed';

export interface WcaRulesProfile {
  /** Ventana de inspección en ms; null = sin inspección (FMC/BLD). */
  inspectionMs: number | null;
  /** Umbral +2 (ms desde el inicio de inspección). */
  plusTwoAfterMs?: number;
  /** Umbral DNF (ms desde el inicio de inspección). */
  dnfAfterMs?: number;
  /** Penaltis permitidos (reutiliza Penalty de @cubeforge/timer-engine). */
  allowedPenalties: readonly Penalty[];
  /** Formato oficial del intento. */
  format: WcaAttemptFormat;
  /** Límite de tiempo oficial en ms (p. ej. MBLD 3_600_000). */
  timeLimitMs?: number;
  /** Cómo se puntúa el resultado. */
  scoring: 'time' | 'mbf-points' | 'fmc-moves';
}

export interface AnalysisCapability {
  /** Análisis de fases (splits) disponible. */
  phaseAnalysis: boolean;
  /** Métodos con detección de fases (p. ej. ['CFOP','Roux']). Vacío = ninguno. */
  methods: readonly string[];
  /** Reconocimiento de casos desde solves reales (gap §13.4/28 — hoy falso para todos). */
  caseRecognition: boolean;
}

export interface EventSpec {
  /** Código WCA. */
  id: WcaEventCode;
  /** puzzle_type canónico de persistencia (SSoT con la DB). */
  puzzleType: PuzzleType;
  /** puzzle_type legado mientras no se migre (p. ej. OH hoy se guarda '3x3x3'). */
  legacyPuzzleType?: PuzzleType;
  /** Label i18n (clave del namespace correspondiente). */
  labelKey: string;
  /** Orden para el motor 3D (2, 3, …); null = sin render 3D. */
  cubeOrder: number | null;
  /** Id del ScrambleProvider registrado (A4); null = sin provider (honesto). */
  scrambleProvider: string | null;
  /** Capacidad de análisis (solo declarativa en A1). */
  analysis: AnalysisCapability;
  /** Perfil de reglas WCA (solo declarativo en A1; se consume en A5). */
  rules: WcaRulesProfile;
  /** Estado frente al calendario WCA. */
  status: EventStatus;
  /** Fecha WCA de entrada en vigor (FTO: 2027-01-02). */
  effectiveFrom?: string;
  /** Fecha WCA de retirada (Clock: 2027-07-18). */
  effectiveUntil?: string;
}
```

## 5. Contenido del registro (18 specs — resumen de campos clave)

| id | puzzleType | provider (A4) | inspección | formato | análisis (hoy) | status |
|---|---|---|---|---|---|---|
| 222 | `2x2x2` | two-by-two-random-state | 15s→+2/17s→DNF | a5 | ninguno (realidad actual) | available |
| 333 | `3x3x3` | min2phase-random-state | 15s→+2/17s→DNF | a5 | CFOP/Roux | available |
| 333oh | `333oh` (legacy `3x3x3`) | min2phase-random-state | 15s→+2/17s→DNF | a5 | CFOP/Roux | available |
| 444–777 | `4x4x4`…`7x7x7` | null (pendiente D5/D6) | 15s→+2/17s→DNF | a5 | ninguno | available (provider pendiente) |
| 333bf | `333bf` | null | sin inspección | bo3 | ninguno | available (provider pendiente) |
| 333fm | `333fm` | null | sin inspección | mo3 | ninguno | available (provider pendiente) |
| 333mbf | `333mbf` | null | sin inspección | bo1, 1h | ninguno (scoring mbf-points) | available (provider pendiente) |
| 444bf/555bf | `444bf`/`555bf` | null | sin inspección | bo3 | ninguno | available (provider pendiente) |
| clock | `clock` | null | 15s→+2/17s→DNF | a5 | ninguno | **removed** (hasta 2027-07-18) |
| minx | `minx` | null | 15s→+2/17s→DNF | a5 | ninguno | available (provider pendiente) |
| pyram/skewb/sq1 | `pyram`/`skewb`/`sq1` | null | 15s→+2/17s→DNF | a5 | ninguno | available (provider pendiente) |
| fto | `fto` | null | 15s→+2/17s→DNF | a5 | ninguno | **planned** (desde 2027-01-02) |

Notas de honestidad (alineadas con la investigación §12.3):
- `provider: null` = "no disponible de verdad" — mata el puzzle fantasma a nivel de declaración (la UI lo bloquea en A6).
- OH declara `puzzleType: '333oh'` con `legacyPuzzleType: '3x3x3'`; la **migración de datos mezclados se hace en A2**, no aquí.
- 2×2 declara análisis `phaseAnalysis: false` **documentando la realidad actual** (PhaseSplitter/Metrics son CFOP/Roux de 3×3); la paridad es la Fase C.

## 6. Reglas de validación (tests del registro)

Cada test corre sobre el registro exportado:
1. **Unicidad**: 18 specs, códigos WCA únicos, `puzzleType` únicos (excepto `legacyPuzzleType`).
2. **SSoT con la DB**: `'3x3x3'` y `'2x2x2'` existen como puzzleType exactos (mismos strings persistidos hoy).
3. **Completitud de reglas**: todo spec `available` tiene perfil de reglas completo (inspección + penaltis + formato + scoring).
4. **Fechas WCA**: FTO tiene `effectiveFrom: '2027-01-02'` y status `planned`; Clock tiene `effectiveUntil: '2027-07-18'` y status `removed`.
5. **Provider honesto**: specs con `provider: null` no generan scramble (validación de que nadie cae a un default silencioso).
6. **Cobertura**: el conjunto de códigos cubre exactamente la lista oficial de agosto 2026 (17) + FTO.

## 7. Puntos de integración futura (no implementar en A1)

| Fase | Consumo | Estado |
|---|---|---|
| A4 | `ScrambleProvider` registry: `generateScrambleFor()` lee `spec.scrambleProvider` (salidas 2×2/3×3 byte-idénticas) | ✅ |
| A5 | `WcaRules` perfilado: el timer lee `spec.rules` (3×3: mismo comportamiento hoy) | ✅ |
| A6 | Selector/sesiones data-driven desde `spec.status` (fin de los puzzles fantasma; OH separado) | ✅ |
| A2 | Migración de OH (usa `legacyPuzzleType`) y validación DB contra `puzzleType` del registro | ✅ (ADR-002: `puzzle_type` = código WCA) |

## 8. Archivos

**Nuevos** (sin tocar nada existente):
```
packages/events/package.json
packages/events/tsconfig.json
packages/events/tsup.config.ts        (si el resto de paquetes usa tsup)
packages/events/src/index.ts          (exports del registro)
packages/events/src/spec.ts           (tipos del EventSpec)
packages/events/src/registry.ts       (los 18 specs)
packages/events/src/__tests__/registry.test.ts
```
El workspace ya incluye `packages/*` en `pnpm-workspace.yaml` — no requiere cambios de config del repo.

## 9. Exit Criteria (Definición de Done, Master Roadmap §9)

1. `packages/events` compila y typecheckea; los 6 tests de validación pasan.
2. Suite completa del monorepo + typecheck sin regresiones (contrato de no-regresión §2).
3. Cero archivos existentes modificados (verificable: `git status` solo muestra el paquete nuevo).
4. El ADR de ubicación (packages/events vs packages/types) está resuelto.
5. Revisión del lead architect sobre los campos del spec antes de que lo consuma A4.
