# Deploy y Hosting

## Vercel (`vercel.json`)

El deploy de la PWA es **solo web**: `buildCommand` = `turbo run build --filter=web`,
`outputDirectory` = `apps/web/dist`. El backend (Supabase, ADR-023) no está
desplegado — ver [Desktop_App.md §5](../02-architecture/Desktop_App.md).

### Rewrites (SPA)

```
source: /((?!api/|.*\..*).*)  →  /index.html
```

Cualquier ruta que no empiece por `api/` ni tenga extensión va a `index.html`
(router SPA). El prefijo `api/` queda **reservado** para un futuro backend.

### Cabeceras globales — por qué son obligatorias

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
Content-Security-Policy: <estricta>
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), geolocation=(), payment=(), usb=()
```

- **COOP/COEP** habilitan la **cross-origin isolation** que OPFS exige para la
  SQLite persistente (sin ellas, `SharedArrayBuffer` no está disponible y la BD
  cae a memoria → pérdida de datos al recargar). En producción se usa
  `credentialless` para no bloquear recursos cross-origin sin cabeceras CORP
  (el dev de Vite usa el mismo valor; el `preview` usa `require-corp`, más
  estricto, porque todo es same-origin).
- **CSP estricta**: `script-src 'self' 'wasm-unsafe-eval'` (sin `unsafe-inline`),
  `worker-src 'self' blob:` (el worker de sqlite-wasm se carga de un blob),
  `connect-src 'self' https: wss:`. Esta es la razón de `injectRegister: 'script'`
  en vite-plugin-pwa (SW registrado desde un archivo externo, no inline).
- **Permissions-Policy** bloquea cámara/geolocalización/pago/USB — coherente
  con el modelo local-first y la política de privacidad.

> Nota: la app desktop Tauri tiene su **propia CSP** en `tauri.conf.json`,
> equivalente pero con `connect-src ipc: http://ipc.localhost` para el IPC.

## Build PWA (`apps/web/vite.config.ts`)

- `vite-plugin-pwa`, `registerType: 'prompt'` — un nuevo deploy se descarga en
  segundo plano pero **nunca recarga la app sin permiso** (el flujo anterior
  `autoUpdate` reiniciaba la página al activarse el worker, incluso a mitad de
  un solve). `main.tsx` muestra un toast "Actualización disponible" con botón
  *Recargar* y comprueba actualizaciones cada hora; el recargado solo ocurre
  cuando el usuario lo pulsa.
- Navegación **NetworkFirst** (timeout 4s): al abrir la app con conexión se
  sirve siempre el `index.html` más reciente del deploy (sin pasar por el
  precache viejo); sin wifi se sirve la última página cacheada.
- Manifest: CubeForge, `display: standalone`, theme/background `#0f172a`,
  iconos 192/512.
- Workbox: `maximumFileSizeToCacheInBytes: 4 MB` (el worker de sqlite-wasm o
  chunks grandes no se cachean si superan el límite).
- `--mode analyze` → treemap en `dist/report.html` para auditar el bundle.

## Entornos

| Entorno | Quién lo crea | Estado |
|---|---|---|
| Preview por PR | integración nativa Vercel↔GitHub | ✅ automático |
| Producción | merge a `main` | ✅ automático |
| Supabase (migraciones) | pipeline de GitHub Actions (`supabase db push`) | 🔴 pendiente (ADR-023) |

## Cheat-sheet de builds

```bash
pnpm build                    # turbo: todos los paquetes + apps
pnpm --filter web build       # solo la web
pnpm --filter web analyze     # web + treemap del bundle (dist/report.html)
pnpm --filter @cubeforge/desktop tauri:build   # instalador de escritorio
```
