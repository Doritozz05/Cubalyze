-- ═══════════════════════════════════════════════════════════════════════════
-- Fase 6 — bucket privado de fotos del Locker.
--
-- Un único bucket privado `locker-photos`. Convención de ruta:
--
--     {user_id}/{item_id}/{photo_id}/full.jpg
--     {user_id}/{item_id}/{photo_id}/thumb.jpg
--
-- La primera carpeta ES la partición de RLS, así que ninguna política necesita
-- leer una tabla: todas comparan `(storage.foldername(name))[1]` con auth.uid().
-- El nombre del objeto incluye su tamaño de render (`full` / `thumb`) porque
-- son dos blobs independientes que viajan y se cachean por separado.
--
-- El bucket es PRIVADO a propósito (no `public = true`):
--   • privacidad: un bucket público sirve cualquier objeto a cualquiera con la
--     URL, sin autenticación;
--   • Fase 8: el estante público/friends se servirá con URLs firmadas de
--     corta vida generadas en el servidor, nunca haciendo el bucket público
--     (privacidad + control de egress).
--
-- Límites: 1 MB por objeto. El `full` del pipeline son ~600 KB (imageUtils:
-- 1280 px) y el `thumb` ~30 KB, así que 1 MB deja margen para una foto grande
-- sin permitir que un cliente suba un RAW. El recorte real de bytes lo hace
-- el navegador ANTES de subir; aquí solo hay una valla.
--
-- Políticas por operación (no un `for all`): la Fase 8 añadirá una política
-- SELECT para amigos sobre la proyección que decida, y con políticas
-- separadas eso es una adición, no una reescritura de la de propietario.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'locker-photos',
  'locker-photos',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Propietario: lectura / subida / sobrescritura / borrado en su carpeta ──
drop policy if exists "locker_photos_owner_select" on storage.objects;
create policy "locker_photos_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'locker-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "locker_photos_owner_insert" on storage.objects;
create policy "locker_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'locker-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "locker_photos_owner_update" on storage.objects;
create policy "locker_photos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'locker-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'locker-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "locker_photos_owner_delete" on storage.objects;
create policy "locker_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'locker-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- `anon` no recibe ninguna política: sin sesión no se lee ni se escribe nada.
-- (RLS es deny-by-default; estas políticas solo conceden a `authenticated`.)
