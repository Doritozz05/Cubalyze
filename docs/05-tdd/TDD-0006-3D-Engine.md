# TDD-0006: 3D Engine Architecture (Phase 3)

## 1. Overview
This Technical Design Document outlines the architecture, data flow, and implementation strategy for **Epic 3: Core 3D Engine** of the CubeForge platform. It focuses on delivering an ultra-responsive, modular, and performant 3D visualizer using Pure `three.js`.

**Goals:**
- Render a 3x3 Rubik's Cube at 60 FPS on low-end devices.
- Support real-time hardware synchronization (moves and gyroscope).
- Adhere to **ADR-014** (Pure Three.js, no R3F, manual memory pooling).
- Enforce strict modularity: No file exceeds 300 lines of code.

## 2. Architecture & Modularity

The `cube-3d-engine` package will be completely agnostic of the frontend framework (React/Vue). 

### 2.1 File Structure (Target: `< 300 lines/file`)
```text
packages/cube-3d-engine/src/
├── core/
│   ├── SceneManager.ts       // WebGL setup, Camera, Lights, Render Loop
│   ├── CubeMeshFactory.ts    // Geometry/Material pooling & instantiation
│   └── CubeModel.ts          // Scene Graph hierarchy (Root -> 27 Cubies)
├── animation/
│   ├── RotationEngine.ts     // Tweening logic for layer rotations
│   └── Easing.ts             // Mathematical easing functions
├── hardware/
│   ├── SyncBridge.ts         // RxJS subscriptions to SmartCube events
│   └── GyroFusion.ts         // Quaternion mapping from IMU to 3D Root
├── workers/
│   └── OffscreenRenderer.ts  // (Optional) OffscreenCanvas proxy for heavy loads
└── index.ts                  // Public API export
```

### 2.2 Component Roles

1. **`SceneManager`**: Owns the `WebGLRenderer`. Handles window resize events, basic lighting (Ambient + Directional), and the `requestAnimationFrame` loop. Exposes `.mount(canvas: HTMLCanvasElement)` and `.dispose()`.
2. **`CubeModel`**: Creates the 27 `Mesh` objects representing the cubies. Maintains a spatial lookup array (3x3x3) to know which meshes belong to which face at any given time.
3. **`RotationEngine`**: Accepts commands like `rotateLayer('U', 90, durationMs)`. It groups the 9 relevant cubies into a temporary `Group`, tweens its rotation using Quaternions to avoid Gimbal Lock, and upon completion, updates the `CubeModel` spatial lookup and un-groups them.
4. **`GyroFusion`**: Listens to the `gyro$` observable. Applies a spherical linear interpolation (`slerp`) between the current camera/root orientation and the hardware's quaternion to smooth out Bluetooth polling jitter.

## 3. Performance Strategies (ADR-014 Compliance)

1. **Geometry/Material Instancing**: Instead of creating 54 unique face geometries, a single `BoxGeometry` is used. A shared `MeshStandardMaterial` is pooled for colors. 
2. **Garbage Collection (GC) Mitigation**: 
   - No object allocation (`new Vector3()`, `new Quaternion()`) inside the render loop.
   - Pre-allocate a pool of math objects in `RotationEngine` and mutate them in-place.
3. **Manual Disposal**: `SceneManager.dispose()` will systematically traverse the scene graph, calling `.dispose()` on all geometries, materials, and textures to prevent memory leaks when navigating between routes in the SPA.

## 4. Hardware Synchronization (Instant Responsiveness)

When bridging the Physical Cube (HAL) to the 3D Engine:
1. **Move Synchronization**: The `SyncBridge` listens to `moves$`. If a move arrives, it commands the `RotationEngine`. If the hardware emits moves faster than the animation duration, the `RotationEngine` immediately snaps the previous animation to its final state and starts the new one (zero input-lag perception).
2. **Gyroscope Fusion**: Bluetooth LE polling is usually ~20-50Hz, while the screen refreshes at 60Hz. Direct quaternion mapping causes visual stutter. `GyroFusion` acts as a low-pass filter, updating the target quaternion and letting the render loop `.slerp()` towards it every frame.

## 5. Professional Visualizer Analysis (Reference: cubing.js & SebLague)

- **SebLague's Approach (Unity)**: Groups 9 cubies to a central axis object, rotates the axis, and then reparents the cubies back to the root. We will replicate this exact *grouping-reparenting* mathematical logic in Three.js (`Object3D.attach` vs `Object3D.add`).
- **cubing.js Approach**: Heavy reliance on CSS/WebGL overlays and `comlink` for worker offloading. We will borrow their facelet mapping (U, R, F, D, L, B) but implement rendering imperatively to avoid their heavy DOM footprint.

## 6. Exit Criteria
- 3D Cube renders statically.
- `R U R' U'` executes flawlessly with 150ms tweens.
- Hardware moves reflect instantly.
- Memory snapshot shows flat GC allocation during idle renders.
