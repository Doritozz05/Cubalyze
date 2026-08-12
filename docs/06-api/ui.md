# Paquetes de UI y Utilidades

> Sub-fase 4.6 · 2026-08-12

## `@cubeforge/ui` — kit de UI compartido (4+ archivos)

**Propósito:** kit de componentes de UI (estilo shadcn sobre **Radix UI** +
tailwind): `accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `avatar`,
`badge`, `breadcrumb`, `button`, … y utilidades (`lib/*`).

- **API:** exports por ruta: `./components/*` y `./lib/*` (sin bundle único).
- **Dependencias:** ~28 paquetes Radix + `class-variance-authority`,
  `tailwind-merge`, `lucide-react`, `sonner`, `vaul`, `recharts`,
  `react-hook-form`, `embla-carousel-react`, `next-themes`, `cmdk`,
  `input-otp`, `react-day-picker`, `react-resizable-panels`.
- **Nota:** la web consume su copia local (`@/components/ui/*`) y este paquete
  es el candidato para el kit compartido futuro (desktop/SDK). `private:
  true`, v0.0.0.

## `@cubeforge/identicon` — CubeMark (8 archivos)

**Propósito:** identicon de marca (CubeMark) generado del seed del usuario:
spec determinista → render SVG inline o data-URI.

- **API:** constantes de grid (`GRID_SIZE`, `CELL_COUNT`, `HUE_STEPS`,
  `FILL_RATIO_*`, `MIN_CONTRAST`), `generateCubeMarkSpec`,
  `renderCubeMark`/`cubeMarkToDataUri` (+ `CubeMarkRenderOptions`), helpers de
  color (`resolveGlyphHsl`, `contrastRatio`, `relativeLuminance`), hashing
  (`hashSeed`, `fnv1a32`, `mulberry32`).
- **Dependencias:** ninguna (puro).
- **Consumido por:** web (`IdenticonAvatar` del perfil).

## `@cubeforge/config-eslint` — configuración de ESLint

**Propósito:** config compartida de ESLint del monorepo (flat config, `index.js`).

## `@cubeforge/config-typescript` — configuración de TypeScript

**Propósito:** tsconfigs base compartidos: `tsconfig.base.json`,
`tsconfig.react.json` (extendidos por apps/packages).
