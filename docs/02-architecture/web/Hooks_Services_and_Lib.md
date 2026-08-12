# Hooks, Servicios y Lib (apps/web)

> Documentado el 2026-08-12. Los hooks son la capa de orquestación entre la UI
> y los paquetes de dominio (state, database, training, timer-engine,
> analysis-engine, solver-engine).

## Hooks por área

### Flujo del temporizador y del solve (el núcleo)
| Hook | Qué hace |
| --- | --- |
| `useSolveSession` | Orquesta una sesión de solve: registro de movimientos (eventos wide expandidos a tokens de estado exactos), orientaciones, y la pipeline de completado (`onSolve` → persistencia) |
| `useTimerKeyboard` | Control global con la barra espaciadora (hold-to-arm, release-to-start), fase capture; compartido por `useSolveSession` y `useDrillTimer` |
| `useScrambleValidator` | Valida que el scramble se haya aplicado de verdad (con smart cube O cubo virtual — el mismo adaptador mínimo para ambos) |
| `useSolveCompletion` | Pipeline de fin de solve (penalización, métricas, persistencia) |
| `useTimerFocus` | Focus mode (oculta todo salvo el timer) |
| `usePersistentSession` | Sesiones persistentes (metadatos de sesión, `@cubeforge/database`) |
| `useManualSolves` | Entrada manual de tiempos (inline + sheet) |
| `pressDispatch` / `shouldAutoArm` / `onboardingCore` | Lógica pura extraída y testeada (dispatch de pulsaciones, auto-arm del timer, core del onboarding) |

### Cubo virtual y 3D
| Hook | Qué hace |
| --- | --- |
| `useVirtualCubeSession` | Sesión del cubo virtual (vista Cube): solve virtual con movimientos + orientaciones, misma forma que un solve smart cube |
| `useCube3D` / `useCubeTurnControls` | Motor 3D: montaje y controles de giro (teclado/drag) con `cubeTurnSpeed` |
| `useOrientation` | Consume `orientationStore` (orientación del cubo) |
| `useCrossScramble` | Scramble dirigido de Cross (drills) |

### Training / SRS / Perfil
| Hook | Qué hace |
| --- | --- |
| `useTrainingProgress` / `useTrainingEngine` / `useTrainingSession` | Progreso FSRS (singleton pre-caliente), engine y sesiones de entrenamiento (ver TDD-0001) |
| `useDrillTimer` / `useDrillSmartCube` | Timer ligero de drills (sin inspección) y validación smart cube de drills |
| `usePracticeSession` | Sesión de práctica genérica (métricas por ejercicio) |
| `useSRSQueue` / `useReminderScheduler` | Cola SRS diaria y recordatorios (notificaciones/reminders) |
| `useProfile` / `useProfileStats` | Datos del perfil y estadísticas (rachas, heatmap) |
| `useSkillProgress` | Progreso del árbol de habilidades (`skill_progress`) |
| `useCaseAlgorithms` | Algoritmos de un caso (catálogo + custom) |

### UI / utilidades
| Hook | Qué hace |
| --- | --- |
| `use-mobile` | Detección touch/responsive (post-mount, sin SSR flash) |
| `useReducedMotion` | Preferencia de movimiento reducido |
| `useDraggable` / `useGlobalDragCursor` | Drag genérico y cursor global durante drag |
| `useGlobalShortcuts` / `useShortcuts` | Atajos globales (configurables en Settings → Shortcuts) |
| `useOnboarding` / `useOnboardingTour` | Tour de primer uso (TDD-0020) |
| `useCalendarTasks` | Tareas del calendario de Training (SQLite + migración localStorage) |
| `solveSessionDebug` | Utilidad de depuración de sesiones |

## Servicios (`apps/web/src/services/`)

| Servicio | Qué hace |
| --- | --- |
| `orientationTracking.ts` | Servicio headless de **seguimiento de orientación**: consume el stream de giroscopio del adaptador smart cube global y es el ÚNICO que escribe en `orientationStore` |
| `Case3DRenderAdapter.ts` | Aplica un plan de render neutro (`CaseRenderPlan` de `@cubeforge/algorithm-db`) al motor 3D — adaptador entre catálogo y engine |
| `Global3DSnapshotService.ts` | Snapshots 3D persistentes por caso (prefijo `cubeforge_snap_3d_v8_`) para el panel 3D |

## Lib (`apps/web/src/lib/`)

| Módulo | Qué hace |
| --- | --- |
| `announce.ts` | **Live regions** de accesibilidad (ADR-020): `announce()` + hook `useAnnounce` para lectores de pantalla (verdicts de drills, review SRS, etc.) |
| `keybinds/` | Sistema de atajos de teclado (definiciones, parsing, aplicador) — configurables |
| `touch.ts` | Utilidades touch (`TOUCH_FULL_BLEED`, zonas de toque) usadas por calendar, aside y overlays |
| `utils.ts` | Utilidades generales (`cn` de tailwind-merge, formatters) |
