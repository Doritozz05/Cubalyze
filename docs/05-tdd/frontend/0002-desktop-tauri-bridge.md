# TDD frontend/0002 — Puente Desktop Tauri (BLE + Database Override)

> **Estado:** Implementado (as-built) · **Decisión:** [ADR-027](../03-adr/ADR-027-Desktop_App_Strategy.md) ·
> **Dominio:** frontend · **Secuencia:** 0002 (tras `frontend/0001-widget-sdk-dock-system.md`)

## 1. Propósito

Diseñar la capa de infraestructura que permite ejecutar la app web de
`apps/web` como aplicación de escritorio Tauri con **cero cambios** en la web y
en los paquetes, sustituyendo solo dos dependencias por overrides resueltos en
el bundler: la base de datos (sqlite-wasm → SQLite nativa) y el hardware
(Web Bluetooth → BLE nativo Rust).

## 2. Módulos y responsabilidades

```
apps/desktop/src/
├── main.tsx                    # Entrypoint: monta App de apps/web + auto-conexión
├── vite.config.ts              # Aliases + plugins de build
├── database-override.ts        # Reemplaza @cubalyze/database (DBExecutor + repos)
├── hardware-hal-override.ts    # Reemplaza @cubalyze/hardware-hal (adaptadores)
└── adapters/
    ├── GanCubeAdapterTauri.ts  # SmartCubeAdapter sobre comandos/eventos Tauri
    └── GanTimerAdapterTauri.ts # HardwareTimerAdapter sobre estados del timer

apps/desktop/src-tauri/src/     # Rust — solo transporte e infraestructura
├── lib.rs                      # Builder Tauri, plugins, comandos, auto-scan
├── state.rs                    # AppState (Mutexes de parking_lot)
├── log.rs                      # debug_log! (solo debug builds)
└── ble/
    ├── mod.rs                  # UUIDs GAN gen2/3/4 + timer, prefijos de nombre
    ├── cube.rs                 # Conectar/reconectar/desconectar/enviar/status
    └── timer.rs                # Conectar/desconectar, tiempos grabados, CRC
```

**Regla de oro:** el Rust **solo hace transporte** (GATT + SQLite). Todo el
protocolo GAN (drivers, encrypters, parsing, CRC en el caso del timer… no —
el CRC del timer sí vive en Rust por simetría con la validación de paquetes en
la frontera) y toda la lógica de negocio permanecen en TypeScript.

## 3. Contrato del puente (comandos `invoke` y eventos `listen`)

| Dirección | Nombre | Firma | Descripción |
|---|---|---|---|
| TS→Rust | `connect_gan_cube` | `(mac?: string) → {status, name, mac, generation}` | Estrategias 1→2→3 (MAC cacheada → caché → escaneo) |
| TS→Rust | `reconnect_gan_cube` | `() → {status, name, mac, generation}` | Reintenta la última MAC |
| TS→Rust | `disconnect_gan_cube` | `() → ()` | Desconecta y limpia |
| TS→Rust | `is_cube_connected` | `() → boolean` | Estado de conexión |
| TS→Rust | `send_cube_command` | `(data: number[]) → ()` | GATT write (WithoutResponse) |
| TS→Rust | `connect_gan_timer` | `() → {status, name, mac}` | Escanea y conecta el timer |
| TS→Rust | `disconnect_gan_timer` | `() → ()` | Desconecta el timer |
| TS→Rust | `get_timer_recorded_times` | `() → {displayTime, previousTimes[3]}` | Lee la característica de tiempo (16 bytes) |
| TS→Rust | `debug_ble_status` | `() → diagnóstico JSON` | Herramienta de depuración |
| Rust→TS | `ble:data` | `{value: number[]}` | Bytes crudos cifrados del cubo |
| Rust→TS | `ble:status` | `{status, message?}` | `connecting/connected/disconnected/reconnecting` |
| Rust→TS | `ble:devices_found` | `{cubes: [{name, address}]}` | Resultado del auto-scan |
| Rust→TS | `ble:timer_event` | `{state, stateName, recordedTime?}` | Evento de timer validado |
| Rust→TS | `ble:timer_status` | `{status, message?}` | `connecting/connected/disconnected` |

## 4. Diseño del adaptador de cubo (`GanCubeAdapterTauri`)

Implementa `SmartCubeAdapter` de `@cubalyze/hardware-hal` con paridad
funcional con el adaptador web:

1. **Subjects RxJS estables** (nunca se recrean): `moves$` (ReplaySubject(1)),
   `facelets$` (ReplaySubject(1)), `battery$`, `gyro$`, `invalidMoves$`,
   `connectionStatus$` (BehaviorSubject).
2. **Flujo de conexión** (`connect(manualMac?)`):
   `invoke('connect_gan_cube')` → `setupProtocol(result)`:
   - deduce generación del UUID de servicio (`GAN_GEN2/3/4_SERVICE`);
   - deriva el salt de la MAC (`macToSalt`, invertida) y elige la clave de
     `GAN_ENCRYPTION_KEYS` (gen2 con nombre `AiCube` → key[1], resto key[0]);
   - instancia driver + encrypter de `@cubalyze/gan-protocol`;
   - `listen('ble:data')` → `handleDataEvent` (descifra → `driver.handleStateEvent`
     → `emitEvent`); `listen('ble:status')` → `handleDisconnect`.
3. **Ciclo de vida**: `disconnect()` marca `isUserDisconnect`, limpia listeners
   y emite `disconnected` explícito (la limpieza previa mataría el evento de
   Rust). Reconexión automática: 3 intentos, delay `1000ms * 2^(n-1)`, cancelable.
4. **Deduplicación de peticiones**: `requestFacelets/Hardware/Battery` usan
   promesas singleton (`finally` para liberar).
5. **Reconciliación de relojes**: `ClockDriftReconciler` recalcula el timestamp
   del host por movimiento (`cubeTimestamp` → `hostTimestamp`).
6. **Validación**: FACELETS de exactamente 54 caracteres; movimientos con
   regex `^([UDRLBF])(2|'|2')?$`; movimientos inválidos → `invalidMoves$`.

### Máquina de estados del adaptador

```
disconnected ──connect()──▶ connecting ──setupProtocol ok──▶ connected
     ▲                          │  error                         │  ble:status disconnected
     │                          ▼                                │  (no user-initiated)
     └──────────────────────────┴────────────────────────────────┘
connected ──(disconnect no solicitado)──▶ reconnecting ──(3 intentos fallidos)──▶ disconnected
```

## 5. Diseño del adaptador de timer (`GanTimerAdapterTauri`)

Implementa `HardwareTimerAdapter`. Mapeo de estados GAN → eventos:

| Estado GAN (byte) | Evento `HardwareTimerEvent` |
|---|---|
| `HANDS_ON` (6) | `hardwareDown` |
| `GET_SET` (1) / `HANDS_OFF` (2) / `STOPPED` (4) / `FINISHED` (7) | `hardwareUp` |
| `IDLE` (5) | `hardwareReset` |
| `DISCONNECT` (0) | `_connected = false` |

`getRecordedTimes()` devuelve `[display, t1, t2, t3]` desde la característica
de tiempo (4 entradas × 4 bytes min/sec/msec-LE).

## 6. Validación de paquetes del timer (Rust)

- Magic byte `0xFE` en `data[0]`.
- **CRC-16/CCITT-FALSE** (polinomio `0x1021`, init `0xFFFF`) sobre
  `data[2..len-2]` == `data[len-2..len]` (LE). Espejo exacto de la
  implementación TS en `gan-smart-timer.ts` (paridad verificada).
- Eventos que no pasan la validación se descartan en el listener (solo
  `debug_log`).

## 7. Diseño del override de base de datos (`database-override.ts`)

`initDB()`:

1. `Database.load('sqlite:cubeforge.db')` (AppData del usuario).
2. `PRAGMA foreign_keys = ON`.
3. `backupLegacyTables()`: si la migración `022_baseline_v2` aún no está
   aplicada, copia `solves, sessions, training_attempts, algorithm_progress,
   exercise_progress, training_sessions, algorithms` a `_backup_v1_*`
   (`CREATE TABLE AS SELECT`), no-fatal ante errores.
4. Tabla `_migrations` + aplicación secuencial de `MIGRATIONS` de
   `packages/database`, cada una en transacción propia
   (`BEGIN` → SQL → `INSERT OR IGNORE` → `COMMIT`, `ROLLBACK` en error).
5. `restoreLegacyData()` (no-fatal): copia `_backup_v1_sessions`/`_backup_v1_solves`
   al esquema v2 convirtiendo fechas TEXT ISO → INTEGER epoch-ms; selectores
   schema-aware (`backupIsV1` = tiene columna `date`; `backupHasTextDates` =
   `created_at` no es integer/real); tras verificar fila a fila que no faltan
   filas, dropea el snapshot (si faltan, lo conserva como red de recuperación).
6. Cliente `DBClient` que enruta `SELECT/WITH/PRAGMA` a `db.select()` y el
   resto a `db.execute()` (tauri-plugin-sql no multiplexa solo); re-exporta
   todos los repositorios y tipos de `packages/database` sin cambios.

## 8. Criterios de aceptación (tests / verificaciones existentes)

- [x] La web (`apps/web`) y los paquetes no contienen ninguna referencia a
      Tauri (`grep` de `@tauri-apps` solo en `apps/desktop`) — el override es
      totalmente transparente.
- [x] `gan-protocol` reutilizado íntegramente: el adaptador Tauri no
      reimplementa crypto ni parsing.
- [x] Paridad de parches: `debug_log!` no compila en release
      (`#[cfg(debug_assertions)]`).
- [x] Cierre limpio: `CloseRequested` → toma los periféricos fuera de los
      mutex → `disconnect()` bloqueante — sin cuelgues de la pila BLE de
      Windows.
- [x] La migración `022_baseline_v2` nunca pierde datos en desktop
      (backup + restore verificados por conteo de filas).
- [x] Auto-conexión: un cubo encontrado por el auto-scan conecta sin gesto
      del usuario.
- [ ] (Pendiente) Tests unitarios en Rust para `crc16_ccitt` /
      `validate_timer_event` — hoy verificados solo por integración manual.
