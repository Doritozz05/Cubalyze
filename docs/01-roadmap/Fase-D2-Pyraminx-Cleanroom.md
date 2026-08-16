# Fase D2 — Vía clean-room: especificación del scrambler de Pyraminx

> Documento de trabajo (no un ADR). Su propósito: que `PyraminxSolver.ts` pueda
> reimplementarse **sin arrastrar la GPL de TNoodle** si algún día el proyecto
> se distribuye. Contiene (a) el inventario de qué partes del archivo actual son
> expresión de TNoodle, y (b) la especificación formal del algoritmo escrita
> desde la matemática, para implementarla sin abrir el código Java original.

Fecha: 2026-08 · Estado: **EJECUTADO** — `PyraminxSolver.ts` fue reescrito
siguiendo §3 (implementación clean-room original, sin código de TNoodle, sin
obligaciones GPL), validado por la suite de aceptación de §5 y sustituyó al
port directo. Este documento queda como especificación de referencia y como
prueba del proceso.

---

## 1. Marco legal (corto y práctico)

| Contenido | ¿Protegible? | Fuente libre |
|---|---|---|
| Algoritmos, fórmulas matemáticas, métodos de búsqueda | **No** (no son copyrightables) | Jaap's Puzzle Page, papers, conocimiento general |
| Hechos del puzzle (qué piezas mueve cada giro, paridad, God's number, tabla de profundidades) | **No** (son hechos físicos/matemáticos) | Jaap, la geometría del tetraedro, el propio cubo |
| Comportamiento exigido por la WCA (longitud, distancia mínima, formato) | **No** (regulaciones públicas) | Regulaciones WCA, sitio oficial |
| **Expresión** (código concreto, estructura, nombres, comentarios) | **Sí** | — (en nuestro caso, GPL-3.0 de TNoodle-lib) |

Consecuencia directa: un scrambler puede implementarse de cero usando solo los
tres primeros bloques, siempre que no se copie la *expresión* del código Java de
TNoodle (ni de nuestro port actual, que es derivado de él).

---

## 2. Inventario de `PyraminxSolver.ts` (569 líneas)

Qué es expresión de TNoodle y qué no. Referencias de línea del archivo actual.

| Sección (líneas) | Contenido | Naturaleza |
|---|---|---|
| 1–39 (cabecero) | Documentación del modelo y del algoritmo | Nuestro (escrito por nosotros; menciona el port) |
| 41–58 (constantes) | `N_EDGE_PERM = 720`, `N_EDGE_ORIENT = 32`, `N_CORNER_ORIENT = 81`, `N_TIPS = 81`, `N_MOVES = 8`, `MAX_LENGTH = 20`, longitud 11, distancia mínima 6 | **Matemática + WCA** (los números son hechos; los NOMBRES espejan el Java → expresión) |
| 58 (`FACT`) | Tabla de factoriales | **Matemática** |
| 60–78 (estado) | Interfaz `PyraminxState`, `solvedPyraminx`, `isPyraminxSolved` | Nuestro (API propia) |
| 82–142 (pack/unpack) | Rank/unrank de permutación (**truco de bits `0x543210`/`0x111110`**), orientación de aristas (5 bits + XOR), corners/tips base-3 | El **truco de bits es expresión de TNoodle**; el factorádico y el base-3 son matemática estándar. Nombres idénticos al Java |
| 144–178 (moves) | `cycleAndOrient`, `moveEdges`, `moveCorners` | Los **ciclos son hechos geométricos** (§3.3); la firma y estructura espejan el Java → mezcla |
| 180–218 (tablas de movimiento) | Precomputación de las 3 tablas 720×8, 32×8, 81×8 | **Técnica estándar** (tablas de transición); nombres = expresión |
| 220–262 (tablas de poda) | BFS desde resuelto: poda de permutación (720) y poda combinada de orientación (2592) | **Algoritmo estándar** (BFS + tablas de poda, IDA* clásico); nombres = expresión |
| 264–296 (helpers) | `ensureTables`, `pyraminxDistanceBound`, `isPyraminxReachable`, `unsolvedTips` | Nuestro (API) + `unsolvedTips` = expresión del nombre Java |
| 298–433 (búsqueda) | IDA* DFS con poda, restricción de cara, orden aleatorio, **transposition set** | **Algoritmo estándar** + **nuestra mejora** (el transposition set NO existe en TNoodle); el esqueleto de `search` = expresión |
| 435–468 (aplicar movimientos) | `randomPyraminxState`, `applyPyraminxMove`, `applyPyraminxTip` | Nuestro (API) |
| 470–510 (parseo) | `applyPyraminxSequence`, mapas de notación | **Nuestro** (no existe en el Java) |
| 512–557 (generación) | `generatePyraminxScramble`: estado aleatorio → filtro ≥6 → exacto-11 → inversa → tips | **Comportamiento WCA** (el flujo es la regulación; la estructura de código es nuestra) |
| 558–569 (helpers) | `pyraminxDistance`, `isValidPyraminxScramble` | Nuestro |

**Resumen ejecutivo**: de las 569 líneas, lo que realmente es *expresión de
TNoodle* se reduce a: (1) el truco de bits del rank/unrank de permutación,
(2) la nomenclatura que espeja el Java (`packEdgePerm`, `moveEdgePerm`,
`prunPerm`, `prunOrient`, `generateExactly`, `unsolvedTips`, `N_*`, `FACT`…),
(3) el esqueleto/orden de `search` y las secciones, y (4) algunos comentarios
que replican la explicación del Java. Todo lo demás es matemática, hechos del
puzzle, regulaciones WCA o código propio.

---

## 3. Especificación formal del algoritmo (reimplementable)

Esta sección es autosuficiente: quien la siga (más Jaap's Puzzle Page y las
regulaciones WCA) puede escribir un scrambler correcto **sin leer código de
TNoodle ni nuestro port**. Los nombres aquí son sugerencias — lo importante es
la semántica.

### 3.1 Modelo

- Tetraedro regular con 4 vértices. Giros de vértice nombrados **U, L, R, B**
  (notación WCA), cada uno con dos direcciones (±1).
- **6 aristas**, cada una definida por el par de vértices que une. Etiquetado
  (una convención válida entre varias):
  - `e0` = LR · `e1` = UL · `e2` = LB · `e3` = UR · `e4` = RB · `e5` = UB
- **4 corners** (piezas centrales de cara, 3 stickers): a **posición fija**,
  solo rotan. Uno por vértice.
- **4 tips** (piezas de vértice, 1 sticker): rotan independientes, no afectan
  al resto.
- **Alcance** (sin tips): 6!/2 × 2⁴ × 3⁴ = **933.120 estados**.
  - /2: solo permutaciones pares de aristas (restricción de paridad).
  - 2⁴ y no 2⁶: la orientación de la 6ª arista se deriva (XOR de las otras 5).
  - 3⁴: corners, sin restricción adicional.
- **God's number: 11 giros** (sin tips). Distribución de profundidades (Jaap):

  | d | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
  |---|---|---|---|---|---|---|---|---|---|---|----|
  | nº estados | 1 | 8 | 48 | 288 | 1.728 | 9.896 | 51.808 | 220.111 | 480.467 | 166.276 | 2.457 | 32 |

### 3.2 Coordenadas de estado

Cada estado se representa con 4 números:

1. **`perm` ∈ [0, 720)** — rango de la permutación de las 6 aristas
   (**factorádico / Lehmer code**). Unranking estándar: dado `r`, para
   `i = 0..4` sea `q = r div (5-i)!`, `r = r mod (5-i)!`; el cubie en la
   posición `i` es el `q`-ésimo elemento restante de la lista `[0..5]`; el
   último elemento restante va a la posición 5. Solo la **mitad par** es
   alcanzable (ver §3.3); las impares se rechazan en el muestreo.
   *(Nota: la representación con bit-packing `0x543210` es UNA forma concreta
   de implementarlo — expresión de TNoodle; se puede implementar con arrays.)*
2. **`eori ∈ [0, 32)`** — orientaciones de las aristas 0..4 como 5 bits
   (bit `i` = orientación de `e_i`); la arista 5 se deriva: `o5 = o0⊕o1⊕…⊕o4`.
3. **`cori ∈ [0, 81)`** — orientaciones de los 4 corners en base-3:
   `cor = Σ c_i · 3^i`, con `c_i ∈ {0, 1, 2}`.
4. **`tips ∈ [0, 81)`** — igual que corners, para los 4 tips.

Estado resuelto: `(0, 0, 0, 0)`.

### 3.3 Movimientos (hechos geométricos)

Un giro de vértice `V` en dirección `±1`:

- **Permuta cíclicamente las 3 aristas incidentes a V** y **voltea 2 de las 3**
  (las que entran en las posiciones "de salida" del ciclo; cuáles dos depende
  de la convención de orientación elegida — cualquier elección consistente que
  pase los tests de aceptación de §5 es válida).
- **Rota el corner de V**: `c_V ← c_V ± 1 (mod 3)`.
- **Rota el tip de V** igual que el corner.
- Orden de cada giro: **3** (`X³ = identidad`). El doble giro es la inversa del
  simple: `X' = X²`. Por eso en notación WCA el scramble usa `X` y `X'`.

Con el etiquetado de §3.1, una convención válida (la de la referencia de
validación) es:

| Giro | Ciclo de cubies (el que está en A va a B) | Voltea | Corner |
|---|---|---|---|
| U | `e1 → e5 → e3 → e1` | los que entran en `e1` y `e3` | `c_U += 1` |
| L | `e0 → e2 → e1 → e0` | los que entran en `e0` y `e1` | `c_L += 1` |
| R | `e0 → e3 → e4 → e0` | los que entran en `e3` y `e4` | `c_R += 1` |
| B | `e2 → e4 → e5 → e2` | los que entran en `e4` y `e5` | `c_B += 1` |

La dirección `−1` aplica el ciclo dos veces (y suma `2` al corner, mod 3).

**Por qué los ciclos son hechos, no expresión**: "un giro del vértice U mueve
las tres aristas que tocan U" es una propiedad física del tetraedro, idéntica
en cualquier implementación correcta. Lo mismo la paridad (cada giro es una
permutación par: 3-ciclo sobre las aristas) y el orden 3.

### 3.4 Tablas (precomputadas una vez)

1. **Tablas de transición** por coordenada: para cada coordenada y cada uno de
   los 8 giros, aplicar el giro y guardar la coordenada destino
   (`720×8`, `32×8`, `81×8`). Con ellas, aplicar un giro a un estado es 3
   lookups + tips (los tips se aplican con la misma tabla de corners).
2. **Tabla de poda de permutación** (`720`): BFS desde `perm = 0` con los 8
   giros; guarda la distancia exacta a cada permutación alcanzable. Las 360
   impares quedan marcadas como no alcanzables (y sirven para el rechazo del
   muestreo).
3. **Tabla de poda combinada de orientación** (`32×81 = 2592`): BFS desde
   `(0, 0)` con los 8 giros; distancia exacta por par `(eori, cori)`.
4. **Heurística** para la búsqueda: `h = max(podaPerm(perm), podaOri(eori, cori))`
   — cota inferior de la distancia real.

### 3.5 Búsqueda IDA*

DFS limitada en profundidad con poda:

- **Parámetros**: profundidad restante `L`; si `h > L` cortar.
- **Restricción de cara**: nunca dos giros consecutivos de la misma cara
  (equivalente a prohibir cancelaciones `X X'` y dobles `X X` — resultado
  exigido por el formato WCA).
- **Orden aleatorizado**: en cada nodo, probar los 8 giros empezando por un
  desplazamiento uniforme aleatorio (da variedad a las soluciones encontradas).
- **Búsqueda de distancia** (`L = 0, 1, 2, …`): la primera `L` con solución es
  la distancia exacta (para el filtro 4b3 y para `pyraminxDistance`).
- **Búsqueda de longitud exacta** (`L` fijo): para el scramble, `L = 11`.
- **Terminación garantizada**: se puede probar por BFS de capas *exactas* que
  la capa de longitud 11 cubre los 933.120 estados → todo estado tiene al
  menos una solución de exactamente 11 giros → la búsqueda exacta-11 **siempre
  encuentra** (no puede devolver "no encontrado").
- **Transposition set (mejora propia, recomendada)**: marcar visitados por
  `(estado, cara del último giro)` guardando la **máxima profundidad restante**
  vista; si se llega con `L ≤` la guardada, cortar. NO usar solo `estado`
  (la restricción de cara depende del camino: dos llegadas al mismo estado con
  distinta última cara tienen continuaciones distintas), y NO usar
  "visitado sí/no" simple (un DFS profundo puede visitar antes con poca
  profundidad restante y podar después una llegada con más — por eso se guarda
  el máximo). Sin este set, el peor caso explora ~8·6¹⁰ ≈ 484M nodos; con él,
  queda acotado por el espacio de estados (933.120 × 4 caras).

### 3.6 Generación del scramble (comportamiento oficial)

1. **Estado aleatorio uniforme**: permutación par uniforme (muestrear `[0,720)`
   y rechazar si la poda la marca no alcanzable), orientación de aristas
   uniforme `[0,32)`, corners uniforme `[0,81)`, tips uniforme `[0,81)`.
2. **Filtro WCA (Reg 4b3)**: si la distancia exacta del estado es `< 6`,
   regenerar.
3. **Solución de exactamente 11 giros** (§3.5).
4. **Scramble = inversa de la solución**: recorrer la solución al revés,
   invirtiendo cada giro (`X ↔ X'`).
5. **Tips**: añadir al final un giro de tip por cada tip con orientación ≠ 0,
   en la dirección que lo lleva a su orientación aleatoria (se añaden **tal
   cual**, no invertidos — son triviales e independientes).
6. **Invariantes verificables** (el "contrato" de salida):
   - `nº tokens = 11 + nº de tips sin resolver`.
   - Aplicar el scramble al resuelto deja el puzzle sin resolver.
   - Aplicar la inversa del scramble restaura el resuelto (tips incluidos).
   - El estado resultante tiene distancia real en `[6, 11]`.

---

## 4. Checklist de expresión de TNoodle a EVITAR en la reimplementación

Estos son los puntos concretos que hacen que el archivo actual sea derivado.
Una reimplementación limpia debe:

1. **No usar los nombres del Java**: `packEdgePerm`, `unpackEdgePerm`,
   `packEdgeOrient`, `packCornerOrient`, `moveEdgePerm`, `moveEdgeOrient`,
   `moveCornerOrient`, `prunPerm`, `prunOrient`, `search`, `generateExactly`,
   `solveIn`, `unsolvedTips`, `N_EDGE_PERM`, `N_EDGE_ORIENT`, `N_CORNER_ORIENT`,
   `N_ORIENT`, `N_TIPS`, `N_MOVES`, `MAX_LENGTH`, `FACT`, `moveToString`,
   `inverseMoveToString`, `tipToString`, `inverseTipToString`,
   `wcaMinScrambleDistance`, `cycleAndOrient`.
2. **No replicar el truco de bits del rank/unrank** (`val = 0x543210`,
   `val -= 0x111110 << v`): implementar el factorádico con arrays o con otra
   técnica propia.
3. **No espejar la estructura del archivo Java** (orden de secciones,
   comentarios que explican el layout de piezas con ASCII, docstrings que
   parafrasean los del Java).
4. **No copiar la firma de `cycleAndOrient`/`moveEdges`/`moveCorners`** — los
   hechos (ciclos, volteos) se expresan con la estructura propia; por ejemplo,
   una tabla declarativa `{ U: { cycle: [e1, e5, e3], flips: [e1, e3] }, … }`
   es una forma natural y distinta.
5. **No usar el port actual (`PyraminxSolver.ts`) como fuente** de consulta:
   es derivado. La fuente es este documento + Jaap + regulaciones WCA.
6. **Sí se puede copiar de fuentes públicas**: la tabla de Jaap (§3.1), las
   regulaciones WCA, y los hechos geométricos (se pueden verificar con un
   tetraedro físico).

---

## 5. Criterios de aceptación (tests que ya existen en el repo)

Cualquier reimplementación debe pasar la suite actual sin cambios de criterio:

| Test | Qué valida |
|---|---|
| BFS completo vs Jaap | Distribución de profundidades exacta (933.120 estados, God 11, 32 antípodas) — **prueba objetiva e independiente de la implementación** |
| Paridad | Exactamente 360 de 720 permutaciones alcanzables |
| Identidades | `m · m⁻¹ = identidad` para los 8 giros; orden 3; doble giro = inversa |
| Notación | Parseo/round-trip de WCA; rechaza tokens inválidos (`X2`, tokens desconocidos) |
| 1.000 scrambles | Exactamente 11 + tips; aplica → no resuelto; inversa restaura; distancia real ∈ [6, 11] |
| Determinismo | Misma RNG inyectada → mismo scramble |
| Aleatoriedad | Primer movimiento uniforme por cara; cero pares de cara consecutivos; nº de tips ~ Binomial(4, ⅔) |

---

## 6. Procedimiento para ejecutar la reimplementación

0. **Esta especificación ya está validada**: una implementación independiente
   construida solo con la tabla de §3.3 (factorádico con arrays, sin trucos de
   bits, sin importar el código del repo) reproduce **exactamente** la tabla de
   Jaap: `1, 8, 48, 288, 1728, 9896, 51808, 220111, 480467, 166276, 2457, 32`,
   total 933.120 y God's number 11. Quien siga §3 + §5 obtendrá un modelo
   correcto por construcción.
1. Implementar de cero: estado (§3.1–3.2) → movimientos (§3.3) → tablas (§3.4)
   → búsqueda (§3.5) → generación (§3.6), **sin abrir** tnoodle-lib ni el
   `PyraminxSolver.ts` actual.
2. Correr la suite de aceptación (§5) — ya existe y es inmutable.
3. Sustituir el módulo conservando la **API pública** (las exportaciones que
   `solver-engine/src/index.ts` re-exporta: `generatePyraminxScramble`,
   `applyPyraminxSequence`, `isValidPyraminxScramble`, `pyraminxDistance`,
   `pyraminxDistanceBound`, constantes, tipos…).
4. Eliminar la nota GPL del cabecero y actualizar la doc D2 (§2.4/2.7).
5. Gates completos: typecheck monorepo, suites, preview.
6. Si además se quiere el máximo blindaje, documentar la reimplementación como
   clean-room (quién la escribió, sin acceso al código GPL).

**Alternativa aún más limpia** (para el RFC de scrambles): sustituir el módulo
por **cubing.js (MIT)**, que ya implementa el mismo scramble — cero riesgo de
licencia, cero esfuerzo de mantenimiento del port. La desventaja es depender de
una librería externa. Esta especificación sigue siendo útil como documentación
del modelo y como criterio de validación independiente.

---

## 7. Estado y próximos pasos

- **Ejecutado (2026-08)**: `PyraminxSolver.ts` se reimplementó desde cero con
  esta especificación — nomenclatura propia, factorádico con arrays, tabla de
  movimientos geométrica declarativa, transposition set; sin el truco de bits
  ni el esqueleto del Java. La suite de aceptación (§5) pasa sin cambios y la
  API pública se mantiene idéntica.
- El proyecto queda **sin código GPL derivado**: min2phase.js se usa bajo su
  opción MIT; el resto del árbol de dependencias no tiene GPL (auditado); la
  documentación ya no declara ningún port.
- Referencias públicas: `jaapsch.net/puzzles/pyraminx.htm`, regulaciones WCA
  (Reg 4b3 y anexo de scrambles), `Fase-D2-Pyraminx.md` (estudio del modelo).
