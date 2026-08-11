# Plan — Cubo Virtual (Cube Simulator) 🧊

> Branch: `feat/cube-simulator`
>
> Un nuevo tab en el sidebar que abre un **visor inmersivo a pantalla completa** del cubo 3D existente: el cubo se puede **girar por capas con gestos táctiles**, orbitar la cámara, hacer pinch-zoom, y se le aplica un **scramble automático** al entrar. Reutiliza el motor 3D actual (`@cubeforge/cube-3d-engine`), la **skin seleccionada en Settings** (reacciona a `preferencesStore.appearance3d` + `customStickerColors`) y el generador de scrambles WCA ya existente.

---

## 1. Objetivo

| Aspecto | Decisión |
|---|---|
| Entrada | Nuevo item en el sidebar (grupo **Main**, debajo de Timer) con icono `Boxes`/`Orbit` de lucide |
| Vista | **Como el timer normal**: sidebar + header visibles, el cubo ocupa el stage centrado y grande. El modo focus existente (`isFocused`) sigue cubriendo todo cuando se activa (misma mecánica que el timer) |
| Motor | Reutilizar `useCube3D` + `Cube3DEngine` tal cual (mismo canvas, skins, resize, eviction de contexto) |
| Skin | Automática desde Settings (`appearance3d` / `customStickerColors`) — ya lo hace `useCube3D` |
| Scramble | Al entrar se genera y aplica animado automáticamente; botón para nuevo scramble; atajo de teclado |
| Interacción | Táctil: **swipe directo sobre la cara** para girar capas (decisión del usuario) + orbit en el fondo + pinch zoom. Teclado con el keymap exacto de csTimer |
| Alcance | **3×3 fijo por ahora**; la arquitectura queda lista para todos los puzzles implementados (el generador `generateScrambleFor` y el `order` del motor ya están parametrizados) |
| Overlay teclas | Solo se muestra con el botón de ayuda **`?`** (decisión del usuario) |

---

## 2. Investigación: keybinds exactos de csTimer (fuente: código fuente oficial)

Se extrajo el keymap **directamente del código fuente de csTimer** (el estándar de facto del cubing online):

- `src/js/twisty/qcubennn.js` → `generateCubeKeyMapping()` (cubo NxNxN actual)
- `src/js/twisty/twistyskb.js` → keymap del cubo 3D (mismo layout de caras)
- `src/js/shortcut.js` → atajos globales

### 2.1 Keymap de caras (12 teclas, CW y CCW como teclas separadas)

| Cara | CW | CCW |
|---|---|---|
| **U** | `J` | `F` |
| **F** | `H` | `G` |
| **R** | `I` | `K` |
| **L** | `D` | `E` |
| **B** | `W` | `O` |
| **D** | `S` | `L` |

**La lógica ergonómica (lo que pediste: "tu índice en la U"):**
- Los **índices descansan sobre U**: `F` (izquierda) = U', `J` (derecha) = U. Es como sujetar el cubo: cada mano controla la cara que ve.
- Los **medios** hacen R (derecha `I`/`K`) y L (izquierda `D`/`E`).
- Los **anulares** hacen B (`W`/`O`) y D (`S`/`L`).
- Los **meñiques** hacen las rotaciones de cámara y capas intermedias.

### 2.2 Rotaciones de cámara (cubo completo)

| Rotación | CW | CCW |
|---|---|---|
| x (R') | `T` / `Y` | `N` / `B` |
| y (U') | `;` | `A` |
| z (F') | `P` | `Q` |

### 2.3 Wide moves y slices

| Movimiento | Teclas |
|---|---|
| r / r' | `U` / `M` |
| l / l' | `R` / `V` |
| u / u' | `,` / `C` |
| d / d' | `Z` / `/` |
| M / M' | `5` / `6` y `.` / `X` |
| E / E' | `2` / `9` |
| S / S' | `0` / `1` |

### 2.4 Notas clave de comportamiento (del código fuente)

- csTimer **no usa Shift** para invertir: CW y CCW son teclas dedicadas (memoria muscular directa).
- `Alt`/`Ctrl` se ignoran en el keymap del cubo (reservados para atajos globales: `Ctrl+←/→` = scramble anterior/siguiente, `Ctrl+1/2/3` = OK/+2/DNF, etc.).
- En cubos grandes, `3/4/7/8` ajustan qué capa giran L/R y `Espacio` resetea el offset (no aplica para 3×3 pero se deja documentado).
- La vista por defecto de csTimer es **blanco arriba (U), verde al frente (F)** — la misma convención WCA que ya usa el motor (`stickerColors`).

### 2.5 Atajos globales relevantes (shortcut.js) para nuestra vista

| Acción | Atajo propuesto en Cubeforge |
|---|---|
| Nuevo scramble | `N` (ya existe en `preferencesStore.shortcuts.newScramble = 'n'`) |
| Volver / salir | `Escape` (ya existe `cancelTimer: 'escape'` como convención) |
| Scramble anterior / siguiente | `Ctrl+←` / `Ctrl+→` (opcional, espejo de csTimer) |

> Fuente: https://github.com/cs0x7f/cstimer (`src/js/twisty/qcubennn.js`, `src/js/twisty/twistyskb.js`, `src/js/shortcut.js`)

---

## 3. Interacción táctil (controles táctiles)

El cubo debe "moverse" con gestos, como sujetar un cubo físico:

| Gesto | Acción |
|---|---|
| **1 dedo: tocar y deslizar sobre una cara del cubo** | Girar esa capa (90°, CW/CCW según dirección del swipe) |
| **1 dedo: arrastrar fuera del cubo (fondo)** | Orbitar la cámara (comportamiento actual) |
| **2 dedos** | Pinch zoom (comportamiento actual) |
| **Doble toque en cara** | Turno de 180° (opcional, fase 2) |

**Detección cara + capa:** se añade un método pequeño al motor (módulo 3D, reutilizable):

```
pickLayer(clientX, clientY): { axis: 'x'|'y'|'z', layerValue: -1|0|1, normal: Vector3 } | null
```

- Raycast de three.js desde la cámara del `SceneManager` contra los cubies del `CubeModel`.
- Devuelve el eje y la capa del cubie golpeado (reutilizando la convención Kociemba del motor: X=R/L, Y=U/D, Z=F/B).
- El swipe se proyecta sobre el plano de la cara → signo del producto escalar con las tangentes → CW o CCW.

**Por qué así:** es exactamente el modelo de csTimer 2D (swipe sobre la columna) y el del 3D twisty (drag sobre la cara con `handMarks`), y se siente natural: agarras la cara que quieres girar y la mueves.

**Modo alternativo (a decidir):** un toggle "Girar capas ↔ Orbitar cámara" si el gesto de cara/fondo se siente ambiguo en pantallas pequeñas.

---

## 4. Arquitectura propuesta (modular, reutilizando todo)

```
apps/web/src/
├─ views/Cube/
│  └─ CubeSimulatorView.tsx        # Vista fullscreen: canvas + overlays + salida
├─ hooks/
│  ├─ useCube3D.ts                 # YA EXISTE — se reutiliza tal cual (skin automática)
│  └─ useCubeTurnControls.ts       # NUEVO: swipe→girar capa + keydown→girar capa
├─ lib/keybinds/
│  └─ cubeKeybinds.ts              # NUEVO: tabla key→{face, direction} (espejo csTimer)
└─ components/Layout/
   ├─ sidebar.constants.ts         # + ViewId "cube" + NAV_GROUPS + icono
   ├─ MainLayout.tsx               # + prop hideSidebar (AnimatePresence ya anima la salida)
   ├─ MainStage.tsx                # + caso activeView === "cube"
   └─ AppShell.tsx                 # hideHeader + hideSidebar cuando cube, + lazy view
```

### 4.1 Cambios en el motor (`packages/cube-3d-engine`)

Solo **un método nuevo y pequeño** (el resto se reutiliza):

- `Cube3DEngine.pickLayer(x, y)` → raycast (three.js `Raycaster` ya disponible) contra los cubies.
- Exportarlo desde `src/index.ts`.
- Sin cambios en el render loop, skins, rotaciones ni facelets.

### 4.2 Keymap → motor

- `cubeKeybinds.ts` define la tabla tecla→cara (espejo literal de csTimer).
- El hook traduce con `FACE_ROTATION_MAP` (ya exportado) y llama `engine.rotateLayers(axis, [layerValue], direction * angleSign * 90, ~140ms, undefined, 'smooth')`.
- `parseScrambleMoves` + `applyScrambleAnimated` para el scramble (ya existe en `useCube3D.applyScramble`).

### 4.3 Scramble automático

- Al montar la vista: `generateScrambleFor(puzzle)` (ya existe en `utils/puzzleUtils.ts` — random-state WCA 3×3 vía Min2Phase, o 2×2 vía TwoByTwoScrambler) → `applyScramble(scramble)` (animado).
- Botón "Nuevo scramble" (`Shuffle`) + atajo `N` (respeta `preferencesStore.shortcuts`).

### 4.4 Skin desde Settings

- Cero trabajo extra: `useCube3D` ya reacciona a `preferencesStore.appearance3d` y `customStickerColors` y llama `engine.updateStyle(...)`.
- La vista hereda automáticamente cualquier skin (Default, Stickerless, Coreless, Translucent, Custom).

### 4.5 i18n

- `apps/web/src/i18n/locales/en.json` + `es.json` → namespace `nav`: `cube` ("Cube" / "Cubo").
- Strings del overlay de controles (pista de gestos, "arrastra para girar", etc.) en los namespaces existentes (`shell` / nuevo `cube`).

### 4.6 Layout: como el timer normal (con modo focus preservado)

- **Sin cambios de layout**: la vista del cubo se renderiza en el stage como cualquier otra vista (sidebar + header visibles). El `AnimatePresence` de la rail y el header no se tocan.
- El modo focus existente (`isFocused` de App → `MainLayout`) sigue funcionando: cuando se activa, su `absolute inset-0 z-50 bg-canvas` cubre todo el layout — misma mecánica que el timer.
- Overlay de la vista: botón de ayuda `?` (abre el keymap), botón scramble, y pista de gestos colapsable. No hay botón de salida flotante — se sale navegando con el sidebar (como cualquier vista).

---

## 5. Fases de implementación

1. **Fase 0 — Branch + keybinds**: ya hecha la branch `feat/cube-simulator`; módulo `cubeKeybinds.ts` + tests unitarios (cada tecla → movimiento esperado).
2. **Fase 1 — Motor**: método `pickLayer` + tests.
3. **Fase 2 — Vista básica**: `CubeSimulatorView` en el stage (layout normal), canvas reutilizando `useCube3D`, scramble automático, i18n, registro en sidebar/stage.
4. **Fase 3 — Táctil**: `useCubeTurnControls` (swipe sobre cara → girar, orbit en fondo, pinch existente) + pista de gestos.
5. **Fase 4 — Teclado**: bind del keymap csTimer + overlay de teclas accesible con botón `?`.
6. **Fase 5 — Pulido**: inercia, haptics (ya hay `navigator.vibrate` en prefs), preparación multi-puzzle (2×2 hoy, el resto cuando se implementen), accesibilidad (ARIA en botones, `prefers-reduced-motion`).

**Validación:** `vitest` (unit del keymap + pickLayer), `tsc`/`eslint` del workspace web, y verificación visual con browser (desktop + touch).

---

## 6. Decisiones tomadas (input del usuario)

1. **Layout**: como el timer normal (sidebar + header visibles); el modo focus existente cubre todo cuando se activa. ✅
2. **Táctil**: swipe directo sobre la cara para girar capas (sin toggle). ✅
3. **Puzzle**: 3×3 fijo por ahora; arquitectura lista para todos los puzzles implementados. ✅
4. **Overlay de teclas**: accesible con botón de ayuda `?`. ✅
