-- ═══════════════════════════════════════════════════════════════════════════
-- Hardening — quitar a los roles de API los privilegios que no son DML.
--
-- Supabase concede por defecto ALL sobre cada tabla nueva de `public` a `anon`
-- y `authenticated`. Las migraciones anteriores revocaron INSERT/UPDATE/DELETE
-- tabla a tabla, pero dejaron pasar REFERENCES, TRIGGER y TRUNCATE: revisado el
-- 2026-09-12, **las 11 tablas** (incluidas las tres del Locker recién creadas)
-- los concedían a los dos roles.
--
-- Por qué importa aunque PostgREST no emita DDL:
--   • `TRUNCATE` **no lo filtra RLS**. Nada más crear una ruta que lo alcance
--     (o reutilizar la conexión con otro cliente), cualquiera con la anon key
--     vaciaría una tabla entera sin que una sola política se evalúe.
--   • `REFERENCES`/`TRIGGER` no son explotables por sí solos, pero son
--     superficie de ataque gratuita: no hay ningún caso de uso que los pida.
--   • El principio de mínimo privilegio se audita leyendo GRANTs, y un
--     `TRUNCATE` ahí convierte cualquier revisión en una discusión.
--
-- Se corrige en dos frentes: las tablas que ya existen y el ACL por defecto,
-- de modo que una tabla futura nazca ya con el privilegio justo (SELECT) para
-- los roles de API. `service_role` (el rol de confianza del servidor) no se
-- toca: conserva acceso completo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tablas existentes ─────────────────────────────────────────────────────
-- DML incluido: las tablas ya lo tenían revocado explícitamente, así que es
-- un no-op idempotente que cubre cualquier tabla que se haya creado sin ese
-- revoke. `SELECT` NO se toca (el pull lo necesita).
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

-- ── Tablas futuras ────────────────────────────────────────────────────────
-- Aplica a los objetos que cree el rol que ejecuta las migraciones (postgres).
-- Deja el default de los roles de API en SELECT, que es exactamente lo que
-- cada migración de tabla vuelve a conceder de forma explícita.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables
  from anon, authenticated;

notify pgrst, 'reload schema';
