# PLAN: Refactorización del Sistema de Orientación, Notación y Rotaciones de CubeForge

## Referencias del Documento

| Ref | Fuente | Uso |
|-----|--------|-----|
| [R1] | cubing.js KPuzzle (src/cubing/kpuzzle/) | Modelo de estado permutation+orientation |
| [R2] | cubing.js Alg.simplify() (src/cubing/alg/) | Notación compacta puzzle-aware |
| [R3] | WCA Regulations Art. 12 (docs/wca.md:517-536) | Notación oficial |
| [R4] | GAN BLE Protocol (packages/gan-protocol/) | Hardware move/gyro events |
| [R5] | Aerospace AHRS / Madgwick/Mahony filters | Sensor fusion reference |
| [R6] | Robotics DH parameters / transform chains | Reference frame management |
| [R7] | WebXR getOffsetReferenceSpace() | Offset reference spaces |
| [R8] | Computer Vision: symmetry-aware pose estimation | Discrete orientation snapping |
| [R9] | Unity/Unreal: quaternion internally, Euler for display | Dual representation pattern |
| [R10] | Group theory: octahedral group O (order 24) | Cube orientation group |

---

## FASE 0: Preparación y Tipos Base

**Objetivo**: Establecer los tipos compartidos y contratos que todas las fases posteriores usarán.

**Archivos a crear/modificar**:
- `packages/types/src/index.ts` — agregar tipos nuevos

**Especificación**:

### 0.1 Nuevo tipo `OrientationIndex`

```typescript
/** Index into the 24-element octahedral group. Range: 0-23. */
export type OrientationIndex = number;

/** Face index convention used internally: U=0, R=1, F=2, D=3, L=4, B=5 */
export type FaceIndex = 0 | 1 | 2 | 3 | 4 | 5;
```

### 0.2 Nuevo tipo `TransformChain`

```typescript
/**
 * Explicit reference frame transform, following robotics/UE pattern.
 * T[from → to] = the transform that converts coordinates from 'from' frame to 'to' frame.
 */
export interface TransformChain {
  /** The source reference frame identifier */
  readonly from: string;
  /** The target reference frame identifier */
  readonly to: string;
  /** The rotation matrix (3x3, row-major) or null for identity */
  readonly rotation: readonly [number, number, number, number, number, number, number, number, number] | null;
}
```

### 0.3 Extender `RotationEvent`

```typescript
export interface RotationEvent {
  axis: RotationAxis;
  direction: CubeMoveDirection;
  timestamp: number;
  /** The orientation index BEFORE this rotation (for tracking) */
  previousOrientation?: OrientationIndex;
  /** The orientation index AFTER this rotation */
  newOrientation?: OrientationIndex;
}
```

**Criterios de aceptación**:
- [ ] `OrientationIndex` y `FaceIndex` exportados desde `@cubeforge/types`
- [ ] `TransformChain` exportado desde `@cubeforge/types`
- [ ] `RotationEvent` extendido sin breaking changes (campos opcionales)
- [ ] Compilación exitosa: `npm run typecheck` en todo el monorepo

---

## FASE 1: OrientationTracker — Grupo Octaédrico

**Objetivo**: Reemplazar `OrientationState` con un tracker matemáticamente correcto basado en el grupo octaédrico de orden 24.

**Archivos a crear**:
- `packages/math-core/src/OrientationTracker.ts` — implementación principal
- `packages/math-core/src/OrientationTracker.test.ts` — tests exhaustivos

**Archivos a modificar**:
- `packages/math-core/src/index.ts` — exportar nuevo módulo

**Archivos a eliminar** (post-migración):
- `packages/math-core/src/OrientationState.ts`
- `packages/math-core/src/OrientationState.test.ts`

### 1.1 Tabla de Permutaciones del Grupo Octaédrico

El cubo tiene 6 centros. Cada rotación global (x, y, z) permuta estos centros. Las tablas se derivan de las definiciones WCA (docs/wca.md:529-532):

**Definiciones WCA**:
- x = misma dirección que R (rotación alrededor del eje lateral, U→F→D→B)
- y = misma dirección que U (rotación alrededor del eje vertical, F→R→B→L)
- z = misma dirección que F (rotación alrededor del eje frontal, U→R→D→L)

**Codificación**: positions[6] = [U, R, F, D, L, B]. `centers[i]` = qué centro original está en posición `i`.

```
ROT_X (x rotation, +90°):
  U(0)→F(2), R(1)→R(1), F(2)→D(3), D(3)→B(5), L(4)→L(4), B(5)→U(0)
  Permutación destino: [2, 1, 5, 3, 0, 4]
  → centers[0]=F, centers[1]=R, centers[2]=D, centers[3]=B, centers[4]=L, centers[5]=U

ROT_Y (y rotation, +90°):
  U(0)→U(0), R(1)→F(2), F(2)→L(4), D(3)→D(3), L(4)→B(5), B(5)→R(1)
  Permutación destino: [0, 2, 3, 4, 1, 5]
  → centers[0]=U, centers[1]=F, centers[2]=D, centers[3]=L, centers[4]=B, centers[5]=R

ROT_Z (z rotation, +90°):
  U(0)→R(1), R(1)→D(3), F(2)→F(2), D(3)→L(4), L(4)→U(0), B(5)→B(5)
  Permutación destino: [1, 3, 2, 4, 0, 5]
  → centers[0]=R, centers[1]=D, centers[2]=F, centers[3]=L, centers[4]=U, centers[5]=B
```

**Verificación**: Estas tablas deben producir las mismas transformaciones que cubing.js para x, y, z en su definición 3x3x3 (ref [R1]).

### 1.2 Interfaz Pública

```typescript
export class OrientationTracker {
  private centers: Uint8Array;  // [6], values 0-5
  private history: OrientationIndex[];  // audit trail

  constructor();
  
  /** Apply a whole-cube rotation. Idempotent for 4x the same rotation. */
  public applyRotation(axis: 'x' | 'y' | 'z', times: 1 | -1 | 2): void;
  
  /**
   * Maps hardware face → visual face for display.
   * Deterministic: same state → same result, always.
   */
  public mapFaceForDisplay(hardwareFace: CubeFace): CubeFace;
  
  /**
   * Maps hardware face → visual face for 3D rendering.
   * Same as mapFaceForDisplay but returns FaceIndex for internal use.
   */
  public mapFaceIndexForDisplay(hardwareFaceIndex: FaceIndex): FaceIndex;
  
  /**
   * Calibrates from 54-char Kociemba facelet string.
   * Reads ALL 6 centers (not just U), supports any orientation.
   * Returns true if calibration succeeded, false if facelets are invalid.
   */
  public calibrateFromFacelets(facelets: string): boolean;
  
  /**
   * Returns the current orientation as an index (0-23).
   * Useful for serialization and comparison.
   */
  public getOrientationIndex(): OrientationIndex;
  
  /**
   * Restores orientation from a serialized index.
   */
  public setOrientationIndex(index: OrientationIndex): void;
  
  /** Reset to default orientation (solved, offset 0) */
  public reset(): void;
  
  /** Get the full centers permutation for debugging */
  public getCenters(): readonly Uint8Array;
}
```

### 1.3 Implementación Detallada

#### `applyRotation()`

```typescript
public applyRotation(axis: 'x' | 'y' | 'z', times: 1 | -1 | 2): void {
  const table = axis === 'x' ? ROT_X : axis === 'y' ? ROT_Y : ROT_Z;
  
  // Normalize: -1 → apply 3 times, 2 → apply 2 times, 1 → apply 1 time
  const repetitions = times === -1 ? 3 : times === 2 ? 2 : 1;
  
  for (let r = 0; r < repetitions; r++) {
    const next = new Uint8Array(6);
    for (let i = 0; i < 6; i++) {
      next[i] = this.centers[table[i]];
    }
    this.centers = next;
  }
  
  this.history.push(this.getOrientationIndex());
}
```

#### `calibrateFromFacelets()`

```typescript
public calibrateFromFacelets(facelets: string): boolean {
  if (facelets.length !== 54) return false;
  
  const CENTER_INDICES: readonly number[] = [4, 13, 22, 31, 40, 49]; // U,R,F,D,L,B
  const FACE_TO_INDEX: Record<string, FaceIndex> = {
    'U': 0, 'R': 1, 'F': 2, 'D': 3, 'L': 4, 'B': 5
  };
  
  const observed = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    const color = facelets[CENTER_INDICES[i]];
    const idx = FACE_TO_INDEX[color];
    if (idx === undefined) return false; // invalid facelet
    observed[i] = idx;
  }
  
  // Verify it's a valid permutation (each value 0-5 appears exactly once)
  const sorted = [...observed].sort((a, b) => a - b);
  const isValid = sorted[0] === 0 && sorted[1] === 1 && sorted[2] === 2 &&
                  sorted[3] === 3 && sorted[4] === 4 && sorted[5] === 5;
  
  if (!isValid) return false;
  
  this.centers = observed;
  this.history.push(this.getOrientationIndex());
  return true;
}
```

#### `mapFaceForDisplay()`

```typescript
public mapFaceForDisplay(hardwareFace: CubeFace): CubeFace {
  const faceIndex = FACE_TO_INDEX[hardwareFace];
  
  // Find which position i has centers[i] === faceIndex
  // That means the hardware's face is now visually at position i
  for (let i = 0; i < 6; i++) {
    if (this.centers[i] === faceIndex) {
      return INDEX_TO_FACE[i];
    }
  }
  
  return hardwareFace; // fallback (should never happen with valid state)
}
```

### 1.4 Tabla de las 24 Orientaciones (pre-computada)

Para `getOrientationIndex()` y `setOrientationIndex()`, pre-computar las 24 permutaciones válidas del grupo octaédrico:

```typescript
// All 24 orientations as centers permutations
// Index 0 = identity [0,1,2,3,4,5]
// Generated by composing ROT_X, ROT_Y, ROT_Z
const ORIENTATION_TABLE: readonly Uint8Array[] = [
  new Uint8Array([0,1,2,3,4,5]), // 0: identity
  new Uint8Array([2,1,5,3,0,4]), // 1: x
  new Uint8Array([5,1,0,3,4,2]), // 2: x2
  new Uint8Array([4,1,2,3,5,0]), // 3: x'
  new Uint8Array([0,2,3,4,1,5]), // 4: y
  new Uint8Array([0,3,4,1,2,5]), // 5: y2
  new Uint8Array([0,4,1,2,3,5]), // 6: y'
  // ... completar las 24 restantes
];
```

**Generación**: Usar BFS desde identity, aplicando ROT_X, ROT_Y, ROT_Z hasta alcanzar las 24 permutaciones. Verificar que |O| = 24 (grupo octaédrico).

### 1.5 Tests Unitarios (OrientationTracker.test.ts)

| # | Test | Input | Expected | Ref |
|---|------|-------|----------|-----|
| 1 | Identity | constructor() | centers=[0,1,2,3,4,5] | [R10] |
| 2 | x rotation | applyRotation('x',1) | centers=[2,1,5,3,0,4] | [R3,12a4a] |
| 3 | y rotation | applyRotation('y',1) | centers=[0,2,3,4,1,5] | [R3,12a4a] |
| 4 | z rotation | applyRotation('z',1) | centers=[1,3,2,4,0,5] | [R3,12a4a] |
| 5 | x * x' = identity | x then x' | centers=[0,1,2,3,4,5] | [R10] |
| 6 | x * x * x * x = identity | x ×4 | centers=[0,1,2,3,4,5] | [R10] |
| 7 | y * y * y * y = identity | y ×4 | centers=[0,1,2,3,4,5] | [R10] |
| 8 | z * z * z * z = identity | z ×4 | centers=[0,1,2,3,4,5] | [R10] |
| 9 | x * y ≠ y * x | x then y vs y then x | different | [R10] |
| 10 | z2 * R mapping | z2 then mapFaceForDisplay('R') | 'L' | [R3,12a4c] |
| 11 | mapFaceForDisplay identity | offset=0, 'R' | 'R' | — |
| 12 | mapFaceForDisplay after y | y, 'F' | 'R' | — |
| 13 | calibrateFromFacelets solved | solved facelets | centers=[0,1,2,3,4,5] | [R4] |
| 14 | calibrateFromFacelets after z2 | z2'd facelets | correct centers | [R4] |
| 15 | calibrateFromFacelets invalid | "A".repeat(54) | false | — |
| 16 | getOrientationIndex after x | x | index for x | — |
| 17 | setOrientationIndex round-trip | set(idx), get() | idx | — |
| 18 | 24 unique orientations | all compositions | 24 unique | [R10] |
| 19 | mapFaceForDisplay consistency | 24 orientations × 6 faces | 144 correct mappings | — |
| 20 | reset | reset after x | identity | — |

**Criterios de aceptación**:
- [ ] Todos los tests pasan: `npm test -- --filter math-core`
- [ ] Cobertura >95% en OrientationTracker.ts
- [ ] 24 orientaciones únicas verificadas
- [ ] Consistencia: `mapFaceForDisplay(mapFaceForDisplay(face))` ≡ identity
- [ ] `calibrateFromFacelets` produce el mismo resultado que `applyRotation` para cada orientación conocida

---

## FASE 2: RotationDetectorV2 — Snapping Discreto

**Objetivo**: Reemplazar el `RotationDetector` heurístico por un detector basado en snapping a las 24 orientaciones discretas del cubo.

**Archivos a crear**:
- `packages/cube-3d-engine/src/hardware/RotationDetectorV2.ts`
- `packages/cube-3d-engine/src/__tests__/RotationDetectorV2.test.ts`

**Archivos a modificar**:
- `packages/cube-3d-engine/src/hardware/SyncBridge.ts` — migrar a V2

### 2.1 Tabla de Orientaciones de Referencia

Pre-computar 24 cuaterniones de referencia (uno por orientación del grupo octaédrico). Estos cuaterniones representan la orientación del cubo en cada estado discreto.

**Generación offline**:

Para cada una de las 24 permutaciones de centros, calcular el cuaternión que transforma la orientación identidad a esa permutación.

```typescript
// Cubo en orientación identidad:
// +X axis → R face normal
// +Y axis → U face normal  
// +Z axis → F face normal

// Después de rotación x (+90° around X):
// +X → R (unchanged), +Y → F, +Z → -U
// Quaternion: angle=90° around (1,0,0) → (sin(45°), 0, 0, cos(45°))

const REFERENCE_QUATERNIONS: readonly Quaternion[] = [
  new Quaternion(0, 0, 0, 1),           // 0: identity
  new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2),  // 1: x
  new Quaternion(1, 0, 0, 0),           // 2: x2
  new Quaternion(Math.SQRT1_2, 0, 0, -Math.SQRT1_2), // 3: x'
  new Quaternion(0, Math.SQRT1_2, 0, Math.SQRT1_2),  // 4: y
  // ... completar las 24
];
```

### 2.2 Implementación

```typescript
export class RotationDetectorV2 {
  private orientationTracker: OrientationTracker;
  private lastOrientationIndex: OrientationIndex;
  private lastDetectionTime = 0;
  
  private static readonly COOLDOWN_MS = 200; // Reducido de 400ms
  private static readonly MIN_DOT_THRESHOLD = 0.85; // Para detectar cambio significativo
  
  constructor(tracker: OrientationTracker) {
    this.orientationTracker = tracker;
    this.lastOrientationIndex = tracker.getOrientationIndex();
  }
  
  /**
   * Detects if a discrete rotation occurred by comparing the current
   * raw quaternion against all 24 reference orientations.
   * 
   * Returns the rotation event if a NEW discrete orientation is detected,
   * null otherwise.
   */
  public detectRotation(currentRaw: Quaternion, nowMs: number): RotationEvent | null {
    // Cooldown check
    if (nowMs - this.lastDetectionTime < RotationDetectorV2.COOLDOWN_MS) {
      return null;
    }
    
    // Normalize incoming quaternion
    const normalized = currentRaw.clone().normalize();
    
    // Find closest discrete orientation
    const newIndex = this.findClosestOrientation(normalized);
    
    // No change
    if (newIndex === this.lastOrientationIndex) {
      return null;
    }
    
    // Verify the change is significant (not just noise)
    const dot = Math.abs(Quaternion.dot(
      normalized, 
      REFERENCE_QUATERNIONS[this.lastOrientationIndex]
    ));
    
    if (dot > RotationDetectorV2.MIN_DOT_THRESHOLD) {
      // Too close to previous orientation — likely noise
      return null;
    }
    
    // Compute the rotation that was applied
    const rotation = this.computeRotationBetween(
      this.lastOrientationIndex,
      newIndex
    );
    
    this.lastOrientationIndex = newIndex;
    this.lastDetectionTime = nowMs;
    
    return {
      axis: rotation.axis,
      direction: rotation.direction,
      timestamp: nowMs,
      previousOrientation: this.lastOrientationIndex,
      newOrientation: newIndex,
    };
  }
  
  /**
   * Brute-force search: compare against all 24 reference quaternions.
   * Returns the index with highest absolute dot product.
   */
  private findClosestOrientation(q: Quaternion): OrientationIndex {
    let bestIndex = 0;
    let bestDot = -Infinity;
    
    for (let i = 0; i < 24; i++) {
      const dot = Math.abs(Quaternion.dot(q, REFERENCE_QUATERNIONS[i]));
      if (dot > bestDot) {
        bestDot = dot;
        bestIndex = i;
      }
    }
    
    return bestIndex;
  }
  
  /**
   * Given two orientation indices, compute what single-axis rotation
   * connects them (if possible). Returns the simplest rotation.
   */
  private computeRotationBetween(
    fromIndex: OrientationIndex, 
    toIndex: OrientationIndex
  ): { axis: RotationAxis; direction: CubeMoveDirection } {
    // Pre-computed lookup: for each pair (from, to), store the rotation
    // This table is generated offline from the 24×24 transition matrix
    return ROTATION_TRANSITIONS[fromIndex][toIndex];
  }
  
  public reset(): void {
    this.lastOrientationIndex = this.orientationTracker.getOrientationIndex();
    this.lastDetectionTime = 0;
  }
}
```

### 2.3 Tabla de Transiciones (pre-computada)

Generar una tabla 24×24 donde `ROTATION_TRANSITIONS[i][j]` = el rotation event que transforma la orientación `i` a la orientación `j`.

```typescript
// Para cada par (i, j) donde i ≠ j:
// 1. Obtener permutaciones P_i y P_j
// 2. Calcular P_j * inverse(P_i) = la rotación aplicada
// 3. Si es una rotación de un solo eje (x, y, z, o sus inversos), registrarla
// 4. Si es una composición (ej: x*y), registrar como null (no detectable como simple)
```

**Optimización**: Solo 72 de las 24×24=576 transiciones son rotaciones de un solo eje (24 × 3 ejes × 1 dirección = 72). Las demás son composiciones que el detector no puede descomponer en un solo evento.

### 2.4 Tests Unitarios

| # | Test | Expected |
|---|------|----------|
| 1 | Identity → no rotation | null |
| 2 | Identity → x orientation | {axis:'x', direction:1} |
| 3 | Identity → y orientation | {axis:'y', direction:1} |
| 4 | Identity → z orientation | {axis:'z', direction:1} |
| 5 | x → identity | {axis:'x', direction:-1} |
| 6 | x → y (composite) | null or {axis, direction} if decomposable |
| 7 | Cooldown respected | Two rapid calls → second returns null |
| 8 | Noise rejection | Quaternion near identity → null |
| 9 | 180° detection | Identity → x2 → {axis:'x', direction:2} |
| 10 | Full cycle | x ×4 → identity, four rotation events |
| 11 | Integration with OrientationTracker | After detectRotation, tracker state matches |
| 12 | All 24 orientations reachable | From identity, all 24 reachable via valid rotations |

**Criterios de aceptación**:
- [ ] Todos los tests pasan
- [ ] Cero falsos positivos en conditions controladas
- [ ] Detección < 200ms desde que el cubo alcanza orientación estable
- [ ] Integración con OrientationTracker verificada

---

## FASE 3: MoveSimplifier — Notación Compacta WCA

**Objetivo**: Implementar simplificación de notación según las reglas WCA (Art. 12) y convenciones profesionales.

**Archivos a crear**:
- `packages/math-core/src/MoveSimplifier.ts`
- `packages/math-core/src/MoveSimplifier.test.ts`

### 3.1 Reglas de Simplificación (WCA Art. 12 + convención)

| Pattern | Resultado | Ref |
|---------|-----------|-----|
| R R | R2 | [R3,12a1c] |
| R' R' | R2 | [R3,12a1c] |
| R R' | (vacío) | identidad |
| R2 R | R' | módulo 4 |
| R2 R' | R | módulo 4 |
| R R R | R' | módulo 4 |
| R R R R | (vacío) | identidad |
| x x | x2 | [R3,12a4c] |
| x' x' | x2 | [R3,12a4c] |
| R2 R2 | (vacío) | identidad |

**Regla general**: Para cada movimiento, el amount se acumula módulo 4:
- 0 → eliminar
- 1 → R
- 2 → R2
- 3 → R' (o R3, pero convención es R')

### 3.2 Interfaz

```typescript
export class MoveSimplifier {
  private buffer: Array<{ face: string; amount: number }>; // amount: 1, 2, 3
  
  constructor();
  
  /**
   * Add a move to the buffer. Automatically simplifies.
   * @param face - 'U','D','R','L','F','B','x','y','z' (case-sensitive)
   * @param amount - 1 (CW), -1 (CCW), 2 (180°)
   */
  public addMove(face: string, amount: 1 | -1 | 2): void;
  
  /**
   * Returns the simplified notation string.
   * Example: ['R','R'] → "R2"
   */
  public getDisplayNotation(): string;
  
  /**
   * Returns individual move tokens (for internal motor use).
   * The motor may still need R R separately.
   */
  public getIndividualMoves(): ReadonlyArray<{ face: string; amount: number }>;
  
  /** Clear the buffer */
  public reset(): void;
  
  /** Number of simplified moves in buffer */
  public get length(): number;
}
```

### 3.3 Implementación

```typescript
public addMove(face: string, amount: 1 | -1 | 2): void {
  // Normalize amount: -1 → 3 (mod 4)
  const normalizedAmount = amount === -1 ? 3 : amount;
  
  const last = this.buffer[this.buffer.length - 1];
  
  if (last && last.face === face) {
    // Same face: accumulate amounts mod 4
    const newAmount = (last.amount + normalizedAmount) % 4;
    this.buffer.pop();
    
    if (newAmount !== 0) {
      this.buffer.push({ face, amount: newAmount });
    }
    // If newAmount === 0, moves cancelled (don't push anything)
  } else {
    this.buffer.push({ face, amount: normalizedAmount });
  }
}

public getDisplayNotation(): string {
  return this.buffer
    .map(m => m.face + this.amountToSuffix(m.amount))
    .join(' ');
}

private amountToSuffix(amount: number): string {
  switch (amount) {
    case 1: return '';
    case 2: return '2';
    case 3: return "'";
    default: return ''; // 0 should never appear
  }
}
```

### 3.4 Tests Unitarios

| # | Input | Expected Output |
|---|-------|-----------------|
| 1 | addMove('R',1), addMove('R',1) | "R2" |
| 2 | addMove('R',-1), addMove('R',-1) | "R2" |
| 3 | addMove('R',1), addMove('R',-1) | "" |
| 4 | addMove('R',2), addMove('R',2) | "" |
| 5 | addMove('R',2), addMove('R',1) | "R'" |
| 6 | addMove('R',2), addMove('R',-1) | "R" |
| 7 | addMove('R',1), addMove('R',1), addMove('R',1) | "R'" |
| 8 | addMove('R',1), addMove('R',1), addMove('R',1), addMove('R',1) | "" |
| 9 | addMove('R',1), addMove('U',1) | "R U" |
| 10 | addMove('R',1), addMove('U',1), addMove('R',-1) | "R U R'" |
| 11 | addMove('x',1), addMove('x',1) | "x2" |
| 12 | addMove('x',-1), addMove('x',-1) | "x2" |
| 13 | addMove('R',1), addMove('L',1) | "R L" (different faces, no simplification) |
| 14 | addMove('R',1) × 8 | "" (two full cycles) |
| 15 | getIndividualMoves after R R | [{R,1}, {R,1}] (motor gets individual) |
| 16 | reset | "" |
| 17 | addMove('U',1), addMove('R',1), addMove('U',-1) | "U R U'" |
| 18 | addMove('F',2), addMove('F',1) | "F'" |
| 19 | addMove('B',-1), addMove('B',1) | "" |
| 20 | Large sequence: R U R' U' R' F R2 U' R' U' R U R' F' | simplified correctly |

**Criterios de aceptación**:
- [ ] Todos los tests pasan
- [ ] getDisplayNotation() produce notación WCA válida
- [ ] getIndividualMoves() devuelve movimientos originales sin simplificar
- [ ] Soporte para faces U,D,R,L,F,B,x,y,z (minúsculas para wide moves en futuro)

---

## FASE 4: Integración — Migrar Cube3DPanel y SyncBridge

**Objetivo**: Conectar los nuevos componentes al sistema existente sin breaking changes.

**Archivos a modificar**:
- `apps/web/src/components/Cube3D/Cube3DPanel.tsx`
- `packages/cube-3d-engine/src/hardware/SyncBridge.ts`
- `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts` (menor)

### 4.1 Migrar Cube3DPanel

**Cambios en `Cube3DPanel.tsx`**:

```typescript
// ANTES:
import { OrientationState } from "@cubeforge/math-core";
const orientationState = useRef(new OrientationState());
// ...
const displayFace = orientationState.current.mapFaceForDisplay(ev.face);

// DESPUÉS:
import { OrientationTracker, MoveSimplifier } from "@cubeforge/math-core";
const orientationTracker = useRef(new OrientationTracker());
const moveSimplifier = useRef(new MoveSimplifier());
// ...
const displayFace = orientationTracker.current.mapFaceForDisplay(ev.face);
moveSimplifier.current.addMove(displayFace, ev.direction);
setRecentMoves(moveSimplifier.current.getDisplayNotation().split(' ').filter(Boolean));
```

**Cambios específicos**:

1. Reemplazar `OrientationState` por `OrientationTracker` (línea 14, 29)
2. Agregar `MoveSimplifier` (nuevo ref)
3. En el subscribe de moves$ (línea 67-73):
   - Usar `orientationTracker.current.mapFaceForDisplay()` (igual que antes)
   - Alimentar `moveSimplifier.current.addMove()` con cada move
   - Actualizar UI con `moveSimplifier.current.getDisplayNotation()`
4. En el subscribe de rotation$ (línea 82-88):
   - Cuando se detecta una rotación, llamar `orientationTracker.current.applyRotation()`
   - Alimentar `moveSimplifier.current.addMove()` con la rotación (x, y, z)
5. En el callback `onFacelets` (línea 94-97):
   - Reemplazar `calibrateFromFacelets` (ya no existe en OrientationState)
   - Usar `orientationTracker.current.calibrateFromFacelets(facelets)`
6. Agregar `resetSimplifier` al botón Reset (línea 139-142)

### 4.2 Migrar SyncBridge

**Cambios en `SyncBridge.ts`**:

1. Reemplazar `RotationDetector` por `RotationDetectorV2` (línea 9, 30)
2. `RotationDetectorV2` necesita una referencia al `OrientationTracker` (inyección en constructor)
3. En el handler de gyro (línea 56-70):
   - `RotationDetectorV2.detectRotation()` ahora también actualiza el `OrientationTracker` internamente
   - El `rotation$` event incluye `previousOrientation` y `newOrientation`
4. Eliminar `gyroReferenceSet` (ya no necesario con snapping discreto)

### 4.3 Flujo Integrado Final

```
GAN Hardware
  │
  ├─→ MOVE event
  │     ├─→ SyncBridge → FACE_ROTATION_MAP → 3D engine (sin cambios)
  │     └─→ Cube3DPanel → OrientationTracker.mapFaceForDisplay()
  │           → MoveSimplifier.addMove()
  │           → UI: "R2 U' F"
  │
  ├─→ GYRO event  
  │     ├─→ GyroFusion → 3D scene (sin cambios)
  │     └─→ RotationDetectorV2.detectRotation()
  │           ├─→ OrientationTracker.applyRotation()
  │           ├─→ MoveSimplifier.addMove('x', direction)
  │           └─→ UI: "R2 U' F x"
  │
  └─→ FACELETS event
        └─→ OrientationTracker.calibrateFromFacelets()
              (verificación de consistencia, no reemplaza tracking)
```

### 4.4 Tests de Integración

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Conectar cubo resuelto, no hacer nada | UI: "Waiting for cube..." |
| 2 | Rotar cubo 90° Y, hacer move R | UI muestra B (no R) |
| 3 | Rotar cubo 90° Y, hacer move R R | UI: "B2" |
| 4 | Rotar cubo x, hacer move R | UI muestra move correcto según orientación |
| 5 | Rotación gyroscope detectada | UI: "y" o "y'" aparece |
| 6 | Secuencia R R R R | UI no muestra nada (cancelado) |
| 7 | Reconexión BLE | OrientationTracker mantiene estado |
| 8 | Facelets event llega | Calibration verify (no reset if consistent) |
| 9 | Rotación rápida (10 movimientos en 2s) | Todos registrados correctamente |
| 10 | Rotación + moves simultáneos | No se pierde ninguno |

**Criterios de aceptación**:
- [ ] La UI muestra la notación correcta después de cualquier combinación de rotaciones
- [ ] No hay desincronización entre motor 3D y notación display
- [ ] Los moves se simplifican correctamente en la UI
- [ ] El motor interno sigue recibiendo moves individuales (no simplificados)
- [ ] `npm run typecheck` pasa en todo el monorepo
- [ ] `npm test` pasa en todos los packages

---

## FASE 5: Eliminación de Código Muerto y Limpieza

**Archivos a eliminar**:
- `packages/math-core/src/OrientationState.ts`
- `packages/math-core/src/OrientationState.test.ts`
- `packages/cube-3d-engine/src/hardware/RotationDetector.ts` (reemplazado por V2)

**Archivos a modificar**:
- `packages/math-core/src/index.ts` — exportar OrientationTracker, MoveSimplifier; eliminar OrientationState
- `packages/cube-3d-engine/src/hardware/index.ts` (si existe) — exportar RotationDetectorV2

**Verificación**:
- [ ] `grep -r "OrientationState" packages/` → cero resultados
- [ ] `grep -r "RotationDetector" packages/` (solo V2) → solo referencias a V2
- [ ] No hay imports rotos en ningún archivo
- [ ] `npm run lint` pasa

---

## FASE 6: Documentación y ADR

**Archivos a crear**:
- `docs/03-adr/ADR-XXX-Octahedral-Orientation-Tracking.md`
- `docs/04-rfc/RFC-XXX-Move-Notation-Simplification.md`

### 6.1 ADR: Orientation Tracking

```markdown
# ADR-XXX: Orientation Tracking via Octahedral Group

## Status: Accepted

## Context
CubeForge previously used a Y-axis-only offset (0-3) stored as an integer,
with a static lookup table (DISPLAY_MAP) to map hardware faces to visual faces.
This failed for X/Z rotations and produced inconsistent notation.

## Decision
Adopt the octahedral group O (order 24) as the orientation representation.
Each of the 24 cube orientations maps to a unique permutation of the 6 centers.
OrientationTracker maintains a centers[6] array and composes rotations using
pre-computed permutation tables.

## Consequences
+ Supports all 24 orientations (X, Y, Z rotations)
+ Mathematically deterministic (no heuristics)
+ Consistent with cubing.js KPuzzle center tracking
+ Calibratable from facelet string (all 6 centers)
- More memory than single integer (24 bytes vs 1 byte)
- Requires pre-computed transition table (offline generation)
```

### 6.2 RFC: Notation Simplification

```markdown
# RFC-XXX: Move Notation Simplification

## Status: Accepted

## Context
Raw move events from the hardware are displayed individually (R R instead of R2).
Professional speedcubing tools display simplified notation.

## Decision
Implement MoveSimplifier class that accumulates moves per face and simplifies
using modular arithmetic (mod 4). Simplification is display-only; the motor
continues to receive individual moves.

## Consequences
+ Follows WCA Art. 12 notation conventions
+ Display matches professional tools (csTimer, cubing.js)
+ Motor logic unaffected (single responsibility)
- Buffer state must be reset on cube reset/recalibration
```

---

## ORDEN DE EJECUCIÓN

```
Fase 0 (Tipos) ← sin dependencias
  ↓
Fase 1 (OrientationTracker) ← solo depende de Fase 0
  ↓
Fase 2 (RotationDetectorV2) ← depende de Fase 1
  ↓
Fase 3 (MoveSimplifier) ← sin dependencias (paralelizable con Fase 1-2)
  ↓
Fase 4 (Integración) ← depende de Fases 1, 2, 3
  ↓
Fase 5 (Limpieza) ← depende de Fase 4
  ↓
Fase 6 (Documentación) ← puede hacerse en paralelo con Fase 5
```

**Paralelización**: Fase 3 (MoveSimplifier) puede implementarse en paralelo con Fases 1-2 ya que no tiene dependencias cruzadas.

---

## VERIFICACIÓN FINAL

### Checklist de Cierre

- [ ] Todos los tests unitarios pasan (math-core, cube-3d-engine)
- [ ] `npm run typecheck` pasa en todo el monorepo
- [ ] `npm run lint` pasa en todo el monorepo
- [ ] OrientationTracker soporta las 24 orientaciones (test explícito)
- [ ] RotationDetectorV2 detecta x, y, z, x2, y2, z2 correctamente
- [ ] MoveSimplifier produce notación WCA válida
- [ ] Cube3DPanel muestra notación correcta después de rotaciones
- [ ] El motor 3D no se ve afectado (moves individuales intactos)
- [ ] calibrateFromFacelets funciona con cubo en cualquier orientación
- [ ] No hay imports de OrientationState ni RotationDetector (V1) en el código
- [ ] Documentación ADR/RFC creada
- [ ] El sistema completo es determinístico: mismo input → siempre mismo output
