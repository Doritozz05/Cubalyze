import type { SolveTimeline, RedundancyResult, RedundancyPattern } from '@cubalyze/types';

/**
 * Detects redundant and inefficient move patterns in a solve timeline.
 *
 * Patterns detected:
 *   - Cancellations: R followed by R' (moves that undo each other)
 *   - Repetitions: U U (two identical moves that could be one U2)
 *   - Half-turns: any 180° move counted as potentially overshot
 */
export class RedundancyDetector {
  /**
   * Analyze a solve timeline for redundant move patterns.
   *
   * @param timeline - The annotated SolveTimeline.
   * @returns RedundancyResult with all detected patterns.
   */
  static analyze(timeline: SolveTimeline): RedundancyResult {
    const { entries } = timeline;

    if (entries.length === 0) {
      return {
        totalRedundancies: 0,
        cancellations: 0,
        repetitions: 0,
        halfTurns: 0,
        redundancyRate: 0,
        patterns: [],
      };
    }

    const patterns: RedundancyPattern[] = [];
    let cancellations = 0;
    let repetitions = 0;
    let halfTurns = 0;

    for (let i = 0; i < entries.length; i++) {
      const move = entries[i].move;

      // Count half-turns
      if (move.direction === 2) {
        halfTurns++;
        patterns.push({
          startIndex: i,
          endIndex: i,
          type: 'half-turn',
          description: `${move.face}2 at position ${i}`,
        });
      }

      // Check adjacent pairs
      if (i < entries.length - 1) {
        const nextMove = entries[i + 1].move;

        // Cancellation: same face, opposite direction, not 180°
        if (
          move.face === nextMove.face &&
          move.direction === -nextMove.direction &&
          Math.abs(move.direction) === 1
        ) {
          cancellations++;
          patterns.push({
            startIndex: i,
            endIndex: i + 1,
            type: 'cancellation',
            description: `${move.face} ${RedundancyDetector.dirStr(move.direction)} → ${nextMove.face} ${RedundancyDetector.dirStr(nextMove.direction)}`,
          });
        }

        // Repetition: same face, same direction (not 180°)
        if (
          move.face === nextMove.face &&
          move.direction === nextMove.direction &&
          Math.abs(move.direction) === 1
        ) {
          repetitions++;
          patterns.push({
            startIndex: i,
            endIndex: i + 1,
            type: 'repetition',
            description: `${move.face} ${RedundancyDetector.dirStr(move.direction)} repeated at positions ${i}-${i + 1}`,
          });
        }
      }
    }

    const totalRedundancies = cancellations + repetitions;
    const redundancyRate = entries.length > 0
      ? Math.round((totalRedundancies / entries.length) * 1000) / 1000
      : 0;

    return {
      totalRedundancies,
      cancellations,
      repetitions,
      halfTurns,
      redundancyRate,
      patterns,
    };
  }

  /**
   * Get the top N most impactful redundancies by pattern type.
   */
  static topPatterns(
    result: RedundancyResult,
    limit = 5,
  ): RedundancyPattern[] {
    return result.patterns.slice(0, limit);
  }

  private static dirStr(direction: number): string {
    if (direction === -1) return "'";
    if (direction === 2) return '2';
    return '';
  }
}
