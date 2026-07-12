/**
 * Performs a linear regression over a window of (X, Y) timestamp pairs.
 * Used to correct clock drift between the Cube's internal hardware crystal and the PC.
 */
export class ClockDriftReconciler {
  private windowSize: number;
  private history: { cubeTs: number; hostTs: number }[] = [];

  constructor(windowSize: number = 20) {
    this.windowSize = windowSize;
  }

  /**
   * Adds a new data point to the linear regression model.
   * @param cubeTs Timestamp reported by the cube hardware
   * @param hostTs performance.now() of the browser at reception
   */
  public addDataPoint(cubeTs: number, hostTs: number) {
    this.history.push({ cubeTs, hostTs });
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
  }

  /**
   * Predicts the host timestamp for a given cube timestamp using Linear Least Squares.
   * If history is insufficient, falls back to the last known diff.
   */
  public reconcile(cubeTs: number): number {
    if (this.history.length < 2) {
      if (this.history.length === 1) {
        // Fallback to simple offset if only one point
        const offset = this.history[0].hostTs - this.history[0].cubeTs;
        return cubeTs + offset;
      }
      return cubeTs; // No history, return as is (should not happen in prod if used correctly)
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const n = this.history.length;

    for (let i = 0; i < n; i++) {
      const x = this.history[i].cubeTs;
      const y = this.history[i].hostTs;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) {
      // Degenerate case, use average offset
      return cubeTs + (sumY - sumX) / n;
    }

    // slope (m)
    const m = (n * sumXY - sumX * sumY) / denominator;
    
    // intercept (b)
    const b = (sumY - m * sumX) / n;

    return m * cubeTs + b;
  }
}
