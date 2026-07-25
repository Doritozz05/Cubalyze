/**
 * Desktop override for @cubeforge/hardware-hal.
 *
 * Re-exports EVERYTHING from the real hardware-hal package,
 * EXCEPT GanCubeAdapter — which is replaced by the Tauri-native
 * GanCubeAdapterTauri that communicates via Rust btleplug instead
 * of the Web Bluetooth API.
 *
 * The Vite config aliases '@cubeforge/hardware-hal' to this file,
 * so ALL imports across the desktop app resolve transparently —
 * zero changes needed in apps/web/ or packages/.
 *
 * ES module semantics: `export *` excludes names that conflict with
 * explicit exports, so `GanCubeAdapter` from the star-export is
 * automatically shadowed by the explicit export below.
 */

export * from '../../../packages/hardware-hal/src/index';

export { GanCubeAdapterTauri as GanCubeAdapter } from './adapters/GanCubeAdapterTauri';
export { GanTimerAdapterTauri as GanTimerAdapter } from './adapters/GanTimerAdapterTauri';
