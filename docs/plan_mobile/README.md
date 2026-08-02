# CubeForge — Plan UX Móvil y Tablet (Touch Experience)

> **Documento maestro del rediseño de experiencia táctil (móvil + tablet).**
> Fecha: Agosto 2026 · Estado: **Aprobado para implementación por fases**
> Regla de oro: **CERO cambios en escritorio (≥1024px).** Todo lo descrito aquí
> se aplica exclusivamente al rango táctil (`<1024px`) y está verificado por
> archivo en §4–§9.

---

## Índice

1. [Principios y reglas no negociables](#1-principios-y-reglas-no-negociables)
2. [Arquitectura responsive (los 3 regímenes)](#2-arquitectura-responsive)
3. [Fundación compartida (Fase 0)](#3-fundación-compartida-fase-0)
4. [Tab 1 — Timer](#4-tab-1--timer)
5. [Tab 2 — Training](#5-tab-2--training)
6. [Tab 3 — Algorithms](#6-tab-3--algorithms)
7. [Tab 4 — Skills](#7-tab-4--skills)
8. [Tab 5 — Stats / Insights](#8-tab-5--stats--insights)
9. [Tab 6 — Widgets](#9-tab-6--widgets)
10. [Settings y diálogos transversales](#10-settings-y-diálogos-transversales)
11. [Orden de implementación por fases](#11-orden-de-implementación)
12. [Validación y garantías](#12-validación-y-garantías)

---

## 1. Principios y reglas no negociables

1. **El escritorio es sagrado.** `lg:` = 1024px es la frontera. Ningún cambio
   toca el rango `≥1024px`. Todo cambio táctil se aplica con clases `max-lg:*`,
   `lg:hidden`, `md:hidden` o con el hook `useIsTouch()` (nuevo).
2. **Diseño móvil-first dentro del rango táctil**: los componentes `<1024px`
   se rediseñan desde cero como si fueran una app nativa (estilo Twisty Timer /
   csTimer app): gestos, targets ≥44px, safe-areas, bottom tab bar.
3. **Tablet = UX táctil completa.** Hasta 1024px las tablets reciben la
   experiencia móvil completa (drawer/bottom bar, sin hover-only, paneles
   apilados). Nada de "tablet como mini-desktop".
4. **Nada de hover como única vía** en el rango táctil: todo estado hover
   tiene equivalente tap/persistente.
5. **Sin regresiones**: cada fase termina con typecheck + lint + build + test
   de viewports (1440 / 834 / 390) según §12.

---

## 2. Arquitectura responsive

| Régimen        | Rango          | Navegación                          | Panel 3D | Widgets flotantes   |
| -------------- | -------------- | ----------------------------------- | -------- | ------------------- |
| **Escritorio** | `≥1024px` (lg+) | Rail hover-to-expand (SIN CAMBIOS)  | Aside con resize | Flotantes draggable |
| **Tablet**     | `768–1023px`    | Bottom tab bar (igual que móvil)    | Full-screen sheet | Bottom sheets       |
| **Móvil**      | `<768px`        | Bottom tab bar                      | Full-screen sheet | Bottom sheets       |

**Decisión clave:** el breakpoint táctil se unifica en **1024px**. El hook
`useIsMobile()` (768px) deja de ser la única señal; se introduce
`useIsTouch()` con `max-width: 1023px`.

---

## 3. Fundación compartida (Fase 0)

### 3.1 `src/hooks/use-mobile.ts` — nuevos hooks de régimen
- Añadir `useIsTouch()` → `window.matchMedia('(max-width: 1023px)')`.
- Mantener `useIsMobile()` (768px) intacto para compatibilidad.
- NO cambiar firmas existentes.

### 3.2 `src/components/Layout/MobileTabBar.tsx` — NUEVO componente
- Barra inferior fija, visible solo `<1024px` (`lg:hidden`).
- 5 tabs: **Timer** (centro, destacado con anillo), Training, Algorithms,
  Stats, Skills. Widgets y Settings pasan a un botón "+"/engranaje o a
  cabecera contextual.
- `safe-area-inset-bottom` para iOS (see §3.6).
- Anima con framer-motion (misma `SIDEBAR_MOTION`), pastilla activa
  `layoutId` reutilizando el patrón de la rail.
- Tamaño de tap ≥44px, texto + icono.
- Archivos afectados: nuevo + `App.tsx` (montaje) + `MainLayout.tsx`
  (padding inferior `<1024px`).

### 3.3 `src/components/Layout/Header.tsx` — compactación táctil
- `lg:hidden` en el botón hamburguesa **se mantiene oculto** en tablet
  (desaparece: la bottom bar lo reemplaza). En móvil igual.
- En `<1024px`: ocultar el texto del selector de sesión (`max-lg:hidden` en
  el span), dejar icono + contador; reducir `w-30` del puzzle a `w-24`.
- El `WidgetDock` se colapsa en `<1024px` a un botón único "Widgets"
  (`max-lg:` render condicional) — ver §9.

### 3.4 `src/components/Layout/MainLayout.tsx`
- `md:pl-14` se mantiene SOLO en `≥1024` (hoy es `md:` = 768; **cambio a
  `lg:pl-14`**). En `<1024` el rail no se renderiza y no debe haber padding.
- Añadir `lg:hidden` al contenedor del rail (`leftSidebar`) en el wrapper.
  El rail desktop se sigue montando en `≥1024px` **sin ningún cambio**.
- Añadir padding inferior `pb-[env(safe-area-inset-bottom)]` en `<1024`.

### 3.5 `src/App.tsx`
- Montar `<MobileTabBar>` cuando `!isFocused && !hideHeader` en `useIsTouch`.
- El estado `activeView` se comparte tal cual (ya es la fuente de verdad).
- `mobileNavOpen` deja de usarse en táctil (la bottom bar navega directo).
- `ManualSolveSheet` y `WidgetHost` solo montan el flujo correcto por régimen.

### 3.6 Safe areas y theme-color (`index.html`, `index.css`)
- `index.css`: añadir utilidades `pb-safe` / `pt-safe` con
  `env(safe-area-inset-*)`.
- `index.html`: `theme-color` dinámico (script de 3 líneas que lee el tema y
  emite `#f8f9fa` / `#14171b`). Hoy está fijo a `#0f172a` (bug conocido).

### 3.7 Toaster (`App.tsx`)
- `position` pasa a `bottom-center` en `<1024` con `bottom: calc(env(...)+56px)`
  para no solaparse con la bottom bar. Sonner acepta `toastOptions`.

---

## 4. Tab 1 — Timer

### 4.1 `TimerContainer.tsx`
- `min-h-[clamp(280px,42vh,460px)]` → en táctil subir a
  `min-h-[clamp(340px,48vh,520px)]` con `max-lg:`.
- Asegurar `touch-action: manipulation` y `user-select:none` (ya hay
  `select-none`); añadir `-webkit-tap-highlight-color: transparent` global.
- El botón de penalidades (+2/DNF) pasa a pill grande ≥40px de alto en táctil
  (`max-lg:h-10 max-lg:text-sm`).

### 4.2 `TimerDisplay.tsx`
- El texto usa `clamp(3.75rem,15vw,9.5rem)` — en táctil el `15vw` ya escala.
  Verificar que con bottom bar no choque el hint: añadir `max-lg:gap-5`.
- Delta PB: sin cambios, ya es fluido.

### 4.3 `ScrambleDisplay.tsx`
- Tokens con `text-base` en táctil (`max-lg:`) para legibilidad.
- Si el scramble es largo (>12 tokens), permitir `overflow-x-auto` con
  scroll horizontal en `<1024` (hoy `flex-wrap`; en móvil ocupa 3–4 líneas
  y roba altura al timer).

### 4.4 `SessionStats.tsx`
- En `<1024` los 4 stats (Ao5/Ao12/Best/Mean) se mantienen en `grid-cols-4`
  pero con `text-xs` y `px-1` para no desbordar en 360px.
- Botón minimize mayor (`size-7`→`size-8` en táctil).

### 4.5 `ManualTimeInput.tsx`
- `w-[clamp(320px,70vw,900px)]` → en táctil `w-full max-w-[480px]` con
  `max-lg:`; el input de `clamp(3.75rem,15vw,9.5rem)` ya escala bien.

### 4.6 Panel 3D (`MainLayout` aside + `Cube3DPanel.tsx`)
- En `<1024`: el panel 3D pasa a **full-screen sheet** (fixed inset-0, no
  aside flotante). El botón flotante del cubo (48×48) se mantiene.
- `Cube3DPanel` recibe prop `variant?: 'aside' | 'sheet'` — el contenido es
  idéntico, solo cambia el contenedor en `MainLayout`. **Desktop intacto.**

### 4.7 `PbCelebrationBanner.tsx`
- `max-w-sm` → `max-w-[90vw]` en táctil; botón cerrar ≥40px.

---

## 5. Tab 2 — Training

Todas las vistas comparten el patrón `flex-1 min-h-0 flex flex-col gap-4
overflow-hidden lg:flex-row` con `<aside className="lg:w-64">`. En `<1024`
el aside ya apila debajo del contenido. **Cambio común:** el aside en táctil
pasa a un **panel colapsable por defecto** (header "Opciones ▾") para no
obligar a scrollear; o directamente a bottom sheet al pulsar un botón
"Config".

### 5.1 `TrainingDashboard.tsx` (hub)
- Método tabs: hoy `flex flex-wrap` — en táctil `overflow-x-auto` con
  scroll horizontal y `snap-x` (`max-lg:`), targets ≥40px.
- `ExerciseCard`: botones Drill/Recognize/Stats → full-width grid
  `grid-cols-3` con `py-2.5` en táctil.
- Grid de ejercicios `grid-cols-1 sm:grid-cols-2` ya OK; confirmar en 834px.
- `TrainingCalendar`: en táctil cabecera de días compacta; el diálogo de tarea
  ya es `sm:max-w-lg` — en `<640` es `max-w-[calc(100%-2rem)]`, OK. Añadir
  scroll horizontal en la semana si desborda.

### 5.2 Vistas de práctica (archivos con patrón común)
`CrossTrainerView, EODetectView,
EOEfficiencyView, LSESubPhaseView, PlainPracticeView, BlindPracticeView,
AlgorithmDrillView, AlgorithmRecognizeView, FullSolveView, PhaseStatsView`

Para **cada una**, en `<1024`:
- El `aside` (w-64) → colapsado con header táctil "Opciones/Stats ▾" que
  abre un bottom-sheet (reutilizar componente nuevo `TouchPanel.tsx`, §5.4).
- Botones de acción principales `h-10` mínimo; chips de modo ≥36px.
- `StatChip`, `VerdictOverlay` (texto `2.5rem`→`clamp(2rem,12vw,3rem)`),
  `TrainingBreadcrumb` OK con `flex-wrap`.

### 5.3 `AlgorithmDrillView.tsx` (núcleo)
- Diagrama 3D `w-28 sm:w-36` → en táctil `w-40 h-40` centrado.
- Botones Show/Hide + Skip/Done → fila sticky inferior en `<1024`
  (siempre accesibles sin scrollear).
- Timer del drill: mismo tratamiento táctil que el timer principal.

### 5.4 NUEVO `src/components/TouchPanel.tsx` (reutilizable)
- Bottom sheet genérico (`fixed bottom-0 inset-x-0 rounded-t-2xl`,
  `max-h-[70vh]`, drag-handle, backdrop, `safe-area`).
- Se usa en asides de Training, en Widgets móviles y en Settings móvil.
- Reutiliza `AnimatePresence` + tokens existentes.

---

## 6. Tab 3 — Algorithms

### 6.1 `PracticeDashboard.tsx`
- Hoy: `<aside lg:w-64>` (MethodTree) + grid + `hidden lg:block` del detalle.
- En `<1024`:
  - MethodTree → **chips horizontales scrollables** (sustituye el aside):
    `MethodTree` gana prop `variant="chips"` (desktop conserva `tree`).
  - `CaseGrid` ocupa todo el alto.
  - Al seleccionar caso → el detalle (`CaseDetailPanel`) se abre como
    **full-screen overlay** (`fixed inset-0 z-40`) con botón back. Hoy ya
    usa `w-full lg:w-80` pero comparte fila con el grid; en táctil debe
    reemplazar la vista (no comprimir).

### 6.2 `CaseGrid.tsx`
- `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4` — en táctil
  asegurar `grid-cols-2` (360px) con cards compactas; diagrama
  `max-w-44` → `max-w-36` en móvil.

### 6.3 `MethodTree.tsx`
- Añadir `variant` prop (tree | chips). La lógica de selección es la misma.
- Chips: `overflow-x-auto`, `snap-x`, activo con `bg-ink text-surface`.

### 6.4 `AlgorithmEditorDialog.tsx` — BUG CONOCIDO
- Hoy: `w-105` (420px fijos) → **en pantallas <420px se desborda.**
- Fix: `w-full sm:w-105` + `max-w-full`; en `<640px` full-width sheet
  (sin bordes laterales, con drag-handle opcional). **Desktop sin cambios.**

### 6.5 `CaseDetailPanel.tsx` / `Case3DPanel.tsx`
- En overlay móvil, botón "Practice this case" sticky inferior.
- Lista de algoritmos `SortableAlgorithmItem`: targets ≥44px, reorder
  con handle más grande (dnd-kit ya funciona táctil; verificar activation).

---

## 7. Tab 4 — Skills

### 7.1 `UltraSkillTreeView.tsx`
- Toolbar: título + búsqueda ya apilan (`flex-col sm:flex-row`). En táctil
  `Search` con `h-10`.
- Category pills ya `overflow-x-auto` → añadir `snap-x` y scrollbar oculto.
- `SkillGraphCanvas` ocupa `flex-1 min-h-130` → en móvil `min-h-[60vh]`.

### 7.2 `SkillGraphCanvas.tsx`
- Canvas 7200×3400 con pan/zoom táctil **ya implementado** (touch handlers +
  pinch). Verificar: zoom inicial en móvil (arrancar en `zoom=0.6` +
  pan centrado al nodo inicial en `<1024`).
- Nodos: `w-17 h-17` (68px) OK para tap; el botón check flotante
  (`w-5.5 h-5.5` = 22px) → **subir a ≥36px en táctil** (`max-lg:`).
- Controles zoom/±/reset: `top-4 right-4` → en táctil `bottom-4 right-4`
  para no interferir con el toolbar (y no tapar nodos iniciales).

### 7.3 `SkillNodeModal.tsx`
- `max-w-xl` OK; en móvil `max-w-[calc(100%-1.5rem)]` + `max-h-[85vh]`
  con scroll interno; botones ≥44px.

---

## 8. Tab 5 — Stats / Insights

### 8.1 `InsightsDashboard.tsx` — BUG CONOCIDO (clipping en columna)
- Hoy `<lg`: `flex flex-col` con `SolveListPanel` (`h-full`) + contenido
  (`flex-1`). Ambos piden altura total → riesgo de clipping real.
- Fix `<1024`: **el listado pasa a pestañas internas o a un drawer**:
  - Opción A (recomendada): header con chips "Lista | Vista" — en táctil
    mostrar **una sola columna** con el listado como página propia y el
    detalle como overlay (patrón master-detail móvil).
  - Mantener `lg:flex-row` intacto para desktop.

### 8.2 `SolveListPanel.tsx`
- Filas: `px-3 pb-1.75 pt-1.75` → en táctil `py-2.5` (target ≥44px).
- `Sparkline` `width={300}` → `w-full` (ya lo hace vía className, verificar
  que ResponsiveContainer no fuerce 300 en móvil).
- Chips de filtro ≥32px alto.

### 8.3 `OverviewPanel.tsx`
- `grid-cols-2 sm:grid-cols-4` ya OK en móvil (2×2). En tablet (768–1023)
  `grid-cols-2` hasta `sm` no aplica — **usar `grid-cols-2 md:grid-cols-4`
  queda igual ≥1024? No: hoy es `sm:grid-cols-4` (640). En 834px son 4
  columnas en ~800px → aceptable; verificar en runtime.
- Charts (recharts) ya usan `ResponsiveContainer` — OK.
- `ActivityHeatmap` (12 semanas): en móvil reducir a 8–10 semanas si desborda.

### 8.4 `SolveAnalysisPanel.tsx` / `ReplaySection.tsx`
- En táctil, controles del replay ≥40px; el mini cubo `max-w-xs` OK.
- `MetricRing`/`StatChip` flex-wrap ya presente.
- Sticky de "Volver a overview" en táctil.

---

## 9. Tab 6 — Widgets

### 9.1 `WidgetDock.tsx` (header center)
- En `<1024`: el dock con pills se **oculta** y se sustituye por un único
  botón "Widgets" que abre `WidgetExplorer` (o un bottom sheet de acceso
  rápido). Ver `Header.tsx` §3.3.
- Desktop: SIN CAMBIOS (drag, edge fades, reorder).

### 9.2 `FloatingWidgetWrapper.tsx` — BUG CONOCIDO (clipping)
- Hoy lanza paneles de `panelWidth=340` con `x = max(72, (vw−340)/2)` →
  en móvil 360px queda `x=72` → panel acaba en 412 (52px fuera).
- Fix `<1024`: `panelWidth = min(340, vw − 16)` y `x = max(8, vw − w − 8)`.
- Mejor aún en táctil: **reemplazar por bottom sheet** usando
  `TouchPanel.tsx` (nuevo, §5.4) en vez de panel flotante. El estado del
  store (status/position) se conserva; la posición se ignora en táctil.

### 9.3 `FloatingTimesPanel.tsx`
- Ya tiene `MobileTimesPanel` (barra inferior). Mejorar: `50vh`→`min(60vh,520px)`,
  botón Clear ≥40px, cerrar en `safe-area`.

### 9.4 Resto de widgets (metronome, notes, pb-progression, timeline,
phase-balance, time-distribution, algorithm-db, scramble-2d, layout-organizer)
- Cada uno debe decidir: `TouchPanel` bottom sheet (recomendado) o contenido
  en línea dentro de la vista correspondiente.
- `MetronomePreview`/`BeatIndicator`: targets grandes, flash LED ≥12px.
- Verificar que ningún panel flotante se monte en `<1024` sin wrapper táctil.

### 9.5 `WidgetExplorer.tsx` / `WidgetCard.tsx`
- `EXPLORER_DIALOG_WIDTH sm:max-w-[900px]` OK (en móvil es full-width).
- En `<640`: el sidebar de categorías → chips horizontales; grid
  `grid-cols-1 sm:grid-cols-2` → `grid-cols-2` en móvil con cards compactas.
- Toggle switch ≥44px.

---

## 10. Settings y diálogos transversales

### 10.1 `SettingsDialog.tsx` — BUG CONOCIDO
- Hoy: `flex h-full` con `SettingsSidebar` (220px fijos) + contenido.
  En móvil (360px) la sidebar roba 220px → contenido ilegible.
- Fix `<640`: sidebar → chips horizontales (`SettingsSidebar` con
  `variant="chips"`), contenido full-width.
- En 640–1023: mantener sidebar pero `SIDEBAR_WIDTH`→`w-44` (176px) con
  `max-lg:`.
- Desktop: SIN CAMBIOS.

### 10.2 `SettingsSidebar.tsx`
- Añadir prop `variant: 'rail' | 'chips'` (rail = actual, chips = táctil).

### 10.3 `ManualSolveSheet.tsx` — BUG CONOCIDO
- `w-[380px]` fijos → `w-full max-w-[380px]` + en `<640` full-width sheet.
- Botones método/penalty `py-2`→`py-3` en táctil.

### 10.4 `CubeConnector.tsx` (Smart Cube)
- `DialogContent sm:max-w-md` OK; en móvil asegurar botones BLE ≥44px y
  diálogo con scroll (`max-h-[85vh] overflow-y-auto`).

### 10.5 `theme-toggle.tsx` / resto de primitivas UI
- Revisar `packages/ui` SOLO si hay clases `md:` que rompan <1024
  (toast, dialog, sheet ya revisados: correctos).
- **No tocar `packages/ui` salvo casos probados.**

---

## 11. Orden de implementación

Cada fase es autocontenida, termina validada (§12) y NO toca ≥1024px.

| Fase | Área | Alcance | Archivos clave |
| ---- | ---- | ------- | -------------- |
| **F0** | Fundación | hooks, MobileTabBar, Header, MainLayout, App, safe-areas, theme-color | `use-mobile.ts`, `MobileTabBar.tsx` (nuevo), `Header.tsx`, `MainLayout.tsx`, `App.tsx`, `index.css`, `index.html` |
| **F1** | Timer | TimerContainer, Scramble, SessionStats, ManualTimeInput, PB banner, panel 3D sheet | §4 |
| **F2** | Widgets | TouchPanel, dock→botón, FloatingWidgetWrapper clamp/sheet, TimesPanel, Explorer | §9, `TouchPanel.tsx` (nuevo) |
| **F3** | Settings + sheets | SettingsDialog/Sidebar, ManualSolveSheet, AlgorithmEditorDialog | §10, §6.4 |
| **F4** | Algorithms | PracticeDashboard, MethodTree chips, CaseGrid, detail overlay | §6 |
| **F5** | Training | Dashboard + 12 sub-vistas (TouchPanel asides) | §5 |
| **F6** | Insights | master-detail móvil, SolveListPanel, OverviewPanel | §8 |
| **F7** | Skills | Canvas zoom inicial, nodos, modal, toolbar | §7 |
| **F8** | Pulido | gestos, haptics (`navigator.vibrate` opcional), rendimiento, test final 3 viewports | global |

Orden sugerido de ejecución: **F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8**
(la fundación desbloquea todo; F5 es la más grande y va tras los patrones
reutilizables de F2/F3).

---

## 12. Validación y garantías

Por cada fase, en paralelo:
1. `pnpm typecheck` (o `tsc -b`) — zona afectada y luego global.
2. `pnpm lint` (oxlint/eslint config del repo).
3. `pnpm build` en `apps/web`.
4. **Browser automation** con Chrome en 3 viewports:
   - `1440×900` (desktop — debe verse IDÉNTICO al estado actual)
   - `834×1112` (iPad portrait)
   - `390×844` (iPhone)
   - Chequeos: sin overflow horizontal, sin clipping, targets visibles,
     navegación bottom bar funcional, sin errores de consola.
5. Code review con `code-reviewer-deepseek-flash` tras cada fase.

**Gate de "no rompí desktop":** comparación de screenshot/viewport 1440px
antes/después — cualquier diff visual en ≥1024px = fallo de la fase.

---

## Referencias

- [Review UI previa (notas de auditoría)](../../docs) — hallazgos 1–5
  (rail hover-only en tablet, clamp 3D, sheets fijos, widgets clipeados,
  theme-color).
- [PRD](../00-product/PRD.md)
- [Master Roadmap](../01-roadmap/Master_Roadmap.md)
- [Architecture Index](../02-architecture/Architecture_Index.md)
