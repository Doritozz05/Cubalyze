# Plan — Análisis de solves profesional: exprimir smart + virtual (datos, gráficas, tablas, dibujos)

> Estado: **en ejecución** (2026-08-29). Rama: `feat/analysis-case-table-shared`.
> Este documento es la fuente de la parte de análisis de solves (smart +
> virtual). Sin conexión con SkillTree ni Training.
> Nota: la capa de **estadísticas de sesión** actual (`packages/statistics`)
> solo calcula **tiempos** (Ao5/12/Ao100, media, desviación). Todo el dato
> técnico vive por solve; falta agregarlo y visualizarlo.

---

## 0. Lo que ya está DONE (para no repetir)

- **Detección de casos compartida**: F2L (41), OLL y PLL idéntica en texto y
  smart/virtual ({f2lPairs[].detectedCase, ollCase, pllCase}). Test de paridad.
- **`derivePairSegments`** puro (pares como sub-segmentos del timeline) + tests.
- **Componentes de casos compartidos** `components/Cases/*` (mini-cubo 3D,
  diagrama 2D LL, MovesSeq, CfopMiniBar, helpers).
- **Timeline rediseñado (Insights)**: barra de fases continua con **F2L
  dividido en 4 slices** (verde claro→oscuro), pause-lane, hover con info del
  par y click-to-seek. Widget del timeline alineado.
- **`DetectionSection` standalone** en Insights: la tabla de casos AAA con
  mini-cubos, OLL/PLL rotadas al AUF, notación real, 5 columnas, click-to-seek.

## 1. Decisiones tomadas

1. Una superficie, sin duplicar vistas (componentes compartidos). El **botón
   "modo detalle"** en Insights (replay anclado a la izquierda en grande,
   ocultando la lista de solves) sigue pendiente.
2. **Cruz en smart: estricta** (`relaxedCross` OFF), divergencia conocida vs
   reconstrucción.
3. **Nada de SkillTree/Training**: el análisis se queda en análisis.

## 2. Catálogo de entregables por tipo

### 2.1 Datos nuevos (derivaciones headless, testeables)

- **`deriveSessionTechnicalStats(solves)`** en `packages/statistics`
  (ampliar su contrato a `SolveMetrics`):
  - Por fase: media/P25/P50/P75 de **tiempo, movs y TPS**.
  - **% de tiempo por fase** (mediana) y su **tendencia**.
  - Economía: media de movs totales, ratio de eficiencia medio, tasa de
    redundancia (cancellations/overturns) acumulada por sesión.
  - Rotaciones: media por solve y por **par F2L**, % solves sin rotación,
    **rotaciones redundantes** acumuladas.
  - Lookahead: media de pausas, pause-ratio, media de `cross→F2L`, serie del
    lookahead score.
  - Ritmo: media de `tps.peakInstantaneous`, **std del intervalo entre
    movimientos** (consistencia del pacing).
- **`deriveMoveMetrics(moves)`**: por solve — frecuencia de **cada cara** (%
    R/U/F…), % de dobles (→2), % de slices/wide, secuencia de caras
    consecutivas (hábitos: U-R-U-R vs U-U).
- **`deriveCostRatios(phases)`**: coste de **reconocimiento vs ejecución**
  por LL (ratio) — cuánto del tiempo de OLL/PLL es pensar.

### 2.2 Gráficas (sesión y por solve)

- **Radar de ejes técnicos**: cruz · F2L · last-layer · lookahead · economía ·
  rotaciones, en una sola vista de puntos fuertes/débiles.
- **Área apilada**: % del tiempo por fase, solve a solve (tendencia).
- **Histogramas por fase** (tiempo y movs) con marcas de media y PB.
- **Tendencias de fase**: media móvil de cada fase vs tiempo total.
- **Heatmap de pausas**: causa × fase por solve (dónde se para la sesión).
- **Mini-mapa TPS** bajo el replay (sparkline por movimiento, con scrub).
- **Sparkline en cada fila de la tabla de casos**: el ritmo intra-par (su
  propio mini-heatmap de gaps entre movs).
- **Serie de cruces**: `crossType` (plain/xcross/xxcross) en el tiempo.

### 2.3 Tablas nuevas

- **Tabla de case intelligence de sesión** (F2L + OLL + PLL): por caso →
  frecuencia, tiempo medio, movs medios, TPS, **desviación**; ranking con el
  **caso más lento / menos eficiente** resaltado. Sin enlace a Training.
- **Tabla de movimientos económicos**: repaso de los peores en eficiencia por
  fase con el óptimo al lado (solo cruz/pares que tengan óptimo calculable).

### 2.4 Dibujos / visualizaciones creativas

- **Fingerprint del solve**: una fila de celdas, una por movimiento, coloreada
  por **cara** (R/F/U/D/L/B) y con intensidad según **velocidad** → el "código
  de barras" del solve. Comparar fingerprints de dos solves lado a lado.
- **Face radar / barras de uso de caras**: cuánto (y con qué TPS) usas cada
  cara — detecta hábitos (ej. sobreuso de F, D casi nunca).
- **Mapa del solve con rotaciones**: sobre la barra temporal, marcadores de
  rotación/regrip y un **snapshot 3D del estado** en hover (mini-cubo en el
  punto que apuntas) con click-to-seek.
- **Cruz real vs óptima (N4)**: dos secuencias dibujadas lado a lado +
  desperdicio por fase (rotaciones evitables, movs de más).
- **Eficiencia visual en el replay**: resaltar movs redundantes/overturns en
  el replay (color distinto) para "ver" el desperdicio.

## 3. Qué falta de lo ya aprobado (dependencias)

- **Botón modo detalle** en Insights (replay grande a la izquierda).
- **Backfill** de solves antiguos + bump de `analysis_engine_version`.
- **N4 óptimo por fase** (requiere Min2Phase por fase).

## 4. Orden de ejecución recomendado

1. **Capa `deriveSessionTechnicalStats`** (+ tests) en `packages/statistics`
   — base de las gráficas.
2. **`deriveMoveMetrics` (fingerprint/faces/ritmo)** + **`deriveCostRatios`**.
3. En Insights: **mini-mapa TPS** + **case intelligence** (tabla sesión).
4. **Botón modo detalle**.
5. **Vista de sesión** (radar + área apilada + histogramas + heatmap de pausas
   + tendencias + fingerprint + face bars).
6. **Backfill + bump de versión.**
7. **N4 óptimo por fase.**

## 5. Riesgos / notas

- **Smart cube no registra rotaciones físicas**: `rotation.*` para smart es lo
  inferible de los movimientos; en virtual hay orientación real. Documentar
  qué fuente alimenta cada métrica de rotación.
- Los agregados deben ser **puros y headless** (`packages/statistics`,
  `analysis-engine`), no calcularse en la UI.
- `packages/statistics` solo conoce tiempos → ampliar su entrada a
  `SolveMetrics` sin acoplarlo a la UI.
- La **case intelligence** y el **fingerprint** deben funcionar también con
  solves antiguos (sin re-análisis) cuando el dato lo permita, y degradar
  suavemente si falta.