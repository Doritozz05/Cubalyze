import { tokenize, isRotation } from "../../packages/math-core/src/notation/moveNotation";

console.log('display path (expandWide:false):');
for (const t of ["U2'", "R2'", "r2'", "y2'", "l2'", "U", "R'", "r"]) {
  console.log(' ', JSON.stringify(t), '→', JSON.stringify(tokenize(t, { expandWide: false })));
}
console.log('expanded path (default):');
for (const t of ["U2'", "R2'", "r2'", "y2'"]) {
  console.log(' ', JSON.stringify(t), '→', JSON.stringify(tokenize(t)));
}
console.log('isRotation on raw:', isRotation("y2'"), isRotation("y2"));
