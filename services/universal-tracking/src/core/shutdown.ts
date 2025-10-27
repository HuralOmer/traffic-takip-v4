import type { FastifyInstance } from 'fastify';
import { redisService } from './cache/redis.js';
export function setupGracefulShutdown(
  fastify: FastifyInstance, 
  additionalCleanup?: () => Promise<void>
) {
  const shutdown = async (signal: string) => {
    try {
      // Run additional cleanup if provided
      if (additionalCleanup) {
        await additionalCleanup();
      }
      // Close Fastify server
      await fastify.close();
      // Disconnect from Redis
      await redisService.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };
  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
