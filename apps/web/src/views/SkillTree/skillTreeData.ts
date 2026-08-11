import { calculateAutoLayout } from "./skillTreeLayout";
import type { ParseKeys } from "i18next";

export interface SkillNode {
  id: string;
  titleKey: ParseKeys<"skillTree">;
  subtitleKey: ParseKeys<"skillTree">;
  category:
    | "fundamentals" | "cross" | "f2l" | "last-layer" | "lookahead"
    | "finger-tricks" | "inspection" | "color-neutrality" | "hardware"
    | "psychology" | "training" | "roux" | "zz" | "blindfold" | "fmc" | "theory";
  tier: "Beginner" | "Novice" | "Intermediate" | "Advanced" | "Expert" | "Master" | "Elite" | "Legendary";
  status: "unlocked" | "completed" | "locked";
  xpReward: number;
  descriptionKey: ParseKeys<"skillTree">;
  theoryKey: ParseKeys<"skillTree">;
  exampleFormulaKey?: ParseKeys<"skillTree">;
  prerequisites: string[];
  drillsKey: string;
  masteryPercentage: number;
  iconName?: string;
  parentId?: string;
  x: number;
  y: number;
}

export interface SkillBranch {
  id: string; nameKey: ParseKeys<"skillTree">; subtitleKey: ParseKeys<"skillTree">; color: string; nodes: SkillNode[];
}

// ─── Coordinate system ───────────────────────────────────────────
// Dynamically calculated using calculateAutoLayout (Industry Standard Layered DAG)
// Spacing: X (230px per branch), Y (190px per tier with topological offset)

const RAW_SKILL_BRANCHES: SkillBranch[] = [

  // ═══════════════════════════════════════════════════════════════
  // BRANCH 1: FUNDAMENTALS
  // ═══════════════════════════════════════════════════════════════
  {
    id: "fundamentals", nameKey:"branch.fundamentals.name",
    subtitleKey:"branch.fundamentals.subtitle",
    color: "#6366f1",
    nodes: [
      { id:"cube-anatomy",titleKey:"nodes.cube-anatomy.title",subtitleKey:"nodes.cube-anatomy.subtitle",category:"fundamentals",tier:"Beginner",status:"unlocked",xpReward:50,descriptionKey:"nodes.cube-anatomy.description",theoryKey:"nodes.cube-anatomy.theory",prerequisites:[],drillsKey:"nodes.cube-anatomy.drills",masteryPercentage:0,iconName:"Box",x:50,y:30 },
      { id:"standard-notation",titleKey:"nodes.standard-notation.title",subtitleKey:"nodes.standard-notation.subtitle",category:"fundamentals",tier:"Beginner",status:"unlocked",xpReward:50,descriptionKey:"nodes.standard-notation.description",theoryKey:"nodes.standard-notation.theory",exampleFormulaKey:"nodes.standard-notation.exampleFormula",prerequisites:["cube-anatomy"],parentId:"cube-anatomy",drillsKey:"nodes.standard-notation.drills",masteryPercentage:0,iconName:"BookOpen",x:50,y:90 },
      { id:"first-cross",titleKey:"nodes.first-cross.title",subtitleKey:"nodes.first-cross.subtitle",category:"fundamentals",tier:"Beginner",status:"unlocked",xpReward:75,descriptionKey:"nodes.first-cross.description",theoryKey:"nodes.first-cross.theory",prerequisites:["standard-notation"],parentId:"standard-notation",drillsKey:"nodes.first-cross.drills",masteryPercentage:0,iconName:"Crosshair",x:50,y:150 },
      { id:"first-layer-corners",titleKey:"nodes.first-layer-corners.title",subtitleKey:"nodes.first-layer-corners.subtitle",category:"fundamentals",tier:"Beginner",status:"unlocked",xpReward:75,descriptionKey:"nodes.first-layer-corners.description",theoryKey:"nodes.first-layer-corners.theory",exampleFormulaKey:"nodes.first-layer-corners.exampleFormula",prerequisites:["first-cross"],parentId:"first-cross",drillsKey:"nodes.first-layer-corners.drills",masteryPercentage:0,iconName:"Pyramid",x:50,y:210 },
      { id:"middle-layer-edges",titleKey:"nodes.middle-layer-edges.title",subtitleKey:"nodes.middle-layer-edges.subtitle",category:"fundamentals",tier:"Beginner",status:"locked",xpReward:75,descriptionKey:"nodes.middle-layer-edges.description",theoryKey:"nodes.middle-layer-edges.theory",exampleFormulaKey:"nodes.middle-layer-edges.exampleFormula",prerequisites:["first-layer-corners"],parentId:"first-layer-corners",drillsKey:"nodes.middle-layer-edges.drills",masteryPercentage:0,iconName:"Layers",x:50,y:270 },
      { id:"beginner-last-layer",titleKey:"nodes.beginner-last-layer.title",subtitleKey:"nodes.beginner-last-layer.subtitle",category:"fundamentals",tier:"Beginner",status:"locked",xpReward:100,descriptionKey:"nodes.beginner-last-layer.description",theoryKey:"nodes.beginner-last-layer.theory",exampleFormulaKey:"nodes.beginner-last-layer.exampleFormula",prerequisites:["middle-layer-edges"],parentId:"middle-layer-edges",drillsKey:"nodes.beginner-last-layer.drills",masteryPercentage:0,iconName:"Star",x:50,y:330 },
      { id:"first-complete-solve",titleKey:"nodes.first-complete-solve.title",subtitleKey:"nodes.first-complete-solve.subtitle",category:"fundamentals",tier:"Beginner",status:"locked",xpReward:150,descriptionKey:"nodes.first-complete-solve.description",theoryKey:"nodes.first-complete-solve.theory",prerequisites:["beginner-last-layer"],parentId:"beginner-last-layer",drillsKey:"nodes.first-complete-solve.drills",masteryPercentage:0,iconName:"Trophy",x:50,y:390 },
      { id:"consistent-solving",titleKey:"nodes.consistent-solving.title",subtitleKey:"nodes.consistent-solving.subtitle",category:"fundamentals",tier:"Novice",status:"locked",xpReward:100,descriptionKey:"nodes.consistent-solving.description",theoryKey:"nodes.consistent-solving.theory",prerequisites:["first-complete-solve"],parentId:"first-complete-solve",drillsKey:"nodes.consistent-solving.drills",masteryPercentage:0,iconName:"Repeat",x:50,y:450 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 2: CROSS
  // ═══════════════════════════════════════════════════════════════
  {
    id: "cross", nameKey:"branch.cross.name",
    subtitleKey:"branch.cross.subtitle",
    color: "#3b82f6",
    nodes: [
      { id:"cross-on-bottom",titleKey:"nodes.cross-on-bottom.title",subtitleKey:"nodes.cross-on-bottom.subtitle",category:"cross",tier:"Novice",status:"locked",xpReward:100,descriptionKey:"nodes.cross-on-bottom.description",theoryKey:"nodes.cross-on-bottom.theory",prerequisites:["consistent-solving"],parentId:"consistent-solving",drillsKey:"nodes.cross-on-bottom.drills",masteryPercentage:0,iconName:"ArrowDown",x:220,y:310 },
      { id:"cross-efficiency-8",titleKey:"nodes.cross-efficiency-8.title",subtitleKey:"nodes.cross-efficiency-8.subtitle",category:"cross",tier:"Intermediate",status:"locked",xpReward:150,descriptionKey:"nodes.cross-efficiency-8.description",theoryKey:"nodes.cross-efficiency-8.theory",prerequisites:["cross-on-bottom"],parentId:"cross-on-bottom",drillsKey:"nodes.cross-efficiency-8.drills",masteryPercentage:0,iconName:"Gauge",x:220,y:510 },
      { id:"pair-preservation",titleKey:"nodes.pair-preservation.title",subtitleKey:"nodes.pair-preservation.subtitle",category:"cross",tier:"Advanced",status:"locked",xpReward:150,descriptionKey:"nodes.pair-preservation.description",theoryKey:"nodes.pair-preservation.theory",prerequisites:["cross-efficiency-8"],parentId:"cross-efficiency-8",drillsKey:"nodes.pair-preservation.drills",masteryPercentage:0,iconName:"ShieldAlert",x:220,y:570 },
      { id:"blind-cross",titleKey:"nodes.blind-cross.title",subtitleKey:"nodes.blind-cross.subtitle",category:"cross",tier:"Intermediate",status:"locked",xpReward:150,descriptionKey:"nodes.blind-cross.description",theoryKey:"nodes.blind-cross.theory",prerequisites:["cross-efficiency-8"],parentId:"cross-efficiency-8",drillsKey:"nodes.blind-cross.drills",masteryPercentage:0,iconName:"EyeOff",x:220,y:610 },
      { id:"cross-planning",titleKey:"nodes.cross-planning.title",subtitleKey:"nodes.cross-planning.subtitle",category:"cross",tier:"Advanced",status:"locked",xpReward:200,descriptionKey:"nodes.cross-planning.description",theoryKey:"nodes.cross-planning.theory",prerequisites:["blind-cross"],parentId:"blind-cross",drillsKey:"nodes.cross-planning.drills",masteryPercentage:0,iconName:"Timer",x:220,y:760 },
      { id:"optimal-cross",titleKey:"nodes.optimal-cross.title",subtitleKey:"nodes.optimal-cross.subtitle",category:"cross",tier:"Advanced",status:"locked",xpReward:200,descriptionKey:"nodes.optimal-cross.description",theoryKey:"nodes.optimal-cross.theory",prerequisites:["cross-planning"],parentId:"cross-planning",drillsKey:"nodes.optimal-cross.drills",masteryPercentage:0,iconName:"Compass",x:220,y:860 },
      { id:"xcross-basics",titleKey:"nodes.xcross-basics.title",subtitleKey:"nodes.xcross-basics.subtitle",category:"cross",tier:"Expert",status:"locked",xpReward:350,descriptionKey:"nodes.xcross-basics.description",theoryKey:"nodes.xcross-basics.theory",exampleFormulaKey:"nodes.xcross-basics.exampleFormula",prerequisites:["optimal-cross"],parentId:"optimal-cross",drillsKey:"nodes.xcross-basics.drills",masteryPercentage:0,iconName:"GitMerge",x:220,y:1060 },
      { id:"xcross-mastery",titleKey:"nodes.xcross-mastery.title",subtitleKey:"nodes.xcross-mastery.subtitle",category:"cross",tier:"Master",status:"locked",xpReward:600,descriptionKey:"nodes.xcross-mastery.description",theoryKey:"nodes.xcross-mastery.theory",prerequisites:["xcross-basics"],parentId:"xcross-basics",drillsKey:"nodes.xcross-mastery.drills",masteryPercentage:0,iconName:"Workflow",x:220,y:1310 },
      { id:"cross-plus-two",titleKey:"nodes.cross-plus-two.title",subtitleKey:"nodes.cross-plus-two.subtitle",category:"cross",tier:"Elite",status:"locked",xpReward:900,descriptionKey:"nodes.cross-plus-two.description",theoryKey:"nodes.cross-plus-two.theory",prerequisites:["xcross-mastery","predictive-tracking"],parentId:"xcross-mastery",drillsKey:"nodes.cross-plus-two.drills",masteryPercentage:0,iconName:"SplitSquareVertical",x:220,y:1560 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 3: F2L
  // ═══════════════════════════════════════════════════════════════
  {
    id: "f2l", nameKey:"branch.f2l.name",
    subtitleKey:"branch.f2l.subtitle",
    color: "#06b6d4",
    nodes: [
      { id:"intuitive-f2l-basics",titleKey:"nodes.intuitive-f2l-basics.title",subtitleKey:"nodes.intuitive-f2l-basics.subtitle",category:"f2l",tier:"Novice",status:"locked",xpReward:150,descriptionKey:"nodes.intuitive-f2l-basics.description",theoryKey:"nodes.intuitive-f2l-basics.theory",prerequisites:["consistent-solving","cross-on-bottom"],parentId:"cross-on-bottom",drillsKey:"nodes.intuitive-f2l-basics.drills",masteryPercentage:0,iconName:"GitBranch",x:390,y:310 },
      { id:"f2l-case-recognition",titleKey:"nodes.f2l-case-recognition.title",subtitleKey:"nodes.f2l-case-recognition.subtitle",category:"f2l",tier:"Intermediate",status:"locked",xpReward:200,descriptionKey:"nodes.f2l-case-recognition.description",theoryKey:"nodes.f2l-case-recognition.theory",prerequisites:["intuitive-f2l-basics"],parentId:"intuitive-f2l-basics",drillsKey:"nodes.f2l-case-recognition.drills",masteryPercentage:0,iconName:"ScanEye",x:390,y:510 },
      { id:"algorithmic-f2l",titleKey:"nodes.algorithmic-f2l.title",subtitleKey:"nodes.algorithmic-f2l.subtitle",category:"f2l",tier:"Intermediate",status:"locked",xpReward:200,descriptionKey:"nodes.algorithmic-f2l.description",theoryKey:"nodes.algorithmic-f2l.theory",prerequisites:["f2l-case-recognition"],parentId:"f2l-case-recognition",drillsKey:"nodes.algorithmic-f2l.drills",masteryPercentage:0,iconName:"Code2",x:390,y:610 },
      { id:"back-slot-f2l",titleKey:"nodes.back-slot-f2l.title",subtitleKey:"nodes.back-slot-f2l.subtitle",category:"f2l",tier:"Advanced",status:"locked",xpReward:200,descriptionKey:"nodes.back-slot-f2l.description",theoryKey:"nodes.back-slot-f2l.theory",prerequisites:["algorithmic-f2l"],parentId:"algorithmic-f2l",drillsKey:"nodes.back-slot-f2l.drills",masteryPercentage:0,iconName:"ArrowUpLeft",x:390,y:760 },
      { id:"sledgehammer-hedgeslammer",titleKey:"nodes.sledgehammer-hedgeslammer.title",subtitleKey:"nodes.sledgehammer-hedgeslammer.subtitle",category:"f2l",tier:"Advanced",status:"locked",xpReward:150,descriptionKey:"nodes.sledgehammer-hedgeslammer.description",theoryKey:"nodes.sledgehammer-hedgeslammer.theory",exampleFormulaKey:"nodes.sledgehammer-hedgeslammer.exampleFormula",prerequisites:["back-slot-f2l"],parentId:"back-slot-f2l",drillsKey:"nodes.sledgehammer-hedgeslammer.drills",masteryPercentage:0,iconName:"Swords",x:390,y:860 },
      { id:"rotationless-f2l",titleKey:"nodes.rotationless-f2l.title",subtitleKey:"nodes.rotationless-f2l.subtitle",category:"f2l",tier:"Expert",status:"locked",xpReward:350,descriptionKey:"nodes.rotationless-f2l.description",theoryKey:"nodes.rotationless-f2l.theory",prerequisites:["sledgehammer-hedgeslammer"],parentId:"sledgehammer-hedgeslammer",drillsKey:"nodes.rotationless-f2l.drills",masteryPercentage:0,iconName:"RotateCcw",x:390,y:980 },
      { id:"keyhole-technique",titleKey:"nodes.keyhole-technique.title",subtitleKey:"nodes.keyhole-technique.subtitle",category:"f2l",tier:"Expert",status:"locked",xpReward:300,descriptionKey:"nodes.keyhole-technique.description",theoryKey:"nodes.keyhole-technique.theory",exampleFormulaKey:"nodes.keyhole-technique.exampleFormula",prerequisites:["rotationless-f2l"],parentId:"rotationless-f2l",drillsKey:"nodes.keyhole-technique.drills",masteryPercentage:0,iconName:"Key",x:390,y:1060 },
      { id:"edge-control-f2l",titleKey:"nodes.edge-control-f2l.title",subtitleKey:"nodes.edge-control-f2l.subtitle",category:"f2l",tier:"Expert",status:"locked",xpReward:300,descriptionKey:"nodes.edge-control-f2l.description",theoryKey:"nodes.edge-control-f2l.theory",exampleFormulaKey:"nodes.edge-control-f2l.exampleFormula",prerequisites:["sledgehammer-hedgeslammer"],parentId:"sledgehammer-hedgeslammer",drillsKey:"nodes.edge-control-f2l.drills",masteryPercentage:0,iconName:"Zap",x:390,y:1140 },
      { id:"zbls-set",titleKey:"nodes.zbls-set.title",subtitleKey:"nodes.zbls-set.subtitle",category:"f2l",tier:"Expert",status:"locked",xpReward:450,descriptionKey:"nodes.zbls-set.description",theoryKey:"nodes.zbls-set.theory",prerequisites:["edge-control-f2l"],parentId:"edge-control-f2l",drillsKey:"nodes.zbls-set.drills",masteryPercentage:0,iconName:"Combine",x:390,y:1200 },
      { id:"multislotting",titleKey:"nodes.multislotting.title",subtitleKey:"nodes.multislotting.subtitle",category:"f2l",tier:"Master",status:"locked",xpReward:600,descriptionKey:"nodes.multislotting.description",theoryKey:"nodes.multislotting.theory",exampleFormulaKey:"nodes.multislotting.exampleFormula",prerequisites:["keyhole-technique","edge-control-f2l"],parentId:"keyhole-technique",drillsKey:"nodes.multislotting.drills",masteryPercentage:0,iconName:"Grid3x3",x:390,y:1260 },
      { id:"pseudo-slotting",titleKey:"nodes.pseudo-slotting.title",subtitleKey:"nodes.pseudo-slotting.subtitle",category:"f2l",tier:"Master",status:"locked",xpReward:700,descriptionKey:"nodes.pseudo-slotting.description",theoryKey:"nodes.pseudo-slotting.theory",exampleFormulaKey:"nodes.pseudo-slotting.exampleFormula",prerequisites:["multislotting"],parentId:"multislotting",drillsKey:"nodes.pseudo-slotting.drills",masteryPercentage:0,iconName:"Move3d",x:390,y:1360 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 4: LAST LAYER
  // ═══════════════════════════════════════════════════════════════
  {
    id: "last-layer", nameKey:"branch.last-layer.name",
    subtitleKey:"branch.last-layer.subtitle",
    color: "#a855f7",
    nodes: [
      { id:"two-look-oll",titleKey:"nodes.two-look-oll.title",subtitleKey:"nodes.two-look-oll.subtitle",category:"last-layer",tier:"Novice",status:"locked",xpReward:150,descriptionKey:"nodes.two-look-oll.description",theoryKey:"nodes.two-look-oll.theory",exampleFormulaKey:"nodes.two-look-oll.exampleFormula",prerequisites:["consistent-solving"],parentId:"consistent-solving",drillsKey:"nodes.two-look-oll.drills",masteryPercentage:0,iconName:"LayoutList",x:560,y:260 },
      { id:"two-look-pll",titleKey:"nodes.two-look-pll.title",subtitleKey:"nodes.two-look-pll.subtitle",category:"last-layer",tier:"Novice",status:"locked",xpReward:150,descriptionKey:"nodes.two-look-pll.description",theoryKey:"nodes.two-look-pll.theory",exampleFormulaKey:"nodes.two-look-pll.exampleFormula",prerequisites:["consistent-solving"],parentId:"two-look-oll",drillsKey:"nodes.two-look-pll.drills",masteryPercentage:0,iconName:"Shuffle",x:560,y:360 },
      { id:"full-pll",titleKey:"nodes.full-pll.title",subtitleKey:"nodes.full-pll.subtitle",category:"last-layer",tier:"Intermediate",status:"locked",xpReward:400,descriptionKey:"nodes.full-pll.description",theoryKey:"nodes.full-pll.theory",exampleFormulaKey:"nodes.full-pll.exampleFormula",prerequisites:["two-look-pll"],parentId:"two-look-pll",drillsKey:"nodes.full-pll.drills",masteryPercentage:0,iconName:"Grid",x:560,y:560 },
      { id:"two-sided-pll-recog",titleKey:"nodes.two-sided-pll-recog.title",subtitleKey:"nodes.two-sided-pll-recog.subtitle",category:"last-layer",tier:"Advanced",status:"locked",xpReward:250,descriptionKey:"nodes.two-sided-pll-recog.description",theoryKey:"nodes.two-sided-pll-recog.theory",prerequisites:["full-pll"],parentId:"full-pll",drillsKey:"nodes.two-sided-pll-recog.drills",masteryPercentage:0,iconName:"Eye",x:560,y:730 },
      { id:"auf-prediction",titleKey:"nodes.auf-prediction.title",subtitleKey:"nodes.auf-prediction.subtitle",category:"last-layer",tier:"Advanced",status:"locked",xpReward:200,descriptionKey:"nodes.auf-prediction.description",theoryKey:"nodes.auf-prediction.theory",prerequisites:["two-sided-pll-recog"],parentId:"two-sided-pll-recog",drillsKey:"nodes.auf-prediction.drills",masteryPercentage:0,iconName:"RotateCw",x:560,y:770 },
      { id:"full-oll",titleKey:"nodes.full-oll.title",subtitleKey:"nodes.full-oll.subtitle",category:"last-layer",tier:"Advanced",status:"locked",xpReward:600,descriptionKey:"nodes.full-oll.description",theoryKey:"nodes.full-oll.theory",prerequisites:["two-sided-pll-recog"],parentId:"two-sided-pll-recog",drillsKey:"nodes.full-oll.drills",masteryPercentage:0,iconName:"Cpu",x:560,y:810 },
      { id:"oll-recognition-speed",titleKey:"nodes.oll-recognition-speed.title",subtitleKey:"nodes.oll-recognition-speed.subtitle",category:"last-layer",tier:"Advanced",status:"locked",xpReward:250,descriptionKey:"nodes.oll-recognition-speed.description",theoryKey:"nodes.oll-recognition-speed.theory",prerequisites:["full-oll"],parentId:"full-oll",drillsKey:"nodes.oll-recognition-speed.drills",masteryPercentage:0,iconName:"Zap",x:560,y:890 },
      { id:"coll-set",titleKey:"nodes.coll-set.title",subtitleKey:"nodes.coll-set.subtitle",category:"last-layer",tier:"Expert",status:"locked",xpReward:500,descriptionKey:"nodes.coll-set.description",theoryKey:"nodes.coll-set.theory",exampleFormulaKey:"nodes.coll-set.exampleFormula",prerequisites:["oll-recognition-speed"],parentId:"oll-recognition-speed",drillsKey:"nodes.coll-set.drills",masteryPercentage:0,iconName:"Shield",x:560,y:980 },
      { id:"winter-variation",titleKey:"nodes.winter-variation.title",subtitleKey:"nodes.winter-variation.subtitle",category:"last-layer",tier:"Expert",status:"locked",xpReward:500,descriptionKey:"nodes.winter-variation.description",theoryKey:"nodes.winter-variation.theory",exampleFormulaKey:"nodes.winter-variation.exampleFormula",prerequisites:["edge-control-f2l","coll-set"],parentId:"coll-set",drillsKey:"nodes.winter-variation.drills",masteryPercentage:0,iconName:"Snowflake",x:560,y:1060 },
      { id:"ollcp-basics",titleKey:"nodes.ollcp-basics.title",subtitleKey:"nodes.ollcp-basics.subtitle",category:"last-layer",tier:"Expert",status:"locked",xpReward:700,descriptionKey:"nodes.ollcp-basics.description",theoryKey:"nodes.ollcp-basics.theory",prerequisites:["winter-variation"],parentId:"winter-variation",drillsKey:"nodes.ollcp-basics.drills",masteryPercentage:0,iconName:"Wand2",x:560,y:1140 },
      { id:"vls-basics",titleKey:"nodes.vls-basics.title",subtitleKey:"nodes.vls-basics.subtitle",category:"last-layer",tier:"Master",status:"locked",xpReward:800,descriptionKey:"nodes.vls-basics.description",theoryKey:"nodes.vls-basics.theory",exampleFormulaKey:"nodes.vls-basics.exampleFormula",prerequisites:["ollcp-basics"],parentId:"ollcp-basics",drillsKey:"nodes.vls-basics.drills",masteryPercentage:0,iconName:"Sparkles",x:560,y:1260 },
      { id:"zbll-t-u",titleKey:"nodes.zbll-t-u.title",subtitleKey:"nodes.zbll-t-u.subtitle",category:"last-layer",tier:"Master",status:"locked",xpReward:1200,descriptionKey:"nodes.zbll-t-u.description",theoryKey:"nodes.zbll-t-u.theory",exampleFormulaKey:"nodes.zbll-t-u.exampleFormula",prerequisites:["ollcp-basics","coll-set"],parentId:"ollcp-basics",drillsKey:"nodes.zbll-t-u.drills",masteryPercentage:0,iconName:"Crown",x:560,y:1360 },
      { id:"full-zbll",titleKey:"nodes.full-zbll.title",subtitleKey:"nodes.full-zbll.subtitle",category:"last-layer",tier:"Legendary",status:"locked",xpReward:2500,descriptionKey:"nodes.full-zbll.description",theoryKey:"nodes.full-zbll.theory",prerequisites:["zbll-t-u"],parentId:"zbll-t-u",drillsKey:"nodes.full-zbll.drills",masteryPercentage:0,iconName:"Gem",x:560,y:1810 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 5: LOOKAHEAD
  // ═══════════════════════════════════════════════════════════════
  {
    id: "lookahead", nameKey:"branch.lookahead.name",
    subtitleKey:"branch.lookahead.subtitle",
    color: "#f59e0b",
    nodes: [
      { id:"basic-lookahead",titleKey:"nodes.basic-lookahead.title",subtitleKey:"nodes.basic-lookahead.subtitle",category:"lookahead",tier:"Intermediate",status:"locked",xpReward:200,descriptionKey:"nodes.basic-lookahead.description",theoryKey:"nodes.basic-lookahead.theory",prerequisites:["f2l-case-recognition"],parentId:"f2l-case-recognition",drillsKey:"nodes.basic-lookahead.drills",masteryPercentage:0,iconName:"Eye",x:730,y:510 },
      { id:"f2l-lookahead",titleKey:"nodes.f2l-lookahead.title",subtitleKey:"nodes.f2l-lookahead.subtitle",category:"lookahead",tier:"Intermediate",status:"locked",xpReward:250,descriptionKey:"nodes.f2l-lookahead.description",theoryKey:"nodes.f2l-lookahead.theory",prerequisites:["basic-lookahead"],parentId:"basic-lookahead",drillsKey:"nodes.f2l-lookahead.drills",masteryPercentage:0,iconName:"Activity",x:730,y:610 },
      { id:"cross-f2l-transition",titleKey:"nodes.cross-f2l-transition.title",subtitleKey:"nodes.cross-f2l-transition.subtitle",category:"lookahead",tier:"Advanced",status:"locked",xpReward:250,descriptionKey:"nodes.cross-f2l-transition.description",theoryKey:"nodes.cross-f2l-transition.theory",prerequisites:["blind-cross","f2l-lookahead"],parentId:"f2l-lookahead",drillsKey:"nodes.cross-f2l-transition.drills",masteryPercentage:0,iconName:"ArrowRightLeft",x:730,y:760 },
      { id:"metronome-pacing",titleKey:"nodes.metronome-pacing.title",subtitleKey:"nodes.metronome-pacing.subtitle",category:"lookahead",tier:"Advanced",status:"locked",xpReward:200,descriptionKey:"nodes.metronome-pacing.description",theoryKey:"nodes.metronome-pacing.theory",prerequisites:["cross-f2l-transition"],parentId:"cross-f2l-transition",drillsKey:"nodes.metronome-pacing.drills",masteryPercentage:0,iconName:"Music",x:730,y:860 },
      { id:"continuous-lookahead",titleKey:"nodes.continuous-lookahead.title",subtitleKey:"nodes.continuous-lookahead.subtitle",category:"lookahead",tier:"Expert",status:"locked",xpReward:400,descriptionKey:"nodes.continuous-lookahead.description",theoryKey:"nodes.continuous-lookahead.theory",prerequisites:["metronome-pacing","oll-recognition-speed"],parentId:"metronome-pacing",drillsKey:"nodes.continuous-lookahead.drills",masteryPercentage:0,iconName:"Infinity",x:730,y:980 },
      { id:"predictive-tracking",titleKey:"nodes.predictive-tracking.title",subtitleKey:"nodes.predictive-tracking.subtitle",category:"lookahead",tier:"Expert",status:"locked",xpReward:450,descriptionKey:"nodes.predictive-tracking.description",theoryKey:"nodes.predictive-tracking.theory",prerequisites:["continuous-lookahead"],parentId:"continuous-lookahead",drillsKey:"nodes.predictive-tracking.drills",masteryPercentage:0,iconName:"Target",x:730,y:1060 },
      { id:"zero-pause-flow",titleKey:"nodes.zero-pause-flow.title",subtitleKey:"nodes.zero-pause-flow.subtitle",category:"lookahead",tier:"Master",status:"locked",xpReward:600,descriptionKey:"nodes.zero-pause-flow.description",theoryKey:"nodes.zero-pause-flow.theory",prerequisites:["predictive-tracking"],parentId:"predictive-tracking",drillsKey:"nodes.zero-pause-flow.drills",masteryPercentage:0,iconName:"Play",x:730,y:1310 },
      { id:"subconscious-recognition",titleKey:"nodes.subconscious-recognition.title",subtitleKey:"nodes.subconscious-recognition.subtitle",category:"lookahead",tier:"Elite",status:"locked",xpReward:800,descriptionKey:"nodes.subconscious-recognition.description",theoryKey:"nodes.subconscious-recognition.theory",prerequisites:["zero-pause-flow","full-oll","full-pll"],parentId:"zero-pause-flow",drillsKey:"nodes.subconscious-recognition.drills",masteryPercentage:0,iconName:"Brain",x:730,y:1560 },
    ],
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 6: FINGER TRICKS
  // ═══════════════════════════════════════════════════════════════
  {
    id:"finger-tricks",nameKey:"branch.finger-tricks.name",subtitleKey:"branch.finger-tricks.subtitle",color:"#10b981",
    nodes:[
      { id:"basic-u-flicks",titleKey:"nodes.basic-u-flicks.title",subtitleKey:"nodes.basic-u-flicks.subtitle",category:"finger-tricks",tier:"Beginner",status:"locked",xpReward:50,descriptionKey:"nodes.basic-u-flicks.description",theoryKey:"nodes.basic-u-flicks.theory",prerequisites:["standard-notation"],parentId:"standard-notation",drillsKey:"nodes.basic-u-flicks.drills",masteryPercentage:0,iconName:"Hand",x:900,y:60},
      { id:"r-moves-proper",titleKey:"nodes.r-moves-proper.title",subtitleKey:"nodes.r-moves-proper.subtitle",category:"finger-tricks",tier:"Novice",status:"locked",xpReward:100,descriptionKey:"nodes.r-moves-proper.description",theoryKey:"nodes.r-moves-proper.theory",prerequisites:["basic-u-flicks"],parentId:"basic-u-flicks",drillsKey:"nodes.r-moves-proper.drills",masteryPercentage:0,iconName:"MoveRight",x:900,y:310},
      { id:"f-move-ergonomics",titleKey:"nodes.f-move-ergonomics.title",subtitleKey:"nodes.f-move-ergonomics.subtitle",category:"finger-tricks",tier:"Intermediate",status:"locked",xpReward:120,descriptionKey:"nodes.f-move-ergonomics.description",theoryKey:"nodes.f-move-ergonomics.theory",prerequisites:["r-moves-proper"],parentId:"r-moves-proper",drillsKey:"nodes.f-move-ergonomics.drills",masteryPercentage:0,iconName:"Pointer",x:900,y:380},
      { id:"double-flicks-u2",titleKey:"nodes.double-flicks-u2.title",subtitleKey:"nodes.double-flicks-u2.subtitle",category:"finger-tricks",tier:"Intermediate",status:"locked",xpReward:150,descriptionKey:"nodes.double-flicks-u2.description",theoryKey:"nodes.double-flicks-u2.theory",prerequisites:["r-moves-proper"],parentId:"r-moves-proper",drillsKey:"nodes.double-flicks-u2.drills",masteryPercentage:0,iconName:"ChevronsRight",x:900,y:480},
      { id:"d-moves-ring",titleKey:"nodes.d-moves-ring.title",subtitleKey:"nodes.d-moves-ring.subtitle",category:"finger-tricks",tier:"Intermediate",status:"locked",xpReward:150,descriptionKey:"nodes.d-moves-ring.description",theoryKey:"nodes.d-moves-ring.theory",prerequisites:["double-flicks-u2"],parentId:"double-flicks-u2",drillsKey:"nodes.d-moves-ring.drills",masteryPercentage:0,iconName:"ChevronsDown",x:900,y:560},
      { id:"m-slice-basics",titleKey:"nodes.m-slice-basics.title",subtitleKey:"nodes.m-slice-basics.subtitle",category:"finger-tricks",tier:"Intermediate",status:"locked",xpReward:100,descriptionKey:"nodes.m-slice-basics.description",theoryKey:"nodes.m-slice-basics.theory",prerequisites:["d-moves-ring"],parentId:"d-moves-ring",drillsKey:"nodes.m-slice-basics.drills",masteryPercentage:0,iconName:"AlignCenter",x:900,y:640},
      { id:"advanced-finger-tricks",titleKey:"nodes.advanced-finger-tricks.title",subtitleKey:"nodes.advanced-finger-tricks.subtitle",category:"finger-tricks",tier:"Advanced",status:"locked",xpReward:250,descriptionKey:"nodes.advanced-finger-tricks.description",theoryKey:"nodes.advanced-finger-tricks.theory",prerequisites:["m-slice-basics"],parentId:"m-slice-basics",drillsKey:"nodes.advanced-finger-tricks.drills",masteryPercentage:0,iconName:"Move",x:900,y:760},
      { id:"regrip-minimization",titleKey:"nodes.regrip-minimization.title",subtitleKey:"nodes.regrip-minimization.subtitle",category:"finger-tricks",tier:"Advanced",status:"locked",xpReward:300,descriptionKey:"nodes.regrip-minimization.description",theoryKey:"nodes.regrip-minimization.theory",prerequisites:["advanced-finger-tricks"],parentId:"advanced-finger-tricks",drillsKey:"nodes.regrip-minimization.drills",masteryPercentage:0,iconName:"MousePointerClick",x:900,y:860},
      { id:"peak-tps-execution",titleKey:"nodes.peak-tps-execution.title",subtitleKey:"nodes.peak-tps-execution.subtitle",category:"finger-tricks",tier:"Elite",status:"locked",xpReward:700,descriptionKey:"nodes.peak-tps-execution.description",theoryKey:"nodes.peak-tps-execution.theory",prerequisites:["regrip-minimization"],parentId:"regrip-minimization",drillsKey:"nodes.peak-tps-execution.drills",masteryPercentage:0,iconName:"Gauge",x:900,y:1560},
    ]
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 7: INSPECTION
  // ═══════════════════════════════════════════════════════════════
  {
    id:"inspection",nameKey:"branch.inspection.name",subtitleKey:"branch.inspection.subtitle",color:"#ec4899",
    nodes:[
      { id:"inspection-basics",titleKey:"nodes.inspection-basics.title",subtitleKey:"nodes.inspection-basics.subtitle",category:"inspection",tier:"Novice",status:"locked",xpReward:100,descriptionKey:"nodes.inspection-basics.description",theoryKey:"nodes.inspection-basics.theory",prerequisites:["cross-on-bottom"],parentId:"cross-on-bottom",drillsKey:"nodes.inspection-basics.drills",masteryPercentage:0,iconName:"Search",x:1070,y:310},
      { id:"cross-planning-inspect",titleKey:"nodes.cross-planning-inspect.title",subtitleKey:"nodes.cross-planning-inspect.subtitle",category:"inspection",tier:"Intermediate",status:"locked",xpReward:200,descriptionKey:"nodes.cross-planning-inspect.description",theoryKey:"nodes.cross-planning-inspect.theory",prerequisites:["inspection-basics","cross-efficiency-8"],parentId:"inspection-basics",drillsKey:"nodes.cross-planning-inspect.drills",masteryPercentage:0,iconName:"BrainCircuit",x:1070,y:560},
      { id:"full-inspection-15s",titleKey:"nodes.full-inspection-15s.title",subtitleKey:"nodes.full-inspection-15s.subtitle",category:"inspection",tier:"Advanced",status:"locked",xpReward:250,descriptionKey:"nodes.full-inspection-15s.description",theoryKey:"nodes.full-inspection-15s.theory",prerequisites:["cross-planning-inspect"],parentId:"cross-planning-inspect",drillsKey:"nodes.full-inspection-15s.drills",masteryPercentage:0,iconName:"Timer",x:1070,y:810},
      { id:"cross-one-inspect",titleKey:"nodes.cross-one-inspect.title",subtitleKey:"nodes.cross-one-inspect.subtitle",category:"inspection",tier:"Expert",status:"locked",xpReward:400,descriptionKey:"nodes.cross-one-inspect.description",theoryKey:"nodes.cross-one-inspect.theory",prerequisites:["full-inspection-15s","cross-f2l-transition"],parentId:"full-inspection-15s",drillsKey:"nodes.cross-one-inspect.drills",masteryPercentage:0,iconName:"Crosshair",x:1070,y:1010},
      { id:"pair-prediction",titleKey:"nodes.pair-prediction.title",subtitleKey:"nodes.pair-prediction.subtitle",category:"inspection",tier:"Expert",status:"locked",xpReward:450,descriptionKey:"nodes.pair-prediction.description",theoryKey:"nodes.pair-prediction.theory",prerequisites:["cross-one-inspect","predictive-tracking"],parentId:"cross-one-inspect",drillsKey:"nodes.pair-prediction.drills",masteryPercentage:0,iconName:"Scan",x:1070,y:1110},
      { id:"multi-solution-compare",titleKey:"nodes.multi-solution-compare.title",subtitleKey:"nodes.multi-solution-compare.subtitle",category:"inspection",tier:"Master",status:"locked",xpReward:500,descriptionKey:"nodes.multi-solution-compare.description",theoryKey:"nodes.multi-solution-compare.theory",prerequisites:["pair-prediction","optimal-cross"],parentId:"pair-prediction",drillsKey:"nodes.multi-solution-compare.drills",masteryPercentage:0,iconName:"GitCompare",x:1070,y:1310},
      { id:"full-solve-planning",titleKey:"nodes.full-solve-planning.title",subtitleKey:"nodes.full-solve-planning.subtitle",category:"inspection",tier:"Elite",status:"locked",xpReward:800,descriptionKey:"nodes.full-solve-planning.description",theoryKey:"nodes.full-solve-planning.theory",prerequisites:["multi-solution-compare"],parentId:"multi-solution-compare",drillsKey:"nodes.full-solve-planning.drills",masteryPercentage:0,iconName:"MapIcon",x:1070,y:1560},
    ]
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 8: COLOR NEUTRALITY
  // ═══════════════════════════════════════════════════════════════
  {
    id:"color-neutrality",nameKey:"branch.color-neutrality.name",subtitleKey:"branch.color-neutrality.subtitle",color:"#14b8a6",
    nodes:[
      { id:"single-cross-mastery",titleKey:"nodes.single-cross-mastery.title",subtitleKey:"nodes.single-cross-mastery.subtitle",category:"color-neutrality",tier:"Novice",status:"locked",xpReward:100,descriptionKey:"nodes.single-cross-mastery.description",theoryKey:"nodes.single-cross-mastery.theory",prerequisites:["cross-efficiency-8"],parentId:"cross-efficiency-8",drillsKey:"nodes.single-cross-mastery.drills",masteryPercentage:0,iconName:"Circle",x:1240,y:310},
      { id:"dual-color-neutrality",titleKey:"nodes.dual-color-neutrality.title",subtitleKey:"nodes.dual-color-neutrality.subtitle",category:"color-neutrality",tier:"Intermediate",status:"locked",xpReward:300,descriptionKey:"nodes.dual-color-neutrality.description",theoryKey:"nodes.dual-color-neutrality.theory",prerequisites:["single-cross-mastery"],parentId:"single-cross-mastery",drillsKey:"nodes.dual-color-neutrality.drills",masteryPercentage:0,iconName:"CircleDot",x:1240,y:560},
      { id:"opposite-color-training",titleKey:"nodes.opposite-color-training.title",subtitleKey:"nodes.opposite-color-training.subtitle",category:"color-neutrality",tier:"Advanced",status:"locked",xpReward:350,descriptionKey:"nodes.opposite-color-training.description",theoryKey:"nodes.opposite-color-training.theory",prerequisites:["dual-color-neutrality"],parentId:"dual-color-neutrality",drillsKey:"nodes.opposite-color-training.drills",masteryPercentage:0,iconName:"Palette",x:1240,y:810},
      { id:"full-color-neutrality",titleKey:"nodes.full-color-neutrality.title",subtitleKey:"nodes.full-color-neutrality.subtitle",category:"color-neutrality",tier:"Expert",status:"locked",xpReward:700,descriptionKey:"nodes.full-color-neutrality.description",theoryKey:"nodes.full-color-neutrality.theory",prerequisites:["opposite-color-training"],parentId:"opposite-color-training",drillsKey:"nodes.full-color-neutrality.drills",masteryPercentage:0,iconName:"Globe",x:1240,y:1060},
      { id:"subconscious-cn",titleKey:"nodes.subconscious-cn.title",subtitleKey:"nodes.subconscious-cn.subtitle",category:"color-neutrality",tier:"Master",status:"locked",xpReward:500,descriptionKey:"nodes.subconscious-cn.description",theoryKey:"nodes.subconscious-cn.theory",prerequisites:["full-color-neutrality"],parentId:"full-color-neutrality",drillsKey:"nodes.subconscious-cn.drills",masteryPercentage:0,iconName:"Brain",x:1240,y:1310},
    ]
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 9: HARDWARE
  // ═══════════════════════════════════════════════════════════════
  {
    id:"hardware",nameKey:"branch.hardware.name",subtitleKey:"branch.hardware.subtitle",color:"#f97316",
    nodes:[
      { id:"cube-anatomy-hardware",titleKey:"nodes.cube-anatomy-hardware.title",subtitleKey:"nodes.cube-anatomy-hardware.subtitle",category:"hardware",tier:"Beginner",status:"locked",xpReward:50,descriptionKey:"nodes.cube-anatomy-hardware.description",theoryKey:"nodes.cube-anatomy-hardware.theory",prerequisites:["cube-anatomy"],parentId:"cube-anatomy",drillsKey:"nodes.cube-anatomy-hardware.drills",masteryPercentage:0,iconName:"Wrench",x:1410,y:60},
      { id:"basic-lubrication",titleKey:"nodes.basic-lubrication.title",subtitleKey:"nodes.basic-lubrication.subtitle",category:"hardware",tier:"Novice",status:"locked",xpReward:100,descriptionKey:"nodes.basic-lubrication.description",theoryKey:"nodes.basic-lubrication.theory",prerequisites:["cube-anatomy-hardware"],parentId:"cube-anatomy-hardware",drillsKey:"nodes.basic-lubrication.drills",masteryPercentage:0,iconName:"Droplets",x:1410,y:310},
      { id:"tensioning-basics",titleKey:"nodes.tensioning-basics.title",subtitleKey:"nodes.tensioning-basics.subtitle",category:"hardware",tier:"Intermediate",status:"locked",xpReward:150,descriptionKey:"nodes.tensioning-basics.description",theoryKey:"nodes.tensioning-basics.theory",prerequisites:["basic-lubrication"],parentId:"basic-lubrication",drillsKey:"nodes.tensioning-basics.drills",masteryPercentage:0,iconName:"Settings2",x:1410,y:560},
      { id:"magnet-adjustment",titleKey:"nodes.magnet-adjustment.title",subtitleKey:"nodes.magnet-adjustment.subtitle",category:"hardware",tier:"Advanced",status:"locked",xpReward:200,descriptionKey:"nodes.magnet-adjustment.description",theoryKey:"nodes.magnet-adjustment.theory",prerequisites:["tensioning-basics"],parentId:"tensioning-basics",drillsKey:"nodes.magnet-adjustment.drills",masteryPercentage:0,iconName:"Magnet",x:1410,y:760},
      { id:"cube-selection",titleKey:"nodes.cube-selection.title",subtitleKey:"nodes.cube-selection.subtitle",category:"hardware",tier:"Advanced",status:"locked",xpReward:150,descriptionKey:"nodes.cube-selection.description",theoryKey:"nodes.cube-selection.theory",prerequisites:["tensioning-basics"],parentId:"tensioning-basics",drillsKey:"nodes.cube-selection.drills",masteryPercentage:0,iconName:"PackageSearch",x:1410,y:860},
      { id:"custom-cube-setup",titleKey:"nodes.custom-cube-setup.title",subtitleKey:"nodes.custom-cube-setup.subtitle",category:"hardware",tier:"Expert",status:"locked",xpReward:300,descriptionKey:"nodes.custom-cube-setup.description",theoryKey:"nodes.custom-cube-setup.theory",prerequisites:["magnet-adjustment","cube-selection"],parentId:"magnet-adjustment",drillsKey:"nodes.custom-cube-setup.drills",masteryPercentage:0,iconName:"SlidersHorizontal",x:1410,y:1060},
      { id:"maintenance-optimization",titleKey:"nodes.maintenance-optimization.title",subtitleKey:"nodes.maintenance-optimization.subtitle",category:"hardware",tier:"Master",status:"locked",xpReward:200,descriptionKey:"nodes.maintenance-optimization.description",theoryKey:"nodes.maintenance-optimization.theory",prerequisites:["custom-cube-setup"],parentId:"custom-cube-setup",drillsKey:"nodes.maintenance-optimization.drills",masteryPercentage:0,iconName:"RotateCw",x:1410,y:1310},
    ]
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 10: PSYCHOLOGY
  // ═══════════════════════════════════════════════════════════════
  {
    id:"psychology",nameKey:"branch.psychology.name",subtitleKey:"branch.psychology.subtitle",color:"#8b5cf6",
    nodes:[
      { id:"nerves-management",titleKey:"nodes.nerves-management.title",subtitleKey:"nodes.nerves-management.subtitle",category:"psychology",tier:"Intermediate",status:"locked",xpReward:200,descriptionKey:"nodes.nerves-management.description",theoryKey:"nodes.nerves-management.theory",prerequisites:["consistent-solving"],parentId:"consistent-solving",drillsKey:"nodes.nerves-management.drills",masteryPercentage:0,iconName:"Heart",x:1580,y:560},
      { id:"pre-solve-routine",titleKey:"nodes.pre-solve-routine.title",subtitleKey:"nodes.pre-solve-routine.subtitle",category:"psychology",tier:"Advanced",status:"locked",xpReward:200,descriptionKey:"nodes.pre-solve-routine.description",theoryKey:"nodes.pre-solve-routine.theory",prerequisites:["nerves-management"],parentId:"nerves-management",drillsKey:"nodes.pre-solve-routine.drills",masteryPercentage:0,iconName:"PlayCircle",x:1580,y:760},
      { id:"bad-solve-recovery",titleKey:"nodes.bad-solve-recovery.title",subtitleKey:"nodes.bad-solve-recovery.subtitle",category:"psychology",tier:"Advanced",status:"locked",xpReward:200,descriptionKey:"nodes.bad-solve-recovery.description",theoryKey:"nodes.bad-solve-recovery.theory",prerequisites:["pre-solve-routine"],parentId:"pre-solve-routine",drillsKey:"nodes.bad-solve-recovery.drills",masteryPercentage:0,iconName:"RotateCcw",x:1580,y:860},
      { id:"competition-strategy",titleKey:"nodes.competition-strategy.title",subtitleKey:"nodes.competition-strategy.subtitle",category:"psychology",tier:"Expert",status:"locked",xpReward:350,descriptionKey:"nodes.competition-strategy.description",theoryKey:"nodes.competition-strategy.theory",prerequisites:["bad-solve-recovery"],parentId:"bad-solve-recovery",drillsKey:"nodes.competition-strategy.drills",masteryPercentage:0,iconName:"Flag",x:1580,y:1010},
      { id:"focus-techniques",titleKey:"nodes.focus-techniques.title",subtitleKey:"nodes.focus-techniques.subtitle",category:"psychology",tier:"Expert",status:"locked",xpReward:300,descriptionKey:"nodes.focus-techniques.description",theoryKey:"nodes.focus-techniques.theory",prerequisites:["competition-strategy"],parentId:"competition-strategy",drillsKey:"nodes.focus-techniques.drills",masteryPercentage:0,iconName:"Crosshair",x:1580,y:1110},
      { id:"flow-state",titleKey:"nodes.flow-state.title",subtitleKey:"nodes.flow-state.subtitle",category:"psychology",tier:"Master",status:"locked",xpReward:500,descriptionKey:"nodes.flow-state.description",theoryKey:"nodes.flow-state.theory",prerequisites:["focus-techniques","continuous-lookahead"],parentId:"focus-techniques",drillsKey:"nodes.flow-state.drills",masteryPercentage:0,iconName:"Zap",x:1580,y:1310},
      { id:"elite-composure",titleKey:"nodes.elite-composure.title",subtitleKey:"nodes.elite-composure.subtitle",category:"psychology",tier:"Elite",status:"locked",xpReward:700,descriptionKey:"nodes.elite-composure.description",theoryKey:"nodes.elite-composure.theory",prerequisites:["flow-state"],parentId:"flow-state",drillsKey:"nodes.elite-composure.drills",masteryPercentage:0,iconName:"ShieldCheck",x:1580,y:1560},
    ]
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCH 11: TRAINING
  // ═══════════════════════════════════════════════════════════════
  {
    id:"training",nameKey:"branch.training.name",subtitleKey:"branch.training.subtitle",color:"#e11d48",
    nodes:[
      { id:"session-structure",titleKey:"nodes.session-structure.title",subtitleKey:"nodes.session-structure.subtitle",category:"training",tier:"Novice",status:"locked",xpReward:100,descriptionKey:"nodes.session-structure.description",theoryKey:"nodes.session-structure.theory",prerequisites:["consistent-solving"],parentId:"consistent-solving",drillsKey:"nodes.session-structure.drills",masteryPercentage:0,iconName:"ClipboardList",x:1750,y:310},
      { id:"physical-ergonomics",titleKey:"nodes.physical-ergonomics.title",subtitleKey:"nodes.physical-ergonomics.subtitle",category:"training",tier:"Novice",status:"locked",xpReward:100,descriptionKey:"nodes.physical-ergonomics.description",theoryKey:"nodes.physical-ergonomics.theory",prerequisites:["session-structure"],parentId:"session-structure",drillsKey:"nodes.physical-ergonomics.drills",masteryPercentage:0,iconName:"Activity",x:1750,y:410},
      { id:"deliberate-practice",titleKey:"nodes.deliberate-practice.title",subtitleKey:"nodes.deliberate-practice.subtitle",category:"training",tier:"Intermediate",status:"locked",xpReward:250,descriptionKey:"nodes.deliberate-practice.description",theoryKey:"nodes.deliberate-practice.theory",prerequisites:["physical-ergonomics"],parentId:"physical-ergonomics",drillsKey:"nodes.deliberate-practice.drills",masteryPercentage:0,iconName:"Target",x:1750,y:510},
      { id:"algorithm-drilling",titleKey:"nodes.algorithm-drilling.title",subtitleKey:"nodes.algorithm-drilling.subtitle",category:"training",tier:"Intermediate",status:"locked",xpReward:200,descriptionKey:"nodes.algorithm-drilling.description",theoryKey:"nodes.algorithm-drilling.theory",prerequisites:["deliberate-practice"],parentId:"deliberate-practice",drillsKey:"nodes.algorithm-drilling.drills",masteryPercentage:0,iconName:"Repeat",x:1750,y:610},
      { id:"weakness-analysis",titleKey:"nodes.weakness-analysis.title",subtitleKey:"nodes.weakness-analysis.subtitle",category:"training",tier:"Advanced",status:"locked",xpReward:250,descriptionKey:"nodes.weakness-analysis.description",theoryKey:"nodes.weakness-analysis.theory",prerequisites:["deliberate-practice","algorithm-drilling"],parentId:"deliberate-practice",drillsKey:"nodes.weakness-analysis.drills",masteryPercentage:0,iconName:"Microscope",x:1750,y:760},
      { id:"split-analysis",titleKey:"nodes.split-analysis.title",subtitleKey:"nodes.split-analysis.subtitle",category:"training",tier:"Advanced",status:"locked",xpReward:250,descriptionKey:"nodes.split-analysis.description",theoryKey:"nodes.split-analysis.theory",prerequisites:["weakness-analysis"],parentId:"weakness-analysis",drillsKey:"nodes.split-analysis.drills",masteryPercentage:0,iconName:"BarChart3",x:1750,y:860},
      { id:"smart-training-planning",titleKey:"nodes.smart-training-planning.title",subtitleKey:"nodes.smart-training-planning.subtitle",category:"training",tier:"Expert",status:"locked",xpReward:350,descriptionKey:"nodes.smart-training-planning.description",theoryKey:"nodes.smart-training-planning.theory",prerequisites:["split-analysis"],parentId:"split-analysis",drillsKey:"nodes.smart-training-planning.drills",masteryPercentage:0,iconName:"Calendar",x:1750,y:1060},
      { id:"periodization",titleKey:"nodes.periodization.title",subtitleKey:"nodes.periodization.subtitle",category:"training",tier:"Master",status:"locked",xpReward:400,descriptionKey:"nodes.periodization.description",theoryKey:"nodes.periodization.theory",prerequisites:["smart-training-planning"],parentId:"smart-training-planning",drillsKey:"nodes.periodization.drills",masteryPercentage:0,iconName:"TrendingUp",x:1750,y:1310},
    ]
  },
  // ═══════════════════════════════════════════════════════════════
  // BRANCHES 12-16: ROUX, ZZ, BLINDFOLD, FMC, THEORY
  // All use the same grid pattern with their respective X positions.
  // ═══════════════════════════════════════════════════════════════
  {
    id:"roux",nameKey:"branch.roux.name",subtitleKey:"branch.roux.subtitle",color:"#84cc16",
    nodes:[
      { id:"roux-first-block",titleKey:"nodes.roux-first-block.title",subtitleKey:"nodes.roux-first-block.subtitle",category:"roux",tier:"Intermediate",status:"locked",xpReward:250,descriptionKey:"nodes.roux-first-block.description",theoryKey:"nodes.roux-first-block.theory",prerequisites:["f2l-case-recognition"],parentId:"f2l-case-recognition",drillsKey:"nodes.roux-first-block.drills",masteryPercentage:0,iconName:"Square",x:1920,y:510},
      { id:"roux-second-block",titleKey:"nodes.roux-second-block.title",subtitleKey:"nodes.roux-second-block.subtitle",category:"roux",tier:"Intermediate",status:"locked",xpReward:250,descriptionKey:"nodes.roux-second-block.description",theoryKey:"nodes.roux-second-block.theory",prerequisites:["roux-first-block"],parentId:"roux-first-block",drillsKey:"nodes.roux-second-block.drills",masteryPercentage:0,iconName:"LayoutTemplate",x:1920,y:610},
      { id:"roux-cmll",titleKey:"nodes.roux-cmll.title",subtitleKey:"nodes.roux-cmll.subtitle",category:"roux",tier:"Advanced",status:"locked",xpReward:500,descriptionKey:"nodes.roux-cmll.description",theoryKey:"nodes.roux-cmll.theory",prerequisites:["roux-second-block"],parentId:"roux-second-block",drillsKey:"nodes.roux-cmll.drills",masteryPercentage:0,iconName:"Triangle",x:1920,y:760},
      { id:"roux-lse-basics",titleKey:"nodes.roux-lse-basics.title",subtitleKey:"nodes.roux-lse-basics.subtitle",category:"roux",tier:"Advanced",status:"locked",xpReward:300,descriptionKey:"nodes.roux-lse-basics.description",theoryKey:"nodes.roux-lse-basics.theory",prerequisites:["roux-cmll"],parentId:"roux-cmll",drillsKey:"nodes.roux-lse-basics.drills",masteryPercentage:0,iconName:"ArrowUpDown",x:1920,y:860},
      { id:"roux-lse-advanced",titleKey:"nodes.roux-lse-advanced.title",subtitleKey:"nodes.roux-lse-advanced.subtitle",category:"roux",tier:"Expert",status:"locked",xpReward:450,descriptionKey:"nodes.roux-lse-advanced.description",theoryKey:"nodes.roux-lse-advanced.theory",prerequisites:["roux-lse-basics"],parentId:"roux-lse-basics",drillsKey:"nodes.roux-lse-advanced.drills",masteryPercentage:0,iconName:"MoveVertical",x:1920,y:1010},
      { id:"roux-eolr",titleKey:"nodes.roux-eolr.title",subtitleKey:"nodes.roux-eolr.subtitle",category:"roux",tier:"Expert",status:"locked",xpReward:500,descriptionKey:"nodes.roux-eolr.description",theoryKey:"nodes.roux-eolr.theory",prerequisites:["roux-lse-advanced"],parentId:"roux-lse-advanced",drillsKey:"nodes.roux-eolr.drills",masteryPercentage:0,iconName:"GitMerge",x:1920,y:1110},
      { id:"roux-non-matching",titleKey:"nodes.roux-non-matching.title",subtitleKey:"nodes.roux-non-matching.subtitle",category:"roux",tier:"Master",status:"locked",xpReward:500,descriptionKey:"nodes.roux-non-matching.description",theoryKey:"nodes.roux-non-matching.theory",prerequisites:["roux-eolr"],parentId:"roux-eolr",drillsKey:"nodes.roux-non-matching.drills",masteryPercentage:0,iconName:"Move3d",x:1920,y:1310},
      { id:"roux-full-mastery",titleKey:"nodes.roux-full-mastery.title",subtitleKey:"nodes.roux-full-mastery.subtitle",category:"roux",tier:"Elite",status:"locked",xpReward:1000,descriptionKey:"nodes.roux-full-mastery.description",theoryKey:"nodes.roux-full-mastery.theory",prerequisites:["roux-non-matching"],parentId:"roux-non-matching",drillsKey:"nodes.roux-full-mastery.drills",masteryPercentage:0,iconName:"Award",x:1920,y:1560},
    ]
  },
  {
    id:"zz",nameKey:"branch.zz.name",subtitleKey:"branch.zz.subtitle",color:"#06b6d4",
    nodes:[
      { id:"zz-eoline",titleKey:"nodes.zz-eoline.title",subtitleKey:"nodes.zz-eoline.subtitle",category:"zz",tier:"Intermediate",status:"locked",xpReward:250,descriptionKey:"nodes.zz-eoline.description",theoryKey:"nodes.zz-eoline.theory",prerequisites:["f2l-case-recognition"],parentId:"f2l-case-recognition",drillsKey:"nodes.zz-eoline.drills",masteryPercentage:0,iconName:"AlignStartVertical",x:2090,y:560},
      { id:"zz-eocross",titleKey:"nodes.zz-eocross.title",subtitleKey:"nodes.zz-eocross.subtitle",category:"zz",tier:"Advanced",status:"locked",xpReward:300,descriptionKey:"nodes.zz-eocross.description",theoryKey:"nodes.zz-eocross.theory",prerequisites:["zz-eoline"],parentId:"zz-eoline",drillsKey:"nodes.zz-eocross.drills",masteryPercentage:0,iconName:"Grid",x:2090,y:760},
      { id:"zz-f2l",titleKey:"nodes.zz-f2l.title",subtitleKey:"nodes.zz-f2l.subtitle",category:"zz",tier:"Advanced",status:"locked",xpReward:300,descriptionKey:"nodes.zz-f2l.description",theoryKey:"nodes.zz-f2l.theory",prerequisites:["zz-eocross"],parentId:"zz-eocross",drillsKey:"nodes.zz-f2l.drills",masteryPercentage:0,iconName:"Layers",x:2090,y:860},
      { id:"zz-coll-epll",titleKey:"nodes.zz-coll-epll.title",subtitleKey:"nodes.zz-coll-epll.subtitle",category:"zz",tier:"Expert",status:"locked",xpReward:500,descriptionKey:"nodes.zz-coll-epll.description",theoryKey:"nodes.zz-coll-epll.theory",prerequisites:["zz-f2l","coll-set"],parentId:"zz-f2l",drillsKey:"nodes.zz-coll-epll.drills",masteryPercentage:0,iconName:"Shield",x:2090,y:1060},
      { id:"zz-zbll",titleKey:"nodes.zz-zbll.title",subtitleKey:"nodes.zz-zbll.subtitle",category:"zz",tier:"Master",status:"locked",xpReward:800,descriptionKey:"nodes.zz-zbll.description",theoryKey:"nodes.zz-zbll.theory",prerequisites:["zz-coll-epll","zbll-t-u"],parentId:"zz-coll-epll",drillsKey:"nodes.zz-zbll.drills",masteryPercentage:0,iconName:"Crown",x:2090,y:1260},
      { id:"zz-ct",titleKey:"nodes.zz-ct.title",subtitleKey:"nodes.zz-ct.subtitle",category:"zz",tier:"Master",status:"locked",xpReward:600,descriptionKey:"nodes.zz-ct.description",theoryKey:"nodes.zz-ct.theory",prerequisites:["zz-coll-epll"],parentId:"zz-coll-epll",drillsKey:"nodes.zz-ct.drills",masteryPercentage:0,iconName:"GitBranch",x:2090,y:1360},
      { id:"zz-full-mastery",titleKey:"nodes.zz-full-mastery.title",subtitleKey:"nodes.zz-full-mastery.subtitle",category:"zz",tier:"Elite",status:"locked",xpReward:1000,descriptionKey:"nodes.zz-full-mastery.description",theoryKey:"nodes.zz-full-mastery.theory",prerequisites:["zz-zbll","zz-ct"],parentId:"zz-zbll",drillsKey:"nodes.zz-full-mastery.drills",masteryPercentage:0,iconName:"Award",x:2090,y:1560},
    ]
  },
  {
    id:"blindfold",nameKey:"branch.blindfold.name",subtitleKey:"branch.blindfold.subtitle",color:"#d946ef",
    nodes:[
      { id:"bld-old-pochmann",titleKey:"nodes.bld-old-pochmann.title",subtitleKey:"nodes.bld-old-pochmann.subtitle",category:"blindfold",tier:"Intermediate",status:"locked",xpReward:300,descriptionKey:"nodes.bld-old-pochmann.description",theoryKey:"nodes.bld-old-pochmann.theory",exampleFormulaKey:"nodes.bld-old-pochmann.exampleFormula",prerequisites:["full-pll"],parentId:"full-pll",drillsKey:"nodes.bld-old-pochmann.drills",masteryPercentage:0,iconName:"Glasses",x:2260,y:510},
      { id:"bld-memo-basics",titleKey:"nodes.bld-memo-basics.title",subtitleKey:"nodes.bld-memo-basics.subtitle",category:"blindfold",tier:"Intermediate",status:"locked",xpReward:300,descriptionKey:"nodes.bld-memo-basics.description",theoryKey:"nodes.bld-memo-basics.theory",prerequisites:["bld-old-pochmann"],parentId:"bld-old-pochmann",drillsKey:"nodes.bld-memo-basics.drills",masteryPercentage:0,iconName:"Brain",x:2260,y:610},
      { id:"bld-m2-op",titleKey:"nodes.bld-m2-op.title",subtitleKey:"nodes.bld-m2-op.subtitle",category:"blindfold",tier:"Advanced",status:"locked",xpReward:400,descriptionKey:"nodes.bld-m2-op.description",theoryKey:"nodes.bld-m2-op.theory",prerequisites:["bld-memo-basics","m-slice-basics"],parentId:"bld-memo-basics",drillsKey:"nodes.bld-m2-op.drills",masteryPercentage:0,iconName:"ArrowUpDown",x:2260,y:760},
      { id:"bld-letter-pairs",titleKey:"nodes.bld-letter-pairs.title",subtitleKey:"nodes.bld-letter-pairs.subtitle",category:"blindfold",tier:"Advanced",status:"locked",xpReward:350,descriptionKey:"nodes.bld-letter-pairs.description",theoryKey:"nodes.bld-letter-pairs.theory",prerequisites:["bld-m2-op"],parentId:"bld-m2-op",drillsKey:"nodes.bld-letter-pairs.drills",masteryPercentage:0,iconName:"Image",x:2260,y:860},
      { id:"bld-audio-loops",titleKey:"nodes.bld-audio-loops.title",subtitleKey:"nodes.bld-audio-loops.subtitle",category:"blindfold",tier:"Expert",status:"locked",xpReward:400,descriptionKey:"nodes.bld-audio-loops.description",theoryKey:"nodes.bld-audio-loops.theory",prerequisites:["bld-letter-pairs"],parentId:"bld-letter-pairs",drillsKey:"nodes.bld-audio-loops.drills",masteryPercentage:0,iconName:"Music2",x:2260,y:1060},
      { id:"bld-3-style",titleKey:"nodes.bld-3-style.title",subtitleKey:"nodes.bld-3-style.subtitle",category:"blindfold",tier:"Master",status:"locked",xpReward:1500,descriptionKey:"nodes.bld-3-style.description",theoryKey:"nodes.bld-3-style.theory",exampleFormulaKey:"nodes.bld-3-style.exampleFormula",prerequisites:["bld-audio-loops","commutators-theory"],parentId:"bld-audio-loops",drillsKey:"nodes.bld-3-style.drills",masteryPercentage:0,iconName:"Workflow",x:2260,y:1260},
      { id:"bld-multi",titleKey:"nodes.bld-multi.title",subtitleKey:"nodes.bld-multi.subtitle",category:"blindfold",tier:"Master",status:"locked",xpReward:1000,descriptionKey:"nodes.bld-multi.description",theoryKey:"nodes.bld-multi.theory",prerequisites:["bld-3-style"],parentId:"bld-3-style",drillsKey:"nodes.bld-multi.drills",masteryPercentage:0,iconName:"Layers",x:2260,y:1360},
      { id:"bld-4bld-5bld",titleKey:"nodes.bld-4bld-5bld.title",subtitleKey:"nodes.bld-4bld-5bld.subtitle",category:"blindfold",tier:"Elite",status:"locked",xpReward:1200,descriptionKey:"nodes.bld-4bld-5bld.description",theoryKey:"nodes.bld-4bld-5bld.theory",prerequisites:["bld-multi"],parentId:"bld-multi",drillsKey:"nodes.bld-4bld-5bld.drills",masteryPercentage:0,iconName:"Box",x:2260,y:1560},
    ]
  },
  {
    id:"fmc",nameKey:"branch.fmc.name",subtitleKey:"branch.fmc.subtitle",color:"#eab308",
    nodes:[
      { id:"fmc-blockbuilding",titleKey:"nodes.fmc-blockbuilding.title",subtitleKey:"nodes.fmc-blockbuilding.subtitle",category:"fmc",tier:"Intermediate",status:"locked",xpReward:250,descriptionKey:"nodes.fmc-blockbuilding.description",theoryKey:"nodes.fmc-blockbuilding.theory",prerequisites:["f2l-case-recognition"],parentId:"f2l-case-recognition",drillsKey:"nodes.fmc-blockbuilding.drills",masteryPercentage:0,iconName:"Box",x:2430,y:560},
      { id:"fmc-pseudo-blocks",titleKey:"nodes.fmc-pseudo-blocks.title",subtitleKey:"nodes.fmc-pseudo-blocks.subtitle",category:"fmc",tier:"Advanced",status:"locked",xpReward:300,descriptionKey:"nodes.fmc-pseudo-blocks.description",theoryKey:"nodes.fmc-pseudo-blocks.theory",prerequisites:["fmc-blockbuilding"],parentId:"fmc-blockbuilding",drillsKey:"nodes.fmc-pseudo-blocks.drills",masteryPercentage:0,iconName:"Move3d",x:2430,y:760},
      { id:"fmc-niss",titleKey:"nodes.fmc-niss.title",subtitleKey:"nodes.fmc-niss.subtitle",category:"fmc",tier:"Advanced",status:"locked",xpReward:400,descriptionKey:"nodes.fmc-niss.description",theoryKey:"nodes.fmc-niss.theory",prerequisites:["fmc-pseudo-blocks"],parentId:"fmc-pseudo-blocks",drillsKey:"nodes.fmc-niss.drills",masteryPercentage:0,iconName:"Shuffle",x:2430,y:860},
      { id:"fmc-insertions",titleKey:"nodes.fmc-insertions.title",subtitleKey:"nodes.fmc-insertions.subtitle",category:"fmc",tier:"Expert",status:"locked",xpReward:500,descriptionKey:"nodes.fmc-insertions.description",theoryKey:"nodes.fmc-insertions.theory",prerequisites:["fmc-niss","commutators-theory"],parentId:"fmc-niss",drillsKey:"nodes.fmc-insertions.drills",masteryPercentage:0,iconName:"Wand2",x:2430,y:1010},
      { id:"fmc-edge-orientation",titleKey:"nodes.fmc-edge-orientation.title",subtitleKey:"nodes.fmc-edge-orientation.subtitle",category:"fmc",tier:"Expert",status:"locked",xpReward:400,descriptionKey:"nodes.fmc-edge-orientation.description",theoryKey:"nodes.fmc-edge-orientation.theory",prerequisites:["fmc-insertions"],parentId:"fmc-insertions",drillsKey:"nodes.fmc-edge-orientation.drills",masteryPercentage:0,iconName:"Zap",x:2430,y:1110},
      { id:"fmc-domino-reduction",titleKey:"nodes.fmc-domino-reduction.title",subtitleKey:"nodes.fmc-domino-reduction.subtitle",category:"fmc",tier:"Master",status:"locked",xpReward:700,descriptionKey:"nodes.fmc-domino-reduction.description",theoryKey:"nodes.fmc-domino-reduction.theory",prerequisites:["fmc-edge-orientation"],parentId:"fmc-edge-orientation",drillsKey:"nodes.fmc-domino-reduction.drills",masteryPercentage:0,iconName:"Layers",x:2430,y:1260},
      { id:"fmc-htr",titleKey:"nodes.fmc-htr.title",subtitleKey:"nodes.fmc-htr.subtitle",category:"fmc",tier:"Master",status:"locked",xpReward:700,descriptionKey:"nodes.fmc-htr.description",theoryKey:"nodes.fmc-htr.theory",prerequisites:["fmc-domino-reduction"],parentId:"fmc-domino-reduction",drillsKey:"nodes.fmc-htr.drills",masteryPercentage:0,iconName:"Dice6",x:2430,y:1360},
      { id:"fmc-full-mastery",titleKey:"nodes.fmc-full-mastery.title",subtitleKey:"nodes.fmc-full-mastery.subtitle",category:"fmc",tier:"Elite",status:"locked",xpReward:1200,descriptionKey:"nodes.fmc-full-mastery.description",theoryKey:"nodes.fmc-full-mastery.theory",prerequisites:["fmc-htr","fmc-insertions"],parentId:"fmc-htr",drillsKey:"nodes.fmc-full-mastery.drills",masteryPercentage:0,iconName:"Trophy",x:2430,y:1560},
    ]
  },
  {
    id:"theory",nameKey:"branch.theory.name",subtitleKey:"branch.theory.subtitle",color:"#64748b",
    nodes:[
      { id:"cube-theory-basics",titleKey:"nodes.cube-theory-basics.title",subtitleKey:"nodes.cube-theory-basics.subtitle",category:"theory",tier:"Intermediate",status:"locked",xpReward:200,descriptionKey:"nodes.cube-theory-basics.description",theoryKey:"nodes.cube-theory-basics.theory",prerequisites:["full-pll"],parentId:"full-pll",drillsKey:"nodes.cube-theory-basics.drills",masteryPercentage:0,iconName:"Sigma",x:2600,y:560},
      { id:"commutators-theory",titleKey:"nodes.commutators-theory.title",subtitleKey:"nodes.commutators-theory.subtitle",category:"theory",tier:"Advanced",status:"locked",xpReward:350,descriptionKey:"nodes.commutators-theory.description",theoryKey:"nodes.commutators-theory.theory",exampleFormulaKey:"nodes.commutators-theory.exampleFormula",prerequisites:["cube-theory-basics"],parentId:"cube-theory-basics",drillsKey:"nodes.commutators-theory.drills",masteryPercentage:0,iconName:"Atom",x:2600,y:810},
      { id:"group-theory-cube",titleKey:"nodes.group-theory-cube.title",subtitleKey:"nodes.group-theory-cube.subtitle",category:"theory",tier:"Expert",status:"locked",xpReward:500,descriptionKey:"nodes.group-theory-cube.description",theoryKey:"nodes.group-theory-cube.theory",prerequisites:["commutators-theory"],parentId:"commutators-theory",drillsKey:"nodes.group-theory-cube.drills",masteryPercentage:0,iconName:"Dna",x:2600,y:1010},
      { id:"optimal-solving-theory",titleKey:"nodes.optimal-solving-theory.title",subtitleKey:"nodes.optimal-solving-theory.subtitle",category:"theory",tier:"Expert",status:"locked",xpReward:400,descriptionKey:"nodes.optimal-solving-theory.description",theoryKey:"nodes.optimal-solving-theory.theory",prerequisites:["group-theory-cube"],parentId:"group-theory-cube",drillsKey:"nodes.optimal-solving-theory.drills",masteryPercentage:0,iconName:"Calculator",x:2600,y:1110},
      { id:"algorithm-optimization",titleKey:"nodes.algorithm-optimization.title",subtitleKey:"nodes.algorithm-optimization.subtitle",category:"theory",tier:"Master",status:"locked",xpReward:400,descriptionKey:"nodes.algorithm-optimization.description",theoryKey:"nodes.algorithm-optimization.theory",prerequisites:["optimal-solving-theory"],parentId:"optimal-solving-theory",drillsKey:"nodes.algorithm-optimization.drills",masteryPercentage:0,iconName:"SlidersHorizontal",x:2600,y:1260},
      { id:"method-comparison",titleKey:"nodes.method-comparison.title",subtitleKey:"nodes.method-comparison.subtitle",category:"theory",tier:"Master",status:"locked",xpReward:400,descriptionKey:"nodes.method-comparison.description",theoryKey:"nodes.method-comparison.theory",prerequisites:["algorithm-optimization"],parentId:"algorithm-optimization",drillsKey:"nodes.method-comparison.drills",masteryPercentage:0,iconName:"GitCompare",x:2600,y:1360},
      { id:"elite-theory",titleKey:"nodes.elite-theory.title",subtitleKey:"nodes.elite-theory.subtitle",category:"theory",tier:"Elite",status:"locked",xpReward:1000,descriptionKey:"nodes.elite-theory.description",theoryKey:"nodes.elite-theory.theory",prerequisites:["method-comparison","full-zbll"],parentId:"method-comparison",drillsKey:"nodes.elite-theory.drills",masteryPercentage:0,iconName:"Lightbulb",x:2600,y:1560},
    ]
  },
];

const layoutOutput = calculateAutoLayout(RAW_SKILL_BRANCHES);

export const ALL_SKILL_NODES: SkillNode[] = layoutOutput.allNodes;
/* ── i18n key maps (locale-backed labels) ────────────────────────────── */
export const TIER_KEY: Record<SkillNode["tier"], ParseKeys<"skillTree">> = {
  Beginner: "tier.Beginner",
  Novice: "tier.Novice",
  Intermediate: "tier.Intermediate",
  Advanced: "tier.Advanced",
  Expert: "tier.Expert",
  Master: "tier.Master",
  Elite: "tier.Elite",
  Legendary: "tier.Legendary",
};

export const CATEGORY_KEY: Record<SkillNode["category"], ParseKeys<"skillTree">> = {
  fundamentals: "category.fundamentals",
  cross: "category.cross",
  f2l: "category.f2l",
  "last-layer": "category.last-layer",
  lookahead: "category.lookahead",
  "finger-tricks": "category.finger-tricks",
  inspection: "category.inspection",
  "color-neutrality": "category.color-neutrality",
  hardware: "category.hardware",
  psychology: "category.psychology",
  training: "category.training",
  roux: "category.roux",
  zz: "category.zz",
  blindfold: "category.blindfold",
  fmc: "category.fmc",
  theory: "category.theory",
};

export const STATUS_KEY: Record<SkillNode["status"], ParseKeys<"skillTree">> = {
  completed: "status.completed",
  unlocked: "status.unlocked",
  locked: "status.locked",
};

/** Resolve a prerequisite id to its node (for localized titles). */
export const NODE_BY_ID: Map<string, SkillNode> = new Map(ALL_SKILL_NODES.map((n) => [n.id, n]));


