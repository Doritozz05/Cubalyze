# Cubeforge — Análisis CFOP: Estado Actual y Roadmap

> Documento generado el 19 de julio de 2026.
> Basado en investigación de r/Cubers, Cubeast, csTimer, WCA, J Perm, CubeSkills, y tendencias 2024-2026.

---

## 1. ¿Qué hay AHORA?

### 1.1 UI de análisis post-solve (`SolveAnalysisPanel.tsx`)

El panel **YA existe en la UI** (sidebar derecho, pestaña "Analysis"). Muestra tras cada solve con Smart Cube:

| Sección | Métricas mostradas |
|---------|-------------------|
| **Last Solve Summary** | Tiempo total, número de moves, método (CFOP/Roux/ZZ/Petrus) |
| **TPS Overview** | TPS global, TPS peak, número de pausas, tiempo total en pausa |
| **Phase Breakdown** (accordion) | Cross / F2L / OLL / PLL — moves, tiempo, TPS por fase |
| **Advanced Metrics** (accordion) | Fluidity (CV, σ), bursts, pause ratio, max pause |
| **Rotations & Efficiency** (accordion) | Rotaciones (total + x/y/z), tiempo en rotaciones, efficiency ratio, drift, redundancies, cancellations |
| **CFOP Details** (accordion) | Cross efficiency, Cross→F2L transition, OLL recog + TPS, PLL recog + TPS, F2L lookahead score, F2L pairs count |

**Sin Smart Cube**: muestra "No analysis available — Connect a Smart Cube".

### 1.2 Panel de estadísticas (`StatsPanel.tsx` + `SessionStats.tsx`)

| Componente | Qué muestra |
|-----------|-------------|
| `SessionStats` | Ao5, Ao12, Best, Mean en barra compacta bajo el timer |
| `StatsPanel` | Best single highlight (con PB badge), gráfico Ao5/Ao12/Ao100 (`TrendChart`), grid de tiles (Best, Worst, Mean, Ao5, Ao12, Ao100, Solves, Session time) |
| `TimesList` | Lista vertical de solves con +2/DNF/delete, marca el mejor de la sesión |

### 1.3 Configuración (`AnalysisSection.tsx`)

Selector de método (CFOP / Roux / ZZ / Petrus) en Settings → Analysis.

### 1.4 Infraestructura en `math-core`

| Archivo | Función |
|---------|---------|
| `cfopMasks.ts` | Máscaras de fase para Cross, F2L, OLL, PLL + `COLOR_NEUTRAL_CFOP_MASKS` (6 caras de cross) |
| `StateMatcher.ts` | Match O(1) con bigint para verificar si un `CubeState` cumple una `PhaseMask` |
| `IMethodDefinition.ts` | Interfaces `PhaseMask`, `MethodDefinition`, `EdgeRule`, `CornerRule` |
| `CubeMoveCompacter.ts` | Compacta `D+D→D2` para análisis (GEN2 no codifica 180°) |
| `CubeState.ts` | Estado del cubo con applySequence, isSolved, clones |

### 1.5 Infraestructura en `analysis-engine`

| Componente | Función |
|-----------|---------|
| `TimelineBuilder` | Reconstruye el timeline de la solve desde moves + estado inicial |
| `PhaseSplitter` | Detecta fases (Cross→F2L→OLL→PLL) con soporte color-neutral (6 caras) |
| `MetricsAggregator` | Calcula TPS, pausas, fluidez, rotaciones, redundancia, CFOP details |
| `CFOPMetricsCalculator` | Cross efficiency, F2L lookahead, OLL/PLL recog+exec |

### 1.6 Debug logging (`useSolveSession.ts`)

`?cfop_debug=1` en la URL activa logs detallados en consola: scramble, moves raw, moves per face, per-move detail, duplicates, pre/post move-0 state, final state, fases, metrics, warnings.

---

## 2. Lo que FUNCIONA BIEN ✅

| Feature | Estado |
|---------|--------|
| Detección de fases color-neutral (6 caras) | ✅ Completo |
| Timeline + reconstrucción de estado | ✅ Completo |
| TPS global, por fase, peak | ✅ Completo |
| Pausas, fluidez (CV), bursts | ✅ Completo |
| Rotaciones globales (x/y/z) + rot time | ✅ Completo |
| Efficiency, drift, redundancies, cancellations | ✅ Completo |
| Cross efficiency + cross→F2L transition | ✅ Completo |
| OLL/PLL recognition + execution time + TPS | ✅ Completo |
| F2L lookahead score + pair count | ✅ Completo |
| F2L per-pair detail (state-based detection) | ✅ Completo |
| Rotaciones por fase (byPhase) | ✅ Completo |
| Compactación D+D→D2 (GEN2) | ✅ Completo |
| Panel UI de análisis post-solve | ✅ Completo |
| Sesión stats (Ao5, Ao12, Best, Mean) | ✅ Completo |
| Trend chart (Ao5/Ao12/Ao100) | ✅ Completo |
| Times list con +2/DNF | ✅ Completo |
| Soporte multi-método (CFOP/Roux/ZZ/Petrus) | ✅ Parcial — solo CFOP tiene métricas detalladas |

---

## 3. Lo que FALTA ❌

### 🔴 P0 — OLL/PLL Algorithm Identification (`algorithmId`)

**Estado actual**: `oll.algorithmId` y `pll.algorithmId` siempre son `undefined`.

**Por qué es crítico**: Es la feature #1 que diferencia un timer básico de una app de análisis real. Cubeast lo tiene. Sin esto, el usuario ve "OLL: 1.4s, 5.3 TPS" pero no sabe QUÉ OLL era. No puede trackear qué casos le cuestan más.

**Lo que hay que construir** (fase "post-algorithm"):

1. **Definir máscaras para los 57 casos OLL y 21 casos PLL** — construir `PhaseMask` por caso usando `StateMatcher`.
2. **Capturar el `CubeState` al inicio de OLL y PLL** — ya existe en `TimelineBuilder` (snapshot del estado al entrar en cada fase).
3. **Matchear el estado contra las 57/21 máscaras** — `StateMatcher.matchesMask(state, ollCaseMask)`.
4. **Exponer `algorithmId` en `CFOPMetrics`** (tipo `SolveMetrics`).

**Complejidad**: Media. Las máscaras ya existen para las fases genéricas (Cross/F2L/OLL/PLL). Crear máscaras por caso específico es el mismo patrón pero ×78.

### 🟠 P1 — F2L per-pair detail ✅

**Estado**: ✅ **COMPLETADO** (19 julio 2026)

**Implementación**:
- Detección por estado del cubo: escanea cada entry en F2L, cuenta slots completados usando `FACE_LAYERS[crossFace]`
- Detecta caras de cross con `COLOR_NEUTRAL_CFOP_MASKS` (6 caras)
- Por cada par: tiempo, moves, TPS, pausa antes del par
- UI marca el par más lento con badge "slowest" y fondo rojo
- Fallback a heurística (segmentos iguales) si no detecta cross face

**Archivos modificados**:
- `packages/math-core/src/methods/cfop/cfopMasks.ts` — export `FACE_LAYERS`, `FaceLayerData`
- `packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts` — detección por estado
- `apps/web/src/components/Stats/SolveAnalysisPanel.tsx` — UI F2L pair breakdown

### 🟠 P1 — Weakest Phase Identification (AI Coaching)

**Estado actual**: el usuario ve números crudos y deduce qué fase va mal.

**Lo que debería haber** (tendencia 2024-2026):
- "Tu punto más débil es **Cross-to-F2L transition**: 1.7s vs benchmark 0.5s"
- "**OLL recognition** es 2× tu execution — practica reconocimiento"
- "**PLL Gc** te cuesta 40% más que tu PLL promedio"
- Comparación contra benchmarks por nivel (sub-30, sub-20, sub-15)

**Complejidad**: Baja (pura lógica sobre datos existentes). ~50 líneas de código.

### 🟡 P2 — Cross Solver

**Estado actual**: no hay ayuda para planificar la cruz.

**Lo que debería haber** (como csTimer):
- Solución óptima de cruz (≤8 moves) desde el scramble
- Mostrar en el 3D viewer
- Tracking de "movimientos de más" vs solución óptima
- `min2phase.js` ya está instalado como dependencia

**Complejidad**: Media.

### 🟡 P2 — Rotaciones por fase ✅

**Estado**: ✅ **COMPLETADO** (19 julio 2026)

**Implementación**:
- Backend: `RotationCounter.compute()` ya calculaba `byPhase` (asigna cada rotación a su fase vía `entry.phaseName`)
- UI: se agregó "Rotations by Phase" breakdown en el acordeón Rotations & Efficiency
- Muestra conteo por fase con highlight amber si > 3 rotaciones

**Archivos modificados**:
- `apps/web/src/components/Stats/SolveAnalysisPanel.tsx` — UI rotations by phase breakdown

### 🟡 P2 — Histórico persistente

**Estado actual**: stats de sesión en memoria, se pierden al refrescar.

**Lo que debería haber**:
- Persistencia en IndexedDB (ya existe `packages/database`)
- Progresión histórica: ¿cross está mejorando?
- Export a CSV/JSON

**Complejidad**: Media (la DB ya existe).

### 🟢 P3 — Pause Heatmap

Marcar visualmente en la reconstrucción dónde hubo pausas.

### 🟢 P3 — F2L pair type classification

Clasificar cada par F2L por tipo (corner in slot, edge in slot, etc.) analizando el estado del cubo al inicio del par.

---

## 4. Roadmap recomendado

| # | Feature | Impacto | Esfuerzo | Estado |
|---|---------|---------|----------|--------|
| 1 | **OLL/PLL Algorithm ID** | 🔴 Crítico | Medio | ❌ Pendiente |
| 2 | **Weakest Phase AI** | 🟠 Alto | Bajo | ❌ Pendiente (depende de #1) |
| 3 | **Rotaciones por fase** | 🟡 Medio | Bajo | ✅ Completo |
| 4 | **F2L per-pair detail** | 🟠 Alto | Alto | ✅ Completo |
| 5 | **Cross Solver** | 🟡 Medio | Medio | ❌ Pendiente |
| 6 | **Histórico persistente** | 🟡 Medio | Medio | ❌ Pendiente |
| 7 | **Pause Heatmap** | 🟢 Bajo | Bajo | ❌ Pendiente |

### 🎯 Próximo paso inmediato: OLL/PLL Algorithm ID

Es lo que más valor aporta con esfuerzo controlado. La infraestructura ya existe:

- `StateMatcher.matchesMask(state, mask)` — O(1) con bigint
- `CubeState` al inicio de OLL/PLL — accesible desde `TimelineBuilder`
- Patrón de `PhaseMask` — ya definido en `IMethodDefinition.ts`

Falta:
1. Crear máscaras para los 57 casos OLL (orientación de last layer pieces)
2. Crear máscaras para los 21 casos PLL (permutación de last layer pieces)
3. En `PhaseSplitter` o `MetricsAggregator`, al detectar entrada en OLL/PLL, matchear el estado contra las máscaras y guardar el `algorithmId`
4. Exponer en `SolveMetrics.cfop.oll.algorithmId` y `.pll.algorithmId`

---

## 5. Referencias

- [CubeSkills Splits Tool](https://www.cubeskills.com/blog/cfop-solve-splits-tool) — Feliks Zemdegs
- [Cubeast](https://cubeast.com) — Gold standard en smart cube analytics
- [csTimer](https://cstimer.net) — Timer comunitario con cross solver
- [r/Cubers](https://reddit.com/r/Cubers) — Comunidad principal
- [Speedsolving Wiki — CFOP](https://www.speedsolving.com/wiki/index.php/CFOP_method)
- [Badmephisto F2L](http://badmephisto.com/f2l.html)
- [J Perm](https://jperm.net) — Guías y algoritmos
