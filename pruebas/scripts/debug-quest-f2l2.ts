/**
 * Debug: qué es exactamente "B' R B R'" (setup pag.2 quest) y cómo se relaciona
 * con Jb (F2L 1). También imprime la estructura completa de jb-data.json.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { CubeState } from "../../packages/math-core/src/index";

const QUEST = resolve(__dirname, "../raw/quest");
const jb = JSON.parse(readFileSync(resolve(QUEST, "jb-data.json"), "utf-8"));

function dump(s: CubeState, label: string): void {
  const cp = Array.from(s.cp as any), co = Array.from(s.co as any), ep = Array.from(s.ep as any), eo = Array.from(s.eo as any);
  console.log(`${label}:`);
  console.log(`  cp: [${cp.join(",")}]`);
  console.log(`  co: [${co.join(",")}]`);
  console.log(`  ep: [${ep.join(",")}]`);
  console.log(`  eo: [${eo.join(",")}]`);
}

// estados
const s1 = new CubeState(); s1.applySequence("F R' F' R");
const s2 = new CubeState(); s2.applySequence("B' R B R'");
dump(s1, "S1 = F R' F' R (pag.1 setup)");
dump(s2, "S2 = B' R B R' (pag.2 setup)");

// que hace U' R' U R sobre S1 (el caso Jb real) y sobre S2
for (const [alg, st, name] of [
  ["U' R' U R", s1.clone(), "S1 (Jb case)"],
  ["U' R' U R", s2.clone(), "S2 (setup pag.2)"],
  ["U2 R' U2 R", s1.clone(), "S1 (Jb case)"],
  ["R B' R' B", s1.clone(), "S1 (Jb case)"],
] as [string, CubeState, string][]) {
  const t = st.clone();
  try { t.applySequence(alg); } catch (e) { console.log(`${alg} on ${name}: ERR ${e}`); continue; }
  const fr = t.cp[4] === 4 && t.co[4] === 0 && t.ep[8] === 8 && t.eo[8] === 0;
  console.log(`"${alg}" sobre ${name} -> frSolved: ${fr} | par: ${(() => { let c=-1,e=-1; for(let i=0;i<8;i++) if(t.cp[i]===4){c=i;break;} for(let i=0;i<12;i++) if(t.ep[i]===8){e=i;break;} return c+"|"+e; })()}`);
}

// jb-data.json: estructura clave
console.log("\n=== jb-data.json ===");
console.log("selected:", JSON.stringify(jb.selected));
console.log("selectedSetup:", JSON.stringify(jb.selectedSetup));
console.log("total:", jb.total, "grandTotal:", jb.grandTotal);
console.log("patterns:", JSON.stringify(jb.patterns));
const rows = jb.rows as any;
if (rows) {
  const a = rows.a ?? [];
  const w = rows.w ?? [];
  console.log("rows.a (front):", a.length, "| rows.w (back):", w.length);
  const show = (r: any) => `${r.alg} auf=${r.auf} disturbs="${r.disturbs}" reduces=${JSON.stringify((r.reduces ?? []).map((x: any) => x.case))} uses=${r.uses} front=${r.frontUses} back=${r.backUses} fr=${r.frVotes} br=${r.brVotes} usesBy=${JSON.stringify(r.usesBy)}`;
  console.log("  top a:", a.slice(0, 5).map(show).join("\n    "));
  console.log("  top w:", w.slice(0, 5).map(show).join("\n    "));
}
console.log("reductionPreviews:", JSON.stringify(jb.reductionPreviews)?.slice(0, 500));
console.log("rotationUses:", JSON.stringify(jb.rotationUses)?.slice(0, 500));
console.log("usageYears:", JSON.stringify(jb.usageYears)?.slice(0, 300));
