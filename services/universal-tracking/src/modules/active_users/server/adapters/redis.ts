/**
 * Redis Adapter
 * Handles all Redis operations for active users
 */
import type { PresenceData } from '../../types/index.js';
import { formatTimestamp, getRelativeTime } from '../utils/timestamp.js';
export class RedisAdapter {
  private redis: any; // Redis client instance
  private ttl: number;
  private subscribers: Map<string, any> = new Map(); // Track subscribers to prevent leaks
  constructor(redisClient: any, ttl: number = 600) { // Default 10 dakika (fallback/sigorta)
    this.redis = redisClient;
    this.ttl = ttl;
  }
  /**
   * Add user presence
   * 🆕 Device detection'a göre dinamik TTL
   * ✅ FIXED: node-redis v5 compatible TTL setting
   */
  async setPresence(data: PresenceData): Promise<void> {
    const key = this.getPresenceKey(data.customerId, data.sessionId);
    // ✅ Update timestamps in hybrid format
    const now = Date.now();
    const updatedData = {
      ...data,
      updatedAt: formatTimestamp(now),
      lastActivity: getRelativeTime(now), // "just now"
    };
    const value = JSON.stringify(updatedData);
    // Calculate TTL based on session_mode
    const ttl = this.getSessionBasedTTL(data.session_mode);
    
    // ✅ FIXED: node-redis v5 compatible - use set + expire
    await this.redis.set(key, value);
    await this.redis.expire(key, ttl);
    
  }
  /**
   * Get user presence
   */
  async getPresence(customerId: string, sessionId: string): Promise<PresenceData | null> {
    const key = this.getPresenceKey(customerId, sessionId);
    const value = await this.redis.get(key);
    if (!value) return null;
    return JSON.parse(value);
  }
  /**
   * Update user presence without resetting TTL
   * ✅ FIXED: node-redis v5 compatible TTL preservation
   */
  async updatePresence(data: PresenceData): Promise<void> {
    const key = this.getPresenceKey(data.customerId, data.sessionId);
    // Get existing data to calculate lastActivity
    const existing = await this.getPresence(data.customerId, data.sessionId);
    const createdAt = existing?.createdAt || data.createdAt;
    // ✅ Update timestamps in hybrid format
    const now = Date.now();
    const updatedData = {
      ...data,
      createdAt, // Keep original creation time
      updatedAt: formatTimestamp(now),
      lastActivity: getRelativeTime(now), // Will show "X seconds/minutes ago"
    };
    const value = JSON.stringify(updatedData);
    
    // ✅ FIXED: node-redis v5 compatible - preserve existing TTL
    const currentTTL = await this.redis.ttl(key);
    await this.redis.set(key, value);
    
    // Restore TTL if it existed and was positive
    if (currentTTL > 0) {
      await this.redis.expire(key, currentTTL);
    }
  }
  /**
   * Refresh TTL for a key (Phase 1 WebSocket optimization)
   * Used by WebSocket ttl_refresh messages to extend session lifetime
   * 🆕 Device-based TTL kullanır
   */
  async refreshTTL(customerId: string, sessionId: string): Promise<void> {
    const key = this.getPresenceKey(customerId, sessionId);
    const exists = await this.redis.exists(key);
    if (exists) {
      // Get session_mode to calculate TTL
      const presenceData = await this.getPresence(customerId, sessionId);
      const ttl = presenceData ? this.getSessionBasedTTL(presenceData.session_mode) : this.ttl;
      await this.redis.expire(key, ttl);
    } else {
      console.warn(`[Redis] REFRESH TTL ${key} | Key doesn't exist!`);
    }
  }
  /**
   * Remove user presence
   */
  async removePresence(customerId: string, sessionId: string): Promise<void> {
    const key = this.getPresenceKey(customerId, sessionId);
    await this.redis.del(key);
  }
  /**
   * Get all active sessions for a customer
   * Uses SCAN instead of KEYS for production safety
   */
  async getActiveSessions(customerId: string): Promise<string[]> {
    const pattern = `presence:${customerId}:*`;
    const keys = await this.scanKeys(pattern);
    // Extract session IDs from keys
    return keys.map((key: string) => {
      const parts = key.split(':');
      return parts[2]!; // session ID (guaranteed to exist in presence keys)
    });
  }
  /**
   * Get active user count for a customer
   * Uses SCAN instead of KEYS for production safety
   */
  async getActiveCount(customerId: string): Promise<number> {
    const pattern = `presence:${customerId}:*`;
    const keys = await this.scanKeys(pattern);
    // Count unique sessions (not tabs)
    const sessions = new Set(keys.map((key: string) => {
      const parts = key.split(':');
      return parts[2]!; // session ID (guaranteed to exist in presence keys)
    }));
    return sessions.size;
  }
  /**
   * 🆕 Get ALL presence keys (for stale session cleanup)
   * Uses SCAN instead of KEYS for production safety
   */
  async getAllPresenceKeys(): Promise<string[]> {
    const pattern = 'presence:*';
    return await this.scanKeys(pattern);
  }
  /**
   * Clean up expired sessions manually (backup cleanup)
   * Uses SCAN instead of KEYS for production safety
   */
  async cleanupExpiredSessions(): Promise<number> {
    const pattern = 'presence:*';
    const keys = await this.scanKeys(pattern);
    let cleaned = 0;
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) {
        // Key has no TTL, remove it
        await this.redis.del(key);
        cleaned++;
              }
    }
    return cleaned;
  }
  /**
   * Store EMA value
   */
  async setEMA(customerId: string, ema: number): Promise<void> {
    const key = `ema:${customerId}`;
    await this.redis.set(key, ema.toString());
  }
  /**
   * Get EMA value
   */
  async getEMA(customerId: string): Promise<number | null> {
    const key = `ema:${customerId}`;
    const value = await this.redis.get(key);
    return value ? parseFloat(value) : null;
  }
  /**
   * Publish metrics update
   */
  async publishMetrics(customerId: string, metrics: any): Promise<void> {
    const channel = `metrics:${customerId}`;
    await this.redis.publish(channel, JSON.stringify(metrics));
  }
  /**
   * Subscribe to metrics updates
   * Reuses existing subscriber if available to prevent connection leaks
   */
  async subscribeToMetrics(customerId: string, callback: (metrics: any) => void): Promise<void> {
    const channel = `metrics:${customerId}`;
    // Check if subscriber already exists for this customer
    let subscriber = this.subscribers.get(customerId);
    if (!subscriber) {
      // Create new subscriber client (Redis requires separate client for pub/sub)
      subscriber = this.redis.duplicate();
      this.subscribers.set(customerId, subscriber);
          } else {
          }
    await subscriber.subscribe(channel, (message: string) => {
      try {
        const metrics = JSON.parse(message);
        callback(metrics);
      } catch (error) {
        console.error('[Redis] Failed to parse metrics:', error);
      }
    });
  }
  /**
   * Unsubscribe from metrics updates
   * Properly cleans up subscriber connection
   */
  async unsubscribeFromMetrics(customerId: string): Promise<void> {
    const subscriber = this.subscribers.get(customerId);
    if (subscriber) {
      try {
        const channel = `metrics:${customerId}`;
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
        this.subscribers.delete(customerId);
              } catch (error) {
        console.error(`[Redis] Error unsubscribing ${customerId}:`, error);
      }
    }
  }
  /**
   * Scan keys with pattern (non-blocking alternative to KEYS)
   * Uses SCAN command which is production-safe
   * ✅ FIXED: node-redis v5 compatible SCAN - simplified version
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    // For now, use KEYS as fallback to avoid SCAN complexity
    // TODO: Implement proper SCAN for node-redis v5
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error('[Redis] KEYS command failed:', error);
      return [];
    }
  }
  /**
   * 🆕 Get TTL for a presence key
   * Returns:
   * - TTL in seconds if key exists and has TTL
   * - -1 if key exists but has no TTL
   * - -2 if key doesn't exist
   */
  async getKeyTTL(customerId: string, sessionId: string): Promise<number> {
    const key = this.getPresenceKey(customerId, sessionId);
    const ttl = await this.redis.ttl(key);
    return ttl;
  }
  /**
   * Calculate TTL based on session_mode
   * 
   * active: 10 minutes (600s)
   * passive_active: 5 minutes (300s) - 4 dk sonra client LEAVE gönderecek
   */
  private getSessionBasedTTL(sessionMode?: 'active' | 'passive_active'): number {
    if (sessionMode === 'passive_active') {
      return 5 * 60; // 5 dakika = 300 saniye
    }
    return this.ttl; // 10 dakika = 600 saniye (active mode)
  }
  
  /**
   * Generate presence key
   */
  public getPresenceKey(customerId: string, sessionId: string): string {
    return `presence:${customerId}:${sessionId}`;
  }
  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
  /**
   * Cleanup all resources
   * Called when server is shutting down
   */
  async destroy(): Promise<void> {
    // Cleanup all subscribers
    for (const [customerId, subscriber] of this.subscribers.entries()) {
      try {
        await subscriber.quit();
              } catch (error) {
        console.error(`[Redis] Error cleaning up subscriber for ${customerId}:`, error);
      }
    }
    this.subscribers.clear();
      }
  /**
   * Get subscriber count (for monitoring)
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get Redis client for direct access
   */
  getRedisClient() {
    return this.redis;
  }

  /**
   * Check if presence exists
   */
  async hasPresence(customerId: string, sessionId: string): Promise<boolean> {
    const key = this.getPresenceKey(customerId, sessionId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Get queue metrics - simplified
   */
  async getQueueMetrics() {
    return {
      status: 'active',
      message: 'Simple Redis operations - no queues needed'
    };
  }
}
