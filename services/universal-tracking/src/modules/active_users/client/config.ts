/**
 * Client Configuration
 */
import type { ClientConfig } from '../types/Config.js';
export const defaultClientConfig: Partial<ClientConfig> = {
  debug: false,
  // ✅ TTL Refresh settings for Active mode
  ttlRefreshInterval: 2 * 60 * 1000, // 2 dakika (active mode - WebSocket)
  // ✅ TTL Refresh settings for Passive_Active mode
  ttlRefreshIntervalPassive: 90 * 60 * 1000, // 90 dakika (passive_active mode - Polling)
  // EMA settings
  emaAlpha: 0.2,
  emaWindowSize: 20,
  // Connection settings
  pollingInterval: 45000, // 45 seconds (normal background)
  pollingIntervalPassive: 90 * 60 * 1000, // 90 dakika (passive_active mode)
  enableWebSocket: true,
  enablePolling: true,
};
export function mergeConfig(userConfig: ClientConfig): Required<ClientConfig> {
  return {
    ...defaultClientConfig,
    ...userConfig,
    websocketUrl: userConfig.websocketUrl || `${userConfig.apiUrl.replace('http', 'ws')}/ws/active-users`,
  } as Required<ClientConfig>;
}
