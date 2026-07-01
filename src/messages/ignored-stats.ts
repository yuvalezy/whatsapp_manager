/**
 * In-memory counters for messages we deliberately ignore.
 *
 * The hot path (every non-whitelisted / group / broadcast message) must never
 * touch the DB or log content — it only bumps a counter here. A periodic job
 * flushes the *deltas* to `ignored_stats` (see app bootstrap).
 */
class IgnoredStats {
  private counters = new Map<string, number>();
  private flushed = new Map<string, number>();

  increment(reason: string): void {
    this.counters.set(reason, (this.counters.get(reason) ?? 0) + 1);
  }

  /** Cumulative counts since process start — used by /status. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  total(): number {
    let sum = 0;
    for (const v of this.counters.values()) sum += v;
    return sum;
  }

  /**
   * Return per-reason increments since the last flush and advance the
   * baseline. Used to persist counters without double-counting.
   */
  pendingDeltas(): Array<{ reason: string; delta: number }> {
    const out: Array<{ reason: string; delta: number }> = [];
    for (const [reason, count] of this.counters) {
      const delta = count - (this.flushed.get(reason) ?? 0);
      if (delta > 0) {
        out.push({ reason, delta });
        this.flushed.set(reason, count);
      }
    }
    return out;
  }
}

export const ignoredStats = new IgnoredStats();
