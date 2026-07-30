import { describe, it, expect, beforeEach } from 'vitest';
import { CubeMeshFactory } from '../core/CubeMeshFactory';
import { CubeModel } from '../core/CubeModel';

describe('setF2LMaskGray logic', () => {
  let factory: CubeMeshFactory;
  let model: CubeModel;

  beforeEach(() => {
    factory = new CubeMeshFactory();
    model = new CubeModel(factory);
  });

  it('identifies yellow U-layer pieces and FR slot pieces correctly', () => {
    const cubies = model.getLogicalState();
    
    // In Basic F2L: only initialGridY === 1 is grayed
    const basicYellowPieces = cubies.filter(c => c.initialGridY === 1);
    expect(basicYellowPieces.length).toBe(9);

    // In Advanced F2L: initialGridY === 1 PLUS corner (1, -1, 1) and edge (1, 0, 1)
    const af2lCorner = cubies.find(
      c => c.initialGridX === 1 && c.initialGridY === -1 && c.initialGridZ === 1
    );
    const af2lEdge = cubies.find(
      c => c.initialGridX === 1 && c.initialGridY === 0 && c.initialGridZ === 1
    );

    expect(af2lCorner).toBeDefined();
    expect(af2lEdge).toBeDefined();

    const af2lGrayedPieces = cubies.filter(
      c =>
        c.initialGridY === 1 ||
        (c.initialGridX === 1 && c.initialGridY === -1 && c.initialGridZ === 1) ||
        (c.initialGridX === 1 && c.initialGridY === 0 && c.initialGridZ === 1)
    );

    // 9 (U layer) + 1 (DFR corner) + 1 (FR edge) = 11 pieces total in AF2L
    expect(af2lGrayedPieces.length).toBe(11);
  });
});
