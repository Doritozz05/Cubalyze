# Convención de commits y Releases

## Convención de commits (ADR-022 + Git_Workflow)

El estándar es **Conventional Commits** (documentado en
[docs/08-standards/Git_Workflow.md](../08-standards/Git_Workflow.md)). La
configuración de `commitlint.config.mjs` define lo que se considera válido:

- **Types**: `feat, fix, docs, style, refactor, perf, test, chore, build, ci,
  revert` (superset de los 8 documentados + `build/ci/revert` para que
  `git revert` y la paleta de czg nunca se rechacen).
- **Scope** opcional pero en kebab-case: `feat(hal): …`.
- **Subject** sin Start-case/Pascal-case/UPPER-case, sin punto final, header ≤100.

### Cómo se aplica (y cómo no)

- **`pnpm commit`** → abre `czg` (interfaz guiada de commitizen) y genera un
  mensaje convencional válido.
- **Husky** (`prepare: "husky"`) instala el hook `commit-msg`, pero el hook
  está **vacío a propósito**: `git commit` plano nunca se bloquea. Es una
  decisión explícita (ver [CI_and_Quality_Gates.md](./CI_and_Quality_Gates.md)
  y ADR-028) para que WIP y commits rápidos no tengan fricción.
- La validación real de convención, si algún día se endurece, solo requiere
  activar `commitlint --edit` en `.husky/commit-msg` — commitlint ya está
  instalado y configurado.

## Changesets (`.changeset/`)

Configuración en `.changeset/config.json`:

| Clave | Valor | Implicación |
|---|---|---|
| `changelog` | `@changesets/cli/changelog` | CHANGELOG.md autogenerado |
| `commit` | `false` | No crea commits automáticos por changeset |
| `access` | `restricted` | Publicación NPM restringida (privada de momento) |
| `baseBranch` | `main` | Compara contra main para detectar cambios |
| `updateInternalDependencies` | `patch` | Dependencias internas del workspace se actualizan con patch |
| `fixed` / `linked` | `[]` | Sin paquetes acoplados |

### Estado real

- **Configurado pero sin uso**: no hay ningún archivo `.md` de changeset, no
  hay tags git, `version: "0.0.0"` en la raíz y los paquetes están en `0.x`.
- El script `release` de la raíz es `pnpm build && changeset publish` — el
  pipeline de publicación a NPM existe pero no se ha ejecutado nunca (0 releases).

### Cómo se hará un release (proceso)

1. Cada PR con cambios de paquetes añade un changeset (`pnpm changeset add`) —
   describe el bump (`patch`/`minor`/`major`) y el cambio.
2. En el merge/release, `pnpm changeset version` consume los changesets,
   actualiza versiones y genera los CHANGELOG.md.
3. `pnpm release` publica a NPM (cuando `access` pase a público) y Vercel
   despliega la web.

> La **Fase 8** del plan de documentación cubre activar esto y crear
> `docs/17-releases/` con el proceso formal. Hoy queda documentado el estado:
> **sin releases** (0 tags), decisión de versionado pendiente con el usuario.

## Cadena de herramientas instalada

```
czg (commitizen guiado)  →  commitlint (validador, no bloqueante)  →  changesets (versionado)
```

- `@commitlint/cli` está en devDependencies de raíz y knip lo marca como
  "kept for future gate".
- `.gitattributes`: `* text=auto` (normalización LF).
- `.prettierrc` + `format` script: `prettier --write "**/*.{ts,tsx,md,json}"`.
