/**
 * Active Users Server
 * Main server-side entry point
 */
import type { FastifyInstance } from 'fastify';
import type { WebSocketServer as WSServer } from 'ws';
import { RedisAdapter } from './adapters/redis.js';
import { PresenceService } from './services/presence.service.js';
import { EMAService } from './services/ema.service.js';
import { BroadcastService } from './services/broadcast.service.js';
import { setupRESTEndpoints } from './transports/rest.js';
import { WebSocketServer } from './transports/websocket.js';
import { mergeServerConfig } from './config.js';
import { MultiTierRateLimiter } from './utils/rate-limit.js';
import type { ServerConfig } from '../types/Config.js';
export class ActiveUsersServer {
  private config: Required<ServerConfig>;
  private redis: RedisAdapter;
  private presenceService: PresenceService;
  private emaService: EMAService;
  private broadcastService: BroadcastService;
  private rateLimiter: MultiTierRateLimiter;
  private wsServer: WebSocketServer | null = null;
  constructor(redisClient: any, config: Partial<ServerConfig> = {}) {
    this.config = mergeServerConfig(config);
    // Initialize adapters
    this.redis = new RedisAdapter(redisClient, this.config.presenceTTL);
    // Initialize services
    this.presenceService = new PresenceService(this.redis);
    this.emaService = new EMAService(
      this.redis,
      this.config.emaAlpha,
      this.config.emaUpdateInterval
    );
    this.broadcastService = new BroadcastService(this.redis);
    // Initialize rate limiter
    this.rateLimiter = this.createRateLimiter();
  }
  /**
   * Create multi-tier rate limiter with different limits
   */
  private createRateLimiter(): MultiTierRateLimiter {
    const limiter = new MultiTierRateLimiter();
    // Per-IP limit (tek cihaz koruması)
    limiter.addLimiter('ip', {
      windowMs: 60000, // 1 dakika
      maxRequests: 100, // Tek cihazdan max 100 istek/dakika
      keyGenerator: (req) => req.ip || 'unknown',
    });
    // Per-Customer limit (müşteri bazlı)
    limiter.addLimiter('customer', {
      windowMs: 60000, // 1 dakika
      maxRequests: this.config.maxRequestsPerMinute || 5000, // 5000 istek/dakika
      keyGenerator: (req) => req.body?.customerId || 'anonymous',
    });
    return limiter;
  }
  /**
   * Register REST endpoints
   */
  registerRESTEndpoints(fastify: FastifyInstance): void {
    setupRESTEndpoints(fastify, this.presenceService, this.emaService, this.rateLimiter);
  }
  /**
   * Register WebSocket server
   */
  registerWebSocketServer(wss: WSServer): void {
    // ✅ PHASE 1: Inject presenceService for TTL refresh
    this.wsServer = new WebSocketServer(wss, this.broadcastService, this.presenceService);
  }
  /**
   * Start EMA calculation for a customer
   */
  startEMACalculation(customerId: string): void {
    this.emaService.startCalculation(customerId, async (ema, count) => {
      // Broadcast updated metrics
      await this.broadcastService.broadcastMetrics(customerId, count, ema);
    });
  }
  /**
   * Stop EMA calculation for a customer
   */
  stopEMACalculation(customerId: string): void {
    this.emaService.stopCalculation(customerId);
  }
  /**
   * Get active user count for customer
   */
  async getActiveCount(customerId: string): Promise<number> {
    return await this.presenceService.getActiveCount(customerId);
  }
  /**
   * Get EMA for customer
   */
  async getEMA(customerId: string): Promise<number> {
    return await this.emaService.getEMA(customerId);
  }
  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    this.emaService.destroy();
    this.broadcastService.destroy();
    this.rateLimiter.destroy();
    if (this.wsServer) {
      this.wsServer.close();
    }
    // Cleanup Redis adapter (subscribers)
    await this.redis.destroy();
  }
  /**
   * Get rate limiter (for custom configuration)
   */
  getRateLimiter(): MultiTierRateLimiter {
    return this.rateLimiter;
  }
  /**
   * Get health statistics (for monitoring)
   */
  getHealthStats(): {
    subscribers: number;
    wsClients: number;
    emaIntervals: number;
  } {
    return {
      subscribers: this.redis.getSubscriberCount(),
      wsClients: this.broadcastService.getTotalClientCount(),
      emaIntervals: 0, // EMA service doesn't expose this yet
    };
  }
}
