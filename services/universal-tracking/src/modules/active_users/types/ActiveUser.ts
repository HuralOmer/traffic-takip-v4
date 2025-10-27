/**
 * Active User Type Definitions
 */
export interface ActiveUser {
  customerId: string;
  sessionId: string;
  tabId: string;
  userId?: string | undefined;
  firstSeen: number;
  lastSeen: number;
  isLeader: boolean;
  userAgent?: string | undefined;
  platform?: 'desktop' | 'mobile' | 'tablet' | undefined;
}
export interface PresenceData {
  customerId: string;
  sessionId: string;
  tabId: string;
  isLeader: boolean;
  // Device Info
  platform?: string | undefined;
  browser?: string | undefined;
  device?: string | undefined;
  desktop_mode?: boolean | undefined;
  // Tab Tracking
  total_tab_quantity?: number | undefined;
  total_backgroundTab_quantity?: number | undefined;
  // Session Mode
  session_mode?: 'active' | 'passive_active' | undefined;
  // Timestamps (Hybrid Format - Human Readable)
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
}
export interface ActiveUserMetrics {
  customerId: string;
  timestamp: number;
  count: number;
  ema: number;
  raw?: number;
}
