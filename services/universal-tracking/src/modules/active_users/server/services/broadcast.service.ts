/**
 * Broadcast Service
 * Broadcasts metrics updates via WebSocket and Redis Pub/Sub
 */
import { RedisAdapter } from '../adapters/redis.js';
import type { MetricsUpdate } from '../../types/Messages.js';
export class BroadcastService {
  private redis: RedisAdapter;
  private wsClients: Map<string, Set<any>> = new Map(); // customerId -> Set<WebSocket>
  constructor(redis: RedisAdapter) {
    this.redis = redis;
  }
  /**
   * Register WebSocket client
   */
  registerClient(customerId: string, ws: any): void {
    if (!this.wsClients.has(customerId)) {
      this.wsClients.set(customerId, new Set());
    }
    this.wsClients.get(customerId)!.add(ws);
      }
  /**
   * Unregister WebSocket client
   */
  unregisterClient(customerId: string, ws: any): void {
    const clients = this.wsClients.get(customerId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.wsClients.delete(customerId);
      }
    }
      }
  /**
   * Broadcast metrics update to all clients
   */
  async broadcastMetrics(customerId: string, count: number, ema: number): Promise<void> {
    const metricsUpdate: MetricsUpdate = {
      customerId,
      timestamp: Date.now(),
      count,
      ema,
    };
    // Broadcast via WebSocket
    await this.broadcastViaWebSocket(customerId, metricsUpdate);
    // Broadcast via Redis Pub/Sub (for multi-server setup)
    await this.broadcastViaPubSub(customerId, metricsUpdate);
  }
  /**
   * Broadcast via WebSocket
   */
  private async broadcastViaWebSocket(customerId: string, metrics: MetricsUpdate): Promise<void> {
    const clients = this.wsClients.get(customerId);
    if (!clients || clients.size === 0) return;
    const message = JSON.stringify({
      type: 'metrics:update',
      data: metrics,
    });
    clients.forEach((ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });
      }
  /**
   * Broadcast via Redis Pub/Sub
   */
  private async broadcastViaPubSub(customerId: string, metrics: MetricsUpdate): Promise<void> {
    await this.redis.publishMetrics(customerId, metrics);
  }
  /**
   * Get client count for customer
   */
  getClientCount(customerId: string): number {
    return this.wsClients.get(customerId)?.size ?? 0;
  }
  /**
   * Get total client count
   */
  getTotalClientCount(): number {
    let total = 0;
    this.wsClients.forEach((clients) => {
      total += clients.size;
    });
    return total;
  }
  /**
   * Cleanup
   */
  destroy(): void {
    this.wsClients.clear();
  }
}
