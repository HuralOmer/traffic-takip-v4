/**
 * Presence Service
 * Manages user presence (join, beat, leave)
 */
import { RedisAdapter } from '../adapters/redis.js';
import type { JoinPayload, BeatPayload, LeavePayload } from '../../types/Messages.js';
import type { PresenceData } from '../../types/ActiveUser.js';
import { formatTimestamp, getRelativeTime } from '../utils/timestamp.js';
import { PlatformDetector } from '../utils/platform-detector.js';
export class PresenceService {
  private redis: RedisAdapter;
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map(); // 🆕 Shared timer map (DEPRECATED - will be removed)
  private staleCleanupInterval: NodeJS.Timeout | null = null; // 🆕 Stale session cleanup job (DEPRECATED - will be removed)
  
  constructor(redis: RedisAdapter) {
    this.redis = redis;
    
    // 🆕 Start stale session cleanup job (every 5 minutes) - DEPRECATED
    this.startStaleSessionCleanup();
  }

  /**
   * Get Redis client for direct access
   */
  getRedisClient() {
    return this.redis.getRedisClient();
  }
  /**
   * 🆕 Set disconnect timer (from WebSocket)
   */
  setDisconnectTimer(customerId: string, sessionId: string, timer: NodeJS.Timeout): void {
    const sessionKey = `${customerId}:${sessionId}`;
    this.disconnectTimers.set(sessionKey, timer);
  }
  /**
   * 🆕 Cancel disconnect timer (from JOIN or WebSocket auth)
   */
  cancelDisconnectTimer(customerId: string, sessionId: string, silent: boolean = false): boolean {
    const sessionKey = `${customerId}:${sessionId}`;
    const existingTimer = this.disconnectTimers.get(sessionKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectTimers.delete(sessionKey);
      if (!silent) {
              }
      return true; // Timer iptal edildi
    }
    return false; // Timer yoktu
  }
  /**
   * 🆕 Get Redis key TTL (for disconnect cleanup decision)
   * Returns:
   * - TTL in seconds if key exists and has TTL
   * - -1 if key exists but has no TTL
   * - -2 if key doesn't exist
   */
  async getKeyTTL(customerId: string, sessionId: string): Promise<number> {
    return await this.redis.getKeyTTL(customerId, sessionId);
  }
  /**
   * Handle user join
   * ✅ ZSET-based session management with platform-specific delays
   */
  async handleJoin(payload: JoinPayload): Promise<void> {
    const now = Date.now();
    
    // Detect platform from user agent (if available)
    const userAgent = payload.userAgent || 'desktop';
    const platform = PlatformDetector.detectPlatform(userAgent);
    const sessionMode = payload.session_mode || 'active';
    
    // Get platform-specific configuration
    const config = PlatformDetector.getConfig(platform, sessionMode);
    
    // Cancel any pending disconnect timer (DEPRECATED - will be removed)
    this.cancelDisconnectTimer(payload.customerId, payload.sessionId);
    
    // ✅ CRITICAL FIX: If some fields are missing (e.g., from TTL refresh in polling mode),
    // preserve existing values from Redis
    const existing = await this.redis.getPresence(payload.customerId, payload.sessionId);
    
    const presenceData: PresenceData = {
      customerId: payload.customerId,
      sessionId: payload.sessionId,
      tabId: payload.tabId,
      isLeader: true,
      // Device Info - preserve existing if not provided
      platform: payload.platform || existing?.platform,
      browser: payload.browser || existing?.browser,
      device: payload.device || existing?.device,
      desktop_mode: payload.desktop_mode !== undefined ? payload.desktop_mode : existing?.desktop_mode,
      // Tab Tracking - preserve existing if not provided
      total_tab_quantity: payload.total_tab_quantity !== undefined ? payload.total_tab_quantity : existing?.total_tab_quantity,
      total_backgroundTab_quantity: payload.total_backgroundTab_quantity !== undefined ? payload.total_backgroundTab_quantity : existing?.total_backgroundTab_quantity,
      // Session Mode - preserve existing if not provided, default to 'active'
      session_mode: sessionMode,
      // Timestamps
      createdAt: existing?.createdAt || formatTimestamp(now),
      updatedAt: formatTimestamp(now),
      lastActivity: 'just now',
    };
    await this.redis.setPresence(presenceData);
    
    // Simple Redis operations - no ZSET needed
    
    // Log with timestamp
    const sessionTime = formatTimestamp(now);
    const desktopModeWarning = presenceData.desktop_mode ? ' 🚨 DESKTOP MODE ACTIVE' : '';
    const tabInfo = presenceData.total_tab_quantity ? ` | Tabs: ${presenceData.total_tab_quantity} (${presenceData.total_backgroundTab_quantity} bg)` : '';
    const sessionModeInfo = presenceData.session_mode ? ` | Mode: ${presenceData.session_mode}` : '';
    const platformInfo = ` | Platform: ${platform} (${presenceData.platform}/${presenceData.browser}/${presenceData.device})`;
    console.log(`[Presence] ✅ JOIN | ${payload.sessionId.substring(0, 8)} | ${sessionTime}${desktopModeWarning}${tabInfo}${sessionModeInfo}${platformInfo}`);
  }
  /**
   * Handle heartbeat (beat)
   * Updates existing presence without resetting TTL, or creates new one if not exists
   */
  async handleBeat(payload: BeatPayload): Promise<void> {
    const now = Date.now();
    
    // Check if presence exists
    const existing = await this.redis.getPresence(payload.customerId, payload.sessionId);
    
    if (existing) {
      // Update existing presence with KEEPTTL
      const updatedData: PresenceData = {
        ...existing,
        tabId: payload.tabId,
        updatedAt: formatTimestamp(now),
        lastActivity: getRelativeTime(now),
      };
      
      await this.redis.updatePresence(updatedData);
      
      const beatTime = formatTimestamp(now);
    } else {
      // Create new presence if not exists (fallback scenario)
      const platform = PlatformDetector.detectPlatform(payload.userAgent || 'desktop');
      const sessionMode = 'active';
      const config = PlatformDetector.getConfig(platform, sessionMode);
      
      const presenceData: PresenceData = {
        customerId: payload.customerId,
        sessionId: payload.sessionId,
        tabId: payload.tabId,
        isLeader: true,
        createdAt: formatTimestamp(now),
        updatedAt: formatTimestamp(now),
        lastActivity: 'just now',
        session_mode: sessionMode,
      };
      
      await this.redis.setPresence(presenceData);
      
      // Simple Redis operations - no ZSET needed
      
      const beatTime = formatTimestamp(now);
    }
  }
  /**
   * Handle user leave
   * ✅ ZSET-based immediate removal with platform-specific delays
   */
  async handleLeave(payload: LeavePayload): Promise<boolean> {
    const leaveTime = formatTimestamp(payload.timestamp);
    
    // Check if session exists in Redis
    const exists = await this.redis.hasPresence(payload.customerId, payload.sessionId);
    if (!exists) {
      console.log(`[Presence] ❌ LEAVE | ${payload.sessionId.substring(0, 8)} | ${leaveTime} | Session NOT found in Redis`);
      return false;
    }
    
    // Detect platform for removal delay
    const platform = PlatformDetector.detectPlatform(payload.userAgent || 'desktop');
    const removalDelay = PlatformDetector.getRemovalDelay(platform);
    
    const modeInfo = payload.mode === 'final' ? 'FINAL' : 'PENDING';
    console.log(`[Presence] ❌ LEAVE | ${payload.sessionId.substring(0, 8)} | ${leaveTime} | Mode: ${modeInfo} | Reason: ${payload.reason}`);
    
    // Direct removal - no ZSET needed
    await this.redis.removePresence(payload.customerId, payload.sessionId);
    
    console.log(`[Presence] ✅ Session removed from Redis successfully`);
    
    return true; // Session removed
  }
  /**
   * 🆕 Refresh TTL for active user (WebSocket heartbeat)
   */
  async refreshTTL(customerId: string, sessionId: string, tabId: string, sessionMode?: 'active' | 'passive_active'): Promise<void> {
    // Update session_mode if provided
    if (sessionMode) {
      const existing = await this.redis.getPresence(customerId, sessionId);
      if (existing && existing.session_mode !== sessionMode) {
        const updatedData: PresenceData = {
          ...existing,
          session_mode: sessionMode,
          updatedAt: formatTimestamp(Date.now()),
        };
        await this.redis.updatePresence(updatedData);
      }
    }
    
    await this.redis.refreshTTL(customerId, sessionId);
  }
  /**
   * Get active user count for customer
   */
  async getActiveCount(customerId: string): Promise<number> {
    return await this.redis.getActiveCount(customerId);
  }
  /**
   * 🆕 Get presence data for a session
   * Used for device/platform detection in WebSocket
   */
  async getPresence(customerId: string, sessionId: string): Promise<PresenceData | null> {
    return await this.redis.getPresence(customerId, sessionId);
  }
  /**
   * 🆕 Remove presence (for WebSocket disconnect cleanup)
   */
  async removePresence(customerId: string, sessionId: string): Promise<void> {
    await this.redis.removePresence(customerId, sessionId);
  }
  /**
   * Get active sessions for customer
   */
  async getActiveSessions(customerId: string): Promise<string[]> {
    return await this.redis.getActiveSessions(customerId);
  }
  /**
   * 🆕 Start stale session cleanup job
   * Runs every 5 minutes and removes sessions with no activity for 15+ minutes
   */
  private startStaleSessionCleanup(): void {
    // Run immediately on startup
    this.runStaleSessionCleanup();
    // Then run every 5 minutes
    this.staleCleanupInterval = setInterval(() => {
      this.runStaleSessionCleanup();
    }, 5 * 60 * 1000); // 5 minutes
  }
  /**
   * 🆕 Run stale session cleanup
   * Checks all presence keys and removes those inactive for 15+ minutes
   */
  private async runStaleSessionCleanup(): Promise<void> {
    try {
            const staleThreshold = 15 * 60 * 1000; // 15 minutes in milliseconds
      const now = Date.now();
      // Get all presence keys
      const allKeys = await this.redis.getAllPresenceKeys();
      if (allKeys.length === 0) {
                return;
      }
            let staleCount = 0;
      for (const key of allKeys) {
        try {
          // Extract customerId and sessionId from key
          // Key format: "presence:customerId:sessionId"
          const parts = key.split(':');
          if (parts.length !== 3) continue;
          const customerId = parts[1];
          const sessionId = parts[2];
          // Type guard: Ensure both values exist
          if (!customerId || !sessionId) continue;
          // Get presence data
          const presenceData = await this.redis.getPresence(customerId, sessionId);
          if (!presenceData) {
            continue; // Key might have been deleted
          }
          // Parse updatedAt timestamp (ISO 8601 format: "2025-01-17T15:30:45.123Z")
          const updatedAt = new Date(presenceData.updatedAt).getTime();
          if (isNaN(updatedAt)) {
            console.warn(`[Presence] ⚠️ Invalid timestamp for ${sessionId}: ${presenceData.updatedAt}`);
            continue;
          }
          const timeSinceUpdate = now - updatedAt;
          // Check if session is stale (no activity for 15+ minutes)
          if (timeSinceUpdate > staleThreshold) {
            const minutesInactive = Math.floor(timeSinceUpdate / 60000);
            // Format timestamps in Turkish-friendly format
            const lastActivityTime = new Date(updatedAt).toLocaleString('tr-TR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            });
            const removedTime = new Date(now).toLocaleString('tr-TR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            });
                                                            await this.redis.removePresence(customerId, sessionId);
            staleCount++;
          }
        } catch (error) {
          console.error(`[Presence] Error checking key ${key}:`, error);
        }
      }
      if (staleCount > 0) {
      } else {
              }
    } catch (error) {
      console.error('[Presence] Error during stale session cleanup:', error);
    }
  }
  /**
   * 🆕 Stop stale session cleanup job (for cleanup)
   */
  stopStaleSessionCleanup(): void {
    if (this.staleCleanupInterval) {
      clearInterval(this.staleCleanupInterval);
      this.staleCleanupInterval = null;
          }
  }

  // ==================== ZSET SCHEDULER METHODS ====================

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
