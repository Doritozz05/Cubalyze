# Vista Cube (Simulador 3D)

> Documentada el 2026-08-12 a partir del código real
> (`apps/web/src/views/Cube/CubeSimulatorView.tsx`). Verificable contra el código.

## Qué es

La tab **Cube** abre el **simulador de cubo virtual 3×3**: un visor inmersivo a
pantalla completa del motor 3D existente donde se puede **girar por capas con
gestos táctiles**, orbitar la cámara, hacer pinch-zoom y aplicar un **scramble
automático** al entrar (WCA). Reutiliza el motor 3D, la skin seleccionada en
Settings y el generador de scrambles — no reimplementa nada.

## Archivo

| Archivo | Qué es |
| --- | --- |
| `CubeSimulatorView.tsx` | El simulador completo (memoizado): `CUBE_ORDER = 3` (arquitectura lista para más puzzles), estado de cubo con `SOLVED_FACELETS` canónico (los centros del math-core son fijos), interacción por capas, cámara (orbit/zoom), scramble automático al entrar, uso de la skin (`preferencesStore.appearance3d` + `customStickerColors`) |

## Detalles clave

- **Solo 3×3 por ahora** (`CUBE_ORDER = 3`), con la arquitectura preparada para
  más puzzles.
- El estado que se empuja a la sesión es la string de facelets canónica; el
  math-core mantiene los centros **fijos** (nunca permutan), de modo que un
  cubo resuelto pero rotado se serializa con centro no alineado y **falla** la
  comparación con `SOLVED_FACELETS` — el simulador evita esa serialización.
- Entrada inmersiva con **scramble automático** (generador WCA existente).

## Dependencias de paquetes

- `@cubalyze/cube-3d-engine` — motor 3D (Three.js puro, ADR-014).
- `@cubalyze/math-core` — estado del cubo y facelets.
- `@cubalyze/solver-engine` — generador de scrambles WCA (ADR-015).
- `@cubalyze/state` — `preferencesStore` (skin 3D, stickers personalizados).

## ADRs relacionados

- **ADR-014** — estrategia de renderizado (Three.js puro).
- **ADR-015** — scrambles WCA del solver.
- **TDD-0006** (`docs/05-tdd/`) — diseño del motor 3D.
