export interface SkillNode {
  id: string;
  title: string;
  subtitle: string;
  category: "inspection" | "f2l" | "edge-control" | "coll" | "zbll" | "ergonomics";
  tier: "Fundamental" | "Advanced" | "Pro" | "Master" | "Elite";
  status: "unlocked" | "in-progress" | "locked";
  xpReward: number;
  description: string;
  theory: string;
  exampleFormula?: string;
  prerequisites: string[];
  recommendedDrills: string[];
  masteryPercentage: number;
  // Node coordinates for graph positioning
  x: number;
  y: number;
}

export interface SkillBranch {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  nodes: SkillNode[];
}

export const SKILL_BRANCHES: SkillBranch[] = [
  {
    id: "inspection",
    name: "I. Inspection & Cross Planning",
    subtitle: "Maximizing official WCA 15s inspection time and building smart first blocks",
    color: "#3b82f6",
    nodes: [
      {
        id: "cross-plus-one",
        title: "Cross + 1 Planning",
        subtitle: "Tracking the first F2L pair during inspection",
        category: "inspection",
        tier: "Fundamental",
        status: "unlocked",
        xpReward: 350,
        description: "Predict the final landing position of the first corner-edge pair while planning the cross.",
        theory: "By planning the 6-7 cross moves during the 15-second inspection window, cognitive headroom is freed up to visually track the pieces of F2L Pair 1.",
        exampleFormula: "Inspection: [D R' F B2 D2] + Tracking: [U2 L R']",
        prerequisites: [],
        recommendedDrills: [
          "Blindfold Cross: Plan the cross, cover your eyes, and execute from memory.",
          "1-Pair Prediction: Predict which slot the target corner will land in.",
        ],
        masteryPercentage: 92,
        x: 100,
        y: 120,
      },
      {
        id: "xcross",
        title: "XCross (Extended Cross)",
        subtitle: "Simultaneous assembly of Cross + F2L Pair #1",
        category: "inspection",
        tier: "Advanced",
        status: "unlocked",
        xpReward: 600,
        description: "Combine cross edge alignment with the placement of a 1x2x2 block in a single fluid sequence.",
        theory: "An XCross leverages pre-paired or offset pieces during scramble inspection to resolve the cross and first pair in ~8 total moves instead of 12.",
        exampleFormula: "Scramble setup: D2 R' F B2 D2 -> XCross: D2 R' U R F B2 D2",
        prerequisites: ["cross-plus-one"],
        recommendedDrills: [
          "XCross Scramble Generator: Solve 50 forced XCross scrambles.",
          "Efficiency Index: Achieve XCross in fewer than 9 turns.",
        ],
        masteryPercentage: 85,
        x: 340,
        y: 120,
      },
      {
        id: "keyhole",
        title: "Keyhole Technique",
        subtitle: "Direct insertion using adjacent empty F2L slots",
        category: "inspection",
        tier: "Advanced",
        status: "in-progress",
        xpReward: 450,
        description: "Insert an isolated edge or corner piece into its target slot using an unsolved empty slot.",
        theory: "Instead of pairing corner and edge prior to insertion, rotate the D layer to place an unsolved slot under the target, placing the loose piece directly in 3 moves.",
        exampleFormula: "D' (Align empty slot) + R U R' + D (Restore cross)",
        prerequisites: ["cross-plus-one"],
        recommendedDrills: [
          "Keyhole Edge Only Drill: Resolve 3 F2L edges strictly using Keyhole.",
        ],
        masteryPercentage: 64,
        x: 340,
        y: 270,
      },
    ],
  },
  {
    id: "f2l",
    name: "II. Advanced F2L & Block Building",
    subtitle: "Relative slotting, non-matching cross alignments, and multislotting",
    color: "#06b6d4",
    nodes: [
      {
        id: "pseudo-slotting",
        title: "Pseudo-Slotting & D-Offset",
        subtitle: "Pairing relative to a temporarily offset cross",
        category: "f2l",
        tier: "Elite",
        status: "in-progress",
        xpReward: 850,
        description: "Form F2L pairs assuming the D layer is rotated D or D' off-alignment.",
        theory: "Allows solving F2L pairs that look unfavorable under standard orientation. At the end of the solve, a simple D or D2 move aligns all blocks simultaneously.",
        exampleFormula: "D (Offset) + U R U' R' + D' (Alignment)",
        prerequisites: ["xcross", "keyhole"],
        recommendedDrills: [
          "Pseudo-F2L Pair recognition under active D-rotations.",
        ],
        masteryPercentage: 48,
        x: 580,
        y: 195,
      },
      {
        id: "multi-slotting",
        title: "Multi-Slotting & Block Building",
        subtitle: "Coupled solving of 2 adjacent F2L pairs without pauses",
        category: "f2l",
        tier: "Master",
        status: "locked",
        xpReward: 1200,
        description: "Pair and insert two F2L blocks in a unified sequence without intermediate pauses.",
        theory: "Leverages the movement of one F2L pair to set up the pieces of the next pair, unifying two slot insertions into a single 10-12 turn sequence.",
        exampleFormula: "R U2 R' U R U' R' + L' U L",
        prerequisites: ["pseudo-slotting"],
        recommendedDrills: [
          "Multi-slotting 2-pair prediction exercise.",
        ],
        masteryPercentage: 15,
        x: 820,
        y: 195,
      },
    ],
  },
  {
    id: "edge-control",
    name: "III. Edge Control & Pre-Last Layer",
    subtitle: "Manipulating top layer edge orientation during the final F2L slot",
    color: "#f59e0b",
    nodes: [
      {
        id: "eo-f2l",
        title: "Partial Edge Control (EO-F2L)",
        subtitle: "Avoiding dot OLLs by orienting edges during last slot insertion",
        category: "edge-control",
        tier: "Advanced",
        status: "unlocked",
        xpReward: 500,
        description: "Insert the 4th F2L pair using edge-orienting insertion variants.",
        theory: "Using `F R' F' R` or `S` moves instead of standard `R U R'` orient 2 or 4 top layer edges, guaranteeing a cross OLL (faster and easier).",
        exampleFormula: "F R' F' R (Edge-orienting pair insertion)",
        prerequisites: ["xcross"],
        recommendedDrills: [
          "Zero Dot OLL Challenge: Complete 100 solves without encountering any Dot OLL.",
        ],
        masteryPercentage: 88,
        x: 580,
        y: 360,
      },
      {
        id: "winter-variation",
        title: "Winter Variation (WV)",
        subtitle: "Insert last slot while orienting all corners (OLL Skip)",
        category: "edge-control",
        tier: "Elite",
        status: "in-progress",
        xpReward: 750,
        description: "When the top cross is completed and the F2L pair is joined, solve all OLL corners during insertion.",
        theory: "A set of 27 algorithms that insert the final F2L pair while simultaneously orienting the 4 top corners, skipping OLL entirely.",
        exampleFormula: "R U2 R' U' R U' R' (WV Case 1)",
        prerequisites: ["eo-f2l"],
        recommendedDrills: [
          "WV 27 Algorithm Trainer Set.",
        ],
        masteryPercentage: 55,
        x: 820,
        y: 360,
      },
      {
        id: "vls",
        title: "Valk Last Slot (VLS)",
        subtitle: "1-step OLL resolution with unoriented edges",
        category: "edge-control",
        tier: "Elite",
        status: "locked",
        xpReward: 950,
        description: "Insert the last F2L slot and solve OLL simultaneously regardless of edge orientation.",
        theory: "Super-extension of Winter Variation covering cases where top layer edges are not oriented prior to slot insertion.",
        exampleFormula: "F R U R' U' F' + R U R'",
        prerequisites: ["winter-variation"],
        recommendedDrills: [
          "VLS Recognition Flashcards.",
        ],
        masteryPercentage: 20,
        x: 1060,
        y: 360,
      },
    ],
  },
  {
    id: "coll",
    name: "IV. Last Layer Algorithmic Mastery",
    subtitle: "High-density algorithmic sets for 2-look and 1-look Last Layer reduction",
    color: "#a855f7",
    nodes: [
      {
        id: "full-oll-pll",
        title: "Full OLL (57) & Full PLL (21)",
        subtitle: "Core 78-algorithm foundation for 2-step Last Layer",
        category: "coll",
        tier: "Fundamental",
        status: "unlocked",
        xpReward: 800,
        description: "Instant visual recognition and sub-1s execution of all 57 OLLs and 21 PLLs.",
        theory: "Allows solving the entire top layer in exactly 2 algorithms regardless of scramble permutation.",
        exampleFormula: "PLL T-Perm: R U R' U' R' F R2 U' R' U' R U R' F'",
        prerequisites: [],
        recommendedDrills: [
          "PLL Time Attack: Execute all 21 PLLs back-to-back under 35 seconds.",
        ],
        masteryPercentage: 100,
        x: 100,
        y: 480,
      },
      {
        id: "coll-set",
        title: "COLL (Corners of Last Layer)",
        subtitle: "Orient and permute corners when the top cross is ready",
        category: "coll",
        tier: "Advanced",
        status: "unlocked",
        xpReward: 700,
        description: "Solve corner orientation and permutation in 1 algorithm, leaving only edge PLLs (Ua, Ub, H, Z) or PLL Skip.",
        theory: "Comprises 40 algorithms grouped by corner orientation (H, Pi, U, T, L, S, As). Reduces PLL possibilities to 4 ultra-fast edge cases.",
        exampleFormula: "COLL H-Case: F (R U R' U')3 F'",
        prerequisites: ["full-oll-pll"],
        recommendedDrills: [
          "COLL Recognition Drill by Headlight Colors.",
        ],
        masteryPercentage: 80,
        x: 340,
        y: 480,
      },
    ],
  },
  {
    id: "zbll",
    name: "V. ZBLL & Master Sets",
    subtitle: "1-look Last Layer resolution across 472 distinct cases",
    color: "#ec4899",
    nodes: [
      {
        id: "zbll-main",
        title: "ZBLL (Zborowski-Bruchem Last Layer)",
        subtitle: "Complete 1-step Last Layer resolution (472 Cases)",
        category: "zbll",
        tier: "Master",
        status: "in-progress",
        xpReward: 2500,
        description: "The supreme algorithm set: solves OLL and PLL simultaneously when top edges are oriented.",
        theory: "Divided into ZBLL T, U, L, H, Pi, S, As sets. Completely removes the PLL step, achieving sub-0.9s Last Layer solves.",
        exampleFormula: "ZBLL U-1: R U2 R' U' R U' R' U2 R U R' U R U2 R'",
        prerequisites: ["coll-set", "eo-f2l"],
        recommendedDrills: [
          "ZBLL U-Set Mastery (72 cases).",
          "ZBLL Recognition Speed Trainer.",
        ],
        masteryPercentage: 35,
        x: 580,
        y: 520,
      },
      {
        id: "forced-pll-skip",
        title: "Forced PLL Skips (OLLCP Setups)",
        subtitle: "Manipulating corner permutation to force 100% PLL Skip",
        category: "zbll",
        tier: "Master",
        status: "locked",
        xpReward: 1500,
        description: "Select the exact OLL variant that permutes top corners correctly.",
        theory: "By recognizing corner permutation before executing OLL, an OLLCP (OLL with Corner Permutation) algorithm is selected. If edges match, a direct PLL skip occurs.",
        exampleFormula: "OLLCP Case 23: R U2 R' U' R U R' U' R U' R'",
        prerequisites: ["coll-set", "full-oll-pll"],
        recommendedDrills: [
          "PLL Skip Rate Optimization Drill.",
        ],
        masteryPercentage: 5,
        x: 820,
        y: 520,
      },
    ],
  },
  {
    id: "ergonomics",
    name: "VI. Ergonomics & Blindfolded (3-Style)",
    subtitle: "Continuous lookahead, color neutrality, and 3-cycle blindfolded commutators",
    color: "#10b981",
    nodes: [
      {
        id: "zero-pause",
        title: "Zero-Pause Lookahead",
        subtitle: "Continuous piece tracking without visual pauses between F2L slots",
        category: "ergonomics",
        tier: "Advanced",
        status: "unlocked",
        xpReward: 650,
        description: "Maintain a steady TPS while keeping eyes fixed on the next pair during current pair insertion.",
        theory: "Overall CFOP speed depends more on eliminating pauses between steps than raw max TPS. Practiced with a metronome at 3-4 TPS for zero hesitation.",
        exampleFormula: "Metronome Pacing at 3.5 TPS without visual pauses",
        prerequisites: [],
        recommendedDrills: [
          "Slow Turning Practice with Metronome.",
        ],
        masteryPercentage: 90,
        x: 100,
        y: 650,
      },
      {
        id: "color-neutrality",
        title: "Full Color Neutrality (6 Faces)",
        subtitle: "Ability to start cross on any face based on scramble quality",
        category: "ergonomics",
        tier: "Elite",
        status: "in-progress",
        xpReward: 900,
        description: "Inspect and solve starting on White, Yellow, Red, Orange, Blue, or Green without hesitation.",
        theory: "Increases the probability of finding easy 3-4 move crosses or direct XCrosses from 5% to over 70% per scramble.",
        exampleFormula: "Inspection choice: Start on Green Face (3-move cross)",
        prerequisites: ["cross-plus-one"],
        recommendedDrills: [
          "Non-White Cross Session (50 solves).",
        ],
        masteryPercentage: 70,
        x: 340,
        y: 650,
      },
      {
        id: "three-style",
        title: "3-Style Commutators (Blindfolded 3x3)",
        subtitle: "Pure 3-cycle commutators for 3BLD execution",
        category: "ergonomics",
        tier: "Master",
        status: "locked",
        xpReward: 2000,
        description: "Cycle 3 specific edges or corners using A B A' B' commutator formulas without disturbing the rest of the cube.",
        theory: "The fastest method for 3x3 Blindfolded (3BLD). Solves memoized letter pairs in single 8-10 turn execution sequences under 10 seconds total.",
        exampleFormula: "[R U R', D2] = R U R' D2 R U' R' D2",
        prerequisites: ["zero-pause"],
        recommendedDrills: [
          "3-Style Edge Commutators Set (440 letter pairs).",
        ],
        masteryPercentage: 10,
        x: 580,
        y: 650,
      },
    ],
  },
];

export const ALL_SKILL_NODES: SkillNode[] = SKILL_BRANCHES.flatMap((b) => b.nodes);
