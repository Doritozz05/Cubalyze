/**
 * Rebuild — recompute the DERIVED training aggregates
 * (`algorithm_progress`, `exercise_progress`) from the local attempt log.
 *
 * Aggregates are never synced raw (two devices would fight on counters with
 * LWW); instead every device rebuilds them from the synced immutable log via
 * the deterministic replay in @cubalyze/training. Running the REAL
 * ProgressTracker over an in-memory repo guarantees the rebuilt state is
 * identical to what the live tracker computed.
 */

import { replayProgress } from "@cubalyze/training";
import type { SyncContext } from "./types";

export async function rebuildAggregates(ctx: SyncContext): Promise<void> {
  const attempts = await ctx.training.findAttemptsAll();
  const sessions = await ctx.training.findTrainingSessionsAll();
  const { algorithmProgress, exerciseProgress } = await replayProgress(
    attempts,
    sessions
      .filter((s) => s.status === "completed")
      .map((s) => ({
        exerciseId: s.exerciseId,
        methodId: s.methodId,
        phaseId: s.phaseId,
      })),
  );
  await ctx.training.replaceAlgorithmProgress(algorithmProgress);
  await ctx.training.replaceExerciseProgress(exerciseProgress);
}
