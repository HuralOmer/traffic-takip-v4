/**
 * Session State Management
 * Manages session_id, tab_id, customer_id
 */
export class SessionState {
  private sessionId: string;
  private tabId: string;
  private customerId: string;
  private userId: string | undefined;
  constructor(customerId: string, userId?: string | undefined) {
    this.customerId = customerId;
    this.userId = userId;
    this.sessionId = this.getOrCreateSessionId();
    this.tabId = this.generateTabId();
  }
  private getOrCreateSessionId(): string {
    const storageKey = `au_session_${this.customerId}`;
    const timestampKey = `au_session_timestamp_${this.customerId}`;
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 saat
    // localStorage kullan ki tüm sekmeler aynı session ID'yi paylaşsın
    // Her sekmenin kendi tabId'si olacak ama session ID aynı olacak
    let sessionId = localStorage.getItem(storageKey);
    const timestamp = localStorage.getItem(timestampKey);
    // Session varsa ve süresi dolmamışsa kullan
    const isExpired = timestamp && (Date.now() - parseInt(timestamp, 10)) > SESSION_TIMEOUT;
    if (!sessionId || isExpired) {
      // Yeni session oluştur
      sessionId = this.generateId('sess');
      localStorage.setItem(storageKey, sessionId);
      localStorage.setItem(timestampKey, Date.now().toString());
    }
    return sessionId;
  }
  private generateTabId(): string {
    return this.generateId('tab');
  }
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }
  getSessionId(): string {
    return this.sessionId;
  }
  getTabId(): string {
    return this.tabId;
  }
  getCustomerId(): string {
    return this.customerId;
  }
  getUserId(): string | undefined {
    return this.userId;
  }
  setUserId(userId: string): void {
    this.userId = userId;
  }
  /**
   * Session'ı yenile (timeout'u sıfırla)
   * Her activity'de (heartbeat, join, vb.) çağrılmalı
   */
  refreshSession(): void {
    const timestampKey = `au_session_timestamp_${this.customerId}`;
    localStorage.setItem(timestampKey, Date.now().toString());
  }
}
