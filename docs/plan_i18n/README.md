# Plan de internacionalización (i18n) — migración completa del UI

Plan por **tandas (batches)** que nombra **cada tab, zona y superficie** de la
app que será traducida, incluidas las transversales (toasts, notificaciones,
TTS, datos). No lista strings individuales: cada tanda se define por las zonas
de UI que cubre, su namespace, dificultad y consideraciones especiales.

**Estado**: infraestructura ✅ · Tanda 1 (estructura de navegación) ✅ · Tanda
2 (shell completo) ✅ · Tanda 3 (Timer + stats de sesión) ✅ · Tanda 4
(feedback global: toasts + notificaciones + TTS) ✅ · Tanda 5 (Insights) ✅ ·
Tanda 6 (Algorithms) ✅ · Tanda 7A (Training dashboard + práctica básica) ✅ · Tanda 7B (Training drills y fases) ✅ · Tanda 7C (SRS y calendario) ✅ — todo en `feat/spanish-translation` · resto pendiente.

---

## Principios transversales (aplican a TODAS las tandas)

1. **Claves tipadas**: `ParseKeys<'ns'>` en datos, `t()` en render. Nunca
   `t()` a nivel de módulo (no re-renderiza al cambiar idioma).
2. **Namespace por zona**: `common` (acciones compartidas), `nav`,
   `settings`, `timer`, `stats`, `insights`, `algorithms`, `training`,
   `skillTree`, `profile`, `reconstructions`, `widgets`, `onboarding`,
   `notifications`, `audio`, `data`, `ui`.
3. **Paridad en/es**: el test de paridad (`index.test.ts`) bloquea si una
   clave falta en `es.json`.
4. **Datos de usuario NO se traducen**: nombres de sesión, notas, solves,
   perfiles, algoritmos propios (seedDemoData, notes del widget, etc.).
5. **Interpolaciones**: `` `Delete "${name}"?` `` → `t('deleteSession', { name })`.
   **Plurales**: `{{count}} solves` / `_one`.
6. **Fechas y números**: `Intl.DateTimeFormat`/`NumberFormat` con el locale
   activo (date-fns ya instalado para casos complejos). Hoy hay
   `toLocaleDateString("en-US")` hardcodeado en ProfileHero.
7. **TTS y notificaciones** usan el idioma activo en el momento (ver tanda 3).
8. **packages/ui** comparte el singleton de i18n de web (se bundlea dentro).

---

## Mapa de superficies de la app (inventario completo)

```
apps/web/src
├── components/
│   ├── Layout/        Header · LeftSidebar(footer) · MobileTabBar · MobileMoreSheet
│   │                  AppShell · MainStage · MobileSessionSheet
│   ├── Stage/         TimerStage · MainStage
│   ├── Timer/         TimerContainer · TimerDisplay · ManualTimeInput · PbCelebrationBanner
│   ├── Stats/         SessionStats · TimesList · ManualSolveSheet · SolveProgressionChart · TrendChart
│   ├── Scramble/      ScrambleDisplay
│   ├── Cube3D/        Cube3DPanel · MiniCube3DPanel
│   ├── Insights/      InsightsDashboard · OverviewPanel · SolveListPanel
│   │                  SolveAnalysisPanel (1512 líneas) · ReplaySection
│   │   atoms/         EmptyState · SectionHeader · Coherence/Skipped/Warnings/PenaltyBadge · MetricRing · ActivityHeatmap
│   ├── Settings/      Dialog · Sidebar · components (SettingToggle, ColorPicker) · 13 secciones
│   ├── Hardware/      CubeConnector (diálogo de emparejamiento + toasts)
│   ├── Identity/      ProfileHero · CountryFlag · badges/achievements
│   ├── Onboarding/    OnboardingTour · TourTooltip · tourSteps.ts (6 pasos)
│   ├── shared/ · Solves/ (vacíos hoy)
├── views/
│   ├── Timer (Stage)  — zona Timer
│   ├── Analytics/ · Session/  (vacíos hoy)
│   ├── Algorithms/    AlgorithmDashboard · MethodTree · CaseGrid · CaseDetailPanel
│   │                  Case3DPanel · AlgorithmEditorDialog · MobileMethodNavigator · SortableAlgorithmItem
│   ├── Training/      TrainingDashboard + DashboardSections · PlainPracticeView · AlgorithmDrillView
│   │                  AlgorithmRecognizeView · FullSolveView · CrossTrainerView · EODetectView
│   │                  EOEfficiencyView · LSESubPhaseView · PhaseStatsView · BlindPracticeView
│   │                  SRSReviewView · SRSInsightsView · TrainingCalendar
│   │   components/    ReviewQueueSection · ReviewSteps · VerdictOverlay · StatChip · TouchAside
│   │                  TrainingBreadcrumb · CrossTrainerPanels · FullSolvePanels
│   ├── SkillTree/     UltraSkillTreeView · SkillGraphCanvas · SkillNodeModal · skillTreeData.ts (149 skills)
│   ├── Profile/       ProfileView + ProfileHero + logros/badges
│   ├── Reconstructions/ ReconstructionsView · ReconstructionDetailView · OurDetectionPanel
├── widgets/
│   ├── explorer/      WidgetExplorer · WidgetCard · WidgetPreviews · WidgetHost
│   ├── dock/          WidgetDock
│   ├── implementations/ (13 widgets) — cada uno: título + descripción + Preview + FloatingPanel
│       algorithm-db · cube-button · layout-organizer · metronome · notes · pb-progression
│       phase-balance · scramble-2d · solve-timeline · time-distribution · times-log
├── hooks/             toasts (session actions, solve completion, reminders) · useOnboardingTour
├── utils/             audioSystem.ts (TTS) · countries.ts (253) · export/import solves · subBadges
├── i18n/              locales en/es · index.ts · resources.d.ts
packages/ui/src/components/  breadcrumb · carousel · dialog · pagination · sheet · sidebar · calendar · chart
```

---

## Las tandas

### ✅ Tanda 1 — Estructura de navegación *(hecha, en `feat/spanish-translation`)*
- **Zonas**: rail de navegación (grupos + items) · sidebar de Settings (labels + descripciones + header "Preferences") · título del sheet móvil de navegación.
- **Namespaces**: `nav`, `settings.sections`.
- Archivos: `sidebar.constants.ts`, `LeftSidebar.tsx`, `settings.constants.ts`, `SettingsSidebar.tsx`, `SettingsDialog.tsx`, `en/es.json`.

### ✅ Tanda 2 — Shell completo (la app que se ve en todas las pantallas) *(hecha)*
- **Zonas**:
  - `Header`: selector de sesión (nuevo/renombrar/eliminar diálogo "Delete “{name}”?"), selector de puzzle, chip de batería + tooltip, botón de widgets, chip de perfil, botón "add manual solve".
  - `MobileTabBar` (tabs inferiores: Timer/Stats/Training/Algorithms/More — hoy hardcodeados).
  - `MobileMoreSheet` (sheet "More": Settings, Smart Cube, Theme, perfil…).
  - `LeftSidebar` footer (Settings, Light/Dark mode, perfil) + `CubeConnector` rail.
  - `AppShell` (estados vacíos, avisos, toasts de shell).
  - `MainStage` (títulos de sección / placeholders de rutas).
- **Namespace**: `nav`, `common`, `shell` (nuevo).
- **Dificultad**: baja-media (hay interpolaciones y un AlertDialog).
- **Nota**: aquí se nota el primer cambio de idioma "de golpe" en toda la app.
- Archivos: `Header.tsx`, `MobileTabBar.tsx`, `MobileMoreSheet.tsx`,
  `MobileSessionSheet.tsx`, `LeftSidebar.tsx` (footer), `CubeConnector.tsx`
  (rail + diálogo), `AppShell.tsx`, `MainLayout.tsx`, `en/es.json`
  (namespace `shell` nuevo). Pendiente de tanda 4: toasts de `CubeConnector`
  ("Cube connected!", "Cube disconnected", "Failed to disconnect",
  "Copied!").

### ✅ Tanda 3 — Timer + stats de sesión (zona principal) *(hecha)*
- **Zonas**:
  - `TimerStage` + `TimerContainer` + `TimerDisplay` (estados: ready/running/stopped, hint de tecla espacial).
  - `ManualTimeInput` (entrada manual de tiempos) + `PbCelebrationBanner` (¡PB!).
  - `SessionStats` + `TimesList` + `ManualSolveSheet` + `SolveProgressionChart` + `TrendChart` (etiquetas Ao5/Ao12/Best/Mean — ¡cuidado: algunas son siglas WCA estándar, evaluar si se traducen!).
  - `ScrambleDisplay` + `Cube3DPanel`/`MiniCube3DPanel` (tooltips de control 3D).
- **Namespace**: `timer` (expandido: `hint.*` + controles + foco + PB + 3D), `stats` (nuevo).
- **Dificultad**: media. Toasts propios: "Scramble copied", "Couldn't add solve", "Logged: {label}".
- Hecho: hints del timer localizados vía `i18n.t` global (test de `hintFor`
  fija `changeLanguage('en')` en beforeAll; vitest aísla archivos, sin
  fuga de estado); `TimerContainer` (aria del timer, pill +2/DNF, nota),
  `ManualTimeInput` (toggle de penalización), `PbCelebrationBanner` (anuncio
  a11y por partes + cabecera + cierre), `TimerStage` (modo foco),
  `SessionStats` (celdas Best/Mean; Ao5/Ao12 siglas WCA se mantienen),
  `TimesList`/`SolveRow` (nota, análisis, menú de acciones del solve),
  `ScrambleDisplay` (copiar/nueva scramble, estados de validación),
  `Cube3DPanel` (tooltips 3D), `ManualSolveSheet` (secciones Time/Method/
  Penalty/Notes + footer). Jerga mantenida: siglas WCA (Ao5/Ao12/DNF/+2),
  "Scramble", notación, BPA/WPA. `timeHint` en texto plano (antes con
  `<code>`) como trade-off de i18n. Validado: tsc web+desktop 0, eslint 0,
  paridad 6/6, hintFor 17/17, build OK.

### ✅ Tanda 4 — Feedback global (transversal: toasts + notificaciones + TTS) *(hecha)*
- **Zonas**:
  - **Toasts** (43+ llamadas): App.tsx (scramble copiado/fallo, update failed) · `useSessionActions` (nueva/borrar/cambiar sesión, clear) · `useSolveCompletion` (solve no guardado) · `useScrambleState` (puzzle cambiado, nuevo scramble) · `useManualSolves` · `ManualSolveSheet` · `CubeConnector` (conectado/desconectado) · `SmartCubeSection` · `ProfileSection` (perfil/avatar guardado) · `DataSection` (exportar) · `AdvancedSection` (reset, debug) · `SolveAnalysisPanel` · `AlgorithmEditorDialog` · `Case3DPanel`/`CaseDetailPanel` (algoritmo eliminado) · `AppShell`.
  - **Notificaciones del sistema** (Web Notification): `useReminderScheduler` — recordatorio diario de práctica + cola de review (título/cuerpo localizados; re-programar si cambia el idioma).
  - **TTS del timer**: `audioSystem.ts` — frases de inspección (8s/12s) + lectura de cifras; hoy fuerza `en-US`.
- **Namespace**: `toast.*` (o por zona), `notifications`, `audio`.
- **Dificultad**: media. Patrón: clave + interpolación; la TTS necesita voces por idioma.
- Archivos: `App.tsx`, `useSessionActions`, `useSolveCompletion`, `useScrambleState`,
  `useManualSolves`, `useReminderScheduler`, `audioSystem.ts` (TTS: frases 8s/12s
  localizadas + `utterance.lang` + voces por idioma), `ManualSolveSheet`,
  `CubeConnector`, `SolveAnalysisPanel`, `SmartCubeSection`, `ProfileSection`,
  `AdvancedSection`, `DataSection`, `AlgorithmEditorDialog`, `CaseDetailPanel`,
  `Case3DPanel`, `en/es.json` (namespaces `toast`, `notifications`, `audio`
  nuevos). Nota: el `t()` global (`i18n.t`) usa claves con prefijo `"ns:key"`.

### ✅ Tanda 5 — Insights (tab Stats/Analytics) *(hecha)*
- **Zonas**:
  - `InsightsDashboard` + `OverviewPanel` (métricas, encabezados).
  - `SolveListPanel` (filtros, orden, chips) + `SolveAnalysisPanel` (panel más grande: secciones de análisis de fase, detección, métricas — 1512 líneas, dividir el trabajo en sub-bloques por panel interno).
  - `ReplaySection` (controles de replay: play/pause/speed/rotación).
  - **atoms**: `EmptyState`, `SectionHeader`, badges (`Coherence`, `Skipped`, `Warnings`, `Penalty`), `MetricRing`, `ActivityHeatmap` (tooltips de fechas), `AnimatedNumber`.
- **Namespace**: `insights` (common/dashboard/overview/list/replay/analysis).
- **Dificultad**: alta por volumen (mayor superficie de texto tras Training).
- Hecho: namespace `insights` completo en en/es; traducción de los 5 paneles
  (Dashboard, Overview, SolveList, SolveAnalysis con sus 9 sub-secciones,
  Replay) y de los atoms con texto (`CoherenceBadge`, `SkippedBadge` con
  default localizado, `ActivityHeatmap` con plurales). Jerga de cubing
  mantenida intacta en ambos idiomas (Cross/F2L/OLL/PLL/XCross/TPS/DNF/+2/
  Scramble/auf). Causas y categorías de pausa del pipeline (strings en
  inglés de `analysis-engine`) mapeadas a clave localizada en el HoverCard de
  la timeline (`pauseCause*`/`pauseCat*`). Plurales `_one/_other` donde el
  español flexiona (solvesCount, tpsAnalysed, cleanSolves/plus2Solves/
  dnfSolves, phaseEyebrow/Gap, pauseInPhase). Validado: tsc web+desktop 0,
  eslint 0, paridad 6/6, build de producción OK.

### ✅ Tanda 6 — Algorithms (tab) *(hecha)*
- **Zonas**:
  - `AlgorithmDashboard` + `MethodTree` (árbol de métodos: CFOP/Roux/ZZ…).
  - `CaseGrid` + `CaseDetailPanel` + `Case3DPanel` + diagramas (labels de UI; la notación R U R' NO se traduce).
  - `AlgorithmEditorDialog` (formulario + validación + toasts).
  - `MobileMethodNavigator` + `SortableAlgorithmItem`.
- **Namespace**: `algorithms` (~70 claves: dashboard/grid/árbol/navigator/detail/panel3d/editor + plurales `_one/_other` en algorithmsCount, caseCount, readyToSave).
- **Dificultad**: media. Decisión de producto: nombres de casos (OLL 24, "Sexy Move") — traducir solo las etiquetas de UI, no los identificadores.
- Mantenido: notación (R U R'…), "Setup:", HTM/QTM/STM, 3×3/2×2, claves de slot FR/FL/BL/BR, nombres de métodos/subconjuntos (datos). Nombres de slots F2L localizados (Frente Derecha…). Validado: tsc web+desktop 0, eslint 0, paridad 6/6, build de producción OK.

### Tanda 7 — Training (tab; la zona más grande → 3 sub-tandas)
- **7A — Dashboard + práctica básica**: `TrainingDashboard` + `DashboardSections` (tarjetas de modos) · `PlainPracticeView` · `StatChip` · `TrainingBreadcrumb` · `TouchAside`.

#### Tanda 7A — detalle *(hecha)*
- **Zonas**:
  - `TrainingDashboard` (routing; 1 string: exerciseLabel "Speed vs Efficiency").
  - `DashboardSections`: `FlatDashboard` (header puzzle, badge SRS "N due for review",
    empty state, botón Full Solve, secciones Exercises / Algorithm Sets / Quick
    Summary, labels Algorithmic/Intuitive) + `SubsetCard` (coming soon, contador de
    casos con plural, Drill/Recognize) + `ExerciseCard` (Drill/Recognize/Stats,
    labels de modos de práctica).
  - `PlainPracticeView`: label Scramble, aside "Stats & Tips", StatChips
    (Attempts/Best/Avg/Streak), bloque Tips con 32 tips (8 fases × 4),
    contador "N attempts", badge Smart Cube.
  - `TrainingBreadcrumb` (backLabel por defecto localizado) · `TouchAside`/`StatChip`
    (sin strings propios — title/label vienen del padre).
  - `VerdictOverlay` (anticipado de 7C: se muestra en la práctica básica —
    Correct/Incorrect/Skip without recording/TPS + anuncio a11y).
- **Namespace**: `training` (~80 claves: dashboard.*, mode.*, mastery.*, verdict.*,
  tips.*, practice.*).
- **Decisiones**:
  - Maestría: labels del catálogo (`MASTERY_LEVEL_LABELS`) → claves
    `training:mastery.{new,learning,practicing,mastered,expert}` vía
    `t(\`mastery.${masteryLevel(mastery)}\`)` — el tipo `MasteryLabel` es un key
    estable. Se elimina el helper `masteryLabel` (único uso interno en el dashboard).
  - Modos: se mantienen los labels del catálogo tal cual (Plain, Blind, ≤8, CN,
    S/E, Full, EO, UL/UR, M, Detect, ≤mvs) — el id 'plain' mapea a 'Plain' O
    'Full' según el phaseType, así que un mapa `mode.{id}` sería incorrecto.
  - Tips: los 32 strings de `PHASE_TIPS` migran al locale
    (`training:tips.{phaseId}` como array, acceso con `i18n.t` global casteado
    (clave dinámica) + `returnObjects` + guard `Array.isArray`); `PHASE_TIPS`
    desaparece. La tarjeta de Tips se oculta si la fase no tiene tips.
  - Maestría implementada con `t(\`mastery.${masteryLevel(mastery)}\`)` y el
    helper exportado `masteryLabel` eliminado (único uso interno).
  - Reutilización: `common:back` (breadcrumb, vía `i18n.t` global por ParseKeys con
    ns acotado) · chips y badge con claves propias `practice.*`.
  - Se mantiene (datos del catálogo): nombres/descripciones de métodos, fases y
    subconjuntos (Cross, F2L, OLL, COLL…), notación, siglas.
  - Pendiente hasta 7C (visible en el dashboard en inglés): `TrainingCalendar` y
    `ReviewQueueSection` — se traducen en 7C junto con SRS.
- **Plurales**: dueForReview, caseCount, attemptsCount (`_one/_other`).
- **Dificultad**: media (volumen alto por los 32 tips + maestría del catálogo).
- Hecho: namespace `training` en en/es; `TrainingDashboard`, `DashboardSections`
  (FlatDashboard/SubsetCard/ExerciseCard con hooks propios), `PlainPracticeView`
  (32 tips + chips + contador con plural + badge), `TrainingBreadcrumb` (back por
  defecto localizado), `VerdictOverlay` (anticipado de 7C: botones, TPS y anuncio
  a11y interpolado). Validado: tsc web+desktop 0, eslint 0, paridad 6/6, build de
  producción OK.
- **7B — Drills y fases**: `AlgorithmDrillView` (750 l) · `AlgorithmRecognizeView` · `EODetectView` · `EOEfficiencyView` · `LSESubPhaseView` · `PhaseStatsView` · `BlindPracticeView` · `FullSolveView` (845 l) · `CrossTrainerView` (853 l) + `CrossTrainerPanels` + `FullSolvePanels`.

#### Tanda 7B — detalle *(hecha)* · 4.509 líneas en 11 archivos, ~190 strings → 3 sub-bloques
- **Namespace**: expansión de `training` con sub-namespaces por vista
  (`drill.*`, `recognize.*`, `statsView.*`, `crossTrainer.*`, `fullSolve.*`,
  `blind.*`, `eoDetect.*`, `eoEfficiency.*`, `lse.*`) — reutilizando claves de
  7A (`practice.*` chips, `mastery.*`, `drill`/`recognize`/`fullSolve`/`stats`).
- **7B-1 — Drills de algoritmos** (1.403 l):
  - `AlgorithmDrillView`: modos de drill (Single/Random/Sequential/Weakness con
    descripción en `title`), selector de caso ("Select Case", "{n} cases"),
    paneles Random/Sequential/Weakness ("Next Random Case", "Case {i} of {n}",
    "Weakest Cases First"…), sección Algorithm ("Reveal if fail", "Hide/Show",
    "Algorithm hidden — reveal after attempting"), "{mastered}/{total} mastered",
    chips de sesión (Accuracy/Streak/Avg time/Attempts).
  - `AlgorithmRecognizeView`: toggle Weakest/Random, quiz ("Solution", "Setup",
    "No diagram", "✓ Correct!"/"✗ It was {case}", "Next"), panel de progreso
    ("Cases seen", "Accuracy", "Correct/Incorrect", tip de modo débil).
- **7B-2 — Stats de fase + prácticas EO/LSE/Blind** (1.027 l):
  - `PhaseStatsView`: tabs Overview/Cases/History (la `capitalize` deja de
    aplicarse → claves con capitalización propia), StatCards ("Avg mastery",
    "Best time", "Total attempts", "Cases" con "mastered"/"attempts"),
    "Mastery Distribution" + leyenda (Mastered/Learning/Beginner/New → reutiliza
    `mastery.*` + clave `beginner`), "14-Day Trend", "Phase Performance"
    (Avg time/Exec acc/Rec acc/Efficiency/Fail rate/Attempts + párrafo de
    explicación), "Weakest Cases"/"Weak Recognition", "Spaced Repetition Ready"
    (2 variantes con interpolación), tabs de casos ("Sort by:" mastery/time/name)
    e historial ("Session History (14 days)", "{t}s avg", "{acc}% acc").
  - `EODetectView` ("Edge Detection", "Bad edges:", instrucción, 4 tips),
    `EOEfficiencyView` ("Efficient EO", "Hide/Show guide" + guía de 4 casos),
    `LSESubPhaseView` (3 sub-fases EO/UL/UR/M-Slice con 12 tips),
    `BlindPracticeView` (estados idle/inspección/solving: "Blind {phase}",
    "Start Inspection (15s)", "Memorizing…", "Scramble hidden — solve blind!" + 4 tips).
- **7B-3 — Cross trainer + Full solve** (2.079 l):
  - `CrossTrainerView`: estados del timer ("Press & hold space…", "Stopped · {t}"),
    "Your move count" + instrucción con interpolación (óptimo + tolerancia),
    feedback de moves ("Optimal! 🎯", "{n} under/over optimal"), "Reveal/Hide",
    aria-labels del replay (Restart/Step backward/Step forward/Play/Pause),
    "CN"/"{face}-cross", tooltips ("Color-neutral: picks the best cross face…",
    "Toggle cross-piece highlight"). `CrossTrainerPanels`: chips (Accuracy/Best/
    Avg moves/Avg time/Efficiency), "Current scramble" (Mode/Solved face/Optimal
    depth/Your last/Streak, "Color-neutral"/"{face} fixed"), 5 tips, empty state
    de intentos.
  - `FullSolveView`: modos (Phase targets/Move limit/TPS/Rotationless con
    descripciones), "Inspection (15s)" + titles, "Max moves:"/"Min TPS:",
    instrucción rotationless, "Total solve time", "Currently: {phase} — tap
    phase…", 4 tips de modo interpolados. `FullSolvePanels`: "Phase Targets",
    "Total target", "Move Limit" ("max moves allowed" + 4 bullets de medias),
    "TPS Challenge" ("minimum TPS" + 4 bullets), "Rotationless"
    ("Rotation Used"/"Clean Solve!" + 4 bullets).
- **Decisiones**:
  - Jerga mantenida: notación, nombres de casos/fases/métodos (datos del
    catálogo), "Scramble", "Smart Cube", "Setup", "Solution", siglas (CN, EO,
    LSE, TPS, UL/UR, M-Slice, ≤mvs), "CFOP/Roux" en los bullets de medias.
  - Maestría reutilizada de 7A (`training:mastery.*`) + clave nueva `beginner`.
  - Chips reutilizados de 7A (`practice.attempts/best/avg/streak/tips`,
    `practice.statsAndTips`, `practice.scramble`, `practice.smartCube`).
  - `PhaseStatsView`: los ids de tab/sort se mantienen como valores de estado
    (localStorage) — solo se traduce la etiqueta visible.
  - VerdictOverlay/tips del timer ya localizados (7A) — las vistas de práctica
    reutilizan los componentes ya traducidos (ScrambleDisplay, TimerContainer,
    TouchAside, TrainingBreadcrumb, VerdictOverlay).
- **Plurales**: casesCount, masteredCount, countLearning/countBeginner,
  attemptsCount (reutilizada).
- **Dificultad**: muy alta — mayor volumen del proyecto; se implementó en los 3
  sub-bloques con validación al final de cada uno.
- Hecho: sub-namespaces `drill`/`recognize`/`statsView`/`eoDetect`/`eoEfficiency`/
  `lse`/`blind`/`crossTrainer`/`fullSolve` en en/es (~230 claves nuevas) y los 11
  archivos traducidos. Nota de arquitectura: `drill`, `recognize` y `fullSolve`
  eran claves planas en 7A y ahora son sub-namespaces — sus etiquetas viven en
  `.title` y `DashboardSections` se actualizó (rompería tsc si quedara algo).
  `currentSplit` unifica el split de fase en texto plano (antes tenía un `<span>`
  estilizado — trade-off aceptado, mismo patrón que `timeHint` de 7A). Tips con
  interpolación vía `i18n.t` + `returnObjects` + `.replace` con fallback (blind.
  {{phase}}). Validado: tsc web+desktop 0, eslint 0, paridad 6/6, build de
  producción OK, 0 strings residuales en la zona.
- **7C — SRS y calendario** (2.078 líneas en 5 archivos; `VerdictOverlay` ya
  traducido en 7A) → **3 sub-bloques**:
  - **7C-1 — Cola de repaso** (`ReviewQueueSection` · 400 l): tarjeta "Review
    Queue" del dashboard con badges de motivo (Overdue/Due/Weak/New), stats
    (Overdue/Weak/New), filtro de método y botón "Start Review (N)".
  - **7C-2 — Sesión de repaso SRS** (`SRSReviewView` · `ReviewSteps` · 1.100 l):
    máquina de 3 etapas (Recognize → Execute → Grade), señales Retention/
    Mastery/Recognition, 4 botones FSRS con hints, resumen final con plurales
    ("N casos revisados · M superados"), errores de persistencia, mensajes de
    accesibilidad (`announce`) con interpolación.
  - **7C-3 — Insights + calendario** (`SRSInsightsView` · `TrainingCalendar` ·
    700 l): dashboard de salud de memoria (stats, distribución de retención,
    curva de intervalos, estados FSRS, proyección "Due in") y calendario de
    tareas completo (colores, repeticiones, días de la semana localizados).
- **Namespace**: `training` (sub-ns `review`/`insights`/`calendar` + claves
  planas `method`, `allMethods`, `backToTraining`).
- **Dificultad**: alta — 5 archivos grandes, configuración de constantes de
  datos (`STAGES`/`GRADES`/`REASON_META`/`TASK_COLORS`/`REPEAT_OPTIONS` →
  `labelKey`/`hintKey` y `t()` en render), plurales y `announce`.
- **Decisiones clave**:
  - **date-fns v4**: meses/días del calendario se localizan pasando el locale
    (`enUS`/`es`) a `format()` según `i18n.language` — no hay precendente en el
    proyecto, se introduce ahora para el calendario.
  - **Días de la semana**: `calendar.weekday.*` (nombres) y `calendar.weekdayShort.*`
    (siglas de una letra; ES: D L M X J V S) — los índices 0-6 (domingo=0) se
    mantienen para la lógica de repeticiones y la rejilla sigue arrancando en
    domingo (coherente con las letras).
  - **Jerga mantenida**: "scramble", "setup", "FSRS", "finger tricks", notación.
  - **Reutilización**: `training:noDiagram` (7B), `common:back`/`cancel`/`delete`/`close`,
    `nav:training` (breadcrumb), `training:mastery.*` (7A).
  - **Plurales**: `review.queue.itemCount`, `review.session.reviewedSummary`,
    `review.session.overdueDays`, `calendar.taskCount`, `calendar.tooltipCount`.
  - **Queda fuera**: los labels de los buckets de retención (`<60%`, `60–80%`…)
    vienen del paquete de datos — se mantienen (documentado).
- Hecho: sub-namespaces `review`/`insights`/`calendar` + claves planas
  `method`/`allMethods`/`backToTraining` en en/es (~125 claves nuevas) y los 5
  archivos traducidos. Las constantes de datos (`STAGES`/`GRADES`/`REASON_META`/
  `TASK_COLORS`/`REPEAT_OPTIONS`) migraron a `labelKey`/`hintKey` tipadas con
  `ParseKeys<'training'>` (mismo patrón que `SLOT_LABELS`). `gradePrompt` y
  `currentSplit` pierden el `<span>` estilizado (texto plano con interpolación
  `{{again}}`/`{{good}}` — trade-off aceptado). `announce` del repaso
  interpolado y localizado. Validado: tsc web+desktop 0, eslint 0, paridad 6/6,
  build de producción OK, 0 strings residuales en la zona.

### Tanda 8 — Skill Tree (tab)
- **Zonas**:
  - `UltraSkillTreeView` + `SkillGraphCanvas` (tooltips, leyendas) + `SkillNodeModal` (detalle del skill).
  - **Contenido**: `skillTreeData.ts` — 149 skills × (title, subtitle, description, theory, recommendedDrills, exampleFormula). Estrategia: mantener el dato con `titleKey`/`descriptionKey` apuntando a `skillTree.*` (mismo patrón que nav/settings), o mover el contenido a los locales si se quiere traducir la teoría completa.
- **Namespace**: `skillTree`.
- **Dificultad**: alta por volumen de contenido (≈750 campos de texto).

### Tanda 9 — Profile (tab)
- **Zonas**:
  - `ProfileView` (cabecera, métricas, XP, logros) + `ProfileHero` (fechas con locale activo — hoy `en-US` hardcodeado).
  - Logros/badges (`CreativeBadges`, logros de cubos) + `subBadges`.
  - (La sección Profile de Settings ya se tradujo la etiqueta; quedan sus controles — ver tanda 11.)
- **Namespace**: `profile`.
- **Dificultad**: media.

### Tanda 10 — Reconstructions (tab)
- **Zonas**: `ReconstructionsView` (lista, filtros, orden) · `ReconstructionDetailView` (detalle por fases) · `OurDetectionPanel` (detección automática de fases, mensajes de estado).
- **Namespace**: `reconstructions`.
- **Dificultad**: media.

### Tanda 11 — Widgets (dock + explorer + 13 widgets)
- **Zonas**:
  - `WidgetExplorer` (catálogo: títulos + descripciones de widgets) · `WidgetCard` · `WidgetPreviews` · `WidgetHost` (controles de panel flotante) · `WidgetDock`.
  - **Cada widget** (título, descripción, `FloatingPanel`, `Preview`):
    1. `algorithm-db` (buscador de algoritmos) 2. `cube-button` (botón de cubo 3D) 3. `layout-organizer` 4. `metronome` 5. `notes` (contenido del usuario NO se traduce) 6. `pb-progression` 7. `phase-balance` 8. `scramble-2d` 9. `solve-timeline` 10. `time-distribution` 11. `times-log`.
- **Namespace**: `widgets`.
- **Dificultad**: media-alta (11 widgets + infraestructura); los títulos/descripciones usan `labelKey` (dato).

### Tanda 12 — Settings restantes (11 secciones)
- **Zonas** (cada sección completa: título, descripciones, toggles, selects, placeholders):
  `Appearance` (tema, skin 3D, colores de stickers) · `Timer` (inspección, focus mode, voz) · `Scramble` (verificación, display) · `Analysis` (método, BPA/WPA) · `Training` · `Notifications` (sonidos, volumen, recordatorios) · `Shortcuts` (atajos de teclado) · `Data` (export/import — 660 l) · `Profile` (avatar, bio, país) · `SmartCube` (Bluetooth, GAN) · `Advanced` (debug, reset) · `Credits` (textos largos de agradecimientos).
- **Namespace**: `settings`.
- **Dificultad**: media-alta por volumen; patrón ya establecido en tanda 1.

### Tanda 13 — Datos y superficies no-React
- **Zonas**:
  - `countries.ts` (253 países) → `Intl.DisplayNames` con el locale activo (sin traducción manual).
  - PWA manifest (`vite.config.ts`) + `index.html` (título/meta) — evaluar multi-idioma o dejar en inglés base.
  - `exportSolves.ts`/`importSolves.ts` (nombres de archivo, mensajes) · `subBadges.ts`.
  - **packages/ui** (texto de componentes compartidos): `breadcrumb`, `carousel`, `dialog`, `pagination`, `sheet`, `sidebar`, `calendar` (meses), `chart` (tooltips de números).
  - `audioSystem.ts` si no se hizo en tanda 4.
- **Namespace**: `data`, `ui`.
- **Dificultad**: media; `Intl.DisplayNames` elimina la traducción manual de países.

---

## Orden de ejecución recomendado y validación

Ejecutar por tanda, siempre con: typecheck web + desktop, lint, tests (paridad
en/es), y verificación visual headless (`--lang=es` vs `--lang=en-US`) como la
de la tanda 1. Las tandas 4, 7 y 5 son las de mayor riesgo por volumen;
conviene dividirlas en PRs pequeños.

Prioridad sugerida tras la tanda 2: **2 → 4 (feedback global, alto impacto
visible) → 3 (timer, la cara de la app) → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13**.

Herramientas: `i18next-parser` (extraer claves existentes a los JSON) cuando
haya varias tandas migradas; scanner de hardcoded para localizar lo que quede.
