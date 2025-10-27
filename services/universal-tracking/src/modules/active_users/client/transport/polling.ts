/**
 * Polling Client
 * Fallback for WebSocket, polls metrics periodically
 */
import type { MetricsResponse } from '../../types/Messages.js';
export class PollingClient {
  private apiUrl: string;
  private customerId: string;
  private interval: NodeJS.Timeout | null = null;
  private pollingInterval: number = 30000;
  private onMetrics: ((metrics: MetricsResponse) => void) | null = null;
  private isActive: boolean = false;
  constructor(apiUrl: string, customerId: string) {
    this.apiUrl = apiUrl;
    this.customerId = customerId;
  }
  start(
    intervalMs: number,
    onMetrics: (metrics: MetricsResponse) => void
  ): void {
    this.pollingInterval = intervalMs;
    this.onMetrics = onMetrics;
    this.isActive = true;
    // Stop existing
    this.stop();
    
    const intervalSec = (intervalMs / 1000).toFixed(0);
    console.log(`[Polling] 📡 Started polling mode (${intervalSec}s interval)`);
    
    // Fetch immediately
    this.fetchMetrics();
    // Then poll periodically
    this.interval = setInterval(() => {
      this.fetchMetrics();
    }, this.pollingInterval);
  }
  private async fetchMetrics(): Promise<void> {
    if (!this.onMetrics) return;
    try {
      const response = await fetch(
        `${this.apiUrl}/active-users/metrics?customerId=${this.customerId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: MetricsResponse = await response.json();
      this.onMetrics(data);
          } catch (error) {
      console.error('[Polling] Failed to fetch metrics:', error);
      // Optionally increase interval on error
      this.handleError();
    }
  }
  private handleError(): void {
    // Exponentially increase polling interval on errors
    const newInterval = Math.min(this.pollingInterval * 1.5, 300000);
    if (newInterval !== this.pollingInterval) {
            this.pollingInterval = newInterval;
      // Restart with new interval
      if (this.onMetrics) {
        this.start(newInterval, this.onMetrics);
      }
    }
  }
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isActive = false;
      console.log(`[Polling] ⏹️ Stopped polling mode`);
    }
  }
  isPolling(): boolean {
    return this.isActive;
  }
  updateInterval(intervalMs: number): void {
    this.pollingInterval = intervalMs;
    if (this.isActive && this.onMetrics) {
      this.start(intervalMs, this.onMetrics);
    }
  }
}
