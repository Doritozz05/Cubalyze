# Auditoría: Inventario completo de debilidades, problemas y bugs

> **Leyenda:** ✅ Corregido | 🔄 En progreso | ❌ Pendiente
> **Severidad:** 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🟢 Bajo

---

## 🔴 BUGS (Fallo demostrable del sistema)

### B-1 🔴 Crítico — Race condition: primeros movimientos BLE perdidos tras conectar

| Campo                   | Valor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**        | ✅ Corregido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Archivos**      | `packages/gan-protocol/src/gan-cube-protocol.ts:199,213`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Solución**      | `events$` cambiado de `Subject` a `ReplaySubject<GanCubeEvent>(1)` en `GanCubeClassicConnection`. Esto bufferiza el último evento emitido y lo replica al suscriptor aunque la suscripción ocurra después de `startNotifications()`. Se eliminó import de `Subject` y se añadió `ReplaySubject` de RxJS.                                                                                                                                                                                          |

- [x] Corregido

---

### B-2 🔴 Crítico — Mapeo incorrecto de estados GAN Timer

| Campo                  | Valor                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**       | ✅ Corregido                                                                                                                                                                                                   |
| **Archivo**      | `packages/hardware-hal/src/bluetooth/GanTimerAdapter.ts:38-47`                                                                                                                                               |
| **Solución**     | `GET_SET` y `FINISHED` movidos del case `hardwareDown` al case `hardwareUp`. `HANDS_ON` permanece como `hardwareDown`.                                                                                        |

- [x] Corregido

---

### B-3 🟠 Alto — Doble corrección de clock drift

| Campo               | Valor                                                                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**    | ✅ Corregido                                                                                                                                                                                                                                                                                                                 |
| **Archivos**  | `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts`, `packages/hardware-hal/src/sync/ClockDrift.ts` (eliminado)                                                                                                                                                                                                      |
| **Solución**  | Eliminado `ClockDriftReconciler` de `GanCubeAdapter`. `hostTimestamp` ahora usa `performance.now()` sin corrección dual. La corrección real se aplica post-solve vía `cubeTimestampLinearFit()` en `utils.ts` (más robusta). Archivo `ClockDrift.ts` y su test eliminados. |

- [x] Corregido

---

### B-4 🟠 Alto — GanTimerAdapter: evento DISCONNECT duplicado

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ✅ Corregido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanTimerAdapter.ts:23-25`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Solución** | Eliminado bloque `if` pre-switch. `DISCONNECT` se maneja dentro del switch: llama `this.disconnect()` y `return` inmediatamente, sin emitir eventos sobre Subject destruido. |

- [x] Corregido

---

### B-5 🟡 Medio — GanTimerAdapter: transiciones incorrectas durante RUNNING

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ✅ Corregido                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanTimerAdapter.ts:27-56`                                                                                                                                                                                                                                                                                                                                              |
| **Solución** | `IDLE` separado del case `hardwareUp` y ahora emite `hardwareReset`. `RUNNING` no necesita case (el timeout del protocolo es informativo; TimerEngine deriva estado de eventos hardwareDown/hardwareUp). |

- [x] Corregido

---

## 🏗️ PROBLEMAS DE ARQUITECTURA

### A-1 🔴 Crítico — SyncBridge sin buffer de movimientos

| Campo                  | Valor                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**       | ❌ Pendiente                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Archivo**      | `packages/cube-3d-engine/src/hardware/SyncBridge.ts:49-61`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Problema**     | `applyMove()` hace `await this.workerProxy.rotateLayer(...)` para **CADA** movimiento. Si el cubo envía movimientos más rápido que la duración de la animación (150ms), las promesas se encadenan secuencialmente: el movimiento N+1 no comienza hasta que termine N. El `snapActiveTask()` mitiga el backlog truncando la animación activa, pero si hay muchos movimientos rápidos (TPS > 6), el tiempo total de animación puede exceder el tiempo real. |
| **Consecuencia** | Desincronización progresiva entre cubo físico y virtual en solves rápidos.                                                                                                                                                                                                                                                                                                                                                                                                 |

- [ ] Corregido

---

### A-2 🟠 Alto — TimerEngine usa EventTarget, no RxJS

| Campo               | Valor                                                                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**    | ❌ Pendiente                                                                                                                                                                                                                                                                                 |
| **Archivo**   | `packages/timer-engine/src/TimerEngine.ts:23`                                                                                                                                                                                                                                              |
| **Problema**  | `class TimerEngine extends EventTarget`. El resto del sistema usa RxJS (`Observable`/`Subject`). Esto obliga a los consumidores a manejar dos paradigmas de eventos. Los `CustomEvent`s (`TimerTickEvent`, `TimerStateChangeEvent`, etc.) no son compatibles con operators RxJS. |
| **Contraste** | `gan-web-bluetooth`, `GanCubeAdapter`, `GanTimerAdapter`, `StackmatAdapter` todos usan RxJS.                                                                                                                                                                                         |

- [ ] Corregido

---

### A-3 🟠 Alto — FACE_ROTATION_MAP está en types, debería estar en cube-3d-engine

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Archivo**  | `packages/types/src/index.ts:62-69`                                                                                                                                                                                                                                                                                                                                                                                         |
| **Problema** | `FACE_ROTATION_MAP` es una constante de **RENDERIZADO 3D** (mapea caras a ejes de rotación). Está en `@cubeforge/types` cuando debería estar en `@cubeforge/cube-3d-engine`. Types debería contener solo interfaces y tipos, no constantes de implementación. Esto fuerza a `cube-3d-engine` y `hardware-hal` a depender de `types` para una constante que es detalle de implementación del motor 3D. |

- [ ] Corregido

---

### A-4 🟠 Alto — Zustand infrautilizado

| Campo               | Valor                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**    | ❌ Pendiente                                                                                                                                                                                                                                                                                                                    |
| **Archivos**  | `packages/state/src/store.ts:1-16`                                                                                                                                                                                                                                                                                            |
| **Problema**  | El único store existente guarda`theme: 'light' \| 'dark' \| 'system'`. **No existen stores para:** estado de sesión activa (solve en curso, timer running), estado de conexión BLE (conectado/desconectado/reconectando), solves pendientes de sincronización, datos del cubo conectado (modelo, batería, firmware). |
| **Contraste** | La documentación ADR-009 describe Zustand para "Timer, Hardware BLE, sesión en memoria", pero la implementación no refleja esto.                                                                                                                                                                                             |

- [ ] Corregido

---

### A-5 🟠 Alto — Modelos de datos sin integración con base de datos

| Campo              | Valor                                                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                           |
| **Archivos** | `packages/models/src/schemas/*.ts`, `packages/database/src/worker.ts:21-26`                                                                                                                                                                                                        |
| **Problema** | `@cubeforge/models` define schemas Zod para `Solve`, `Session`, `Algorithm`. `@cubeforge/database` tiene SQLite WASM con tabla `kv_store` genérica. **No hay** `CREATE TABLE` para `solves`, `sessions`, `algorithms`. No hay migraciones. No hay índices. |

- [ ] Corregido

---

### A-6 🟡 Medio — database/ usa import desde worker.js con extensión .js

| Campo              | Valor                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                  |
| **Archivo**  | `packages/database/src/client.ts:14`                                                                                                                                                                                                                        |
| **Problema** | `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`. El archivo real es `worker.ts`, no `worker.js`. En desarrollo, Vite resuelve esto. En producción con `tsup`, el worker empaquetado puede no tener la extensión esperada. |

- [ ] Corregido

---

### A-7 🟡 Medio — Cadena de dependencia entre paquetes incompleta en package.json

| Campo              | Valor                                                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                         |
| **Archivo**  | `packages/cube-3d-engine/package.json`                                                                                                                                                                                                                             |
| **Problema** | `@cubeforge/cube-3d-engine` tiene `exports: { ".": ..., "./worker": ..., "./src/*": "./src/*" }`. El export `./src/*` permite imports directos a source, lo que rompe el encapsulamiento del paquete y puede causar problemas en producción si no se compila. |

- [ ] Corregido

---

## 📡 PROBLEMAS DE BLE / HARDWARE HAL

### H-1 🟠 Alto — GanCubeAdapter.model hardcodeado

| Campo              | Valor                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                 |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:25`                                                                                                                                                                                                 |
| **Código**  | `public readonly model = 'SmartCube';`                                                                                                                                                                                                                     |
| **Problema** | La interfaz`SmartCubeAdapter` del PRD especifica `supportedModels: string[]`. El modelo real llega en los eventos `HARDWARE` del protocolo (`hardwareName`, ej. "GAN12uiM", "GAN356i3") pero nunca se expone. El adaptador siempre dice "SmartCube". |

- [ ] Corregido

---

### H-2 🟠 Alto — Sin reconexión BLE automática

| Campo              | Valor                                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                              |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:92-97`                                                                                                                                                                                                                           |
| **Problema** | `disconnect()` setea `connection = null` y no retiene el `BluetoothDevice`. **No hay:** (a) almacenamiento del device para reconexión sin diálogo, (b) exponential backoff, (c) evento de reconnected, (d) detección de desconexión inesperada con reintento automático. |

- [ ] Corregido

---

### H-3 🟡 Medio — GanCubeAdapter suscripción única, sin cleanup completo

| Campo              | Valor                                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                  |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:59-89`                                                                                                                                                               |
| **Problema** | La suscripción a`connection.events$` se crea en `connect()` pero nunca se almacena el `Subscription` para hacer `unsubscribe()` en `disconnect()`. Si se llama `connect()` dos veces, se acumulan suscripciones. |

- [ ] Corregido

---

### H-4 🟡 Medio — GanCubeAdapter.parseMoveNotation() falla silenciosamente

| Campo              | Valor                                                                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                             |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:11-21, 71`                                                                                                                                                                      |
| **Problema** | Si un movimiento no se reconoce (ej. notación nueva o corrupta),`parseMoveNotation()` devuelve `null` y el movimiento se ignora sin log, sin contador, sin evento de error. No hay trazabilidad de movimientos perdidos por parseo. |

- [ ] Corregido

---

### H-5 🟡 Medio — GyroEvent.velocity ignorado

| Campo              | Valor                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:79-87`                                                                                                                             |
| **Problema** | El código solo extrae`evt.quaternion` del evento `GYRO`. Ignora `evt.velocity` (velocidad angular). PRD 8.2 requiere detección de regrips, que necesita datos de velocidad angular. |

- [ ] Corregido

---

### H-6 🟢 Bajo — GanCubeAdapter.connect() recibe manualMac pero el tipo no es opcional

| Campo              | Valor                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                   |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:42`                                   |
| **Firma**    | `async connect(manualMac?: string): Promise<void>`                                           |
| **Problema** | `SmartCubeAdapter` interface no define `manualMac`. Esto rompe el contrato de la interfaz. |

- [ ] Corregido

---

### H-7 🟢 Bajo — StackmatProcessor no verifica suficientes samples para el start bit

| Campo              | Valor                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                                                  |
| **Archivo**  | `packages/hardware-hal/src/audio/StackmatProcessor.ts:32`                                                                                                                                                                                                                                                   |
| **Problema** | La detección de start edge (`lastSample <= 0 && sample > 0`) es naive. Cualquier cruce por cero positivo dispara la decodificación. No hay verificación de que el nivel positivo se mantenga por la duración de un start bit (~36 samples a 44100Hz). Esto produce falsos positivos con ruido ambiente. |

- [ ] Corregido

---

### H-8 🟢 Bajo — StackmatProcessor hardcodeado a 1200 baud

| Campo              | Valor                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                        |
| **Archivo**  | `packages/hardware-hal/src/audio/StackmatProcessor.ts:16`                                         |
| **Código**  | `this.samplesPerBit = this.sampleRate / 1200;`                                                    |
| **Problema** | Stackmat Gen5 usa 2400 baud. No hay detección automática de baud rate ni parámetro configurable. |

- [ ] Corregido

---

## 🎮 PROBLEMAS DEL MOTOR 3D

### R-1 🟡 Medio — SceneManager.dispose() incompleto

| Campo                  | Valor                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**       | ❌ Pendiente                                                                                                                                     |
| **Archivo**      | `packages/cube-3d-engine/src/core/SceneManager.ts:57-60`                                                                                       |
| **Código**      | `public dispose(): void { this.renderer.dispose(); // In a full implementation, we traverse this.scene and dispose all geometries/materials }` |
| **Consecuencia** | Memory leaks en SPA con navegación entre rutas. Los`Mesh`, `Geometry` y `Material` creados no se liberan.                                 |

- [ ] Corregido

---

### R-2 🟡 Medio — Sin clamp de pixel ratio

| Campo              | Valor                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                              |
| **Archivo**  | `packages/cube-3d-engine/src/core/SceneManager.ts:30`                                                                                                                                                                                   |
| **Código**  | `this.renderer.setPixelRatio(pixelRatio);`                                                                                                                                                                                              |
| **Problema** | Sin`Math.min(pixelRatio, 2)`. En dispositivos con 3x pixel ratio, se renderiza a 3x la resolución, saturando la GPU sin beneficio visual apreciable en un cubo 3D. Práctica estándar en Three.js: `Math.min(devicePixelRatio, 2)`. |

- [ ] Corregido

---

### R-3 🟡 Medio — Cámara fija, sin controles de órbita

| Campo              | Valor                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                  |
| **Archivo**  | `packages/cube-3d-engine/src/core/SceneManager.ts:25-27`                                                                                                    |
| **Problema** | La cámara es perspectiva fija mirando al origen. PRD 6.2 requiere "Free camera control (rotation, zoom)". No hay`OrbitControls` ni implementación propia. |

- [ ] Corregido

---

### R-4 🟡 Medio — Iluminación básica no configurable

| Campo              | Valor                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                              |
| **Archivo**  | `packages/cube-3d-engine/src/core/SceneManager.ts:36-43`                                                                                                                |
| **Problema** | Una`AmbientLight` fija (0.6) + una `DirectionalLight` fija (0.8). Para temas visuales personalizados o modos de análisis, se necesitaría iluminación configurable. |

- [ ] Corregido

---

### R-5 🟢 Bajo — highlightCubie() rompe material pooling

| Campo              | Valor                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                        |
| **Archivo**  | `packages/cube-3d-engine/src/core/CubeMeshFactory.ts:148-162`                                                                                                                                                                                                     |
| **Problema** | `highlightCubie()` clona materiales por cada highlight. Si hay múltiples cubies resaltados simultáneamente, cada uno tiene su propio material, incrementando draw calls. Esto invalida el pooling de materiales que es la razón de ser de `CubeMeshFactory`. |

- [ ] Corregido

---

### R-6 🟢 Bajo — RotationEngine.update() no llama updateMatrixWorld()

| Campo              | Valor                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                            |
| **Archivo**  | `packages/cube-3d-engine/src/animation/RotationEngine.ts:84-101`                                                                                                                                                                                      |
| **Problema** | En commits anteriores se llamaba`this.pivot.updateMatrixWorld(true)` después de copiar el quaternion. Se eliminó (commit `19805e0`). Si algún sistema downstream necesita la matriz del pivot actualizada, puede leer una matriz desactualizada. |

- [ ] Corregido

---

### R-7 🟢 Bajo — GyroFusion.updateTargetQuaternion() sin cobertura de tests

| Campo              | Valor                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                   |
| **Archivo**  | `packages/cube-3d-engine/src/hardware/GyroFusion.ts:38-46`                                                                                                                                                   |
| **Problema** | El mapeo de coordenadas ha cambiado 3 veces en commits recientes:`(-x, z, y)` → `(-x, z, -y)` → `(x, z, -y)`. No hay tests unitarios que verifiquen que el mapeo es correcto para cada modelo de cubo. |

- [ ] Corregido

---

### R-8 🟢 Bajo — SceneManager no tiene evento de render listo

| Campo              | Valor                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                      |
| **Archivo**  | `packages/cube-3d-engine/src/core/SceneManager.ts:53-55`                                                                                                        |
| **Problema** | `render()` es `void`. No hay forma de que el resto del sistema sepa cuándo se ha completado un frame de renderizado (para overlays, HUD sincronizado, etc.). |

- [ ] Corregido

---

## ⏱️ PROBLEMAS DEL TIMER

### T-1 🟠 Alto — Sin timeout de inspección

| Campo              | Valor                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                           |
| **Archivo**  | `packages/timer-engine/src/TimerEngine.ts:52-62`                                                                                                                                                     |
| **Problema** | `startInspection()` cambia a `INSPECTION` pero no hay timeout. Si el usuario nunca toca, se queda en `INSPECTION` para siempre. WCA A3b: 15 segundos para comenzar, +2 a los 15s, DNF a los 17s. |

- [ ] Corregido

---

### T-2 🟡 Medio — Inconsistencia temporal en penalización por inspección

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Archivo**  | `packages/timer-engine/src/TimerEngine.ts:74-83`                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Problema** | `handleDown()` calcula `elapsed = now - inspectionStartTimestamp` donde `now` es el momento de `handleDown()`. Pero `tick()` también calcula la penalización durante `TOUCHING` (línea 206). Si el usuario mantiene 1s en `TOUCHING` antes de soltar, la penalización calculada en `tick()` (incorrecta, porque usa `performance.now()` actual en lugar del momento de `handleDown`) diferirá de la calculada en `handleDown()`. |
| **Además**  | `elapsed` en `handleDown()` se calcula con `now` que fue obtenido al inicio de la función (línea 65), pero han pasado líneas de código hasta la 75 donde se usa. En JS esto es despreciable, pero el principio es incorrecto.                                                                                                                                                                                                                     |

- [ ] Corregido

---

### T-3 🟡 Medio — handleUp() durante COOLDOWN no manejado

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                                                                                                                       |
| **Archivo**  | `packages/timer-engine/src/TimerEngine.ts:104-125`                                                                                                                                                                                                                                                                                                                               |
| **Problema** | Si el usuario suelta las manos durante`COOLDOWN` (el período entre que se pulsa para parar y que el timer se establece como `STOPPED`), `handleUp()` no hace nada porque `TOUCHING` es la única transición que maneja. Según WCA, una vez detenido el timer, las manos pueden retirarse sin efecto. Pero la ausencia de manejo explícito deja el evento sin procesar. |

- [ ] Corregido

---

### T-4 🟢 Bajo — startInspection() silenciosamente ignorado si useInspection=false

| Campo              | Valor                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                                               |
| **Archivo**  | `packages/timer-engine/src/TimerEngine.ts:53`                                                                                            |
| **Código**  | `if (!this.config.useInspection) return;`                                                                                                |
| **Problema** | La llamada falla silenciosamente. La UI llamante no sabe por qué no empezó la inspección. Debería lanzar un error o devolver`false`. |

- [ ] Corregido

---

### T-5 🟢 Bajo — addModifier() permite OK después de DNF

| Campo              | Valor                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                          |
| **Archivo**  | `packages/timer-engine/src/TimerEngine.ts:127-148`                                                                                                  |
| **Problema** | Se puede llamar`addModifier('OK')` después de `addModifier('DNF')`, cambiando un DNF a un solve válido. Esto no debería permitirse según WCA. |

- [ ] Corregido

---

### T-6 🟢 Bajo — reset() ignora COOLDOWN pero no hay feedback

| Campo              | Valor                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                    |
| **Archivo**  | `packages/timer-engine/src/TimerEngine.ts:150-161`                                                                            |
| **Problema** | `reset()` retorna `void`. La UI no sabe si el reset se ignoró (`COOLDOWN`) o se ejecutó. Debería devolver `boolean`. |

- [ ] Corregido

---

## 💾 PROBLEMAS DEL MODELO DE DATOS

### D-1 🟠 Alto — SolveSchema no almacena movimientos

| Campo              | Valor                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                          |
| **Archivo**  | `packages/models/src/schemas/solve.schema.ts:3-11`                                                                                                                                                                  |
| **Problema** | Un solve necesita almacenar la secuencia de movimientos para playback en 3D y re-análisis (PRD 4.4). El schema solo tiene`timeMs`, `scramble`, `penalty`, `method`. No hay campo `moves: CubeMoveEvent[]`. |

- [ ] Corregido

---

### D-2 🟡 Medio — SessionSchema.solves embebido, no referenciado

| Campo              | Valor                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                      |
| **Archivo**  | `packages/models/src/schemas/session.schema.ts:9`                                                                                                                                               |
| **Código**  | `solves: z.array(SolveSchema).default([])`                                                                                                                                                      |
| **Problema** | Los solves están embebidos dentro de la sesión. Para un usuario con 100,000 solves, cargar la sesión requeriría cargar todos los solves. Debería ser una relación separada con paginación. |

- [ ] Corregido

---

### D-3 🟡 Medio — algorithm.schema.ts: moves es string, no string[]

| Campo              | Valor                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                      |
| **Archivo**  | `packages/models/src/schemas/algorithm.schema.ts:6`                                                                                             |
| **Código**  | `moves: z.string()`                                                                                                                             |
| **Problema** | Un algoritmo debería almacenarse como array de strings o notación estructurada, no como string plano. Dificulta el análisis y la comparación. |

- [ ] Corregido

---

### D-4 🟢 Bajo — Sin timestamps de creación/actualización en schemas

| Campo              | Valor                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                            |
| **Problema** | Los schemas no tienen`createdAt`, `updatedAt`. Dificulta la sincronización offline y la resolución de conflictos. |

- [ ] Corregido

---

### D-5 🟢 Bajo — AlgorithmSchema no tiene campo para algoritmo alternativo

| Campo              | Valor                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                    |
| **Problema** | PRD 10.1 especifica "Notation of the algorithm(s): primary and alternatives". El schema solo tiene un`moves`. |

- [ ] Corregido

---

### D-6 🟢 Bajo — Sin índice de versión de analysis engine en schemas

| Campo              | Valor                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                     |
| **Problema** | PRD 8.4 especifica versionado del analysis engine para re-análisis retroactivo. No hay campo en ningún schema. |

- [ ] Corregido

---

## 🖥️ PROBLEMAS DE UX / FRONTEND

### U-1 🟠 Alto — App.tsx: uso de useState para estado de conexión

| Campo              | Valor                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                             |
| **Archivo**  | `apps/web/src/App.tsx:14`                                                                                                                                                                                              |
| **Problema** | `const [status, setStatus] = useState('Disconnected');`. El estado de conexión BLE se maneja con React state local, que se pierde en re-renders y no es accesible desde otros componentes. Debería estar en Zustand. |

- [ ] Corregido

---

### U-2 🟡 Medio — App.tsx: useEffect no maneja remount de StrictMode

| Campo              | Valor                                                                                                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                        |
| **Archivo**  | `apps/web/src/App.tsx:24-55`                                                                                                                                                                                                                                                      |
| **Problema** | El flag`isInitialized` previene la doble inicialización de React StrictMode, pero el `OffscreenCanvas` transferido no puede transferirse dos veces. En desarrollo con StrictMode, el segundo mount lanza catch con "Canvas already transferred". Funciona, pero no es robusto. |

- [ ] Corregido

---

### U-3 🟡 Medio — App.tsx: import del Worker con path relativo

| Campo              | Valor                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                            |
| **Archivo**  | `apps/web/src/App.tsx:8`                                                                                                                                                                              |
| **Código**  | `import EngineWorker from '../../../packages/cube-3d-engine/src/workers/EngineWorker?worker'`                                                                                                         |
| **Problema** | Path relativo que atraviesa directorios del monorepo. Si la estructura cambia, se rompe. Debería ser`import EngineWorker from '@cubeforge/cube-3d-engine/worker'` usando el export del package.json. |

- [ ] Corregido

---

### U-4 🟢 Bajo — App.css contiene estilos de template Vite no utilizados

| Campo              | Valor                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                |
| **Archivo**  | `apps/web/src/App.css`                                                                                                                                                                    |
| **Problema** | Los estilos`.hero`, `.base`, `.framework`, `.vite`, `#next-steps`, `#docs`, `#spacer`, `.ticks` son del template Vite por defecto y no se usan en el componente App actual. |

- [ ] Corregido

---

### U-5 🟢 Bajo — index.css tiene body {} definido dos veces

| Campo              | Valor                                                               |
| ------------------ | ------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                        |
| **Archivo**  | `apps/web/src/index.css:15-21` y `apps/web/src/index.css:55-57` |
| **Problema** | `body` se define dos veces, la segunda sobrescribe la primera.    |

- [ ] Corregido

---

### U-6 🟢 Bajo — index.css usa variables CSS no definidas

| Campo             | Valor                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**  | ❌ Pendiente                                                                                                                                                                              |
| **Archivo** | `apps/web/src/index.css:61,90`                                                                                                                                                          |
| **Código** | `font-family: var(--heading);` y `font-family: var(--mono);`. Estas variables (`--heading`, `--mono`) no están definidas en `:root`. Fallback al `font-family` del `body`. |

- [ ] Corregido

---

### U-7 🟢 Bajo — No hay configuración PWA

| Campo              | Valor                                                                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                             |
| **Archivo**  | `apps/web/vite.config.ts:1-7`                                                                                                                                                                                                          |
| **Problema** | `vite-plugin-pwa` está en `package.json` dependencies pero no se configura en `vite.config.ts`. PRD Parte 2 principio 3: Offline-first. Sin configuración PWA, no hay service worker, no hay instalación, no hay cache offline. |

- [ ] Corregido

---

### U-8 🟢 Bajo — Sin TypeScript strict en apps/web

| Campo              | Valor                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                |
| **Archivo**  | `apps/web/src/App.tsx:7`                                                                                                                  |
| **Código**  | `// @ts-expect-error - Vite handles ?worker imports`                                                                                      |
| **Problema** | Se usa`@ts-expect-error` para silenciar un error de tipos. Indica que los tipos no están configurados para soportar imports `?worker`. |

- [ ] Corregido

---

## ⚙️ PROBLEMAS DE INFRAESTRUCTURA / CONFIGURACIÓN

### I-1 🟡 Medio — Sin configuración de coverage en tests

| Campo              | Valor                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                   |
| **Problema** | No hay configuración de coverage en ningún paquete. No se puede medir la cobertura de tests. |

- [ ] Corregido

---

### I-2 🟡 Medio — database: sqlite-wasm@latest es una mala práctica

| Campo              | Valor                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                           |
| **Archivo**  | `packages/database/package.json:13`                                                                                  |
| **Código**  | `"@sqlite.org/sqlite-wasm": "latest"`                                                                                |
| **Problema** | `latest` puede romper builds cuando la librería publique cambios mayores. Debería tener un rango de versión fijo. |

- [ ] Corregido

---

### I-3 🟢 Bajo — gan-protocol: versiones de dependencias sin caret

| Campo              | Valor                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                             |
| **Archivo**  | `packages/gan-protocol/package.json:17-18`                                                                             |
| **Código**  | `"rxjs": "^7.8.2"` vs `"aes-js": "^3.1.2"` — ambas con caret, correcto.                                             |
| **Problema** | `@cubeforge/config-typescript` es `workspace:*` sin fijar. No es problema grave pero impide releases independientes. |

- [ ] Corregido

---

### I-4 🟢 Bajo — Falta script "clean" en la mayoría de paquetes

| Campo              | Valor                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                             |
| **Problema** | Solo`cube-3d-engine` tiene script `clean`. Los demás paquetes no tienen forma de limpiar `dist/`. |

- [ ] Corregido

---

### I-5 🟢 Bajo — turbo.json: test depende de build

| Campo              | Valor                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                 |
| **Archivo**  | `turbo.json:11-13`                                                                         |
| **Código**  | `"test": { "dependsOn": ["^build"] }`                                                      |
| **Problema** | Los tests necesitan primero build de dependencias. Esto alarga el ciclo test → fix → test. |

- [ ] Corregido

---

## 🔒 PROBLEMAS DE SEGURIDAD

### S-1 🟡 Medio — Claves de encriptación hardcodeadas

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                                                                                                                           |
| **Archivo**  | `packages/gan-protocol/src/gan-cube-definitions.ts:27-36`                                                                                                                                                                                                                                                                                                                            |
| **Problema** | Las claves AES-128 y IVs están hardcodeadas en el código fuente. Aunque son claves de clean-room reverse engineering (no secretos propietarios), en un repo público son visibles para siempre en git history. Esto es aceptable para el protocolo GAN (son claves públicas conocidas), pero la arquitectura debería permitir cargar claves externamente para futuros fabricantes. |

- [ ] Corregido

---

### S-2 🟢 Bajo — GanCubeAdapter: error MAC_REQUIRED expone información del protocolo

| Campo              | Valor                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                                                                       |
| **Archivo**  | `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:50`                                                                                                       |
| **Problema** | `throw new Error('MAC_REQUIRED')` expone detalles de implementación del protocolo BLE al usuario. Un mensaje más genérico sería preferible para producción. |

- [ ] Corregido

---

## 📚 PROBLEMAS DE DOCUMENTACIÓN vs. IMPLEMENTACIÓN

### Doc-1 🟡 Medio — ADR-009 promete Zustand para timer/BLE pero no hay stores

| Campo              | Valor                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                  |
| **Problema** | ADR-009 dice "Zustand para gestionar estado de alta frecuencia (Temporizador, Hardware BLE)". La implementación solo tiene un store de tema. |

- [ ] Corregido

---

### Doc-2 🟡 Medio — PRD 4.4 describe append-only log pero no hay implementación

| Campo              | Valor                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                              |
| **Problema** | El PRD describe solves como secuencia de eventos inmutables. No hay una implementación de append-only log ni en los schemas ni en la BD. |

- [ ] Corregido

---

### Doc-3 🟢 Bajo — TDD-0006 requiere <300 líneas/archivo pero no hay verificación

| Campo              | Valor                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                       |
| **Problema** | Todos los archivos actualmente cumplen (< 300 líneas), pero no hay herramienta que lo verifique automáticamente. |

- [ ] Corregido

---

### Doc-4 🟢 Bajo — Architecture Decision Register marca DEC-10 como "Ready For ADR"

| Campo              | Valor                                                                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                               |
| **Problema** | DEC-10 (Rendering Strategy) está aprobado (RFC-014) pero el ADR no está creado. El ADR-014 existe y está marcado como "Accepted". El registro (`Architecture_Decision_Register.md`) no se actualizó. |

- [ ] Corregido

---

## 🔧 PROBLEMAS DE GIT

### G-1 🟢 Bajo — Mensajes de commit genéricos

| Campo              | Valor                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                          |
| **Problema** | Commits como`db6a454 fixes`, `cb03f0a fixes` no aportan contexto. |

- [ ] Corregido

---

### G-2 🟢 Bajo — Sin ramas de feature

| Campo              | Valor                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                          |
| **Problema** | El log muestra solo commits directos a`main`. No hay indicio de Git Flow, feature branches, ni PRs. |

- [ ] Corregido

---

## ⚠️ PROBLEMAS DE EDGE CASES NO CUBIERTOS

### E-1 — Gen2 ProtocolDriver: overflow de serial sin recuperación

| Campo              | Valor                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                                                           |
| **Archivo**  | `gan-cube-protocol.ts:384`                                                                                                                           |
| **Código**  | `Math.min((serial - this.lastSerial) & 0xFF, 7)`                                                                                                     |
| **Problema** | Si el serial da la vuelta (255→0) y hay más de 7 movimientos en el intervalo, el límite`Math.min(..., 7)` puede descartar movimientos legítimos. |

- [ ] Corregido

---

### E-2 — Gen3/Gen4: evictMoveBuffer fuerza desconexión si buffer > 16

| Campo              | Valor                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                            |
| **Archivo**  | `gan-cube-protocol.ts:566-568`, `gan-cube-protocol.ts:858-860`                                                                      |
| **Código**  | `if (conn && this.moveBuffer.length > 16) { conn.disconnect(); }`                                                                     |
| **Problema** | Si el buffer se desborda (ráfaga de movimientos + pérdida de conexión), se fuerza una desconexión sin posibilidad de recuperación. |

- [ ] Corregido

---

### E-3 — No hay manejo de cubos MoYu (aunque hay claves en definitions)

| Campo              | Valor                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                               |
| **Archivo**  | `gan-cube-definitions.ts:32-35`                                                                                                                                          |
| **Problema** | Las claves de MoYu AI 2023 están definidas pero no hay adapter ni driver para MoYu.`gan-smart-cube.ts:145` solo usa la segunda clave si el nombre empieza con 'AiCube'. |

- [ ] Corregido

---

### E-4 — GanTimerAdapter: getRecordedTimes() no expuesto

| Campo              | Valor                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                        |
| **Problema** | La interfaz`GanTimerConnection` tiene `getRecordedTimes()` pero `GanTimerAdapter` nunca lo expone. No se puede acceder a los tiempos almacenados en el timer. |

- [ ] Corregido

---

### E-5 — GanTimerAdapter: no emite IDLE ni DISCONNECT como eventos de timer

| Campo              | Valor                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                 |
| **Archivo**  | `GanTimerAdapter.ts:29-36`                                                                                                                                                                 |
| **Problema** | `DISCONNECT` se traduce como `hardwareUp` (incorrecto, debería propagarse como `disconnected`). `IDLE` se traduce como `hardwareUp` cuando debería significar "timer reseteado". |

- [ ] Corregido

---

### E-6 — GanTimerAdapter: no hay handling para RUNNING state

| Campo              | Valor                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                 |
| **Archivo**  | `GanTimerAdapter.ts`                                                                                                                                                       |
| **Problema** | El`switch` no incluye `case` para `GanTimerState.RUNNING`. Cuando el timer empieza a correr, no se emite ningún evento. La UI no podría mostrar el estado "running". |

- [ ] Corregido

---

### E-7 — GanTimerAdapter: no maneja GanTimerState.HANDS_OFF correctamente

| Campo              | Valor                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                  |
| **Archivo**  | `GanTimerAdapter.ts:48-55`                                                                                                                                  |
| **Problema** | `HANDS_OFF` (manos retiradas antes del grace delay) se emite como `hardwareDown` con ambas manos. Si se retiraron las manos, debería ser `hardwareUp`. |

- [ ] Corregido

---

### E-8 — Sin soporte para REQUEST_FACELETS en GanCubeAdapter

| Campo              | Valor                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                    |
| **Archivo**  | `GanCubeAdapter.ts`                                                                                                                                           |
| **Problema** | No se llama`REQUEST_FACELETS` después de conectar. La inicialización del estado del cubo queda a expensas de que el cubo envíe un `FACELETS` periódico. |

- [ ] Corregido

---

### E-9 — parseMoveNotation no soporta doble prime (ej. "R2'")

| Campo             | Valor                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**  | ❌ Pendiente                                                                                                                                     |
| **Archivo** | `GanCubeAdapter.ts:12`                                                                                                                         |
| **Código** | El regex`/^([UDRLBF])([2']?)$/` no captura `"R2'"` (double prime, usado por algunos cubos). Si algún firmware envía esta notación, falla. |

- [ ] Corregido

---

### E-10 — GanCubeAdapter: moves$ expone timestamp sin drift correction correcta

| Campo              | Valor                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                                                                                                                                        |
| **Archivo**  | `GanCubeAdapter.ts:73-78`                                                                                                                                                                                                                                                                                                                                                         |
| **Código**  | `hostTimestamp: this.reconciler.reconcile(cubeTs)`                                                                                                                                                                                                                                                                                                                                |
| **Problema** | `reconcile()` predice el host timestamp para un cube timestamp dado. Pero `cubeTs` es el timestamp del cubo en milisegundos desde su encendido. `reconcile()` hace regresión lineal sobre pares `(cubeTs, hostTs)`. Si el cubo se ha reiniciado o el timestamp del cubo se resetea, la regresión produce resultados incorrectos hasta que se acumulan suficientes puntos. |

- [ ] Corregido

---

### E-11 — GanCubeAdapter: no hay calibración inicial de clock drift

| Campo              | Valor                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                           |
| **Problema** | Al conectar, el`ClockDriftReconciler` no tiene datos. El primer movimiento se reconcilia con fallback a `cubeTs + offset` (1 punto) o `cubeTs` (0 puntos), que es una corrección muy imprecisa. |

- [ ] Corregido

---

### E-12 — GanCubeAdapter: gyro$ no se reconecta al bindear

| Campo              | Valor                                                                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                     |
| **Archivo**  | `SyncBridge.ts:34-46`                                                                                                                                                                                          |
| **Problema** | Si se llama`bindCube()` dos veces, se subscribe al nuevo `gyro$` pero el anterior `GyroFusion.updateGyro()` sigue recibiendo datos a través del Worker. No hay forma de "desconectar" el gyro del Worker. |

- [ ] Corregido

---

### E-13 — StackmatAdapter: connect() no valida que el AudioWorklet esté registrado

| Campo              | Valor                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                    |
| **Archivo**  | `StackmatAdapter.ts:24`                                                                                                                                                       |
| **Código**  | `await this.audioContext.audioWorklet.addModule('/stackmat-processor.js')`                                                                                                    |
| **Problema** | La ruta es relativa al servidor. Si el archivo no existe (no se incluyó en el build), falla silenciosamente (el error se captura en el catch, pero la app sigue sin Stackmat). |

- [ ] Corregido

---

### E-14 — ui/package.json usa React 18, apps/web usa React 19

| Campo              | Valor                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                      |
| **Problema** | Conflicto de versiones:`packages/ui/package.json` usa `"react": "^18.3.1"`, `apps/web/package.json` usa `"react": "^19.2.7"`. Posibles incompatibilidades en producción. |

- [ ] Corregido

---

### E-15 — Sin tests de integración entre paquetes

| Campo              | Valor                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                           |
| **Problema** | No hay tests que verifiquen la integración entre`gan-protocol` → `hardware-hal` → `cube-3d-engine` → `apps/web`. Cada paquete se testea de forma aislada (o no se testea). |

- [ ] Corregido

---

### E-16 — Sin validación de estado del cubo (facelets) en ningún punto

| Campo              | Valor                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                                                                                                    |
| **Problema** | El`FACELETS` event del protocolo contiene el estado completo del cubo (CP, CO, EP, EO). `GanCubeAdapter` lo recibe pero nunca lo expone. No hay verificación de que el estado del cubo sea consistente (suma de permutaciones correcta, paridad correcta). |

- [ ] Corregido

---

### E-17 — No hay parada de seguridad en TimerEngine si performance.now() retrocede

| Campo              | Valor                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Estado**   | ❌ Pendiente                                                                                                                               |
| **Archivo**  | `TimerEngine.ts:120`                                                                                                                     |
| **Código**  | `this.startTimestamp = performance.now();`                                                                                               |
| **Problema** | Si el sistema ajusta el clock (NTP, suspend/resume),`performance.now()` puede retroceder. El solve time podría ser negativo o anómalo. |

- [ ] Corregido

---

### E-18 — StackmatAdapter no distingue entre timers Gen3 y Gen4

| Campo              | Valor                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**   | ❌ Pendiente                                                                                                                                                                 |
| **Problema** | Stackmat Gen3 y Gen4 tienen formatos de paquete diferentes. El procesador trata todos los paquetes como iguales (solo mira comando, no formato). Posibles errores de parseo. |

- [ ] Corregido
