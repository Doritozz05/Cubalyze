# Plan de internacionalización (i18n) — migración completa del UI

Plan por **tandas (batches)** que nombra **cada tab, zona y superficie** de la
app que será traducida, incluidas las transversales (toasts, notificaciones,
TTS, datos). No lista strings individuales: cada tanda se define por las zonas
de UI que cubre, su namespace, dificultad y consideraciones especiales.

**Estado**: infraestructura ✅ · Tanda 1 (estructura de navegación) ✅ · Tanda
2 (shell completo) ✅ — todo en `feat/spanish-translation` · resto pendiente.

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

### Tanda 3 — Timer + stats de sesión (zona principal)
- **Zonas**:
  - `TimerStage` + `TimerContainer` + `TimerDisplay` (estados: ready/running/stopped, hint de tecla espacial).
  - `ManualTimeInput` (entrada manual de tiempos) + `PbCelebrationBanner` (¡PB!).
  - `SessionStats` + `TimesList` + `ManualSolveSheet` + `SolveProgressionChart` + `TrendChart` (etiquetas Ao5/Ao12/Best/Mean — ¡cuidado: algunas son siglas WCA estándar, evaluar si se traducen!).
  - `ScrambleDisplay` + `Cube3DPanel`/`MiniCube3DPanel` (tooltips de control 3D).
- **Namespace**: `timer`, `stats`.
- **Dificultad**: media. Toasts propios: "Scramble copied", "Couldn't add solve", "Logged: {label}".

### Tanda 4 — Feedback global (transversal: toasts + notificaciones + TTS)
- **Zonas**:
  - **Toasts** (43+ llamadas): App.tsx (scramble copiado/fallo, update failed) · `useSessionActions` (nueva/borrar/cambiar sesión, clear) · `useSolveCompletion` (solve no guardado) · `useScrambleState` (puzzle cambiado, nuevo scramble) · `useManualSolves` · `ManualSolveSheet` · `CubeConnector` (conectado/desconectado) · `SmartCubeSection` · `ProfileSection` (perfil/avatar guardado) · `DataSection` (exportar) · `AdvancedSection` (reset, debug) · `SolveAnalysisPanel` · `AlgorithmEditorDialog` · `Case3DPanel`/`CaseDetailPanel` (algoritmo eliminado) · `AppShell`.
  - **Notificaciones del sistema** (Web Notification): `useReminderScheduler` — recordatorio diario de práctica + cola de review (título/cuerpo localizados; re-programar si cambia el idioma).
  - **TTS del timer**: `audioSystem.ts` — frases de inspección (8s/12s) + lectura de cifras; hoy fuerza `en-US`.
- **Namespace**: `toast.*` (o por zona), `notifications`, `audio`.
- **Dificultad**: media. Patrón: clave + interpolación; la TTS necesita voces por idioma.

### Tanda 5 — Insights (tab Stats/Analytics)
- **Zonas**:
  - `InsightsDashboard` + `OverviewPanel` (métricas, encabezados).
  - `SolveListPanel` (filtros, orden, chips) + `SolveAnalysisPanel` (panel más grande: secciones de análisis de fase, detección, métricas — 1512 líneas, dividir el trabajo en sub-bloques por panel interno).
  - `ReplaySection` (controles de replay: play/pause/speed/rotación).
  - **atoms**: `EmptyState`, `SectionHeader`, badges (`Coherence`, `Skipped`, `Warnings`, `Penalty`), `MetricRing`, `ActivityHeatmap` (tooltips de fechas), `AnimatedNumber`.
- **Namespace**: `insights`.
- **Dificultad**: alta por volumen (mayor superficie de texto tras Training).

### Tanda 6 — Algorithms (tab)
- **Zonas**:
  - `AlgorithmDashboard` + `MethodTree` (árbol de métodos: CFOP/Roux/ZZ…).
  - `CaseGrid` + `CaseDetailPanel` + `Case3DPanel` + diagramas (labels de UI; la notación R U R' NO se traduce).
  - `AlgorithmEditorDialog` (formulario + validación + toasts).
  - `MobileMethodNavigator` + `SortableAlgorithmItem`.
- **Namespace**: `algorithms`.
- **Dificultad**: media. Decisión de producto: nombres de casos (OLL 24, "Sexy Move") — traducir solo las etiquetas de UI, no los identificadores.

### Tanda 7 — Training (tab; la zona más grande → 3 sub-tandas)
- **7A — Dashboard + práctica básica**: `TrainingDashboard` + `DashboardSections` (tarjetas de modos) · `PlainPracticeView` · `StatChip` · `TrainingBreadcrumb` · `TouchAside`.
- **7B — Drills y fases**: `AlgorithmDrillView` (750 l) · `AlgorithmRecognizeView` · `EODetectView` · `EOEfficiencyView` · `LSESubPhaseView` · `PhaseStatsView` · `BlindPracticeView` · `FullSolveView` (845 l) · `CrossTrainerView` (853 l) + `CrossTrainerPanels` + `FullSolvePanels`.
- **7C — SRS y calendario**: `SRSReviewView` (verdictos, revisión) · `SRSInsightsView` · `TrainingCalendar` · `ReviewQueueSection` · `ReviewSteps` · `VerdictOverlay`.
- **Namespace**: `training`.
- **Dificultad**: alta (mayor volumen del proyecto; ~10 vistas grandes, muchas con verdictos e interpolaciones).

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
