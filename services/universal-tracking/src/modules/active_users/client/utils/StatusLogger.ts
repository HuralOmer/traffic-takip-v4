/**
 * Centralized Status Logger
 * Single-line, color-coded status display
 */

export interface SystemStatus {
  connection: 'websocket' | 'polling' | 'disconnected';
  visibilityState: 'foreground' | 'background';
  isLeader: boolean;
  userId: string;
  tabId: string;
  ttlRefreshInterval: number;
}

export class StatusLogger {
  private debug: boolean;
  private lastStatus: SystemStatus | null = null;
  private pendingStatus: SystemStatus | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Log system status immediately without debouncing
   */
  logStatusImmediate(status: SystemStatus): void {
    if (!this.debug) return;
    
    if (this.lastStatus && this.isStatusEqual(this.lastStatus, status)) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingStatus = null;

    this.actuallyLogStatus(status);
    this.lastStatus = { ...status };
  }

  /**
   * Log system status with debouncing
   */
  logStatus(status: SystemStatus): void {
    if (!this.debug) return;

    if (this.lastStatus && this.isStatusEqual(this.lastStatus, status)) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.pendingStatus = { ...status };

    this.debounceTimer = setTimeout(() => {
      if (this.pendingStatus) {
        this.actuallyLogStatus(this.pendingStatus);
        this.pendingStatus = null;
      }
      this.debounceTimer = null;
    }, 50);
  }

  /**
   * Actually perform the logging
   */
  private actuallyLogStatus(status: SystemStatus): void {
    if (!this.debug) return;
    this.lastStatus = { ...status };
  }

  /**
   * Log TTL refresh
   */
  logTTLRefresh(sessionId: string, tabId: string, interval: number): void {
    if (!this.debug) return;
  }

  /**
   * Check if two status objects are equal
   */
  private isStatusEqual(status1: SystemStatus, status2: SystemStatus): boolean {
    return status1.connection === status2.connection &&
           status1.visibilityState === status2.visibilityState &&
           status1.isLeader === status2.isLeader &&
           status1.userId === status2.userId &&
           status1.tabId === status2.tabId &&
           status1.ttlRefreshInterval === status2.ttlRefreshInterval;
  }

  /**
   * Log important events
   */
  logEvent(emoji: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
    if (!this.debug) return;
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingStatus = null;
  }
}
