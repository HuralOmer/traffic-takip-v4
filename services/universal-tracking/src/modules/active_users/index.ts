/**
 * Active Users Module
 * Hybrid WebSocket-based real-time active user tracking
 * 
 * Features:
 * - Multi-tenant support (customer_id)
 * - Tab leader election (multiple tabs = 1 active user)
 * - Hybrid connection (WebSocket + Polling fallback)
 * - EMA-based smooth metrics
 * - Foreground/Background optimization
 * - Reliable event delivery (HTTP POST + sendBeacon)
 */
// Client-side exports
export { ActiveUsersClient } from './client/index.js';
// Server-side exports  
export { ActiveUsersServer } from './server/index.js';
// Type exports
export type {
  ActiveUser,
  ActiveUserMetrics,
  PresenceData,
  ClientConfig,
  ServerConfig,
  ClientMessage,
  ServerMessage,
  MetricsUpdate,
  JoinPayload,
  BeatPayload,
  LeavePayload,
  MetricsResponse,
} from './types/index.js';
