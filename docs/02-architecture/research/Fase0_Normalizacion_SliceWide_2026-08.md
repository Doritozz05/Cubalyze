# Fase 0 — Normalización de slices y wides en el análisis del smart cube

> Fecha: 2026-08. Estado: **ground-truth empírica cerrada**; fases 1–5 pendientes.
> Cubo de prueba: GANi39YX (giroscopio SÍ).
> Evidencia: JSONs de sonda en `~/Downloads/cubeforge-probe-*.json` (2 sesiones).

---

## 1. Objetivo

El firmware GAN descompone los movimientos de capa intermedia (slices) y las
capas dobles (wides) en **giros de cara** porque su protocolo solo codifica
6 caras (`URFDLB`). Consecuencias actuales en el análisis del smart cube:

- Un slice **M** llega como 2 eventos (`R` + `L'`), inflando el recuento de
  movimientos, el TPS por fase y ensuciando la notación.
- Un wide **r** llega como 1 evento en la cara opuesta (`L`) + una rotación
  del core, y esa rotación se cuenta como "rotación" del cubo.
- La rotación del core que provocan los slices/wides **no** es un giro real
  del cubo, pero `RotationCounter` la suma igualmente (de ahí los x:11 del
  solve auditado).

**Meta:** un normalizador (toggle en Ajustes → Análisis, default ON) que
reensamble slices y wides a su representación canónica y separe las
rotaciones de core de los giros reales, convergiendo con la ruta de texto
(`expandWideMoves` + `conjugateToBaseFrame`).

---

## 2. Hallazgo raíz: el discriminador es la ROTACIÓN del core

Un slice mueve los centros (M contiene U/F/D/B, E contiene F/R/B/L, S
contiene U/R/D/L), así que **el core rota** y el giroscopio lo reporta. Dos
giros de cara por separado no mueven el core.

**Los eventos de cara son IDÉNTICOS** en ambos casos; la única señal fiable
que distingue "slice" de "dos giros de cara" es la rotación del giroscopio:

| Acción | Eventos de cara | Rotación | Clasificación |
|---|---|---|---|
| U luego D' (separados, Δt 2129 ms) | `U`, `D'` | ninguna | dos giros de cara |
| U + D' simultáneos (Δt 3 ms) | `U`, `D'` | ninguna | dos giros de cara |
| E slice (capa media, Δt 34 ms) | `U`, `D'` | y' | **slice** |

El Δt NO discrimina: se observaron slices con Δt 4–377 ms y dos giros de
cara con Δt 3 ms sin rotación.

---

## 3. Plan de implementación (fases 1–5)

### Fase 1 — Normalizador + toggle
1a. Auditar la ruta de texto como referencia canónica (hecho, §5).
1b. Módulo puro `normalizeSliceWideMoves(moves, orientations)` que:
   - reensambla slices (2 eventos opuestos + rotación) → `M/M'/E/E'/S/S'`;
   - reensambla wides (1 evento en cara opuesta + rotación) → `face + slice`;
   - separa las rotaciones de core (sale una lista `reorientations` aparte);
   - tolera orden no determinista y pares cortados.
1c. Toggle en Ajustes → Análisis (default ON).

### Fase 2 — Integración en el pipeline smart
- Insertar el normalizador entre `compactCubeMoves` y `TimelineBuilder`.
- Restar las rotaciones de core del `RotationCounter`.
- Verificar sobre el solve auditado (los 39 D-moves, 87 movimientos, x:11)
  que los recuentos quedan correctos.

### Fase 3 — F2L sub-segmentado en la timeline
- La timeline dibuja F2L como un bloque verde único; `segmentF2LPairs` ya
  produce `startIndex`/`endIndex` por par. Dibujar 4 sub-segmentos con los
  huecos de reconocimiento entre pares.
- Corregir la numeración de pares con xcross (la ruta smart numera 1,2,3… e
  ignora los pares ya resueltos en el cross; la ruta de texto usa
  `crossPairCount + i + 1` correctamente).
- (Opcional) split reconocimiento/ejecución por par: `pauseBeforeMs` ya es
  casi el reconocimiento; falta restar ~100 ms de turno y etiquetarlo.

### Fase 4 — Replay con rotaciones separadas de los movimientos
- Aplicar las rotaciones como animación del cubo-raíz y **después** el
  movimiento, en vez de "movimiento + rotación" a la vez.
- Esto depende de que la fase 2 ya separe las rotaciones de core.

### Fase 5 — Animación de slices y wides en el replay (como la ruta de texto)
- Hoy el replay anima cada evento de cara por separado: un M se ve como dos
  giros (`L` + `R'`) más una rotación del cubo, y un wide como cara + slice
  por separado.
- Con la normalización (fase 1b), un M detectado se renderiza como **UN solo
  giro de capa media** (limpio, como un cubo real), y un wide como **una sola
  capa doble** — igual que ya hace la ruta de texto con sus tokens M/E/S y
  wides expandidos a face+slice.
- Depende de la fase 1b (tokens canónicos) y se coordina con la fase 4
  (orden rotación → movimiento).

---

## 4. Ground-truth empírica (resultados por test)

### 4.1 Slices simples (Grupo A) — CONFIRMADO

| Slice | Eventos crudos | Rotación (faceMap) | Δt típico |
|---|---|---|---|
| M (dir L) | `R` + `L'` (orden variable) | x' = `F:U U:B R:R` | 4–30 ms |
| M' | `L` + `R'` | x = `F:D U:F R:R` | 15–25 ms |
| E (dir D) | `U` + `D'` | y' = `F:L U:U R:F` | 34–47 ms |
| E' | `D` + `U'` | y = `F:R U:U R:B` | 31–54 ms |
| S (dir F) | `B` + `F'` | z = `F:F U:L R:U` | 35–168 ms |
| S' | `F` + `B'` | z' = `F:F U:R R:D` | 69–168 ms |

- Las direcciones de los dos eventos son siempre **opuestas**.
- **El orden del par NO es determinista** (`R L'` vs `L' R` para M) → casar
  por conjunto, no por orden.

### 4.2 Slices 180° (Grupo B) — CONFIRMADO

M2/E2/S2 = **4 eventos** (dos pares opuestos encadenados) + **2 rotaciones**
(el quaternion barre 90° y 180°).

Ejemplo M2: `L R' L R'` + orientaciones `x, x2`.

### 4.3 Wide moves (Grupo C, re-test) — CONFIRMADO

| Wide | Eventos crudos | Rotación |
|---|---|---|
| r (doble R) | `L` (1 evento) | x |
| r' | `L'` | x' |
| r2 | `L` `L` (= L2) | x, x2 |
| u (doble U) | `D` (1 evento) | y |
| u' | `D'` | y' |
| u2 | `D` `D` (= D2) | y, y2 |

**Regla: un wide = 1 giro en la cara OPUESTA + la rotación del core en el
eje del wide.** El 180° es el doble.

Consistencia algebraica (verifica contra la ruta de texto):
- `r = R + M'`; `M' = L' + R + x` → `R + L' + R = L` → **`r = L + x`** ✓
- `u = U + E'`; `E' = D + U' + y` → `U + D + U' = D` → **`u = D + y`** ✓

### 4.4 Rotaciones de cubo entero (Grupo E) — CONFIRMADO

x/y/z = **0 eventos de cara** + **1 cambio de orientación**. Calibra el
contador de rotaciones.

### 4.5 El discriminador (Grupos D y F) — CONFIRMADO

| Test | Movimientos | Rotación | Veredicto |
|---|---|---|---|
| D5: U D' lentos (separados) | `U`, `D'` | ninguna | dos giros |
| D2: U D' simultáneos (dos caras) | `U`, `D'` | ninguna | dos giros |
| D6: E slice (capa media) | `U`, `D'` | y' | slice |
| D7: L R' lentos | `L`, `R'` | ninguna | dos giros |
| D8: M slice | `R`, `L'` | x' | slice |
| D9: F B' lentos | `F`, `B'` | ninguna | dos giros |
| D10: S slice | `B`, `F'` | z | slice |
| F1: L lento → R' lento | `L`, `R'` | ninguna | dos giros |
| F2: M rápido | `R`, `L'` | x' | slice |

---

## 5. Formato canónico objetivo (convergencia con la ruta de texto)

La ruta de texto ya produce la representación correcta:

- `expandWideMoves` (`math-core/src/MoveExpander.ts`): `r → R M'`, `l → L M`,
  `u → U E'`, `d → D E`, `f → F S`, `b → B S'`. Los slices M/E/S pasan tal cual.
- `conjugateToBaseFrame` (`math-core/src/notation/conjugateToBaseFrame.ts`):
  conjuga los slices por el grip (M↔L, E↔D, S↔F vía `CW_FROM_FACE`).

**El normalizador smart debe producir exactamente este formato**: wides
expandidos a `face + slice`, slices como tokens `M/E/S`, y las rotaciones de
core aparte. Así ambas rutas comparten el mismo pipeline downstream
(`TimelineBuilder` con `stateTokens`, detección de fases, métricas).

Verificación (fase 1a) — **CONFIRMADO**:
- `expandWideMoves` expande `r → R M'`, `u → U E'`, `f → F S`, `l → L M`,
  `d → D E`, `b → B S'` (test `MoveExpander.test.ts`).
- `CubeState.applySequence("r U R' U'") ≡ applySequence("R M' U R' U'")`
  (mismo cp/ep/co/eo) — la representación face+slice es state-consistente.
- Álgebra cruzada con la ground-truth del cubo:
  - `M = R L' + x'` → `M' = L' R + x`
  - `r = R + M' = R + (L' R x) = L x` ✓ (el cubo reporta `L` + x)
  - `u = U + E' = U + (D U' y) = D y` ✓ (el cubo reporta `D` + y)
- Por tanto la ruta de texto es la **referencia canónica correcta** y el
  normalizador smart debe convertir el crudo a ese mismo formato.

---

## 6. Regla de normalización (especificación de fase 1b)

Entrada: `moves` (CubeMoveEvent crudos) + `orientations` (snapreadas).

Por cada rotación de core detectada (cambio de faceMap):
1. Si coinciden **2 eventos** en las dos caras del eje con direcciones
   opuestas → re-codificar como slice `M/M'/E/E'/S/S'` según §4.1, y mover
   la rotación a `reorientations`.
2. Si coincide **1 evento** en una de las caras del eje → re-codificar como
   wide `r/r'/l/l'/u/u'/d/d'/f/f'/b/b'` (expandido a `face + slice`) según
   §4.3, y mover la rotación a `reorientations`.
3. Si **no** hay eventos coincidentes → es una rotación real del cubo
   (dejarla en el contador).

Casos borde:
- 180° (2 eventos idénticos consecutivos + 2 rotaciones) → slice/wide `2`.
- Par cortado (captura perdida) → no romper; dejar los eventos sueltos.
- Orden del par no determinista → casar por conjunto.

---

## 7. Hallazgos para las fases 3–4

- `segmentF2LPairs` ya da `startIndex`/`endIndex` por par (FR/FL/BR/BL) y
  `pauseBeforeMs` (≈ reconocimiento). La timeline solo dibuja un bloque verde
  → sub-segmentar en 4.
- Bug de numeración con xcross: la ruta smart numera `pairNumber = 1,2,3…`
  sin contar los pares ya resueltos en el cross; la ruta de texto usa
  `crossPairCount + i + 1` (correcto).
- No hay split rec/exec por par F2L; `pauseBeforeMs` es la materia prima
  (falta restar ~100 ms de ejecución de turno).
- El reconocimiento OLL/PLL/CMLL ya se calcula y muestra correctamente
  (`ollRecognitionMs`, etc.) — no confundir con el `recognitionMs: 0` del
  `PhaseSegment` genérico, que es por diseño.
- La eficiencia usa el solver (Min2Phase) y se muestra en Insights
  (`moveEfficiencyRatio` + `optimalMoveCount`) — correcto.

---

## 8. Artefactos de la sonda y lecciones

- Una captura puede cortar un evento (A1: 7 en vez de 8) → el normalizador
  debe tolerar pares impares.
- El orden del par de un slice varía → no asumir orden.
- El primer move de una sesión de SONDA puede perderse por el handshake
  facelets/BLE — en la app real no ocurre; se ignora (no es bug del análisis).
- Los tests deben re-gripar a "blanco arriba / verde frente" tras cualquier
  slice/wide, porque rotan el core.
