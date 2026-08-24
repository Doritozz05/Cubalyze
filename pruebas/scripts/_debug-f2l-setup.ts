/** Depuración: por qué crossOnD falla en los setups del catálogo F2L. */
import { CubeState, FaceletStringConverter } from "../../packages/math-core/src/index";
import { ALL_F2L_CASES } from "../../packages/algorithm-db/src/seed/cfop-f2l";
import { CaseStateGenerator } from "../../packages/algorithm-db/src/caseGenerator";

const cornerFacelet: number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const edgeFacelet: number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const isD = (i: number) => i >= 27 && i < 36;

// Muestra 5 casos: los que deberían tener cross en D
for (const cn of ["F2L 1", "F2L 39", "F2L 11", "F2L 18", "F2L 1 (Jb)"]) {
  const c = ALL_F2L_CASES.find((x) => x.caseDef.caseNumber === cn);
  if (!c) { console.log(`no encontrado ${cn}`); continue; }
  console.log(`\n### ${cn} · setup: ${c.caseDef.setupScramble}`);
  let s: CubeState;
  try { s = CaseStateGenerator.generateFromScramble(c.caseDef.setupScramble); }
  catch (e) { console.log("  ERROR:", String(e).slice(0, 80)); continue; }
  const fl = FaceletStringConverter.toFaceletString(s);
  console.log(`  facelets: ${fl}`);
  console.log(`  ep: ${Array.from(s.ep)}`);
  console.log(`  eo: ${Array.from(s.eo)}`);
  // ¿cross en D por facelets?
  const dEdgeFacelets = [4, 5, 6, 7].map((p) => {
    const [a, b] = edgeFacelet[p];
    return isD(a) ? a : b;
  });
  const colors = dEdgeFacelets.map((i) => fl[i]);
  console.log(`  aristas D (pos 4-7): facelets=${dEdgeFacelets} colores=${colors} eo=${[4,5,6,7].map((p) => s.eo[p])}`);
  const dCornerFacelets = [4, 5, 6, 7].map((p) => cornerFacelet[p].find((i) => isD(i))!);
  console.log(`  esquinas D colores: ${dCornerFacelets.map((i) => fl[i])}`);
}
