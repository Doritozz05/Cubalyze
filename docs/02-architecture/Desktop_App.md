# Desktop App — `apps/desktop` (Tauri 2)

> **Estado:** Implementado (2026-08-12) · **Decisión:** [ADR-027](../03-adr/ADR-027-Desktop_App_Strategy.md) · **Diseño:** [TDD frontend/0002](../05-tdd/frontend/0002-desktop-tauri-bridge.md)

La app de escritorio es un **wrapper Tauri 2** sobre la misma web app. No es una
aplicación separada: reutiliza el 100% del frontend de `apps/web` y solo cambia
dos capas de infraestructura (base de datos y hardware) mediante **overrides
resueltos en el bundler**.

## Filosofía: una sola app, dos shells

```
┌────────────────────────────────────────────────────────────┐
│                      apps/web (React PWA)                   │
│  UI, hooks, stores, views, widgets, servicios — compartidos │
└──────┬───────────────────────────────┬─────────────────────┘
       │  Vite alias (@cubalyze/database)  │  Vite alias (@cubalyze/hardware-hal)
       ▼                                   ▼
┌───────────────┐                  ┌──────────────────────┐
│ database-     │                  │ hardware-hal-        │
│ override.ts   │                  │ override.ts          │
│ (plugin-sql)  │                  │ (adapters Tauri)     │
└──────┬────────┘                  └──────────┬───────────┘
       │                                      │
┌──────▼──────────────────────────────────────▼───────────┐
│              Rust (src-tauri) — btleplug + plugins       │
│   BLE GATT (cubo GAN gen2/3/4, timer GAN) · SQLite nativa │
└──────────────────────────────────────────────────────────┘
```

- **`apps/desktop/src/main.tsx`** importa `App` directamente desde `../../web/src/App`
  y los estilos globales desde `../../web/src/index.css`. **Cero duplicación de UI.**
- `apps/desktop/vite.config.ts` resuelve las dependencias que deben cambiar con
  **aliases** (`resolve.alias`), de modo que ningún import de `apps/web` ni de
  `packages/*` necesita tocar código:

| Alias | Reemplazo | Por qué |
|---|---|---|
| `@cubalyze/database` | `src/database-override.ts` | SQLite nativa vía `tauri-plugin-sql` en vez de sqlite-wasm/OPFS |
| `@cubalyze/hardware-hal` | `src/hardware-hal-override.ts` | BLE nativo vía Rust (`btleplug`) en vez de Web Bluetooth |
| `@/components/ui` | `packages/ui/src/components` | Kit UI compartido (mismo que la web) |
| `@` | `apps/web/src` | Alias estándar de la web |

> El alias `@/components/ui` apunta al paquete compartido en vez de la copia
> local de la web — la web mantiene su copia local por razones históricas; el
> desktop usa la fuente canónica.

## 1. Override de base de datos — `database-override.ts`

**El problema que resuelve:** el protocolo custom de Tauri (`tauri://localhost`)
no envía las cabeceras Cross-Origin-Isolation que OPFS exige, por lo que
`sqlite-wasm` **siempre caería en almacenamiento en memoria** (pérdida de datos
al recargar). La solución es usar `tauri-plugin-sql`, que escribe en un archivo
`.db` real en la carpeta AppData del usuario.

**Datos clave:**

- Ubicación del archivo (Windows): `C:\Users\<user>\AppData\Roaming\com.cubeforge.desktop\cubeforge.db`
- `initDB()` abre `sqlite:cubeforge.db`, activa `PRAGMA foreign_keys = ON`, y
  **reutiliza las mismas `MIGRATIONS` de `packages/database`** (el mismo motor de
  migraciones, mismo esquema, misma secuencia).
- Cada migración corre en su propia transacción (`BEGIN`/`COMMIT`/`ROLLBACK`):
  una interrupción a mitad nunca deja una migración a medias.
- **Red de seguridad v1→v2**: antes de aplicar la migración `022_baseline_v2`
  (que borra y recrea `solves`/`sessions`), `backupLegacyTables()` copia las
  tablas legadas a `_backup_v1_*`. Tras migrar, `restoreLegacyData()` devuelve
  los datos al esquema v2 convirtiendo fechas TEXT ISO → INTEGER epoch-ms, y
  solo borra el snapshot cuando verifica fila a fila que todo llegó (no-op si no
  hay backup; el fallo de restore nunca bloquea el arranque).
- **Re-exporta todos los repositorios** de `packages/database` sin cambios
  (lógica pura). Ojo de mantenimiento: el comentario del archivo avisa que hay
  que mantener la lista en sync con `packages/database/src/repositories/index.js`.
- `getStorageType()` reporta `'desktop'` — la UI trata cualquier valor distinto
  de `'memory'` como persistente seguro.

## 2. Override de hardware — `hardware-hal-override.ts`

Re-exporta **todo** de `packages/hardware-hal` excepto los adaptadores, que se
sustituyen por versiones Tauri:

```
export * from '../../../packages/hardware-hal/src/index';
export { GanCubeAdapterTauri as GanCubeAdapter } from './adapters/GanCubeAdapterTauri';
export { GanTimerAdapterTauri as GanTimerAdapter } from './adapters/GanTimerAdapterTauri';
```

Gracias a la semántica ES de `export *` (los nombres en conflicto se excluyen),
el alias hace que **todos los imports de la app** resuelvan al adaptador nativo
sin tocar una línea de `apps/web` ni de los paquetes.

### 2.1 `GanCubeAdapterTauri` — arquitectura de puente

```
Rust (btleplug) ──ble:data──▶ TS (descifra + parsea) ──▶ RxJS Subjects
TS ──invoke('send_cube_command')──▶ Rust ──GATT write──▶ Cubo
```

- Rust gestiona **solo el transporte BLE**; todo el protocolo (drivers
  `GanGen2/3/4ProtocolDriver`, encrypters `GanGen*CubeEncrypter`, claves de
  `GAN_ENCRYPTION_KEYS`) se **reutiliza de `@cubalyze/gan-protocol`** — cero
  duplicación de criptografía ni de parsing.
- **Paridad funcional con el adaptador web**:
  - `ClockDriftReconciler` para timestamps precisos de movimientos.
  - `invalidMoves$` para movimientos no reconocidos.
  - Validación de FACELETS (54 caracteres).
  - Reconexión idéntica (3 intentos, base 1000ms con backoff exponencial).
  - Subjects RxJS estables (nunca se recrean) y promesas deduplicadas para
    `requestFacelets/Hardware/Battery`.
- Selección de generación del cubo según el UUID de servicio (gen2/gen3/gen4)
  y del salt de cifrado derivado de la MAC (invertida).

### 2.2 `GanTimerAdapterTauri` — mapeo de estados

Mapea los estados del protocolo GAN Timer al contrato `HardwareTimerAdapter`
(`hardwareDown`/`hardwareUp`/`hardwareReset`) que consume `TimerEngine`:

| Estado GAN | Evento emitido |
|---|---|
| `HANDS_ON` (6) | `hardwareDown` |
| `GET_SET` (1), `HANDS_OFF` (2), `STOPPED` (4), `FINISHED` (7) | `hardwareUp` |
| `IDLE` (5) | `hardwareReset` |
| `DISCONNECT` (0) | limpieza de conexión |

`getRecordedTimes()` lee la característica de tiempo (16 bytes: 4 entradas de 4
bytes min/seg/msec LE) y devuelve el display + 3 tiempos previos.

## 3. Lado Rust — `src-tauri/`

| Archivo | Rol |
|---|---|
| `src/lib.rs` | Builder de Tauri: plugins (shell, clipboard, dialog, notification, **sql**), `AppState` gestionado, 9 comandos `invoke`, cleanup BLE al cerrar ventana, y **auto-scan** BLE en background al arrancar. *Nota:* el plugin updater se registra comentado — las auto-actualizaciones están desactivadas hasta que exista un canal firmado (`tauri.conf.json → plugins.updater.active = false`). |
| `src/state.rs` | `AppState` con `parking_lot::Mutex`: adaptador BLE cacheado, periféricos conectados (cubo/timer), MAC del último cubo (para auto-reconnect) y las características command/state/time. |
| `src/ble/mod.rs` | Constantes de UUIDs de servicio/características para GAN gen2, gen3, gen4 y el timer (fuente: `packages/gan-protocol`), más los prefijos de nombre para el escaneo (`GAN`, `MG`, `AiCube`). |
| `src/ble/cube.rs` | Conexión con **3 estrategias en cascada**: (1) MAC cacheada → conexión directa; (2) periféricos cacheados (sin escanear); (3) escaneo activo con short-circuit (poll 500ms, hasta 8s). Detección de generación por servicios GATT descubiertos (no anunciados — tras el GATT connect la lista anunciada suele estar vacía). Emite `ble:data`, `ble:status`, `ble:devices_found`. |
| `src/ble/timer.rs` | Conexión al timer, **validación CRC-16/CCITT-FALSE** (polinomio 0x1021, init 0xFFFF — espejo de la implementación TS) y magic byte `0xFE` de cada paquete, parseo de estados y de tiempos. Emite `ble:timer_event` y `ble:timer_status`. |
| `src/log.rs` | Macro `debug_log!`: solo escribe a stderr en builds de debug; en release se expande a nada — los nombres de dispositivos/MACs nunca se filtran en producción. |
| `src/main.rs` | Entrypoint (`cubeforge_lib::run()`); la ventana de consola de Windows está comentada para depuración BLE. |

**Eventos emitidos por Rust → TS:**

| Evento | Contenido |
|---|---|
| `ble:data` | bytes crudos cifrados del cubo |
| `ble:status` | `connecting/connected/disconnected/reconnecting` + mensaje |
| `ble:devices_found` | lista de cubos encontrados por el auto-scan |
| `ble:timer_event` | evento de timer validado (estado + tiempo grabado) |
| `ble:timer_status` | `connecting/connected/disconnected` del timer |

**Comandos invocables desde TS (`invoke`):**

`debug_ble_status`, `connect_gan_cube` (con MAC opcional), `reconnect_gan_cube`,
`disconnect_gan_cube`, `is_cube_connected`, `send_cube_command`,
`connect_gan_timer`, `disconnect_gan_timer`, `get_timer_recorded_times`.

## 4. Detalles de configuración

- **`tauri.conf.json`**: productName `Cubalyze`, identifier `com.cubeforge.desktop`,
  versión `0.1.0`. Ventana 1280×800 (min 900×600), CSP estricta (misma filosofía
  que `vercel.json`). Dev en `http://localhost:1420`; bundle NSIS (`currentUser`)
  con iconos multi-plataforma.
- **`capabilities/default.json`**: `shell:allow-open`, clipboard, dialog,
  notification y `sql` (execute) — mínimo necesario.
- **`vite.config.ts`**: puerto 1420 estricto; plugin que **quita `crossorigin` de
  los `<link>` CSS** (el protocolo `asset://` de Tauri no devuelve cabeceras CORS
  y bloqueaba los estilos); `watch.ignored` excluye `src-tauri/**` (evita loops
  de HMR); `optimizeDeps.exclude: ['@sqlite.org/sqlite-wasm']` (se carga en un
  worker).
- **Auto-conexión**: `main.tsx` escucha `ble:devices_found` y, si no hay cubo
  conectado, conecta automáticamente vía `globalCubeAdapter` — feature solo de
  escritorio (Web Bluetooth exige gesto de usuario).

## 5. La decisión de `apps/api` (vacío)

`apps/api` contiene **solo `package.json`** (`@cubalyze/api`). No hay backend,
no hay carpeta `supabase/`, no hay migraciones de servidor, y `vercel.json`
despliega únicamente la web (`buildCommand: turbo run build --filter=web`).

**Razones documentadas:**

1. **Arquitectura local-first**: la app es totalmente funcional sin servidor —
   timer, análisis, training/SRS, widgets y perfil viven en SQLite local. El
   backend solo aportaría *sync* en la nube, que no es prioridad actual.
2. **ADR-019 (Supabase + event sourcing append-only) está aprobado pero sin
   implementar**; el paquete `sync-engine` está marcado como *planeado*.
3. La auditoría de ADRs (Fase 0) confirmó el estado: `apps/api` vacío, 0
   releases, 0 tags git.

**Decisión (2026-08-12):** mantener `apps/api` como scaffold vacío y **diferir
el backend hasta que el sync en la nube sea una prioridad** (ver la sección de
aplazamiento en [ADR-019](../03-adr/ADR-019-Backend_Architecture.md)). Cuando
eso ocurra, el ciclo de gobernanza se dispara: RFC → ADR → TDD antes de
codificar.

## 6. Relaciones

- **ADRs**: [ADR-012](../03-adr/ADR-012-Web_Bluetooth_Mobile_Fallbacks.md) (HAL
  + Tauri, móvil diferido), [ADR-027](../03-adr/ADR-027-Desktop_App_Strategy.md)
  (esta arquitectura), [ADR-019](../03-adr/ADR-019-Backend_Architecture.md)
  (backend diferido).
- **TDDs**: [frontend/0002](../05-tdd/frontend/0002-desktop-tauri-bridge.md)
  (puente Tauri), [core/0004](../05-tdd/core/0004-timer-engine.md) (TimerEngine,
  consumidor del adaptador de timer).
- **Paquetes reutilizados sin cambios**: `gan-protocol` (protocolo+crypto),
  `hardware-hal` (interfaces + `ClockDriftReconciler`), `database` (migraciones
  + repositorios), `timer-engine`, y todos los de la web.
- **Diferencias desktop vs web** (resumen):

| Capa | Web (PWA) | Desktop (Tauri) |
|---|---|---|
| BLE | Web Bluetooth (gesto de usuario) | Rust `btleplug` + auto-scan |
| Base de datos | sqlite-wasm sobre OPFS | SQLite nativa (`tauri-plugin-sql`) en AppData |
| Ventana | navegador / instalación PWA | ventana nativa 1280×800 |
| Auto-actualización | deploy continuo de Vercel | desactivada (sin canal firmado) |
