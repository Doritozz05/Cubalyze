#!/usr/bin/env bash
#
# Run the live SQL validation suites against the LINKED Supabase project.
#
# Every suite runs inside `begin … rollback`, so nothing is ever written: the
# suites exist to exercise RLS, grants, `security definer` functions and the
# SQL formulas against the real Postgres, which neither SQLite nor a mocked
# API can do. See ./README.md.
#
# Usage:
#   supabase/validation/run.sh                          # every suite
#   supabase/validation/run.sh validation/f8-social.sql # one suite
#   supabase/validation/run.sh --deployed               # no migration prefix:
#                                                       # tests what is LIVE
#
# NOTE on paths: `supabase db query -f` resolves its argument against the
# PROJECT ROOT (the directory that contains `supabase/`), not the shell's cwd —
# verified: from `supabase/`, `-f .probe.sql` reads `<root>/.probe.sql`. The
# script therefore works from the root and names the suite paths the way the
# README documents them (relative to `supabase/`).
#
set -euo pipefail

cd "$(dirname "$0")/../.."   # repo root — the CLI's own reference point

# Migrations the suites depend on, in application order. The Fase 6 hardening
# (15) is included on purpose: the suites must prove they compose with what is
# already deployed, not just with the newest files.
MIGRATIONS=(
  supabase/migrations/20260912000015_sync_apply_hardening.sql
  supabase/migrations/20260912000016_handle_identity.sql
  supabase/migrations/20260912000017_friends_schema.sql
  supabase/migrations/20260912000018_friends_rpc.sql
  supabase/migrations/20260912000019_friend_rate_bump.sql
)

# `--deployed` drops the migration prefix so the suites run against whatever
# the linked project actually has. That is the difference between "the files are
# correct" and "production is correct": the first mode proves a change is safe
# to apply, the second proves it IS applied and matches.
DEPLOYED_ONLY=0
if [ "${1:-}" = "--deployed" ]; then
  DEPLOYED_ONLY=1
  shift
fi
if [ "$DEPLOYED_ONLY" = "1" ]; then
  MIGRATIONS=()
fi

if [ "$#" -gt 0 ]; then
  SUITES=("$@")
else
  SUITES=(
    validation/f8-identity.sql
    validation/f8-social.sql
    validation/f8-projections.sql
    validation/f8-photos.sql
  )
fi

tmp=".validation-run.sql"        # root, so `-f .validation-run.sql` finds it
cleanup() { rm -f "$tmp"; }
trap cleanup EXIT

failed=0
for suite in "${SUITES[@]}"; do
  # Accept both `validation/x.sql` and `supabase/validation/x.sql`.
  path="supabase/${suite#supabase/}"
  if [ ! -f "$path" ]; then
    echo "✖ $suite: no existe"
    failed=1
    continue
  fi
  if [ "$DEPLOYED_ONLY" = "1" ]; then echo "── $suite (esquema desplegado)"; else echo "── $suite"; fi
  {
    echo "begin;"
    # `cat` with an empty array would read stdin and hang the script.
    if [ "${#MIGRATIONS[@]}" -gt 0 ]; then cat "${MIGRATIONS[@]}"; fi
    cat "$path"
    echo "rollback;"
  } > "$tmp"

  if supabase db query --linked -f "$tmp"; then
    echo "   ✔ sin cambios aplicados (la transacción se deshizo)"
  else
    echo "   ✖ FALLÓ"
    failed=1
  fi
done

exit "$failed"
