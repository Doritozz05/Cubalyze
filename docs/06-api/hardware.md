# Paquetes de Hardware

> Sub-fase 4.4 · 2026-08-12

## `@cubeforge/hardware-hal` — Hardware Abstraction Layer (13 archivos)

**Propósito:** la capa de abstracción de hardware (ADR-012): una interfaz única
para smart cubes/timers que soporta Web Bluetooth (web), Tauri (desktop) y el
cubo virtual — todos consumen la misma lógica de validación.

- **API:** re-exports `*` (interfaz del adaptador global, streams rxjs) +
  `ClockDriftReconciler` (reconciliación de deriva de reloj del hardware).
- **Dependencias:** `@cubeforge/gan-protocol`, `@cubeforge/types`, `rxjs`.
- **Consumido por:** web (`useScrambleValidator`, `orientationTracking`,
  `CubeConnector`), desktop (adapters Tauri `GanCubeAdapterTauri`/
  `GanTimerAdapterTauri`), vista Cube (adaptador del cubo virtual).

## `@cubeforge/gan-protocol` — protocolo Gan (9 archivos)

**Propósito:** implementación del protocolo BLE de los cubos/timers **Gan**:
parseo de frames, cifrado (`aes-js`), comandos, streams.

- **Dependencias:** `aes-js`, `rxjs`.
- **Consumido por:** `@cubeforge/hardware-hal` (adaptadores).

## `@cubeforge/timer-engine` — motor del temporizador (9 archivos)

**Propósito:** la máquina de estados del cronómetro: inspección WCA (15s, avisos
8s/12s), hold-to-arm, fases idle→cooldown, penalizaciones (+2/DNF), 60fps.

- **API:** re-exports `*` (`TimerEngine` y fases; ver también `TimerPhase` en
  `@cubeforge/state`).
- **Dependencias:** `rxjs` (streams de ticks).
- **Consumido por:** web (TimerContainer, useSolveSession, useDrillTimer),
  training (`createTrainingTimer`).
- **Diseño:** [TDD core/0004](../../05-tdd/core/0004-timer-engine.md).
