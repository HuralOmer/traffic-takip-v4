import Fastify from 'fastify';
import { WebSocketServer } from 'ws';
import { config } from './core/config/env.js';
import { logger } from './core/observability/logger.js';
import { setupRoutes } from './core/http/fastify.js';
import { setupGracefulShutdown } from './core/shutdown.js';
import { redisService } from './core/cache/redis.js';
import { ActiveUsersServer } from './modules/active_users/server/index.js';

async function bootstrap() {
  
  
  
  

  // Connect to Redis
  try {
    await redisService.connect();
    
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    process.exit(1);
  }

  // ✅ PHASE 3: Initialize Active Users Server with updated TTL
  const activeUsersServer = new ActiveUsersServer(redisService.getClient(), {
    presenceTTL: 600, // 600 saniye (10 dakika) - Sigorta/fallback TTL
    emaAlpha: 0.2,
    emaUpdateInterval: 30000, // 30 saniye
    maxRequestsPerMinute: 5000,
    wsPingInterval: 25000, // Phase 1: 25s server ping
    wsPongTimeout: 2,       // Phase 1: 2 missed pongs
  });
  

  // Create Fastify instance
  const fastify = Fastify({
    logger: true,
    trustProxy: true,
  });

  // Register CORS plugin
  await fastify.register(import('@fastify/cors'), {
    origin: (origin, callback) => {
      // Allow requests from all origins for development
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Site-ID', 'X-Timestamp', 'X-Signature']
  });

  // Setup routes
  await setupRoutes(fastify);

  // Register Active Users REST endpoints
  activeUsersServer.registerRESTEndpoints(fastify);
  

  // Setup graceful shutdown
  setupGracefulShutdown(fastify, async () => {
    
    await activeUsersServer.destroy();
  });

  // Start server
  try {
    await fastify.listen({
      port: config.PORT,
      host: config.HOST,
    });

    

    // Setup WebSocket server for Active Users on the same HTTP server
    const wss = new WebSocketServer({ 
      server: fastify.server,
      path: '/ws/active-users'
    });
    activeUsersServer.registerWebSocketServer(wss);
    

    // Start EMA calculation for all customers (bu örnekte tek customer için)
    // Production'da bu dinamik olmalı
    // activeUsersServer.startEMACalculation('default-customer');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
