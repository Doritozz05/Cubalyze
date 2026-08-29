# Plan — Análisis de solves a nivel profesional (UI + persistencia)

> Estado: **aprobado en diseño** (2026-08-29). Rama de trabajo: `feat/analysis-case-table-shared`.
> Contexto: la detección de casos CFOP (F2L 41 + OLL + PLL) ya es **compartida**
> entre la ruta de reconstrucción y la ruta smart/virtual (commit 8e732c4a).
> Este plan lleva esa tabla de casos a la UI de solves reales, divide el F2L
> en sub-segmentos de la línea temporal y abre las puertas a la *case
> intelligence* de sesión y la comparación con el óptimo por fase.

---

## 1. Decisiones tomadas

1. **Superficie (N1): botón de modo detalle en Insights.** En vez de dos
   superficies, un toggle en `InsightsDashboard` que conmuta el layout:
   - **Modo normal**: el de hoy — `SolveListPanel` + `SolveAnalysisPanel`
     (con su `ReplaySection`) lado a lado.
   - **Modo detalle**: layout estilo `ReconstructionDetailView` — **replay 3D
     anclado a la izquierda en grande (~2/3)** y columna derecha scrolleable
     con el resto (scramble, tiles de stats, la tabla de casos compartida),
     **ocultando el `SolveListPanel`**. El botón vuelve al modo normal.
   Los componentes de casos son compartidos, así que el modo detalle es
   básicamente el layout de reconstrucciones con el solve real como fuente
   (mismo patrón `ReconstructionDetailView`).
2. **Prioridad post-N1: timeline con F2L dividido** (pares como sub-barras).
3. **Cruz en smart: se mantiene estricta** (`relaxedCross` OFF), documentada
   como divergencia conocida respecto a reconstrucción (que usa relajada con
   pista escrita). Activarla en smart solo tras un estudio de validación con
   solves reales.

## 2. Qué mostramos HOY (inventario)

- **Por solve (Insights → SolveAnalysisPanel):** anillos TPS/pausas/eficiencia;
  desglose de fases; detalles CFOP (tipo de cruz, eficiencia de cruz,
  transición, recognition/ejecución/TPS de OLL/PLL, lookahead, lista de pares
  F2L en texto plano); Roux (FB/SB/CMLL/LSE); rotaciones + eficiencia; replay 3D.
- **Por sesión (widgets):** timeline de fases (FloatingPhaseTimeline), balance
  de fases, serie TPS, distribución de tiempos, heatmap de actividad,
  PB/medias, times-log.
- **Reconstrucciones (OurDetectionPanel):** la tabla de casos AAA — orientación,
  cruz con badge xcross, pares con mini-cubo 3D del caso + caseName/caseNumber,
  OLL/PLL con diagrama 2D rotado al AUF, movimientos con copiar, click-to-seek
  al replay, footer con rotaciones/TPS/media F2L.
- **Persistencia:** `solve.analysis` guarda `SolveMetrics` como JSON → la tabla
  de casos se persistirá sola para solves nuevos; los viejos necesitan
  re-análisis (`reanalyzeSolve` ya existe).

## 3. Datos que ya tenemos y no explotamos

| Dato | Fuente | Qué podemos sacar |
|---|---|---|
| Timestamps por move | `moves[].hostTimestamp` | heatmap inter-move, micro-pausas, "dónde se frenó" |
| Estado en cada entrada | `timeline.entries[].state` | óptimo por fase, "desperdicio" |
| Orientación por move | `orientationTimeline` | regrips por fase, rotaciones por par, hábitos AUF |
| Movimientos crudos | `moves` | distribución de caras, % wide/slice, dobles |
| Reporte de detección | `detectionReport` | cross color %, tasa xcross, skip rate |
| Casos (nuevo) | `cfop.f2lPairs[].detectedCase`, `ollCase`, `pllCase` | case intelligence de sesión + enlace a training |
| Eficiencia global | `efficiency` | óptimo por fase, replay óptimo lado a lado |

## 4. F2L dividido en el timeline (prioridad 1 tras N1)

`segmentF2LPairs` ya devuelve `startIndex/endIndex/completionIndex/timeMs/
pauseBeforeMs` por par. Se añade una función pura `derivePairSegments(analysis)`
en `derived/timeline.ts` (testeada) y el `FloatingPhaseTimeline` + desglose de
fases pintan **F2L como 4 sub-barras** (color por par, slot + caso en tooltip),
con click-to-seek al inicio del par (mismo patrón que OurDetectionPanel).

## 5. Refactors previos (no repetir)

1. **Componentes compartidos de casos**: extraer `CaseMiniCube`,
   `LastLayerCaseCell`, `MovesSeq`, `CfopMiniBar` y helpers de colores de
   `OurDetectionPanel` → `components/Cases/*`. Reconstrucciones e Insights
   consumen los mismos; así "ambas superficies" salen baratas y el toggle no
   hace falta.
2. **Derivación pura de pares** en `derived/` (testeada), no recalculada en
   cada widget.
3. **Backfill**: acción "re-analizar sesión" con `reanalyzeSolve`.
4. **Bump de `analysis_engine_version`** para distinguir solves con/sin tabla.
5. i18n (es/en) reutilizando el namespace de reconstrucciones.

## 6. Mejoras profesionales (con la tabla o antes)

- **Cruz estricta en smart**: documentada (decisión 3). Validar `relaxedCross`
  solo con estudio sobre solves reales.
- **Skips/xcross ya existen** en smart; el salto es **agregar la tasa** (%
  xcross, % skips, cross color) en Insights de sesión.
- **Óptimo por fase**: `EfficiencyCalculator` usa Min2Phase global; añadir
  comparación por fase (cross óptimo, par óptimo) — diferenciador real.

## 7. Visión AAA por niveles

- **N1 — Tabla de casos en el solve real** (objetivo inmediato): integrar la
  tabla en `SolveAnalysisPanel` para smart/virtual **y** un botón de modo
  detalle en Insights que conmuta al layout estilo reconstrucción (replay
  izquierda en grande, sin lista de solves, resto igual que en
  reconstrucciones), sobre componentes compartidos.
- **N2 — Timeline rico**: fases + pares F2L como sub-barras, pausas con causa,
  marcadores de rotación/regrip, scrub sobre el replay 3D, moves coloreados
  por fase.
- **N3 — Case Intelligence de sesión**: distribuciones OLL/PLL/F2L (frecuencia,
  media de tiempo/movimientos por caso), "tu caso más lento" con
  "Practice this case" → Training.
- **N4 — Comparación con el óptimo**: replay lado a lado, desperdicio por fase,
  sugerencias (rotaciones evitables, pares ineficientes).

## 8. Orden de ejecución

1. Refactor: componentes compartidos de casos (sin cambio visual).
2. `derivePairSegments` + tests (F2L dividido).
3. N1: tabla en `SolveAnalysisPanel` + botón de modo detalle en Insights
   (layout estilo ReconstructionDetailView, sin `SolveListPanel`).
4. N2: timeline con pares + scrub (parcial en el paso 2).
5. Backfill + bump de versión.
6. N3 y N4 como fases siguientes.
