/**
 * Metrics Sampler
 * Throttles UI updates to prevent excessive rendering
 */
export class MetricsSampler {
  private lastUpdateTime: number = 0;
  private throttleMs: number;
  constructor(throttleMs: number = 1000) {
    this.throttleMs = throttleMs;
  }
  /**
   * Check if update should be processed
   */
  shouldUpdate(): boolean {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    if (timeSinceLastUpdate >= this.throttleMs) {
      this.lastUpdateTime = now;
      return true;
    }
    return false;
  }
  /**
   * Force next update
   */
  forceUpdate(): void {
    this.lastUpdateTime = 0;
  }
  /**
   * Update throttle interval
   */
  setThrottle(throttleMs: number): void {
    this.throttleMs = throttleMs;
  }
}
