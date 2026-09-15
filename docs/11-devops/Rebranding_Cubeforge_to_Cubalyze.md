# Rebranding CubeForge → Cubalyze — Auditoría de impacto y plan de ejecución

> Estado: **AUDITORÍA / PLAN** — no se ha ejecutado ningún cambio de código.
> Fecha de medición: 2026-09-15 · rama `main` · HEAD: working tree limpio al inicio.
> Todas las cifras de este documento están medidas sobre el repo real con `git grep`
> (comandos reproducibles en §7).

---

## 0. Veredicto ejecutivo

| Métrica | Valor |
| --- | --- |
| **Complejidad** | **Difícil (7/10)** — la mecánica es trivial (sed), el *blast radius* no lo es |
| **Si se excluye el cambio de identidad de la app de escritorio** | Media (4/10) |
| **Si además se congela la capa de persistencia local (§4.1.1 — recomendado a esta escala)** | **Baja-Media (3/10)** · 18–25 h · riesgo de pérdida de datos = 0 |
| **Esfuerzo total** | **39–61 h/hombre** (1 ingeniero senior + acceso a Google Cloud Console y dashboards) |
| **Latencia externa (no es trabajo, es espera)** | 0–10 días calendario *si* la pantalla de consentimiento OAuth está publicada y verificada → re-verificación de Google |
| **Datos de usuario en riesgo** | 93 claves de persistencia local + 1 base IndexedDB + 1 SQLite de escritorio + 3 formatos de fichero exportado |
| **Requiere recrear proyectos Supabase/Vercel** | **No.** Ningún identificador que cargue datos contiene la marca |
| **Logout masivo de usuarios** | **No**, ver §3.3.3 |

### Las 5 conclusiones que cambian el plan

1. **El repo NO es Next.js.** Es un SPA de Vite 8 + React 19 en Turborepo/pnpm
   (`vercel.json` → `"framework": "vite"`, `outputDirectory: apps/web/dist`).
   No existen `next.config.mjs`, `metadataBase`, App Router ni metadata dinámica.
   Todo el SEO vive en `apps/web/index.html` (estático) + `public/robots.txt`,
   `public/sitemap.xml`, `public/llms.txt`. Cualquier instrucción de "Next.js" del
   brief es **no aplicable**; las reglas de redirección van en `vercel.json` (§7.4).
2. **Supabase está limpio de la marca.** 0 identificadores (tablas, esquemas,
   ENUMs, RPCs, columnas, buckets, políticas RLS) contienen `cubeforge`. El bucket
   es `locker-photos`. El *project ref* (`https://<ref>.supabase.co`) no lleva la
   marca → **el callback de Auth y los JWTs son inmunes a este rebranding**.
3. **El riesgo real no está en la nube, está en el cliente.** 93 literales de
   clave (`cubeforge-prefs`, `cubeforge:activeSessionId`, …) + `cube-forge-db`
   (IndexedDB) + `cubeforge.db` (SQLite escritorio) + los formatos de export
   `cubeforge-json` / `cubeforge-csv` / `cubeforge-locker`. Un `sed` inocente aquí
   **borra los datos de todos los usuarios existentes**. Requiere shim (§8).
4. **El único cambio de identidad realmente irreversible es el de Tauri**
   (`identifier: com.cubeforge.desktop`). Cambiarlo mueve el directorio de datos de
   la app de escritorio, crea una *segunda* app en macOS y rompe la continuidad del
   instalador. Tiene que ser una decisión explícita (§9).
5. **"Irreversible y cero residuos" tiene un límite físico: el historial de git.**
   1.183 commits contienen la marca. Eliminarla exige `git filter-repo` +
   force-push + invalidar todos los clones/PRs/protecciones: es la operación más
   peligrosa de todo el plan y **contradice** el requisito de zero-downtime.
   Recomendación: definir "residuo" como *lo que ven usuarios y buscadores*, y
   congelar el historial (§10).

---

## 1. Correcciones al brief (supuesto vs. realidad medida)

| Supuesto del brief | Realidad en el repo | Impacto en el plan |
| --- | --- | --- |
| Next.js | Vite 8 + React 19 SPA (`apps/web`), Tauri 2 (`apps/desktop`) | `next.config.mjs` no existe → redirects en `vercel.json` |
| `siteConfig` centralizado | **No existe ninguna constante de marca** (`siteConfig`, `APP_NAME`, `brandName`: 0 coincidencias) | 2 ficheros i18n + `index.html` + `vite.config.ts` con la marca *hardcodeada*. → introducir `BRAND` como parte del trabajo |
| `metadataBase`, OG dinámicos | Metadata estática en `apps/web/index.html` (líneas 11–18) | Edición manual; **no hay `og:image` en absoluto** (hueco previo, no una regresión) |
| `manifest.json` / `site.webmanifest` | No existe fichero estático: el manifest lo **genera** `vite-plugin-pwa` desde `apps/web/vite.config.ts` → `/manifest.webmanifest`. Sin `apple-touch-icon`, sin `favicon.ico`, sin `icons.svg` con la marca (favicon es `favicon.svg`) | El rename del manifest es un bloque de `vite.config.ts`, no un JSON |
| Esquemas/tablas/ENUMs/RPCs con la marca | 0 identificadores. Solo 3 comentarios + **1 lista de handles reservados** (§4.8) | Fase 3 de datos baja de "crítica" a "1 migration nueva" |
| Buckets con la marca | `locker-photos` (neutro) | Sin migración de storage |
| Google OAuth configurado en `supabase/config.toml` | `[auth.external.google]` está **comentado**, sin `client_id`. El provider real vive en el proyecto *hosted* | El trabajo OAuth es 100% dashboard (GCP + Supabase), 0 en el repo |
| Herramientas de analítica con IDs antiguos (PostHog/Sentry/GA…) | **No existe ninguna integración de analítica ni monitorización** (0 dependencias, 0 tags). Solo un buffer de logs local (`cubeforge:log-buffer`) | Vector cerrado: N/A |
| Renombrar el repo rompe remotos y CI | GitHub mantiene **redirect automático** del nombre viejo. `actions/checkout` no usa URLs absolutas | `git remote set-url` es opcional/cosmético, no un bloqueo |
| Publicar/deprecar paquetes npm `@cubeforge/*` | Los **20 paquetes llevan `"private": true`** y todas las deps son `workspace:*` | No hay deprecación npm; el scope es puramente interno |
| Dominio antiguo propio | El único dominio es el generado por Vercel: `cubeforge-phi.vercel.app` (10 refs) | Determina el plan de SEO/301 (§7.4, Plan A/B) |

---

## 2. Inventario medido

### 2.1 Volumen

| Ámbito | Ficheros | Líneas |
| --- | --- | --- |
| **Total (case-insensitive)** | **737** | **3005** |
| Código (`apps/` + `packages/`) | 577 | 1280 |
| Documentación (`docs/`) | — | 1546 |
| Infra / raíz (`*.json`, lockfile, CI, `supabase/`, `scripts/`, `tsconfig*`) | — | 179 |

Variantes: lowercase `cubeforge` → 1464 líneas · `CubeForge` → 341 líneas · `CUBEFORGE` → **0** (la variante mayúscula no existe en el repo).

### 2.2 Top ficheros (para calibrar el esfuerzo real)

| Fichero | Líneas | Naturaleza |
| --- | --- | --- |
| `docs/17-releases/CHANGELOG_MASTER.md` | **1136** | Histórico → **congelar** (§10) |
| `pnpm-lock.yaml` | 91 | **Generado** → regenerar con `pnpm install`, nunca editar |
| `docs/00-product/Ecosistema_Cubing_Investigacion_2026-08.md` | 43 | Doc viva |
| `apps/web/CHANGELOG.md` | 42 | Histórico |
| `apps/web/src/utils/importSolves.ts` | 32 | **Contrato de formato + ramas de parseo** |
| Resto | — | Ningún fichero de código supera 32 coincidencias |

**Conclusión de volumen:** el 38% de las coincidencias son un changelog histórico y el 3% un lockfile generado. El trabajo real de código está repartido en 577 ficheros con 1–16 coincidencias cada uno: **es un trabajo ancho, no profundo**.

### 2.3 Taxonomía por forma del nombre (el riesgo no es uniforme)

| Forma | Ocurrencias | Renombrable con `sed` | Riesgo |
| --- | --- | --- | --- |
| `@cubeforge/<pkg>` (imports/scope) | **1301** en ~592 ficheros | Sí (atómico) | **Medio** — rompe el build si queda a medias |
| `cubeforge:<key>` y `cubeforge-<key>` (persistencia) | 93 literales | Sí | **CRÍTICO** — pérdida de datos |
| `cubeforge-json` / `cubeforge-csv` / `cubeforge-locker` | ~40 + tests | Sí | **CRÍTICO** — rompe ficheros ya exportados por usuarios |
| `cube-forge-db` (IndexedDB snapshot) | 1 | Sí | **ALTO** — snapshot perdido |
| `com.cubeforge.desktop` (Tauri identifier) | 4 | Sí | **CRÍTICO** — identidad de app de escritorio (§9) |
| `cubeforge.db` (SQLite escritorio) + ruta AppData | 2 + 4 en docs | Sí | **ALTO** — BD huérfana |
| `cubeforge_lib` (crate Rust) | 2 | Sí | Bajo — **✅ PR-5**, compilado con `cargo check --offline` |
| `CubeForge Team` (autores Cargo) | 1 | Sí | Bajo — **✅ PR-5** |
| `cubeforge-phi.vercel.app` | 10 | Sí | **ALTO** — OAuth + SEO |
| `cubeforge-monorepo` (`package.json` raíz) | 1 | Sí | Nulo (privado) |
| `cubeforge` en handles reservados (SQL) | 1 | **NO** (migración ya aplicada) | **ALTO** — seguridad de identidad (§4.8) |
| Textos visibles / i18n / docs | ~150 | Sí | Medio |
| Historial de git (1183 commits) | ∞ | **No** sin reescritura | Decisión de política (§10) |

---

## 3. Auditoría por vector

### 3.1 Frontend, Metadata y Assets

| Elemento | Ubicación exacta | Acción | Riesgo si se olvida |
| --- | --- | --- | --- |
| `<title>` | `apps/web/index.html:16` (`cubeforge — Smart cube training platform…`) | Renombrar | Pestaña/PWA con marca vieja |
| `<meta description>` / `og:title` / `og:description` | `index.html:11,13,14` | Renombrar | Preview de enlace con marca vieja |
| `og:site_name`, `og:image`, `twitter:card`, `og:url`, `<link rel="canonical">` | **NO EXISTEN** | **Añadirlos** (mejora real de SEO, no regresión) | Sin control del snippet social |
| `theme-color` | `index.html:7` + `public/theme-color.js` | Sin cambios (es color) | — |
| Manifest PWA (`name`, `short_name`) | `apps/web/vite.config.ts` (bloque `VitePWA.manifest`) | `CubeForge` → `Cubalyze` | Nombre bajo el icono instalado |
| Iconos | `public/icon-192.png`, `public/icon-512.png`, `public/favicon.svg` | **Revisar si el wordmark está rasterizado dentro del PNG** (no son texto detectable por grep) | Icono con marca vieja en escritorio/móvil |
| `apple-touch-icon` / `favicon.ico` | **NO EXISTEN** | Añadir (iOS usa screenshot de la página si falta) | Icono genérico en iOS |
| SEO técnico | `public/robots.txt:4` (Sitemap), `public/sitemap.xml` (1 URL), `public/llms.txt` (9 refs + URL de GitHub) | Renombrar dominio + repo | Buscadores y crawlers LLM con URL muerta |
| i18n | `apps/web/src/i18n/locales/{es,en}.json`: `appName` (l.3), `appTitle` (l.20), `brand` (l.30), `updateAvailableBody` (l.22), `eyebrow`/`title` de Auth, `introBody`/`provenance` de créditos, `theory` (l.3550) | Renombrar **cada valor** | Marca mixta visible |
| i18n — **claves de formato** | `formatNameCubeforgeCsv` / `formatNameCubeforgeJson` (es.json:757–758) y su uso en `DataSection.tsx:41-42` | Renombrar clave **y** todos sus usos; los *valores* (“CubeForge CSV”) son texto visible | Rompe la UI de importación (clave huérfana) |
| Analítica / monitorización | No existe | — | — |
| Logs locales | `boot/logCapture.ts:25` (`cubeforge:log-buffer`), `boot/AppErrorBoundary.tsx:18,63` | Renombrar con shim | Flags de debug perdidos (menor) |
| Eventos internos de UI | `"cubeforge:open-logs"` en `AppErrorBoundary.tsx:63` y `LogViewer.tsx:33-34` | Renombrar **en los 3 sitios a la vez** | El visor de logs deja de abrirse (fallo silencioso) |

**Nota de arquitectura:** no existe fuente única de verdad de marca. Propuesta: crear
`apps/web/src/brand.ts` (+ `packages/*` para el scope) y consumirlo desde `index.html`
por `define` en Vite, de forma que el *siguiente* rebranding sea un fichero.

### 3.2 Supabase y Base de Datos

| Vector | Hallazgo medido | Acción |
| --- | --- | --- |
| Esquemas, tablas, columnas, ENUMs, RPCs | **0 identificadores con la marca** | Ninguna |
| Comentarios en migrations | 3 (`20260821000000_accounts.sql:2`, `20260912000018_friends_rpc.sql:37,946` — este último cita `@cubeforge/statistics`) | Corregir solo como higiene documental (ficheros ya aplicados: **no editables**) |
| RLS / triggers dependientes de claims o dominios | No hay claims ni dominios con la marca | Ninguna |
| Buckets | `locker-photos` (`20260912000013_locker_photos_bucket.sql:31`) — neutro. Políticas por `bucket_id`, sin marca | Ninguna |
| URLs públicas hardcodeadas en BD | Ninguna | Ninguna |
| **Handles reservados** | `20260912000016_handle_identity.sql:69` reserva `'cubeforge'` junto a `'admin'`, `'root'`… | **Añadir `'cubalyze'` con una migration NUEVA** y **mantener `'cubeforge'`** (nunca liberar el handle viejo) |
| Edge Functions | `delete-account`, `friend-photo-urls` — 0 refs a la marca | Ninguna |
| Drift local/prod | No verificable desde aquí sin `supabase link` (requiere credenciales) | `supabase db diff --linked` antes de tocar nada (§7.2) |
| `supabase/config.toml` | `project_id = "cubeforge"` (afecta **solo al naming de contenedores locales**), `site_url` y `additional_redirect_urls` apuntan a `cubeforge-phi.vercel.app` y `localhost:5173` | `project_id` + URLs (§3.3) |

**Riesgo residual real:** bajo. Este vector deja de ser un cuello de botella.

### 3.3 Autenticación, OAuth y Google Cloud Console

#### 3.3.1 Cómo funciona hoy (leyendo el código, no suponiendo)

- Cliente Supabase creado en `packages/sync-engine/src/client.ts` con
  `flowType: "pkce"`, `persistSession: true`, `detectSessionInUrl: true`.
- Login: `apps/web/src/hooks/useAccount.ts:246` →
  `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: \`${window.location.origin}/auth\` } })`.
- **`redirectTo` se deriva de `window.location.origin`** → es agnóstico al dominio.
  Esto es la buena noticia estructural: el flujo sobrevive a un cambio de dominio
  **siempre que el origen nuevo esté en la allowlist de Supabase Auth**.
- Ruta de retorno: `/auth` (`App.tsx:527`), que también intercambia el `code` PKCE.

#### 3.3.2 Puntos de configuración a tocar (en este orden)

| # | Sitio | Qué cambiar | Cuándo |
| --- | --- | --- | --- |
| 1 | **Supabase Dashboard → Authentication → URL Configuration** | `Site URL` = dominio nuevo; añadir a `Redirect URLs`: `https://<dominio-nuevo>/auth`, y **mantener** las viejas durante la transición | **Antes** del cutover (si falta → `redirect_uri_mismatch` y login roto) |
| 2 | **Google Cloud Console → APIs & Services → Credentials → OAuth client (Web)** | `Authorized JavaScript origins`: añadir origen nuevo (el viejo puede quedarse). **`Authorized redirect URI` NO cambia**: sigue siendo `https://<project-ref>.supabase.co/auth/v1/callback` (el ref no lleva la marca) | Antes del cutover |
| 3 | **Google Cloud Console → OAuth consent screen** | `App name` → Cubalyze; `Authorized domains` → dominio nuevo; logo, homepage, privacy policy URL | Antes del cutover |
| 4 | `supabase/config.toml` | `site_url`, `additional_redirect_urls`, `project_id` | Con el PR de código |
| 5 | Vercel env vars | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | **No cambian** (no contienen la marca) |

**⚠️ Re-verificación de Google:** si la app OAuth está **External + Published/Verified**, cambiar el `App name` y los dominios autorizados **dispara una nueva revisión** (días, con feedback en bucle si el dominio no está verificado en Search Console). Si está en **Testing**, el cambio es instantáneo.
**Acción de desbloqueo (semana 0): abrir el consent screen y comprobar el estado. Es el único elemento que puede alargar el calendario y no depende de código.**

Plan B si la re-verificación bloquea: **crear un segundo OAuth client** (Cubalyze) y mantener el antiguo activo hasta que el nuevo esté verificado; el `client_id` es configuración de Supabase, no código → cambio en caliente sin deploy.

#### 3.3.3 ¿Logout masivo? **No. Y esto es demostrable**

- Los JWT los emite Supabase; su validez no depende del nombre ni del dominio.
- La sesión se persiste con la `storageKey` por defecto de supabase-js:
  `sb-<project-ref>-auth-token` — **no contiene la marca**, así que ningún rename
  de claves propias (`cubeforge-prefs` → …) la toca.
- `autoRefreshToken: true` + `detectSessionInUrl` → el refresh sigue funcionando en
  el dominio nuevo porque no hay binding de dominio en el token.

**Condiciones que SÍ provocarían logout masivo (lista de prohibiciones):**
1. Recrear el proyecto Supabase (cambia el ref → todas las sesiones y datos sincronizados se pierden). **Nunca hacerlo.**
2. Cambiar de librería de auth o la `storageKey` explícitamente.
3. Un `sed` global que arrastre cualquier clave que empiece por `sb-` (no ocurre en
   este repo, pero hay que revisar el diff del codemod).

**Mitigación recomendada igualmente:** comunicar en la UI (toast de `updateAvailableBody`) y monitorizar `auth.*` en logs durante 48 h post-cutover.

### 3.4 Infraestructura, Vercel y Dominios

| Vector | Estado medido | Acción y riesgo |
| --- | --- | --- |
| Proyecto Vercel | Nombre del proyecto: **desconocido desde el repo** (no hay `.vercel/project.json` versionado). Dominio generado: `cubeforge-phi.vercel.app` | Renombrar el proyecto es **cosmético**; al hacerlo Vercel genera un dominio nuevo y **no se puede renombrar un dominio `*.vercel.app` ni hacer 301 desde un dominio que ya no controlas**. Regla: **no renombrar el proyecto** salvo necesidad; añadir dominio nuevo y conservar el viejo como alias |
| Dominio primario/secundario | Un solo dominio generado, referenciado en 10 sitios (robots, sitemap, llms.txt, `config.toml`, docs) | Ver Plan A/B en §7.4 |
| Build | `vercel.json`: `buildCommand: npx turbo run build --filter=web`, `outputDirectory: apps/web/dist`, rewrite SPA `/((?!api/\|.*\..*).*)` → `/index.html` | Los `redirects` se evalúan **antes** de los `rewrites` → la regla host-based no puede tragarse assets ni `/api` |
| Cabeceras/CSP/COOP/COEP | `vercel.json` (bloque `headers`) — **no contienen la marca** | Sin cambios. Ojo: COOP/COEP son requisito de OPFS (`vite.config.ts` lo documenta) → no tocar |
| SSL/TLS | Automático en Vercel por dominio | Se emite solo tras verificar DNS; planificar solape |
| DNS | Desconocido desde el repo | Si hay dominio propio (Plan A): añadir `A 76.76.21.21` o `CNAME cname.vercel-dns.com` **con antelación** (propagación + emisión de certificado) y **no** tocar los `TXT` de verificación existentes hasta validar |
| Webhooks | No existen webhooks entrantes/salientes (sin Stripe, sin GitHub App, sin Supabase webhooks) | Vector cerrado: N/A |
| **Service Worker (propio de este stack)** | `vite-plugin-pwa` con `registerType: 'prompt'`, `clientsClaim`, `navigateFallback: null`, caches `pages`/`apis` | **Landmine PWA:** las instalaciones existentes tienen un SW *origin-scoped* en el dominio viejo que puede servir app shell cacheado con la marca vieja. Requiere SW tumba (§7.4) |
| `version.json` | `public/version.json` (version + sha + builtAt) | Generado en build (`scripts/gen-version-json.mjs`); sin marca |

### 3.5 Variables de entorno, Configuración y Repositorio

| Vector | Hallazgo | Acción |
| --- | --- | --- |
| Variables de entorno | **Ningún nombre de variable contiene la marca** (solo `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | Solo hay que revisar **valores** en el dashboard de Vercel (URLs de callback si existieran). No hay `.env.local`/`.env.production` versionados |
| `package.json` raíz | `"name": "cubeforge-monorepo"` | Renombrar (sin efecto funcional) |
| 20 paquetes | `@cubeforge/*`, todos `private: true`, deps `workspace:*` | Renombrar scope (§7.3). Sin impacto npm |
| `apps/api` | Solo contiene `package.json` (`@cubeforge/api`) — **carpeta vestigial** | Decidir: renombrar o eliminar |
| `pnpm-lock.yaml` | 91 refs (importers + versiones publicadas resueltas) | **Regenerar con `pnpm install`**, nunca editar a mano |
| Config TS/ESLint/Knip/Typedoc | `tsconfig.json`, `tsconfig.typedoc.json`, `typedoc.json`, `knip.jsonc`, `vitest.config.ts`, `packages/*/tsconfig.json`, `apps/web/eslint.config.js`, `apps/desktop/vite.config.ts` | Alias `@cubeforge/*` → `@cubalyze/*` en **todos** |
| CI/CD | `.github/workflows/quality-gates.yml` (8 refs: filtros `--filter @cubeforge/...`) | Renombrar filtros. GitHub Actions **no** usa URLs absolutas; el rename del repo no rompe CI |
| Repo GitHub | `https://github.com/Doritozz05/Cubeforge.git` | Renombrar en GitHub **mantiene redirect** del nombre viejo → remotos y clones existentes siguen funcionando; `git remote set-url origin` es recomendable, no crítico |
| Branch protections / Secrets / Rulesets | No visibles desde el repo | Verificar en GitHub tras el rename (los rulesets referencian el repo por ID, sobreviven) |
| Licencia | `LICENSE` (MIT) → `Copyright (c) 2026 Javier Vivo Samaniego` — **no contiene la marca** | Sin cambios legales |
| Atribución de autoría | `apps/desktop/src-tauri/Cargo.toml:5` → `authors = ["CubeForge Team"]` | Renombrar |
| Artefactos generados | `apps/desktop/src-tauri/gen/schemas/capabilities.json`, `Cargo.lock` | **Regenerar** (no editar a mano) |
| Artefactos no versionados con la marca | `dist/`, `.turbo/`, `vite.log`, `web.log`, `.codegraph/`, `.impeccable/`, `.freebuff/` | Limpiar/regenerar; excluir de la auditoría |

---

## 4. Landmines (hallazgos que el brief no contempla y que rompen producción)

### 4.1 Pérdida de datos del cliente (el riesgo #1)

93 literales de clave. Los que importan de verdad:

| Clave | Fichero | Qué se pierde si se renombra sin shim |
| --- | --- | --- |
| `cubeforge-prefs` | `packages/state/src/store.ts:666` (zustand `persist`) **y duplicada en `apps/web/public/theme-bootstrap.js:11`** | Todas las preferencias + **flash de tema incorrecto en el primer paint** (el bootstrap corre antes del bundle y leería una clave inexistente) |
| `cubeforge-locker` | `apps/web/src/views/Collection/collectionStore.ts:83` | La colección entera (fotos/notas de cubos) |
| `cubeforge:custom-algs` | `packages/state/src/algorithm.store.ts:225` | Algoritmos personalizados |
| `cubeforge:activeSessionId` | `apps/web/src/hooks/usePersistentSession.ts:271,275,287,699,708` | La sesión activa “desaparece” |
| `cubeforge:favorite-colors`, `cubeforge:infinite-f2l:options`, `cubeforge:reminders-fired` | `Settings/…/useFavoriteColors.ts:6`, `infinite-f2l/InfiniteF2LView.tsx:35`, `hooks/useReminderScheduler.ts:24` | Ajustes y recordatorios ya disparados |
| `/cubeforge.sqlite3` (**OPFS — BD principal**) | `packages/database/src/worker.ts:376,504` (`openOpfsDbWithRetry`) | **TODOS los solves, sesiones, PBs, progreso de entrenamiento, skill tree y tareas de calendario.** Renombrarlo sin migración **no borra** el fichero: la app abre una BD nueva y vacía y los datos quedan invisibles para siempre |
| `cube-forge-db` (IndexedDB) | `packages/database/src/indexeddb-snapshot.ts:21` | Snapshot de bytes de la BD, usado como último recurso (navegadores sin OPFS) — única variante con guion |
| `cubeforge-collection` (IndexedDB) | `apps/web/src/views/Collection/collectionPhotos.ts:24` | Fotos de la colección (bytes de imagen) |
| `cubeforge-media` (IndexedDB) | `apps/web/src/stores/backgroundMediaStore.ts:21` | Fondos personalizados subidos por el usuario |
| `cubeforge-fonts` (IndexedDB) | `apps/web/src/theme/customFonts.ts:14` | Fuentes personalizadas subidas por el usuario |
| `cubeforge:widgetPosMigrated` (+ 6 claves legacy de posiciones) | `apps/web/src/widgets/migration.ts` | Solo layout de widgets (menor) |

**Precedente reutilizable:** `apps/web/src/widgets/migration.ts` (`migrateWidgetPositions`, invocado desde `App.tsx`) ya implementa exactamente el patrón que necesitamos: flag de un solo uso, copia old→new, borrado del viejo, tolerante a fallos. **El shim debe seguir ese patrón, no inventarse otro.**

### 4.1.1 Escala real del proyecto (2 usuarios) — qué se pierde de verdad y recomendación

**Pregunta razonable:** "¿solo se pierden los ajustes?" **No.** La jerarquía de lo que está
en juego, de mayor a menor:

| Prioridad | Dato | Dónde vive | ¿Recuperable desde la nube? |
| --- | --- | --- | --- |
| 1 | **Solves, sesiones, PBs, tiempos** | OPFS `/cubeforge.sqlite3` | Sí, **si** el usuario está logueado y el ciclo de sync ha corrido |
| 2 | Progreso de entrenamiento, skill tree, tareas de calendario | misma BD SQLite (con migración desde `cubeforge:*`) | Sí, mismo motor de sync |
| 3 | Algoritmos personalizados | localStorage `cubeforge:custom-algs` | **No** |
| 4 | Fotos de la colección, fondos, fuentes subidas | IndexedDB `cubeforge-collection` / `cubeforge-media` / `cubeforge-fonts` | Fotos: sí (bucket `locker-photos`). Fondos/fuentes: **no** |
| 5 | Colección legacy (`cubeforge-locker`) | localStorage (migrado a filas `gear_items`) | Filas: sí |
| 6 | Ajustes, tema, layout de widgets, colores favoritos | localStorage `cubeforge-prefs` + claves `cubeforge:*` | **No** (y es lo único que da igual) |
| 7 | BD de escritorio | `%APPDATA%\Roaming\com.cubeforge.desktop\cubeforge.db` | Solo si esa instalación está sincronizada |

**Sí hay nube.** El proyecto **ya tiene backend real**: Supabase Auth (Google), motor de sync
bidireccional por *dirty flags* con poller periódico (`apps/web/src/services/sync.ts`,
`packages/sync-engine`), tombstones LWW, bucket `locker-photos` para las fotos y esquema de
amigos/RPC. Es decir: los solves **se suben** cuando hay sesión iniciada. La nube no es el
plan de migración, pero **sí es la red de seguridad** que hace que renombrar (o no) la capa
local deje de ser un riesgo existencial.

**Recomendación por escala — tres niveles:**

- **Nivel 0 — obligatorio, ~15 min, antes de tocar nada.** En **cada** dispositivo: iniciar
  sesión con Google y confirmar que el sync ha corrido; después **exportar el JSON completo**
  (Exportar todo) y el locker a un fichero. Con esto, cualquier escenario posterior es
  recuperable aunque un namespace se rompa. Añadir el `db dump` de §7.2 como copia de la nube.
- **Nivel 1 — recomendado (y lo que yo haría): congelar la capa de persistencia.**
  **No renombrar** `/cubeforge.sqlite3`, `cube-forge-db`, `cubeforge-collection`,
  `cubeforge-media`, `cubeforge-fonts`, `cubeforge-prefs`, `cubeforge:*`, `cubeforge-locker`
  ni el `identifier` de Tauri. Se renombra **solo lo visible y lo que no guarda datos**:
  scope `@cubeforge/*`, HTML/OG, manifest PWA, i18n, docs, dominio, OAuth, repo, `Cargo.toml`,
  `package.json`. Resultado: **riesgo de pérdida de datos = 0**, esfuerzo **18–25 h**, y el
  "residuo" que queda son **nombres de ficheros internos que ningún usuario ve jamás**
  (el `.sqlite3` de OPFS ni siquiera aparece en DevTools; el directorio de escritorio solo se
  ve en `%APPDATA%`). A cambio, el rebranding deja de tener un camino de fallo a producción.
- **Nivel 2 — opcional (solo si exiges cero residuos literales).** Renombrar la persistencia
  **con** el shim de §8 y **copiando, nunca moviendo**: para OPFS, abrir el fichero viejo,
  `serialize()` y volcar los bytes al nuevo antes de borrar el antiguo (el worker ya tiene ese
  patrón en `migrateFromOtherTier`, `worker.ts:373-376`; escritorio ya tiene
  `restoreLegacyData`/`backupIsV1`). Coste +6–10 h y una prueba manual por dispositivo.

**Consecuencia para el calendario:** con el Nivel 1 el proyecto pasa a **Baja-Media (3/10)** y
la ejecución cabe en **2–3 jornadas**, sin ninguna ventana en la que el usuario pueda perder
datos.

### 4.2 Los formatos de exportación son un contrato público

`cubeforge-json`, `cubeforge-csv`, `cubeforge-locker` viajan **dentro de los ficheros que el usuario ya descargó** y se detectan al importar (`apps/web/src/utils/importSolves.ts:13,111-115,142`; `collectionTransfer.ts:40`). Los tests **fijan** esas cadenas (`exportSolves.test.ts:160,191,248`; `importSolves.test.ts:62`; `collectionTransfer.test.ts:88,127`) → son especificación, no ruido.
**Reglas:** (a) el importador acepta **ambos** IDs indefinidamente (coste ~0, evita romper el round-trip de todo lo exportado antes del rebranding); (b) el exportador escribe el ID nuevo; (c) los tests se actualizan a propósito y **se añade un caso de compatibilidad hacia atrás** con el ID viejo.

### 4.3 Identidad de la app de escritorio (Tauri) — el único cambio irreversible

`apps/desktop/src-tauri/tauri.conf.json` → `"identifier": "com.cubeforge.desktop"`. Ver §9 para la decisión A/B.

### 4.4 `theme-bootstrap.js` (script externo, pre-bundle)

`apps/web/public/theme-bootstrap.js:11` lee `localStorage.getItem('cubeforge-prefs')` con la clave **duplicada literalmente** fuera del store. Debe cambiar **en el mismo commit** que `packages/state/src/store.ts:666` y el shim, o hay flash de tema + preferencias “reiniciadas” en todos los dispositivos.

### 4.5 Flags `*-migrated` re-armados

`apps/web/src/hooks/useCalendarTasks.ts:10,70-77` y `hooks/useSkillProgress.ts:10,90-97` renombran una flag de migración de un solo uso. Consecuencia de renombrarla: la migración se re-ejecuta. **Está protegida** por el guard `dbCount === 0` (`useCalendarTasks.ts:74`, `useSkillProgress.ts:94`) → sin duplicados. **Conclusión: cambiar solo las flags, no las claves legacy que leen** (o cambiar ambas manteniendo el guard).

### 4.6 Superficie de eventos de ventana

`"cubeforge:open-logs"` se emite en `AppErrorBoundary.tsx:63` y se consume en `LogViewer.tsx:33-34`. Un rename parcial aquí falla **en silencio** (sin error de compilación, porque son strings). Detectar con grep, no confiar en `tsc`.

### 4.7 Ausencia de fuente única de verdad de marca

0 constantes. Consecuencia: el rename toca ~150 strings en 2 locales + HTML + manifest + 10 URLs. **Recomendación:** crear la constante durante esta migración para que el siguiente cambio sea de un fichero.

### 4.8 Handles reservados en BD

`20260912000016_handle_identity.sql:69` incluye `'cubeforge'` en la lista de handles prohibidos. Si no se añade `'cubalyze'`, **cualquier usuario podría registrar el handle del nuevo nombre de marca**. Como la migration ya está aplicada en producción, **no se edita**: se crea `supabase/migrations/<timestamp>_reserve_cubalyze_handle.sql` que amplía la lista (manteniendo `'cubeforge'`).

### 4.9 Lockfile y artefactos generados

`pnpm-lock.yaml` (91), `Cargo.lock`, `gen/schemas/capabilities.json`, `dist/`, `version.json`. **Regenerar, no editar.** Un `sed` sobre el lockfile produce un árbol inconsistente con `--frozen-lockfile` en CI.

### 4.10 `apps/api` vestigial

`apps/api` solo tiene `package.json` (`@cubeforge/api`). Decidir antes del rename: renombrar o borrar (evita arrastrar una entrada muerta y reduce ruido en el gate de residuales).

---

## 5. Plan de ejecución por fases (no destructivo, zero-downtime)

**Principios:**
1. Nada de código se renombra antes de que la compatibilidad esté desplegada (§5.2).
2. La allowlist de OAuth se amplía **antes** del cutover; nunca se sustituye.
3. El dominio viejo no se apaga: se transforma en redirección + SW tumba.
4. Cada fase tiene criterio de salida verificable; ninguna avanza sin el suyo.

### Fase 0 — Congelación, inventario y red de seguridad (2–3 h)

- [ ] `git switch -c rebrand/cubalyze` desde `main` limpio.
- [ ] Exportar la configuración de Supabase Auth (captura/JSON del dashboard) y de Vercel (dominios, env vars) **antes** de tocar nada.
- [ ] Backup de la BD de producción: `supabase db dump --linked -f backup_pre_rebrand.sql` (ver §7.2).
- [ ] Ejecutar la auditoría base (§7.1) y guardar la salida como línea base.
- [ ] Confirmar estado de la pantalla de consentimiento OAuth (Testing vs Published) → decide el calendario.
- **Salida:** baseline de 3005 coincidencias en 737 ficheros + backups + estado OAuth conocido.

### Fase 1 — Preparación externa (6–10 h + latencia de Google)

- [ ] **Supabase:** añadir a `Redirect URLs` los orígenes nuevos (`https://<nuevo>/auth`), actualizar `Site URL` **solo en el cutover**, no antes (cambiarlo antes rompe el login actual). Mantener `localhost:5173`.
- [ ] **GCP:** añadir el origen nuevo a `Authorized JavaScript origins`; actualizar consent screen (App name, dominios autorizados, logo). No tocar el redirect URI de Supabase.
- [ ] **Vercel:** NO renombrar el proyecto. Añadir el dominio nuevo; dejar el viejo como alias.
- [ ] **DNS:** crear el registro del dominio nuevo (si Plan A) y verificar emisión de certificado.
- [ ] **GitHub:** renombrar el repo (ver §7.5). Confirmar redirect del nombre viejo; revisar rulesets/secrets.
- [ ] **Alcance:** decidir Plan A/B de dominio y la variante Tauri A/B (§9).
- **Salida:** el dominio nuevo sirve la app actual sin errores de auth; ninguna URL antigua ha dejado de funcionar.

### Fase 2 — Refactor de código en 3 commits atómicos (12–18 h)

Orden obligatorio (cada commit compila y pasa CI por separado):

**2a — Compat first (sin cambios de nombre):** shim de claves (§8.1), dual-read de formatos de export (§8.2), aceptar `cubeforge-json/csv/locker` al importar. Desplegar y dejar asentar.
**2b — Scope + infra:** `@cubeforge/*` → `@cubalyze/*` en 592 ficheros + `package.json` (21) + `tsconfig*` + `knip.jsonc` + `typedoc*` + `vitest.config.ts` + `.github/workflows/*` + `apps/desktop/vite.config.ts` + `eslint.config.js`; después `pnpm install` (regenera lockfile). Cierra con `pnpm typecheck && pnpm lint && pnpm test`.
**2c — Identidad visible:** `apps/web/index.html` (título/description/OG + **añadir** `og:site_name`, `og:image`, `twitter:card`, canonical), `vite.config.ts` (manifest `name`/`short_name`), i18n (valores + claves `formatName*`), `public/{robots.txt,sitemap.xml,llms.txt}`, `theme-bootstrap.js`, textos de créditos/deprecación.
**2d — Escritorio (si aplica):** Tauri `productName`, `identifier`, `authors`, `cubeforge_lib` → `cubalyze_lib` (+ `main.rs`), ruta SQLite y estrategia de migración (§9).
- **Salida:** CI verde (typecheck 0 errores, lint 0 warnings, 100% tests), `pnpm build` OK, smoke test manual de login/export/import/prefs en el dominio **nuevo**.

### Fase 3 — Datos y Supabase (10–16 h)

- [ ] Nueva migration: reservar `cubalyze` en la lista de handles (mantener `cubeforge`).
- [ ] `supabase db diff --linked` antes y después → **sin drift**.
- [ ] Verificar buckets y políticas (`locker-photos`) — sin cambios esperados.
- [ ] `supabase config push` solo tras revisar el diff de `config.toml` (§7.2, incluye advertencia).
- [ ] Ejecutar el shim de claves contra un perfil real: prefs, locker, custom-algs, sesión activa, snapshot IDB.
- [ ] Escritorio: validar migración del SQLite (o asumir el corte, según decisión A/B).
- **Salida:** 0 drift, handles correctos, datos locales intactos tras actualizar.

### Fase 4 — Despliegue, cutover y redirecciones (4–6 h)

- [ ] Deploy del dominio nuevo (verde, estable ≥ 30 min).
- [ ] `Site URL` en Supabase → dominio nuevo (manteniendo ambas redirect URLs).
- [ ] Activar `redirects` 301 host-based en `vercel.json` (§7.4).
- [ ] Publicar sw-tumba en el dominio viejo (§7.4).
- [ ] Actualizar `sitemap.xml`/`robots.txt`/`llms.txt` en el dominio nuevo.
- [ ] Reenviar `sitemap.xml` en Search Console + cambiar la propiedad principal; mantener la propiedad vieja para vigilar 301.
- **Salida:** navegación real vieja→nueva con 301, login Google OK desde el dominio nuevo, PWA instalada sin shell obsoleto.

### Fase 5 — Post-deploy, auditoría de residuales y rollback (5–8 h)

- [ ] Smoke tests: §6. Auditoría de residuales (§10) con allowlist explícita.
- [ ] Monitorizar 48 h: errores de auth, `redirect_uri_mismatch`, 404 de assets, errores del SW.
- [ ] Rollback ensayado (no improvisado): §11.
- [ ] Limpieza posterior (release +1): retirar dual-write y alias viejos.

---

## 6. Smoke tests mínimos (gate de producción)

| # | Prueba | Criterio |
| --- | --- | --- |
| 1 | Login Google desde el dominio nuevo (incógnito) | Vuelve a `/auth` autenticado, sin `redirect_uri_mismatch` |
| 2 | Login desde el dominio **viejo** | Sigue funcionando durante la transición |
| 3 | Sesión preexistente tras el deploy (usuario con sesión viva) | **No** se cierra sesión |
| 4 | Preferencias tras actualizar desde la versión anterior | Tema/idioma/ajustes intactos, sin flash de tema |
| 5 | Exportar → importar `Cubalyze JSON` y un `CubeForge JSON` antiguo | Ambos importan sin pérdida |
| 6 | Colección (`cubeforge-locker`) preexistente | Visible y editable |
| 7 | Snapshot IndexedDB (`cube-forge-db`) | Se lee el snapshot previo (o se regenera sin error) |
| 8 | App instalada (PWA) en el dominio viejo | Redirige/actualiza sin servir shell obsoleto |
| 9 | Escritorio: arranque, BD, BLE (GAN), actualización | Datos y emparejamiento intactos |
| 10 | `GET https://<dominio-viejo>/cualquier-ruta` | `301` a `https://<nuevo>/cualquier-ruta` |
| 11 | `curl -I` de `/manifest.webmanifest` | `name: Cubalyze`, `Content-Type` correcto |
| 12 | Título de pestaña y nombre bajo el icono instalado | `Cubalyze` |

---

## 7. Scripts y comandos

> Nota de entorno: en esta máquina **`rg` no está instalado**; `grep -r` genérico sobre
> este monorepo agota el timeout (node_modules + `dist/` + `.turbo/`). El comando
> fiable y rápido aquí es **`git grep`** (solo ficheros versionados, respeta `.gitignore`).
> Se dan las tres variantes.

### 7.1 Auditoría de apariciones (antes y después)

```bash
# ── A. git grep (rápido, recomendado aquí; solo ficheros versionados) ──
git grep -ilI "cubeforge"                 # ficheros con la marca (línea base: 737)
git grep -iI  "cubeforge" | wc -l         # total de líneas (línea base: 3005)
git grep -iI  "cubeforge" -- apps packages # solo código
git grep -iI  "cubeforge" -- ':(exclude)docs' ':(exclude)apps' ':(exclude)packages'

# Desglose por forma del nombre (el riesgo no es uniforme):
git grep -oI "@cubeforge/" | wc -l                              # scope (1301)
git grep -oI "[\"'\`]cubeforge[:.-][A-Za-z0-9:_-]*" | wc -l      # claves de persistencia (93)
git grep -inI -e "com\.cubeforge\.desktop" -e "cubeforge\.db" -e "cube-forge-db"
git grep -inI -e "cubeforge-json" -e "cubeforge-csv" -e "cubeforge-locker"
git grep -ohiI "https\?://[a-z0-9._-]*cubeforge[a-z0-9._/-]*" | sort -u

# Detección de mayúsculas/mixtas (un sed lowercase-only se las salta):
git grep -nI "CubeForge" ; git grep -nI "CUBEFORGE" ; git grep -nI "[Cc]ube[ _-][Ff]orge"

# ── B. ripgrep (si está disponible en otra máquina/CI) ──
rg -i "cubeforge" -g '!.git' -g '!node_modules' -g '!.next' -g '!dist' -g '!.turbo' \
   -g '!pnpm-lock.yaml' -g '!Cargo.lock' -g '!*.log'
rg -i "cubeforge" -l -g '!node_modules' -g '!dist' -g '!.turbo' | wc -l

# ── C. find + grep (fallback portable; el `-I` evita binarios) ──
find . \( -name .git -o -name node_modules -o -name .next -o -name dist \
        -o -name .turbo -o -name coverage -o -name .venv \) -prune -o \
     -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
        -o -name '*.json' -o -name '*.md' -o -name '*.yml' -o -name '*.yaml' \
        -o -name '*.html' -o -name '*.css' -o -name '*.toml' -o -name '*.rs' \
        -o -name '*.svg' -o -name '*.xml' -o -name '*.txt' -o -name '*.cjs' \
        -o -name '*.mjs' \) -print0 \
  | xargs -0 grep -Il -i "cubeforge"

# ── D. Auditoría de nombres de FICHERO/CARPETA (grep no los ve) ──
git ls-files | grep -i "cube[ _-]*forge"
find . -path ./node_modules -prune -o -path ./.git -prune -o -iname "*cubeforge*" -print
# Revisar también binarios (iconos con wordmark rasterizado):
git ls-files -z | xargs -0 file | grep -i "image\|binary"

# ── E. Gate de salida: el resultado debe ser SOLO la allowlist de §10 ──
git grep -ilI "cubeforge" | grep -v -E '^docs/17-releases/|^docs/18-archive/|^pnpm-lock.yaml$|^Cargo.lock$'
```

### 7.2 Supabase CLI

```bash
# 0) Requisito: CLI instalado y proyecto enlazado (no versiona nada)
supabase --version && supabase projects list
supabase link --project-ref <PROJECT_REF>       # ref ≠ contiene "cubeforge" → NO cambiar

# 1) Foto antes de tocar nada (línea base y red de seguridad)
supabase db diff --linked                       # drift local vs remoto (debe estar vacío)
supabase db diff --use-migra --linked
supabase migration list --linked                 # aplicadas vs pendientes
supabase db dump --linked -f backup_pre_rebrand.sql
supabase gen types typescript --linked > /tmp/types_before.ts

# 2) Cambios de BD (Fase 3) — SOLO migration nueva, nunca editar aplicadas
#    supabase/migrations/<timestamp>_reserve_cubalyze_handle.sql
supabase migration new reserve_cubalyze_handle
supabase db push --linked --include-all          # aplica pendientes
supabase db diff --linked                        # post: debe seguir vacío
supabase gen types typescript --linked > /tmp/types_after.ts
diff /tmp/types_before.ts /tmp/types_after.ts    # esperado: 0 diffs de tipos

# 3) Auth redirects / config (⚠️ sobrescribe la config del proyecto con config.toml)
supabase config push --help                      # verificar flags de esta versión ANTES de usar
supabase config push                             # ⚠️ revisar primero el diff de config.toml:
                                                 #    site_url, additional_redirect_urls, project_id
# Alternativa más segura y quirúrgica: dashboard → Authentication → URL Configuration
# (mantener SIEMPRE las URLs viejas durante la transición)

# 4) Storage: sin cambios esperados (bucket 'locker-photos' es neutro) — verificar
supabase storage ls --linked ss:///
supabase storage ls --linked ss:///locker-photos

# 5) Edge functions / secrets (comprobar que no embeben la marca)
supabase functions list --linked
supabase secrets list --linked
```

**Secuencia de URLs (crítica, en este orden):** 1) añadir las URLs nuevas dejando las viejas → 2) desplegar el dominio nuevo → 3) cambiar `Site URL` al nuevo → 4) en la limpieza posterior, retirar las viejas.

### 7.3 Codemod del scope `@cubeforge/*` (Fase 2b)

```bash
# 1) Dry-run: ver qué ficheros cambia (revisar ANTES)
git grep -lI "@cubeforge/" | tee /tmp/scope_files.txt | wc -l     # ~592 ficheros

# 2) Aplicar SOLO el scope (nunca un ```s/cubeforge/cubalyze/g``` global:
#    arrastraría claves de persistencia, formatos de export y el identifier de Tauri)
while IFS= read -r f; do
  sed -i 's|@cubeforge/|@cubalyze/|g' "$f"
done < /tmp/scope_files.txt

# 3) Regenerar lockfile e instalaciones (NUNCA editar pnpm-lock a mano)
pnpm install
pnpm -w run typecheck && pnpm -w run lint && pnpm -w run test
```

Codemod sensible (Fase 2a/2c) — **con revisión humana del diff, uno por uno**:
`cubeforge-prefs`, `cubeforge:`, `cubeforge-json`, `cubeforge-csv`, `cubeforge-locker`,
`cube-forge-db`, `com.cubeforge.desktop`, `cubeforge.db`, `cubeforge-phi.vercel.app`,
`CubeForge` (texto visible), `cubeforge_lib`, `cubeforge-monorepo`.

### 7.4 Redirecciones 301 — `vercel.json` (Plan A: dominio propio nuevo)

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npx turbo run build --filter=web",
  "outputDirectory": "apps/web/dist",

  "redirects": [
    // 301 SEO-friendly de TODO el dominio viejo al nuevo, preservando ruta y query.
    // Se excluye /sw.js y /manifest.webmanifest para poder servir la "SW tumba"
    // en el host antiguo (ver nota PWA abajo).
    {
      "source": "/((?!sw\\.js$|manifest\\.webmanifest$|version\\.json$).*)",
      "has": [{ "type": "host", "value": "cubeforge-phi.vercel.app" }],
      "destination": "https://cubalyze.app/$1",
      "statusCode": 301
    },
    // Alias heredados de rutas antiguas (si alguna ruta se renombra, regla explícita aquí)
    {
      "source": "/collection",
      "destination": "https://cubalyze.app/locker",
      "statusCode": 301
    }
  ],

  "rewrites": [
    { "source": "/((?!api/|sw\\.js$|.*\\..*).*)", "destination": "/index.html" }
  ],
  "headers": [
    // (los headers actuales de CSP/COOP/COEP se conservan SIN cambios)
  ]
}
```

Notas imprescindibles:
- **`statusCode: 301` es explícito**: en Vercel, `"permanent": true` emite **308**. Google
  trata 308 como permanente, pero el requisito del brief es 301 → usar `statusCode`.
- Los `redirects` se evalúan **antes** de los `rewrites`; la condición `has host` impide
  que la regla afecte al dominio nuevo (por eso `/api` y `/assets` del dominio nuevo
  no se ven tocados).
- **Landmine PWA (crítico):** las instalaciones existentes tienen un Service Worker
  registrado contra el **origen viejo**. Si el origen viejo solo devuelve 301, ese SW
  puede seguir sirviendo el app shell cacheado con la marca vieja. Mitigación: mantener
  desplegado el proyecto Vercel viejo con un `sw.js` "tumba" (excluido del redirect)
  que se autodestruya:
  ```js
  // apps/web/public/sw.js (build especial del host antiguo)
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', async (e) => {
    e.waitUntil((async () => {
      for (const k of await caches.keys()) await caches.delete(k)
      await self.registration.unregister()
      const cs = await self.clients.matchAll({ type: 'window' })
      for (const c of cs) c.navigate(c.url)   // recarga → cae en el 301 → dominio nuevo
    })())
  })
  ```
  Esto es la razón técnica por la que **NO se debe renombrar/recrear el proyecto Vercel antiguo**.
- **Plan B (sin dominio propio, todo `*.vercel.app`):** imposible hacer 301 desde un
  dominio generado que ya no posees si renombras el proyecto. Alternativa: mantener el
  proyecto viejo, desplegar ahí una página con `<link rel="canonical"
  href="https://<nuevo>/…">` + `location.replace()` (+ SW tumba) y usar el nuevo
  proyecto para el dominio nuevo. SEO válido (canonical) aunque menos limpio que 301.
- **Cutover de `Site URL` en Supabase:** hazlo **después** de que el dominio nuevo esté
  verde, y nunca retires las redirect URLs viejas el mismo día.

### 7.5 Rename del repositorio GitHub

```bash
# 1) En GitHub: Settings → General → Repository name → "Cubalyze" (GitHub mantiene
#    un redirect del nombre viejo: los clones/PRs enlaces existentes siguen funcionando)

# 2) Local (cosmético pero recomendable; NO ejecutar sin permiso explícito)
git remote -v
git remote set-url origin https://github.com/Doritozz05/Cubalyze.git
git fetch --all --prune

# 3) Verificaciones posteriores (en GitHub UI): rulesets/branch protections,
#    Actions secrets, environments, webhooks, deploy keys, CODEOWNERS, topics
```

---

## 8. Shim de compatibilidad (código a escribir en Fase 2a)

### 8.1 Migración de claves de persistencia (patrón ya existente en el repo)

Sigue el modelo de `apps/web/src/widgets/migration.ts`. Invocación temprana (antes de
que el store rehidrate y **antes** de `theme-bootstrap.js` del siguiente paint):

```ts
// apps/web/src/boot/rebrandMigration.ts
const FLAG = 'cubalyze:rebrand-migrated'
const RENAMED: Record<string, string> = {
  'cubeforge-prefs': 'cubalyze-prefs',
  'cubeforge-locker': 'cubalyze-locker',
  'cubeforge:custom-algs': 'cubalyze:custom-algs',
  'cubeforge:activeSessionId': 'cubalyze:activeSessionId',
  'cubeforge:favorite-colors': 'cubalyze:favorite-colors',
  'cubeforge:infinite-f2l:options': 'cubalyze:infinite-f2l:options',
  'cubeforge:reminders-fired': 'cubalyze:reminders-fired',
  // … resto de claves de §4.1
}

/** Copia old→new SIN borrar el original (doble lectura durante un ciclo de release). */
export function migrateRebrandKeys(): void {
  try {
    if (localStorage.getItem(FLAG) === '1') return
    for (const [oldKey, newKey] of Object.entries(RENAMED)) {
      try {
        const raw = localStorage.getItem(oldKey)
        if (raw !== null && localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, raw)
        }
      } catch { /* entrada corrupta — continuar */ }
    }
    localStorage.setItem(FLAG, '1')
  } catch { /* localStorage no disponible */ }
}
```

Reglas: **doble lectura siempre**, **borrado del original solo en la release +1**,
`theme-bootstrap.js` leyendo *ambas* claves (`new ?? old`) hasta entonces, y el
equivalente para IndexedDB (`cube-forge-db` → copiar el snapshot a la BD nueva antes
de dejar de abrir la antigua).

### 8.2 Dual-read de formatos de exportación

```ts
// apps/web/src/utils/importSolves.ts
export type ImportFormat = 'cstimer' | 'cstimer-json' | 'twistytimer'
  | 'cubalyze-csv' | 'cubalyze-json' | 'generic-csv' | 'unknown'

const LEGACY: Record<string, ImportFormat> = {
  'cubeforge-json': 'cubalyze-json',   // ficheros exportados antes del rebranding
  'cubeforge-csv':  'cubalyze-csv',
  'cubeforge-locker': 'cubalyze-locker',
}
// En detectFormat(): normalizar con LEGACY antes de devolver el formato.
// En el exportador: escribir SIEMPRE el id nuevo.
// En los tests: añadir casos de compatibilidad con los ids antiguos (no solo renombrar los existentes).
```

---

## 9. Decisión pendiente: identidad de la app de escritorio (Tauri)

`identifier: com.cubeforge.desktop` determina: directorio de datos
(`%APPDATA%\Roaming\com.cubeforge.desktop\` → `cubeforge.db`), bundle id en macOS,
cadena del instalador NSIS y continuidad de firma/notarización/updater
(hoy `updater.active: false`, lo que **abarata** el cambio: no hay canal de
actualización roto que reparar, solo instalaciones existentes).

| | **A. Renombrar el identifier** | **B. Congelarlo como detalle interno** |
| --- | --- | --- |
| Cumple "cero residuos" | Sí | No (queda `com.cubeforge.desktop`) |
| Datos del usuario | Hay que migrar `cubeforge.db` al directorio nuevo (o el usuario arranca “vacío”) | Intactos |
| macOS | Se instala como app **nueva** (bundle id distinto): dos apps conviviendo | Actualización normal |
| Windows (NSIS, `currentUser`) | Reinstalación; posible entrada duplicada en Añadir/Quitar programas | Upgrade normal |
| Firma/notarización | Nueva configuración de bundle id en CI (Apple Developer) | Ningún cambio |
| Esfuerzo | +4–8 h + una release de escritorio coordinada | 0 |
| Reversibilidad | **Baja** (una vez publicado, volver atrás duplica apps) | Total |

**Recomendación:** si el requisito de "ni un solo rastro" no incluye identificadores
internos del sistema operativo → **B** (documentado como excepción consciente). Si lo
incluye → **A**, pero en una release de escritorio **separada, posterior y con release
notes explícitas** sobre la migración del directorio de datos. No hacer A y B a medias.

---

## 10. "Residuo cero": definición operativa y allowlist

El requisito literal es inalcanzable sin reescribir la historia de git. Propuesta:

| Nivel | ¿Se renombra? | Justificación |
| --- | --- | --- |
| Código, configs, CI, scope, textos visibles, assets, manifest, SEO, Supabase, OAuth, dominios | **Sí — 100%** | Es lo observable por usuarios, buscadores y crawlers LLM |
| Docs vivas (`README`, `PRODUCT`, `DESIGN`, `DATA_SOURCES`, `SECURITY`, `docs/00`, `01`, `02`, `03`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `15`, `16`) | **Sí** | Documentación activa |
| `docs/17-releases/CHANGELOG_MASTER.md` (1136 coords.), `apps/*/CHANGELOG.md`, `docs/18-archive/**`, `docs/01-roadmap/Fase-*` | **NO — congelar** | Registro histórico y de procedencia. Reescribirlos (a) destruye el rastro de auditoría, (b) genera un diff de >1500 líneas que **oculta** los cambios reales en revisión, (c) no aporta valor a usuarios ni buscadores |
| `pnpm-lock.yaml`, `Cargo.lock`, `gen/schemas/*`, `dist/`, `version.json` | Regenerar (no editar) | Artefactos generados |
| Historia de git (1183 commits) | **NO** | `git filter-repo` + force-push rompe clones, PRs, cachés de CI y protecciones — es el único paso que **sí** puede tumbar la producción. Requiere decisión explícita y ventana propia |

**Gate de salida (comando en §7.1-E):** el único resultado aceptable es el conjunto de
ficheros de la allowlist. Cualquier otro `cubeforge` es un fallo de release.

---

## 11. Plan de rollback

| Escenario | Acción | Tiempo |
| --- | --- | --- |
| El dominio nuevo falla o el login se rompe | Revertir alias de dominio en Vercel al proyecto/despliegue anterior; restaurar `Site URL` en Supabase; desactivar `redirects` | < 10 min |
| Error en el shim (datos locales) | Los originales **no se borran** en Fase 2a → revertir la clave de versión del shim para re-ejecutar; las claves nuevas se ignoran | < 15 min |
| Regresión funcional amplia | `git revert` de los commits 2a–2d (commits atómicos por diseño) y redeploy del build anterior | < 30 min |
| Migration SQL problemática | `supabase migration repair` / aplicar migration inversa (la de handles es aditiva y trivialmente reversible) | < 30 min |
| Desastre de escritorio (variante A) | Volver a publicar con el identifier antiguo: los usuarios **conservan sus datos** en el directorio viejo (por eso A no borra el directorio antiguo hasta la release +2) | — |

Precondiciones de rollback: tag `pre-rebrand` en `main`, backups de BD (§7.2), y
capturas/export de la config de Supabase Auth y Vercel antes de Fase 1.

---

## 12. Estimación desglosada

| Fase | Trabajo | Horas |
| --- | --- | --- |
| 0 | Freeze, backups, línea base, estado OAuth | 2–3 |
| 1 | GCP consent screen + Supabase redirects + Vercel/dominios + DNS + GitHub rename | 6–10 (+ espera Google) |
| 2a | Compat first: shim de 93 claves + dual-read de formatos | 4–6 |
| 2b | Scope `@cubeforge/*` (592 ficheros) + configs + CI + lockfile | 5–7 |
| 2c | Identidad visible: HTML/OG, manifest, i18n, SEO, assets, textos | 4–5 |
| 2d | Escritorio (variante A) | 4–8 (0 si elección B) |
| 3 | Migration de handles, `db diff`, `config push`, validación local | 3–5 |
| 4 | Deploy, cutover, 301 + SW tumba, Search Console | 4–6 |
| 5 | Smoke tests, gate de residuales, monitorización, rollback drill | 5–8 |
| — | **Total (rebranding completo, con escritorio y persistencia renombrada)** | **39–61 h/hombre** |
| — | **Total con Nivel 1 (§4.1.1: persistencia congelada, sin tocar el escritorio)** | **18–25 h/hombre** |

**Lectura de la cifra:** con 1 ingeniero senior, ~1,5–2 semanas de calendario
(≈5–7 jornadas de trabajo real solapadas con la latencia externa). El 60% del esfuerzo
no está en renombrar: está en la compatibilidad del cliente (2a), el escritorio (2d) y
la validación (5). **Sin escritorio y sin exigir `identifier`, baja a 28–42 h y a
complejidad Media.**

---

## 13. Checklist go / no-go

**No-go si:** no hay backup de BD verificado · no se sabe el estado del consent screen de
Google · no se ha probado el shim contra un perfil con datos reales · se pretende
reescribir el historial de git en la misma ventana · el dominio viejo va a apagarse antes
de publicar la SW tumba.

**Go si:** `supabase db diff --linked` está vacío · CI verde en la rama de rebranding ·
el dominio nuevo sirve con login funcional y allowlist nueva ya añadida · existe tag
`pre-rebrand` · los 12 smoke tests de §6 pasan en el dominio nuevo antes del cutover.

---

## 14. Apéndice: qué hace la industria en un cambio de nombre (modelo mental)

**Ninguna empresa profesional renombra identificadores que cargan datos.** Un cambio de marca
se ejecuta casi por completo en la capa visual y registrada; los identificadores internos se
quedan con el nombre viejo **durante décadas** y se documentan como históricos, no se migran.

### 14.1 Las tres clases de nombre (y qué se hace con cada una)

| Clase | Qué entra | Qué hace una empresa | Ejemplos reales |
| --- | --- | --- | --- |
| **(a) Superficie de marca** | Logos, textos, título/OG, manifest, marketing, docs, dominio (con 301), App name del consent screen, redes sociales, tema de color | **Renombrar siempre.** Es gratis y reversible | Google → Alphabet no renombró ni un producto. Office 365 → Microsoft 365: cero cambios de almacenamiento |
| **(b) Contratos persistidos o registrados** | Namespaces de almacenamiento (localStorage, IndexedDB, OPFS, rutas SQLite), bundle id / Tauri `identifier`, project ref de Supabase, nombres de bucket S3, IDs de OAuth, certificados y keystores, campos de formatos exportados, variables de entorno, historial de git | **Congelar para siempre.** Se documenta como legado con un comentario del *porqué* | Android de Twitter sigue siendo `com.twitter.android`; iOS `com.atebits.Tweetie2`; Meta sigue con `com.facebook.katana`; `fbcdn.net` sigue vivo |
| **(c) Casos intermedios** | Scope npm, esquemas de BD, campos de API pública, directorios de config local | **Versionar + migrar con doble lectura**, nunca renombrar en silencio | Vercel (ex-ZEIT) renombró el scope `@zeit/*` → `@vercel/*` y `.now` → `.vercel`, **manteniendo compatibilidad** con `now.json` y `.now` durante la transición |

### 14.2 Por qué los identificadores son inmutables (y no es pereza)

1. **El bundle id / Tauri `identifier` es reverse-DNS por unicidad global, no por marca.** Cambiarlo
   crea una app *distinta* para el sistema operativo: pierde los datos, la firma y la continuidad
   de actualización. Por eso existe el reverse-DNS.
2. **Un namespace de almacenamiento es un contrato con bytes que ya están en disco.** El
   fichero/BD *ya existe* con ese nombre en el dispositivo del usuario: renombrarlo es, en la
   práctica, un cambio de esquema.
3. **Los formatos exportados son contratos con ficheros que están en el disco del usuario.**
   Igual que no se renombra una columna de un CSV, no se renombra el id de un formato sin
   seguir aceptando el viejo.
4. **Los refs de proyecto, buckets y scopes npm son identificadores globales inmutables**: no se
   renombran, se recrean con migración de datos (y los buckets S3 no tienen 301).
5. **El coste/beneficio es asimétrico:** el beneficio de renombrar un namespace invisible es cero;
   el riesgo de hacerlo mal es perder los datos del usuario. No hay negocio que compre ese trade.

### 14.3 "¿No sería ideal que OPFS/IndexedDB no tuvieran nombre hardcodeado?"

El instinto es correcto, pero **el nombre no puede no existir**: el navegador necesita una clave
para encontrar los datos del origen. Lo que sí es un error de diseño es que ese nombre sea la
**marca**. El patrón profesional no es "sin nombre", es **"un nombre neutro, único y congelado
como contrato"**:

```ts
// packages/database/src/persistence.ts
/**
 * CONTRATO DE PERSISTENCIA — NO RENOMBRAR NINGUNO DE ESTOS VALORES.
 *
 * Cada cadena es la clave con la que los datos YA EXISTEN en el dispositivo del
 * usuario (OPFS, IndexedDB, localStorage, SQLite). Cambiarla sin una migración
 * que COPIE los bytes equivale a borrar los datos del usuario: la app abriría un
 * almacén nuevo y vacío mientras los datos viejos quedan huérfanos e invisibles.
 * Son históricos a propósito; el rebranding de superficie no los toca.
 *
 * Para añadir almacenamiento NUEVO usa un nombre neutro (p. ej. 'app-media',
 * 'main.sqlite3'), nunca derivado de la marca.
 */
export const PERSISTENCE = {
  sqliteFile: '/cubeforge.sqlite3',      // OPFS · BD principal (solves, sesiones, progreso)
  snapshotDb: 'cube-forge-db',           // IndexedDB · snapshot de último recurso
  photosDb: 'cubeforge-collection',      // IndexedDB · fotos de la colección
  mediaDb: 'cubeforge-media',            // IndexedDB · fondos personalizados
  fontsDb: 'cubeforge-fonts',            // IndexedDB · fuentes subidas
  lockerKey: 'cubeforge-locker',         // localStorage · colección legacy
  prefsKey: 'cubeforge-prefs',           // localStorage · preferencias (zustand)
} as const
```

Con eso se obtienen tres cosas: (1) un único punto de verdad, (2) un sitio natural para el
comentario de "no tocar", y (3) la posibilidad de un **test de guarda** que falle si alguien
cambia un valor sin registrar la migración correspondiente. Renombrar de verdad, si algún día
se quiere, se hace **versionando** (`sqliteFileV2` + migración que copia), no editando la cadena.

### 14.4 Mecánica del cambio: cómo se impide que un renombrado toque los datos

**El reemplazo global no se usa nunca** (`s/cubeforge/cubalyze/g` está prohibido en este plan).
La superficie está medida y dividida en dos conjuntos disjuntos:

| Conjunto | Ficheros | Regla |
| --- | --- | --- |
| Código con la marca, **sin** literales de almacenamiento | **510** | Renombrado automático por patrones acotados (`@cubeforge/`, `CubeForge`, `cubeforge-phi.vercel.app`, …) |
| Código que **sí** contiene literales de almacenamiento | **68** | **Nada automático.** Revisión manual línea a línea |

> ⚠️ **Estas cifras de la primera pasada son incompletas.** La segunda revisión (§14.5)
> encontró 120 literales únicos (no 46) y dos mecanismos de acoplamiento que el patrón
> inicial no podía ver. **Leer §14.5 antes de congelar.**

Y solo **46 literales únicos** deben congelarse (lista cerrada, verificable con un comando):

```text
Almacén persistente (los que importan de verdad)
  /cubeforge.sqlite3            OPFS · BD principal de solves
  cube-forge-db                 IndexedDB · snapshot de último recurso
  cubeforge-collection          IndexedDB · fotos de la colección
  cubeforge-media               IndexedDB · fondos personalizados
  cubeforge-fonts               IndexedDB · fuentes subidas
  sqlite:cubeforge.db           escritorio · ruta de la BD
  com.cubeforge.desktop         escritorio · identifier Tauri

Estado del usuario en localStorage
  cubeforge-prefs               preferencias (zustand persist)
  cubeforge-locker              colección legacy
  cubeforge:activeSessionId     cubeforge:custom-algs      cubeforge:widgets
  cubeforge:favorite-colors     cubeforge:infinite-f2l:options
  cubeforge:reminders-fired     cubeforge:skills-migrated  cubeforge:calendar-migrated
  cubeforge:widgetPosMigrated   cubeforge_snap_3d_v8_
  cubeforge_puzzle              cubeforge_random_puzzle_pool
  cubeforge_notes_storage       cubeforge_phase_stats_tab  cubeforge_phase_stats_sort
  cubeforge_full_solve_mode     cubeforge_full_solve_inspection
  cubeforge_completed_skills_v2 cubeforge_onboarding_completed
  cubeforge-training-calendar

Formatos de fichero (aceptar el id viejo indefinidamente al importar)
  cubeforge-json                cubeforge-csv               cubeforge-locker
```

**Y esto SÍ se renombra sin consecuencias** (aunque lo parezca): `cubeforge-sync`
(BroadcastChannel entre pestañas de la *misma* versión), `cubeforge:open-logs` (evento de
ventana), `cubeforge:cfop-debug`, `cubeforge:moves-debug`, `cubeforge:debug-ui`,
`cubeforge:orientation-debug`, `cubeforge:chunk-reload-ts` (banderas de depuración: en el peor
caso se reinician), `cubeforge-all-sessions.json` (nombre de descarga), `cubeforge-composite-font`
(familia tipográfica interna), `cubeforge_lib` (crate Rust).
**Regla de decisión:** si no sobrevive al cierre del navegador, o no es un dato del usuario, es libre.

#### El procedimiento en 4 pasos

1. **Congelar** (§14.3): mover los 46 literales a un módulo único **sin cambiar ningún valor**.
   Commit propio, desplegable y reversible. Ahora el resto del código contiene cero literales de
   almacenamiento → el renombrado no puede alcanzarlos *por construcción*, no por cuidado.
2. **Verja**: test que fija los valores exactos.
3. **Renombrar**: los 510 automáticamente; los 68 a mano.
4. **Verificar** con las 4 capas de abajo.

#### Las 4 capas de verificación (por qué "no se escapa nada")

```ts
// Capa 1 — estática y permanente: si alguien toca un nombre congelado, CI falla.
// packages/database/src/__tests__/persistence-contract.test.ts (+ equivalente web)
import { PERSISTENCE } from '../persistence'
import { WEB_STORAGE } from '@cubeforge/database'   // o el módulo compartido

test('los nombres de almacenamiento NO cambian (renombrarlos pierde datos)', () => {
  expect(PERSISTENCE).toEqual({
    sqliteFile: '/cubeforge.sqlite3',
    snapshotDb: 'cube-forge-db',
    desktopDb: 'sqlite:cubeforge.db',
    tauriIdentifier: 'com.cubeforge.desktop',
  })
  expect(WEB_STORAGE).toEqual({
    prefs: 'cubeforge-prefs', locker: 'cubeforge-locker',
    photosDb: 'cubeforge-collection', mediaDb: 'cubeforge-media', fontsDb: 'cubeforge-fonts',
  })
})
```

```bash
# Capa 2 — estática, antes/después del renombrado: el diff debe contener SOLO lo que decidiste
# cambiar. Cualquier otra línea que aparezca es una fuga.
git grep -ohI -E "['\"\`](cubeforge|cube-forge)[:.a-zA-Z0-9_-]*['\"\`]" -- apps packages | sort -u > /tmp/before.txt
#   … ejecutar el renombrado …
git grep -ohI -E "['\"\`](cubeforge|cube-forge)[:.a-zA-Z0-9_-]*['\"\`]" -- apps packages | sort -u > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt     # 0 líneas inesperadas = contrato intacto
```

```js
// Capa 3 — runtime: pegar en la consola ANTES y DESPUÉS del cambio; el diff debe estar vacío.
// (indexedDB.databases() requiere Chrome/Edge; en Firefox comprobar a mano en Application.)
(async () => {
  const ls = Object.keys(localStorage).filter(k => /cube[_-]?forge/i.test(k)).sort()
  const idb = ((await indexedDB.databases?.()) ?? []).map(d => d.name).filter(n => /cube[_-]?forge/i.test(n)).sort()
  console.log('ALMACENAMIENTO:', JSON.stringify({ ls, idb }, null, 2))
})()
```

**Capa 4 — datos:** contar solves/sesiones antes y después (la UI ya los muestra; o consultar la BD),
y reimportar el JSON exportado en el Nivel 0. Si los números coinciden, el contrato se respetó.

### 14.5 Segunda revisión pre-congelación: huecos encontrados y correcciones

> Revisión crítica pedida antes de congelar. **Encontré tres fallos en la primera pasada.**

#### 14.5.1 El patrón de la primera pasada tenía un punto ciego

Exigía que la marca estuviera **al principio** del literal (`'cubeforge...'`). Todo lo que la
lleva en medio o como *valor* se escapó. Huecos reales encontrados:

| Ubicación | Qué es | Riesgo |
| --- | --- | --- |
| `apps/web/src/widgets/debug.ts:58` | `w["__cubeforgeDebugWidgets"]` — global de ventana documentado como API de consola (`debug.ts:10,48`) | Bajo (depuración) pero **es un escape real** |
| `apps/web/src/boot/logCapture.ts:217` | `window.__cubeforgeLogs` — API de consola | Bajo |
| `apps/web/src/hooks/solveSessionDebug.ts:399` | `w.__cubeforgeLastSolve__` | Bajo |
| `apps/web/src/widgets/debug.ts:35` | `console.groupCollapsed("%c[cubeforge] widget positions")` | Cosmético |
| **`apps/web/src/theme/themeShare.ts:26,63,97`** | `app: 'cubeforge'` + validador estricto (`:63` devuelve `null` si no coincide) | **ALTO — contrato de importación** (§14.5.3) |
| `apps/web/src/widgets/implementations/*/definition.ts` | `author: "cubeforge"` en **11 widgets** → visible en el dock/explorador | Medio (verificado: nadie filtra por `author`, es solo metadato) |
| `apps/web/src/components/Layout/LeftSidebar.tsx:356` | Texto `cubeforge` visible en la barra lateral | **Visible** |
| `apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx:862` | `AaBbCcDd · CubeForge` en la vista previa del estudio de temas | **Visible** |
| `apps/web/src/components/theme-provider.tsx:26,29,46` | id de elemento DOM `cubeforge-composite-font` (3 refs, un fichero) | Bajo (consistente en un fichero) |
| Nombres de descarga (5 familias) | `cubeforge-{name}.csv`, `-cstimer.csv`, `.xlsx`, `cubeforge-locker-*.json`, `cubeforge-profile-*.json`, `cubeforge-theme-*.json`, `cubeforge-all-sessions.json` | Ninguno (payload libre) |
| `scripts/changelog.config.json:3` | `https://github.com/Doritozz05/Cubeforge/commit/{sha}` | Bajo (el redirect de GitHub lo tapa, pero genera URLs con el nombre viejo) |

**Cifras corregidas:** **120 literales únicos** con la marca (≈68 excluyendo los imports del
paquete), y **507 ficheros** contienen al menos un literal con la marca (577 con la marca en
cualquier forma). La primera pasada dijo 46 y 68: eran un **suelo**, no el total.

#### 14.5.2 Landmine nuevo y el único bug funcional real de un rename: enumeración por prefijo

Hay código que **no escribe una clave, sino que recorre localStorage/sessionStorage buscando por
prefijo**:

```ts
// apps/web/src/components/Settings/sections/AdvancedSection.tsx
// :48  "Every key the app owns in localStorage shares the `cubeforge` prefix"
function clearAppStorage() {            // :56-70  → botón "Borrar datos de la app"
  ... if (key && key.startsWith("cubeforge")) keys.push(key) ... localStorage.removeItem(key)
}
function useAppStorageEntries() {       // :104-121 → inspector de almacenamiento
  if (key.startsWith("cubeforge") || value.length > 2048) out.push({ key, bytes })
}
```
```ts
// apps/web/src/services/Global3DSnapshotService.ts
const STORAGE_PREFIX = "cubeforge_snap_3d_v8_";   // :10
if (key && key.startsWith(STORAGE_PREFIX)) ...      // :91  enumerar
if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k)  // :238 evacuar caché
```

**Consecuencia si se renombran claves sin tocar esto:** el botón *Borrar datos de la app*
**deja de borrar** y el inspector **deja de listar** las claves propias. **Fallo silencioso, sin
error, sin test que lo detecte.** Regla obligatoria mientras convivan claves viejas:
`startsWith('cubeforge') || startsWith('cubalyze')`.

**Esto refuerza el Nivel 1:** si no se renombra ninguna clave, esta lógica queda intacta y el
rename **no puede introducir ningún bug funcional**.

#### 14.5.3 Landmine nuevo: un SEGUNDO contrato de importación (temas compartidos)

No solo los solves tienen formato con la marca. Los temas exportados también:

```ts
// apps/web/src/theme/themeShare.ts
export const THEME_SHARE_VERSION = 1;
export interface SharedThemeFile { version: 1; app: 'cubeforge'; ... }   // :26
if (f.version !== THEME_SHARE_VERSION || f.app !== 'cubeforge') return null;  // :63 → RECHAZA
```

Cualquier tema ya exportado o compartido por el usuario **deja de importarse** si se cambia el
valor sin aceptar también el viejo. Se añade a la lista de *contratos*: aceptar `cubeforge` y el
valor nuevo al leer; escribir siempre el nuevo. Tests: `themeShare.test.ts:6` fija hoy `app:"cubeforge"`.

#### 14.5.4 Clasificación definitiva de los ~68 literales (sin contar imports)

| Grupo | Literales | Acción |
| --- | --- | --- |
| **PERSISTIDO (congelar)** | `/cubeforge.sqlite3`, `cube-forge-db`, `cubeforge-collection`, `cubeforge-media`, `cubeforge-fonts`, `sqlite:cubeforge.db`, `com.cubeforge.desktop`, `cubeforge-prefs`, `cubeforge:widgets`, `cubeforge:activeSessionId`, `cubeforge:custom-algs`, `cubeforge:favorite-colors`, `cubeforge:infinite-f2l:options`, `cubeforge:reminders-fired`, `cubeforge:skills-migrated`, `cubeforge:calendar-migrated`, `cubeforge:widgetPosMigrated`, `cubeforge:log-buffer`, `cubeforge:chunk-reload-ts`, `cubeforge_snap_3d_v8_`, `cubeforge_puzzle`, `cubeforge_random_puzzle_pool`, `cubeforge_notes_storage`, `cubeforge_phase_stats_tab`, `cubeforge_phase_stats_sort`, `cubeforge_full_solve_mode`, `cubeforge_full_solve_inspection`, `cubeforge_completed_skills_v2`, `cubeforge_onboarding_completed`, `cubeforge-training-calendar`, `cubeforge-locker`, `cubeforge:cube2dPanelPos`, `cubeforge:cubeBtnPos`, `cubeforge:timesPanelPos`, `cubeforge:timeDistPanelPos`, `cubeforge:pbProgPanelPos`, `cubeforge:phaseTimelinePanelPos` | Congelar + prefijos duales en §14.5.2 |
| **CONTRATO (aceptar el viejo al leer)** | `cubeforge-json`, `cubeforge-csv`, `cubeforge-locker` (id de formato) · `themeShare.app: 'cubeforge'` | Escribir el nuevo, leer ambos |
| **LIBRE (renombrar sin consecuencias)** | `cubeforge:open-logs`, `cubeforge:cfop-debug`, `cubeforge:moves-debug`, `cubeforge:debug-ui`, `cubeforge:orientation-debug` (banderas/eventos) · `__cubeforgeLogs`, `__cubeforgeDebugWidgets`, `__cubeforgeLastSolve__` · `CubeforgeCompositeDigits` (familia tipográfica) · `cubeforge-composite-font` (id DOM) · `author: "cubeforge"` (11 widgets) · `cubeforge_lib` (crate) · `cubeforge-json`/`cubeforge-csv` (ids de `detectFormat`) · los 7 nombres de descarga · comentarios de código | Renombrar — **✅ hecho en PR-5** (el escritor de `cubeforge-sync` NO: ver la corrección de abajo) |

> **Corrección a esta tabla (PR-5).** `cubeforge-sync` estaba clasificado aquí como LIBRE y **no lo
> es**: `apps/web/tests/contracts/storageContract.test.ts` lo fija como el 26.º namespace persistido
> (BroadcastChannel entre pestañas). Renombrarlo rompería la sincronización entre una pestaña abierta
> con la versión antigua y otra con la nueva durante el despliegue, y el contrato ya lo prohíbe. Se
> queda con el nombre histórico: es una **contradicción del documento que la guarda detectó**, igual
> que el crate de Cargo que el §15.8 daba por libre.
>
> Nota de forma: las banderas de depuración `cubeforge:*` **sí** se renombraron a `cubalyze:*`, y por
> eso `AdvancedSection` —que enumera las claves por prefijo para «Borrar datos de la app» y el
> inspector— pasó a aceptar **los dos prefijos** (§14.5.2). Con uno solo, esas dos funciones fallarían
> en silencio: el inspector ocultaría las claves nuevas y el borrado las dejaría atrás.

#### 14.5.5 Lo que un grep NUNCA verá: superficies fuera del repo

| Superficie | Qué revisar |
| --- | --- |
| **Supabase** | Nombre del proyecto (aparece en el flujo OAuth de Google), **plantillas de email de Auth** (confirmación de registro, magic link, recuperación) que llevan el nombre del proyecto, remitente SMTP, Site URL + redirect allowlist, secrets de edge functions |
| **Google Cloud** | OAuth consent screen (App name, logo, dominios autorizados), nombre del proyecto de GCP. El `client_id` **no** se renombra |
| **Vercel** | Nombre del proyecto, dominios, valores de env vars |
| **GitHub** | Nombre del repo, descripción, topics, y `scripts/changelog.config.json` (URL template) |
| **Escritorio** | `productName` (menú Inicio, título de ventana, instalador NSIS), carpeta de datos, identidad de firma |
| **Dispositivos** | Nombre de la PWA instalada (manifest), `apple-touch-icon`, pestaña |
| **Buscadores** | Search Console: propiedad + sitemap reenviado |

#### 14.5.6 Qué cambia esto en el plan

1. La congelación pasa de 46 a ~68 literales (mismo coste: siguen concentrados en pocos ficheros).
2. La constante congelada debe incluir también **los prefijos que se enumeran** (`cubeforge`,
   `cubeforge_snap_3d_v8_`) y el **contrato de tema** del §14.5.3.
3. El **Nivel 1 sale reforzado**: no renombrar claves deja la enumeración por prefijo intacta y
   elimina el único bug funcional que el rename podía introducir.
4. Verificación ampliada: además de login/solves/export, probar **"Borrar datos de la app"**,
   el **inspector de almacenamiento** (Advanced) y **exportar/importar un tema**.

### 14.6 Tercera revisión: cazando MECANISMOS, no literales

Cambio de metodología: las dos primeras pasadas buscaban el nombre. Esta busca **mecanismos que
pueden depender del nombre sin escribirlo**: enumeraciones de almacén, comprobaciones por prefijo,
canales con nombre, serializaciones con discriminador, valores derivados en runtime y datos semilla.

#### Resultados por clase (comandos que NO mencionan la marca)

| Clase | Patrón usado | Resultado medido | Veredicto |
| --- | --- | --- | --- |
| Enumerar localStorage/sessionStorage | `(localStorage\|sessionStorage)\.(key\|length)` | **4 bucles, 2 ficheros**: `AdvancedSection.tsx:58,59,109,110`, `Global3DSnapshotService.ts:88,90,236,237` | **ACOPLADO** (§14.5.2) |
| Comprobaciones por prefijo | `startsWith(` | 25 usos; **solo 4 tocan la marca** (`:60`, `:114`, `:91`, `:238`) | **ACOPLADO** (2 ficheros) |
| Workers con nombre | `new (Shared)Worker(` | worker sin opción `name`; solo `BroadcastChannel("cubeforge-sync")` | Interno → libre |
| Canales realtime de Supabase | `\.channel(` / `\.topic(` | **0** | Limpio |
| Título derivado en runtime | `document.title` | **2 fuentes**: `meta:brand` (`useDocumentTitle.ts:24`) y `common:appTitle` (`i18n/index.ts:102`) | **ACOPLADO** (2 claves i18n) |
| Nombres derivados en Rust | `package_info`, `app_data_dir`, `identifier`, `get_name` | **0 coincidencias** | Limpio: el escritorio no deriva rutas del nombre |
| Contratos de serialización | `app:`, `version:`, `FORMAT_VERSION` | tema (`app:'cubeforge'`) y locker (`format:'cubeforge-locker'`) | **2 contratos reales** (ver corrección) |
| Cabeceras HTTP propias | `X-Client`, `User-Agent` | 0 con marca | Limpio |
| CORS de edge functions | `Access-Control-Allow-Origin` | `*` en las 2 funciones | Limpio (no hay allowlist de origen) |
| Datos semilla / demo | marca en `seedDemoData.ts`, `src/data/**`, preview de temas | 0 (solo imports) | Limpio |
| Datos guardados en BD | `app_meta` | claves neutras (`sync_dirty`, `local_clock_solves`); `INSERT` con marca: **0** | Limpio |
| Guarda de build | `apps/web/scripts/verify-worker-build.mjs` | valida marcadores de *comportamiento* (`_migrations`, timeout), no el nombre | Re-ejecutar tras el rename |

#### Hallazgo nuevo: una forma del nombre invisible a los patrones de prefijo/separador

`apps/web/src/components/theme-provider.tsx`:

```css
/* :34  dentro del CSS que el componente inyecta */
font-family: 'CubeforgeCompositeDigits';
/* :213,214  y ademas como primer fallback de las variables tipograficas */
root.style.setProperty('--app-font-sans', `'CubeforgeCompositeDigits', ${resolvedSans}`);
```

Es una **familia tipográfica**: C mayúscula y **sin separador**. Se escapa de cualquier búsqueda
que exija `cubeforge-`, `cubeforge_` o minúsculas. Todas sus referencias viven en ese fichero (más
el id de elemento `cubeforge-composite-font` en `:26,29,46`) → renombrarlo es seguro, pero
**demuestra que una lista de literales nunca está completa**.

#### Corrección: la superficie de contratos es menor de lo que dije

- `cubeforge-json` y `cubeforge-csv` **no se escriben dentro de los ficheros**: son etiquetas
  internas que `detectFormat()` devuelve al inspeccionar el contenido (el CSV exporta
  `No.,Time,Penalty,…` y el JSON un array sin campo discriminador — no aparece `app`/`version` en
  `exportSolves.ts`). Renombrarlas es **libre** (código + claves i18n + tests a la vez).
- Los **contratos reales son dos**: el `format: 'cubeforge-locker'` *dentro* del fichero de
  colección (`collectionTransfer.ts:105`, ya versionado con `version`) y el `app: 'cubeforge'`
  *dentro* del tema compartido (`themeShare.ts:26`).

##### Corrección de esta corrección (al ejecutar PR-4) — son **tres**, no dos

La frase anterior es **falsa** en su segunda mitad: `exportSolves.ts` **sí** escribe un discriminador
dentro del fichero. Lo que ocurrió es que esta pasada buscó el nombre en los *valores de retorno* de
`detectFormat()` (`cubeforge-json`, `cubeforge-csv`) y no en el campo que realmente viaja escrito,
`app: "CubeForge"` (`exportSolves.ts:108,140` y `App` en la hoja `Info` del `.xlsx`), que `importSolves.ts`
exige para detectar y para tomar la ruta full-fidelity (`:110`, `:909`).

Y el documento **se contradecía a sí mismo**: §15.8 ya listaba ese mismo discriminador como contrato real,
y el test del artefacto —escrito en PR-1— lo declaraba explícitamente como el motivo de su existencia. Es
decir: la contradicción no la encontró un grep, la encontró **comparar dos secciones propias**.

| Contrato | Escrito en | Leído por | Etiqueta heredada |
|---|---|---|---|
| `app` del tema compartido | `themeShare.ts` / `ThemeShareSection.tsx` | `parseSharedTheme` | `cubeforge` |
| `format` del backup de colección | `collectionTransfer.ts` | `isLockerFile` | `cubeforge-locker` |
| `app`/`App` del export de solves | `exportSolves.ts` (JSON + `.xlsx`) | `importSolves.ts` | `CubeForge` |

**`cubeforge-locker` es dos constantes distintas que comparten texto**, y clasificarlas igual sería el
fallo: `COLLECTION_STORAGE_KEY` (`collectionStore.ts:83`) es una clave de `localStorage` **congelada de
por vida**, mientras que `LOCKER_FILE_FORMAT` es un marcador **dentro** del fichero exportado y por tanto
un contrato con doble lectura. Un rename ciego de esa cadena no rompe un fichero: **pierde la colección
entera** de quien tenga el blob antiguo.

#### Hallazgo nuevo: dos fuentes para el título y un texto que ignora i18n

- El título visible se compone de **`meta:brand`** (`useDocumentTitle.ts:24`) con fallback a
  **`common:appTitle`** (`i18n/index.ts:102`). Hay que renombrar **ambas** claves, no una.
- `apps/web/src/components/Layout/LeftSidebar.tsx:356` pinta el literal `cubeforge` **sin pasar
  por i18n** → si solo se renombran los locales, la barra lateral conserva el nombre viejo y
  ningún test de i18n lo detecta.

#### Prueba medida: por qué falló el recuento (y por qué NO fue la búsqueda)

```bash
# Un grep normal, insensible a mayúsculas, YA encuentra todo lo que "se escapó" en la 1ª pasada:
git grep -in "cubeforge" -- apps/web/src/components/theme-provider.tsx \
    apps/web/src/boot/logCapture.ts apps/web/src/theme/themeShare.ts
#   logCapture.ts:217     window.__cubeforgeLogs          ← mayúsculas/minúsculas irrelevantes
#   theme-provider.tsx:34 font-family: 'CubeforgeCompositeDigits';
#   themeShare.ts:26      app: 'cubeforge';
```

| Patrón | Ficheros de código | Diferencia |
| --- | --- | --- |
| A · `cubeforge` (insensible a mayúsculas) | **577** | — |
| B · `cube[ _.-]*forge` (agnóstico al separador) | **578** | **+1**: `packages/database/src/indexeddb-snapshot.ts` (`cube-forge-db`) |

**Conclusión de la medición:** el caso de las mayúsculas **no era el problema** (el grep normal los
cubre todos: `__cubeforgeLogs`, `CubeforgeCompositeDigits`, `author: "cubeforge"`, `app: 'cubeforge'`).
El único punto ciego real de un grep normal es **el guion**: `cube-forge-db` — y en todo el repo es
**exactamente un fichero**. Lo que falló en las dos primeras pasadas fue el **recuento por patrones
estrechos** (exigir la marca al principio del literal), no la capacidad de buscar: se optimizó para
"menos ruido" cuando en una auditoría de datos hay que optimizar para "cero falsos negativos".

Quedan por tanto **dos clases que ningún grep puede cubrir**: (1) lo que no está en el repo (claves ya
escritas en los dispositivos de los usuarios, filas de BD, plantillas de email de Supabase, consola de
Google, nombre del repo y del dominio) y (2) lo que se construye en tiempo de ejecución — **verificado
que en este repo NO ocurre**: 0 derivaciones (`pkg.name`, `package_info`, `app_data_dir`,
`npm_package_name`).

#### Conclusión metodológica

Dos pasadas basadas en listas encontraron 5 huecos; esta tercera encontró 2 más (familia
tipográfica y fuentes del título). Ninguna lista "falló": **una lista de literales es
estructuralmente incompleta.** Por tanto el mecanismo de seguridad no puede ser la lista:

1. **Módulo congelado + test de guarda** → evita el cambio accidental de lo ya conocido.
2. **Diff de la superficie de almacenamiento en runtime** → cubre lo desconocido: lo que exista en
   un dispositivo real antes y después debe coincidir.
3. **Pruebas de comportamiento** de todo lo que depende del nombre: borrar datos de la app,
   inspector de almacenamiento, importar locker y tema, título de la pestaña, nombre de la app
   instalada.
4. **Patrón de inventario definitivo** (insensible a mayúsculas y agnóstico al separador, que sí
   encuentra `CubeforgeCompositeDigits`):
   ```bash
   git grep -inIE "cube[ _.-]*forge"
   # aun así: asumir que se escapan valores construidos en runtime (§14.5.2)
   ```

### 14.7 Cuarta pasada: auditoría del ARTEFACTO compilado (lo que ningún grep de código ve)

Motivación: el bundle minificado es el único sitio donde las cadenas de runtime sobreviven tal y
como las verá el usuario. Se auditó `apps/web/dist` (tras `pnpm build`) con el patrón agnóstico.
**Encontró dos cosas que las tres pasadas anteriores no habían clasificado bien.**

| Hallazgo | Dónde (fuente) | Naturaleza | PR |
| --- | --- | --- | --- |
| **Discriminador DENTRO del fichero exportado** | `exportSolves.ts:108,140` (`app: "CubeForge"`), `:226` (columna `App:` del .xlsx), `importSolves.ts:110,909` (`data.app === "CubeForge"`) | **CONTRATO** con ficheros que el usuario ya guardó. Renombrar el escritor sin enseñar al lector rompe TODAS las copias anteriores. Ya hay tests que fijan el valor (`exportSolves.test.ts:185,235,257`): falta la doble lectura | **PR-4** |
| **Copy visible hardcodeada (fuera de i18n)** | `LeftSidebar.tsx:356`, `ThemeStudioModal.tsx:862`, `importSolves.ts:1016` (`…Supported: csTimer CSV, CubeForge CSV/JSON…`), `collectionTransfer.ts:294` (`Not a CubeForge collection file`) | Texto visible: renombrar es libre | **PR-2** |
| **Autoría de widgets** | 11 × `widgets/implementations/*/definition.ts` → `author: "cubeforge"` | Visible en el dock/explorador (nadie filtra por él) | **PR-2** |
| **Logs de consola** | `dataIntegrity.ts:69,120,126,145`, `widgets/debug.ts:35` | Depuración | **PR-5** |
| **Salts del identicon = identidad derivada** | `packages/identicon/src/hash.ts:31-39`: `'cubeforge'`, **`'forgemark'`**, `'cubemark'`, `'identicon'`… | **CONGELADO.** El avatar se deriva de (seed, salts): el seed está guardado, el dibujo **no** → cambiarlos re-skinnea el avatar de **todos** los usuarios existentes | Congelado + test |
| Referencia al scope en el SQL de una migración | `migrations.ts` (el bundle lleva el SQL) | Las migraciones aplicadas son **inmutables** (sus ids viven en `_migrations` de cada dispositivo) | Congelado |

#### El hallazgo que responde a «¿un grep no lo encuentra todo?»: `forgemark`

```ts
// packages/identicon/src/hash.ts:31-39
const HASH_SALTS = [
  'cubeforge',
  'forgemark',   // ← token DERIVADO de la marca que NO contiene «cubeforge»
  'cubemark',
  'identicon', 'profile', 'avatar', 'seed', 'glyph',
] as const;
```

`forgemark` **no contiene la cadena `cubeforge`**: ningún grep del nombre puede encontrarlo jamás,
con ninguna combinación de mayúsculas ni separadores. Solo aparece si se audita el artefacto, o si
alguien lee ese fichero. Es la demostración literal de que «buscar el nombre» y «encontrar todo lo
que depende del nombre» son dos problemas distintos.

#### Lección metodológica: cada pasada cambia de herramienta, no de celo

| Pasada | Qué buscó | Qué encontró |
| --- | --- | --- |
| 1ª | El nombre escrito (patrón estrecho) | Inventario inicial (subestimado) |
| 2ª | Mecanismos que dependen del nombre (prefijos, enumeraciones, validadores) | El acoplamiento por prefijo y el contrato del tema |
| 3ª | Mecanismos, patrón agnóstico al separador | La familia tipográfica y las dos fuentes del título |
| **4ª** | **El artefacto compilado (runtime)** | **El discriminador del export/import y los salts del identicon** |

Por eso el residuo no se gestiona con un grep, sino con **tests que caducan solos**
(`apps/web/tests/contracts/artifactResidue.test.ts`): clasifica cada mención restante como
*congelada* o *pendiente-con-PR*, **falla si aparece copy sin clasificar** y **falla si una entrada
pendiente desaparece** (lo que obliga a limpiar la lista en el mismo momento en que el PR
correspondiente la elimina).

### 14.8 Traducido a este proyecto

- **Renombrar:** scope `@cubeforge/*` (privado → libre), título y OG, manifest PWA, i18n, textos,
  docs vivas, `Cargo.toml`/`authors`, `package.json`, dominio + 301, consent screen de Google,
  nombre del repo. Esto es el 99% de lo que ve el usuario y el 100% de lo que ve un buscador.
- **Congelar (documentado):** `/cubeforge.sqlite3`, `cube-forge-db`, `cubeforge-collection`,
  `cubeforge-media`, `cubeforge-fonts`, `cubeforge-prefs`, `cubeforge:*`, `com.cubeforge.desktop`,
  `cubeforge.db`, los ids de formato de exportación (que además se aceptan en versión vieja),
  el project ref de Supabase y el nombre del bucket `locker-photos`.
- **Resultado:** el usuario ve "Cubalyze" en el 100% de la superficie; el sistema operativo y el
  navegador siguen viendo nombres históricos que nadie inspecciona jamás. Es exactamente lo que
  hacen Meta, X y Vercel.

---

## 15. Plan de PRs por radio de impacto (recomendación operativa)

### 15.1 El criterio de detección: incluir por ubicación, excluir por mecanismo

No se detecta "lo que es UI" leyendo el texto (un heurístico de contenido siempre falla). Se
detecta con dos reglas independientes:

1. **Inclusión por ubicación** — solo son candidatas las superficies declaradas: valores de
   `i18n/locales/*`, `index.html`, bloque `manifest` de `vite.config.ts`, ficheros SEO de
   `public/`, y nodos de texto en JSX.
2. **Exclusión por mecanismo, con la lista negra CALCULADA** — nunca escrita a mano:

```bash
# Lista negra: ficheros que tocan un mecanismo (se recalcula en cada revisión, no caduca)
git grep -lE "(localStorage|sessionStorage|indexedDB|Database\.load|sqlite|caches\.open|startsWith\(|STORAGE_PREFIX)" -- apps packages > /tmp/mech.txt
git grep -lE "['\"\`](cubeforge|cube-forge)[:.a-zA-Z0-9_-]*['\"\`]" -- apps packages >> /tmp/mech.txt
git grep -lE "(author: *\"cubeforge\"|app: *'cubeforge')" -- apps packages >> /tmp/mech.txt
sort -u /tmp/mech.txt > /tmp/dangerous.txt        # ficheros con mecanismo

# Candidatos: con la marca pero SIN mecanismo
git grep -ilI "cubeforge" -- apps packages | sort > /tmp/all.txt
comm -23 /tmp/all.txt /tmp/dangerous.txt > /tmp/candidates.txt

# Y separar IMPORT (scope, mecánico) de TEXTO REAL (la marca no precedida de '@')
git grep -ilIE "(^|[^@[:alnum:]/_-])cube[ _.-]*forge" -- apps packages | sort > /tmp/text_real.txt
```

**Medición resultante (2026-09-15):**

| Conjunto | Ficheros |
| --- | --- |
| Con la marca (total código) | 577 |
| Con algún mecanismo → **tratamiento manual/congelado** | **136** |
| Con **texto real** (no import de paquete) | 122 |
| &nbsp;&nbsp;· de esos, código (no test/config) | 79 |
| &nbsp;&nbsp;· de esos, con mecanismo → congelados | 59 |
| **Texto visible en código SIN mecanismo → PR-2** | **20** |
| Scope `@cubeforge/*` (imports) | 592 ficheros · 1301 refs |
| Configs con scope (`package.json`, `tsconfig*`, `knip`, `typedoc`, `vitest`, `eslint`) | 51 |
| Tests a actualizar | 121 |

**Traducción a horas:** la superficie visible completa (PR-1 + PR-2) es de **~80 líneas en 27
ficheros**. El resto del esfuerzo es mecánico (scope) o congelado (mecanismos).

### 15.2 Los PRs, en orden de despliegue

#### PR-1 · Superficie visible declarada — 7 ficheros, 55 líneas

| Fichero | Líneas | Qué se cambia |
| --- | --- | --- |
| `apps/web/src/i18n/locales/es.json` | 19 | **Valores** visibles (appName, appTitle, `meta:brand`, créditos, import/export, auth) |
| `apps/web/src/i18n/locales/en.json` | 19 | Ídem en inglés |
| `apps/web/public/llms.txt` | 9 | Descripción + URL del repo (SEO/LLM) |
| `apps/web/index.html` | 3 | `<title>`, meta description, `og:title` |
| `apps/web/vite.config.ts` | 3 | `manifest.name`, `short_name`, `description` |
| `apps/web/public/robots.txt` | 1 | URL del sitemap |
| `apps/web/public/sitemap.xml` | 1 | URL canónica |

**Reglas del PR-1:**
- **Solo valores, nunca claves.** `formatNameCubeforgeCsv` / `formatNameCubeforgeJson` y sus usos
  en `DataSection.tsx` **no se tocan** (renombrar esa clave obliga a cambiar código + tests).
- No se toca ningún literal que aparezca en un fichero de la lista negra (el título se cambia solo
  por el **valor** de `meta:brand`, cuya clave permanece).
- **Gate contractual** (falla si el PR roza algo congelado):
  ```bash
  git diff --unified=0 origin/main...HEAD | grep -E '^[+-][^+-]' \
    | grep -qE "localStorage|sessionStorage|indexedDB|Database\.load|startsWith\(|cubeforge-(prefs|locker|collection|media|fonts)|cubeforge[:._]|cube-forge-db|cubeforge\.sqlite3|sqlite:cubeforge\.db|com\.cubeforge\.desktop" \
    && { echo 'GATE FAILED'; exit 1; } || echo 'GATE OK'
  ```
- **Verificación de comportamiento:** el título de la pestaña cambia (se deriva de `meta:brand`),
  el nombre de la PWA instalada cambia, y el **diff de superficie de almacenamiento en runtime
  queda VACÍO** — prueba de que este PR no tocó nada persistido.

#### PR-2 · Texto restante sin mecanismo — 20 ficheros, ~25 líneas

`widgets/debug.ts`, `Layout/LeftSidebar.tsx:356`, `ThemeStudioModal.tsx:862`, comentarios y textos
sueltos en `exportSolves.ts`, `App.tsx`, `themePresets.ts`, `sync-engine`, `solver-engine`, `types`,
`training`… Se revisan en bloque: son texto, no contratos. Incluye arreglar la inconsistencia de la
barra lateral (texto a mano que ignora i18n).

#### PR-3 · Scope `@cubeforge/*` → `@cubalyze/*` — 592 ficheros, 1301 refs

Mecánico y **atómico** (un commit): imports + `package.json` de los 21 paquetes + `tsconfig*` +
`knip.jsonc` + `typedoc*.json` + `vitest.config.ts` + `.github/workflows/*` + `eslint.config.js` +
overrides de `apps/desktop`. Después `pnpm install` (regenera el lockfile). Gate: `typecheck` 0
errores, `lint` 0 warnings, tests 100% y `pnpm build` (incluye `verify-worker-build.mjs`).

#### PR-4 · Contratos con doble lectura — 2 contratos

`themeShare.ts` (`app`) y `collectionTransfer.ts` (id de formato): leer ambos, escribir el nuevo,
+ tests de compatibilidad con ficheros antiguos. **Nunca** cambia el nombre del fichero OPFS/IndexedDB.

#### PR-5 · Nombres internos de desarrollo (opcional)

Globales de consola (`__cubeforgeLogs`…), eventos de ventana, canales, banderas de depuración,
nombres de descarga, id de DOM y familia tipográfica `CubeforgeCompositeDigits`. Todo es
inofensivo, pero forma parte del "residuo" que un usuario curioso vería en DevTools.

#### Congelado (documentado, no se toca)

`/cubeforge.sqlite3`, `cube-forge-db`, `cubeforge-collection|media|fonts`, `cubeforge-prefs`,
`cubeforge:*`, `cubeforge_*`, `sqlite:cubeforge.db`, `com.cubeforge.desktop`. Con el comentario
"NO RENOMBRAR" en el módulo de persistencia (§14.3).

#### Fuera del repo (checklist §14.6.5)

Supabase (+plantillas de email), Google Cloud, Vercel, GitHub y DNS. Sin código.

### 15.3 Por qué PR-1 va primero

1. **No puede perder datos:** no hay una sola cadena con estado en él.
2. **Se ve inmediatamente:** el usuario ya percibe el cambio de marca el día 1.
3. **Es revertible en un clic:** no migra, no invalida, no reescribe nada.
4. **Valida toda la tubería** — build, deploy, dominio, cache-busting del service worker — con el
   riesgo más bajo posible, antes de afrontar el scope (que es el que rompe el build si va a medias).
5. **Deja preparada la verificación** (diff de runtime vacío) que después se reutiliza en cada PR.

### 15.4 PR-1 ejecutado — evidencia (rama `rebrand/pr-1-visible-surface`)

Nada commiteado todavía: 6 ficheros modificados + 4 nuevos (3 de test + esta auditoría), todo en el
árbol de trabajo.

**Cambio (6 ficheros · 60 insertos / 49 borrados)**

| Fichero | Qué cambia |
|---|---|
| `apps/web/src/i18n/locales/es.json` · `en.json` | 19+19 **valores** de copy visible. Las claves `formatNameCubeforge*` se quedan (§15.2) |
| `apps/web/index.html` | `title`, `description`, `og:title` + comentario que ancla la paridad con `common:appTitle` |
| `apps/desktop/index.html` | `<title>` de la ventana |
| `apps/web/vite.config.ts` | `manifest.name` y `short_name` (lo que se ve bajo el icono instalado) |
| `apps/desktop/tsconfig.json` | fix de la colisión de programas TypeScript (ver abajo) — **sin él el job `typecheck` del CI estaba en rojo** |

**Red de seguridad (4 ficheros · 643 líneas)** — no son tests de comportamiento, son **contratos**:

| Test | Qué fija |
|---|---|
| `apps/web/tests/contracts/brandSurface.test.ts` | 18 tests: ningún **valor** de i18n conserva la marca; **una sola grafía visible** (siempre `Cubalyze`: ni `cubalyze`, ni `CUBALYZE`, ni `Cub-Alyze`); paridad `<title>` ≡ `common:appTitle`; shells HTML; manifest; y la lista de SEO que **caduca sola** (cada fichero debe seguir teniendo la URL antigua: cuando el cutover los renombre, el test falla y obliga a limpiar la lista) |
| `apps/web/tests/contracts/storageContract.test.ts` | 29 tests: los 26 namespaces persistidos (localStorage/IndexedDB/sessionStorage/BroadcastChannel) con fichero + qué pierde el usuario si se renombra, y el **acoplamiento por prefijo** de `AdvancedSection` (2 bucles) |
| `packages/database/src/__tests__/storage-contract.test.ts` | 5 tests: `/cubeforge.sqlite3` (2 aperturas), `cube-forge-db`, `sqlite:cubeforge.db`, `identifier` de Tauri, crate de Rust |
| `packages/identicon/src/__tests__/hash-salts.contract.test.ts` | 2 tests: los 8 `HASH_SALTS` **en orden**, incluido el derivado `forgemark` que ningún grep del nombre puede encontrar |
| `apps/web/tests/contracts/artifactResidue.test.ts` | 3 tests sobre **`dist/`**: clasifica cada residuo del bundle en CONGELADO / PENDIENTE-de-PRx / regresión. Las entradas PENDIENTE **caducan solas** (si ya no están, el test falla y obliga a borrarlas) |

**Verificación ejecutada**

| Comprobación | Resultado |
|---|---|
| `pnpm --filter web exec vitest run` | **940 passed / 87 files** (antes del PR: 936/86) |
| `@cubeforge/database` · `@cubeforge/identicon` | **266** y **22** passed |
| `pnpm --filter web build` (`tsc -b` + vite + verify-worker) | OK · manifest `"name":"Cubalyze"` · `dist/index.html` con el `<title>` nuevo |
| Gate contractual del diff (¿toca algo persistido?) | **OK — cero líneas con almacén/identificador** |
| `eslint` de lo tocado · `lint:lines` | Limpio · 0 violaciones nuevas |
| Residuo en la superficie PR-1 | Solo las claves declaradas + un comentario `@cubeforge/ui` (scope → PR-3) |

**Pruebas en rojo (mutation testing manual)** — un test que nunca ha fallado no demuestra nada:

1. Cambiar un valor de i18n ⇒ falla `storageContract`… y falla `brandSurface` por el valor.
2. Bajar el `<title>` a minúscula ⇒ **fallan exactamente los 2 tests del título** (capitalización +
   paridad con `appTitle`); revertido y verde de nuevo.
3. El test del artefacto se construyó en rojo→verde (111 ventanas sin clasificar → 0), que es su
   propia prueba de que detecta.

**Tres hallazgos de la pasada a mano (no salen de ningún grep)**

1. **El `<title>` estático estaba en minúscula** (`cubalyze`) mientras `common:appTitle` (el que i18n
   escribe en runtime) es `Cubalyze`. Dos fuentes del mismo texto que podían divergir: el título
   parpadeaba al cargar y los buscadores indexaban una grafía distinta de la de la app. Se unificó y
   se añadió el test de **igualdad exacta** `<title>` ≡ `en.common.appTitle`.
2. **`useDocumentTitle.ts`**: su JSDoc sigue diciendo « · CubeForge» y el código usa
   `i18n.t("meta:brand")` — comentario obsoleto, sin efecto funcional. Va a PR-2 (comentarios).
3. **`common:appName` seguía en minúscula** (`cubalyze`). Yo había preservado la grafía del nombre
   antiguo (`cubeforge`) por fidelidad al original, y eso era el criterio equivocado: un nombre propio
   se escribe siempre igual. Decisión vigente (§15.5): **`Cubalyze` es la única grafía visible**, con
   test que rechaza cualquier variante.

### 15.5 Grafía canónica: una sola forma, siempre `Cubalyze`

Regla del proyecto, con test en `brandSurface.test.ts`:

- **Texto visible → siempre `Cubalyze`.** Sin `cubalyze`, `CUBALYZE`, `Cub-Alyze` ni `Cub Alyze`.
  Ver dos formas del mismo nombre en la misma interfaz se lee como descuido de marca.
- **Identificadores de código → minúsculas por convención.** El scope `@cubalyze/*` (PR-3), nombres de
  fichero y claves técnicas siguen en minúscula: no son marca, son identificadores. El test **no** los
  mira, para que la regla de marca no bloquee el trabajo técnico.
- **Única excepción visible: un nombre de host** (`cubalyze.app`), que va en minúsculas por convención
  de URL. Cualquier otra forma obliga a declararla explícitamente en el test — que es exactamente el
  punto: que una segunda grafía sea una decisión, no un descuido.

**Prueba en rojo ejecutada:** con `common:appName` en minúscula el test falla y señala el culpable
(`common.appName → «cubalyze»`); revertido, verde.

### 15.6 PR-2 ejecutado — la copy visible suelta

Los 5 sitios que quedaban fuera de los ficheros de idioma, resueltos:

| Fichero | Antes | Ahora |
|---|---|---|
| `Layout/LeftSidebar.tsx:356` | `cubeforge` (wordmark del sidebar) | `Cubalyze` |
| `Settings/theme-studio/ThemeStudioModal.tsx:862` | `AaBbCcDd · CubeForge` | `AaBbCcDd · Cubalyze` |
| `widgets/implementations/*/definition.ts` (11) | `author: "cubeforge"` (visible en `WidgetCard.tsx:114`) | `author: "Cubalyze"` |
| `views/Collection/collectionTransfer.ts:294` | `Not a CubeForge collection file` | `Not a Cubalyze collection file` |
| `utils/importSolves.ts:1016` | `…CubeForge CSV/JSON…` | `…Cubalyze CSV/JSON…` |

Más los dos comentarios que documentaban el sufijo de marca del título (`App.tsx:402`,
`useDocumentTitle.ts:12`), que describían exactamente lo que este PR renombra.

**El wordmark del sidebar se queda como literal, a propósito.** No se mueve a i18n porque un nombre de
marca **no se traduce**: meterlo en los ficheros de idioma permitiría que una traducción lo reescribiera.
Su grafía la vigila el test de contrato, no el sistema de traducción.

**La lista de pendientes se limpió sola.** Al renombrar, el test del artefacto falló **en las cinco
entradas a la vez** ("Estas entradas ya no existen en el bundle: bórralas de PENDING"), que es
exactamente el comportamiento para el que se diseñó: la lista no puede quedarse como peso muerto.

**Lo que NO entra en PR-2, y por qué:**

- **Discriminadores de exportación** (`exportSolves.ts` / `importSolves.ts` / `themeShare.ts`): viajan
  *dentro* de ficheros que el usuario ya tiene → PR-4, con doble lectura. Verificado en el bundle: son
  los únicos `CubeForge` visibles que quedan ahí (más los logs de consola de PR-5).
- **Comentarios, `description` de los 7 `package.json` y los 16 `CHANGELOG.md`**: cambio puramente de
  documentación y ~150 líneas repartidas en ~40 ficheros. Va en su **propio PR mecánico**, para no
  mezclar un barrido de texto con un cambio de comportamiento en el mismo diff.
- **Diagnósticos de consola** (`[CubeForge]` en `dataIntegrity.ts` y `widgets/debug.ts`): PR-5.

**Guardas nuevas en `brandSurface` (19 tests):** la regla de grafía única ahora cubre también estos
cuatro ficheros, y la **autoría de cada widget** se lee de `widgets/implementations/*/definition.ts` de
forma *data-driven* — un widget nuevo queda cubierto sin tocar el test, y rechaza tanto la marca antigua
como una variante de la nueva. Pruebas en rojo ejecutadas por separado: `author: "cubeforge"` en el
metrónomo y `cubalyze` en el sidebar hacen fallar cada guarda señalando su fichero.

**Verificación en el artefacto compilado** (no en el fuente): el bundle contiene
`` children:`Cubalyze` `` (sidebar), `` author:`Cubalyze` `` (widgets), `Not a Cubalyze collection file`,
`Cubalyze CSV/JSON`, `` appName:`Cubalyze` `` y `` `AaBbCcDd · Cubalyze` ``; el `children:`cubeforge``
minúsculo ya no existe. En el bundle solo sobreviven los `CubeForge` de PR-4 (export/import) y PR-5
(consola).

**Bug preexistente arreglado de paso (colisión de programas TypeScript)**

`pnpm -r exec tsc --noEmit` — el comando exacto del job `typecheck` del CI (§`.github/workflows/quality-gates.yml`) — **fallaba** en el escritorio:

```
../web/src/boot/appUpdate.ts(36,28): error TS2307: Cannot find module 'virtual:pwa-register'
../web/src/boot/appUpdate.ts(186,20): error TS7006: Parameter '_url' implicitly has an 'any' type.
```

**Causa raíz:** `apps/desktop/tsconfig.json` incluye `../web/src` (el escritorio reutiliza `App`), y ya
excluía `../web/src/main.tsx` por este motivo exacto. Pero `boot/appUpdate.ts` importa el mismo módulo
virtual y **no estaba excluido**. El web lo resuelve con `"types": ["vite-plugin-pwa/client"]` en
`apps/web/tsconfig.app.json`, y `vite-plugin-pwa` **no es dependencia del escritorio**: con pnpm el
paquete solo existe en `apps/web/node_modules`, así que `registerSW` quedaba como `any` y arrastraba
dos `implicit any`. No era ruido: era el CI en rojo en `main`.

**Arreglo:** añadir `../web/src/boot/appUpdate.ts` al `exclude` del escritorio, con la justificación
junto a la existente. Es correcto porque el escritorio **no tiene service worker** y el único consumidor
de `initAppUpdate` es `web/src/main.tsx`, que el escritorio ya no compila: nada del grafo del
escritorio alcanza ese fichero.

**Verificación de que NO se pierde cobertura** (mutation testing manual): se inyectó
`export const _coverageProbe: number = 'deliberate-type-error'` en `appUpdate.ts` y se comprobó que
**el typecheck de web lo caza (1 error) mientras el del escritorio pasa** — el fichero sigue vigilado,
solo cambia de proyecto dueño (el que lo usa). Sonda eliminada.

| Comprobación | Antes | Después |
|---|---|---|
| `pnpm --filter @cubeforge/desktop typecheck` | 3 errores | **0** |
| `pnpm -r exec tsc --noEmit` (comando del CI) | rojo | **0 errores** |
| `pnpm typecheck` (turbo, 33 tareas) | — | **33/33 OK** |
| `pnpm --filter @cubeforge/desktop build` | — | **OK** |

> Nota: esos comandos llevan el nombre que los paquetes tenían **entonces**. Desde §15.7 el nombre es
> `@cubalyze/*` (`pnpm --filter @cubalyze/desktop …`).

### 15.7 PR-3 ejecutado — el scope del monorepo

`@cubeforge/*` → `@cubalyze/*`. Mecánico pero **atómico**: a medias no compila.

**Alcance real: 566 ficheros · 1.123 líneas** (el plan decía 592/1.301; la diferencia son las
exclusiones congeladas, unas 180 líneas). Todo con reemplazo literal del token `@cubeforge/`, que por
construcción no puede tocar ningún nombre congelado: ninguno de ellos lleva `@` ni `/`.

**Prueba de que fue un renombrado puro y no un codemod con daño colateral:** de los 569 ficheros del
diff, **568 tienen exactamente las mismas líneas añadidas que borradas** (1+/1- por línea tocada). El
único asimétrico es `brandSurface.test.ts` (68+/10-), que edité a mano a propósito. Un solo fichero con
una línea de más habría delatado una sustitución mal hecha.

**Congelado, con motivo** (no por comodidad):

| Zona | Motivo |
|---|---|
| `packages/database/src/migrations/**` | un comentario SQL dentro de una migración **ya aplicada**, cuyo texto viaja en el bundle y cuyo id está en la tabla `_migrations` de cada dispositivo |
| `supabase/migrations/**` | migración ya aplicada en producción: artefacto histórico |
| 17 `CHANGELOG.md` · `docs/17-releases/CHANGELOG_MASTER.md` · `docs/18-archive/**` | historia: reescribirla falsificaría cuándo existió cada paquete |
| `pnpm-lock.yaml` | **regenerado** con `pnpm install`, nunca editado a mano |

**Dos correcciones a mi propio trabajo, ambas detectadas por la verificación:**

1. **`docs/17-releases/RELEASE_PROCESS.md` no es historia, es documentación viva** (afirma el estado
   actual: «hoy todos son `private: true` excepto …»). Mi exclusión por carpeta era demasiado gruesa y
   lo había congelado. Solo `CHANGELOG_MASTER.md` es historia.
2. **El codemod renombró el scope dentro de ESTA auditoría**, convirtiendo frases como
   «Alias `@cubeforge/*` → `@cubalyze/*`» en «`@cubalyze/*` → `@cubalyze/*`». Es exactamente el error
   contra el que advierte el §14: un documento que describe el **antes** no puede recibir el
   reemplazo del después. Revertido el fichero (24 líneas) y escrito a mano. Lección aplicable a la
   fase externa: el reemplazo global se aplica a lo que describe el presente, nunca a lo que
   documenta el cambio.

**El renombrado destapó un fallo en mi propia guarda de grafía (PR-2).** El test falló: la cadena
`cubalyze` está dentro de `@cubalyze/database`, así que marcaba en falso cada import del monorepo. La
regla ahora distingue **mención de marca** de **identificador técnico** (`isTechnicalIdentifier`:
`@cubalyze/x`, `cubalyze-config`, `cubalyze_db`, `cubalyze.app` no son marca; `cubalyze` suelto o
`Cub-Alyze` en prosa sí) y — esto es lo importante — **la regla tiene sus propios tests unitarios** (10
casos), no solo su aplicación. El primer intento de arreglo perdió la excepción de hostname y fue el
test unitario quien lo cazó, no el barrido.

**Verificación**

| Comprobación | Resultado |
|---|---|
| `pnpm typecheck` | **33/33** (delata cualquier import sin renombrar) |
| `pnpm lint` · `lint:lines` | 0 errores (1 warning preexistente) · 0 violaciones |
| `pnpm -r exec vitest run --passWithNoTests` (comando del CI) | **exit 0** · web **943 tests** |
| `pnpm build` | **13/13** · `verify-worker-build` OK (worker de OPFS intacto) |
| `git grep -F "@cubeforge/"` | solo lo congelado (docs de historia + 3 comentarios de migración) |
| `node_modules` | residuo hoisted `@cubeforge` **eliminado** para que el entorno no pudiera enmascarar un import sin renombrar |

Los fallos que imprime el informe de `scdb-alg-verification.test.ts` (`PASS: 130 | FAIL: 38`, etc.) son
una **auditoría de contenido** del catálogo de algoritmos, no tests rotos: el fichero pasa y el run sale
con 0. Ninguna operación de este PR puede alterar la validez de un algoritmo, y los datos no cambiaron
(todos los diffs del paquete son de una línea de import).

### 15.8 PR-2b ejecutado — documentación viva

**93 documentos `.md` + 7 `description` de `package.json`.** El invariante que hace este PR verificable es
tajante: **no toca ni una línea de código ejecutable**. Antes de commitear se comprueba (1) que solo hay
`.md` y `package.json` en el diff, (2) que en los `package.json` la única línea cambiada es
`"description"`, y (3) que todos los ficheros son simétricos (201+/201-): 1 línea fuera, 1 dentro, sin
excepciones.

**Lo que NO se renombra, y por qué**

| Clase | Ejemplo | Motivo |
|---|---|---|
| Historia | 17 `CHANGELOG.md`, `CHANGELOG_MASTER.md`, `docs/18-archive/**` | Registran cómo se llamaba el proyecto **entonces**; reescribirlos falsifican cuándo pasó cada cosa |
| Nombres técnicos (minúscula) | `cubeforge-prefs`, `cubeforge:widgets`, `sqlite:cubeforge.db`, `com.cubeforge.desktop`, `cubeforge_lib::run()`, `cubeforge/` (raíz del árbol), URLs de GitHub y dominios | Contratos con datos en los dispositivos, o territorio de la fase externa |
| **Comentarios de código** | `exportSolves.ts` escribe `app: "CubeForge"` y `importSolves.ts` lo exige (PR-4) | Un comentario que **cita un literal congelado** no se puede renombrar: pasaría a mentir sobre el código. Va con PR-5 |

Esa última fila es la razón de que el invariante sea «cero código»: cualquier reemplazo sobre ficheros de
código podía tocar los discriminadores de PR-4 o los comentarios que los describen.

**Hueco real de PR-1 encontrado aquí (arreglado):** el escritorio seguía llamándose `CubeForge`.
`productName` (lo que Windows muestra en el menú Inicio y en «Aplicaciones instaladas») y el `title` de la
ventana viven en `tauri.conf.json`, **no en el bundle web**, así que PR-1 —que cubrió el manifest de la PWA
y los dos shells HTML— no los vio. El `identifier` sigue siendo `com.cubeforge.desktop`: el directorio de
datos queda intacto.

> **Consecuencia antes del próximo `tauri build`:** el instalador NSIS deriva la carpeta y el acceso
directo del `productName`, así que la build nueva se instala como *Cubalyze* **al lado** de la vieja
> *CubeForge*. Los datos están a salvo (van por el `identifier`); la limpieza es desinstalar la entrada
> antigua una vez.

**La guarda aprendió algo que el grep no podía ver.** La primera versión recorría el disco y marcó
`pruebas/*`: dos borradores locales que `.gitignore` excluye. La lista ahora sale de **`git ls-files`**,
porque la definición de «el repositorio» es el repositorio — y un test que lee el disco se comporta
distinto en dos máquinas. Además comprueba que la lista **no esté vacía**, porque una guarda que lee 0
ficheros pasa en falso.

La regla tiene **sus propios tests unitarios** (7 casos), con la lección de §15.7 aplicada: el wordmark en
prosa es residuo, `` `cubeforge-prefs` `` no, y el punto de «…era cubeforge.» no es una extensión de
fichero (solo exime si le siguen letras, como en `cubeforge.db`). Prueba en rojo ejecutada: reintroducir
`CubeForge` en `RELEASE_PROCESS.md` hace fallar la guarda señalando el fichero.

**Verificación:** `pnpm -r exec vitest run` **exit 0** · web **951 tests** (eran 943) · `typecheck` 33/33 ·
`lint` 0 errores · `build` 13/13.

**Lo que queda del barrido de texto** (PR-5, opcional): los comentarios de código, los identificadores
como `parseCubeForgeLine` / `CubeForgeExport`, los globales `__cubeforgeLogs`, la familia tipográfica y el
título que escribe `generate-changelog.cjs`. El último y los nombres de descarga son lo único que un
usuario podría llegar a ver.

### 15.9 PR-4 ejecutado — contratos con doble lectura

**Tres contratos, no dos.** La corrección está en §14.6.4; aquí va la ejecución. La regla que se aplica en
los tres sitios es siempre la misma: **el escritor graba el tag nuevo, el lector acepta el nuevo y el
antiguo**.

| Contrato | Escrito en | Leído por | Heredado |
|---|---|---|---|
| `app` del tema | `themeShare.ts` + `ThemeShareSection.tsx` | `parseSharedTheme` | `cubeforge` |
| `format` del backup | `collectionTransfer.ts` | `isLockerFile` | `cubeforge-locker` |
| `app` / `App` del export | `exportSolves.ts` (JSON y `.xlsx`) | `importSolves.ts` | `CubeForge` |

**La política vive en un solo sitio**, `apps/web/src/lib/exportTag.ts`: un tipo `ExportTagContract`
(`current` + `legacy`) y una función `isKnownExportTag`. La regla tiene **sus propios 7 tests unitarios**,
no solo su aplicación: acepta el tag actual, acepta cada heredado, acepta varios heredados, rechaza
cualquier otra cosa, **es exacta** (una variante de caja o con espacios es otro formato, no una
coincidencia), y no lanza con valores que no son strings.

**El caso que ningún grep distingue: `cubeforge-locker` son dos constantes que comparten texto.**
`COLLECTION_STORAGE_KEY` (`collectionStore.ts:83`) es una clave de `localStorage` **congelada de por
vida**; `LOCKER_FILE_FORMAT` (`collectionTransfer.ts:40`) es un marcador **dentro** del fichero exportado
y por tanto un contrato. Clasificarlas igual sería el fallo silencioso perfecto: un rename ciego de esa
cadena no rompe un fichero, **pierde la colección entera** de quien tenga el blob antiguo.

**Prueba en rojo de la superficie completa.** Rompiendo la regla
(`return value === contract.current`) caen **8 tests** repartidos por los tres contratos y por la regla
misma. Dos de ellos son **preexistentes** —los fixtures de `puzzleType` legacy que ya usaban
`app: "CubeForge"`—, lo que confirma que la superficie de compatibilidad es exactamente la declarada y
que no hay ningún test dependiendo de ella por accidente.

#### La consecuencia estructural que hay que asumir

Con doble lectura, **las etiquetas antiguas se quedan en el bundle para siempre**:
`` {current:`Cubalyze`,legacy:[`CubeForge`]} ``. No es deuda pendiente; es la única forma de que un
fichero ya descargado siga abriéndose, porque no podemos reescribir el disco de nadie.

Por eso el test del artefacto las **reclasifica**: dejan de ser entradas `PENDING` (que caducan solas y
fuerzan su propia limpieza) y pasan a ser `FROZEN_CONTEXT` (permanentes, con su justificación escrita).
Sus dos entradas de contrato se borraron y la lista de pendientes baja a los dos nombres internos de
PR-5. A partir de ahora, un `legacy: [...]` en el bundle es la **señal de que la compatibilidad está
viva**, no un residuo.

#### Lo que se queda fuera a propósito

| Se queda en PR-5 | Por qué |
|---|---|
| Ids internos `cubeforge-json` / `cubeforge-csv` | No viajan dentro de ningún fichero: son lo que `detectFormat()` **devuelve** al inspeccionar el contenido |
| `parseCubeForgeLine`, `CubeForgeExport`, `CubeForgeAllExport` | Nombres de símbolos: invisibles fuera del editor y de DevTools |
| Nombres de descarga (`cubeforge-theme-*.json`, `cubeforge-${name}.xlsx`) | Payload libre: no se persiste ni se vuelve a leer. Renombrarlos es seguro, pero es otro cambio |

**Dos comentarios que mentían** (y que este PR arregla porque PR-2b no podía tocar código): describían el
flujo como «Import **CubeForge** JSON» cuando el label visible ya dice «Import **Cubalyze** JSON». Un
comentario que cita un literal congelado no se puede renombrar a ciegas, pero uno que describe la UI
**tiene** que seguirla.

#### Verificación de PR-4

| Comprobación | Resultado |
|---|---|
| Web | **962 tests** (eran 951); los 11 nuevos: 7 de la regla + 1 por cada contrato, y los 2 preexistentes que ahora se prueban explícitamente |
| `pnpm -r exec vitest run --passWithNoTests` (comando del CI) | **exit 0** |
| `pnpm -r exec tsc --noEmit` · `pnpm lint` | **0 errores** · 12/12 tareas (solo el warning preexistente de `ScrambleDisplay.tsx:145`) |
| `pnpm build` | 13/13 + `verify-worker-build` OK (worker dedicado y tiers de OPFS presentes) |
| Contratos | **29** almacén + **22** marca + **7** docs + **3** artefacto |
| Bundle compilado | `` legacy:[`cubeforge`] `` · `` legacy:[`cubeforge-locker`] `` · `` legacy:[`CubeForge`] `` — y ningún `app`, `format` o `App` con el valor antiguo |

#### PR-5 ejecutado — residuo interno (evidencia)

Cierra el último grupo del plan: lo que solo se ve en DevTools, en el editor o en el nombre de un
fichero descargado. Nada de esto viaja dentro de un dato persistido.

**Cambio (41 ficheros · +230/−155)**

| Bloque | Qué se renombró |
|---|---|
| A · Descargas | Los **7 nombres de fichero** que el navegador propone al guardar: `cubalyze-<sesión>.csv`, `-cstimer.csv`, `.xlsx`, `cubalyze-all-sessions.json`, `cubalyze-profile-<fecha>.json` y los dos del estudio de temas |
| B · DevTools | Globales de consola (`__cubalyzeLogs`, `__cubalyzeDebugWidgets`, `__cubalyzeLastSolve__`), el evento de ventana (`cubalyze:open-logs`, **en los 3 sitios a la vez**), el id del `<style>` inyectado, la familia tipográfica `CubalyzeCompositeDigits`, los logs `%c[Cubalyze]` y las **banderas de depuración** (`cubalyze:cfop-debug`, `cubalyze:moves-debug`, `cubalyze:debug-ui`, `cubalyze:orientation-debug`) |
| C · Código interno | Los ids que `detectFormat()` **devuelve** (`cubalyze-json`, `cubalyze-csv`), las **claves de i18n** `formatNameCubalyze{Csv,Json}` + sus 2 usos, los símbolos (`parseCubalyzeLine`, `CubalyzeSolveExport`, `CubalyzeAllSessionsExport`) y los comentarios que describían la UI |
| D · Escritorio | El crate de Cargo: `name = "cubalyze"` + `cubalyze_lib` + `authors = ["Cubalyze Team"]` + `main.rs`, con **`Cargo.lock` regenerado** por cargo (nunca a mano) |
| E · Higiene | Las **4 exenciones muertas** del test del artefacto (globales, familia tipográfica, id del `<style>` y crate) y sus **2 entradas PENDING**, que expiraron solas: la lista queda **vacía a propósito** y el mecanismo se conserva |

**Lo que NO se tocó, y por qué**

| Se queda como está | Razón |
|---|---|
| `Cargo.lock`, `gen/schemas/*` | Generados: se regeneran con cargo, no se editan. Un `sed` sobre el lock produce un árbol inconsistente con `--frozen-lockfile` |
| SQL de migraciones ya aplicadas (incluido el comentario `@cubeforge/training` y `@cubeforge/statistics`) | **Inmutables**: su id vive en la tabla `_migrations` de cada dispositivo y en el proyecto de Supabase. Un comentario no cambia la semántica, pero el valor de tocarlas es 0 y el de no tocarlas es la política que ya declara esta auditoría (§14.5.4, contexto congelado del test del artefacto) |
| `supabase/config.toml` → `project_id = "cubeforge"` | Es la identidad del stack **local** de `supabase start` (contenedores y volúmenes): renombrarlo abre un entorno local vacío. Va con el cutover de dominio. Solo se cambió el comentario de cabecera |
| `site_url` / `additional_redirect_urls` / `robots.txt` / `sitemap.xml` / `llms.txt` (URLs) | Apuntan al dominio que **todavía existe**. Dependen de la Fase 1 externa |
| Los `legacy: [...]` del bundle | No son residuo: son la compatibilidad de PR-4, viva a propósito |
| El directorio local del clon (`…/Proyectos/Personales/Cubeforge`) | No está en git. Es del usuario y no afecta a nada del repositorio |

**Pruebas en rojo (sin ellas, una guarda verde no demuestra nada)**

1. Un **typo** en la clave de i18n del mapa de formatos (`formatNameCubalyzeJsonTYPO`) ⇒ falla el test
   de claves dinámicas nombrándola, y **solo** ese test. Es el fallo que ni `tsc` ni la comparación de
   idiomas detectan: la UI mostraría la clave cruda.
2. Reintroduje `%c[CubeForge]` en `dataIntegrity.ts` **y** `window.__cubeforgeLogs` en
   `logCapture.ts`, recompilé y el test del artefacto señaló **exactamente esos dos** y ningún otro:
   prueba que las 4 exenciones borradas ya no tapan nada y que las que quedan siguen clasificando los
   nombres congelados sin falsos positivos.
3. El propio `i18n/index.test.ts` nuevo se ganó su sitio **en su primer intento**: primero acusó a
   `data.formatNameCstimer` (mi test no aplicaba el namespace) y después a `data.solvesFound` (clave
   plural de i18next: `_one`/`_other`). Las dos eran limitaciones de la regla, no claves ausentes, y
   el test las distingue a propósito en vez de aceptar cualquier prefijo.

**Verificación**

| Comprobación | Resultado |
|---|---|
| `pnpm -r exec vitest run --passWithNoTests` (comando del CI) | **exit 0** · **3 238 tests** en 15 paquetes (12 skipped) |
| `pnpm -r exec tsc --noEmit` · `pnpm lint` | **0 errores** · 12/12 tareas (solo el warning preexistente) |
| `pnpm --filter web build` | OK + `verify-worker-build` (worker dedicado y tiers de OPFS presentes) |
| Contratos | 29 almacén + 22 marca + 12 docs + **3 artefacto** |
| `cargo check --offline` (crate renombrado) | **OK** — `Compiling cubalyze v0.1.0` · `Cargo.lock` con 0 ocurrencias del nombre antiguo |
| Residuo vivo (sin historia, sin archive, sin auditoría) | **241 líneas**, todas contratos o nombres congelados: **0 pendientes** |

**Lo que sigue abierto (fuera del alcance de PR-5)**

1. **El handle `cubalyze` no está reservado.** La lista vive en `20260912000016_handle_identity.sql`,
   ya aplicada, e incluye `'cubeforge'`. La regla es no liberar nunca el viejo y añadir el nuevo
   **con una migración NUEVA** (nunca editando la aplicada). Hasta entonces cualquiera puede
   registrarse `cubalyze`.
2. **Fase 1 externa** (Supabase, Google Cloud, Vercel, GitHub, DNS + 301s): sin código, la única que
   necesita calendario. Con ella caen las URLs de `robots.txt`/`sitemap.xml`/`llms.txt`/
   `config.toml` y la plantilla de URL del changelog, sin tocar los changelogs ya generados.
