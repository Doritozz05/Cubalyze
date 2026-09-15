# Monorepo y Build

## Turborepo (`turbo.json`)

El orquestador de tareas. Tareas declaradas con `dependsOn` para ordenar
dependencias (`^build` = build de los dependientes primero):

| Tarea | Configuración | Notas |
|---|---|---|
| `build` | `dependsOn: ["^build"]`; outputs `.next/**`, `dist/**` | Outputs cacheables |
| `lint` | `dependsOn: ["^lint"]` | Sin outputs (no cache de lint) |
| `test` | `dependsOn: ["^build"]` | Requiere build previo |
| `typecheck` | `dependsOn: ["^build"]` | Ídem |
| `dev` | `cache: false`, `persistent: true` | Dev servers |

**Dato relevante:** **no hay remote cache** (`remoteCache` ausente) — el
ADR-006 lo contemplaba, pero la auditoría de Fase 0 lo marcó pendiente. Todo el
caché es local (`.turbo/`, ignorado en git).

## pnpm workspace (`pnpm-workspace.yaml` + root `package.json`)

- `packages: ["apps/*", "packages/*"]`, `packageManager: pnpm@11.12.0`.
- `allowBuilds: { esbuild: true }` (pnpm 11 bloquea postinstall por defecto;
  se permite solo el de esbuild).
- `overrides`: pin de `@types/react` → 18.3.1 / `@types/react-dom` → 18.3.0
  (compatibilidad del ecosistema, pese a que la web usa React 19).
- `engines`: node >=18, pnpm >=9.

## Scripts de raíz (`package.json`)

| Script | Qué hace |
|---|---|
| `build` | `turbo run build` |
| `dev` | `turbo run dev --concurrency 15` |
| `lint` | `turbo run lint` |
| `lint:lines` | `node scripts/lint-lines.cjs` — gate de líneas (TDD-0006) |
| `knip` | `knip` — detección de código muerto / dependencias sin uso |
| `test` | `turbo run test` |
| `test:coverage` | `vitest run --coverage` (raíz) |
| `typecheck` / `typecheck:all` / `typecheck:watch` | `tsc --noEmit -p tsconfig.json` (+ watch) |
| `format` | prettier sobre `**/*.{ts,tsx,md,json}` |
| `commit` | `czg` (commitizen) — guiado de Conventional Commits |
| `prepare` | `husky` (instala hooks) |
| `release` | `pnpm build && changeset publish` |

### Scripts de utilidad (`scripts/`)

- **`lint-lines.cjs`** — gate TDD-0006: ningún `.ts/.tsx` nuevo supera las 1000
  líneas. Los que ya la superan están en un **ALLOWLIST** (deuda documentada que
  solo puede encogerse: el gate falla solo con violaciones *nuevas*). Con
  `--list` imprime la deuda actual y qué entradas del allowlist ya no se
  necesitan. Excluye datos generados (`algorithm-db/src/seed/**`, "DO NOT edit
  by hand").
- **`find-orphans.cjs`** — escanea `apps/web/src` buscando archivos nunca
  importados (resuelve imports relativos y `@/`, excluye entry points, tests y
  `.d.ts`). Solo informativo.
- **`_scan-panel.cjs`**, **`_scan-insp-bug.cjs`** — utilidades de depuración
  puntual (prefijo `_`).

## TypeScript (`tsconfig.json` raíz)

- **Uso:** escaneo cross-package (`packages/*/src/**` + `*.ts`) para el
  typecheck de CI; cada paquete/app tiene su propio `tsconfig` para build.
- Opciones clave: target ES2023, `moduleResolution: Bundler`, `strict`,
  `noEmit`, `allowImportingTsExtensions`, JSX react-jsx.
- **`paths`**: los 13 paquetes mapeados (`@cubalyze/*` → `src/index.ts`) —
  espejo de los aliases que usan Vite y Vitest.

## Vitest (`vitest.config.ts` raíz)

- **Aliases**: `@/components/ui` → `packages/ui/src/components` (¡antes que `@`!
  sin esto los loaders lazy de widgets fallan) y `@` → `apps/web/src`.
- `passWithNoTests: true` — un paquete sin tests no rompe `pnpm test`.
- **Coverage** (v8): reporteros text/json/html, `include: ['src/**/*.{ts,tsx}']`
  con globs **relativos** (compatible Windows y con `pnpm --filter` ejecutado
  con cwd del paquete); excluye `src/worker.ts` (solo corre en navegador).

## Prettier (`.prettierrc`)

Semi, singleQuote, trailingComma all, printWidth 100, plugin
`prettier-plugin-tailwindcss` (ordena clases de Tailwind).

## Knip (`knip.jsonc`)

Detección de código muerto y dependencias sin usar, con **exclusiones
documentadas** (cada una explica el porqué):

- **Root**: `scripts/*.cjs` como entry; `@commitlint/cli` ignorado (herramienta
  "kept for future gate" — hoy el hook es deliberadamente no bloqueante).
- **`apps/desktop`**: ~50 dependencias "no usadas" por limitación de knip — los
  imports cross-app (`../../web/src/App`) y los aliases de Vite
  (`@cubalyze/database` → override) no son trazables; son **compartidas, no
  muertas**. Mismo caso para el CSS tooling de Tailwind v4.
- **`apps/web`**: los Radix consumidos vía el alias `@/components/ui`
  (declarados en `packages/ui`).
- **`ignore`**: `apps/web/public/**` (worklet de Stackmat cargado por URL),
  `StackmatProcessor.ts`, `vite.config.http.ts` (variante HTTP del preview),
  seeds generados, adapters/overrides de desktop (wired vía alias), y el barrel
  `widgets/sdk/index.ts` (superficie de API intencional para futuros plugins).
- `ignoreExportsUsedInFile: true` (reduce ruido sin ocultar huérfanos reales).

## Vite (apps/web)

- Dev con SSL (`@vitejs/plugin-basic-ssl`) y **cabeceras COI** obligatorias para
  OPFS (ver [Deploy_and_Hosting.md](./Deploy_and_Hosting.md)).
- `optimizeDeps.exclude: ['@sqlite.org/sqlite-wasm']` (se carga en worker).
- Alias `@/components/ui` → paquete compartido, `@` → `src`.
- **Chunk splitting declarativo** (Rolldown): grupos `react`, `three`, `radix`,
  `recharts`, `framer-motion` (priority 30), `xlsx` (priority 25, solo se carga
  con `import()` al exportar Excel), `clsx` (priority 40, workaround de
  dedup con recharts) y catch-all `vendor` (priority 20). El comentario del
  archivo documenta cuándo tocar cada tier.
- `chunkSizeWarningLimit: 700` (three.js es ~600 kB y va en chunk lazy).
- `--mode analyze` emite treemap interactivo en `dist/report.html`.
- **PWA**: `vite-plugin-pwa` con `registerType: prompt`, `injectRegister:
  false` (para que la CSP estricta sin `unsafe-inline` funcione — el registro
  vive en `src/main.tsx` vía `virtual:pwa-register`), workbox
  `maximumFileSizeToCacheInBytes: 4MB`, navegación **NetworkFirst** (timeout
  4s, sin fallback al precache para que la carga inicial sea siempre la última
  versión con conexión), manifest CubeForge (ver
  [Deploy_and_Hosting.md](./Deploy_and_Hosting.md)).
