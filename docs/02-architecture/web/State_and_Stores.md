# Estado y Stores (apps/web)

> Documentado el 2026-08-12. Todo el estado global vive en el paquete
> `@cubeforge/state` (Zustand, ADR-009). Los stores de la web son solo
> auxiliares de una vista concreta.

## `@cubeforge/state` — stores globales (Zustand vanilla)

| Store | Archivo | Qué guarda | Persistido |
| --- | --- | --- | --- |
| `preferencesStore` | `store.ts` | ~40 preferencias del usuario: theme, header, apariencia 3D, inspección WCA, scramble (display/verification/followsCube), método, focus mode, audio cues (voz 8s/12s), celebraciones PB, stickers custom, velocidad de giro, hardware timer, atajos, hold delay, BPA/WPA, precisión de tiempo, input mode (timer/manual), click-to-start, haptics, session stats, notificaciones/sonidos/recordatorios, beta features, idioma | ✅ `cubeforge-prefs` v1 (rehidratado síncrono; `partialize` explícito; `resetPreferences`) |
| `timerStore` | `timer.store.ts` | Fase del temporizador (`idle | inspection | touching | ready | running | stopped | cooldown`), `elapsedMs`, penalización (`none | +2 | dnf`) | ❌ |
| `sessionStore` | `session.store.ts` | Sesión actual (`currentSessionId`, `sessionName`), `solves` en memoria, `isRecording`; `addSolve`/`removeSolve`/`clearSession` | ❌ (los solves persisten en SQLite, ADR-013) |
| `connectionStore` | `connection.store.ts` | Estado de conexión del smart cube: `status` (disconnected/connecting/connected/reconnecting), `deviceName`, `deviceModel`, `batteryLevel`, `error` | ❌ |
| `orientationStore` | `orientation.store.ts` | Orientación del cubo (quaternion, faceMap, label) + capacidades (IMU, gyro) | ❌ |
| `algorithmStore` | `algorithm.store.ts` | **Algoritmos personalizados** (`customAlgorithms`) y **orden de casos** (`caseOrder`, para el drag-and-drop de la vista Algorithms); `addCustomAlgorithm`/`update`/`remove`/`setCaseOrder`/`moveAlgorithm`/`getOrderedIds` | ✅ (persist) |

**Regla del paquete** (ADR-009): los stores son *vanilla* (sin React) y se
consumen con `useStore(store, selector)`; el estado de alta frecuencia (timer,
orientación) se muta fuera del render de React (`getState()`/`setState()`).

## Stores locales de la web (`apps/web/src/stores/`)

| Store | Qué es |
| --- | --- |
| `virtualScrambleStore.ts` | Estado del **cubo virtual** (la sesión del simulador de la vista Cube): scramble aplicado, turnos, validación — un adaptador equivalente al smart cube real para que la validación sea la misma (ver `useScrambleValidator`) |
| `storageStatus.ts` | Estado del almacenamiento: `opfs`/`desktop` = persistente, `memory` = se pierde al recargar, `unknown` = sin comprobar (inspector de Settings → Advanced) |

## Flujo de datos típico

1. **Timer** → `timerStore` (fase/elapsedMs, alta frecuencia, fuera de React).
2. **Solve completo** → `useSolveSession` construye el solve (tiempo, scramble,
   penalización, movimientos + orientaciones) → `sessionStore.addSolve` (memoria)
   + persistencia SQLite (`@cubeforge/database`) → widgets vía `WidgetHostAPI`.
3. **Preferencias** → `preferencesStore` (localStorage) consumidas por Timer,
   Settings, Scramble, Cube, i18n (`language`), hardware, etc.
4. **Smart cube** → `connectionStore` + `orientationStore` (stream del adaptador
   global, servicio `orientationTracking`).
