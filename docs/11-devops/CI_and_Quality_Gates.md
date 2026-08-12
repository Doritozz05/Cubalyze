# CI y Quality Gates

La CI vive en `.github/workflows/` con **dos workflows complementarios**
(decisión registrada en [ADR-028](../03-adr/ADR-028-CI_Quality_Gates.md)):
`ci.yml` (pipeline básico, rápido) y `quality-gates.yml` (los gates de "Nivel 3",
más estrictos y con más jobs).

## `ci.yml` — pipeline básico (push a main + PRs a main)

Un solo job `build` en `ubuntu-latest`:

1. `actions/checkout@v4` con `fetch-depth: 0` (historial completo — necesario
   para cambiosets y convención de commits).
2. `pnpm/action-setup@v4` + `actions/setup-node@v4` (Node 22, `cache: 'pnpm'`).
3. `pnpm install --frozen-lockfile` (lockfile exacto).
4. **Lint** → `pnpm lint`.
5. **Gate de líneas** → `pnpm lint:lines` (TDD-0006).
6. **Test** → `pnpm test`.
7. **Build** → `pnpm build`.

## `quality-gates.yml` — gates de Nivel 3 (PRs a main + push a main)

Seis jobs independientes; cada uno instala deps y hace `pnpm build` antes de
su chequeo (los paquetes deben compilar antes de testear/typechequear):

| Job | Comando | Exigencia |
|---|---|---|
| `typecheck` | `pnpm -r exec tsc --noEmit` | 0 errores de tipos |
| `lint` | `pnpm lint` + `pnpm lint:lines` | 0 errores, 0 warnings; sin archivos nuevos >1000 líneas |
| `unit-tests` | `pnpm -r exec vitest run --passWithNoTests` | 100% de tests pasando (timeout 30 min) |
| `coverage` | `vitest run --coverage` en **math-core, solver-engine, analysis-engine, timer-engine, database** | >80% de líneas en los 5 paquetes core |
| `property-based` | `vitest run src/__tests__/property-based.test.ts` en solver-engine | 0 fallos (fast-check) |
| `benchmarks` | benchmarks de solver-engine y analysis-engine | **Deshabilitado en CI** (`if: false`) |

### Por qué los benchmarks están deshabilitados en CI

El job existe pero con `if: false`: los umbrales de timing son **no
deterministas** en runners compartidos de GitHub Actions (ruido de CPU/memoria).
Correrlos ahí daría falsos positivos. Se ejecutan localmente; en CI solo
sirven si se cambia a umbrales de ratio (p.ej. vs. una línea base commiteada)
— ver "Unresolved" en el ADR-028.

### Lo que NO está gateado (decisiones deliberadas)

- **Conventional Commits**: `commitlint` está instalado y configurado
  (`commitlint.config.mjs`: types feat/fix/docs/style/refactor/perf/test/chore/
  build/ci/revert, scope kebab-case, subject sin Start/Pascal/Upper case, header
  ≤100), **pero el hook de husky `.husky/commit-msg` está vacío a propósito**
  (el comentario lo dice: "quick commits and WIP should be frictionless").
  `pnpm commit` (czg) es la vía guiada cuando se quiere un mensaje convencional.
- **Pre-commit (lint-staged)**: no existe; husky solo tiene el hook `commit-msg`
  (vacío). Todo el lint/typecheck corre en CI, no en el commit local.
- **Remote cache de Turbo**: no configurado (ver Monorepo_and_Build).

## Flujo completo de un cambio

```
PR → ci.yml (lint + líneas + test + build)  ──┐
   → quality-gates.yml (typecheck + lint +    ├─ ambos deben pasar en main
      tests + coverage + property-based)      │
   → merge a main ──▶ Vercel deploy (CD)      ┘
```

- Los dos workflows corren en **push a main** y **PRs a main** — es decir, el
  gate completo se aplica también al merge (la rama destino).
- Node 22 fijo en ambos (determinismo de CI; el repo declara node >=18).
