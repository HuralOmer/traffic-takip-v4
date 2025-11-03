/**
 * WebSocket and API Message Types
 */
// WebSocket messages from client to server
export type ClientMessage = 
  | { type: 'auth'; customerId: string; sessionId: string; tabId: string }
  | { type: 'ping'; timestamp: number }
  | { type: 'ttl_refresh'; customerId: string; sessionId: string; tabId: string; timestamp: number; session_mode?: 'active' | 'passive_active' };
// WebSocket messages from server to client
export type ServerMessage =
  | { type: 'hello'; timestamp: number; sessionId: string }
  | { type: 'metrics:update'; data: MetricsUpdate }
  | { type: 'error'; message: string; code?: string }
  | { type: 'pong'; timestamp: number };
export interface MetricsUpdate {
  customerId: string;
  timestamp: number;
  count: number;
  ema: number;
  change?: number;
}
// REST API payloads
export interface JoinPayload {
  customerId: string;
  sessionId: string;
  tabId: string;
  timestamp: number;
  // Optional: when true, server should only update fields (no recreate, keep TTL)
  updateOnly?: boolean;
  platform?: string | undefined;
  browser?: string | undefined;
  device?: string | undefined;
  userAgent?: string | undefined;
  desktop_mode?: boolean | undefined;
  total_tab_quantity?: number | undefined;
  session_mode?: 'active' | 'passive_active' | undefined;
  country?: string | undefined;
  city?: string | undefined;
  regionName?: string | undefined;
  ip?: string | undefined;
}
export interface BeatPayload {
  customerId: string;
  sessionId: string;
  tabId: string;
  timestamp: number;
  userAgent?: string;
}
export interface LeavePayload {
  customerId: string;
  sessionId: string;
  tabId: string;
  timestamp: number;
  userAgent?: string;
  mode?: 'final' | 'pending';
  reason?: 'external' | 'tabclose' | 'unknown';
}
export interface MetricsResponse {
  timestamp: number;
  count: number;
  ema: number;
  customerId: string;
}
