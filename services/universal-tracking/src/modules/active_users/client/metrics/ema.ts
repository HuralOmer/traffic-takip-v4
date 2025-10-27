/**
 * EMA (Exponential Moving Average) Calculator
 * Client-side smoothing for UI rendering
 */
export class EMACalculator {
  private alpha: number;
  private currentEMA: number | null = null;
  private values: number[] = [];
  private windowSize: number;
  constructor(alpha: number = 0.2, windowSize: number = 20) {
    this.alpha = alpha;
    this.windowSize = windowSize;
  }
  /**
   * Add new value and calculate EMA
   */
  update(value: number): number {
    if (this.currentEMA === null) {
      // First value
      this.currentEMA = value;
    } else {
      // EMA formula: EMA_t = α * value + (1-α) * EMA_{t-1}
      this.currentEMA = this.alpha * value + (1 - this.alpha) * this.currentEMA;
    }
    // Keep history for optional calculations
    this.values.push(value);
    if (this.values.length > this.windowSize) {
      this.values.shift();
    }
    return this.currentEMA;
  }
  /**
   * Get current EMA value
   */
  getValue(): number | null {
    return this.currentEMA;
  }
  /**
   * Get rounded EMA value
   */
  getRounded(): number {
    return this.currentEMA !== null ? Math.round(this.currentEMA) : 0;
  }
  /**
   * Reset EMA calculation
   */
  reset(): void {
    this.currentEMA = null;
    this.values = [];
  }
  /**
   * Get change rate (trend)
   */
  getTrend(): 'up' | 'down' | 'stable' {
    if (this.values.length < 2) return 'stable';
    const recent = this.values[this.values.length - 1];
    const previous = this.values[this.values.length - 2];
    if (recent === undefined || previous === undefined) return 'stable';
    const diff = recent - previous;
    if (Math.abs(diff) < 1) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }
  /**
   * Update alpha value
   */
  setAlpha(alpha: number): void {
    if (alpha > 0 && alpha < 1) {
      this.alpha = alpha;
    }
  }
}
