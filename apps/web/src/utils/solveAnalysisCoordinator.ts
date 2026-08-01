export interface SolveAnalysisJob<TResult> {
  solveId: string;
  save: Promise<string | null>;
  analyze: () => Promise<TResult | null>;
  onResult: (result: TResult) => Promise<void> | void;
}

/**
 * Process one solve analysis job without sharing mutable state between solves.
 * The caller owns the exact save promise, so analysis cannot race the insert
 * or accidentally update another solve when jobs complete out of order.
 */
export async function processSolveAnalysisJob<TResult>(
  job: SolveAnalysisJob<TResult>,
): Promise<boolean> {
  const savedId = await job.save;
  if (savedId !== job.solveId) return false;

  const result = await job.analyze();
  if (result === null) return false;

  await job.onResult(result);
  return true;
}

/**
 * Queue processing on a later macrotask so solve completion stays responsive.
 * Errors are handled by the supplied callback rather than becoming an
 * unhandled promise rejection.
 */
export function queueSolveAnalysis<TResult>(
  job: SolveAnalysisJob<TResult>,
  onError: (error: unknown) => void,
): void {
  setTimeout(() => {
    void processSolveAnalysisJob(job).catch(onError);
  }, 0);
}
