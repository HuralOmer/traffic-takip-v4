/**
 * Integration Tests for Redis Persistence
 */

import { RedisAdapter } from '../../modules/active_users/server/adapters/redis.js';

describe('Redis Persistence Integration', () => {
  let redisAdapter: RedisAdapter;
  let mockRedisClient: any;
  let setMock: jest.Mock;
  let getMock: jest.Mock;
  let delMock: jest.Mock;
  let scanMock: jest.Mock;

  beforeEach(() => {
    setMock = jest.fn().mockResolvedValue('OK');
    getMock = jest.fn().mockResolvedValue(null);
    delMock = jest.fn().mockResolvedValue(1);
    scanMock = jest.fn().mockResolvedValue(['0', []]);

    mockRedisClient = {
      set: setMock,
      get: getMock,
      del: delMock,
      scan: scanMock,
    };

    redisAdapter = new RedisAdapter(mockRedisClient, 180);
  });

  describe('setPresence()', () => {
    it('should store presence with TTL', async () => {
      const presenceData = {
        customerId: 'customer-1',
        sessionId: 'sess-123',
        tabId: 'tab-456',
        isLeader: true,
        platform: 'desktop',
        createdAt: '2025-10-19 12:00:00',
        updatedAt: '2025-10-19 12:00:00',
        lastActivity: 'just now',
      };

      await redisAdapter.setPresence(presenceData);

      expect(setMock).toHaveBeenCalledWith(
        'presence:customer-1:sess-123',
        expect.stringContaining('sess-123'),
        'EX',
        180
      );
    });

    it('should include updatedAt timestamp', async () => {
      const presenceData = {
        customerId: 'customer-1',
        sessionId: 'sess-123',
        tabId: 'tab-456',
        isLeader: true,
        createdAt: '2025-10-19 12:00:00',
        updatedAt: '2025-10-19 12:00:00',
        lastActivity: 'just now',
      };

      await redisAdapter.setPresence(presenceData);

      const storedData = JSON.parse(setMock.mock.calls[0][1]);
      expect(storedData.updatedAt).toBeDefined();
      expect(storedData.updatedAt).toBe(presenceData.updatedAt);
    });
  });

  describe('getPresence()', () => {
    it('should retrieve stored presence', async () => {
      const presenceData = {
        customerId: 'customer-1',
        sessionId: 'sess-123',
        tabId: 'tab-456',
        isLeader: true,
        createdAt: '2025-10-19 12:00:00',
        updatedAt: '2025-10-19 12:00:00',
        lastActivity: 'just now',
      };

      getMock.mockResolvedValue(JSON.stringify(presenceData));

      const result = await redisAdapter.getPresence('customer-1', 'sess-123');

      expect(getMock).toHaveBeenCalledWith('presence:customer-1:sess-123');
      expect(result).toEqual(presenceData);
    });

    it('should return null for non-existent session', async () => {
      getMock.mockResolvedValue(null);

      const result = await redisAdapter.getPresence('customer-1', 'sess-999');

      expect(result).toBeNull();
    });
  });

  describe('updatePresence()', () => {
    it('should update presence with KEEPTTL', async () => {
      const presenceData = {
        customerId: 'customer-1',
        sessionId: 'sess-123',
        tabId: 'tab-456',
        isLeader: true,
        createdAt: '2025-10-19 12:00:00',
        updatedAt: '2025-10-19 12:00:00',
        lastActivity: 'just now',
      };

      await redisAdapter.updatePresence(presenceData);

      expect(setMock).toHaveBeenCalledWith(
        'presence:customer-1:sess-123',
        expect.any(String),
        'KEEPTTL'
      );
    });

    it('should not reset TTL on update', async () => {
      const presenceData = {
        customerId: 'customer-1',
        sessionId: 'sess-123',
        tabId: 'tab-456',
        isLeader: true,
        createdAt: '2025-10-19 12:00:00',
        updatedAt: '2025-10-19 12:00:00',
        lastActivity: 'just now',
      };

      await redisAdapter.updatePresence(presenceData);

      // KEEPTTL means no EX or EXAT parameter
      const setCall = setMock.mock.calls[0];
      expect(setCall[2]).toBe('KEEPTTL');
      expect(setCall[3]).toBeUndefined();
    });
  });

  describe('removePresence()', () => {
    it('should delete presence key', async () => {
      await redisAdapter.removePresence('customer-1', 'sess-123');

      expect(delMock).toHaveBeenCalledWith('presence:customer-1:sess-123');
    });

    it('should handle deletion of non-existent key', async () => {
      delMock.mockResolvedValue(0); // Key didn't exist

      await expect(
        redisAdapter.removePresence('customer-1', 'sess-999')
      ).resolves.not.toThrow();
    });
  });

  describe('getActiveSessions()', () => {
    it('should retrieve all active sessions for customer', async () => {
      const sessions = [
        'presence:customer-1:sess-1',
        'presence:customer-1:sess-2',
        'presence:customer-1:sess-3',
      ];

      scanMock.mockResolvedValue(['0', sessions]);

      const result = await redisAdapter.getActiveSessions('customer-1');

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('sess-1');
      expect(result[1]).toBe('sess-2');
      expect(result[2]).toBe('sess-3');
    });

    it('should use SCAN instead of KEYS', async () => {
      scanMock.mockResolvedValue(['0', []]);

      await redisAdapter.getActiveSessions('customer-1');

      expect(scanMock).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'presence:customer-1:*',
        'COUNT',
        100
      );
    });

    it('should handle empty results', async () => {
      scanMock.mockResolvedValue(['0', []]);

      const result = await redisAdapter.getActiveSessions('customer-1');

      expect(result).toEqual([]);
    });
  });

  describe('getActiveCount()', () => {
    it('should count active sessions', async () => {
      scanMock.mockResolvedValue(['0', [
        'presence:customer-1:sess-1',
        'presence:customer-1:sess-2',
        'presence:customer-1:sess-3',
      ]]);

      const count = await redisAdapter.getActiveCount('customer-1');

      expect(count).toBe(3);
    });

    it('should return 0 for no sessions', async () => {
      scanMock.mockResolvedValue(['0', []]);

      const count = await redisAdapter.getActiveCount('customer-1');

      expect(count).toBe(0);
    });
  });

  describe('TTL Behavior', () => {
    it('should set correct TTL on first join', async () => {
      const presenceData = {
        customerId: 'customer-1',
        sessionId: 'sess-123',
        tabId: 'tab-456',
        isLeader: true,
        createdAt: '2025-10-19 12:00:00',
        updatedAt: '2025-10-19 12:00:00',
        lastActivity: 'just now',
      };

      await redisAdapter.setPresence(presenceData);

      const setCall = setMock.mock.calls[0];
      expect(setCall[2]).toBe('EX');
      expect(setCall[3]).toBe(180); // 3 minutes
    });

    it('should keep TTL on heartbeat updates', async () => {
      const presenceData = {
        customerId: 'customer-1',
        sessionId: 'sess-123',
        tabId: 'tab-456',
        isLeader: true,
        createdAt: '2025-10-19 12:00:00',
        updatedAt: '2025-10-19 12:00:00',
        lastActivity: 'just now',
      };

      await redisAdapter.updatePresence(presenceData);

      const setCall = setMock.mock.calls[0];
      expect(setCall[2]).toBe('KEEPTTL');
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors on set', async () => {
      setMock.mockRejectedValue(new Error('Connection refused'));

      const presenceData = {
        customerId: 'customer-1',
        sessionId: 'sess-123',
        tabId: 'tab-456',
        isLeader: true,
        createdAt: '2025-10-19 12:00:00',
        updatedAt: '2025-10-19 12:00:00',
        lastActivity: 'just now',
      };

      await expect(redisAdapter.setPresence(presenceData)).rejects.toThrow('Connection refused');
    });

    it('should handle Redis connection errors on get', async () => {
      getMock.mockRejectedValue(new Error('Connection refused'));

      await expect(redisAdapter.getPresence('customer-1', 'sess-123')).rejects.toThrow('Connection refused');
    });

    it('should handle invalid JSON in stored data', async () => {
      getMock.mockResolvedValue('invalid-json');

      await expect(redisAdapter.getPresence('customer-1', 'sess-123')).rejects.toThrow();
    });
  });
});

