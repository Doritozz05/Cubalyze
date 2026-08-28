/**
 * types.ts — Shared interfaces for the modular case detection system.
 *
 * These types are designed to be puzzle-agnostic (3×3, 2×2, Pyraminx...),
 * method-agnostic (CFOP, Roux, ZZ, Ortega...), and subset-agnostic
 * (Basic F2L, OLL, PLL, COLL...). Adding a new subset requires only
 * registering its catalog entries — no code changes to the detector.
 */

import type { ProbeKind } from './probes/types';

/**
 * One entry in the recognition catalog.
 *
 * A single Case (e.g. "F2L 1 Jb") can match against MULTIPLE slots within
 * a crossFace — the catalog stores one signature per slot, and a lookup
 * on any of them answers the same entry.
 */
export interface CatalogEntry {
  /** Method ID from methodRegistry (e.g. mid(1) = "CFOP"). */
  methodId: string;
  /** Subset ID from methodRegistry (e.g. "Basic F2L"). */
  subsetId: string;
  /** Human-readable case number (e.g. "F2L 1"). */
  caseNumber: string;
  /** BirdF2L / canonical name (e.g. "Jb"). */
  caseName: string;
  /** The setup scramble used to generate this case's state. */
  setupScramble: string;
}

/**
 * A SubsetManifest describes one algorithmic subset the detector can
 * recognize. It links a method/subset ID pair to the seed data and names
 * the PROBE whose signature family recognizes it.
 */
export interface SubsetManifest {
  methodId: string;
  subsetId: string;
  /** Human-readable label for diagnostics (e.g. "CFOP Basic F2L"). */
  label: string;
  /** The cross faces this subset can be natively built for. */
  crossFaces: string[];
  /**
   * The detection probe this subset's cases are recognized with
   * (defaults to 'f2l-slot' for backwards compatibility).
   */
  probe?: ProbeKind;
}

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * The result of detecting a case from a cube state.
 */
export interface DetectionResult {
  /** The catalog entry that matched, or null when no match was found. */
  entry: CatalogEntry | null;
  /**
   * Confidence level:
   * - 'exact': the pair's signature matched a catalog entry exactly.
   * - 'unknown': no catalog entry matched (unrecognized case or advanced F2L).
   */
  confidence: 'exact' | 'unknown';
  /** The raw signature that was looked up (for diagnostics). */
  queriedSignature: string;
  /**
   * The sticker on the U face that sits at the solver's F position in the
   * OBSERVED state (last-layer probes only). The catalog renders a case at
   * its canonical AUF; rotating the diagram by this face shows the case
   * from the solver's exact angle. Undefined for F2L detection and for
   * unknown results.
   */
  aufFace?: string;
}

// ─── Detector ────────────────────────────────────────────────────────────────

/** Options for constructing a CaseDetector. */
export interface CaseDetectorOptions {
  /** Subset manifests to index. */
  subsets: SubsetManifest[];
  /**
   * A loader function that given subsetId and crossFace returns the seed
   * case data. Decoupled so the detector never imports seed files directly.
   */
  loadCases: (subsetId: string, crossFace: string) => CaseSeedData[];
}

/** Minimal data needed from each case in the seed catalog. */
export interface CaseSeedData {
  caseNumber: string;
  caseName: string;
  setupScramble: string;
}