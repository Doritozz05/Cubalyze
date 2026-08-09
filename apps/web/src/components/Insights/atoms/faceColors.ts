/**
 * Cube face colors + names — the single source for both analysis panels
 * (SolveAnalysisPanel and OurDetectionPanel). Previously duplicated as local
 * exports in SolveAnalysisPanel; new code imports from here (or re-exports
 * through SolveAnalysisPanel for backward compatibility).
 */

/** Maps face letters (U,R,F,D,L,B) to hex colors (standard Rubik's cube). */
export const FACE_HEX: Record<string, string> = {
  U: "#FFFFFF",
  R: "#EF4444",
  F: "#22C55E",
  D: "#FACC15",
  L: "#F97316",
  B: "#3B82F6",
};

/** Maps face letters to color names (U=White, R=Red, F=Green, D=Yellow, …). */
export const FACE_NAME: Record<string, string> = {
  U: "White",
  R: "Red",
  F: "Green",
  D: "Yellow",
  L: "Orange",
  B: "Blue",
};

/** Human-readable color name for a face letter (falls back to the letter). */
export function colorName(face: string): string {
  return FACE_NAME[face] ?? face;
}
