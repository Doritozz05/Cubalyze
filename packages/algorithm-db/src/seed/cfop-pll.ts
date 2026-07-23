import type { AlgorithmCase, Algorithm } from '../schema';


// ─── PLL Cases — 21 cases for CFOP ────────────────────────────────────────
//
// Side strips corrected to remove impossible color combinations:
// U-layer pieces can only show side-face colors (R,G,B,O) — never
// the U-face color (Y) or D-face color (W) on side strips.
// Each case has exactly 3 of each side color (12 side stickers = 4×3).
// U face: all yellow (PLL preserves piece orientation).
// Color legend:
//   Y=yellow(U), R=red(R), G=green(F), W=white(D), O=orange(L), B=blue(B)

const PLL_SUBSET_ID = '00000000-0000-4000-9000-000000000001';

function computeMetric(moves: string[], metric: 'htm' | 'qtm' | 'stm'): number {
  let count = 0;
  for (const m of moves) {
    const base = m[0];
    const isSlice = base === 'M' || base === 'S' || base === 'E';
    if (metric === 'stm') { if (isSlice) count++; continue; }
    if (isSlice) { if (metric === 'htm') count++; continue; }
    if (base === 'x' || base === 'y' || base === 'z') continue;
    if (metric === 'htm') count++;
    else count += m.includes('2') ? 2 : 1;
  }
  return count;
}

function alg(
  id: string, caseId: string, moves: string[],
  isDefault = true,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  triggers: string[] = [], notes?: string,
): Algorithm {
  return {
    id, caseId, moves,
    moveCount: { htm: computeMetric(moves,'htm'), qtm: computeMetric(moves,'qtm'), stm: computeMetric(moves,'stm') },
    isDefault, source: 'SpeedCubeDB', difficulty, triggers, notes,
    isMirror: false, isInverse: false,
  };
}

/** Build a facelet array from human-readable 3-char side strips.
 *  ⚠️ PARAMETER ORDER: (u, f, r, l, b) but ARRAY ORDER is u + R + F + D + L + B.
 *  f → indices 18-20 (F strip), r → indices 9-11 (R strip),
 *  l → indices 36-38 (L strip), b → indices 45-47 (B strip).
 *  D face (indices 27-35) is always gray ('#'). */
export interface PLLCaseData { caseDef: AlgorithmCase; algorithms: Algorithm[] }

// ─── All 21 verified PLL Cases ────────────────────────────────────────────

export const PLL_CASES: PLLCaseData[] = [
  // ── 1. Aa (corner CW cycle: URF→UFL→ULB→URF, UBR stays) ─────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000005', subsetId:PLL_SUBSET_ID, caseNumber:'Aa', name:'Aa Perm', recognitionPatterns:['Headlights on left','Block on front-right'], setupScramble:"x R2 D2 R U R' D2 R U' R x'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,6,8] }, probability:'1/18', difficulty:'intermediate', category:'Corner cycles', tags:['x-rotation','D-moves'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000005','10000000-0000-4000-a000-000000000005',['x',"R'",'U',"R'",'D2','R',"U'","R'",'D2','R2',"x'"],true,'intermediate',[],'Standard Aa perm.') ] },
  // ── 2. Ab (corner CCW cycle: URF→ULB→UFL→URF, UBR stays) ────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000006', subsetId:PLL_SUBSET_ID, caseNumber:'Ab', name:'Ab Perm', recognitionPatterns:['Headlights on right','Block on front-left'], setupScramble:"x R' U R' D2 R U' R' D2 R2 x'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,6,8] }, probability:'1/18', difficulty:'intermediate', category:'Corner cycles', tags:['x-rotation','D-moves'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000006','10000000-0000-4000-a000-000000000006',['x','R2','D2','R','U',"R'",'D2','R',"U'",'R',"x'"],true,'intermediate',[],'Standard Ab perm.') ] },
  // ── 3. E (both diagonal corner swaps: URF↔ULB and UFL↔UBR) ────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000007', subsetId:PLL_SUBSET_ID, caseNumber:'E', name:'E Perm', recognitionPatterns:['No headlights anywhere','Diagonal corner swap pattern'], setupScramble:"x' D R U R' D' R U' R' D R U' R' D' R U R' x y'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,6,8] }, probability:'1/36', difficulty:'intermediate', category:'Corner swaps', tags:['diagonal'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000007','10000000-0000-4000-a000-000000000007',["x'",'R',"U'","R'",'D','R','U',"R'","D'",'R','U',"R'",'D','R',"U'","R'","D'",'x'],true,'intermediate',[],'Standard E perm.') ] },
  // ── 4. F (edges UR↔UL, corners URF↔UBR) ──────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000009', subsetId:PLL_SUBSET_ID, caseNumber:'F', name:'F Perm', recognitionPatterns:['Bar on front','T-perm-like with different corner swap'], setupScramble:"R' U' R U' R' U R U R2 F' R U R U' R' F U R y'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,6,8,1,3,5,7] }, probability:'1/18', difficulty:'intermediate', category:'Adjacent swap', tags:['popular'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000009','10000000-0000-4000-a000-000000000009',["R'","U'","F'",'R','U',"R'","U'","R'",'F','R2',"U'","R'","U'",'R','U',"R'",'U','R'],true,'intermediate',[],'Standard F perm.') ] },
  // ── 5. Ga (edges CW cycle: UF→UR→UB→UF, corners CW: URF→UFL→ULB) ──
  { caseDef: { id:'10000000-0000-4000-a000-000000000016', subsetId:PLL_SUBSET_ID, caseNumber:'Ga', name:'Ga Perm', recognitionPatterns:['Headlights on left','2-bar block on front extending right'], setupScramble:"D R' U' R U D' R2 U R' U R U' R U' R2", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8,1,7] }, probability:'1/18', difficulty:'advanced', category:'G perms', tags:['3-cycle','D-moves'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000016','10000000-0000-4000-a000-000000000016',['R2','U',"R'",'U',"R'","U'",'R',"U'",'R2','D',"U'","R'",'U','R',"D'"],true,'advanced',[],'Ga perm. Headlights on left.') ] },
  // ── 6. Gb (edges CCW, corners CCW) ───────────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000017', subsetId:PLL_SUBSET_ID, caseNumber:'Gb', name:'Gb Perm', recognitionPatterns:['Headlights on right','2-bar block on front extending left'], setupScramble:"D' R2 U R' U R' U' R U' R2 D U' R' U R", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8,1,7] }, probability:'1/18', difficulty:'advanced', category:'G perms', tags:['3-cycle','D-moves'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000017','10000000-0000-4000-a000-000000000017',["R'","U'",'R','U',"D'",'R2','U',"R'",'U','R',"U'",'R',"U'",'R2','D'],true,'advanced',[],'Gb perm. Mirror of Ga.') ] },
  // ── 7. Gc (edges CW: UF→UR→UB→UF, corners CW: URF→UFL→UBR) ────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000018', subsetId:PLL_SUBSET_ID, caseNumber:'Gc', name:'Gc Perm', recognitionPatterns:['Headlights on left','Block on back extending right'], setupScramble:"D' R U R' U' D R2 U' R U' R' U R' U R2", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8,1,7] }, probability:'1/18', difficulty:'advanced', category:'G perms', tags:['3-cycle','D-moves'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000018','10000000-0000-4000-a000-000000000018',['R2',"U'",'R',"U'",'R','U',"R'",'U','R2',"D'",'U','R',"U'","R'",'D'],true,'advanced',[],'Gc perm.') ] },
  // ── 8. Gd (edges CCW, corners CCW) ───────────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000019', subsetId:PLL_SUBSET_ID, caseNumber:'Gd', name:'Gd Perm', recognitionPatterns:['Headlights on right','Block on back extending left'], setupScramble:"D R2 U' R U' R U R' U R2 D' U R U' R'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8,1,7] }, probability:'1/18', difficulty:'advanced', category:'G perms', tags:['3-cycle','D-moves'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000019','10000000-0000-4000-a000-000000000019',['R','U',"R'","U'",'D','R2',"U'",'R',"U'","R'",'U',"R'",'U','R2',"D'"],true,'advanced',[],'Gd perm.') ] },
  // ── 9. H (opposite edges swap: UF↔UB and UR↔UL) ──────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000004', subsetId:PLL_SUBSET_ID, caseNumber:'H', name:'H Perm', recognitionPatterns:['All U-face stickers are yellow','All 4 side-centers show mismatch'], setupScramble:'M2 U M2 U2 M2 U M2', diagramType:'2d-top', diagram2D:{ highlightedPieces:[1,3,5,7] }, probability:'1/72', difficulty:'beginner', category:'Edge swaps', tags:['M-slice','fast'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000004','10000000-0000-4000-a000-000000000004',['M2','U','M2','U2','M2','U','M2'],true,'beginner',[],'Simple H perm. Very fast.') ] },
  // ── 10. Ja (edges UR↔UF, corners URF↔UFL) ────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000010', subsetId:PLL_SUBSET_ID, caseNumber:'Ja', name:'Ja Perm', recognitionPatterns:['Block on left','Cycle of corners + edge on right'], setupScramble:"L' R' U2 R U R' U2 L U' R y'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8] }, probability:'1/18', difficulty:'intermediate', category:'J perms', tags:['fast','popular'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000010','10000000-0000-4000-a000-000000000010',["R'",'U',"L'",'U2','R',"U'","R'",'U2','R','L',"U'"],true,'intermediate',[],'Standard Ja perm.') ] },
  // ── 11. Jb (edges UR↔UB, corners URF↔UBR) ────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000011', subsetId:PLL_SUBSET_ID, caseNumber:'Jb', name:'Jb Perm', recognitionPatterns:['Block on right','Cycle of corners + edge on left'], setupScramble:"R U R2 F' R U R U' R' F R U' R'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8] }, probability:'1/18', difficulty:'intermediate', category:'J perms', tags:['fast','popular'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000011','10000000-0000-4000-a000-000000000011',['R','U',"R'","F'",'R','U',"R'","U'","R'",'F','R2',"U'","R'","U'"],true,'intermediate',[],'Classic Jb perm.') ] },
  // ── 12. Na (corners URF↔ULB, edges solved) ────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000020', subsetId:PLL_SUBSET_ID, caseNumber:'Na', name:'Na Perm', recognitionPatterns:['Diagonal corner swap','All edges solved'], setupScramble:"R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,6,8] }, probability:'1/72', difficulty:'intermediate', category:'N perms', tags:['diagonal'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000020','10000000-0000-4000-a000-000000000020',['R','U',"R'",'U','R','U',"R'","F'",'R','U',"R'","U'","R'",'F','R2',"U'","R'",'U2','R',"U'","R'"],true,'intermediate',[],'Na perm. Long but R/U.') ] },
  // ── 13. Nb (corners UFL↔UBR, edges solved) ────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000021', subsetId:PLL_SUBSET_ID, caseNumber:'Nb', name:'Nb Perm', recognitionPatterns:['Diagonal corner swap','All edges solved'], setupScramble:"R' U R U' R' F' U' F R U R' F R' F' R U' R", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,6,8] }, probability:'1/72', difficulty:'intermediate', category:'N perms', tags:['diagonal'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000021','10000000-0000-4000-a000-000000000021',["R'",'U','R',"U'","R'","F'","U'",'F','R','U',"R'",'F',"R'","F'",'R',"U'",'R'],true,'intermediate',[],'Nb perm. Mirror of Na.') ] },
  // ── 14. Ra (edges UR↔UF, corners URF↔UBR) ────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000012', subsetId:PLL_SUBSET_ID, caseNumber:'Ra', name:'Ra Perm', recognitionPatterns:['Headlights on left-back','Block on front-right'], setupScramble:"R U2 R D R' U R D' R' U' R' U R U R' y'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8] }, probability:'1/18', difficulty:'intermediate', category:'R perms', tags:['D-moves'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000012','10000000-0000-4000-a000-000000000012',['R',"U'","R'","U'",'R','U','R','D',"R'","U'",'R',"D'","R'",'U2',"R'","U'"],true,'intermediate',[],'Standard Ra perm.') ] },
  // ── 15. Rb (edges UR↔UB, corners URF↔UFL) ────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000013', subsetId:PLL_SUBSET_ID, caseNumber:'Rb', name:'Rb Perm', recognitionPatterns:['Headlights on right-front','Block on front-left'], setupScramble:"R' U R U R' U' R' D' R U R' D R U2 R", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8] }, probability:'1/18', difficulty:'intermediate', category:'R perms', tags:[], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000013','10000000-0000-4000-a000-000000000013',["R'",'U2','R','U2',"R'",'F','R','U',"R'","U'","R'","F'",'R2',"U'"],true,'intermediate',[],'Standard Rb perm.') ] },
  // ── 16. T (edges UR↔UL, corners URF↔UFL) ──────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000008', subsetId:PLL_SUBSET_ID, caseNumber:'T', name:'T Perm', recognitionPatterns:['Headlights on left','Bar on front face'], setupScramble:"R U R' U' R' F R2 U' R' U' R U R' F'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,6,8,1,3,5,7] }, probability:'1/18', difficulty:'intermediate', category:'Adjacent swap', tags:['popular','fast'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000008','10000000-0000-4000-a000-000000000008',['R','U',"R'","U'","R'",'F','R2',"U'","R'","U'",'R','U',"R'","F'"],true,'intermediate',[],'Classic T perm.') ] },
  // ── 17. Ua (bar on LEFT, UL stays, CW edge cycle) ──────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000001', subsetId:PLL_SUBSET_ID, caseNumber:'Ua', name:'Ua Perm', recognitionPatterns:['Bar on left side','Opposite edge on right needs to go to back'], setupScramble:"M2 U' M' U2 M U' M2", diagramType:'2d-top', diagram2D:{ highlightedPieces:[1,3,5,7] }, probability:'1/18', difficulty:'intermediate', category:'Edge cycles', tags:['2-gen','RU'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001',['R',"U'",'R','U','R','U','R',"U'","R'","U'",'R2'],true,'intermediate',[],'Standard Ua perm. Bar on left.') ] },
  // ── 18. Ub (bar on RIGHT, UR stays, CCW edge cycle) ────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000002', subsetId:PLL_SUBSET_ID, caseNumber:'Ub', name:'Ub Perm', recognitionPatterns:['Bar on right side','Opposite edge on left needs to go to back'], setupScramble:"M2 U M' U2 M U M2", diagramType:'2d-top', diagram2D:{ highlightedPieces:[1,3,5,7] }, probability:'1/18', difficulty:'intermediate', category:'Edge cycles', tags:['2-gen','RU'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000002','10000000-0000-4000-a000-000000000002',['R2','U','R','U',"R'","U'","R'","U'","R'",'U',"R'"],true,'intermediate',[],'Standard Ub perm. Bar on right.') ] },
  // ── 19. V (edges UR↔UF, corners URF→UBR→ULB→URF cycle) ──────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000015', subsetId:PLL_SUBSET_ID, caseNumber:'V', name:'V Perm', recognitionPatterns:['Block on back','Corner-edge pair separated on front'], setupScramble:"D2 R' U R D' R2 U' R' U R' U R' D' R U2 R'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,3,5,6,8] }, probability:'1/18', difficulty:'intermediate', category:'Adjacent swap', tags:['rotation'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000015','10000000-0000-4000-a000-000000000015',["R'",'U',"R'","U'",'y',"R'","F'",'R2',"U'","R'",'U',"R'",'F','R','F'],true,'intermediate',[],'Standard V perm.') ] },
  // ── 20. Y (edges opposite: UF↔UB and UR↔UL, corners URF↔ULB) ────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000014', subsetId:PLL_SUBSET_ID, caseNumber:'Y', name:'Y Perm', recognitionPatterns:['Diagonal corner swap','Two opposite edges swap'], setupScramble:"F R U' R' U' R U R' F' R U R' U' R' F R F'", diagramType:'2d-top', diagram2D:{ highlightedPieces:[0,2,6,8,1,3,5,7] }, probability:'1/18', difficulty:'intermediate', category:'Diagonal swap', tags:[], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000014','10000000-0000-4000-a000-000000000014',['F','R',"U'","R'","U'",'R','U',"R'","F'",'R','U',"R'","U'","R'",'F','R',"F'"],true,'intermediate',[],'Standard Y perm. Fast.') ] },
  // ── 21. Z (cross pattern: UF↔UR and UB↔UL) ────────────────────────────
  { caseDef: { id:'10000000-0000-4000-a000-000000000003', subsetId:PLL_SUBSET_ID, caseNumber:'Z', name:'Z Perm', recognitionPatterns:['Cross/checkerboard on U face','Opposite side stickers alternate'], setupScramble:"M U2 M2 U2 M U' M2 U' M2", diagramType:'2d-top', diagram2D:{ highlightedPieces:[1,3,5,7] }, probability:'1/36', difficulty:'intermediate', category:'Edge swaps', tags:['M-slice'], puzzleType:'3x3x3' },
    algorithms:[ alg('20000000-0000-4000-a000-000000000003','10000000-0000-4000-a000-000000000003',['M2','U','M2','U',"M'",'U2','M2','U2',"M'",'U2'],true,'intermediate',[],'M-slice Z perm. Fast with M flicks.') ] },
];
