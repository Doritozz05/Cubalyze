# Componentes de la Web (apps/web/src/components)

> Documentado el 2026-08-12. 12 grupos, ~67 archivos. Fichas verificables contra
> el código (nombres reales de archivos).

| Grupo | Archivos | Qué contiene |
| --- | --- | --- |
| **Layout** | `AppShell`, `Header`, `LeftSidebar`, `MainLayout`, `MobileMoreSheet`, `MobileSessionSheet`, `MobileTabBar`, `StageOverlays` | Shell de la app: sidebar, header (session switcher, puzzle selector, profile chip, dock de widgets), navegación móvil (tab bar + sheets), overlays del stage |
| **Timer** | `TimerContainer`, `TimerDisplay`, `ManualTimeInput`, `PbCelebrationBanner` | Temporizador: contenedor (hold-to-start, inspección), display, entrada manual de tiempos, banner de celebración de PB |
| **Stage** | `MainStage`, `TimerStage` | El "escenario": composición de la vista principal (timer + scramble + stats) |
| **Stats** | `SessionStats`, `MetricTile`, `SolveProgressionChart`, `TrendChart`, `TimesList`, `ManualSolveSheet` | Estadísticas de sesión (Ao5/Ao12/Best/Mean, BPA/WPA), progresión, lista de tiempos, entrada manual |
| **Settings** | `SettingsDialog`, `SettingsSidebar` + 15 secciones (`GeneralSection`, `AppearanceSection`, `TimerSection`, `ScrambleSection`, `AnalysisSection`, `NotificationsSection`, `ShortcutsSection`, `SmartCubeSection`, `AdvancedSection`, `DataSection`, `ProfileSection`, `CreditsSection`, `PlaceholderSection`, `ColorPicker`, `SettingToggle`) | Diálogo de ajustes con sidebar y secciones por dominio |
| **Insights** | `InsightsDashboard`, `OverviewPanel`, `SolveAnalysisPanel`, `ReplaySection`, `SolveListPanel` + 12 átomos (`MetricRing`, `Sparkline`, `ActivityHeatmap`, `AnimatedNumber`, `PenaltyBadge`, `WarningsBadge`, `SkippedBadge`, `CoherenceBadge`, `FaceChip`, `EmptyState`, `SectionHeader`, `AlgorithmNotation`) | Panel de análisis: dashboard, análisis de solves, replay, lista, y átomos reutilizables |
| **Scramble** | `ScrambleDisplay` | Render del scramble (texto WCA + notación; se sincroniza con orientación si `scrambleFollowsCube`) |
| **Hardware** | `CubeConnector`, `BatteryIcon` | Conexión del smart cube (scan/connect/disconnect) e icono de batería |
| **Identity** | `ProfileHero`, `StatStrip`, `IdenticonAvatar`, `CountryFlag` | Identidad del perfil (CubeMark identicon SVG, banderas para idiomas) |
| **Onboarding** | `OnboardingTour`, `OnboardingSpotlight`, `TourTooltip` | Tour de primer uso (spotlight, tooltips) — TDD-0020 |
| **Cube3D** | `Cube3DPanel`, `MiniCube3DPanel` | Paneles 3D del cubo (sidebar de MainLayout; el botón que lo abre es el widget `cube-button`) |
| **ContextMenu** | `ContextMenu` | Menú contextual (Radix) |

## Notas

- **UI kit**: los controles base (`@/components/ui/*`: select, dialog, tabs,
  tooltip, spinner…) son wrappers de **Radix UI** + `tailwind-merge`/`cva`.
- **Insights** reutiliza el mismo `analysis-engine` que los widgets de análisis.
- **Timer** comparte el flujo de teclado con los drills vía `useTimerKeyboard`
  (ver [Hooks, Services y Lib](./Hooks_Services_and_Lib.md)).
