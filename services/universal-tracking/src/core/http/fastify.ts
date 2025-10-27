import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { sdkRoutes } from './routes/sdk.js';
import { pollingRoutes } from './routes/polling.js';

export async function setupRoutes(fastify: FastifyInstance) {
  await fastify.register(healthRoutes, { prefix: '' });
  await fastify.register(sdkRoutes, { prefix: '' });
  await fastify.register(pollingRoutes, { prefix: '' });
}