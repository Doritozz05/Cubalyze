-- 20260912000008_repair_method_scope
--
-- Data repair (no DDL, idempotent): `public.solves.method` held a COPY of the
-- user's global method preference, so every event persisted "CFOP" — a 2×2 or
-- a Pyraminx solve claims a method that does not exist for that event. Only the
-- events whose registry spec declares analysis methods (333, 333oh) keep a
-- method.
--
-- Why this file is safe to run at any time, in any order relative to the local
-- migration 033 (which repairs the same rows on each device):
--
--   • it converges on NULL from any starting point, so running it twice is a
--     no-op;
--   • it is data-only, so a failure cannot leave a half-applied schema;
--   • it does NOT touch updated_at (no trigger does either). Bumping the stamp
--     would make every device re-pull these rows for no reason; leaving it
--     alone keeps pull watermarks stable. Devices that already pulled the bad
--     value are fixed by their own local migration, and any device that pulls
--     later receives the corrected row.
--
-- Residue that is tolerable and self-correcting: a device still running an old
-- client that has NEVER synced can INSERT old rows carrying "CFOP" on a 2×2
-- (the `sync_apply` guard stops overwrites, not inserts). Its own local
-- migration clears them as soon as it updates, and the next push carries the
-- correction.
--
-- Rollback: none. The previous value was provably wrong and nothing can restore
-- it. Take a backup / export first if you want a copy of the data as it was.

update public.solves
   set method = null
 where method is not null
   and puzzle_type not in ('333', '333oh');
