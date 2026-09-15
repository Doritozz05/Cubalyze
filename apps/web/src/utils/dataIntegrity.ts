"use client";

/**
 * Data-integrity console helpers.
 *
 * Exposed on `window` so the user (or a sibling with the same build) can
 * inspect exactly what is in the DB after a migration / import / restore,
 * and clean up exact duplicates without touching any other rows.
 *
 *   window.auditSolves()        → read-only report (always safe).
 *   window.dedupeSolves()       → dry-run: prints what WOULD be removed.
 *   window.dedupeSolves(true)   → actually deletes exact duplicates.
 *
 * `auditSolves` is read-only and safe to run anywhere. `dedupeSolves` only
 * removes rows that are exact duplicates of another solve (same time,
 * timestamp, scramble, penalty, puzzle type, source and demo flag), keeping
 * the earliest-inserted copy — so it can never delete a unique solve.
 */

type Executor = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>;

/**
 * Two solves are "the same solve" when these fields all match. `timestamp`
 * is epoch-ms, `time_ms` is the solve duration and `scramble` is a random
 * 20+ move string, so a collision on all of these is effectively always a
 * real duplicate — never two independent solves.
 */
const DUPLICATE_KEY =
  "time_ms, timestamp, scramble, penalty, puzzle_type, source, is_demo";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function auditSolves(executor: Executor, storageType: () => string): Promise<void> {
  const [totalRows] = await executor("SELECT COUNT(*) AS c FROM solves");
  const [demoRows] = await executor("SELECT COUNT(*) AS c FROM solves WHERE is_demo = 1");
  const sessions = await executor(
    `SELECT s.id, s.name, s.is_demo,
            COUNT(v.id) AS solves
     FROM sessions s
     LEFT JOIN solves v ON v.session_id = s.id
     GROUP BY s.id
     ORDER BY s.created_at ASC`,
  );
  const [dupRows] = await executor(
    `SELECT COUNT(*) AS groups,
            SUM(cnt - 1) AS extra
     FROM (
       SELECT COUNT(*) AS cnt
       FROM solves
       GROUP BY ${DUPLICATE_KEY}
       HAVING COUNT(*) > 1
     )`,
  );
  const duplicates = await executor(
    `SELECT ${DUPLICATE_KEY}, COUNT(*) AS cnt,
            GROUP_CONCAT(session_id) AS session_ids,
            MIN(rowid) AS kept_rowid
     FROM solves
     GROUP BY ${DUPLICATE_KEY}
     HAVING COUNT(*) > 1
     ORDER BY cnt DESC
     LIMIT 50`,
  );

  console.groupCollapsed(
    "%c[Cubalyze] Diagnóstico de datos (auditSolves)",
    "color:#38bdf8;font-weight:bold",
  );
  console.log("URL:", window.location.href);
  console.log("Origen (OPFS es por-origen):", window.location.origin);
  console.log("Backend de almacenamiento:", storageType());
  console.log("Solves totales:", num(totalRows?.c));
  console.log("  · no-demo (visibles en la app):", num(totalRows?.c) - num(demoRows?.c));
  console.log("  · demo (ocultos, is_demo=1):", num(demoRows?.c));
  console.log("Sesiones:");
  console.table(
    sessions.map((s) => ({
      name: s.name,
      demo: num(s.is_demo) === 1 ? "sí" : "no",
      solves: num(s.solves),
      id: s.id,
    })),
  );
  console.log(
    "Grupos de duplicados (exactos, cruzando sesiones):",
    num(dupRows?.groups),
    "→ filas sobrantes:",
    num(dupRows?.extra),
  );
  if (duplicates.length > 0) {
    console.log("Muestra de grupos duplicados (hasta 50):");
    console.table(duplicates);
  }

  console.log(
    "%cSiguiente paso: window.dedupeSolves() (simulación) · window.dedupeSolves(true) (borrar duplicados exactos).",
    "color:#facc15",
  );
  console.groupEnd();
}

async function dedupeSolves(executor: Executor, confirm: boolean): Promise<void> {
  const [dupRows] = await executor(
    `SELECT COUNT(*) AS groups,
            SUM(cnt - 1) AS extra
     FROM (
       SELECT COUNT(*) AS cnt
       FROM solves
       GROUP BY ${DUPLICATE_KEY}
       HAVING COUNT(*) > 1
     )`,
  );
  const groups = num(dupRows?.groups);
  const extra = num(dupRows?.extra);

  if (groups === 0) {
    console.log("%c[Cubalyze] Sin duplicados exactos. No hay nada que limpiar.", "color:#4ade80");
    return;
  }

  if (!confirm) {
    console.groupCollapsed(
      "%c[Cubalyze] Simulación de dedupeSolves (no se borró nada)",
      "color:#facc15;font-weight:bold",
    );
    console.log(`Se eliminarían ${extra} filas de ${groups} grupos duplicados (se conserva la copia más antigua).`);
    console.log("Para ejecutar de verdad: window.dedupeSolves(true).");
    console.groupEnd();
    return;
  }

  await executor(
    `DELETE FROM solves
     WHERE rowid NOT IN (
       SELECT MIN(rowid)
       FROM solves
       GROUP BY ${DUPLICATE_KEY}
     )`,
  );

  console.log(
    `%c[Cubalyze] Deduplicación completada: ${extra} fila(s) duplicada(s) eliminada(s) de ${groups} grupo(s).`,
    "color:#4ade80;font-weight:bold",
  );
}

/**
 * Attach the helpers. Called once during app init with the raw DB executor
 * so the audit can see EVERY row (including demo/hidden ones) — the
 * repositories' `findAll` filters those out on purpose.
 */
export function attachDataIntegrityHelpers(
  executor: Executor,
  storageType: () => string,
): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;
  w.auditSolves = () => {
    void auditSolves(executor, storageType);
  };
  w.dedupeSolves = (confirm?: unknown) => {
    void dedupeSolves(executor, confirm === true);
  };
}
