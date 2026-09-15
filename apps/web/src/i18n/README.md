# Sistema de traducción (i18n)

Infraestructura de internacionalización del UI (React 19 + Vite). Basado en
**react-i18next + i18next**, con locales **en** (base) y **es** embebidos
(sin backend de traducciones — los JSON viajan en el bundle).

## Arquitectura

```
apps/web/src/i18n/
├── index.ts          # Init de i18next (singleton) + helpers
├── resources.d.ts    # Tipado de claves (CustomTypeOptions de i18next)
├── locales/
│   ├── en.json       # Idioma fuente (obligatorio: toda clave vive aquí)
│   └── es.json       # Traducción al español
└── README.md         # Este documento
```

- **Un único punto de init**: `import "./i18n"` en `apps/web/src/App.tsx`.
  App es el componente raíz compartido por la PWA (`apps/web/src/main.tsx`)
  y la app de escritorio Tauri (`apps/desktop/src/main.tsx`), así que ambos
  productos inicializan la misma instancia.
- **La preferencia vive en el store**, no en un detector: `preferencesStore`
  (`packages/state`, persistido en `cubeforge-prefs`) expone
  `language: 'auto' | 'en' | 'es'` (por defecto `'auto'`, que sigue el idioma
  del navegador). El selector de **Settings → General** (banderas US/ES vía
  `CountryFlag`, ver `GeneralSection.tsx`) llama a
  `preferencesStore.setLanguage(...)` — el módulo de i18n se suscribe al
  store y cambia el idioma. No hay doble fuente de verdad.
- **Claves tipadas**: `t()` y `useTranslation()` rechazan en compilación
  cualquier clave que no exista en `en.json` (ver `resources.d.ts`).
- **`<html lang>` sincronizado** automáticamente (accesibilidad / herramientas
  de traducción).
- **Sin Suspense**: los recursos van embebidos (`initImmediate: false`,
  `useSuspense: false`) — las traducciones están listas en el primer render.

## Requisito de toolchain: TypeScript 6 en el editor

Los `ParseKeys` tipados de i18next v26 se resuelven de forma **opuesta** en TS
5.x vs 6.x: con 5.x, `useTranslation('ns')` exige claves con prefijo
(`t('settings:key')`), que `tsc` 6.0.x rechaza (y al revés con claves simples).
Todo el monorepo usa TS **6.0.x** (raíz, `packages/*` y `apps/*` — todos
`~6.0.2`), así que el editor debe usar la misma versión o verás falsos
positivos `TS2345` en `t("key")`.

- `.vscode/settings.json` (raíz) ya fija `"typescript.tsdk": "node_modules/typescript/lib"`,
  y `apps/web/.vscode/settings.json` hace lo propio para la carpeta `apps/web`
  (red de seguridad si se abre esa carpeta suelta). Ambos son locales
  (`.vscode/*` está en `.gitignore`).
- Si cambias de máquina o aparecen errores `TS2345` en `t(...)`: recargar la
  ventana y, si VS Code pregunta, elegir **Use Workspace Version** (o
  `Ctrl/Cmd+Shift+P` → *TypeScript: Select TypeScript Version* →
  *Use Workspace Version* → *Restart TS Server*).

## Cómo se usa

En un componente React:

```tsx
import { useTranslation } from "react-i18next";

export function MyView() {
  const { t } = useTranslation();          // namespace por defecto: "common"
  const { t: tNav } = useTranslation("nav"); // otro namespace

  return <h1>{t("settings.language")}</h1>;
}
```

Fuera de React (toasts, helpers, utilidades):

```ts
import i18n from "@/i18n";
i18n.t("timer:scrambleCopied");
```

⚠️ El `t()` global (`i18n.t`) solo tipa claves con **prefijo de namespace**
(`"ns:clave"`) para namespaces que no sean `common`; la forma con punto
(`"timer.scrambleCopied"`) solo es válida en el `t` ligado que devuelve
`useTranslation("timer")`. Usa `i18n.t("ns:key")` en código no-React.

## Cómo se añade una clave

1. Añade la clave a `en.json` (el idioma fuente) en el namespace apropiado
   (`common`, `nav`, `settings`, `timer`, `views`, o crea uno nuevo).
2. Añade la MISMA clave a `es.json`. En runtime, cualquier clave ausente
   cae al inglés (`fallbackLng: "en"`), pero la paridad en/es debe mantenerse.
3. El tipado (`resources.d.ts`) se actualiza solo al tocar `en.json`.

Plurales e interpolación (sintaxis i18next):

```json
{ "solves": "{{count}} solves", "solves_one": "{{count}} solve" }
```

```tsx
t("solves", { count: n }) // "1 solve" / "3 solves"
```

## Playbook de migración (estado: infraestructura lista, 0 vistas migradas)

La infraestructura está montada; los ~62 archivos con texto hardcodeado
siguen en inglés. Orden recomendado para migrar en tandas pequeñas y
verificables:

1. **Constantes de UI** — `sidebar.constants.ts` (`NAV_GROUPS`), `settings.constants.ts`,
   `PUZZLE_CATEGORIES` en `utils/puzzleUtils.ts`. Los labels pasan a `nav.*` /
   `settings.*` en los archivos de constants.
2. **Layout & shell** — `Header.tsx`, `LeftSidebar.tsx`, `MobileMoreSheet.tsx`,
   `MobileTabBar.tsx`, `AppShell.tsx` (aria-labels, tooltips, títulos).
3. **Settings** — las secciones de `components/Settings/sections/*` (muchos
   labels + descripciones).
4. **Timer** — `TimerStage.tsx`, `TimerDisplay.tsx`, `SlotLayout.tsx` y
   toasts del flujo de solves.
5. **Vistas grandes** — Insights/Análisis, Training, Skill Tree, Profile,
   Reconstrucciones, Onboarding (la mayoría de los strings viven aquí).
6. **Datos de contenido** — `views/SkillTree/skillTreeData.ts`
   (títulos/descripciones de skills; evaluar si la traducción va en el JSON
   del skill o como diccionario), onboarding tour, `countries.ts` (mejor con
   `Intl.DisplayNames` que con traducción manual).

Herramienta de extracción (opcional, cuando empiece la migración):
[i18next-parser](https://github.com/i18next/i18next-parser) escanea
`t("...")` y sincroniza los JSON. `pnpm --filter web add -D i18next-parser`
y configurar `i18next-parser.config.mjs` en `apps/web`.

## Gotchas detectados en la auditoría (a resolver durante la migración)

- **TTS del timer** — `apps/web/src/utils/audioSystem.ts` fuerza
  `utterance.lang = "en-US"`. Debe usar el idioma activo (leería "8" como
  "ocho" en español).
- **Fechas hardcodeadas** — `ProfileHero.tsx` usa
  `toLocaleDateString("en-US")`. Reemplazar por `Intl.DateTimeFormat` con el
  locale activo (date-fns ya está instalado para casos complejos).
- **Plantillas interpoladas** — p. ej. `` `Delete “${name}”?` `` en
  `Header.tsx`: convertir a claves con interpolación, no a strings concatenados.
- **Idioma del documento** — `index.html` conserva `lang="en"` estático;
  el JS lo sincroniza tras el primer render (correcto para el primer paint).
- **packages/ui** — los componentes compartidos (`calendar.tsx`, `chart.tsx`)
  tienen texto hardcodeado. Como `@cubalyze/ui` se bundlea dentro de web,
  sus componentes pueden importar `useTranslation` del singleton de web sin
  dependencia extra.

## Añadir un idioma nuevo

1. `AppLanguage` en `packages/state/src/store.ts` (`'de'` por ejemplo).
2. Crear `apps/web/src/i18n/locales/de.json` copiando `en.json` como plantilla.
3. Añadir la entrada a `SUPPORTED_LANGUAGES` y a `SUPPORTED_LNGS` en
   `apps/web/src/i18n/index.ts`.
4. Ajustar `detectBrowserLanguage()` si el idioma debe auto-detectarse.
5. Considerar locales de date-fns / `Intl` para fechas y números.
