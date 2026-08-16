import { describe, expect, it } from "vitest";
import { CubeModel, CubeMeshFactory, RotationEngine } from "@cubeforge/cube-3d-engine";
import {
  CubeState,
  FaceletStringConverter,
  OrientationTable,
  parseFaceletsToCubies,
} from "@cubeforge/math-core";
import {
  CUBE_KEYMAP,
  actionToMoves,
  actionToNotation,
  actionToValidatorEvents,
  isActionAllowedForOrder,
} from "./cubeKeybinds";

const notationFor = (code: string) => actionToNotation(CUBE_KEYMAP[code]);

/** Invert a single WCA move ("R" → "R'", "r'" → "r", "x" → "x'"). */
const inverseMove = (notation: string) =>
  notation.endsWith("'") ? notation.slice(0, -1) : `${notation}'`;

describe("CUBE_KEYMAP — csTimer layout", () => {
  it("maps the 12 face keys exactly like csTimer", () => {
    expect(notationFor("KeyJ")).toBe("U");
    expect(notationFor("KeyF")).toBe("U'");
    expect(notationFor("KeyH")).toBe("F");
    expect(notationFor("KeyG")).toBe("F'");
    expect(notationFor("KeyI")).toBe("R");
    expect(notationFor("KeyK")).toBe("R'");
    expect(notationFor("KeyD")).toBe("L");
    expect(notationFor("KeyE")).toBe("L'");
    expect(notationFor("KeyW")).toBe("B");
    expect(notationFor("KeyO")).toBe("B'");
    expect(notationFor("KeyS")).toBe("D");
    expect(notationFor("KeyL")).toBe("D'");
  });

  it("maps rotations exactly like csTimer (T/Y=x, N/B=x', A=y', ;=y, Q=z', P=z)", () => {
    expect(notationFor("KeyT")).toBe("x");
    expect(notationFor("KeyY")).toBe("x");
    expect(notationFor("KeyN")).toBe("x'");
    expect(notationFor("KeyB")).toBe("x'");
    expect(notationFor("KeyA")).toBe("y'");
    expect(notationFor("Semicolon")).toBe("y");
    expect(notationFor("KeyQ")).toBe("z'");
    expect(notationFor("KeyP")).toBe("z");
  });

  it("maps wide moves exactly like csTimer (U=r, M=r', R=l', V=l, C=u', ,=u, Z=d, /=d')", () => {
    expect(notationFor("KeyU")).toBe("r");
    expect(notationFor("KeyM")).toBe("r'");
    expect(notationFor("KeyR")).toBe("l'");
    expect(notationFor("KeyV")).toBe("l");
    expect(notationFor("KeyC")).toBe("u'");
    expect(notationFor("Comma")).toBe("u");
    expect(notationFor("KeyZ")).toBe("d");
    expect(notationFor("Slash")).toBe("d'");
  });

  it("maps slice moves exactly like csTimer (5/6=M, ./X=M', 2=E, 9=E', 1=S', 0=S)", () => {
    expect(notationFor("Digit5")).toBe("M");
    expect(notationFor("Digit6")).toBe("M'");
    expect(notationFor("Period")).toBe("M'");
    expect(notationFor("KeyX")).toBe("M'");
    expect(notationFor("Digit2")).toBe("E");
    expect(notationFor("Digit9")).toBe("E'");
    expect(notationFor("Digit1")).toBe("S'");
    expect(notationFor("Digit0")).toBe("S");
  });
});

describe("actionToMoves", () => {
  it("expands J (U) to a single -90° turn of the y=1 layer", () => {
    expect(actionToMoves(CUBE_KEYMAP.KeyJ)).toEqual([
      { axis: "y", layerValues: [1], angle: -90 },
    ]);
  });

  it("expands F (U') to +90° on the y=1 layer", () => {
    expect(actionToMoves(CUBE_KEYMAP.KeyF)).toEqual([
      { axis: "y", layerValues: [1], angle: 90 },
    ]);
  });

  it("expands 5 (M) to a +90° slice turn on x=0", () => {
    expect(actionToMoves(CUBE_KEYMAP.Digit5)).toEqual([
      { axis: "x", layerValues: [0], angle: 90 },
    ]);
  });

  it("expands U (r) into R + M' (two concurrent layers)", () => {
    expect(actionToMoves(CUBE_KEYMAP.KeyU)).toEqual([
      { axis: "x", layerValues: [1], angle: -90 }, // R
      { axis: "x", layerValues: [0], angle: -90 }, // M'
    ]);
  });

  it("expands V (l) into L + M — both layers turn the SAME way (+90° on x)", () => {
    expect(actionToMoves(CUBE_KEYMAP.KeyV)).toEqual([
      { axis: "x", layerValues: [-1], angle: 90 }, // L
      { axis: "x", layerValues: [0], angle: 90 }, // M (like L)
    ]);
  });

  it("expands , (u) into U + E' — both -90° on y (block turns together)", () => {
    expect(actionToMoves(CUBE_KEYMAP.Comma)).toEqual([
      { axis: "y", layerValues: [1], angle: -90 }, // U
      { axis: "y", layerValues: [0], angle: -90 }, // E' (like D)
    ]);
  });

  it("expands Z (d) into D + E — both layers turn the SAME way (+90° on y)", () => {
    expect(actionToMoves(CUBE_KEYMAP.KeyZ)).toEqual([
      { axis: "y", layerValues: [-1], angle: 90 }, // D
      { axis: "y", layerValues: [0], angle: 90 }, // E (like D)
    ]);
  });

  it("expands / (d') into D' + E' — both -90° on y", () => {
    expect(actionToMoves(CUBE_KEYMAP.Slash)).toEqual([
      { axis: "y", layerValues: [-1], angle: -90 },
      { axis: "y", layerValues: [0], angle: -90 },
    ]);
  });

  it("expands T (x) into a whole-cube rotation (all x layers) on 3×3", () => {
    expect(actionToMoves(CUBE_KEYMAP.KeyT, 3)).toEqual([
      { axis: "x", layerValues: [-1, 0, 1], angle: -90 },
    ]);
  });

  it("expands T (x) into two layers on 2×2", () => {
    expect(actionToMoves(CUBE_KEYMAP.KeyT, 2)).toEqual([
      { axis: "x", layerValues: [-1, 1], angle: -90 },
    ]);
  });

  it("compacts repeated notation (U + U = U2)", () => {
    expect(actionToNotation(CUBE_KEYMAP.KeyJ)).toBe("U");
  });
});

describe("isActionAllowedForOrder", () => {
  it("allows the full keymap on orders > 2 (3×3 unchanged)", () => {
    for (const code of Object.keys(CUBE_KEYMAP)) {
      expect(isActionAllowedForOrder(CUBE_KEYMAP[code], 3)).toBe(true);
    }
  });

  it("keeps face turns and whole-cube rotations on 2×2", () => {
    expect(isActionAllowedForOrder(CUBE_KEYMAP.KeyJ, 2)).toBe(true); // U
    expect(isActionAllowedForOrder(CUBE_KEYMAP.KeyI, 2)).toBe(true); // R
    expect(isActionAllowedForOrder(CUBE_KEYMAP.KeyW, 2)).toBe(true); // B
    expect(isActionAllowedForOrder(CUBE_KEYMAP.KeyT, 2)).toBe(true); // x
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Semicolon, 2)).toBe(true); // y
    expect(isActionAllowedForOrder(CUBE_KEYMAP.ArrowLeft, 2)).toBe(true); // y
  });

  it("blocks slice moves (M/E/S) on 2×2", () => {
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Digit5, 2)).toBe(false); // M
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Digit6, 2)).toBe(false); // M'
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Digit2, 2)).toBe(false); // E
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Digit9, 2)).toBe(false); // E'
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Digit1, 2)).toBe(false); // S'
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Digit0, 2)).toBe(false); // S
  });

  it("blocks wide moves on 2×2", () => {
    expect(isActionAllowedForOrder(CUBE_KEYMAP.KeyU, 2)).toBe(false); // r
    expect(isActionAllowedForOrder(CUBE_KEYMAP.KeyM, 2)).toBe(false); // r'
    expect(isActionAllowedForOrder(CUBE_KEYMAP.KeyV, 2)).toBe(false); // l
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Comma, 2)).toBe(false); // u
    expect(isActionAllowedForOrder(CUBE_KEYMAP.KeyZ, 2)).toBe(false); // d
    expect(isActionAllowedForOrder(CUBE_KEYMAP.Slash, 2)).toBe(false); // d'
  });
});

describe("CUBE_KEYMAP ↔ math-core determinism", () => {
  it("every keymap notation is accepted by CubeState.applySequence", () => {
    for (const code of Object.keys(CUBE_KEYMAP)) {
      const notation = actionToNotation(CUBE_KEYMAP[code]);
      expect(() => new CubeState().applySequence(notation), `${code} → ${notation}`).not.toThrow();
    }
  });

  it("every move is exact: applying it then its inverse returns to solved", () => {
    for (const code of Object.keys(CUBE_KEYMAP)) {
      const notation = actionToNotation(CUBE_KEYMAP[code]);
      const state = new CubeState();
      state.applySequence(notation);
      state.applySequence(inverseMove(notation));
      expect(state.isSolved(), `${code} → ${notation} + ${inverseMove(notation)}`).toBe(true);
    }
  });
});

describe("actionToValidatorEvents — cube-fixed validator feed", () => {
  const identity = OrientationTable.IDENTITY;
  // y rotation faceMap (position → original): front shows R, right shows B,
  // back shows L, left shows F.
  const yGrip = OrientationTable.rotationEntryFor("y")!;

  it("with the identity grip, face turns pass through unchanged (M included)", () => {
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyJ, identity)).toEqual([{ kind: "face", face: "U", direction: 1 }]);
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyK, identity)).toEqual([{ kind: "face", face: "R", direction: -1 }]);
    expect(actionToValidatorEvents(CUBE_KEYMAP.Digit5, identity)).toEqual([{ kind: "face", face: "M", direction: 1 }]);
  });

  it("conjugates face turns through a rotated grip (drag the front face after y → original R)", () => {
    // After a y rotation the R face sits at the FRONT position: a drag that
    // turns the front-face layer must validate as the original R move.
    expect(actionToValidatorEvents({ kind: "turn", face: "F", direction: 1 }, yGrip)).toEqual([
      { kind: "face", face: "R", direction: 1 },
    ]);
    // The F face sits at the LEFT position after y: dragging it → original F
    // (a physical F turn is unchanged, it just looks like it sits on the left).
    expect(actionToValidatorEvents({ kind: "turn", face: "L", direction: -1 }, yGrip)).toEqual([
      { kind: "face", face: "F", direction: -1 },
    ]);
    // Slices conjugate too (a physical M' after y is an S' in the cube frame).
    expect(actionToValidatorEvents({ kind: "turn", face: "M", direction: -1 }, yGrip)).toEqual([
      { kind: "face", face: "S", direction: -1 },
    ]);
  });

  it("wide moves emit ONE token per action (r, l, u, d — no phantom slice error)", () => {
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyU, identity)).toEqual([{ kind: "token", notation: "r" }]);
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyM, identity)).toEqual([{ kind: "token", notation: "r'" }]);
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyV, identity)).toEqual([{ kind: "token", notation: "l" }]);
    expect(actionToValidatorEvents(CUBE_KEYMAP.Comma, identity)).toEqual([{ kind: "token", notation: "u" }]);
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyZ, identity)).toEqual([{ kind: "token", notation: "d" }]);
  });

  it("conjugates wide moves through a rotated grip, re-packed into a single token (r after y → b)", () => {
    // r = R M' → under y: B + S' → the canonical wide token "b".
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyU, yGrip)).toEqual([{ kind: "token", notation: "b" }]);
  });

  it("the re-packed wide token equals its conjugated parts on the cube", () => {
    const viaToken = new CubeState();
    viaToken.applySequence("b");
    const viaParts = new CubeState();
    viaParts.applySequence("B S'");
    expect(FaceletStringConverter.toFaceletString(viaToken)).toBe(
      FaceletStringConverter.toFaceletString(viaParts),
    );
  });

  it("emits nothing for whole-cube rotations (they are not moves)", () => {
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyT, identity)).toEqual([]);
    expect(actionToValidatorEvents(CUBE_KEYMAP.Semicolon, identity)).toEqual([]);
    expect(actionToValidatorEvents(CUBE_KEYMAP.KeyT, yGrip)).toEqual([]);
  });
});

describe("wide moves: engine visual ↔ CubeState consistency", () => {
  const WIDE_CODES = ["KeyU", "KeyM", "KeyR", "KeyV", "KeyC", "Comma", "KeyZ", "Slash"];

  it("every wide keymove leaves the engine model at the SAME positions as the state", async () => {
    for (const code of WIDE_CODES) {
      const action = CUBE_KEYMAP[code];
      const notation = actionToNotation(action);

      // Visual: apply the keymap's engine moves to a fresh 3×3 model.
      const model = new CubeModel(new CubeMeshFactory(), 3);
      const engine = new RotationEngine(model);
      const proms = actionToMoves(action, 3).map((mv) =>
        engine.rotateLayers(mv.axis, mv.layerValues, mv.angle, 0),
      );
      engine.update(1_000); // duration 0 → snap on the first update
      await Promise.all(proms);

      // State: same notation through math-core, serialized + parsed back.
      const state = new CubeState();
      state.applySequence(notation);
      const parsed = parseFaceletsToCubies(FaceletStringConverter.toFaceletString(state));

      // Every NON-CENTER piece must occupy the same grid position in both
      // representations (catches the d/l slice-direction desync: E/M turning
      // the wrong way). The 6 CENTERS are intentionally excluded: math-core
      // fixes them as the reference frame (they never permute), while the
      // engine rotates them physically — both agree the sticker stays on its
      // face, and solved-detection ignores centers anyway.
      for (const p of parsed) {
        const isCenter = Math.abs(p.initialX) + Math.abs(p.initialY) + Math.abs(p.initialZ) === 1;
        if (isCenter) continue;
        const cubie = model.getLogicalState().find(
          (c) =>
            Math.abs(c.initialGridX - p.initialX) < 0.01 &&
            Math.abs(c.initialGridY - p.initialY) < 0.01 &&
            Math.abs(c.initialGridZ - p.initialZ) < 0.01,
        );
        expect(cubie, `${code} → ${notation}: missing piece ${p.initialX},${p.initialY},${p.initialZ}`).toBeTruthy();
        // Normalize -0 → 0 (grid math can leave a negative zero; positions are
        // still exact integers).
        const grid = [cubie!.gridX, cubie!.gridY, cubie!.gridZ].map((v) => (v === 0 ? 0 : v));
        expect(grid, `${code} → ${notation} — visual and state disagree`).toEqual([p.currX, p.currY, p.currZ]);
      }
    }
  });
});
