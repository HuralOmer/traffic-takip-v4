/**
 * EMA Service
 * Server-side canonical EMA calculation
 */
import { RedisAdapter } from '../adapters/redis.js';
export class EMAService {
  private redis: RedisAdapter;
  private alpha: number;
  private updateInterval: number;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  constructor(redis: RedisAdapter, alpha: number = 0.2, updateInterval: number = 30000) {
    this.redis = redis;
    this.alpha = alpha;
    this.updateInterval = updateInterval;
  }
  /**
   * Start EMA calculation for a customer
   */
  startCalculation(customerId: string, onUpdate: (ema: number, count: number) => void): void {
    // Stop existing interval
    this.stopCalculation(customerId);
    // Start periodic EMA calculation
    const interval = setInterval(async () => {
      await this.calculateAndUpdate(customerId, onUpdate);
    }, this.updateInterval);
    this.intervals.set(customerId, interval);
  }
  /**
   * Calculate and update EMA
   */
  private async calculateAndUpdate(
    customerId: string,
    onUpdate: (ema: number, count: number) => void
  ): Promise<void> {
    try {
      // Get current active count
      const currentCount = await this.redis.getActiveCount(customerId);
      // Get previous EMA
      const previousEMA = await this.redis.getEMA(customerId);
      // Calculate new EMA
      let newEMA: number;
      if (previousEMA === null) {
        // First calculation
        newEMA = currentCount;
      } else {
        // EMA formula: EMA_t = α * current + (1-α) * EMA_{t-1}
        newEMA = this.alpha * currentCount + (1 - this.alpha) * previousEMA;
      }
      // Store new EMA
      await this.redis.setEMA(customerId, newEMA);
      // Notify callback
      onUpdate(newEMA, currentCount);
    } catch (error) {
      console.error(`[EMA] Calculation error for ${customerId}:`, error);
    }
  }
  /**
   * Stop EMA calculation for a customer
   */
  stopCalculation(customerId: string): void {
    const interval = this.intervals.get(customerId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(customerId);
    }
  }
  /**
   * Get current EMA for customer
   */
  async getEMA(customerId: string): Promise<number> {
    const ema = await this.redis.getEMA(customerId);
    return ema ?? 0;
  }
  /**
   * Update alpha value
   */
  setAlpha(alpha: number): void {
    if (alpha > 0 && alpha < 1) {
      this.alpha = alpha;
    }
  }
  /**
   * Cleanup all intervals
   */
  destroy(): void {
    this.intervals.forEach((interval, customerId) => {
      this.stopCalculation(customerId);
    });
  }
}
