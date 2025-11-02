/**
 * SDK Routes
 * Serves the browser-bundled Active Users SDK
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for SDK content and hash (prevents re-reading file on every request)
let cachedSDKContent: string | null = null;
let cachedSDKHash: string | null = null;
let lastBundleRead: number = 0;
const CACHE_DURATION = 60000; // Re-read bundle every 60 seconds in development
export async function sdkRoutes(fastify: FastifyInstance) {
  /**
   * Serve Active Users SDK (browser bundle)
   * GET /active-users-sdk.js?customer_id=xxx&debug=true
   */
  fastify.get('/active-users-sdk.js', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { customer_id?: string; debug?: string };
    const customerId = query.customer_id || 'unknown';
    const debug = query.debug === 'true';
    
    try {
      // Bundle path
      const bundlePath = process.env.NODE_ENV === 'production'
        ? '/app/services/universal-tracking/dist-browser/active-users-sdk.global.js'
        : join(__dirname, '../../../../dist-browser/active-users-sdk.global.js');
      
      // Check if we need to re-read the bundle (cache invalidation in development)
      const now = Date.now();
      const shouldReload = !cachedSDKContent || 
                          !cachedSDKHash || 
                          (process.env.NODE_ENV !== 'production' && now - lastBundleRead > CACHE_DURATION);
      
      if (shouldReload) {
        fastify.log.info(`Reading SDK bundle from: ${bundlePath}`);
        cachedSDKContent = await readFile(bundlePath, 'utf-8');
        
        // Generate content hash for ETag
        cachedSDKHash = createHash('sha256')
          .update(cachedSDKContent)
          .digest('hex')
          .substring(0, 16); // Short hash
        
        lastBundleRead = now;
        fastify.log.info(`SDK loaded. Hash: ${cachedSDKHash}`);
      }
      
      const bundle = cachedSDKContent!;
      const contentHash = cachedSDKHash!;
      
      // Check if client has cached version (ETag)
      const clientETag = request.headers['if-none-match'];
      if (clientETag === contentHash) {
        fastify.log.debug(`SDK cache hit for ${customerId} (ETag: ${contentHash})`);
        return reply.code(304).send(); // Not Modified
      }
      // ✅ SMART URL DETECTION: Automatically detect the correct URLs based on request
      // This works in both production (api.lorventurkiye.com) and development (localhost)
      // Get request host and protocol
      const requestHost = request.headers.host || 'localhost:3001';
      const isSecure = request.headers['x-forwarded-proto'] === 'https' || 
                       request.protocol === 'https' ||
                       requestHost.includes('lorventurkiye.com'); // Cloudflare tunnel
      // Determine protocols
      const httpProtocol = isSecure ? 'https' : 'http';
      const wsProtocol = isSecure ? 'wss' : 'ws';
      // Build URLs (prefer environment variables, fallback to smart detection)
      const apiUrl = process.env.PUBLIC_API_URL || `${httpProtocol}://${requestHost}`;
      const wsUrl = process.env.PUBLIC_WS_URL || `${wsProtocol}://${requestHost}`;
      // Log for debugging
      fastify.log.info(`SDK URLs: API=${apiUrl}, WebSocket=${wsUrl} (Host: ${requestHost}, Secure: ${isSecure})`);
      const initScript = `
;(function() {
  try {
    if (!window.ActiveUsersSDK || !window.ActiveUsersSDK.ActiveUsersClient) {
      console.error('❌ ActiveUsersSDK not loaded properly');
      return;
    }
    // 🆕 CRITICAL: Wait for page to be fully committed before initializing
    // Kullanıcı URL yazmış olabilir ama Enter'a basmamış olabilir
    function initWhenReady() {
      // Create client instance
      const client = new window.ActiveUsersSDK.ActiveUsersClient({
        customerId: '${customerId}',
        apiUrl: '${apiUrl}',
        websocketUrl: '${wsUrl}/ws/active-users',
        debug: ${debug},
        enableWebSocket: true,
        enablePolling: true,
        // ✅ PHASE 2: Updated config (heartbeat removed, TTL refresh added)
        ttlRefreshInterval: 120000, // 120 seconds
        pollingInterval: 45000, // 45 seconds
      });
      // Initialize the client
      client.init().then(() => {
                              }).catch(err => {
        console.error('❌ Failed to initialize Active Users SDK:', err);
      });
      // Expose globally for debugging
      window.ActiveUsersTracker = client;
      // Expose persistent log helpers (always available)
      (function(){
        function append(level, parts){
          try {
            var now = new Date().toISOString();
            var msg = [];
            for (var i=0;i<parts.length;i++){
              try { msg.push(typeof parts[i] === 'string' ? parts[i] : JSON.stringify(parts[i])); } catch(_) { msg.push(String(parts[i])); }
            }
            var entry = { ts: now, level: level, message: msg.join(' ') };
            var raw = localStorage.getItem('activeUsers.logs');
            var list = raw ? JSON.parse(raw) : [];
            list.push(entry);
            if (list.length > 500) { list.splice(0, list.length - 500); }
            localStorage.setItem('activeUsers.logs', JSON.stringify(list));
          } catch(_) {}
        }
        // Public API
        window.ActiveUsersLogs = window.ActiveUsersLogs || {
          read: function(){ try { return JSON.parse(localStorage.getItem('activeUsers.logs')||'[]'); } catch(_) { return []; } },
          clear: function(){ try { localStorage.removeItem('activeUsers.logs'); } catch(_) {} },
        };
        // If debug enabled, mirror key console logs into buffer
        if (${debug}) {
          var origLog = console.log, origInfo = console.info, origWarn = console.warn, origError = console.error;
          console.log = function(){ append('log', Array.prototype.slice.call(arguments)); return origLog.apply(console, arguments); };
          console.info = function(){ append('info', Array.prototype.slice.call(arguments)); return origInfo.apply(console, arguments); };
          console.warn = function(){ append('warn', Array.prototype.slice.call(arguments)); return origWarn.apply(console, arguments); };
          console.error = function(){ append('error', Array.prototype.slice.call(arguments)); return origError.apply(console, arguments); };
        }
      })();
    }
    // 🆕 CRITICAL: Ensure page is visible before init
    function safeInit() {
      // Check: Page hidden? (prefetch/autocomplete)
      if (document.hidden) {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            setTimeout(initWhenReady, 200);
          }
        }, { once: true });
        return;
      }
      // ✅ Page is visible, init immediately
      initWhenReady();
    }
    // ✅ Wait for page to be fully loaded before init
    if (document.readyState === 'complete') {
      // Page already loaded, but check visibility
      safeInit();
    } else if (document.readyState === 'interactive') {
      // DOM ready, waiting for resources
      window.addEventListener('load', () => {
        safeInit();
      }, { once: true });
    } else {
      // Still loading HTML
      window.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('load', () => {
          safeInit();
        }, { once: true });
      }, { once: true });
    }
  } catch (error) {
    console.error('❌ Error initializing Active Users SDK:', error);
  }
})();
`;
      // Combine bundle + init script
      const fullScript = bundle + '\n' + initScript;
      
      // Smart cache strategy based on environment
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (isDevelopment) {
        // Development: No cache for easy testing
        return reply
          .type('application/javascript; charset=utf-8')
          .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
          .header('Pragma', 'no-cache')
          .header('Expires', '0')
          .header('Last-Modified', new Date().toUTCString())
          .header('ETag', contentHash)
          .header('X-Content-Type-Options', 'nosniff')
          .header('X-SDK-Version', contentHash)
          .header('X-Cache-Status', 'DISABLED-DEV')
          .send(fullScript);
      } else {
        // Production: no-store (no cache at all) + ETag for 304 responses
        return reply
          .type('application/javascript; charset=utf-8')
          .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
          .header('ETag', contentHash)
          .header('Last-Modified', new Date().toUTCString())
          .header('X-Content-Type-Options', 'nosniff')
          .header('X-SDK-Version', contentHash)
          .header('X-Cache-Status', 'NO-STORE-PROD')
          .send(fullScript);
      }
    } catch (error) {
      fastify.log.error('Failed to serve SDK bundle:', error);
      return reply
        .code(500)
        .type('application/javascript')
        .send('console.error("Failed to load Active Users SDK");');
    }
  });
  /**
   * Legacy endpoint - redirect to new SDK
   * GET /tracking-sdk.js
   */
  fastify.get('/tracking-sdk.js', async (request: FastifyRequest, reply: FastifyReply) => {
    // Redirect to new SDK endpoint
    const query = new URLSearchParams(request.query as any).toString();
    return reply.redirect(301, `/active-users-sdk.js?${query}`);
  });
}
