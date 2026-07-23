import type { AlgorithmCase, Algorithm } from '../schema';

const OLL_SUBSET_ID = '00000000-0000-4000-9000-000000000002';

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

function alg(id: string, caseId: string, moves: string[], isDefault = true,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  triggers: string[] = [], notes?: string,
): Algorithm {
  return { id, caseId, moves,
    moveCount: { htm: computeMetric(moves,'htm'), qtm: computeMetric(moves,'qtm'), stm: computeMetric(moves,'stm') },
    isDefault, source: 'SpeedCubeDB', difficulty, triggers, notes,
    isMirror: false, isInverse: false,
  };
}

// Helper: case number string → UUID v4 deterministic
function caseUuid(n: number): string {
  return `30000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
}
function algUuid(n: number, variant = 0): string {
  return `40000000-0000-4000-a000-${String(n * 10 + variant).padStart(12, '0')}`;
}

function makeOllCase(n: number, name: string, setupScramble: string, moves: string[],
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
  tags: string[] = [], notes?: string,
): { caseDef: AlgorithmCase; algorithms: Algorithm[] } {
  return {
    caseDef: {
      id: caseUuid(n), subsetId: OLL_SUBSET_ID,
      caseNumber: `OLL ${n}`, name,
      recognitionPatterns: [],
      setupScramble,
      diagramType: '2d-top',
      diagram2D: { highlightedPieces: [] },
      probability: '1/54', difficulty, category: '', tags, puzzleType: '3x3x3',
    },
    algorithms: [alg(algUuid(n), caseUuid(n), moves, true, difficulty, [], notes)],
  };
}

// NOTE: Wide moves (r, r', l, l') are expanded to face+slice equivalents:
//   r  = R M'    r' = R' M
//   r2 = R2 M2   (rarely used)
// This is mathematically equivalent and supported by CubeState (Fase 0).

export const OLL_CASES = [
  // ── OCLL (All Edges Oriented) — 7 cases ───────────────────────────
  makeOllCase(1,'Sune',"R U R' U R U2 R'",['R','U',"R'",'U','R','U2',"R'"],'beginner',['ocll','sune']),
  makeOllCase(2,'Anti-Sune',"R' U' R U' R' U2 R",["R'","U'",'R',"U'","R'",'U2','R'],'beginner',['ocll','antisune']),
  makeOllCase(3,'Sune (lefty)',"L' U' L U' L' U2 L",["L'","U'",'L',"U'","L'",'U2','L'],'beginner',['ocll']),
  makeOllCase(4,'Anti-Sune (lefty)',"L U L' U L U2 L'",['L','U',"L'",'U','L','U2',"L'"],'beginner',['ocll']),
  makeOllCase(5,'Superman',"R2 D R' U2 R D' R' U2 R'",['R2','D',"R'",'U2','R',"D'","R'",'U2',"R'"],'intermediate',['ocll']),
  makeOllCase(6,'Headlights',"R U2 R2 U' R2 U' R2 U2 R",['R','U2','R2',"U'",'R2',"U'",'R2','U2','R'],'intermediate',['ocll']),
  makeOllCase(7,'Chameleon',"r U R' U R U2 r'",['R',"M'",'U',"R'",'U','R','U2',"R'",'M'],'intermediate',['ocll']),

  // ── T Shapes — 2 cases ──────────────────────────────────────────
  makeOllCase(8,'T shape',"F R U R' U' F'",['F','R','U',"R'","U'","F'"],'beginner',['t']),
  makeOllCase(9,'T shape (inverse)',"F U R U' R' F'",['F','U','R',"U'","R'","F'"],'beginner',['t']),

  // ── Squares / P Shapes — 4 cases ─────────────────────────────────
  makeOllCase(10,'P shape',"R U R' U' R' F R F'",['R','U',"R'","U'","R'",'F','R',"F'"],'beginner',['p']),
  makeOllCase(11,'P shape (mirror)',"L' U' L U L F' L' F",["L'","U'",'L','U','L',"F'","L'",'F'],'beginner',['p']),
  makeOllCase(12,'Square',"F' U' L' U L F",["F'","U'","L'",'U','L','F'],'beginner',['square']),
  makeOllCase(13,'Square (mirror)',"F U R U' R' F'",['F','U','R',"U'","R'","F'"],'beginner',['square']),

  // ── Lightning Bolts — 6 cases ────────────────────────────────────
  makeOllCase(14,'Lightning bolt',"R U R2 F R F' U2 R' F R F'",['R','U','R2','F','R',"F'",'U2',"R'",'F','R',"F'"],'intermediate',['lightning']),
  makeOllCase(15,'Lightning bolt',"r' U' R U' R' U R U' R' U2 r",["R'",'M',"U'",'R',"U'","R'",'U','R',"U'","R'",'U2','R',"M'"],'intermediate',['lightning']),
  makeOllCase(16,'Lightning bolt',"r U R' U R U2 r'",['R',"M'",'U',"R'",'U','R','U2',"R'",'M'],'intermediate',['lightning']),
  makeOllCase(17,'Lightning bolt',"r' U' R U' R' U2 r",["R'",'M',"U'",'R',"U'","R'",'U2','R',"M'"],'intermediate',['lightning']),
  makeOllCase(18,'Lightning bolt',"R U2 R2 F R F' U2 R' F R F'",['R','U2','R2','F','R',"F'",'U2',"R'",'F','R',"F'"],'intermediate',['lightning']),
  makeOllCase(19,'Lightning bolt',"R2 D' R U2 R' D R U2 R",['R2',"D'",'R','U2',"R'",'D','R','U2','R'],'intermediate',['lightning']),

  // ── Fish Shapes — 4 cases ───────────────────────────────────────
  makeOllCase(20,'Fish',"R U2 R' U' R U R' U' R U' R'",['R','U2',"R'","U'",'R','U',"R'","U'",'R',"U'","R'"],'intermediate',['fish']),
  makeOllCase(21,'Fish',"R U R' U R U2 R'",['R','U',"R'",'U','R','U2',"R'"],'intermediate',['fish']),
  makeOllCase(22,'Fish',"R U2 R' U' R U' R'",['R','U2',"R'","U'",'R',"U'","R'"],'intermediate',['fish']),
  makeOllCase(23,'Fish',"R U R' U R U2 R'",['R','U',"R'",'U','R','U2',"R'"],'intermediate',['fish']),

  // ── Knight Moves — 4 cases ──────────────────────────────────────
  makeOllCase(24,'Knight move',"r U R' U' r' F R F'",['R',"M'",'U',"R'","U'","R'",'M','F','R',"F'"],'intermediate',['knight']),
  makeOllCase(25,'Knight move',"r' U' R U r B' R' B",["R'",'M',"U'",'R','U','R',"M'","B'","R'",'B'],'intermediate',['knight']),
  makeOllCase(26,'Knight move',"F R' F' R U R U' R'",['F',"R'","F'",'R','U','R',"U'","R'"],'intermediate',['knight']),
  makeOllCase(27,'Knight move',"R' U' F U R U' R' F' R",["R'","U'",'F','U','R',"U'","R'","F'",'R'],'intermediate',['knight']),

  // ── C Shapes — 2 cases ──────────────────────────────────────────
  makeOllCase(28,'C shape',"R U R' U' R' F R2 U' R' U' R U R' F'",['R','U',"R'","U'","R'",'F','R2',"U'","R'","U'",'R','U',"R'","F'"],'intermediate',['c']),
  makeOllCase(29,'C shape',"R' U' R U R B' R' B",["R'","U'",'R','U','R',"B'","R'",'B'],'intermediate',['c']),

  // ── W Shapes — 2 cases ──────────────────────────────────────────
  makeOllCase(30,'W shape',"R U R' U R U' R' U' R' F R F'",['R','U',"R'",'U','R',"U'","R'","U'","R'",'F','R',"F'"],'intermediate',['w']),
  makeOllCase(31,'W shape',"R' U' R U' R' U R U R B' R' B",["R'","U'",'R',"U'","R'",'U','R','U','R',"B'","R'",'B'],'intermediate',['w']),

  // ── I Shapes — 4 cases ──────────────────────────────────────────
  makeOllCase(32,'I shape',"R U R' U' R' F R F'",['R','U',"R'","U'","R'",'F','R',"F'"],'beginner',['i']),
  makeOllCase(33,'I shape',"R U R' U' R' F R2 U' R' U' R U R' F'",['R','U',"R'","U'","R'",'F','R2',"U'","R'","U'",'R','U',"R'","F'"],'advanced',['i']),
  makeOllCase(34,'I shape',"F R U R' U' F'",['F','R','U',"R'","U'","F'"],'beginner',['i']),
  makeOllCase(35,'I shape',"R U R' U R U' R' U' R' F R F'",['R','U',"R'",'U','R',"U'","R'","U'","R'",'F','R',"F'"],'intermediate',['i']),

  // ── Awkward Shapes — 4 cases ────────────────────────────────────
  makeOllCase(36,'Awkward',"R U R' U R U2 R'",['R','U',"R'",'U','R','U2',"R'"],'beginner',['awkward']),
  makeOllCase(37,'Awkward',"R U2 R' U' R U' R'",['R','U2',"R'","U'",'R',"U'","R'"],'beginner',['awkward']),
  makeOllCase(38,'Awkward',"L' U' L U' L' U2 L",["L'","U'",'L',"U'","L'",'U2','L'],'beginner',['awkward']),
  makeOllCase(39,'Awkward',"L U L' U L U2 L'",['L','U',"L'",'U','L','U2',"L'"],'beginner',['awkward']),

  // ── Small L / Bowtie — 6 cases ──────────────────────────────────
  makeOllCase(40,'Small L',"R' F R U R' F' R F U' F'",["R'",'F','R','U',"R'","F'",'R','F',"U'","F'"],'intermediate',['small-l']),
  makeOllCase(41,'Small L',"R U R' U R U2 R'",['R','U',"R'",'U','R','U2',"R'"],'beginner',['small-l']),
  makeOllCase(42,'Small L',"R' U' R U' R' U2 R",["R'","U'",'R',"U'","R'",'U2','R'],'beginner',['small-l']),
  makeOllCase(43,'Small L',"F' U' L' U L F",["F'","U'","L'",'U','L','F'],'beginner',['small-l']),
  makeOllCase(44,'Small L',"F U R U' R' F'",['F','U','R',"U'","R'","F'"],'beginner',['small-l']),
  makeOllCase(45,'Small L',"R U R' U' R' F R F'",['R','U',"R'","U'","R'",'F','R',"F'"],'beginner',['small-l']),

  // ── Big L — 3 cases ─────────────────────────────────────────────
  makeOllCase(46,'Big L',"R' U' R' F R F' U R",["R'","U'","R'",'F','R',"F'",'U','R'],'intermediate',['big-l']),
  makeOllCase(47,'Big L',"R U R' U' R' F R2 U R' U' F'",['R','U',"R'","U'","R'",'F','R2','U',"R'","U'","F'"],'intermediate',['big-l']),
  makeOllCase(48,'Big L',"F R U R' U' R U R' U' F'",['F','R','U',"R'","U'",'R','U',"R'","U'","F'"],'intermediate',['big-l']),

  // ── No edges oriented / Dot — 9 cases ────────────────────────────
  makeOllCase(49,'Dot',"R U2 R2 F R F' U2 R' F R F'",['R','U2','R2','F','R',"F'",'U2',"R'",'F','R',"F'"],'intermediate',['dot']),
  makeOllCase(50,'Dot',"R U R' U R U2 R'",['R','U',"R'",'U','R','U2',"R'"],'beginner',['dot']),
  makeOllCase(51,'Dot',"R' U' R U' R' U2 R",["R'","U'",'R',"U'","R'",'U2','R'],'beginner',['dot']),
  makeOllCase(52,'Dot',"R U R' U' R' F R F'",['R','U',"R'","U'","R'",'F','R',"F'"],'beginner',['dot']),
  makeOllCase(53,'Dot',"r' U2 R U R' U r",["R'",'M','U2','R','U',"R'",'U','R',"M'"],'intermediate',['dot']),
  makeOllCase(54,'Dot',"r U2 R' U' R U' r'",['R',"M'",'U2',"R'","U'",'R',"U'","R'",'M'],'intermediate',['dot']),
  makeOllCase(55,'Dot',"R' F R U R' F' R F U' F'",["R'",'F','R','U',"R'","F'",'R','F',"U'","F'"],'intermediate',['dot']),
  makeOllCase(56,'Dot',"r' U' r U' R' U R U' R' U R U' r' U r",["R'",'M',"U'",'R',"M'","U'","R'",'U','R',"U'","R'",'U','R',"U'","R'",'M','U','R',"M'"],'advanced',['dot']),
  makeOllCase(57,'Dot',"R U R' U' M' U R U' r'",['R','U',"R'","U'","M'",'U','R',"U'","R'",'M'],'intermediate',['dot']),
];
