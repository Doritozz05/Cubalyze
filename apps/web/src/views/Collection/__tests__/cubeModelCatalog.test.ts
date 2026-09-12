/**
 * The model catalog: internal hardware names in words a person recognises.
 *
 * The interesting cases are the ones that must NOT produce a label — an
 * uncatalogued model and an empty name both have to pass through untouched, or
 * the Locker ends up naming a cube after a guess.
 */
import { describe, expect, it } from "vitest";
import {
  CUBE_MODEL_CATALOG,
  describeCubeModel,
  generationLabel,
  modelItemName,
} from "../cubeModelCatalog";

describe("describeCubeModel", () => {
  it("translates a catalogued hardware name", () => {
    const described = describeCubeModel("GAN12uiM");
    expect(described).toEqual({
      known: true,
      label: "GAN 12 ui Maglev",
      rawName: "GAN12uiM",
      generation: "gen4",
      gyro: true,
    });
  });

  it("matches the hardware name case-insensitively", () => {
    expect(describeCubeModel("gan356i3").label).toBe("GAN 356 i3");
    expect(describeCubeModel("Gan356I3").label).toBe("GAN 356 i3");
  });

  it("trims the raw name before matching", () => {
    const described = describeCubeModel("  GAN356i3  ");
    expect(described.known).toBe(true);
    expect(described.rawName).toBe("GAN356i3");
  });

  it("passes an uncatalogued model through without inventing a label", () => {
    const described = describeCubeModel("GAN14uiFP");
    expect(described.known).toBe(false);
    expect(described.label).toBeNull();
    expect(described.rawName).toBe("GAN14uiFP");
    expect(described.generation).toBeNull();
    expect(described.gyro).toBeNull();
  });

  it("treats a missing or blank name as no name at all", () => {
    for (const value of [null, undefined, "", "   "]) {
      const described = describeCubeModel(value);
      expect(described.known).toBe(false);
      expect(described.rawName).toBeNull();
      expect(described.label).toBeNull();
    }
  });

  it("does not report a generation for an unknown model", () => {
    expect(describeCubeModel("SomethingElse").generation).toBeNull();
  });
});

describe("modelItemName", () => {
  it("prefers the marketing label", () => {
    expect(modelItemName(describeCubeModel("GAN12uiM"))).toBe("GAN 12 ui Maglev");
  });

  it("falls back to the raw hardware name", () => {
    expect(modelItemName(describeCubeModel("GAN14uiFP"))).toBe("GAN14uiFP");
  });

  it("returns null when the hardware named nothing", () => {
    expect(modelItemName(describeCubeModel(null))).toBeNull();
  });
});

describe("generationLabel", () => {
  it("prints the generation number", () => {
    expect(generationLabel("gen2")).toBe("Gen 2");
    expect(generationLabel("gen4")).toBe("Gen 4");
  });

  it("returns null when there is no generation", () => {
    expect(generationLabel(null)).toBeNull();
  });
});

describe("CUBE_MODEL_CATALOG", () => {
  it("has no two entries claiming the same hardware name", () => {
    const names = CUBE_MODEL_CATALOG.map((entry) => entry.hardwareName.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("never contains a blank hardware name or label", () => {
    for (const entry of CUBE_MODEL_CATALOG) {
      expect(entry.hardwareName.trim().length).toBeGreaterThan(0);
      expect(entry.label.trim().length).toBeGreaterThan(0);
    }
  });
});
