/**
 * Versioned CFOP phase-share reference used by Phase Balance.
 *
 * This is deliberately called a reference, not a population benchmark:
 * CubeSkills describes its split tool as average split times assembled by
 * Feliks Zemdegs, partially based on sub-10 solver data, and warns that
 * knowledge, technique, and advanced methods materially change the profile.
 * There is no public, statistically validated table for every speed tier.
 */

export const CFOP_REFERENCE_VERSION = "2026-08-01-cubeskills-v1" as const;

export type CfopReferenceConfidence = "heuristic-reference";

export interface CfopSplitShares {
  Cross: number;
  F2L: number;
  OLL: number;
  PLL: number;
}

export interface CfopBenchmarkReference {
  id: "cubeskills-split-reference";
  version: typeof CFOP_REFERENCE_VERSION;
  label: string;
  rangeLabel: string;
  minAvgMs: number;
  maxAvgMs: number;
  shares: CfopSplitShares;
  confidence: CfopReferenceConfidence;
  source: {
    label: string;
    url: string;
    accessedAt: string;
    scope: string;
  };
  caveat: string;
}

/**
 * Community-derived reference: 12 : 50 : 16.5 : 21.5.
 * Values are shares of the four-phase execution total and sum to 1.
 * The article supports the educational use and scope of split references; the
 * exact ratio is retained here as a community heuristic, not as a statistic
 * published or validated as a universal/tier-specific norm by CubeSkills.
 */
export const CFOP_BENCHMARKS: readonly CfopBenchmarkReference[] = [
  {
    id: "cubeskills-split-reference",
    version: CFOP_REFERENCE_VERSION,
    label: "CFOP reference split",
    rangeLabel: "8–60 s",
    minAvgMs: 8_000,
    maxAvgMs: 60_000,
    shares: {
      Cross: 0.12,
      F2L: 0.5,
      OLL: 0.165,
      PLL: 0.215,
    },
    confidence: "heuristic-reference",
    source: {
      label: "CubeSkills · CFOP Solve Splits Tool",
      url: "https://www.cubeskills.com/blog/cfop-solve-splits-tool",
      accessedAt: "2026-08-01",
      scope: "Educational comparison assembled from average split times; not a public aggregate by tier.",
    },
    caveat:
      "Use this to spot a possible area for practice, not to grade a solve. The ratio is a community-derived heuristic; scramble, recognition, method knowledge, skips, extended crosses, and OLS can change the split.",
  },
] as const;

/**
 * Return the reference only inside the source's stated practical range.
 * Outside it, the UI should prefer the user's own baseline rather than
 * implying that the reference is valid for advanced or incomplete profiles.
 */
export function getCfopBenchmark(avgMs: number): CfopBenchmarkReference | null {
  if (!Number.isFinite(avgMs)) return null;
  return CFOP_BENCHMARKS.find(
    (benchmark) => avgMs >= benchmark.minAvgMs && avgMs <= benchmark.maxAvgMs,
  ) ?? null;
}
