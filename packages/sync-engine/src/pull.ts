/**
 * Pull — download everything the cloud has that is newer than the pull
 * watermark, applying rows locally with LWW (the newer updated_at wins;
 * when local is newer the row is left alone and the next push carries it up).
 *
 * Tombstones are applied first so rows deleted on another device disappear
 * here too. After a pull the engine rebuilds the derived aggregates from the
 * (now complete) attempt log — see rebuild.ts.
 */

import {
  cloudRowToAttempt,
  cloudRowToGearCategory,
  cloudRowToGearItem,
  cloudRowToGearType,
  cloudRowToProfile,
  cloudRowToSession,
  cloudRowToSolve,
  cloudRowToTask,
  cloudRowToTrainingSession,
  type CloudRow,
} from "./mappers";
import {
  applyRemoteTombstones,
  isCloudTombstone,
} from "./tombstones";
import type { SyncContext, SyncTotals } from "./types";
import { getWatermark, pullWatermarkKey, setWatermark } from "./watermarks";
import type { Profile } from "@cubeforge/models";

/**
 * True only when the profile carries real user content, as opposed to the
 * installation default every device writes on first launch.
 *
 * It exists because LWW cannot tell "edited" from "never touched": both are a
 * row with an `updated_at`. The handle is the only field the SERVER arbitrates
 * (`profiles_protect_handle`), so every other field needs this distinction —
 * otherwise a default row with a fresh `Date.now()` beats an account whose
 * profile was edited weeks ago, in both directions (pull: the cloud profile
 * never lands; push: the default row overwrites it).
 *
 * `mainPuzzle` is deliberately NOT content: it defaults to `333` on every
 * device, so counting it would make every default row look edited.
 */
export function profileHasContent(profile: Profile): boolean {
  return Boolean(
    (profile.displayName ?? "").trim() ||
      (profile.handle ?? "").trim() ||
      (profile.bio ?? "").trim() ||
      (profile.country ?? "").trim() ||
      (profile.avatarKind === "photo" && profile.avatarData) ||
      (profile.declaredMethods?.length ?? 0) > 0,
  );
}

interface TableDef {
  watermarkColumn: string;
}

/** Watermark column per table (the LWW field the pull cursor uses). */
const TABLE_DEFS: Record<string, TableDef> = {
  // Order matters: SQLite enforces FKs (PRAGMA foreign_keys ON), and
  // solves.session_id references sessions(id) — so sessions MUST be inserted
  // before the solves pointing at them. Pulling solves first made every
  // first-login pull fail with SQLITE_CONSTRAINT_FOREIGNKEY and blocked sync
  // forever (the pull re-failed on the same rows each cycle).
  sessions: { watermarkColumn: "updated_at" },
  solves: { watermarkColumn: "updated_at" },
  profiles: { watermarkColumn: "updated_at" },
  training_sessions: { watermarkColumn: "updated_at" },
  training_attempts: { watermarkColumn: "updated_at" },
  training_tasks: { watermarkColumn: "updated_at" },
  skill_progress: { watermarkColumn: "completed_at" },
  // Fase 6 — the Locker. The relative order of these three is load-bearing:
  // SQLite enforces the local FKs, so a type must land after its category and
  // an item after its category (and after its type, when it has one).
  gear_categories: { watermarkColumn: "updated_at" },
  gear_types: { watermarkColumn: "updated_at" },
  gear_items: { watermarkColumn: "updated_at" },
};

export async function pullChanges(
  ctx: SyncContext,
  uid: string,
): Promise<SyncTotals> {
  const totals: SyncTotals = {
    pushed: {},
    pulled: {},
    pushedTombstones: 0,
    appliedTombstones: 0,
    rebuilt: false,
  };

  // ── Tombstones first (deletes before rows) ─────────────────────────
  // M4: tombstones have their own pull watermark (like every table), so a
  // device only downloads the deletes it has not seen yet — without it, every
  // pull re-fetched the user's ENTIRE tombstone history forever (network +
  // apply cost growing without bound).
  const tombWm = await getWatermark(
    ctx.meta,
    pullWatermarkKey("sync_tombstones", uid),
  );
  const tombResult = await ctx.supabase
    .from("sync_tombstones")
    .select("*")
    .eq("user_id", uid)
    .gt("deleted_at", tombWm)
    .order("deleted_at", { ascending: true });
  if (tombResult.error) throw tombResult.error;
  const tombstones = (tombResult.data ?? []).filter(isCloudTombstone);
  if (tombstones.length > 0) {
    totals.appliedTombstones = await applyRemoteTombstones(ctx, tombstones);
    const maxT = tombstones.reduce(
      (max, t) => Math.max(max, Number(t.deleted_at) || 0),
      tombWm,
    );
    await setWatermark(
      ctx.meta,
      pullWatermarkKey("sync_tombstones", uid),
      maxT,
    );
  }

  // ── Tables ─────────────────────────────────────────────────────────
  for (const [table, def] of Object.entries(TABLE_DEFS)) {
    const wm = await getWatermark(ctx.meta, pullWatermarkKey(table, uid));
    const query = ctx.supabase.from(table).select("*").eq("user_id", uid);
    // Sessions converge by full-table LWW pull (E13): the table holds dozens
    // of rows, and a watermark cursor permanently misses rows created offline
    // with an older updated_at that reach the cloud after the cursor already
    // advanced past them (a second device's seeded session duplicating one
    // side forever). The per-row LWW apply below keeps the full pull
    // idempotent, and deletes still travel through the tombstone channel.
    const result =
      table === "sessions"
        ? await query.order(def.watermarkColumn, { ascending: true })
        : await query
            .gt(def.watermarkColumn, wm)
            .order(def.watermarkColumn, { ascending: true });
    if (result.error) throw result.error;
    const rows = result.data as CloudRow[] | null;
    if (!rows || rows.length === 0) continue;

    await applyRows(ctx, table, rows);

    const maxWm = rows.reduce(
      (max, r) => Math.max(max, Number(r[def.watermarkColumn]) || 0),
      wm,
    );
    await setWatermark(ctx.meta, pullWatermarkKey(table, uid), maxWm);
    totals.pulled[table as keyof typeof totals.pulled] = rows.length;
  }

  return totals;
}

/** Apply one table's pulled rows locally with per-row LWW. */
async function applyRows(
  ctx: SyncContext,
  table: string,
  rows: CloudRow[],
): Promise<void> {
  switch (table) {
    case "solves": {
      let toInsert: ReturnType<typeof cloudRowToSolve>[] = [];
      const toUpdate: ReturnType<typeof cloudRowToSolve>[] = [];
      const existing = await ctx.solves.findUpdatedAts(
        rows.map((r) => String(r.id)),
      );
      for (const row of rows) {
        const solve = cloudRowToSolve(row);
        const localUpdated = existing.get(solve.id) ?? 0;
        if (localUpdated === 0) toInsert.push(solve);
        else if (localUpdated < (solve.updatedAt ?? 0)) toUpdate.push(solve);
      }
      if (toInsert.length > 0) {
        // Drop orphaned solves: the cloud has NO solves.session_id FK, so a
        // solve can legitimately reference a session that was deleted
        // cloud-side. Locally the FK is enforced, and one bad row would
        // fail the whole insertMany and block sync forever. Sessions are
        // pulled first (TABLE_DEFS order), so a solve only ends up here when
        // its session genuinely no longer exists anywhere — skip it. The
        // watermark still advances past it (computed over all rows), so it
        // never re-pulls.
        const sessionIds = [
          ...new Set(toInsert.map((s) => s.sessionId)),
        ];
        const existingSessions = await ctx.sessions.findExistingIds(sessionIds);
        const before = toInsert.length;
        toInsert = toInsert.filter((s) => existingSessions.has(s.sessionId));
        if (toInsert.length < before) {
          console.warn(
            `[sync-engine] pull: skipped ${before - toInsert.length} orphaned solve(s) whose session no longer exists`,
          );
        }
      }
      if (toInsert.length > 0) await ctx.solves.insertMany(toInsert);
      for (const solve of toUpdate) await ctx.solves.update(solve);
      break;
    }
    case "sessions": {
      const toInsert: ReturnType<typeof cloudRowToSession>[] = [];
      const toUpdate: ReturnType<typeof cloudRowToSession>[] = [];
      const existing = await ctx.sessions.findUpdatedAts(
        rows.map((r) => String(r.id)),
      );
      for (const row of rows) {
        const session = cloudRowToSession(row);
        const localUpdated = existing.get(session.id) ?? 0;
        if (localUpdated === 0) toInsert.push(session);
        else if (localUpdated < (session.updatedAt ?? 0)) toUpdate.push(session);
      }
      for (const session of toInsert) await ctx.sessions.insert(session);
      for (const session of toUpdate) await ctx.sessions.update(session);
      break;
    }
    case "profiles": {
      for (const row of rows) {
        const profile = cloudRowToProfile(row);
        // M11 — the cloud profile carries the CubeMark seed (the original
        // anonymous id of the first edited device). Reapply it to THIS
        // device's app_meta so every device linked to the account renders
        // the same identicon, not its own anonymous seed.
        const seed =
          row.identicon_seed == null ? undefined : String(row.identicon_seed);
        if (seed) await ctx.meta.setIdenticonSeed(seed);
        const local = await ctx.profiles.findById(profile.userId);
        if (!local) {
          await ctx.profiles.upsert(profile);
          break;
        }
        if ((local.updatedAt ?? 0) < (profile.updatedAt ?? 0)) {
          await ctx.profiles.upsert(profile);
          break;
        }
        // El contenido gana al vacío, sin mirar los sellos.
        //
        // LWW compara SELLOS, y un sello no distingue una EDICIÓN de un
        // VALOR POR DEFECTO: el primer arranque de cualquier dispositivo
        // escribe una fila de perfil por defecto con `updated_at =
        // Date.now()`, así que un dispositivo que se vincula más tarde tiene
        // una fila MÁS NUEVA que una cuenta cuyo perfil se editó hace
        // semanas. Aplicando el LWW al pie de la letra, ese dispositivo se
        // queda con el perfil vacío para siempre (su fila gana, así que la
        // del servidor no llega a aterrizar) y —antes de la guarda del push—
        // además borraba el perfil de la cuenta. El vacío no lleva intención
        // del usuario; el contenido sí.
        if (!profileHasContent(local) && profileHasContent(profile)) {
          await ctx.profiles.upsert(profile);
          break;
        }
        // F8.0 — el handle NO se rige por LWW: lo decide el servidor.
        //
        // Un segundo dispositivo no llega con el handle de la cuenta: llega
        // con un perfil local por defecto sellado con su propio `Date.now()`,
        // que suele ser más nuevo que el sello de la reclamación del primero.
        // Con LWW estricto esa fila nunca se aplica, así que la UI mostraría
        // "sin handle" para una cuenta que sí lo tiene — y no se arreglaría
        // sola: los sellos ya han convergido y el cursor no vuelve a mirarla.
        //
        // Que el servidor mande aquí no es una excepción al LWW, es su misma
        // regla aplicada a la única columna que el servidor SÍ arbitra: el
        // trigger `profiles_protect_handle` decide titularidad y unicidad, y
        // un handle local sin reclamar no es una edición, es una petición.
        //
        // Se adopta SOLO el handle: los demás campos y el sello local se
        // conservan, así que no se pisa ninguna edición pendiente (display
        // name, bio, país) ni se reabre el ciclo de sync.
        if (profile.handle !== "" && local.handle !== profile.handle) {
          await ctx.profiles.upsert({ ...local, handle: profile.handle });
        }
      }
      break;
    }
    case "training_attempts": {
      // Local FK guard: training_attempts.case_id references algorithm_cases(id),
      // but the catalog is bundled per app version — a pull can receive an
      // attempt for a case this device doesn't know (or hasn't seeded yet).
      // Unlink those attempts (keep the data, drop the case) instead of
      // failing the whole pull on one unknown case.
      const caseIds = [
        ...new Set(
          rows
            .map((r) => cloudRowToAttempt(r).caseId)
            .filter((id): id is string => id != null),
        ),
      ];
      const existingCases =
        caseIds.length > 0
          ? await ctx.training.findExistingCaseIds(caseIds)
          : new Set<string>();
      let unlinked = 0;
      for (const row of rows) {
        const attempt = cloudRowToAttempt(row);
        const local = await ctx.training.findAttemptById(attempt.id);
        if (!local) {
          if (attempt.caseId != null && !existingCases.has(attempt.caseId)) {
            unlinked += 1;
            await ctx.training.insertAttemptWithId({
              ...attempt,
              caseId: undefined,
            });
          } else {
            await ctx.training.insertAttemptWithId(attempt);
          }
        } else if ((local.updatedAt ?? 0) < (attempt.updatedAt ?? 0)) {
          await ctx.training.updateAttemptFromCloud(
            attempt.id,
            attempt.reviewGrade ?? null,
            attempt.updatedAt ?? 0,
          );
        }
      }
      if (unlinked > 0) {
        console.warn(
          `[sync-engine] pull: unlinked ${unlinked} training attempt(s) referencing cases unknown to this device`,
        );
      }
      break;
    }
    case "training_sessions": {
      for (const row of rows) {
        const record = cloudRowToTrainingSession(row);
        const local = await ctx.training.findTrainingSessionById(record.id);
        if (!local) {
          await ctx.training.upsertTrainingSession(record);
        } else if ((local.updatedAt ?? 0) < (record.updatedAt ?? 0)) {
          await ctx.training.upsertTrainingSession(record);
        }
      }
      break;
    }
    case "training_tasks": {
      for (const row of rows) {
        const task = cloudRowToTask(row);
        const local = await ctx.calendar.findById(task.id);
        if (!local || (local.updatedAt ?? 0) < (task.updatedAt ?? 0)) {
          await ctx.calendar.upsert(task);
        }
      }
      break;
    }
    case "skill_progress": {
      for (const row of rows) {
        await ctx.skills.setCompletedAt(
          String(row.skill_id),
          Number(row.completed_at) || 0,
        );
      }
      break;
    }
    case "gear_categories": {
      const existing = await ctx.gear.findUpdatedAts(
        "gear_categories",
        rows.map((r) => String(r.id)),
      );
      for (const row of rows) {
        const category = cloudRowToGearCategory(row);
        const localUpdated = existing.get(category.id) ?? 0;
        if (localUpdated === 0 || localUpdated < (category.updatedAt ?? 0)) {
          await ctx.gear.upsertCategory(category);
        }
      }
      break;
    }
    case "gear_types": {
      const parsed = rows.map((r) => cloudRowToGearType(r));
      // Local FK guard, same contract as orphaned solves: the category is
      // pulled first, so a type whose category is missing either refers to a
      // category that never reached this device or was deleted there. Skip it
      // (and warn) instead of failing the whole batch on one row.
      const categoryIds = [...new Set(parsed.map((t) => t.categoryId).filter(Boolean))];
      const existingCategories =
        categoryIds.length > 0
          ? await ctx.gear.findExistingCategoryIds(categoryIds)
          : new Set<string>();
      const existing = await ctx.gear.findUpdatedAts(
        "gear_types",
        parsed.map((t) => t.id),
      );
      let orphaned = 0;
      for (const type of parsed) {
        if (!existingCategories.has(type.categoryId)) {
          orphaned += 1;
          continue;
        }
        const localUpdated = existing.get(type.id) ?? 0;
        if (localUpdated === 0 || localUpdated < (type.updatedAt ?? 0)) {
          await ctx.gear.upsertType(type);
        }
      }
      if (orphaned > 0) {
        console.warn(
          `[sync-engine] pull: skipped ${orphaned} gear type(s) whose category does not exist`,
        );
      }
      break;
    }
    case "gear_items": {
      const parsed = rows.map((r) => cloudRowToGearItem(r));
      const categoryIds = [...new Set(parsed.map((i) => i.categoryId).filter(Boolean))];
      const typeIds = [
        ...new Set(parsed.map((i) => i.typeId).filter((id): id is string => id != null)),
      ];
      const [existingCategories, existingTypes, existing] = await Promise.all([
        categoryIds.length > 0
          ? ctx.gear.findExistingCategoryIds(categoryIds)
          : Promise.resolve(new Set<string>()),
        typeIds.length > 0
          ? ctx.gear.findExistingTypeIds(typeIds)
          : Promise.resolve(new Set<string>()),
        ctx.gear.findUpdatedAts("gear_items", parsed.map((i) => i.id)),
      ]);
      let orphaned = 0;
      let rehomed = 0;
      for (const item of parsed) {
        if (!existingCategories.has(item.categoryId)) {
          orphaned += 1;
          continue;
        }
        // An item whose TYPE is unknown keeps its data and is re-homed in the
        // category (type_id = NULL) rather than dropped — the type catalog is
        // not a required fact for an item to be useful.
        let next = item;
        if (item.typeId != null && !existingTypes.has(item.typeId)) {
          next = { ...item, typeId: null };
          rehomed += 1;
        }
        const localUpdated = existing.get(item.id) ?? 0;
        if (localUpdated === 0 || localUpdated < (next.updatedAt ?? 0)) {
          await ctx.gear.upsertItem(next);
        }
      }
      if (orphaned > 0 || rehomed > 0) {
        console.warn(
          `[sync-engine] pull: ${orphaned} gear item(s) skipped (missing category), ${rehomed} re-homed (missing type)`,
        );
      }
      break;
    }
    default:
      break;
  }
}
