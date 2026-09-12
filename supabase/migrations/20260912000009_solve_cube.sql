-- 20260912000009_solve_cube.sql
--
-- A solve can say WHICH cube it was done with.
--
-- The Locker holds the gear; a solve now points at one of those items, so the
-- history can answer "what did I get with this cube?" instead of only "when".
-- The label is denormalised on purpose: it is what the history, the exports and
-- the per-cube stats display, and it must survive the item being renamed or
-- deleted (a deleted cube must never rewrite solve history, which is also why
-- there is no FK here).
--
-- Data-only in the sense that no existing row changes: the columns are nullable,
-- so every solve already in the cloud simply has no cube attributed — which is
-- the truth, since the attribution did not exist when it was recorded.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS), so re-running against a database that
-- already has them is a no-op.

alter table public.solves add column if not exists cube_id text;
alter table public.solves add column if not exists cube_label text;

create index if not exists idx_solves_user_cube on public.solves (user_id, cube_id);
