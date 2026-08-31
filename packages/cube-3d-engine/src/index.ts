// Constants
export * from './constants/faceRotation';

// Core
export * from './core/SceneManager';
export * from './core/CubeMeshFactory';
export * from './core/CubeModel';
export * from './core/Cube3DEngine';
export * from './core/layerPick';
export * from './core/WebGLContextManager';
export { parseFaceletsToCubies2x2, type ParsedCubie2x2 } from './core/FaceletParser2x2';

// Styles (skins / appearances)
export * from './styles/cubeSkins';

// Animation
export * from './animation/RotationEngine';
export * from './animation/RotationDriver3D';
export * from './animation/Easing';
export * from './animation/ScrambleAnimator';

// Hardware Bridge
export * from './hardware/GyroFusion';
export * from './hardware/SyncBridge';
export * from './hardware/OrientationTracker';

// Worker API (type-only export for consumers to use with Comlink.wrap<T>())
export type { EngineWorkerAPI } from './workers/EngineWorker';

// Replay Engine
export { ReplayEngine, type ReplayCallbacks, type ReplayState, type RotationParams } from './replay/ReplayEngine';

// Puzzle registry (multi-puzzle terrain)
export * from './puzzle/types';
export * from './puzzle/registry';
export * from './puzzle/nxn';
