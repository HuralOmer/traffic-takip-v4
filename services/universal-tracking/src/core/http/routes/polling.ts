import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
export async function pollingRoutes(fastify: FastifyInstance) {
  // Placeholder polling routes - Yeni tracking modülleri kurulacak
  fastify.get('/api/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ready',
      message: 'API hazır - Yeni tracking modülleri kurulacak',
      timestamp: Date.now()
    });
  });
  // Placeholder event endpoint - Yeni modüllerde implement edilecek
  fastify.post('/api/events', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      message: 'Event endpoint hazır - Yeni modüllerde implement edilecek',
      timestamp: Date.now()
    });
  });
}