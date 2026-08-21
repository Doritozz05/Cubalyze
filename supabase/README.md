# Supabase — cuentas y sincronización

La infraestructura de nube de CubeForge. El esquema vive en
`supabase/migrations/`; la única función serverless es `delete-account`.

## Puesta en marcha (una vez por proyecto)

### 1. Crear el proyecto

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan free sobra).
2. Cli local: `supabase login` → `supabase link --project-ref <ref>`.
3. Sube el esquema: `supabase db push`. (También puedes pegar el contenido de
   `supabase/migrations/20260821000000_accounts.sql` en el SQL Editor del
   dashboard.)

### 2. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → crea un proyecto
   (o usa uno existente) → **APIs & Services → OAuth consent screen**.
2. **Credentials → Create credentials → OAuth client ID** → tipo **Web
   application**.
   - Authorized redirect URI:
     `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Copia el **Client ID** y el **Client secret** en Supabase dashboard →
   **Authentication → Providers → Google** (activa el provider).

### 3. Redirect URLs de la app

Supabase dashboard → **Authentication → URL Configuration** →
**Redirect URLs**:

- `http://localhost:5173/auth` (dev)
- `https://<tu-dominio>/auth` (producción / Vercel)

### 4. Variables de entorno (web)

Crea `apps/web/.env` (no está versionado — lo ignora git) con:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

La anon key es pública por diseño y sale de Project Settings → API.
En Vercel, añade las mismas dos variables al proyecto (Settings →
Environment Variables, en los tres entornos) y redespliega.

### 5. Edge Function `delete-account`

`supabase functions deploy delete-account` (solo necesario para el botón
"Eliminar cuenta"; sin ella, el login/sync funciona igual).

## Desarrollo local

- `supabase start` levanta Postgres + Auth + Edge Runtime local; útil para
  los tests de integración (ver `packages/sync-engine/src/__tests__/`).
- La app sin variables de entorno funciona 100% local como antes: el botón
  de login muestra "no configurado" y no se sincroniza nada.
