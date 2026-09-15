# Supabase — cuentas y sincronización

La infraestructura de nube de Cubalyze. El esquema vive en
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

### 6. Locker y fotos (Fase 6)

La migración `20260912000011_gear_sync_schema.sql` crea las tablas del Locker
(`gear_categories`, `gear_types`, `gear_items`) y la
`20260912000013_locker_photos_bucket.sql` crea el bucket **privado**
`locker-photos` con sus políticas. No hay que hacer nada a mano en el
dashboard: `supabase db push` lo deja listo.

Convención de ruta de las fotos (la primera carpeta es la partición de RLS):

```
{user_id}/{item_id}/{photo_id}/full.jpg
{user_id}/{item_id}/{photo_id}/thumb.jpg
```

Límites del bucket: 1 MB por objeto, solo `image/jpeg`, `image/png` y
`image/webp`. El bucket es privado; la Fase 8 compartirá con URLs firmadas, no
haciéndolo público.

Comprobar el estado tras un push (SQL, no el mensaje de éxito):

```bash
supabase migration list --linked
supabase db query --linked "select id, public, file_size_limit from storage.buckets"
supabase db query --linked "select policyname, cmd from pg_policies where tablename like 'gear%' or (schemaname='storage' and tablename='objects')"
```

## Desarrollo local

- `supabase start` levanta Postgres + Auth + Edge Runtime local; útil para
  los tests de integración (ver `packages/sync-engine/src/__tests__/`).
- La app sin variables de entorno funciona 100% local como antes: el botón
  de login muestra "no configurado" y no se sincroniza nada.
- Sin Docker (este entorno) no hay Postgres ni Storage locales: el SQL se
  valida contra el proyecto linkado dentro de `begin; … rollback;` con
  `supabase db query --linked`, que no persiste nada.
