/**
 * Configuration Type Definitions
 */
export interface ClientConfig {
  customerId: string;
  apiUrl: string;
  debug?: boolean;
  // ✅ TTL Refresh settings
  ttlRefreshInterval?: number; // default: 120000ms (2 minutes) - Active mode WebSocket
  ttlRefreshIntervalPassive?: number; // default: 5400000ms (90 minutes) - Passive_Active mode Polling
  // EMA settings (client-side smoothing)
  emaAlpha?: number; // default: 0.2
  emaWindowSize?: number; // default: 20
  // Connection settings
  websocketUrl?: string;
  pollingInterval?: number; // default: 45000ms (45 seconds) - Normal background
  pollingIntervalPassive?: number; // default: 5400000ms (90 minutes) - Passive_Active mode
  enableWebSocket?: boolean; // default: true
  enablePolling?: boolean; // default: true
}
export interface ServerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  // ✅ PHASE 3: Presence settings (increased TTL)
  presenceTTL?: number; // default: 600s (10 minutes)
  // EMA settings
  emaAlpha?: number; // default: 0.2
  emaUpdateInterval?: number; // default: 30000ms (30 seconds)
  // ✅ PHASE 3: WebSocket settings (ping/pong configuration)
  websocketPort?: number;
  enableWebSocket?: boolean;
  wsPingInterval?: number; // default: 25000ms (25 seconds)
  wsPongTimeout?: number; // default: 2 (missed pongs before disconnect)
  // Rate limiting
  maxRequestsPerMinute?: number;
}
