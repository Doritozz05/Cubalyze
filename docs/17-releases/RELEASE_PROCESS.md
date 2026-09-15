# Proceso de Release

> Documentado el 2026-08-12 (Fase 8). Se asienta la política **antes** del primer
> release; las herramientas ya están instaladas (changesets, czg, Vercel).

## 0. Panorama

CubeForge tiene **dos canales de release** distintos:

1. **La web/PWA** — se despliega sola: cada merge a `main` dispara el deploy de
   Vercel (ADR-023). No lleva tag ni changelog de paquete.
2. **Los paquetes** (`packages/*`) — candidatos a publicarse en NPM como SDK
   (ADR-006). Hoy **todos son `private: true` excepto `@cubalyze/cube-3d-engine`**,
   así que el pipeline de NPM solo se activará cuando un paquete se abra al
   público.

El **git tag** es el hito que une ambas cosas: marca "este commit es el release".

## 1. SemVer (política)

Según `docs/08-standards/Versioning_and_Dependency_Management.md`:

- `MAJOR` — cambios de API incompatibles. En `0.x`, subir `minor` (p.ej.
  `0.1.0 → 0.2.0`) para cambios que romperían en `1.x`.
- `MINOR` — funcionalidad nueva compatible hacia atrás.
- `PATCH` — arreglos compatibles.

> Regla para este proyecto: mientras esté en `0.x`, el salto `minor` marca
> "features nuevas" y el `patch` "arreglos". El `1.0.0` se decidirá cuando la
> API de los paquetes se estabilice.

## 2. Convención de commits (entrada del changelog)

- Conventional Commits con `pnpm commit` (czg): `feat`, `fix`, `docs`, `refactor`,
  `perf`, `test`, `chore`, `build`, `ci`, `revert`.
- El hook de husky **no bloquea** (decisión deliberada, ADR-028): la disciplina
  es responsabilidad del autor, y la validación vive en CI si se decide endurecer.

## 3. Changesets (paquetes → NPM)

Herramienta: `@changesets/cli` (configurado en `.changeset/config.json`;
`baseBranch: main`, `access: restricted`, `commit: false`).

### Flujo por cada PR con cambios de paquetes

```bash
pnpm changeset add    # interactivo: elige qué paquetes y el bump (patch/minor/major)
```

Crea un archivo `.changeset/<nombre>.md` con frontmatter de bumps y una
descripción breve. **Sin changeset, no hay changelog ni bump.**

### En el release

```bash
pnpm changeset version   # consume los changesets: bumps + CHANGELOG.md por paquete
git commit -am "chore: version packages"   # o como parte del PR de release
pnpm release             # = pnpm build && changeset publish → NPM
```

Detalles:

- `changeset publish` publica **solo paquetes con `private: false`**; los
  privados se saltan (sus bumps quedan como registro interno).
- `access: restricted` exige cuenta NPM con acceso; cuando un paquete SDK se
  abra al público, cambiar a `access: public` en ese paquete.
- La web **no** se versiona con changesets (la despliega Vercel).

## 4. El tag (hito de release)

Al cerrar un release:

```bash
git tag -a v0.1.0 -m "CubeForge v0.1.0 — <resumen>"
git push origin v0.1.0
```

Convención: `v<major>.<minor>.<patch>` (prefijo `v`). El tag apunta al commit
de main que se consideró el release. **Nunca se re-taguea un commit distinto**
(si hay que corregir, es un patch nuevo).

## 5. Primer release (estado 2026-08-12)

- **Versión actual:** raíz `0.0.0`; paquetes con código en `0.1.0`; placeholders
  en `0.0.0`. Sin tags.
- **Preparado por la Fase 8 (2026-08-12):** primer changeset con bumps `minor`
  (`0.1.0 → 0.2.0`) para los 15 paquetes con fuentes, aplicado con
  `changeset version` → `CHANGELOG.md` generados por paquete (y patch en las
  apps dependientes).
- **Propuesta de tag:** primer tag `v0.2.0` sobre `main` (coincide con la
  versión de los paquetes) con la web ya desplegada.
- **Pendiente de decisión del usuario (checkpoint):**
  1. ¿El bump `minor` (0.2.0) es correcto o se prefiere `patch` (0.1.1)?
  2. ¿Se crea el tag `v0.2.0` al mergear esta rama a `main`?
  3. ¿Se abre algún paquete a NPM (p.ej. `cube-3d-engine` como SDK público)?

> **Nota:** no se publica nada a NPM sin credenciales + decisión explícita.
> `pnpm release` es la puerta de salida y requiere tu cuenta.
