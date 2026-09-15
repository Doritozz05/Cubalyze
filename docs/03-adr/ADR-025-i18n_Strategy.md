---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-08-12"
last_updated: "2026-08-12"
version: "1.0.0"
related_rfc: "Ninguno (decisión registrada retroactivamente el 2026-08-12)"
supersedes: "None"
superseded_by: "None"
tags: "i18n, internacionalización, i18next, react-i18next, typed-keys"
document_type: "ADR"
---

# ADR-025 — Estrategia de Internacionalización (i18n)

> **Nota de registro:** decisión ya implementada (sistema de i18n con 13 tandas de
> migración completadas, ver historial `feat(i18n)`), registrada retroactivamente
> el 2026-08-12 en la Fase 1 de documentación porque nunca se había documentado.

## Context and Problem Statement

La app es bilingüe (español/inglés) y toda la UI (vistas, widgets, toasts,
notificaciones, TTS, datos del catálogo) debe traducirse. Los requisitos:

- **Offline-first**: los textos deben estar disponibles en el primer render sin
  red (ADR-008) → sin cargar locales desde un backend.
- **Sin fallos de traducción silenciosos**: un key mal escrito no debe renderizar
  el key en producción.
- **Rendimiento**: la inicialización no debe bloquear el primer pintado.
- **Preferencia de idioma persistida** y detección del navegador (`auto`).

## Decision Drivers

- **Cero red / sync init**: locales bundled, disponibles desde el primer render.
- **Seguridad de tipos**: los keys deben validarse en compilación
  (`useTranslation()` solo acepta keys existentes).
- **Un solo origen de verdad** para el idioma: la preferencia vive en
  `preferencesStore` (persistido en localStorage `cubeforge-prefs`), no en un
  detector cacheado.
- **Organización por dominios**: namespaces por área (common, training,
  algorithms, skillTree…) para no tener un JSON monolítico gigante.

## Considered Options

- **Opción 1 (elegida): react-i18next + i18next** con recursos bundled
  (`en.json`, `es.json`), init síncrono, keys tipados y namespaces por dominio.
- **Opción 2: JSON plano + acceso manual** (dicts y `t(key)` sin tipos).
  Funciona, pero cualquier typo de key rompe en runtime sin aviso.
- **Opción 3: i18next con backend** (carga asíncrona de locales). Permite añadir
  idiomas sin redeploy, pero viola el offline-first y añade latencia al primer
  render.
- **Opción 4: sin i18n** (strings hardcodeados). Rechazado: el producto exige
  ES/EN.

## Decision Outcome

Chosen option: **Opción 1 — react-i18next + i18next con recursos bundled y keys
tipados** (`apps/web/src/i18n/index.ts`).

### Detalles de la implementación

- **Locales bundled**: `en.json` y `es.json` importados como módulos; init
  síncrono (`resources` + `fallbackLng: "en"` + `react: { useSuspense: false }`).
- **Keys tipados**: `en.json` es la fuente de verdad; `resources.d.ts` genera el
  tipo `ParseKeys` — `t()` en React y no-React (`import i18n from "@/i18n"`) solo
  acepta keys existentes (fallo en compilación, no en runtime).
- **Namespaces por dominio**: `common` (por defecto) + uno por área
  (training, algorithms, skillTree, …), derivados de las claves de `en.json`.
- **Preferencia**: `AppLanguage` en `preferencesStore` (`en` | `es` | `auto`);
  `auto` resuelve con `detectBrowserLanguage()` (navegador), `resolveLanguage()`
  da el idioma efectivo. El selector vive en Settings → General.
- **A11y**: el evento `languageChanged` mantiene `<html lang>` en sync (lectores
  de pantalla y herramientas de traducción).
- **Datos del catálogo**: el catálogo de `@cubalyze/algorithm-db` permanece en
  inglés como fuente canónica; la UI lo localiza en el punto de render (mapas
  `METHOD_DESC_KEY`/`PHASE_DESC_KEY`/`SUBSET_DESC_KEY` en DashboardSections).
- **Migración por tandas**: el paso de strings hardcodeadas a keys tipados se
  hizo por zonas (Settings, widgets, vistas, datos) — ver
  `apps/web/src/i18n/README.md` (playbook) y el historial `feat(i18n)`. Las
  traducciones van en el mismo PR que el código (docs-as-code, ADR-021).

### Positive Consequences

- Cero fallos de traducción silenciosos (tipos en compilación).
- Primer render con el idioma correcto, sin red ni Suspense.
- Un solo origen de verdad para el idioma (store persistido) y `<html lang>` sync.
- El catálogo no se duplica por idioma (se localiza en la UI).

### Negative Consequences

- Añadir un idioma exige editar `en.json`/`es.json` + tipos (requiere redeploy —
  aceptado por el modelo offline).
- El sistema de tandas fue laborioso (13 tandas) y exige disciplina para que los
  nuevos componentes usen keys desde el día 1.

## Unresolved Questions

- ¿Se añadirán más idiomas (el selector ya es extensible vía `SUPPORTED_LANGUAGES`)?
- ¿Debería el catálogo de `algorithm-db` ofrecer descripciones localizadas como
  API (en vez de localizar en la UI), cuando el SDK público (ADR-003) exista?
