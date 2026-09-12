"use client";

/**
 * cubeModelCatalog.ts — what the hardware says it is, in words a person knows.
 *
 * A GAN cube answers the `REQUEST_HARDWARE` command with an **internal** model
 * name (`GAN12uiM`, `GAN356i3`). That string is what `GanCubeAdapter.model`
 * holds and what the settings panel renders, which is why the UI currently shows
 * internals at the user.
 *
 * This table is the translation, and it is deliberately SHORT: it only contains
 * names this repository can justify (the GYRO check in
 * `@cubeforge/gan-protocol` and the family table in
 * `docs/02-architecture/Dynamic_Notation_Orientation_System.md`). A cube whose
 * name is not listed is **not an error** — it degrades to the raw name, which is
 * still better than a wrong marketing label. Adding a model is one line.
 *
 * Note what this catalog is NOT for: it cannot tell the event. A GAN 12 ui is a
 * 3×3, but the model name is not what decides which event a solve belongs to —
 * that is the bound Locker item's type.
 *
 * `gyro` here is informational ("this model has an IMU at all"). The
 * authoritative runtime answer is the `gyroSupported` flag of the HARDWARE
 * event, which is what the store consumes.
 */

export type CubeGeneration = "gen2" | "gen3" | "gen4";

export interface CubeModelInfo {
  /** Internal name the cube reports, matched case-insensitively. */
  hardwareName: string;
  /** Marketing name to show a person. */
  label: string;
  generation: CubeGeneration;
  /** Whether this model streams gyro/IMU quaternions (see the doc table). */
  gyro: boolean;
}

export const CUBE_MODEL_CATALOG: readonly CubeModelInfo[] = [
  { hardwareName: "GAN12uiM", label: "GAN 12 ui Maglev", generation: "gen4", gyro: true },
  { hardwareName: "GAN356i3", label: "GAN 356 i3", generation: "gen2", gyro: true },
  { hardwareName: "GANi39YX", label: "GAN i3", generation: "gen2", gyro: true },
];

export interface DescribedCubeModel {
  /** True when the catalog recognised the name. */
  known: boolean;
  /** Marketing label, or null when the name is not catalogued. */
  label: string | null;
  /** The raw hardware name as reported (trimmed), or null when there was none. */
  rawName: string | null;
  generation: CubeGeneration | null;
  gyro: boolean | null;
}

/**
 * Describe a hardware name, tolerating anything.
 *
 * An empty or missing name is a real state (a cube may answer the hardware
 * request with a blank field, and the adapter keeps its `"SmartCube"`
 * placeholder until it hears otherwise), so it comes back as `known: false`
 * with no name at all, and the caller supplies a translated fallback. Nothing
 * here invents a model.
 */
export function describeCubeModel(hardwareName: string | null | undefined): DescribedCubeModel {
  const raw = typeof hardwareName === "string" ? hardwareName.trim() : "";
  const rawName = raw.length > 0 ? raw : null;

  const entry = rawName
    ? CUBE_MODEL_CATALOG.find(
        (candidate) => candidate.hardwareName.toLowerCase() === rawName.toLowerCase(),
      )
    : undefined;

  if (!entry) {
    return { known: false, label: null, rawName, generation: null, gyro: null };
  }
  return {
    known: true,
    label: entry.label,
    rawName,
    generation: entry.generation,
    gyro: entry.gyro,
  };
}

/**
 * The name to prefill a new Locker item with: the marketing label when we have
 * one, otherwise the raw hardware name. `null` means the hardware gave us
 * nothing to name it with, and the caller must ask for (or translate) one.
 */
export function modelItemName(described: DescribedCubeModel): string | null {
  return described.label ?? described.rawName;
}

/** Short generation label ("Gen 4"), or null when unknown. */
export function generationLabel(generation: CubeGeneration | null): string | null {
  return generation ? `Gen ${generation.slice(3)}` : null;
}
