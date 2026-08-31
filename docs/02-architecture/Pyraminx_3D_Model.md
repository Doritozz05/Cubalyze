# Pyraminx 3D Model — Definición profunda (spec P1b)

**Fecha**: 2026-08-31
**Estado**: Spec de implementación — P1b de la arquitectura multi-puzzle 3D (`docs/02-architecture/Multi_Puzzle_3D_Architecture.md`)
**Ámbito**: `packages/cube-3d-engine/src/pyraminx/` + builder registrado + estado desde `@cubeforge/solver-engine`
**Fuentes**: geometría del tetraedro regular (hechos públicos), tablas de movimiento del scrambler oficial WCA (port clean-room en `packages/solver-engine/src/PyraminxSolver.ts`), Ruwix y mzrg (anatomía del puzzle), reglamento WCA (Reg 4b3, notación).

---

## 1. Resumen ejecutivo

El Pyraminx es un **tetraedro regular de orden 3** (cada cara subdividida en 9 triángulos). Tiene **14 piezas móviles** y **36 stickers** (9 por cara, 4 colores). Los giros son de **±120°** alrededor de **4 ejes por vértice** — el mismo mecanismo de 4 ejes del Skewb (de hecho, el Skewb es un shape-mod del Pyraminx: mismos ejes de vértice, otra forma). Toda la lógica de estado (permutaciones, flips, orientaciones) ya existe en `PyraminxSolver.ts` y es la **fuente de verdad**; el modelo 3D solo la refleja visualmente.

---

## 2. Geometría

### 2.1 Tetraedro regular — coordenadas canónicas

Vértices (circumradio = 1, centrado en el origen, vértice **U arriba**):

| Vértice | Coordenadas |
|---|---|
| U (arriba) | `(0, 0, 1)` |
| R | `(2√2/3, 0, -1/3)` |
| L | `(-√2/3, √6/3, -1/3)` |
| B | `(-√2/3, -√6/3, -1/3)` |

- Arista: `a = 2√(2/3) ≈ 1.633` (todas iguales — tetraedro regular). Inradio: `1/3`.
- Caras (opuestas a cada vértice): `U` (base, z=-1/3, normal saliente `(0,0,-1)`), `L`, `R`, `B`.

### 2.2 Ejes de giro (4 ejes por vértice)

Cada giro rota alrededor del eje que pasa por el **vértice y el centro** (dirección = posición del vértice, ya unitaria):

| Eje | Dirección (unitaria, desde el centro al vértice) |
|---|---|
| U | `(0, 0, 1)` |
| L | `(-√2/3, √6/3, -1/3)` |
| R | `(2√2/3, 0, -1/3)` |
| B | `(-√2/3, -√6/3, -1/3)` |

Nota profesional: estas 4 direcciones son las **diagonales del cuerpo del cubo** — el puente directo con el Skewb (mismo mecanismo de 4 ejes, piezas y forma distintas).

### 2.3 Slots de piezas

- **4 slots de esquina** (fijos): los 4 vértices — posición de los corner pieces.
- **4 slots de tip**: los 4 vértices, el extremo más exterior — posición de los tips.
- **6 slots de arista** (puntos medios de las 6 aristas):

| Arista | Midpoint |
|---|---|
| UL | `(-√2/6, √6/6, 1/3)` |
| UR | `(√2/3, 0, 1/3)` |
| UB | `(-√2/6, -√6/6, 1/3)` |
| LR | `(√2/6, √6/6, -1/3)` |
| LB | `(-√2/3, 0, -1/3)` |
| RB | `(√2/6, -√6/6, -1/3)` |

Índices de arista (alineados con `PyraminxSolver`): `0=LR, 1=UL, 2=LB, 3=UR, 4=RB, 5=UB`.

---

## 3. Piezas

**14 piezas móviles** — todas son tetraedros que teselan el tetraedro grande:

| Pieza | Cantidad | Stickers | Posición | Comportamiento |
|---|---|---|---|---|
| **Tip** | 4 | 3 (uno por cara que toca su vértice) | En los 4 vértices (lo más exterior) | **Trivial**: rota en solitario con los giros minúscula (`u/l/r/b`), 3 orientaciones |
| **Corner** | 4 | 3 (uno por cara que toca su vértice) | En los 4 vértices (bajo el tip) | **Posición fija, rota en el sitio** con los giros mayúscula (`U/L/R/B`), 3 orientaciones |
| **Edge** | 6 | 2 (uno en cada una de las 2 caras que comparten su arista) | Puntos medios de las 6 aristas | **Permutan y se voltean** (2 orientaciones: normal / flip) |

Total stickers: `4×3 + 4×3 + 6×2 = 36` = `9 × 4 caras` ✓.

### 3.1 Anatomía verificada (fuentes)

- Ruwix: "four triangular faces... divided into nine identical smaller triangles"; piezas: corner tips, centers (1 sticker visible por cara) y edges (2 stickers). El "centro" de cada cara pertenece a un **corner piece** (por eso "sus 3 lados están ligados").
- mzrg: "two important types of pieces: the four corners (the pieces touching the trivial tips) and the six edges".
- `PyraminxSolver.ts` (clean-room WCA): "4 tips, 4 corners (face centres) — FIXED positions, rotate only —, 6 edges — permute and flip".

---

## 4. Stickers — layout por cara

Cada cara es un triángulo subdividido en una **rejilla triangular de lado 3** (filas 1/3/5 = 9 triángulos). Coordenadas locales `(fila 0..2, col)`:

```
         (0,0)              ← tip (vértice superior de la cara)
      (1,0) (1,1) (1,2)     ← (1,0),(1,2) = edges; (1,1) = corner
   (2,0) (2,1) (2,2) (2,3) (2,4)   ← (2,0),(2,4) = tips; (2,1),(2,3) = corners; (2,2) = edge
```

| Posiciones | Pieza |
|---|---|
| `(0,0)`, `(2,0)`, `(2,4)` | 3 **tips** (vértices de la cara) |
| `(1,0)`, `(1,2)`, `(2,2)` | 3 **edges** (punto medio de cada lado) |
| `(1,1)`, `(2,1)`, `(2,3)` | 3 **corners** (1 por vértice de la cara; `(1,1)` es el "centro" de la cara) |

- El "centro" de la cara (`(1,1)`) pertenece al corner del vértice opuesto a la cara... *(verificación: los 3 corners de la cara F son los de los 3 vértices de F; cada uno aporta 1 sticker a F; el vértice opuesto a F no toca F, así que sus stickers están en las otras 3 caras).*
- **Colores (esquema WCA estándar, constante configurable)**: `U=yellow`, `L=green`, `R=blue`, `B=red`. En resuelto, cada cara es monocolor: sus 9 stickers del color de la cara.

---

## 5. Movimientos — notación WCA

| Notación | Giro | Piezas afectadas |
|---|---|---|
| `U L R B` (+ `'`) | Giro completo del vértice | 3 edges que tocan el vértice + corner del vértice + tip del vértice |
| `u l r b` (+ `'`) | Giro solo del tip | únicamente el tip del vértice |

- **Orden 3**: cada giro = 120°; el "primo" = los otros 120° (equivalentemente 2×120° en el mismo sentido). En el modelo 3D se anima primo como **−120°**.
- **Permutación de edges por giro** (tabla del scrambler oficial, `PyraminxSolver.FACE_TURNS`):

| Giro | Ciclo de edges | Edges que se voltean | Corner |
|---|---|---|---|
| U | `[1,5,3]` = UL→UB→UR | `[1,3]` (UL, UR) | U |
| L | `[0,2,1]` = LR→LB→UL | `[0,1]` (LR, UL) | L |
| R | `[0,3,4]` = LR→UR→RB | `[3,4]` (UR, RB) | R |
| B | `[2,4,5]` = LB→RB→UB | `[4,5]` (RB, UB) | B |

- **Slices del modelo 3D** (por vértice, alineados con la tabla): un giro X afecta exactamente a las piezas en el slot del vértice X: `edgesIncidentes(X) + corner(X) + tip(X)`.

### 5.1 Scramble oficial WCA

- Longitud **11 giros** (God's number del Pyraminx sin tips) + **giros de tips** (minúscula) añadidos al final, uno por tip sin resolver.
- Estado aleatorio uniforme entre los **933.120 estados alcanzables** sin tips (×81 con tips = 75.582.720); filtro **Reg 4b3**: distancia ≥ 6 giros.
- Generador ya implementado: `generatePyraminxScramble()` en solver-engine (verificado contra la distribución de profundidad de Jaap).

---

## 6. Estado lógico — puente con el 3D

**Fuente de verdad**: `PyraminxState` de `@cubeforge/solver-engine` (coordenadas empaquetadas):

```ts
interface PyraminxState {
  edgePerm: number;    // rango factorádico de la permutación de 6 edges [0,720)
  edgeOrient: number;  // orientaciones de edges 0..4 en 5 bits [0,32) (la 6ª se deriva)
  cornerOrient: number;// 4 corners en base 3 [0,81)
  tips: number;        // 4 tips en base 3 [0,81)
}
```

API de transición (todas en solver-engine): `applyPyraminxMove(state, moveIndex)` (8 giros), `applyPyraminxTip(state, tipMoveIndex)` (8 tips), `isPyraminxSolved(state)`, `solvedPyraminx()`.

**Modelo 3D — estado por pieza** (espejo del cubo):

- Cada pieza (edge/corner/tip) tiene: `homeSlot`, `currentSlot`, `quaternion`.
- Un giro 3D = el driver genérico (`RotationDriver3D`) anima el slice y, al commitear, el modelo actualiza `currentSlot` de las piezas según la tabla del §5 — la misma permutación que `applyPyraminxMove`.
- **Sync absoluto desde `PyraminxState`** (necesario para cargar un scramble sin animar): se reconstruye por permutación de slots + orientación (flip de edge = quaternion 180° alrededor del eje perpendicular a la arista en el plano de la cara; twist de corner/tip = rotación ±120° alrededor del eje del vértice). *Fase opcional (P1b bis): un convertidor facelets↔estado solo si se quiere sync por string.*

---

## 7. Verificación (tests P1b)

1. **Geometría**: tetraedro regular (aristas iguales), ejes unitarios, slots en las posiciones esperadas.
2. **Piezas**: 14 piezas (4 tips + 4 corners + 6 edges), 36 stickers (9 por cara, 4 colores).
3. **Permutaciones**: aplicar cada giro 3D y comparar el `PyraminxState` resultante con `applyPyraminxMove` para los 8 giros (y tips). Los estados deben coincidir — es la prueba de que la rotación 3D es fiel a la física.
4. **Ciclos**: 3 giros del mismo vértice = identidad (orden 3); `X'` = `X` 2×.
5. **Solved**: estado resuelto → `isPyraminxSolved` true.
6. **Scramble**: aplicar `generatePyraminxScramble()` en el 3D (vía el driver, como el cubo) termina en un estado no resuelto y consistente con solver-engine.

---

## 8. Implementación 3D (P1b)

```
packages/cube-3d-engine/src/pyraminx/
├── PyraminxGeometry.ts   # constantes: vértices, ejes, slots, tabla de giros
├── PyraminxMeshFactory.ts# piezas (tetraedros) + stickers triangulares + colores
├── PyraminxModel.ts      # piezas + estado por slot + applyMove (permutación)
├── PyraminxEngine.ts     # (opcional) engine propio si se necesita más que el driver
├── index.ts              # builder → registerPuzzle3D({ kind: 'pyraminx' })
└── __tests__/            # §7
```

- **Mesh**: `TetrahedronGeometry` por pieza (las 14 son tetraedros); material por cara (expuestas = color, internas = seam); stickers = `ShapeGeometry` triangular sobre las caras expuestas. Estilo `stickered`/`stickerless` reutilizando el patrón de `CubeMeshFactory`.
- **Rotación**: `RotationDriver3D` genérico — el slice de un giro X es `{ id: { vertex: 'U'|'L'|'R'|'B' }, axis: AXIS[X] }`; hooks: `getSlicePieces` (slots incidentes), `commitSlice` (permutación de slots + espejo en `PyraminxState`), sin `snapPieces` (no hay grid que fijar).
- **Builder**: registra `{ kind: 'pyraminx' }` → construye el engine. `createPuzzle3DEngine({ kind: 'pyraminx' }, opts)` deja de lanzar "no registered" (hoy es el error honesto esperado).
- **Nota de ingeniería**: la raíz del modelo se orienta con el vértice U arriba; la cámara isométrica hereda el encuadre del cubo (radius ≈ 3 — el tetraedro de circumradio 1 cabe de sobra).

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Rotación 3D no fiel a la física (permutaciones distintas al scrambler oficial) | Test §7.3: cada giro 3D debe producir el mismo `PyraminxState` que `applyPyraminxMove` |
| Confundir "primo" con 2×120° | Animación: primo = −120° (mismo resultado físico); verificado por el test de ciclos (§7.4) |
| Derivar quaternions del estado empaquetado (flips/twists) | En P1b el 3D se mueve **por movimientos** (driver + espejo de estado); el sync absoluto desde `PyraminxState` queda como fase posterior con su propio test |
| Romper el cubo al añadir el Pyraminx | Todo aditivo: el builder es opt-in; la suite del cubo (276 tests) es la red |
| Asignación sticker↔pieza incorrecta en la rejilla 9 | El layout del §4 es la spec; verificado por el conteo total (36) y la prueba de cara monocolor resuelta (§7.5) |

---

## 10. Referencias

- `packages/solver-engine/src/PyraminxSolver.ts` — scrambler random-state clean-room WCA (tablas, encoding, distribución de Jaap).
- `docs/01-roadmap/Fase-D2-Pyraminx-Cleanroom.md` — spec matemática del modelo y los giros.
- Ruwix — anatomía (tips/centers/edges) y notación: https://ruwix.com/twisty-puzzles/pyraminx-triangle-rubiks-cube/
- mzrg — notación (1-layer = minúscula, 2-layer = mayúscula) y métodos: https://www.mzrg.com/rubik/solving/pyraminx/index.html
- Reglamento WCA — Reg 4b3 (distancia mínima) y notación.
