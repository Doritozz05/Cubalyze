# Auditoría de Drift de ADRs — 2026-08-12

**Alcance:** los 23 ADRs de `docs/03-adr/` verificados contra el código real del
monorepo (apps + packages + configs). Parte de la **Fase 0** del plan de
documentación (`docs/DOCUMENTATION_PLAN.md`).

**Estado: APLICADO el 2026-08-12** — los ADRs 012/015/017/018 se actualizaron a la
implementación real, ADR-022 se corrigió (MIT), se añadieron notas de estado a
004/005/006/007/011/019/023, y el `Architecture_Decision_Register` quedó al día.

**Método:** cada decisión se comprobó contra el código (dependencias reales,
estructura de carpetas, implementaciones). No se leyó la memoria ni el historial
de commits (mayormente "fix" sin valor).

---

## ✅ Correctos y verificados (14)

| ADR | Decisión | Verificación |
| --- | --- | --- |
| ADR-001 | Monorepo con Turborepo | `turbo.json` presente y activo (build/dev/test) |
| ADR-002 | pnpm como package manager | `pnpm-workspace.yaml` + `pnpm-lock.yaml` |
| ADR-003 | Estructura estricta `/apps` y `/packages` | Estructura real coincide (3 apps, 19 packages) |
| ADR-005 | Vitest (unit) | `vitest` en root devDeps + `__tests__` en varios paquetes |
| ADR-006 | GitHub Actions + Changesets | `.github/workflows/{ci,quality-gates}.yml` + `.changeset/` |
| ADR-008 | React + Vite SPA + PWA plugin | React 19.2.7, Vite 8.1.1, `vite-plugin-pwa` ✅ |
| ADR-009 | Zustand para estado | `zustand` en `apps/web` (stores reales) |
| ADR-010 | Licencia MIT | `LICENSE` = MIT (© 2026 Javier Vivo Samaniego) |
| ADR-013 | SQLite WASM sobre OPFS | `packages/database` con `worker.ts`, `client.ts`, OPFS confirmado |
| ADR-014 | Three.js puro (sin R3F) | `cube-3d-engine` usa `three` + `three-stdlib`; cero `react-three-fiber` |
| ADR-016 | Web Workers + Comlink | `comlink` en web/desktop/3d; DB worker dedicado ✅ |
| ADR-020 | A11y con WAI-ARIA Live Regions | `aria-live` en `TimerDisplay`, `OnboardingTour`, `lib/announce.ts` |
| ADR-021 | Docs en Markdown versionado | `docs/` estructurado en el repo ✅ |
| ADR-022 | Conventional Commits + husky + CoC | `commitlint` + `husky` + `czg` + `CODE_OF_CONDUCT.md` + `SECURITY.md` |

---

## 🟡 Parciales o con errores internos (6)

| ADR | Hallazgo | Acción sugerida |
| --- | --- | --- |
| ADR-004 | Dice "**no** utilizar Husky ni Conventional Commits", pero el repo SÍ los usa (husky, commitlint, czg). El ADR quedó obsoleto cuando se adoptó ADR-022. | Corregir el texto o marcarlo superseded parcialmente |
| ADR-005 | Vitest ✅ pero **sin Playwright** (no hay `playwright.config.*`, E2E no montado) | Añadir nota "E2E pendiente" o fijar el ADR al estado real |
| ADR-006 | Sin **Turbo Remote Caching** configurado (`turbo.json` no tiene `remoteCache`) | Decisión adoptada, implementación pendiente |
| ADR-007 | Vercel ✅ (`vercel.json`) pero **Supabase no existe** (ni carpeta, ni proyecto) | Marcar backend como "pendiente de implementación" |
| ADR-011 | OPFS ✅ pero **sin `navigator.storage.persist()`** (solo `estimate()`) y **sin sync a Supabase** | Marcar partes pendientes |
| ADR-022 | Dice "liberado bajo **GPLv3**" pero `LICENSE` = **MIT** (contradice ADR-010). Además falta `CONTRIBUTING.md` | Corregir el error factual; crear CONTRIBUTING.md |

---

## 🔴 Discrepancias de implementación (4)

| ADR | Decidido | Implementado | Nota |
| --- | --- | --- | --- |
| ADR-012 | **Capacitor.js** para BLE en iOS | **Tauri** (`apps/desktop`, plugins `@tauri-apps/*`). Cero Capacitor en el repo | La app de escritorio es Tauri; el wrapper móvil (Capacitor) no existe. DEC-22 lo tenía como "Blocked". |
| ADR-015 | min2phase **compilado a WASM** | `min2phase.js` (npm, **JS puro**) vía `import min2phase from 'min2phase.js'` | Se respondió la "Unresolved Question" eligiendo el paquete NPM, sin WASM |
| ADR-017 | Plugins como **paquetes separados** (`packages/plugins/*`) | Sistema de **widgets** dentro de `apps/web/src/widgets/` (10 implementaciones) | El sistema de widgets es el heredero práctico del plugin system, pero vive en la app, no en packages |
| ADR-018 | Firmas criptográficas (Web Crypto) para solves | **No implementado** — sin `crypto.subtle` en el código (los matches son `sign()` matemático) | Decisión aceptada pero cero implementación |

---

## 🔴 Aceptados pero sin implementación (2)

| ADR | Estado real |
| --- | --- |
| ADR-019 | Supabase + Event Sourcing append-only: **no implementado** (`apps/api` vacío, sin carpeta `supabase/`) |
| ADR-023 | CD de Supabase (migraciones automáticas): **no implementado**. El auto-deploy de Vercel existe vía `vercel.json`, pero no hay pipeline de migraciones ni tags git (0 releases) |

---

## 🗂️ Registro de decisiones (Architecture_Decision_Register.md)

El registro está **desactualizado**: 8 filas dicen "No creado / Ready For ADR" para
ADRs que **ya existen**:

- DEC-11 → ADR-015 existe
- DEC-12 → ADR-016 existe
- DEC-16 → ADR-017 existe
- DEC-17 → ADR-018 existe
- DEC-18 → ADR-019 existe
- DEC-19 → ADR-020 existe
- DEC-21 → ADR-022 existe
- DEC-24 → ADR-023 existe

---

## Resumen

- **14 ADRs** verificados y correctos ✅
- **6 ADRs** con correcciones menores o notas de pendientes 🟡
- **6 ADRs** con discrepancia real entre lo decidido y lo implementado 🔴
  (012, 015, 017, 018, 019, 023 — las de implementación) + registro con 8 filas erróneas

**Resolución (2026-08-12, aprobada por el usuario):** se actualizaron los ADRs para
reflejar la implementación real (opción A). ADR-022 corregido a MIT; las notas de
estado marcan qué queda pendiente (Playwright, remote cache, Supabase, persist,
CONTRIBUTING en `docs/15-contributing/`).
