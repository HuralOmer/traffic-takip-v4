/**
 * Server Configuration
 */
import type { ServerConfig } from '../types/Config.js';
export const defaultServerConfig: Partial<ServerConfig> = {
  // ✅ PHASE 3: Presence settings (increased TTL for WebSocket-based refresh)
  presenceTTL: 600, // 600 saniye (10 dakika) - Sigorta/fallback TTL
  // EMA settings
  emaAlpha: 0.2,
  emaUpdateInterval: 30000, // 30 saniye
  // ✅ PHASE 3: WebSocket settings (ping/pong configuration)
  websocketPort: 8080,
  enableWebSocket: true,
  wsPingInterval: 25000,  // 25 seconds - Server ping interval
  wsPongTimeout: 2,        // 2 missed pongs before disconnect
  // Rate limiting
  maxRequestsPerMinute: 1000,
};
export function mergeServerConfig(userConfig: Partial<ServerConfig>): Required<ServerConfig> {
  return {
    ...defaultServerConfig,
    ...userConfig,
  } as Required<ServerConfig>;
}
