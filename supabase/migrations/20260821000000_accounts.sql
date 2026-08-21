-- ═══════════════════════════════════════════════════════════════════════════
-- CubeForge cloud schema — accounts + sync
-- Mirrors the local SQLite schema (packages/database/src/migrations) 1:1,
-- plus the auth.users partition column and Row Level Security.
--
-- Sync model (see docs/03-adr/ADR-019 + ADR-029):
--  • row-level LWW sync with per-table watermarks (clients pull rows newer
--    than their cursor, push via sync_apply below);
--  • deletes travel as rows in sync_tombstones;
--  • derived training aggregates (algorithm_progress / exercise_progress)
--    are NOT stored here — they are recomputed on each device from the
--    synced attempt log (deterministic replay).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profiles (one row per auth user) ─────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  handle text not null default '',
  bio text not null default '',
  avatar_kind text not null default 'identicon',
  avatar_data text,
  main_puzzle text not null default '333',
  declared_methods text not null default '[]',
  country text not null default '',
  created_at bigint not null default 0,
  updated_at bigint not null default 0
);

-- ── Solves ────────────────────────────────────────────────────────────────
create table if not exists public.solves (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  time_ms bigint not null,
  timestamp bigint not null,
  scramble text not null default '',
  penalty text not null default 'none',
  method text,
  source text not null default 'manual',
  note text,
  moves text not null default '[]',
  orientation_timeline text,
  analysis_engine_version text,
  analysis text,
  puzzle_type text not null default '333',
  is_demo integer not null default 0,
  created_at bigint not null default 0,
  updated_at bigint not null default 0
);
create index if not exists idx_solves_user_updated on public.solves (user_id, updated_at);

-- ── Sessions ──────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  puzzle_type text not null default '333',
  created_at bigint not null default 0,
  updated_at bigint not null default 0,
  is_demo integer not null default 0
);
create index if not exists idx_sessions_user_updated on public.sessions (user_id, updated_at);

-- ── Training attempts (immutable log + review grade edits) ───────────────
create table if not exists public.training_attempts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  method_id text not null,
  phase_id text,
  subset_id text,
  case_id text,
  scramble text not null default '',
  time_ms bigint not null,
  verdict text not null default 'correct',
  play_mode text not null default 'manual',
  expected_moves text,
  executed_moves text,
  tps real,
  move_count integer,
  optimal_moves integer,
  rotation_count integer,
  inspection_ms integer,
  review_grade text,
  session_id text,
  metric_kind text not null default 'execution',
  timestamp bigint not null,
  updated_at bigint not null default 0
);
create index if not exists idx_attempts_user_updated on public.training_attempts (user_id, updated_at);

-- ── Training sessions ─────────────────────────────────────────────────────
create table if not exists public.training_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  method_id text not null,
  phase_id text,
  subset_id text,
  started_at bigint not null,
  completed_at bigint,
  duration_ms bigint not null default 0,
  smart_cube_used integer not null default 0,
  status text not null default 'active',
  updated_at bigint not null default 0
);
create index if not exists idx_tsessions_user_updated on public.training_sessions (user_id, updated_at);

-- ── Training tasks (calendar) ─────────────────────────────────────────────
create table if not exists public.training_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  start_date text not null,
  repeat text not null default 'none',
  days_of_week text not null default '[]',
  color text not null default 'blue',
  created_at bigint not null default 0,
  updated_at bigint not null default 0
);
create index if not exists idx_ttasks_user_updated on public.training_tasks (user_id, updated_at);

-- ── Skill progress ────────────────────────────────────────────────────────
create table if not exists public.skill_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null,
  completed_at bigint not null default 0,
  primary key (user_id, skill_id)
);

-- ── Tombstones (deletes) ──────────────────────────────────────────────────
create table if not exists public.sync_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null,
  entity_id text not null,
  deleted_at bigint not null default 0,
  primary key (user_id, entity, entity_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security — every user only ever sees/inserts their own rows.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.solves enable row level security;
alter table public.sessions enable row level security;
alter table public.training_attempts enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_tasks enable row level security;
alter table public.skill_progress enable row level security;
alter table public.sync_tombstones enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','solves','sessions','training_attempts','training_sessions','training_tasks','skill_progress','sync_tombstones']
  loop
    execute format('drop policy if exists "owner_all_%s" on public.%I', t, t);
    execute format('create policy "owner_all_%s" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- Default profile row on signup (standard Supabase pattern).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, created_at, updated_at)
  values (new.id, extract(epoch from now()) * 1000, extract(epoch from now()) * 1000);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- sync_apply — the single write path from clients.
-- Security definer (bypasses RLS) BUT verifies user_id = auth.uid() for
-- every row; applies LWW (excluded.updated_at >= table.updated_at) so a
-- stale device can never clobber a newer row.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.sync_apply(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(payload -> 'solves') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'solves') as x(
      user_id text, id text, session_id text, time_ms bigint, timestamp bigint, scramble text,
      penalty text, method text, source text, note text, moves text, orientation_timeline text,
      analysis_engine_version text, analysis text, puzzle_type text, is_demo int, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.solves (user_id, id, session_id, time_ms, timestamp, scramble, penalty, method, source, note, moves, orientation_timeline, analysis_engine_version, analysis, puzzle_type, is_demo, created_at, updated_at)
        values (uid, rec.id, rec.session_id, rec.time_ms, rec.timestamp, rec.scramble, rec.penalty, rec.method, rec.source, rec.note, rec.moves, rec.orientation_timeline, rec.analysis_engine_version, rec.analysis, rec.puzzle_type, rec.is_demo, rec.created_at, rec.updated_at)
        on conflict (id) do update set
          session_id = excluded.session_id, time_ms = excluded.time_ms, timestamp = excluded.timestamp,
          scramble = excluded.scramble, penalty = excluded.penalty, method = excluded.method,
          source = excluded.source, note = excluded.note, moves = excluded.moves,
          orientation_timeline = excluded.orientation_timeline,
          analysis_engine_version = excluded.analysis_engine_version, analysis = excluded.analysis,
          puzzle_type = excluded.puzzle_type, updated_at = excluded.updated_at
        where excluded.updated_at >= public.solves.updated_at and public.solves.user_id = uid;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'sessions') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'sessions') as x(
      user_id text, id text, name text, puzzle_type text, created_at bigint, updated_at bigint, is_demo int
    )
    loop
      if rec.user_id = uid::text then
        insert into public.sessions (user_id, id, name, puzzle_type, created_at, updated_at, is_demo)
        values (uid, rec.id, rec.name, rec.puzzle_type, rec.created_at, rec.updated_at, rec.is_demo)
        on conflict (id) do update set
          name = excluded.name, puzzle_type = excluded.puzzle_type, updated_at = excluded.updated_at
        where excluded.updated_at >= public.sessions.updated_at and public.sessions.user_id = uid;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'profiles') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'profiles') as x(
      user_id text, display_name text, handle text, bio text, avatar_kind text, avatar_data text,
      main_puzzle text, declared_methods text, country text, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.profiles (user_id, display_name, handle, bio, avatar_kind, avatar_data, main_puzzle, declared_methods, country, created_at, updated_at)
        values (uid, rec.display_name, rec.handle, rec.bio, rec.avatar_kind, rec.avatar_data, rec.main_puzzle, rec.declared_methods, rec.country, rec.created_at, rec.updated_at)
        on conflict (user_id) do update set
          display_name = excluded.display_name, handle = excluded.handle, bio = excluded.bio,
          avatar_kind = excluded.avatar_kind, avatar_data = excluded.avatar_data,
          main_puzzle = excluded.main_puzzle, declared_methods = excluded.declared_methods,
          country = excluded.country, updated_at = excluded.updated_at
        where excluded.updated_at >= public.profiles.updated_at;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'training_attempts') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'training_attempts') as x(
      user_id text, id text, exercise_id text, method_id text, phase_id text, subset_id text, case_id text,
      scramble text, time_ms bigint, verdict text, play_mode text, expected_moves text, executed_moves text,
      tps real, move_count integer, optimal_moves integer, rotation_count integer, inspection_ms integer,
      review_grade text, session_id text, metric_kind text, timestamp bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.training_attempts (user_id, id, exercise_id, method_id, phase_id, subset_id, case_id, scramble, time_ms, verdict, play_mode, expected_moves, executed_moves, tps, move_count, optimal_moves, rotation_count, inspection_ms, review_grade, session_id, metric_kind, timestamp, updated_at)
        values (uid, rec.id, rec.exercise_id, rec.method_id, rec.phase_id, rec.subset_id, rec.case_id, rec.scramble, rec.time_ms, rec.verdict, rec.play_mode, rec.expected_moves, rec.executed_moves, rec.tps, rec.move_count, rec.optimal_moves, rec.rotation_count, rec.inspection_ms, rec.review_grade, rec.session_id, rec.metric_kind, rec.timestamp, rec.updated_at)
        on conflict (id) do update set
          review_grade = excluded.review_grade, updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_attempts.updated_at and public.training_attempts.user_id = uid;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'training_sessions') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'training_sessions') as x(
      user_id text, id text, exercise_id text, method_id text, phase_id text, subset_id text,
      started_at bigint, completed_at bigint, duration_ms bigint, smart_cube_used int, status text, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.training_sessions (user_id, id, exercise_id, method_id, phase_id, subset_id, started_at, completed_at, duration_ms, smart_cube_used, status, updated_at)
        values (uid, rec.id, rec.exercise_id, rec.method_id, rec.phase_id, rec.subset_id, rec.started_at, rec.completed_at, rec.duration_ms, rec.smart_cube_used, rec.status, rec.updated_at)
        on conflict (id) do update set
          completed_at = excluded.completed_at, duration_ms = excluded.duration_ms,
          smart_cube_used = excluded.smart_cube_used, status = excluded.status, updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_sessions.updated_at and public.training_sessions.user_id = uid;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'training_tasks') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'training_tasks') as x(
      user_id text, id text, title text, description text, start_date text, repeat text,
      days_of_week text, color text, created_at bigint, updated_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.training_tasks (user_id, id, title, description, start_date, repeat, days_of_week, color, created_at, updated_at)
        values (uid, rec.id, rec.title, rec.description, rec.start_date, rec.repeat, rec.days_of_week, rec.color, rec.created_at, rec.updated_at)
        on conflict (id) do update set
          title = excluded.title, description = excluded.description, start_date = excluded.start_date,
          repeat = excluded.repeat, days_of_week = excluded.days_of_week, color = excluded.color,
          updated_at = excluded.updated_at
        where excluded.updated_at >= public.training_tasks.updated_at and public.training_tasks.user_id = uid;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'skill_progress') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'skill_progress') as x(
      user_id text, skill_id text, completed_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.skill_progress (user_id, skill_id, completed_at)
        values (uid, rec.skill_id, rec.completed_at)
        on conflict (user_id, skill_id) do update set completed_at = excluded.completed_at
        where excluded.completed_at >= public.skill_progress.completed_at;
      end if;
    end loop;
  end if;

  if jsonb_typeof(payload -> 'tombstones') = 'array' then
    for rec in select * from jsonb_to_recordset(payload -> 'tombstones') as x(
      user_id text, entity text, entity_id text, deleted_at bigint
    )
    loop
      if rec.user_id = uid::text then
        insert into public.sync_tombstones (user_id, entity, entity_id, deleted_at)
        values (uid, rec.entity, rec.entity_id, rec.deleted_at)
        on conflict (user_id, entity, entity_id) do update set deleted_at = excluded.deleted_at
        where excluded.deleted_at >= public.sync_tombstones.deleted_at;
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.sync_apply(jsonb) from public;
grant execute on function public.sync_apply(jsonb) to authenticated;

-- ── Hardening ──────────────────────────────────────────────────────────────
-- Clients write ONLY through public.sync_apply (security definer, verifies
-- user_id = auth.uid() for every row). Direct REST writes are revoked so a
-- compromised client can never bypass the LWW / tombstone contract; SELECT
-- stays open so pull works through PostgREST. The signup trigger and the
-- RPC are security definer, so nothing else needs table grants.
revoke insert, update, delete on public.profiles, public.solves,
  public.sessions, public.training_attempts, public.training_sessions,
  public.training_tasks, public.skill_progress, public.sync_tombstones
from anon, authenticated;

-- SELECT is the ONLY table privilege the API roles get (the app reads via
-- REST pull; writes go exclusively through sync_apply). Without this grant
-- the REST API rejects every request with "permission denied for table"
-- whenever "Automatically expose new tables" is disabled in the dashboard.
grant select on public.profiles, public.solves, public.sessions,
  public.training_attempts, public.training_sessions, public.training_tasks,
  public.skill_progress, public.sync_tombstones
to anon, authenticated;

-- Make the new tables visible to the REST API immediately (relevant when
-- "Automatically expose new tables" is disabled in the dashboard).
notify pgrst, 'reload schema';
