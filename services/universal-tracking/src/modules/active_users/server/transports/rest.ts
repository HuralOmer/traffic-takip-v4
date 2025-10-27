/**
 * REST API Endpoints
 * Handles HTTP requests for presence management
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PresenceService } from '../services/presence.service.js';
import { EMAService } from '../services/ema.service.js';
import { MultiTierRateLimiter } from '../utils/rate-limit.js';
import type { JoinPayload, LeavePayload } from '../../types/Messages.js';
/**
 * Rate limit checker helper
 */
async function checkRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  rateLimiter: MultiTierRateLimiter
): Promise<boolean> {
  const rateLimitResult = await rateLimiter.checkAll(request);
  if (!rateLimitResult.allowed) {
    const limit = rateLimitResult.limits[rateLimitResult.blockedBy!];
    const retryAfter = Math.ceil((limit.resetTime - Date.now()) / 1000);
    reply.header('X-RateLimit-Limit', limit.limit.toString());
    reply.header('X-RateLimit-Remaining', '0');
    reply.header('X-RateLimit-Reset', new Date(limit.resetTime).toISOString());
    reply.header('Retry-After', retryAfter.toString());
    reply.code(429).send({
      error: 'Too Many Requests',
      message: `Rate limit exceeded (${rateLimitResult.blockedBy}). Try again in ${retryAfter} seconds.`,
      blockedBy: rateLimitResult.blockedBy,
    });
    return false; // Rate limit exceeded
  }
  // Add rate limit headers for successful requests
  const customerLimit = rateLimitResult.limits['customer'];
  reply.header('X-RateLimit-Limit', customerLimit.limit.toString());
  reply.header('X-RateLimit-Remaining', customerLimit.remaining.toString());
  reply.header('X-RateLimit-Reset', new Date(customerLimit.resetTime).toISOString());
  return true; // Rate limit OK
}
export function setupRESTEndpoints(
  fastify: FastifyInstance,
  presenceService: PresenceService,
  emaService: EMAService,
  rateLimiter: MultiTierRateLimiter
): void {
  /**
   * POST /presence/join
   * User joins (new session)
   */
  fastify.post<{ Body: JoinPayload }>(
    '/presence/join',
    async (request: FastifyRequest<{ Body: JoinPayload }>, reply: FastifyReply) => {
      try {
        // Rate limit check
        if (!(await checkRateLimit(request, reply, rateLimiter))) {
          return; // Rate limit exceeded, response already sent
        }
        const payload = request.body;
        // Validate
        if (!payload.customerId || !payload.sessionId || !payload.tabId) {
          return reply.code(400).send({ error: 'Missing required fields' });
        }
        await presenceService.handleJoin(payload);
        return reply.code(200).send({ success: true });
      } catch (error) {
        console.error('[REST] Join error:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
  /**
   * POST /presence/leave
   * User leaves (session ends)
   * Supports both application/json and text/plain content types
   */
  fastify.post<{ Body: LeavePayload | string }>(
    '/presence/leave',
    async (request: FastifyRequest<{ Body: LeavePayload | string }>, reply: FastifyReply) => {
      try {
        // Rate limit check
        if (!(await checkRateLimit(request, reply, rateLimiter))) {
          return; // Rate limit exceeded, response already sent
        }

        // Idempotency check
        const leaveId = request.headers['x-leave-id'] as string;
        if (leaveId) {
          const redis = presenceService.getRedisClient();
          const idempotencyKey = `SEEN_LEAVE:${leaveId}`;
          const isNew = await redis.setNX(idempotencyKey, '1');
          if (isNew) {
            await redis.expire(idempotencyKey, 30); // 30 saniye TTL
          } else {
            // Idempotent - already processed
            return reply.code(204).send();
          }
        }

        let payload: LeavePayload | null = null;
        
        // Handle different content types with robust parsing
        try {
          if (request.headers['content-type']?.includes('text/plain')) {
            // Parse text/plain body as JSON
            const bodyStr = typeof request.body === 'string' ? request.body : String(request.body || '');
            if (bodyStr) {
              payload = JSON.parse(bodyStr);
            }
          } else {
            // Standard application/json
            payload = request.body as LeavePayload;
          }
        } catch (error) {
          console.warn('[REST] Leave body parse failed:', error);
          payload = null;
        }

        // Extract identifiers
        const customerId = payload?.customerId;
        const sessionId = payload?.sessionId;
        const tabId = payload?.tabId;

        // Log for debugging

        if (customerId && sessionId && tabId) {
          // Normal flow - delete the session
          const deleted = await presenceService.handleLeave(payload!);
          if (deleted) {
            return reply.code(200).send({ success: true });
          } else {
            // Session not found - set tombstone
            const redis = presenceService.getRedisClient();
            const tombstoneKey = `LEAVE_TOMBSTONE:presence:${customerId}:${sessionId}:${tabId}`;
            await redis.set(tombstoneKey, Date.now().toString());
            await redis.expire(tombstoneKey, 30);
            return reply.code(200).send({ success: true });
          }
        } else {
          // Missing identifiers - return 204 (dismissal-safe)
          console.warn('[REST] Leave missing identifiers:', { customerId, sessionId, tabId });
          return reply.code(204).send();
        }
      } catch (error) {
        console.error('[REST] Leave error:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
  /**
   * GET /active-users/metrics
   * Get current metrics for customer
   */
  fastify.get<{ Querystring: { customerId: string } }>(
    '/active-users/metrics',
    async (request: FastifyRequest<{ Querystring: { customerId: string } }>, reply: FastifyReply) => {
      try {
        // Rate limit check
        if (!(await checkRateLimit(request, reply, rateLimiter))) {
          return; // Rate limit exceeded, response already sent
        }
        const { customerId } = request.query;
        if (!customerId) {
          return reply.code(400).send({ error: 'customerId required' });
        }
        const count = await presenceService.getActiveCount(customerId);
        const ema = await emaService.getEMA(customerId);
        return reply.code(200).send({
          timestamp: Date.now(),
          count,
          ema,
          customerId,
        });
      } catch (error) {
        console.error('[REST] Metrics error:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
}
