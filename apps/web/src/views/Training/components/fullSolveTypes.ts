/** A phase split with live timing data attached. */
export interface PhaseSplit {
  phaseId: string;
  phaseName: string;
  targetS: number;
  actualMs: number;
  status: "pending" | "active" | "done";
}

/** A phase split target before timing data is attached. */
export interface PhaseSplitTarget {
  phaseId: string;
  phaseName: string;
  targetS: number;
}
