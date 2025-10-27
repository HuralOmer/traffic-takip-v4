/**
 * Hibrit Tracking Sistemi
 * 1. Önce CNAME + 1. Parti Çerez dener
 * 2. Başarısız olursa localStorage fallback kullanır
 */
export interface TrackingConfig {
  customerId: string;
  domain: string;
  apiEndpoint?: string;
  debug?: boolean;
}
export interface TrackingEvent {
  event_type: string;
  url: string;
  timestamp: number;
  user_agent: string;
  session_id?: string;
  customer_id?: string;
  metadata?: Record<string, any>;
}
export type TrackingMethod = 'cname_cookies' | 'localStorage_fallback';
export class HybridTrackingSystem {
  private customerId: string;
  private domain: string;
  private apiEndpoint: string;
  private trackingMethod: TrackingMethod | null = null;
  private sessionId: string;
  private debug: boolean;
  constructor(config: TrackingConfig) {
    this.customerId = config.customerId;
    this.domain = config.domain;
    this.apiEndpoint = config.apiEndpoint || `https://tracking.${config.domain}`;
    this.debug = config.debug || false;
    this.sessionId = this.generateSessionId();
  }
  /**
   * Hibrit sistemi başlat
   */
  async initialize(): Promise<TrackingMethod> {
    try {
      // 1. CNAME bağlantısını test et
      const cnameWorking = await this.testCNAMEConnection();
      if (cnameWorking) {
        this.trackingMethod = 'cname_cookies';
        this.setupFirstPartyCookies();
        this.log('✅ CNAME + 1. Parti Çerez sistemi aktif');
      } else {
        this.trackingMethod = 'localStorage_fallback';
        this.setupLocalStorageFallback();
        this.log('⚠️ CNAME çalışmıyor, localStorage fallback aktif');
      }
      return this.trackingMethod;
    } catch (error) {
      this.trackingMethod = 'localStorage_fallback';
      this.setupLocalStorageFallback();
      this.log('❌ Hata oluştu, localStorage fallback aktif');
      return this.trackingMethod;
    }
  }
  /**
   * CNAME bağlantısını test et
   */
  private async testCNAMEConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 saniye timeout
      const response = await fetch(`${this.apiEndpoint}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      this.log('CNAME test başarısız:', error);
      return false;
    }
  }
  /**
   * 1. Parti çerezleri kur
   */
  private setupFirstPartyCookies(): void {
    const cookieOptions = `domain=.${this.domain}; path=/; secure; samesite=lax`;
    // Müşteri ID çerezi
    document.cookie = `ut_customer_id=${this.customerId}; ${cookieOptions}`;
    // Session ID çerezi
    document.cookie = `ut_session_id=${this.sessionId}; ${cookieOptions}`;
    // Tracking method çerezi
    document.cookie = `ut_tracking_method=cname_cookies; ${cookieOptions}`;
    this.log('1. Parti çerezler kuruldu');
  }
  /**
   * localStorage fallback kur
   */
  private setupLocalStorageFallback(): void {
    const storageKey = `ut_${this.customerId}`;
    // Müşteri bilgilerini localStorage'a kaydet
    localStorage.setItem(`${storageKey}_customer_id`, this.customerId);
    localStorage.setItem(`${storageKey}_session_id`, this.sessionId);
    localStorage.setItem(`${storageKey}_tracking_method`, 'localStorage_fallback');
    this.log('localStorage fallback kuruldu');
  }
  /**
   * Event gönder
   */
  async trackEvent(eventData: Partial<TrackingEvent>): Promise<boolean> {
    const event: TrackingEvent = {
      event_type: eventData.event_type || 'unknown',
      url: eventData.url || window.location.href,
      timestamp: eventData.timestamp || Date.now(),
      user_agent: eventData.user_agent || navigator.userAgent,
      session_id: this.sessionId,
      customer_id: this.customerId,
      metadata: eventData.metadata || {}
    };
    if (this.trackingMethod === 'cname_cookies') {
      return await this.trackWithCNAME(event);
    } else {
      return await this.trackWithLocalStorage(event);
    }
  }
  /**
   * CNAME ile event gönder
   */
  private async trackWithCNAME(event: TrackingEvent): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
      if (response.ok) {
        this.log('✅ CNAME tracking başarılı');
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.log('⚠️ CNAME başarısız, localStorage\'a geçiliyor:', error);
      return await this.trackWithLocalStorage(event);
    }
  }
  /**
   * localStorage ile event gönder
   */
  private async trackWithLocalStorage(event: TrackingEvent): Promise<boolean> {
    try {
      // Önce localStorage'a kaydet
      this.saveToLocalStorage(event);
      // Sonra API'ye gönder
      const response = await fetch('https://api.lorventurkiye.com/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...event,
          tracking_method: 'localStorage_fallback',
          original_domain: this.domain
        })
      });
      if (response.ok) {
        this.log('✅ localStorage tracking başarılı');
        this.markAsSynced(event);
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.log('⚠️ API\'ye gönderilemedi, localStorage\'da saklandı:', error);
      return false;
    }
  }
  /**
   * localStorage'a kaydet
   */
  private saveToLocalStorage(event: TrackingEvent): void {
    const storageKey = `ut_${this.customerId}_events`;
    const existingData = this.getFromLocalStorage();
    const eventWithId = {
      ...event,
      id: this.generateEventId(),
      synced: false,
      created_at: Date.now()
    };
    existingData.push(eventWithId);
    localStorage.setItem(storageKey, JSON.stringify(existingData));
    this.log('Event localStorage\'a kaydedildi');
  }
  /**
   * localStorage'dan oku
   */
  private getFromLocalStorage(): any[] {
    const storageKey = `ut_${this.customerId}_events`;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : [];
  }
  /**
   * Senkronize edildi olarak işaretle
   */
  private markAsSynced(event: TrackingEvent): void {
    const storageKey = `ut_${this.customerId}_events`;
    const data = this.getFromLocalStorage();
    const updatedData = data.map(item => 
      item.id === (event as any).id ? { ...item, synced: true } : item
    );
    localStorage.setItem(storageKey, JSON.stringify(updatedData));
  }
  /**
   * Offline verileri senkronize et
   */
  async syncOfflineData(): Promise<void> {
    if (this.trackingMethod !== 'localStorage_fallback') return;
    const offlineData = this.getFromLocalStorage().filter(item => !item.synced);
    this.log(`${offlineData.length} offline event senkronize ediliyor...`);
    for (const item of offlineData) {
      try {
        await this.trackWithLocalStorage(item);
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      } catch (error) {
        this.log('Offline data sync failed:', error);
      }
    }
  }
  /**
   * Session ID oluştur
   */
  private generateSessionId(): string {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  /**
   * Event ID oluştur
   */
  private generateEventId(): string {
    return 'evt_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  /**
   * Debug log
   */
  private log(message: string, ...args: any[]): void {
    if (this.debug) {
    }
  }
  /**
   * Mevcut tracking method'u al
   */
  getTrackingMethod(): TrackingMethod | null {
    return this.trackingMethod;
  }
  /**
   * Sistem durumunu al
   */
  getSystemStatus() {
    return {
      trackingMethod: this.trackingMethod,
      customerId: this.customerId,
      domain: this.domain,
      sessionId: this.sessionId,
      apiEndpoint: this.apiEndpoint
    };
  }
}
