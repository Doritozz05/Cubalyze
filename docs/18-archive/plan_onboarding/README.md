# CubeForge — Plan del Onboarding (P0, First-Load Tour)

> **Documento de diseño del onboarding de primer uso.**
> Fecha: Agosto 2026
> Estado: **Fases F0–F5 implementadas** (TDD-0020 aprobado e implementado el mismo día). Pendiente: verificación browser final.
> Decisiones confirmadas por el usuario: **gate = flag en `app_meta`** y **formato = spotlight walkthrough** (highlight del elemento real + tooltip, con navegación automática entre tabs). Fuera de alcance explícito: **Skill Tree y Training** (no se tocan como stops del tour).
> Método: investigación de referencias → extracción de patrones → arquitectura → diseño UX → micro-copy → plan por fases → decisiones y riesgos.

---

## Índice

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Restricciones (no negociables)](#2-restricciones-no-negociables)
3. [Fase 1 — Investigación de referencias](#3-fase-1--investigación-de-referencias)
4. [Fase 2 — Extracción de patrones y conclusiones](#4-fase-2--extracción-de-patrones-y-conclusiones)
5. [Fase 3 — Análisis comparativo](#5-fase-3--análisis-comparativo)
6. [Fase 4 — Arquitectura](#6-fase-4--arquitectura)
7. [Fase 5 — Diseño UX del tour](#7-fase-5--diseño-ux-del-tour)
8. [Fase 6 — Micro-copy](#8-fase-6--micro-copy)
9. [Fase 7 — Estados, edge cases y a11y](#9-fase-7--estados-edge-cases-y-a11y)
10. [Fase 8 — Plan de implementación por fases](#10-fase-8--plan-de-implementación-por-fases)
11. [Decisiones abiertas y riesgos](#11-decisiones-abiertas-y-riesgos)
12. [Referencias](#12-referencias)

---

## 1. Objetivo y alcance

### 1.1 Objetivo

Diseñar el **onboarding de primer uso** de CubeForge: un tour guiado por spotlight (P0 según la [Auditoría de Producto 2026-08](../00-product/Auditoria_Producto_2026-08.md), que lo cataloga como *"Onboarding guiado — ❌ No existe"*, prioridad **P0**, impacto *Alto (retención)*, complejidad *Baja*).

El tour se muestra **una única vez** (la primera vez que se abre la app) y **lleva al usuario por los tabs principales** de la plataforma, explicando qué es cada espacio con el elemento real resaltado. El usuario siempre puede **saltárselo** y nunca volver a verlo a menos que lo pida (replay opcional en Settings).

Sensación objetivo: **corto, claro, no intrusivo, dismissible en 1 segundo**. El usuario entiende en <60 segundos dónde está cada cosa y sale con un CTA accionable ("haz tu primer solve"). Sin muros, sin formularios obligatorios, sin gamificación.

### 1.2 Alcance

| Dentro (stops del tour) | Fuera (decisión explícita del usuario) |
|---|---|
| Timer | Training |
| Stats (Insights) | Skill Tree / Skills |
| Algorithms (Practice) | Eventos futuros (OH, BLD, big cubes…) |
| Profile (identidad + CubeMark) | AI Coach / Sync (no existen aún) |
| Widgets (dock flotante) | Onboarding multi-dispositivo / email |
| Final + CTA "primer solve" | |

**Nota de posicionamiento**: la auditoría ordena el roadmap como *Perfil/identidad → Sync → Onboarding → …*. El perfil (F0–F6 de `docs/plan_profile/README.md`) ya está implementado, así que el onboarding llega ahora con todas sus dependencias cumplidas: identidad local (`app_meta` + `profiles`), navegación por `ViewId`, widgets y design system completos.

---

## 2. Restricciones (no negociables)

1. **Solo recursos del Design System existente**: tokens (`canvas`, `surface`, `surface-2`, `ink`, `ink-2`, `ink-3`, `line`, `line-2`, semánticos `ready/hold/dnf/caution` + `*-soft`, radius, fuentes sans/mono, clase `.nums`) y componentes de `packages/ui` (Dialog/Popover/Tooltip/Button/Badge) + atoms existentes.
2. **Prohibido introducir un nuevo lenguaje visual**: sin gradientes decorativos, sin sombras pesadas, sin confeti ni cromo festivo. El spotlight es una máscara semitransparente + borde del token `line`, nada más.
3. **Cero dependencias nuevas** (AGENTS.md §4): el spotlight se construye con **framer-motion** (ya en `apps/web`) + medidas de `getBoundingClientRect` + componentes `ui` existentes. **No** a `react-joyride`, `intro.js`, `driver.js` ni similar.
4. **Una sola vez, no molestar**: el gate es un flag persistente en `app_meta` (decisión confirmada); skip y cierre marcan como completado. El tour **nunca** se auto-muestra en sesiones posteriores.
5. **No tocar identidad**: la creación del ID anónimo y la fila `profiles` (F0 de plan_profile) se mantienen intactas. El onboarding solo *lee* `app_meta`.
6. **Fuera del tour**: Skill Tree y Training no aparecen como stops (decisión explícita).
7. **No implementar código** hasta validar este plan y aprobar el TDD correspondiente (pipeline de `AGENTS.md`).

---

## 3. Fase 1 — Investigación de referencias

Investigación sobre patrones de onboarding en productos de la familia visual de CubeForge (productividad profesional: Stripe/Linear/Notion/Figma + herramientas de speedcubing). No se copia ninguna interfaz; se extraen principios.

### 3.1 Productos de productividad (referencia directa de familia visual)

| Referencia | Patrones observados |
|---|---|
| **Stripe Dashboard** | Nunca tour obligatorio; primera visita = empty state accionable + tips contextuales inline. El onboarding se diluye en el producto. |
| **Linear** | Tour corto y opcional ("Take a tour") tras el signup; tooltips de paso con dots de progreso y skip siempre visible; atajos de teclado en cada paso. |
| **Notion** | "Getting started" con checkboxes, no spotlight; permite ignorar por completo. |
| **Figma** | First-run educativo con archivo de ejemplo; micro-hints contextuales que se desvanecen. |
| **Framer / Vercel** | Spotlight tours 3–6 pasos, cada paso navega a una sección real; el elemento se resalta con una máscara y un tooltip adjunto. |

### 3.2 Herramientas de speedcubing (contexto de dominio)

| Referencia | Patrón |
|---|---|
| **csTimer** | **Cero onboarding**: el primer contacto es el timer funcionando directamente. Punto a favor: "la app funciona sola". |
| **Cubeast** | Onboarding por pasos al conectar el smart cube (necesario para el producto); el timer sin cube no tiene tour. |
| **GAN Cube Station** | Onboarding largo y *obligatorio* (crear cuenta, tutoriales). Frustrante para el uso rápido. |
| **Twisty Timer** | Sin onboarding; empty state del timer con instrucción de una línea. |

**Lección transversal speedcubing**: el timer debe ser usable **inmediatamente** (legado csTimer). El onboarding nunca debe bloquear el primer solve.

### 3.3 Patrones técnicos de spotlight tours (búsqueda de mejores prácticas)

- **Máscara**: overlay fijo que oscurece todo excepto el target. Técnica dominante: un div con `box-shadow: 0 0 0 9999px rgba(0,0,0,.5)` sobre el rect del target (un solo nodo, sin 4 divs), o `clip-path`. En CubeForge: `motion.div` con box-shadow gigante, animado con spring entre pasos (framer-motion ya disponible).
- **Posicionamiento del tooltip**: resolver arriba/abajo/izquierda/derecha según el espacio disponible alrededor del rect (≥ threshold) con fallback dentro del viewport. En táctil: **anclado abajo** siempre (el thumb está en el bottom).
- **Navegación entre pasos**: el tour cambia la vista de la app (no solo el highlight) — en CubeForge equivale a llamar `onNavigate(view)` y esperar al siguiente frame para medir el target (useLayoutEffect/rAF).
- **A11y (WAI-ARIA dialogs)**: `role="dialog"` + `aria-labelledby`/`aria-describedby`, foco movido al tooltip, ESC para salir, `aria-live` para cambios de paso. Recomendación `inert` en el resto de la página mientras dure (los navegadores modernos lo soportan).
- **Duración y progreso**: dots (1–N) + título corto + body ≤2 líneas + botones [Skip] [Back] [Next/Done]. Progreso como señal de "casi termino" (reduce abandonos).
- **Replay**: el tour siempre rejugable desde Settings (patrón Linear/Vercel).

---

## 4. Fase 2 — Extracción de patrones y conclusiones

### 4.1 Elementos recurrentes en los mejores first-run

1. **Skip siempre visible** (cada paso, no solo el primero).
2. **≤ 7 pasos** (Ley de Miller) y **< 60 segundos** de recorrido completo.
3. **Cada paso navega a una sección real** y resalta un elemento concreto (no diagramas abstractos).
4. **El primer paso es la funcionalidad estrella** (el timer), para que el usuario ya sepa hacer algo útil de inmediato.
5. **Progreso visible** (dots/barras) y **CTA final accionable**.
6. **Persistencia del estado**: una vez visto/saltado → no se vuelve a mostrar. Replay manual disponible.
7. **No bloquear el uso**: el tour es una capa que se puede ignorar; el timer no se arma con el tour encima.

### 4.2 Qué NO hacer (conclusiones negativas)

1. **Onboarding obligatorio con formularios** (GAN Cube Station): muro de fricción.
2. **Tooltips encadenados sobre una sola vista** (5 pasos sobre el mismo tab): aburren y no enseñan la navegación.
3. **Pasos genéricos sin elemento real**: "Esto es un timer" con un dibujo, en vez de resaltar el scramble de verdad.
4. **Spotlight que no se adapta al scroll/resize**: el target se queda desalineado.
5. **Tour que reaparece tras ser saltado** por un flag mal persistido: pérdida total de confianza.

---

## 5. Fase 3 — Análisis comparativo

### 5.1 Qué adoptamos (con evidencia)

| Patrón | Evidencia | Decisión CubeForge |
|---|---|---|
| Spotlight con elemento real | Framer/Vercel/Linear | Máscara `box-shadow` + tooltip anclado |
| Navegación real entre tabs | Framer/Vercel | `onNavigate(view)` por paso (reutiliza `handleNavigate`) |
| Skip siempre visible + dots | Linear | Tooltip con [Skip] [Back] [Next/Done] + 6 dots |
| Primera impresión = timer usable | csTimer | Paso 1 = Timer; el tour no arma el timer |
| Gate persistente one-shot | patrón universal | flag `onboarding_completed` en `app_meta` |
| Replay desde Settings | Linear/Vercel | fila en Settings → General (fase F5) |

### 5.2 Qué evitamos

- **Tour obligatorio** (GAN) → siempre saltable, sin formularios.
- **>7 pasos** → 6 pasos exactos (5 stops + final), dentro de la Ley de Miller.
- **Pasos abstractos** → cada stop resalta un nodo real (`data-onboarding-target`).
- **Bloqueo del timer** → el tour previene el arranque accidental pero el primer CTA te lleva directo a un solve.

---

## 6. Fase 4 — Arquitectura

### 6.1 Persistencia (gate one-shot) — decisión confirmada: flag en `app_meta`

La tabla `app_meta` (migración 020, clave-valor) ya existe y tiene `AppMetaRepository` con `get(key)`, `set(key, value)` e `insertIfAbsent(key, value)`.

- **Nueva clave**: `onboarding_completed` → `'1'`.
- **Semántica**: ausente = primera vez (elegible). Presente = ya visto/saltado (nunca re-muestra).
- **Sin migración SQL nueva**: es una fila más de la tabla KV (coherente con el patrón `user_id`).
- **API tipada** (añadir a `app-meta.repository.ts`, junto a `USER_ID_KEY`):

```typescript
export const ONBOARDING_KEY = 'onboarding_completed';

// En AppMetaRepository:
async getOnboardingCompleted(): Promise<boolean>;   // get(ONBOARDING_KEY) === '1'
async setOnboardingCompleted(): Promise<void>;      // set(ONBOARDING_KEY, '1')
```

**Guard de elegibilidad secundaria (D1, §11)**: además del flag, el tour se **auto-omite** si al arrancar el usuario ya tiene datos reales — `solves.length > 0` **o** `profile` con `displayName`/`handle` personalizado (identidad editada). Así un usuario que perdió solo el flag (p. ej. reinstall de OPFS con import posterior) jamás recibe el tour de novato. Se lee en `App.tsx` tras `useProfile` + `usePersistentSession` ready.

### 6.2 Hook `useOnboarding` (apps/web/src/hooks/useOnboarding.ts)

Mismo patrón que `useProfile`: **singleton module-level + `useSyncExternalStore`** (una única máquina de estados compartida, segura ante StrictMode con promesa compartida).

```typescript
export type OnboardingStatus = 'loading' | 'idle' | 'active' | 'done';

interface UseOnboardingResult {
  status: OnboardingStatus;
  currentStep: number;        // 0-based
  totalSteps: number;         // 6 (5 stops + final; el final no tiene highlight)
  start: () => void;          // comienza el tour (llamado automáticamente o desde replay)
  next: () => void;
  back: () => void;
  skip: () => Promise<void>;  // marca completado (one-shot) y cierra
  complete: () => Promise<void>; // lo mismo al llegar al final
}
```

Transiciones: `loading → idle | done` (según flag) · `idle → active (start)` · `active → done (skip/complete)` · `done → active (replay, sin re-persistir hasta que termine de nuevo — o re-persistir al saltar)`. Decisión: **replay no cambia el flag**; solo `skip`/`complete` escriben (ver D3).

### 6.3 Componentes (apps/web/src/components/Onboarding/)

| Componente | Responsabilidad | Dependencias |
|---|---|---|
| `OnboardingTour.tsx` | Orquestador: decide render según `status`; maneja overlay, foco, ESC, ciclo de pasos, `onNavigate` + `onViewChange` | `useOnboarding`, framer-motion |
| `Spotlight.tsx` | Mide el target (`getBoundingClientRect` tras navegar + rAF), anima la máscara (`motion.div` con `box-shadow: 0 0 0 9999px …` + borde `line`) entre pasos | framer-motion |
| `TourTooltip.tsx` | Card con título/body/dots/botones; resuelve posición (top/bottom/left/right según espacio; **bottom en táctil**) | `ui` Card/Button, `useIsTouch` |
| `tourSteps.ts` | Registro declarativo de pasos (única fuente de verdad del contenido) | — |

### 6.4 Registro de pasos (tourSteps.ts)

```typescript
interface TourStep {
  id: string;
  view: ViewId;                       // vista a la que navegar antes del highlight
  title: string;
  body: string;
  target?: string;                    // selector CSS del elemento a resaltar
                                      // (ausente solo en el paso final, tooltip centrado)
  onEnter?: (api: { navigate: (v: ViewId) => void }) => void;
}
```

Los targets se marcan en el DOM con el atributo **`data-onboarding-target`** (más robusto que IDs semánticos de negocio): el ScrambleDisplay, la cabecera del Insights, el grid de métodos de Practice, el `ProfileHero` y el item "Widgets" de la sidebar. Si el selector no existe en el momento de medir (vista aún montando), el tour espera 1 frame y reintenta 2 veces antes de mostrar el paso sin highlight (fallback seguro).

### 6.5 Integración en `App.tsx`

1. `useOnboarding()` se añade junto a `useProfile()`.
2. Efecto de auto-start: cuando `status === 'idle'`, `profileSeed` listo y guard de elegibilidad OK → `start()` con **delay de ~600 ms** (deja pintar el timer; evita arranque en blanco).
3. `OnboardingTour` recibe `activeView` + `onNavigate={handleNavigate}` y vive fuera de `MainLayout` (capa superior).
4. **Mientras el tour está activo**:
   - `useShortcuts` se desactiva. La API actual solo acepta callbacks; se amplía con un prop opcional `enabled?: boolean` (adición pequeña, documentada en el TDD) o, mínimamente, se pasan handlers no-op: nada de N/C/Esc del timer.
   - `WidgetHost` y `CubeButtonGate` se ocultan (`!tourActive`) para que el spotlight nunca tenga solapamientos flotantes.
   - El propio tour captura `keydown` `Space`/flechas para evitar armar el timer por teclado (edge case §9).

### 6.6 Estados de la vista

| Estado | Comportamiento |
|---|---|
| `loading` | Nada renderizado (DB inicializándose; `useProfile` ya cubre este retardo) |
| `idle` + elegible | Auto-start tras 600 ms |
| `idle` + no elegible | Nada; app normal |
| `active` | Overlay + spotlight + tooltip; interacción con el resto bloqueada (`inert` si disponible, si no overlay captura clicks) |
| `done` | Nada; app normal |

---

## 7. Fase 5 — Diseño UX del tour

### 7.1 Recorrido (5 stops + final = 6 pasos)

| # | Stop | View | Target (highlight) | Mensaje (resumen) |
|---|---|---|---|---|
| 1 | **Timer** | `timer` | ScrambleDisplay / zona del timer | "Tu timer: mantén espacio (o toca y mantén) y suelta para cronometrar; inspección WCA 15 s integrada." |
| 2 | **Stats** | `insights` | Cabecera del dashboard | "Aquí vive tu progreso: resumen de sesión, análisis de fases, PB y replay 3D de cualquier solve." |
| 3 | **Algorithms** | `algorithms` | Grid de métodos / árbol | "Explora algoritmos por método (CFOP, Roux, ZZ…). Un clic envía cualquier caso al entrenador." |
| 4 | **Profile** | `profile` | ProfileHero (avatar/nombre) | "Tu identidad. El CubeMark nace de tu ID anónimo; personaliza nombre, handle y avatar aquí." |
| 5 | **Widgets** | `timer` | Item **"Widgets"** de la sidebar (grupo Explore) | "Tools flotantes: log de tiempos, visualizador de scramble, metrónomo… Ábrelos con este icono y arma tu layout." |
| 6 | **Final** | `timer` | — (sin target; tooltip centrado) | "Ya está. [Haz tu primer solve] · Tip: revisa Settings para atajos, tema y smart cube." |

> El target del paso 5 es el **item de navegación "Widgets" de la sidebar** (siempre visible, grupo Explore) y no el dock flotante: durante el tour `WidgetHost` y `CubeButtonGate` están ocultos (§6.5) para que la máscara nunca tenga solapamientos, así que el highlight recae en el punto de entrada real al explorador. En táctil, el mismo item se abre desde la hoja de navegación; `onEnter` puede abrir el `WidgetExplorer` como preview opcional.

> **Skill Tree y Training quedan fuera** (decisión explícita). El tour comunica 6 ideas en <60 s; la profundidad de Training/Skills se deja al descubrimiento natural (se ve en la sidebar).

### 7.2 Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────┐
│  (sidebar colapsada)                                          │
│                                              ┌──────────────┐ │
│        ╔════════════════════╗               │ Step 3 of 6  │ │
│        ║  TARGET HIGHLIGHT  ║               │  Algorithms   │ │
│        ║  (spotlight hole)  ║               │  Busca y      │ │
│        ║                    ║               │  practica por │ │
│        ╚════════════════════╝               │  método…      │ │
│                                            │ ● ● ● ○ ○ ○   │ │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │ [Skip] [Next] │ │
│  ▓▓▓▓▓▓▓▓▓ (máscara oscura, box-shadow) ▓▓ │              │ │
│                                            └──────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Tooltip anclado al target con flecha; posición resuelta por espacio (top si cabe, si no bottom/left/right).
- Máscara `rgba(canvas, 0.6)` + borde del target con token `line`/`ready` (1.5px) + radio del sistema.
- Transición entre pasos: spring de framer-motion (~300 ms) que **desplaza** la máscara al nuevo rect (el tooltip cruza con fade).

### 7.3 Wireframe — Táctil (<1024px)

```
┌──────────────────────────────────────────┐
│                                          │
│  ╔══════════════════════════════════╗    │
│  ║        TARGET (highlight)        ║    │
│  ╚══════════════════════════════════╝    │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Step 2 of 6 · Stats                │  │
│  │ Tu progreso: resumen, fases, PB…   │  │
│  │ ● ● ○ ○ ○ ○      [Skip]  [Next →] │  │
│  └────────────────────────────────────┘  │
│  (bottom tab bar visible, no se tapa)    │
└──────────────────────────────────────────┘
```

- En táctil el tooltip va **siempre abajo** (thumb zone) sobre el contenido, dejando visible la bottom tab bar (que ya navega a los tabs del tour).
- Touch target de botones ≥ 40 px; `hapticCelebrate()` sutil en "Done" (reutiliza `apps/web/src/utils/haptics.ts`).

### 7.4 Micro-interacciones

- Máscara: entrada fade-in 200 ms; entre pasos, spring de posición (150–300 ms).
- Tooltip: `AnimatePresence` fade + slide 12 px (mismo lenguaje que `SIDEBAR_MOTION`).
- Dots: el activo se anima (spring, patrón `ACTIVE_PILL_SPRING`).
- Botón "Haz tu primer solve": `active:scale-[0.98]` + navega a `timer` (patrón quick actions existente).
- **Back** oculto en el primer paso (nada atrás que ver); **Skip** siempre visible (regla Linear).

---

## 8. Fase 6 — Micro-copy

> El UI de la app es **inglés** → la micro-copy del tour es **inglés** (D4). Títulos ≤ 4 palabras, body ≤ 2 líneas (regla de las referencias).

| Paso | Título | Body |
|---|---|---|
| 1 | Your timer | "Hold **space** (or tap & hold on touch) and release to start — the 15s WCA inspection is built in. Every solve gets instant phase analysis." |
| 2 | Your stats | "Session overview, phase splits, PB progression and 3D replay of any solve live here." |
| 3 | Algorithms | "Browse cases by method — CFOP, Roux, ZZ… Send any case to the trainer with one click." |
| 4 | Your identity | "Your CubeMark is generated from your anonymous ID. Set your name, handle and avatar here." |
| 5 | Widgets | "Floating tools — times log, scramble visualizer, metronome. Open the explorer and build your own layout." |
| 6 | You're all set | "Make your first solve, or explore Settings for shortcuts, theme and smart cube." |

Botones: **Skip** (siempre), **Back**, **Next**, **Done** (final), **Make my first solve** (CTA primario del final). Welcome step 0: *"Welcome to CubeForge"* + [Take a quick tour] [Skip] — **descartado**: el paso 1 es el Timer directamente (lección csTimer: primera impresión = timer funcionando). El tour empieza en Timer sin paso de bienvenida.

---

## 9. Fase 7 — Estados, edge cases y a11y

### 9.1 Edge cases

| Caso | Comportamiento |
|---|---|
| DB aún no lista | `status='loading'`; nada se muestra hasta que `useProfile` resuelve (mismo retardo que la identidad) |
| Solves aún cargando en el auto-start | El guard de elegibilidad (D1) espera a que `usePersistentSession` termine de cargar (`solves` inicial = `[]` durante la carga); si se lanzara antes, un usuario de vuelta con el flag perdido vería el tour por error |
| Usuario con datos (solves o perfil editado) y sin flag | **No** se muestra (guard secundario, D1) |
| Recarga a mitad del tour | El flag solo se escribe en `skip`/`complete` → al recargar `idle` y vuelve a empezar (aceptado, D3) |
| Target fuera de viewport (p. ej. Profile en táctil) | `scrollIntoView({ behavior:'smooth', block:'center' })` antes de medir + reintento 1 frame |
| Target no encontrado tras 2 reintentos | Paso se muestra sin spotlight (tooltip centrado) — nunca bloquea |
| Resize/scroll del usuario durante un paso | `ResizeObserver` en el target + re-medida en `resize`/`scroll` (passive) |
| Espacio/flechas por teclado durante el tour | El tour captura `keydown` y hace `preventDefault` (evita armar el timer) |
| StrictMode / doble montaje | Singleton con promesa compartida (patrón `useProfile`); el auto-start es idempotente |
| Almacenamiento volátil (memory) | El toast existente de storage warning se sigue mostrando; el tour funciona igual (el flag se pierde en reload, aceptado) |

### 9.2 A11y

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (título) / `aria-describedby` (body) en el tooltip.
- Foco movido al tooltip al entrar; **ESC** = Skip; `inert` en el resto del árbol (con fallback: overlay captura pointer).
- Cambio de paso anunciado con `aria-live="polite"` (o `aria-live="assertive"` en táctil por VO).
- Contraste AA/AAA (tokens existentes ya calibrados); la máscara mantiene el target legible.
- `prefers-reduced-motion`: transiciones instantáneas (patrón `useReducedMotion` ya usado en `LeftSidebar`).
- Skip y botones con `focus-visible` rings consistentes (token `ring-ink/40`).

---

## 10. Fase 8 — Plan de implementación por fases

> Pre-requisito (AGENTS.md): **TDD** nuevo (p. ej. `docs/05-tdd/core/0020-onboarding-tour.md`) y actualizar `docs/07-database/` con la nueva key de `app_meta`. Nada de código sin TDD aprobado. Cada fase incluye typecheck (`pnpm typecheck`) + tests (`vitest`) + lint.

> **Nota de numeración**: las fases de implementación de esta sección (F0–F5) usan numeración propia, **independiente** de las fases de diseño del documento (1–8), igual que en `docs/plan_profile/README.md`.

### Fase F0 — Persistencia del gate (base)

| Tarea | Detalle |
|---|---|
| `ONBOARDING_KEY` + `getOnboardingCompleted`/`setOnboardingCompleted` | `packages/database/src/repositories/app-meta.repository.ts` (junto a `USER_ID_KEY`) |
| Tests | ampliar `packages/database/src/__tests__/profile.repository.test.ts` (semántica first-run: ausente → false; set → true; idempotente) |
| Docs | actualizar `docs/07-database/` (nueva key documentada) |

### Fase F1 — Hook `useOnboarding` (máquina de estados)

| Tarea | Detalle |
|---|---|
| `useOnboarding.ts` | Singleton module-level + `useSyncExternalStore` (patrón `useProfile`); API §6.2 |
| Tests de lógica pura | vitest: `loading→idle/done` según flag; `start` idempotente; `skip`/`complete` persisten y pasan a `done`; recarga mid-tour → `idle` |
| Replay | `replay()` desde `done` → `active(0)` sin tocar el flag (D3) |

### Fase F2 — Núcleo del tour (Spotlight + Tooltip)

| Tarea | Detalle |
|---|---|
| `Spotlight.tsx` | Máscara `motion.div` + `box-shadow` gigante; mide rect con rAF + `ResizeObserver`; spring entre pasos |
| `TourTooltip.tsx` | Card `ui` + posición por espacio (bottom en táctil vía `useIsTouch`); dots + botones [Skip][Back][Next/Done]; a11y §9.2 |
| `OnboardingTour.tsx` | Ciclo de pasos, ESC, `inert`/overlay, keydown guard (espacio/flechas), `aria-live` |
| Marcado `data-onboarding-target` | ScrambleDisplay, Insights header, Practice grid, ProfileHero, item "Widgets" de la sidebar (grupo Explore) |

### Fase F3 — Pasos + integración en App

| Tarea | Detalle |
|---|---|
| `tourSteps.ts` | Registro de 6 pasos (§7.1) con selectores reales |
| Integración `App.tsx` | `useOnboarding` + auto-start (600 ms) + guard elegibilidad (solves/profile) + `onNavigate` + ocultar `WidgetHost`/`CubeButtonGate` durante el tour + `useShortcuts` no-op |
| Verificación browser | tour completo de principio a fin + skip + recarga mid-tour (manual o `browser-use`) |

### Fase F4 — Responsive táctil + pulido

| Tarea | Detalle |
|---|---|
| <1024px | Tooltip abajo, touch targets ≥40 px, bottom tab bar visible, scrollIntoView de targets |
| Micro-interacciones | Springs, dots animados, `useReducedMotion`, haptic en Done |
| Verificación browser | Android/iOS viewport + portrait/landscape |

### Fase F5 — Replay en Settings (P1, pequeño)

| Tarea | Detalle |
|---|---|
| Fila "Replay onboarding tour" | `Settings/sections/GeneralSection.tsx` (junto a Theme/Precision/Haptics) que llama a `replay()` |
| Tests | render/smoke del botón (si el repo tiene harness de UI) + hook ya cubierto en F1 |

**Estimación total**: 1.5–2 semanas (F0–F4) + F5 (~0.5). El riesgo es bajo: cero dependencias nuevas, cero migraciones SQL, patrón singleton ya probado en el repo. La parte delicada es F2 (medición/posicionamiento del spotlight) — por eso se aísla en su propia fase con tests.

---

## 11. Decisiones abiertas y riesgos

### Decisiones

| ID | Decisión | Resolución | Justificación |
|---|---|---|---|
| **D1** | Gate del tour | **Flag `onboarding_completed` en `app_meta`** (confirmada) + guard secundario: se auto-omite si hay solves o perfil editado | La identidad se crea en el arranque (F0 plan_profile), así que el flag es la marca de "primera vez"; el guard secundario respeta la intención original *"si no existe usuario"* sin tocar identidad |
| **D2** | Tecnología del spotlight | **framer-motion + `getBoundingClientRect` + `ui` existentes**; prohibidas libs de tour | AGENTS.md §4 (sin deps sin ADR/TDD); patrón ya presente en el repo |
| **D3** | Comportamiento de recarga | Reload mid-tour → vuelve a empezar; `skip`/`complete` escriben el flag; `replay` no | One-shot estricto; el flag solo se persiste en resolución terminal |
| **D4** | Idioma de la micro-copy | **Inglés** (el UI es inglés); doc en español | Consistencia de producto |
| **D5** | Stops del tour | Timer, Stats, Algorithms, Profile, Widgets + final. **Excluidos Skill Tree y Training** | Decisión explícita del usuario |
| **D6** | Paso 0 de bienvenida | **No existe**: el tour arranca en Timer | Lección csTimer: primera impresión = timer funcionando; menos fricción |

### Riesgos

1. **Overlap con widgets flotantes / botón cubo**: mitigado ocultando `WidgetHost` y `CubeButtonGate` mientras `status='active'`.
2. **Arranque accidental del timer por teclado**: mitigado con keydown guard (espacio/flechas) + `useShortcuts` no-op durante el tour.
3. **Spotlight desalineado** (scroll/resize/montaje tardío): mitigado con re-medida en `resize`/`scroll` + `ResizeObserver` + reintentos de 1 frame.
4. **Tour molesto para usuarios con datos** (flag perdido): mitigado con el guard secundario de elegibilidad (D1).
5. **Regresión del timer** (feature más crítica del producto): el tour nunca cambia el flujo del timer fuera de `status='active'`; verificación browser obligatoria en F3.

---

## 12. Referencias

### Repositorio (contexto verificado)

- `docs/00-product/Auditoria_Producto_2026-08.md` — onboarding como **P0**, "Onboarding guiado — ❌ No existe" (§4.6, §8, §9).
- `docs/14-ai/AGENTS.md` — pipeline TDD/ADR obligatorio; prohibición de deps nuevas sin TDD/ADR.
- `docs/plan_profile/README.md` — convención de documento de plan; F0 (identidad en `app_meta`), F3 (navegación `ViewId`/Profile), F5 (edición de perfil), CubeMark.
- `packages/database/src/repositories/app-meta.repository.ts` — `USER_ID_KEY`, `get`/`set`/`insertIfAbsent`/`getOrCreateUserId` (base para `ONBOARDING_KEY`).
- `apps/web/src/hooks/useProfile.ts` — patrón singleton module-level + `useSyncExternalStore` (modelo para `useOnboarding`).
- `apps/web/src/hooks/useShortcuts.ts` — shortcuts globales N/C/Esc (gate durante el tour).
- `apps/web/src/App.tsx` — `activeView`, `handleNavigate`, `ViewId`, `WidgetHost`/`CubeButtonGate`, `trainingActiveRef` (patrón de gate por vista).
- `apps/web/src/components/Layout/sidebar.constants.ts` — `ViewId` y `NAV_GROUPS` (Timer/Stats/Algorithms/Profile/Widgets).
- `apps/web/src/components/Settings/sections/GeneralSection.tsx` — lugar del botón de replay (F5).
- `packages/ui/src/components/` — Dialog/Popover/Tooltip/Card/Button/Badge existentes.
- `apps/web/src/utils/haptics.ts` — `hapticCelebrate` (sutil en Done).

### Investigación externa

- Patrones de onboarding: [Stripe Dashboard](https://stripe.com/blog/stripe-dashboard), [Linear — Onboarding](https://linear.app/), [Framer — Getting started](https://www.framer.com/), [Vercel Dashboard](https://vercel.com/).
- Spotlight tours y mejores prácticas: [react-joyride](https://github.com/gilbarbara/react-joyride), [intro.js](https://introjs.com/), [driver.js](https://driverjs.com/) (referencia de técnicas, **no** a integrar), [WAI-ARIA Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Dominio speedcubing: [csTimer](https://cstimer.net/) (cero onboarding), [Cubeast](https://www.cubeast.com/), [GAN Cube Station](https://www.gancube.com/), [Twisty Timer](https://play.google.com/store/apps/details?id=com.zunda.cubing).
