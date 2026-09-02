/**
 * loaders/__tests__/advancedF2L.test.ts — Advanced F2L loader contract.
 *
 * Locks the measured catalog shape of the combined detector:
 *   - all 126 BirdF2L setups produce valid D-cross FR anchor signatures;
 *   - the relational signature collapses BirdF2L mirrors/inverses: 36 unique
 *     signatures, of which 17 collide with Basic F2L and 19 are new;
 *   - Basic F2L is registered FIRST, so colliding signatures keep their
 *     canonical "F2L n" label (no regression on the 41 basic cases);
 *   - the combined catalog covers 60 signatures per cross face.
 */
import { describe, it, expect } from "vitest";
import { CaseStateGenerator } from "../../../caseGenerator";
import { ADVANCED_F2L_CASES, BASIC_F2L_CASES } from "../../../seed/cfop-f2l";
import { f2lSlotProbe } from "../../probes/f2lSlotProbe";
import { createF2LDetector, loadAdvancedF2LCases } from "../advancedF2L";

const anchorCtx = f2lSlotProbe.catalogContext();

function anchorSignature(setup: string): string {
  return f2lSlotProbe.signature(
    CaseStateGenerator.generateFromScramble(setup),
    anchorCtx,
  );
}

describe("advancedF2L loader", () => {
  it("loads all 126 seed cases", () => {
    const cases = loadAdvancedF2LCases("", "D");
    expect(cases.length).toBe(126);
    expect(new Set(cases.map((c) => c.caseNumber)).size).toBe(126);
  });

  it("every advanced setup yields a valid anchor signature", () => {
    for (const c of ADVANCED_F2L_CASES) {
      expect(anchorSignature(c.caseDef.setupScramble)).not.toBe("");
    }
  });

  it("collapses to 36 unique signatures; 17 collide with basic, 19 are new", () => {
    const basic = new Map<string, string>();
    for (const c of BASIC_F2L_CASES) {
      basic.set(anchorSignature(c.caseDef.setupScramble), c.caseDef.caseNumber);
    }
    expect(basic.size).toBe(41);

    const adv = new Set<string>();
    for (const c of ADVANCED_F2L_CASES) {
      adv.add(anchorSignature(c.caseDef.setupScramble));
    }
    expect(adv.size).toBe(36);

    let collide = 0;
    for (const sig of adv) {
      if (basic.has(sig)) collide++;
    }
    expect(collide).toBe(17);
    expect(adv.size - collide).toBe(19);
  });

  it("basic wins signature collisions; combined catalog = 60 per cross face", () => {
    const det = createF2LDetector();
    // 6 cross faces × 60 signatures (41 basic + 19 advanced unique).
    expect(det.catalogSize).toBe(6 * 60);

    // Every basic case must still resolve to its own "F2L n" label.
    for (const c of BASIC_F2L_CASES) {
      const state = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble);
      const res = det.detect(state, "D", "FR");
      expect(res.entry?.caseNumber).toBe(c.caseDef.caseNumber);
      expect(res.confidence).toBe("exact");
    }

    // A representative advanced case resolves under its BirdF2L name.
    const advCase = ADVANCED_F2L_CASES.find((c) => c.caseDef.caseNumber === "Up")!;
    const state = CaseStateGenerator.generateFromScramble(advCase.caseDef.setupScramble);
    const res = det.detect(state, "D", "FR");
    expect(res.entry?.caseNumber).toBe("Up");
    expect(res.confidence).toBe("exact");
  });
});
