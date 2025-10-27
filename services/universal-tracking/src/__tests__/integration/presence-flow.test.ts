/**
 * Integration Tests for Presence Flow (Join → Beat → Leave)
 */

import { RedisAdapter } from '../../modules/active_users/server/adapters/redis.js';
import { PresenceService } from '../../modules/active_users/server/services/presence.service.js';

describe('Presence Flow Integration', () => {
  let redisAdapter: RedisAdapter;
  let presenceService: PresenceService;
  let mockRedisClient: any;

  beforeEach(() => {
    // Mock Redis client
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      scan: jest.fn().mockResolvedValue(['0', []]),
    };

    redisAdapter = new RedisAdapter(mockRedisClient, 180);
    presenceService = new PresenceService(redisAdapter);
  });

  describe('Join Flow', () => {
    it('should handle join event successfully', async () => {
      const joinData = {
        customerId: 'test-customer',
        sessionId: 'sess_123',
        tabId: 'tab_456',
        timestamp: Date.now(),
        isLeader: true,
        platform: 'desktop',
        userAgent: 'Mozilla/5.0',
      };

      await presenceService.handleJoin(joinData);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'presence:test-customer:sess_123',
        expect.stringContaining('sess_123'),
        'EX',
        180
      );
    });

    it('should create presence with correct TTL', async () => {
      const joinData = {
        customerId: 'test-customer',
        sessionId: 'sess_123',
        tabId: 'tab_456',
        timestamp: Date.now(),
        isLeader: true,
        platform: 'desktop',
        userAgent: 'Mozilla/5.0',
      };

      await presenceService.handleJoin(joinData);

      const setCall = mockRedisClient.set.mock.calls[0];
      expect(setCall[2]).toBe('EX'); // EX flag
      expect(setCall[3]).toBe(180);  // TTL in seconds
    });
  });

  describe('Beat Flow', () => {
    it('should update existing presence without resetting TTL', async () => {
      // Existing presence
      const existingPresence = {
        customerId: 'test-customer',
        sessionId: 'sess_123',
        tabId: 'tab_456',
        timestamp: Date.now() - 10000,
        isLeader: true,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingPresence));

      const beatData = {
        customerId: 'test-customer',
        sessionId: 'sess_123',
        tabId: 'tab_456',
        timestamp: Date.now(),
      };

      await presenceService.handleBeat(beatData);

      // Should use KEEPTTL
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'presence:test-customer:sess_123',
        expect.any(String),
        'KEEPTTL'
      );
    });

    it('should create new presence if not exists', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const beatData = {
        customerId: 'test-customer',
        sessionId: 'sess_123',
        tabId: 'tab_456',
        timestamp: Date.now(),
      };

      await presenceService.handleBeat(beatData);

      // Should set with TTL (new session)
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'presence:test-customer:sess_123',
        expect.any(String),
        'EX',
        180
      );
    });
  });

  describe('Leave Flow', () => {
    it('should remove presence on leave', async () => {
      const leaveData = {
        customerId: 'test-customer',
        sessionId: 'sess_123',
        tabId: 'tab_456',
        timestamp: Date.now(),
      };

      await presenceService.handleLeave(leaveData);

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'presence:test-customer:sess_123'
      );
    });

    it('should handle leave for non-existent session', async () => {
      mockRedisClient.del.mockResolvedValue(0); // Key didn't exist

      const leaveData = {
        customerId: 'test-customer',
        sessionId: 'sess_nonexistent',
        tabId: 'tab_456',
        timestamp: Date.now(),
      };

      await expect(presenceService.handleLeave(leaveData)).resolves.not.toThrow();
    });
  });

  describe('Complete Flow: Join → Beat → Leave', () => {
    it('should handle full user session lifecycle', async () => {
      const customerId = 'test-customer';
      const sessionId = 'sess_full_flow';
      const tabId = 'tab_123';

      // 1. JOIN
      await presenceService.handleJoin({
        customerId,
        sessionId,
        tabId,
        timestamp: Date.now(),
        platform: 'desktop',
        userAgent: 'Mozilla/5.0',
      } as any);

      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `presence:${customerId}:${sessionId}`,
        expect.any(String),
        'EX',
        180
      );

      // 2. BEAT (simulate existing session)
      const existingData = {
        customerId,
        sessionId,
        tabId,
        timestamp: Date.now(),
        isLeader: true,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingData));

      await presenceService.handleBeat({
        customerId,
        sessionId,
        tabId,
        timestamp: Date.now(),
      });

      expect(mockRedisClient.set).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.set).toHaveBeenLastCalledWith(
        `presence:${customerId}:${sessionId}`,
        expect.any(String),
        'KEEPTTL'
      );

      // 3. LEAVE
      await presenceService.handleLeave({
        customerId,
        sessionId,
        tabId,
        timestamp: Date.now(),
      });

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `presence:${customerId}:${sessionId}`
      );
    });
  });

  describe('Multi-Session Scenarios', () => {
    it('should handle multiple sessions independently', async () => {
      const customerId = 'test-customer';

      // Session 1 joins
      await presenceService.handleJoin({
        customerId,
        sessionId: 'sess_1',
        tabId: 'tab_1',
        timestamp: Date.now(),
        platform: 'desktop',
        userAgent: 'Mozilla/5.0',
      } as any);

      // Session 2 joins
      await presenceService.handleJoin({
        customerId,
        sessionId: 'sess_2',
        tabId: 'tab_2',
        timestamp: Date.now(),
        platform: 'mobile',
        userAgent: 'Mobile Safari',
      } as any);

      expect(mockRedisClient.set).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.set).toHaveBeenNthCalledWith(
        1,
        'presence:test-customer:sess_1',
        expect.any(String),
        'EX',
        180
      );
      expect(mockRedisClient.set).toHaveBeenNthCalledWith(
        2,
        'presence:test-customer:sess_2',
        expect.any(String),
        'EX',
        180
      );
    });
  });
});

