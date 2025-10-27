import type { FastifyInstance } from 'fastify';
export async function healthRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      service: 'universal-tracking',
      version: '1.0.0'
    };
  });
  // Readiness check endpoint
  fastify.get('/ready', async () => {
    return {
      status: 'ready',
      timestamp: Date.now()
    };
  });
  // Metrics endpoint (placeholder)
  fastify.get('/metrics', async () => {
    return {
      status: 'ok',
      message: 'Metrics endpoint ready for Prometheus integration'
    };
  });
}
