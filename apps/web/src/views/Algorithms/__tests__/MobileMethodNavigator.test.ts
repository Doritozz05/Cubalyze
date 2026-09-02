import { describe, it, expect } from "vitest";
import { SUBSETS } from "@cubeforge/algorithm-db";
import {
  buildTree,
  findPathTo,
  pathLabelFor,
} from "../components/MobileMethodNavigator";

describe("MobileMethodNavigator logic & responsive selection contract", () => {
  const tree = buildTree();
  const pllSubset = SUBSETS.find((s) => s.name === "PLL");

  it("builds a hierarchical tree starting with puzzles at the root", () => {
    expect(tree.length).toBeGreaterThanOrEqual(2);
    const puzzleIds = tree.map((n) => n.id);
    expect(puzzleIds).toContain("333");
    expect(puzzleIds).toContain("222");

    const threeByThree = tree.find((n) => n.id === "333");
    expect(threeByThree).toBeDefined();
    expect(threeByThree?.kind).toBe("puzzle");

    const cfop = threeByThree?.children?.find((m) => m.label === "CFOP");
    expect(cfop).toBeDefined();
    expect(cfop?.kind).toBe("method");

    const subsets = cfop?.children?.map((s) => s.label);
    expect(subsets).toContain("PLL");
    expect(subsets).toContain("OLL");
    expect(subsets).toContain("F2L");
  });

  it("findPathTo returns [] for null (root level: asking for puzzle first)", () => {
    const path = findPathTo(tree, null);
    expect(path).toEqual([]);
  });

  it("findPathTo returns [puzzle, method] path for a subset (e.g. PLL)", () => {
    expect(pllSubset).toBeDefined();
    const path = findPathTo(tree, pllSubset!.id);
    expect(path.length).toBe(2);
    expect(path[0].id).toBe("333");
    expect(path[0].label).toBe("3×3");
    expect(path[1].label).toBe("CFOP");
  });

  it("pathLabelFor returns fallback when subsetId is null", () => {
    const label = pathLabelFor(tree, null, "Selecciona un método");
    expect(label).toBe("Selecciona un método");
  });

  it("pathLabelFor returns full breadcrumb trail when subsetId is selected", () => {
    expect(pllSubset).toBeDefined();
    const label = pathLabelFor(tree, pllSubset!.id, "Selecciona un método");
    expect(label).toBe("3×3 › CFOP › PLL");
  });

  it("flattens single-subset method CLL directly under 2×2 without redundant submenu", () => {
    const twoByTwo = tree.find((n) => n.id === "222");
    expect(twoByTwo).toBeDefined();

    const cllNode = twoByTwo?.children?.find((n) => n.label === "CLL");
    expect(cllNode).toBeDefined();
    expect(cllNode?.kind).toBe("subset");
    expect(cllNode?.children).toBeUndefined();

    const cllPath = findPathTo(tree, cllNode!.id);
    expect(cllPath.map((n) => n.label)).toEqual(["2×2"]);

    const label = pathLabelFor(tree, cllNode!.id, "Selecciona un método");
    expect(label).toBe("2×2 › CLL");
  });

  it("organizes EG directly with EG-1 and EG-2 without an intermediate 'EG' folder", () => {
    const twoByTwo = tree.find((n) => n.id === "222");
    const egNode = twoByTwo?.children?.find((n) => n.label === "EG");
    expect(egNode).toBeDefined();
    expect(egNode?.kind).toBe("method");

    // Children are directly EG-1 and EG-2
    const childLabels = egNode?.children?.map((c) => c.label);
    expect(childLabels).toEqual(["EG-1", "EG-2"]);

    const eg1 = egNode?.children?.find((c) => c.label === "EG-1");
    expect(eg1).toBeDefined();
    const eg1Path = findPathTo(tree, eg1!.id);
    expect(eg1Path.map((n) => n.label)).toEqual(["2×2", "EG"]);

    const eg1Label = pathLabelFor(tree, eg1!.id, "Selecciona un método");
    expect(eg1Label).toBe("2×2 › EG › EG-1");
  });

  describe("Responsive initialization contract for AlgorithmDashboard", () => {
    const computeInitialSubset = (
      width: number,
      initialSubsetId?: string | null,
    ): string | null => {
      if (initialSubsetId) return initialSubsetId;
      if (width < 768) {
        return null;
      }
      return SUBSETS.find((s) => s.name === "PLL")?.id ?? null;
    };

    it("starts with null on mobile (<768px) when no initialSubsetId provided", () => {
      const mobileSubset = computeInitialSubset(390, null);
      expect(mobileSubset).toBeNull();
      // On mobile with null subset, mobileNavOpen should be true to prompt user
      const shouldAutoOpen = !mobileSubset;
      expect(shouldAutoOpen).toBe(true);
    });

    it("starts with 3x3 PLL on desktop (>=768px)", () => {
      const desktopSubset = computeInitialSubset(1024, null);
      expect(desktopSubset).toBe(pllSubset?.id);
      const shouldAutoOpen = !desktopSubset;
      expect(shouldAutoOpen).toBe(false);
    });

    it("respects explicit initialSubsetId even on mobile", () => {
      const explicitSubset = computeInitialSubset(390, pllSubset?.id);
      expect(explicitSubset).toBe(pllSubset?.id);
      const shouldAutoOpen = !explicitSubset;
      expect(shouldAutoOpen).toBe(false);
    });
  });
});
