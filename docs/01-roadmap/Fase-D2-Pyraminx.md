# Fase D2 — Pyraminx: estudio del paisaje de generadores y del cubo

> Fase D del plan `Plan_Eventos_WCA_2026-08.md`. Antes de implementar, se estudió
> de forma amplia qué generadores de scrambles existen (tnoodle, cubing.js, …),
> su licencia, y cómo generan cada cubo. El Pyraminx se eligió como prueba de
> concepto de "hacerlo a mano": se implementó manualmente y quedó jugable.

Fecha: 2026-08 · Rama: `feat/wca-events` · Estado: **D2 completada**.

---

## 1. El paisaje de generadores de scrambles

### 1.1 TNoodle / TNoodle-lib (el oficial de la WCA)

- **Qué es**: el conjunto de programas que usa la WCA para generar los scrambles
  oficiales de cada competición. `tnoodle-lib` es la biblioteca (Java/Kotlin)
  con un scrambler por evento; `TNoodle` es la app (genera PDF de scrambles).
- **Licencia**: **GPL-3.0**. Esto fue la preocupación central del plan (§8): un
  port o copia directa de su código arrastra la GPL si se distribuye.
- **Cómo funciona por evento**: cada puzzle tiene su propio solver/random-state
  (`PyraminxSolver`, `SkewbSolver`, `SquareOnePuzzle`, `TwoByTwoSolver`,
  `NxNxSolver` para 4×4–7×7 vía tablas enormes, `MegaminxSolver`…). No hay un
  motor único: cada evento es un port de investigación (IDA* con tablas de poda
  propias, o reducción+IDA* en los grandes).
- **Verificación**: los scrambles generados se aplican al estado y se comprueba
  que no queden resueltos (random-state real, no random-move).

### 1.2 cubing.js (la alternativa moderna)

- **Qué es**: biblioteca JS (MIT) que implementa scrambles random-state para
  **todos** los eventos WCA, más renderizado 3D y simulador. Es el estándar de
  facto de la comunidad web (csTimer lo usa).
- **Licencia**: MIT → se puede integrar sin problema de licencia.
- **Enfoque**: reimplementaciones propias (inspiradas en TNoodle pero
  reescritas), optimizadas para correr en el navegador.
- **Implicación para nosotros**: si algún día quisiéramos "todos los scrambles
  ya", integrar cubing.js es la vía legalmente limpia y de menor esfuerzo. El
  coste es depender de una librería externa (tamaño, API, control).

### 1.3 Otros

- **csTimer / twSearch / kSolve+**: herramientas históricas. ksolve+ es el motor
  de puzzle-definitions (GPL) que TNoodle usó para algunos eventos; hoy
  tnoodle-lib tiene solvers propios.
- **min2phase / cubing.js internals**: el scramble 3×3 random-state se resuelve
  con Kociemba de dos fases; ya lo usamos (Min2PhaseSolver, WASM).
- **Generadores random-move** (los "fáciles"): tiran secuencias de N movimientos
  al azar. **No cumplen la WCA** (Reg 4b3 exige estado aleatorio con distancia
  mínima garantizada). Son solo para práctica libre.

### 1.4 La decisión "hacerlo a mano" (nuestro enfoque)

La investigación confirmó que **cada evento es un trabajo de port individual**:
no existe un motor único que genere todos los cubos. "Hacerlos manualmente"
significa, por evento:

1. Entender la geometría y el modelo de estado (qué piezas, qué giros).
2. Elegir coordenadas compactas + tablas de movimiento (como TNoodle).
3. Construir tablas de poda (BFS/IDA*), típicamente pequeñas (< 10 MB).
4. Portar el algoritmo oficial de generación (estado aleatorio → filtro de
   distancia mínima → solución exacta → inversa = scramble).

**Veredicto del estudio**: es factible y recomendable para los puzzles "pequeños"
(Pyraminx 933K, Skewb 3.1M, Square-1 552K, 2×2 ya hecho). Para 4×4–7×7 y
Megaminx el coste de tablas es enorme (miles de millones de estados) y ahí la
vía razonable es integrar cubing.js (MIT) o un solver de gran orden ya hecho.
Ese trade-off queda documentado para el RFC de scrambles (§8 del plan).

---

## 2. El Pyraminx a fondo (el caso de prueba)

### 2.1 Geometría y piezas

- Tetraedro regular: 4 caras (F, D, L, R según tnoodle), 4 vértices, 6 aristas.
- **14 piezas móviles** (sin contar el núcleo fijo):
  - **4 tips** (vértices de 1 sticker): 3 orientaciones cada uno — triviales.
  - **4 "corners"** (piezas de centro de cara, 3 stickers): están a **posición
    fija** — solo rotan (3 orientaciones cada una).
  - **6 aristas** (2 stickers): permutan y se voltean (2 orientaciones cada una).
- Estados alcanzables (ignorando tips): 6!/2 × 2⁴ × 3⁴ = **933.120**.
  - /2 por paridad de permutación de aristas (mitad par).
  - 2⁴ y no 2⁶: solo un número par de aristas volteadas (la 6ª orientación se
    deriva). 3⁴: 4 corners, 3 orientaciones, sin restricción extra.
- Con tips: ×3⁴ = 81 → 75.582.720 si se cuentan (la WCA los mezcla en el
  scramble, pero son independientes del estado principal).

### 2.2 Notación y movimientos (WCA)

- 8 movimientos grandes: **U L R B** y sus primos (giro de capa en un vértice).
  Un giro mueve el tip + las 3 aristas del vértice + rota el corner del vértice.
- 8 movimientos de tip: **u l r b** (±') — solo giran el tip.
- Orden de cada movimiento: 3 (U³ = e; U' = U², es decir, el doble giro es la
  inversa del simple — de ahí la notación WCA "U'" que aplica la capa 2 veces).
- **God's number: 11 movimientos** (sin tips). Distribución de profundidad
  (Jaap, ignorando tips):

  | d | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
  |---|---|---|---|---|---|---|---|---|---|---|----|
  | nº estados | 1 | 8 | 48 | 288 | 1.728 | 9.896 | 51.808 | 220.111 | 480.467 | 166.276 | 2.457 | 32 |

  (Total 933.120; media 7,7955. Los 32 de profundidad 11 son los "antípodas".)

### 2.3 El scramble oficial (TNoodle `PyraminxSolver` + `PyraminxPuzzle`)

1. **Estado aleatorio**: permutación de aristas uniforme sobre la mitad par,
   orientación de aristas uniforme (0–31), corners uniforme (0–80), tips
   uniforme (0–80).
2. **Filtro WCA (Reg 4b3, `wcaMinScrambleDistance = 6`)**: si el estado se
   resuelve en < 6 movimientos, se regenera.
3. **Solución en EXACTAMENTE 11 movimientos** (`generateExactly`): búsqueda
   IDA* con dos tablas de poda (permutación de aristas 720; orientaciones
   2592), sin dos movimientos seguidos de la misma cara, con orden de
   movimientos aleatorizado. (La longitud oficial del scramble es 11 = God's
   number; la WCA no acepta scrambles más largos para Pyraminx.)
4. **El scramble es la INVERSA de la solución**, con los movimientos de tips
   añadidos al final (en minúscula, un movimiento por tip sin resolver).

Invariante oficial: `nº tokens == 11 + tips_sin_resolver`.

### 2.4 Nuestra implementación (`@cubalyze/solver-engine`)

Port fiel en TypeScript (`PyraminxSolver.ts`) con las mismas coordenadas
(packing mixed-radix de TNoodle), tablas de movimiento y poda idénticas, y el
mismo flujo de generación. Tres notas de ingeniería:

1. **Bug de RNG encontrado y corregido**: el contrato de `pick(n)` es "valor en
   [0, n)". El default era `Math.random()`, que **ignora n** → `floor(Math.random())`
   = 0 siempre → el muestreo devolvía siempre el estado resuelto y el filtro de
   distancia hacía bucle infinito. El default ahora escala: `(n) => Math.random() * n`.
   (Los tests con LCG pasaban porque el LCG sí escalaba por n.)
2. **Transposition set en la búsqueda**: la búsqueda exacta-11 de TNoodle puede
   degenerar a explorar los ~484M nodos del árbol para estados con pocas
   soluciones exactas (probamos que **todo** estado tiene al menos una: la capa
   de longitud exacta 11 cubre los 933.120 estados). Añadimos un conjunto de
   transposición por (estado, última cara) — no solo estado, porque la regla
   "no dos movimientos de la misma cara" depende del camino — con semántica de
   máxima profundidad restante. Resultado: generación **1 ms media, 21 ms peor
   caso** (medido en 2.000 scrambles).
3. **Verificación contra Jaap**: un test BFS sobre el espacio completo de
   estados comprueba que la distribución de profundidades coincide **exactamente**
   con la tabla de Jaap (1, 8, 48, 288, 1728, 9896, …, 32) — si cualquier ciclo,
   volteo u orientación estuviera mal, la tabla no encajaría.

**Licencia**: **libre de GPL desde 2026-08.** La primera versión era un port
directo del scrambler de TNoodle (obra derivada GPL); fue **sustituida por una
implementación clean-room** escrita desde la especificación pública
(`Fase-D2-Pyraminx-Cleanroom.md`), con nomenclatura y estructura propias y
factorádico con arrays (sin el truco de bits de TNoodle). El módulo actual no
contiene código derivado de TNoodle ni de ningún otro scrambler de terceros, y
**no arrastra obligaciones GPL**. El comportamiento es equivalente y está
validado por la misma suite de aceptación (reproducción exacta de la tabla de
Jaap + 1.000 scrambles). Queda como alternativa cubing.js (MIT) para el RFC de
scrambles si se prefiere una librería externa.

### 2.5 Verificación (tests)

| Test | Qué prueba |
|---|---|
| BFS completo vs Jaap | Distribución de profundidades exacta (933.120 estados, God 11, 32 antípodas) |
| Paridad | Exactamente 360 de 720 permutaciones alcanzables |
| Identidades | m·m⁻¹ = e; orden 3; doble giro = inversa |
| Notación | parseo/round-trip de WCA; rechaza tokens inválidos |
| 1.000 scrambles | exactamente 11 movimientos + tips; aplica → no resuelto; inversa restaura; distancia real ∈ [6, 11] |
| Determinismo | misma RNG → mismo scramble |

### 2.6 Integración

- Registro: `pyram` → provider `pyraminx-random-state` (spec `scrambleProvider`,
  sin tocar reglas: `SPEED_RULES`).
- Web: provider real en `scrambleProviders.ts`; el selector data-driven (A6)
  muestra Pyraminx como **jugable** automáticamente (lista derivada del
  registro). Los "ghosts" restantes (4×4–7×7, Megaminx, Skewb) siguen ocultos.
- Stats/sesiones: nada que migrar — `'pyram'` ya era un código WCA válido
  (ADR-002) aceptado por la DB.

### 2.7 Limitaciones conocidas

- **Panel 3D**: el visor 3D solo soporta cubos (2×2/3×3); con un scramble de
  Pyraminx hace fallback a "no hace nada" con un warn (no crashea). Renderizar
  un tetraedro queda fuera del alcance de D2.
- **Análisis por solve**: ninguno (declarado `analysis: NONE`), coherente con la
  decisión de alcance de la Fase D.
- **Reconstrucciones/training**: sin catálogo Pyraminx (decisión de alcance).

---

## 3. Siguiente

Con la plantilla D2 (estudio → modelo → port → tests → integración) repetible,
los siguientes eventos por orden natural: **D3 Skewb** (misma familia de
vértices, 3,1M estados — port directo del `SkewbSolver` de TNoodle) y
**D4 Square-1** (552K estados, scramble por forma). Para **D5+ (4×4–7×7,
Megaminx)** abrir el RFC de la librería de scrambles (cubing.js MIT vs port
propio con tablas enormes).
