/**
 * Brand tags embedded in files the user can download or share: shared themes,
 * collection backups and solve exports.
 *
 * A rename must never make a file that is already on someone's disk unreadable.
 * So every WRITER emits `current`, and every READER accepts the current tag plus
 * the tags a previous release wrote. That is why legacy tags can never be
 * deleted: we cannot reach into the user's disk and rewrite their file.
 *
 * Consequence worth knowing: the old name stays in the bundle forever, on
 * purpose. `apps/web/tests/contracts/artifactResidue.test.ts` declares it as a
 * frozen context instead of a pending residue.
 *
 * NOT for storage keys (localStorage / OPFS / IndexedDB / SQLite): those are
 * frozen for life and must never be renamed at all — see
 * docs/11-devops/Rebranding_Cubeforge_to_Cubalyze.md §14.3.
 */

export interface ExportTagContract {
  /** Written into every file this build produces. */
  current: string;
  /** Written by releases before the Cubalyze rename. Never remove one. */
  legacy: readonly string[];
}

/**
 * True when the value is the tag we write today, or one an older build wrote.
 *
 * Comparison is exact on purpose: these travel inside JSON, so there is no
 * locale, no trimming and no case folding to forgive — a variant spelling IS a
 * different file format.
 */
export function isKnownExportTag(value: unknown, contract: ExportTagContract): boolean {
  return value === contract.current || contract.legacy.includes(value as string);
}
