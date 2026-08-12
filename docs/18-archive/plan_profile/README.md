# CubeForge — Plan del Dashboard de Perfil (Identity Center)

> **Documento de diseño del perfil de usuario definitivo.**
> Fecha: Agosto 2026
> Estado: **Fases F0–F6 implementadas** (identidad local, sistema CubeMark, componentes de identidad, vista de perfil navegable, bloques de datos reales, edición del perfil y pulido responsive/a11y). Queda F7 (futuro) — no implementar más sin validar, según `docs/14-ai/AGENTS.md`
> Método: investigación de referencias → extracción de patrones → análisis comparativo → layout → arquitectura → bloques → investigación de identicons → sistema propio → plan por fases.

---

## Índice

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Fase 1 — Investigación de referencias](#2-fase-1--investigación-de-referencias)
3. [Fase 2 — Extracción de patrones y conclusiones](#3-fase-2--extracción-de-patrones-y-conclusiones)
4. [Fase 3 — Análisis comparativo](#4-fase-3--análisis-comparativo)
5. [Fase 4 — Definición del layout ideal](#5-fase-4--definición-del-layout-ideal)
6. [Fase 5 — Arquitectura del perfil](#6-fase-5--arquitectura-del-perfil)
7. [Fase 6 — Bloques del dashboard](#7-fase-6--bloques-del-dashboard)
8. [Fase 7 — Investigación específica sobre identicons](#8-fase-7--investigación-específica-sobre-identicons)
9. [Fase 8 — Sistema propio: CubeMark](#9-fase-8--sistema-propio-cubemark)
10. [Fase 9 — Plan de implementación por fases](#10-fase-9--plan-de-implementación-por-fases)
11. [Decisiones abiertas y riesgos](#11-decisiones-abiertas-y-riesgos)
12. [Referencias](#12-referencias)

---

## 1. Objetivo y alcance

### 1.1 Objetivo

Diseñar el **dashboard de perfil definitivo** de CubeForge: el *centro de identidad del usuario* dentro de la plataforma. No es un perfil tipo red social; es un centro de identidad profesional que conecta la identidad personal con los datos reales de progreso (timer, análisis, entrenamiento, algoritmos, skills).

Sensación objetivo: **limpio, minimalista, profesional, moderno, muy organizado, extremadamente consistente** — en la familia visual de Stripe/Linear/Notion (productividad profesional), no en la familia neón-gaming, con la jerarquía clara de las plataformas competitivas (identidad → rendimiento → detalle) aprendida de Valorant/LoL/Destiny 2.

### 1.2 Restricciones (no negociables)

1. **Solo recursos del Design System existente**: tokens (`canvas`, `surface`, `surface-2`, `ink`, `ink-2`, `ink-3`, `line`, `line-2`, semánticos `ready/hold/dnf/plus2/caution` + `*-soft`, paleta fase, radius, fuentes sans/mono, clase `.nums`) y componentes de `packages/ui` + atoms existentes.
2. **Prohibido introducir un nuevo lenguaje visual**: sin gradientes decorativos, sin sombras pesadas, sin bordes gruesos, sin paneles decorativos.
3. **Datos reales conectados a la base de datos**: cada bloque muestra información computada de las tablas existentes (`solves`, `sessions`, `algorithm_progress`, `training_attempts`, `skill_progress`, `training_sessions`). Los datos ficticios solo aparecen como ejemplo estructural de empty state.
4. **No copiar interfaces**: extraer únicamente principios.
5. **No implementar código** hasta validar este plan y aprobar el TDD correspondiente (pipeline de `AGENTS.md`).

### 1.3 Fuera de alcance (diseñado para crecer, no implementado ahora)

- Logros/Badges y streaks explícitos (P2 de la auditoría): se reservan espacios de bloque.
- Sync multi-dispositivo / cuenta con email (P0 siguiente): el esquema de datos se diseña *forward-compatible* (`userId` como clave foránea preparada).
- Comparación con comunidad (P2).

### 1.4 Posicionamiento en el roadmap

La [Auditoría de Producto 2026-08](../00-product/Auditoria_Producto_2026-08.md) confirma: *"Perfil de usuario ❌ No existe"* y lo cataloga como **P0**, primera pieza del roadmap de finalización (*"Perfil/identidad → Sync → Onboarding → …"*). Este plan es la especificación de diseño de esa pieza.

---

## 2. Fase 1 — Investigación de referencias

Investigación realizada sobre patrones de diseño de perfiles/dashboards en 4 sectores. No se copia ninguna interfaz; se extraen principios de composición, jerarquía, densidad, distribución, agrupación, zonas de foco y flujo visual.

### 2.1 Plataformas para desarrolladores

| Referencia | Patrones observados |
|---|---|
| **GitHub** | Columna de identidad angosta (25–30%) + lienzo ancho (70–75%); avatar arriba-izquierda como ancla; nombre (negrita) sobre @handle (secundario); píldoras de metadata con micro-iconos; tabs segmentados horizontales (Overview/Repositories/…) con badge numérico; "pinned" como curaduría; tabla como fuente de verdad. |
| **GitLab / Codeberg** | Misma geometría asimétrica; uso de badges de estado; énfasis en actividad y contribuciones; silencio visual alto. |
| **Figma** | Header compacto de identidad + 90% del espacio dedicado a la cuadrícula de proyectos; metadata personal comprimida. |

### 2.2 Herramientas de diseño y SaaS

| Referencia | Patrones observados |
|---|---|
| **Linear** | Densidad alta y precisa (filas 36–40px), cero cromo decorativo, jerarquía por peso tipográfico y elevación de luminancia (2–4%) en vez de bordes, skeleton loaders, keyboard-first. |
| **Stripe Dashboard** | Regla de **4–6 KPIs máximo** sobre el fold; una métrica primaria + sparkline + delta; tablas tabulares densas como interfaz principal; color solo semántico. |
| **Vercel / Supabase** | Sidebar fija 240–280px + grid 12 columnas; cuadrículas con `minmax(auto-fill)`; progressive disclosure (detalles tras tabs/drawers); dark-first con tokens semánticos. |
| **Notion / Framer** | Espacio negativo deliberado; bloques modulares con función clara; consistencia de coordenadas entre cards. |

### 2.3 Plataformas gaming

| Referencia | Patrones observados |
|---|---|
| **Steam** | Identidad como lienzo (showcase curado); nivel de cuenta con anillo de progreso; actividad reciente. |
| **Valorant / Riot** | Jerarquía **identidad → rank → detalle**: crest de rango + barra de progreso (RR) como foco central; stats densas (K/D, HS%, winrate) en sub-tabs; match history secundario. |
| **League of Legends** | Crest de tier + barra LP; mastery con anillos; estadísticas macro + contexto por campeón. |
| **Destiny 2** | Foco en poder + emblema/título (identidad lograda); triumphs como checklist de logros. |
| **Warframe / PoE / Diablo IV** | Progresión no lineal (árboles/nodos) visualizada como expansión espacial; mastery rank como prestigio. |
| **Discord / Xbox / PS / Epic** | Banner + avatar + decoraciones; perfiles curados por el usuario; rich presence. |

**Lección transversal gaming:** el ojo va de *¿quién es?* (identidad) → *¿cómo de bueno es?* (rendimiento/progreso) → *¿cómo juega?* (detalle). Nunca mezclar esas tres capas.

### 2.4 Dashboards modernos minimalistas (2023–2026)

- **Whitespace como herramienta de jerarquía**: no es vacío, es peso visual. Padding de cards 16–24px.
- **Ley de Miller**: chunks de 5–7 elementos; un card con más de 3 flujos de datos sin sub-agrupar viola la heurística.
- **Anatomía de stat card**: label contextual (arriba, muted) → valor primario grande → delta/trend → micro-chart opcional.
- **Skeletons sobre spinners** (reducen CLS y priming).
- **Patrones F/Z**: métricas críticas en el cuadrante superior-izquierdo.
- **Tabs (≤6) para comparar categorías; secciones apiladas para narrativa cronológica** (p.ej. ajustes).
- **A11y**: contraste AA/AAA (ink-3 ya está calibrado a 4.5:1), focus rings visibles, no depender del color solo.
- **Acciones**: primarias sólidas; secundarias ghost; destructivas nunca huérfanas.

---

## 3. Fase 2 — Extracción de patrones y conclusiones

### 3.1 Elementos recurrentes (presentes en la mayoría de referencias)

1. **Zona de identidad anclada** (avatar + nombre + handle + metadata + acciones) siempre en la parte superior.
2. **Tira de KPIs de 4–6 métricas** con valores en cifras tabulares (`tabular-nums`).
3. **Tabs segmentados horizontales** con badge numérico para contenido multi-categoría.
4. **Cuadrículas auto-fill** de tarjetas modulares con la misma anatomía (título/valor/delta).
5. **Progressive disclosure**: resumen arriba, detalle en capas secundarias.
6. **Skeletons** para carga; **empty states** como onboarding (ilustración + frase + CTA).
7. **Color reservado a significado** (estados, no decoración).
8. **Tablas densas tabulares** como interfaz primaria cuando hay listas (no murales de gráficos).
9. **Curaduría/flex**: el usuario decide qué destaca (pinned, showcase).
10. **Progreso tangible**: barras/anillos para metas (mastery, XP, streak).

### 3.2 Qué conclusiones aplican a CubeForge

- **Familia visual**: flat, pálido, utilitario (los tokens actuales) = familia Stripe/Linear/Notion. El perfil debe parecer *parte del producto*, no una landing.
- **La jerarquía gaming** (identidad → rendimiento → detalle) encaja perfectamente con speedcubing: identidad → PBs/media → análisis/entrenamiento.
- **La regla de 4–6 KPIs** evita el "data mural" (el error nº1 de dashboards).
- **El mono `.nums`** ya implementado es el activo clave para leer tiempos a simple vista.
- **Reutilizar atoms existentes** (MetricTile, MetricRing, Sparkline, ActivityHeatmap, AnimatedNumber, EmptyState, SectionHeader) garantiza consistencia con cero trabajo visual nuevo.

---

## 4. Fase 3 — Análisis comparativo

### 4.1 Qué funciona (lo adoptamos)

| Patrón | Por qué | Decisión CubeForge |
|---|---|---|
| Identidad anclada arriba-izquierda | Reconocimiento instantáneo "estoy en mi espacio" | Hero compacto con avatar a la izquierda |
| 4–6 KPIs sobre el fold | Escaneo en segundos, sin ruido | Stat strip de 5 métricas |
| Tabs con badges | Contexto sin scroll infinito | 5 tabs (Overview/Stats/Training/Algorithms/Skills) |
| Tablas tabulares | Verdad de los datos | Stats por puzzle en tabla + TrendChart |
| Skeletons + empty states | Percepción de velocidad y guía | Sistema de estados por bloque |
| Progreso tangible (anillos/barras) | Sensación de avance | Mastery rings, barras de subsets, XP |

### 4.2 Qué envejece peor (lo evitamos)

- **Murales de KPIs** (15+ cards): se ignoran y no escalan → descartado (regla 4–6).
- **Cover/banner gigante**: moda gaming que no encaja en UI utilitaria y complica el responsive → **descartado**; el hero es una banda de superficie con borde, no un banner.
- **Gradientes y sombras decorativas**: rompen los tokens → prohibido.
- **Scroll infinito sin navegación**: pierde contexto → tabs.
- **Gris sobre gris de bajo contraste**: inaccesible → usar ink-3 calibrado (ya 4.5:1).

### 4.3 Qué genera sensación premium

- Silencio visual + tipografía disciplinada (jerarquía por peso, no por decoración).
- Cifras tabulares alineadas y etiquetas en mayúscula tracking ancha.
- Micro-interacciones contenidas (hover, transiciones 150–200ms) — ya presentes en el sistema.
- Consistencia total de coordenadas: mismo padding, mismo radius, mismos componentes.

### 4.4 Errores repetidos que generan ruido

1. "Data mural": demasiados KPIs → ignorados.
2. Over-decoration: sombras/bordes pesados para crear profundidad.
3. Acciones huérfanas: editar perfil escondido a 4 niveles de profundidad.
4. Formatos inconsistentes (fechas mezcladas, fuentes mezcladas).
5. Aislamiento de datos: bloques que no enlazan con el resto de la app (cada bloque del perfil debe navegar a su vista real).

---

## 5. Fase 4 — Definición del layout ideal

### 5.1 Principios de layout

1. **Una sola columna maestra centrada** (max-w ≈ 1100–1200px) dentro del stage, con scroll vertical — coherente con la vista Insights.
2. **Tres zonas verticales en orden de jerarquía**: Hero (identidad) → Stat strip (rendimiento) → Tabs (detalle).
3. **Composición asimétrica solo donde aporta**: hero con avatar a la izquierda y acciones a la derecha; el resto en cuadrículas auto-fill.
4. **Densidad media-baja**: padding de cards 16–20px (tokens existentes), filas 36–40px en tablas.
5. **Respiración** entre zonas: gaps de 16–24px; separador solo donde hay cambio de contexto.
6. **Color semántico únicamente**: `ready` para PBs, `caution`/`plus2` para pendientes SRS, `dnf` solo estados de error; el resto en la escala ink.
7. **Responsive**: breakpoint táctil <1024px (convención del repo) → columna única, stat strip 2×2, hero condensado, tabs scrollables.

### 5.2 Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│  Perfil                                    (breadcrumb/heading)  │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ┌─────┐  Nombre visible                     [Editar]       │ │
│  │  │ 112 │  @handle · Miembro desde · 3×3 · CFOP             │ │
│  │  └─────┘  Bio (1–2 líneas, opcional, ink-2)                │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────┬────────────┬────────────┬────────────┬────────┐ │
│  │ PB single  │    Ao5     │   Ao12     │   Solves   │ Racha  │ │
│  │   6.71     │   8.04     │   8.52     │   4 213    │  12d   │ │
│  └────────────┴────────────┴────────────┴────────────┴────────┘ │
│  [Overview] [Stats] [Training] [Algorithms] [Skills]            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Actividad (heatmap año)           │  Progresión de PBs    │ │
│  │  Balance de fases (mini)           │  Últimos solves       │ │
│  │  Acciones rápidas                  │  (TimesList compact)  │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Wireframe — Táctil (<1024px)

```
┌──────────────────────────────────┐
│  Perfil                          │
├──────────────────────────────────┤
│  ┌────────────┐  Nombre         │
│  │  avatar 80 │  @handle        │
│  │            │  CFOP · 3×3     │
│  └────────────┘  [Editar]       │
├──────────────────────────────────┤
│  ┌─────────┬─────────┐          │
│  │ PB 6.71 │ Ao5     │          │
│  ├─────────┼─────────┤          │
│  │ Ao12    │ Solves  │          │
│  ├─────────┴─────────┤          │
│  │ Racha 12d         │          │
│  └───────────────────┘          │
│  ← Overview · Stats · Training · Algorithms · Skills → (scroll) │
│  (bloques apilados en columna)  │
└──────────────────────────────────┘
```

---

## 6. Fase 5 — Arquitectura del perfil

### 6.1 Información recogida y su fuente (datos reales)

| Dato del perfil | Fuente (tabla / store) | Muestra en |
|---|---|---|
| Nombre, @handle, bio, avatar | `profiles` (nueva migración 019) | Hero |
| Métodos declarados, puzzle principal | `profiles` | Hero + chips |
| Miembro desde | `profiles.created_at` | Hero |
| PBs (single/Ao5/Ao12 por puzzle) | `solves` + `statistics` (computeStats ya existente) | Stat strip + Stats |
| Total de solves | `solves` | Stat strip + Stats |
| Racha de días | `solves` (calendario de actividad) | Stat strip |
| Mastery global / por método | `algorithm_progress`, `training_attempts` | Training |
| Cola SRS (overdue/due/new) | `algorithm_progress.srs_*` (useSRSQueue ya existe) | Training |
| Dominados por subset | `algorithm_progress` + catálogo | Algorithms |
| XP y nodos del skill tree | `skill_progress` (useSkillProgress) | Skills |
| Actividad / heatmap / tendencias | `solves.date` (ActivityHeatmap ya existe) | Overview |
| Balance de fases vs benchmarks | `solves.analysis` (widget phase-balance ya existe) | Overview |

### 6.2 Navegación

1. **Nueva `ViewId`**: `"profile"` en `apps/web/src/components/Layout/sidebar.constants.ts`.
2. **Sidebar**: nuevo item **"Profile"** (icono `User`/`IdCard` de lucide) en el grupo **Main** (junto a Timer) — la identidad es un espacio principal, no un ajuste.
3. **Header**: nuevo **avatar-chip** (24px) a la derecha del header que navega a `profile` — acceso ubicuo tipo "tu espacio".
4. **Táctil**: entrada en `MobileTabBar`/`MobileMoreSheet` siguiendo el patrón existente.
5. **Cross-links desde el perfil** (progressive disclosure inverso): cada bloque navega a su vista real (Timer, Stats, Training, Algorithms, Skills, Settings).

### 6.3 Modelo de datos

**Decisión D1 (ver §11): identidad local anónima ahora, schema forward-compatible.**

- **Migración 019 — `profiles`**:
  ```sql
  CREATE TABLE IF NOT EXISTS profiles (
    user_id       TEXT PRIMARY KEY,          -- ID anónimo local (crypto.randomUUID).
                                            -- Desviación deliberada de la convención
                                            -- `id` PK: la identidad es la clave raíz
                                            -- del sync futuro (coherente con D1).
    display_name  TEXT NOT NULL DEFAULT '',
    handle        TEXT NOT NULL DEFAULT '',
    bio           TEXT NOT NULL DEFAULT '',
    avatar_kind   TEXT NOT NULL DEFAULT 'identicon',  -- 'identicon' | 'photo'
    avatar_data   TEXT,                      -- Blob base64 solo si avatar_kind='photo'
    main_puzzle   TEXT NOT NULL DEFAULT '3x3x3',
    declared_methods TEXT NOT NULL DEFAULT '[]',  -- JSON array (CFOP, Roux, ZZ…)
    created_at    INTEGER NOT NULL DEFAULT 0,
    updated_at    INTEGER NOT NULL DEFAULT 0
  );
  ```
- **Migración 020 — `app_meta`** (clave-valor):
  ```sql
  CREATE TABLE IF NOT EXISTS app_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  -- key: 'user_id' → ID anónimo generado una sola vez en el primer arranque
  ```
- **Seed del identicon = `user_id` estable** (nunca el display name: renombrar no debe cambiar el avatar — lección de GitHub).
- **Patrón de acceso**: `profiles.repository.ts` en `packages/database` + hook `useProfile` en `apps/web/src/hooks` + store UI `profile.store.ts` en `packages/state` (mismo patrón que `usePersistentSession`).
- **Tipos**: `ProfileSchema` (zod) en `packages/models` + re-export en `packages/types`.

### 6.4 Estados de la vista

| Estado | Comportamiento |
|---|---|
| Carga | Skeletons (`ui/skeleton`) replicando la geometría de cada bloque |
| Datos vacíos | `EmptyState` (atomo existente) por bloque con CTA real (p.ej. "Haz tu primer solve" → Timer) |
| Datos listos | Render completo; los ceros se muestran como `–` (nunca 0.00) |
| Error | Estado mínimo con retry (toast + botón) |

---

## 7. Fase 6 — Bloques del dashboard

> Regla: **cada bloque tiene una función clara y datos reales**. No hay paneles decorativos. Todos reutilizan componentes de `packages/ui` y atoms existentes.

### B1 — Hero / Zona de identidad

- **Función**: responder "¿quién soy y en qué espacio estoy?" (lección GitHub/gaming).
- **Composición**: avatar 112px (desktop) / 80px (táctil) a la izquierda; a la derecha: nombre (text-lg/xl, `ink`, semibold), línea de identidad (`@handle · Miembro desde · 3×3 · CFOP`) en `ink-3` con separadores `·`, bio opcional en `ink-2`; acciones alineadas a la derecha: **Edit profile** (primaria, abre Settings→Profile) y menú `...` (DropdownMenu) con Exportar datos y Ver Stats.
- **Componentes**: `Avatar` (o `IdenticonAvatar` de Fase 8), `Button`, `DropdownMenu`, `Badge`/chips con `Separator`.
- **Tokens**: `surface` + `border-line` + radius-xl; sin sombra pesada.
- **Extensible**: chips de hardware conectado (`hardware-hal`: GAN/StackMat) cuando exista UI de conexión; badge de verificación WCA en el futuro.

### B2 — Stat strip (KPIs)

- **Función**: respuesta inmediata a "¿cómo voy?" (regla 4–6 KPIs).
- **Métricas (5, todas con datos reales, filtradas al puzzle principal 3×3 por defecto con toggle 2×2/3×3)**:
  1. **PB single** — acento `ready`, con delta opcional "mejorado esta semana" (computable por timestamps).
  2. **Ao5** · 3. **Ao12** · 4. **Solves totales** · 5. **Racha (días)**.
- **Anatomía por tile**: label `ink-3` uppercase tracking (estilo SessionStats), valor `nums` grande `ink`, delta opcional `AnimatedNumber`.
- **Componentes**: `MetricTile` (atomo existente), `AnimatedNumber`, `Tooltip` con detalle (p.ej. "Ao5 — últimos 5 solves válidos").
- **Responsive**: grid 5 columnas → 2×2 + 1 en táctil.

### B3 — Tabs (navegación de contenido)

- **Función**: separar categorías de contenido denso (máx. 5, regla de las referencias).
- **Componentes**: `Tabs` de `packages/ui` con badge numérico (p.ej. "Training (12)").
- **Tabs**: Overview · Stats · Training · Algorithms · Skills.

### B3.1 — Overview

| Bloque | Datos | Componentes |
|---|---|---|
| Actividad anual | `solves.date` | `ActivityHeatmap` (ya existe) |
| Progresión de PBs | PB por fecha | `Sparkline`/`SolveProgressionChart` (datos del widget pb-progression) |
| Balance de fases | `solves.analysis` vs benchmarks | barras horizontales (datos del widget phase-balance) |
| Últimos solves | últimos 5 solves | `TimesList` compacto (ya existe) |
| Acciones rápidas | navegación real | Botones: "Nuevo solve"→Timer, "Practicar más débil"→Training, "Revisar cola SRS"→Training, "Ver skills"→Skills |

### B3.2 — Stats

- **Función**: verdad numérica por puzzle (tablas tabulares, lección Stripe).
- **Contenido**: selector de puzzle (2×2/3×3) → tabla (puzzle, PBs single/Ao5/Ao12, media, count, source manual/smart) + `TrendChart` + histograma de distribución + desglose session×puzzle.
- **Componentes**: `Table` (ui), `TrendChart`, `MetricRing` para % smart vs manual, `formatTime`/`computeStats` existentes.

### B3.3 — Training

- **Función**: progreso de entrenamiento con datos SRS reales (la joya del producto).
- **Contenido**: mastery global (anillo) y por método (CFOP/Roux/ZZ/Petrus/Ortega…); **cola SRS**: Overdue/Due/Weak/New (useSRSQueue ya existe) con CTA "Revisar ahora"; peores algoritmos (top-5 por mastery); total de intentos y sesiones (`training_attempts`, `training_sessions`).
- **Componentes**: `Progress` (ui), `MetricRing`, `Badge` (caution para overdue), `EmptyState` + CTA → Training.
- **Extensible**: bloque de Logros/Badges (P2) se inserta aquí sin romper layout.

### B3.4 — Algorithms

- **Función**: dominio del catálogo de algoritmos.
- **Contenido**: grid de subsets (OLL/PLL/F2L/CMLL/…) con barra dominados/aprendiendo/nuevos (datos de `algorithm_progress` + catálogo `algorithm_cases`); contador global "42/78 dominados"; CTA "Practice This"→Algorithms.
- **Componentes**: `Progress`, `Badge`, grid con `Card` auto-fill (`minmax`), `SectionHeader`.

### B3.5 — Skills

- **Función**: progreso del skill tree (XP y nodos).
- **Contenido**: XP total, % de completado, progreso por categoría (fundamentals, cross, F2L, LL, lookahead…), nodos completados recientemente; CTA → Skills.
- **Componentes**: `Progress`, `MetricRing`, `Card`, `useSkillProgress` existente.

### B4 — Sistema de estados (transversal)

- Skeleton por bloque (geometría idéntica al contenido final).
- `EmptyState` por tab cuando no hay datos (estructura de ejemplo, nunca datos ficticios persistentes).
- Micro-interacciones: hover en cards/tiles (transición 150–200ms, patrón existente), foco visible (ring token).

---

## 8. Fase 7 — Investigación específica sobre identicons

### 8.1 Historia y propósito

- **Identicon**: representación visual de un hash (IP, email, user ID) → "huella visual". Inventado por **Don Park (2007)** como diferenciación visual sin exponer datos privados; popularizado por el artículo *"Identicons as Visual Fingerprints"* (Phil Haack) en blogs de .NET como avatares de comentarios.
- **Propósitos**: reconocimiento cognitivo (el cerebro procesa forma+color mucho más rápido que strings), privacidad (no revela el input), anti-suplantación.

### 8.2 Algoritmos y sistemas analizados

| Sistema | Algoritmo | Formato | Ventajas | Desventajas |
|---|---|---|---|---|
| **Don Park clásico** | MD5 → grid 3×3, espejo vertical (5–6 celdas de decisión según implementación), color desde bytes del hash | PNG/Canvas | Muy ligero, fundacional, rápido | Baja entropía (32–64 formas × color), aspecto "píxel crudo" |
| **GitHub** | Hash del user ID → grid 5×5 simétrico (15 celdas) + hue determinista | SVG/PNG | Limpio, reconocible, escalable | Estética única limitada |
| **Jdenticon** | PRNG desde hash → geometría multi-capa (polígonos, círculos, gradientes) | SVG/Canvas | Muy pulido, alta diferenciación | Abstracto, complejo |
| **DiceBear** | Seed string → ensamblaje modular de estilos (50+) | SVG, data-URI | Variedad masiva, consistente cross-lenguaje | Payload mayor; estilos ilustrados chocan con UI utilitaria |
| **RoboHash** | SHA → ensamblaje de componentes (robots/monstruos) | PNG/JPG | Emotivo, memorable | Raster pesado, no minimalista |

### 8.3 Principios técnicos (lo que importa)

1. **Hash con efecto avalancha**: un bit distinto en el input → salida completamente distinta (máxima diferenciación entre usuarios).
2. **Simetría = ancla perceptual**: el cerebro reconoce patrones simétricos más rápido (Gestalt); el espejo vertical convierte ruido en *glifo* memorable.
3. **Color en HSL acotado**: fijar S ∈ [65–85%] y L ∈ [45–65%] garantiza contraste y armonía; variar hue da distancia perceptiva. RGB aleatorio = paletas feas.
4. **Determinismo**: misma entrada → misma salida, en cualquier plataforma (el seed debe ser estable: **ID del usuario, no su nombre**).
5. **Formatos**: **SVG** (infinitamente escalable, ultraligero, data-URI) > Canvas > PNG. El render SVG inline permite además **usar CSS vars del tema** (theme-aware).
6. **Legibilidad a 24px**: pocas celdas grandes y bien separadas ganan a mucha densidad.

---

## 9. Fase 8 — Sistema propio: CubeMark

> **Concepto**: un identicon de la familia "marca del cubo" — *designed*, no aleatorio. Inspirado en los *principios técnicos* de los sistemas estudiados (hash + simetría + HSL), con identidad visual propia de CubeForge: celdas con radius del design system, ancla central siempre presente, y paleta derivada del hue hash con acento secundario.

### 9.1 Principios de diseño

1. **Determinista** desde un seed estable (`user_id`).
2. **Simétrico** (espejo vertical) → glifo reconocible, nunca ruido.
3. **Anclado**: la celda central está **siempre activa** → el ojo tiene un punto de partida fijo (evita el "patrón flotante").
4. **Con silueta conectada**: las celdas se priorizan alrededor del ancla (adyacentes) → formas compactas tipo emblema, no motas dispersas.
5. **On-brand**: celdas con `rx` proporcional al radius del sistema, gap uniforme, tile neutro (tema-aware vía tokens CSS), glifo en hue del usuario con S/L fijos.
6. **Legible a 24px** y **escalable a 512px** (SVG).
7. **Accesible**: contraste glifo↔fondo ≥ 3:1 en ambos temas; nunca color como única señal (la forma también distingue).

### 9.2 Especificación del algoritmo

```
1. SEED   = user_id (estable)                    [siempre el ID, nunca el display name]
2. HASH   = FNV-1a multi-salt de 32 bytes (`hashSeed`): 8 slots con salts
            distintos, 100% sincrono y sin dependencias. Adoptado sobre
            SHA-256 async: el identicon no requiere criptografía, solo
            distribución uniforme con efecto avalancha (misma familia que
            GitHub/DiceBear)
3. PRNG   = mulberry32(primeros 4 bytes del hash) → secuencia determinista
4. GRID   = 5×5 con espejo vertical → 15 celdas de decisión (c0=c4, c1=c3, c2 centro)
            + celda central SIEMPRE activa (ancla). Glifo de CELDAS PURAS —
            sin marcos ni overlays: todo CubeMark son cuadrados
5. SELECCIÓN DE CELDAS = regla de conectividad: bit activo con peso extra si es
            adyacente al ancla; ratio de relleno forzado 35–65% (re-roll local del PRNG)
6. COLOR  = hue = bits altos del hash (cuantizado en 24 pasos de 15° → paletas
            no adyacentes entre usuarios); S=72%, L=58% (glifo)
            acento secundario = hue+30° para la celda ancla (profundidad sutil)
7. RENDER = SVG inline, viewBox 0 0 64 64; celdas rx=6, gap=1.5;
            tile: transparente o `--surface-2` (CSS var → tema-aware);
            glifo: color fijo derivado del hue (garantiza contraste en ambos temas)
8. SALIDA = string SVG (data-URI utilizable en <img>/AvatarImage) o SVG inline
```

**API propuesta** (headless, testable):

```typescript
// packages/identicon/src/index.ts
interface CubeMarkSpec {
  cells: boolean[];         // 25 celdas, rejilla espejada ya aplicada
  hue: number;              // 0–345 (pasos de 15°)
}

generateCubeMarkSpec(seed: string): CubeMarkSpec;           // síncrono y determinista
renderCubeMark(spec: CubeMarkSpec, options?: { tile?: 'transparent' | 'surface-2' }): string;
```

**Componente React** (`IdenticonAvatar`) envuelve el `Avatar` de `packages/ui`: si `avatarKind='photo'` → `AvatarImage`; si `'identicon'` → `AvatarImage` con data-URI SVG (o SVG inline). Uso: header 24px, hero 112px, Settings 96px, export 512px (via canvas si se requiere PNG).

### 9.3 Garantías (con tests)

| Garantía | Test |
|---|---|
| Determinismo | mismo seed → mismo spec, 1000 iteraciones |
| Simetría | grid espejado c0=c4, c1=c3 |
| Unicidad | 500 seeds → 0 colisiones de (cells+hue) con probabilidad hash |
| Contraste | luminancia glifo vs surface ≥ 3:1 en light y dark |
| Legibilidad | ratio de relleno 35–65% siempre |
| Rendimiento | `generate+render < 1ms` (cache) |

### 9.4 Sustitución por foto

- En el primer arranque (al generar el ID anónimo de D1): `avatarKind='identicon'` por defecto.
- Settings→Profile: botón "Subir foto" (blob → `profiles.avatar_data`) o "Mantener identicon" / "Restablecer identicon".
- El CubeMark nunca se borra: la foto se puede quitar y vuelve el identicon (identidad de la plataforma).

---

## 10. Fase 9 — Plan de implementación por fases

> Pre-requisito (AGENTS.md): **TDD** nuevo (`docs/05-tdd/core/…`) y, si se confirma la arquitectura del identicon, **ADR** de decisión. Nada de código sin TDD aprobado. Cada fase incluye typecheck (`pnpm typecheck`) + tests (`vitest`) + lint.

> **Nota de numeración**: las fases de implementación de esta sección (F0–F7) usan numeración propia, **independiente** de las fases de diseño del documento (1–9).

### Fase F0 — Identidad local (base, P0) ✅ implementada (Agosto 2026)

| Tarea | Detalle | Estado |
|---|---|---|
| Migraciones 019 (`profiles`) y 020 (`app_meta`) | SQL en `packages/database/src/migrations/migrations.ts` | ✅ |
| Eliminar `kv_store` legacy | `packages/database/src/worker.ts` (se retira el CREATE) + migración 021 `DROP TABLE IF EXISTS kv_store` para limpiar BDs OPFS de dev | ✅ |
| `profiles.repository.ts` + `app-meta.repository.ts` | Patrón repositorio existente; `getOrCreateUserId` race-safe (INSERT OR IGNORE + re-read) | ✅ |
| `ProfileSchema` (zod) en `packages/models` | Exportado como `Profile` | ✅ |
| Hook `useProfile` en `apps/web/src/hooks` | Cableado en `App.tsx`; asegura identidad en el primer arranque. `profile.store.ts` (packages/state) se difiere a F2 (edición desde UI) | ✅ |
| Generación de `user_id` anónimo en primer arranque | `crypto.randomUUID()` (con fallback v4) persistido en `app_meta` | ✅ |
| Tests | `profile.repository.test.ts` (semántica de primer arranque) + migraciones 019/020 en `migrations.test.ts` | ✅ |

### Fase F1 — Paquete headless `packages/identicon` ✅ implementada (Agosto 2026)

| Tarea | Detalle | Estado |
|---|---|---|
| `generateCubeMarkSpec` + `renderCubeMark` | Algoritmo §9.2 puro, síncrono, sin React | ✅ |
| Tests de garantías (§9.3) | vitest: determinismo, simetría, ancla, fill-ratio, unicidad (con presupuesto de colisiones por paridad), contraste 24 hues, rendimiento | ✅ |
| Benchmark de rendimiento | <1ms por spec+render (test automatizado) | ✅ |
| Tipos `CubeMarkSpec`/`CubeMarkRenderOptions` | Viven en el propio paquete (headless) | ✅ |
| Hash determinista | FNV-1a multi-salt (32 bytes), síncrono — ver §9.2 paso 2 | ✅ |

### Fase F2 — Componentes de identidad (UI) ✅ parcialmente implementada (Agosto 2026)

| Tarea | Detalle | Estado |
|---|---|---|
| `IdenticonAvatar` | SVG **inline** tema-aware (`var(--surface-2)`), memoizado; tamaños 20/80/112 | ✅ |
| `ProfileHero` (B1) | Avatar + nombre + handle + chips (miembro desde, puzzle, métodos) + bio + skeleton | ✅ |
| `StatStrip` (B2) | 5 tiles con `MetricTile`/`AnimatedNumber`/`Tooltip` | ⏳ F4 |
| `ProfileTabs` (B3) | `Tabs` de ui + badges | ⏳ F4 |
| `BlockHeader`/estados | skeleton + `EmptyState` por bloque | ⏳ F4 |

### Fase F3 — Vista Profile + navegación ✅ implementada (Agosto 2026)

| Tarea | Detalle | Estado |
|---|---|---|
| `ViewId = "profile"` + item en sidebar (grupo Main) | `sidebar.constants.ts`, `LeftSidebar` (data-driven) | ✅ |
| Avatar-chip en `Header` → navega a profile | `IdenticonAvatar` 20px, prop `onOpenProfile`/`profileSeed` | ✅ |
| Entrada táctil (`MobileMoreSheet`) | Card "Profile" en el grid de opciones | ✅ |
| `views/Profile/ProfileView.tsx` | Hero (B1) + quick actions reales (navegan a vistas existentes); skeleton/estados | ✅ |
| Tauri (desktop) | `database-override.ts` re-exporta `AppMetaRepository`/`ProfilesRepository`/`Profile` (alias `@cubeforge/database`) | ✅ |

### Fase F4 — Bloques de datos (Overview/Stats/Training/Algorithms/Skills) ✅ implementada (Agosto 2026)

| Tarea | Detalle | Estado |
|---|---|---|
| Hook `useProfileStats` | Agrega TODOS los solves no-demo de todas las sesiones; `computeStats` (estadística compartida) por puzzle; heatmap 365 días; racha (convención "no rota hasta un día completo sin actividad"); helpers puros exportados | ✅ |
| `StatStrip` (B2) | 5 KPIs reales del puzzle principal (PB single, Ao5, Ao12, Mean, Racha) con `MetricTile` + skeletons | ✅ |
| Tabs (B3) | `Tabs` de `@cubeforge/ui` con 5 triggers (Overview/Stats/Training/Algorithms/Skills) | ✅ |
| Overview | `ActivityHeatmap` (52 semanas) + últimos 5 solves (best resaltado `ready`) + empty states accionables | ✅ |
| Stats | tabla tabular por puzzle (PB/Ao5/Ao12/count) con `nums`; `TrendChart`/distribución se difieren a F6 | ✅ (núcleo) |
| Training | cola SRS real (`useSRSQueue`): Overdue / Due-weak / New con conteos y orientación accionable | ✅ |
| Algorithms | `getSRSInsights` real: mastery medio (anillo), reviewed/total, estados Mastered/Learning/New | ✅ |
| Skills | XP total + % (anillo) + barras por categoría (`ALL_SKILL_NODES` + `useSkillProgress`) | ✅ |
| Tests | `useProfileStats.test.ts` (12 tests: normalización puzzle, racha, heatmap, agregación, DNFs) — corren desde la raíz (`npx vitest run`) | ✅ |

### Fase F5 — Edición del perfil ✅ implementada (Agosto 2026)

| Tarea | Detalle | Estado |
|---|---|---|
| Sección "Profile" en Settings | `ProfileSection.tsx`: nombre, @handle (con `@` prefijo), bio (contador 280), puzzle principal (2×2/3×3 pills), métodos declarados (chips toggle desde `METHODS` del catálogo) | ✅ |
| Botón "Edit profile" | `ProfileHero` gana `onEdit` → abre Settings en la sección profile vía `initialSection` (App → LeftSidebar → SettingsDialog) | ✅ |
| Avatar editor | subir foto (fuente ≤10 MB, redimensionada y comprimida en cliente a ≤512px vía canvas → WebP/JPEG/PNG, `processAvatarImage`; fallback al original solo si es pequeño), cambiar foto, restablecer identicon (el CubeMark nunca se borra, D5) | ✅ |
| Validación | `HANDLE_RE` (3–20 chars lowercase/alnum/-/_), bio ≤280, mismo espíritu que `ProfileSchema` | ✅ |
| Export del perfil | botón "Export profile (JSON)" con `downloadFile` (payload completo de `profiles`) | ✅ |
| Feedback | toast de éxito/error, estado saving con spinner, preview del avatar en el propio editor | ✅ |

### Fase F6 — Responsive, a11y y pulido ✅ implementada (Agosto 2026)

| Tarea | Detalle | Estado |
|---|---|---|
| <1024px (táctil) | StatStrip 2×2+1 (`lg:grid-cols-5` — ahora alineado al breakpoint táctil real de 1024px, no 640px); hero condensado (avatar 80px, `items-start`, edit en header row); tabs scrollables (`overflow-x-auto`) | ✅ |
| A11y | `aria-label` en TabsList y secciones; focus-visible rings consistentes (`ring-ink/40`) en tabs, quick actions y botón Edit; iconos decorativos `aria-hidden`; `aria-pressed` en chips de métodos; labels asociadas con `htmlFor` en el editor | ✅ |
| Micro-interacciones | transiciones 150ms consistentes en botones/chips; `active:scale-[0.98]` en quick actions; `hover:shadow-sm` en cards de Settings | ✅ |
| Hero con foto | `ProfileHero` renderiza `avatarKind='photo'` con `<img>` (object-cover) cuando existe | ✅ |
| Container queries | diferidas (opcional) — la cuadrícula 2×2+1 ya cubre la necesidad actual | ⏳ opcional |

### Fase F7 — Preparación para el futuro (no implementar ahora)

| Tarea | Detalle |
|---|---|
| Sync/Account | `user_id` ya es la clave; migrar a cuenta email = capa opcional (recomendación auditoría) |
| Logros/Badges (P2) | espacios reservados en Training tab y hero (chips) |
| Comunidad/Comparación (P2) | hooks de agregación ya aislados → reutilizables |

**Estimación total**: 6–9 semanas (F0–F6), siguiendo el ritmo del plan_training. Las fases F0–F1 son la base: todo lo demás depende de la identidad local y del sistema CubeMark. **F0–F6 completadas (Agosto 2026).**

---

## 11. Decisiones abiertas y riesgos

### Decisiones

| ID | Decisión | Recomendación | Justificación |
|---|---|---|---|
| **D1** | Modelo de identidad | **ID anónimo local-first** (ahora) + email como capa opcional (después) | Recomendación explícita de la auditoría (§10.1); la app es 100% local; desbloquea sync/AI/comunidad sin bloquearse |
| **D2** | Seed del identicon | `user_id`, **nunca** el display name | Renombrar no debe cambiar la identidad visual (lección GitHub) |
| **D3** | Política de color del CubeMark | Hue libre (24 pasos) con S/L fijos; acento = hue+30° | Distancia perceptiva máxima entre usuarios; dentro del sistema (sin nuevos tokens) |
| **D4** | Ubicación del paquete identicon | `packages/identicon` headless + componente en apps/web | Reutilizable por desktop y futura web pública; headless = testeable |
| **D5** | Hero sin cover/banner | Banda `surface` + borde, avatar a la izquierda | Coherente con la UI utilitaria; evita el envejecimiento rápido del patrón banner |

### Riesgos

1. **Contraste del CubeMark en dark**: mitigado con S/L fijos y test de luminancia (§9.3).
2. **Sync futuro**: mitigado con `user_id` como clave y migraciones versionadas (patrón ya existente).
3. **Crecimiento del contenido**: la regla 4–6 KPIs y tabs ≤5 mantienen el layout estable al añadir bloques (logros, hardware).
4. **Datos vacíos en primer uso**: mitigado con empty states accionables + `seedDemoData` (flag `is_demo` ya aísla datos demo).
5. **Percepción de "perfil sin personalidad"**: mitigado con la curaduría del usuario (métodos declarados, puzzle principal, bio) — identidad, no decoración.

---

## 12. Referencias

### Repositorio (contexto verificado)

- `docs/00-product/PRD.md` — Auth & Profile: "Identity, profiles, preferences, declared solving methods"; "Profile: identity, declared methods, connected hardware".
- `docs/00-product/Auditoria_Producto_2026-08.md` — perfil como P0; recomendación de identidad anónima.
- `docs/01-roadmap/Master_Roadmap.md` — mastery DB ligada al perfil.
- `docs/05-tdd/core/0003-data-models.md` — `User`: "Represents a cuber's profile".
- `docs/14-ai/AGENTS.md` — pipeline TDD/ADR obligatorio.
- `packages/database/src/migrations/migrations.ts` — esquema actual (hasta migración 018).
- `apps/web/src/index.css` — tokens del design system.
- `packages/ui/src/components/` — inventario de componentes (55+).
- `apps/web/src/components/Stats/`, `Insights/`, `widgets/` — atoms y widgets reutilizables.
- `docs/plan_training/README.md` — convención de documento de plan.

### Investigación externa

- Identicon: [Wikipedia](https://en.wikipedia.org/wiki/Identicon) · [donpark/identicon](https://github.com/donpark/identicon) · [Haacked — Identicons as Visual Fingerprints](https://haacked.com/archive/2007/01/22/Identicons_as_Visual_Fingerprints.aspx/) · [GitHub Blog — Identicons](https://github.blog/news-insights/company-news/identicons/) · [Jdenticon](https://github.com/dmester/jdenticon) · [DiceBear](https://github.com/dicebear/dicebear) · [RoboHash](https://github.com/e1ven/Robohash)
- Patrones de perfil/dashboard: GitHub, GitLab, Codeberg, Figma, Linear, Notion, Vercel, Supabase, Stripe Dashboard, Framer, Steam, Valorant/Riot, League of Legends, Destiny 2, Warframe, Path of Exile, Diablo IV, Discord, Xbox, PlayStation, Epic Games.
