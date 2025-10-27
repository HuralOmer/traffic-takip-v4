/**
 * Universal Tracking - Ana Controller
 * Hibrit sistemi yönetir ve kullanıcı dostu API sağlar
 */
import { HybridTrackingSystem, TrackingEvent } from './HybridTrackingSystem';
import { LegacySupport } from './LegacySupport';
export interface TrackingConfig {
  customerId: string;
  domain: string;
  apiEndpoint?: string;
  debug?: boolean;
}
export class UniversalTracking {
  private hybridSystem: HybridTrackingSystem;
  private legacySupport: LegacySupport;
  private isInitialized: boolean = false;
  private config: TrackingConfig;
  constructor(config: TrackingConfig) {
    this.config = config;
    this.hybridSystem = new HybridTrackingSystem(config);
    this.legacySupport = new LegacySupport(this);
  }
  /**
   * Tracking sistemini başlat
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Universal Tracking zaten başlatılmış');
      return;
    }
    try {
      // Hibrit sistemi başlat
      const method = await this.hybridSystem.initialize();
      // Otomatik sayfa takibi
      this.trackPageView();
      // Offline data sync (localStorage kullanıyorsa)
      if (method === 'localStorage_fallback') {
        this.hybridSystem.syncOfflineData();
      }
      // Visibility change listener (sayfa değişiklikleri)
      this.setupVisibilityListener();
      // Before unload listener (sayfa kapanırken)
      this.setupBeforeUnloadListener();
      // Legacy support başlat
      this.legacySupport.initializeLegacySupport();
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Universal Tracking başlatılamadı:', error);
    }
  }
  /**
   * Sayfa görüntüleme takibi
   */
  trackPageView(): void {
    this.trackEvent({
      event_type: 'page_view',
      url: window.location.href,
      metadata: {
        referrer: document.referrer,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    });
  }
  /**
   * Custom event takibi
   */
  trackEvent(eventData: Partial<TrackingEvent>): void {
    if (!this.isInitialized) {
      console.warn('Universal Tracking henüz başlatılmamış');
      return;
    }
    this.hybridSystem.trackEvent(eventData);
  }
  /**
   * E-ticaret event takibi
   */
  trackEcommerceEvent(eventType: string, data: any): void {
    this.trackEvent({
      event_type: eventType,
      metadata: {
        ecommerce: data,
        category: 'ecommerce'
      }
    });
  }
  /**
   * Ürün görüntüleme
   */
  trackProductView(productId: string, productName: string, price?: number): void {
    this.trackEcommerceEvent('product_view', {
      product_id: productId,
      product_name: productName,
      price: price,
      currency: 'TRY'
    });
  }
  /**
   * Sepete ekleme
   */
  trackAddToCart(productId: string, productName: string, price: number, quantity: number = 1): void {
    this.trackEcommerceEvent('add_to_cart', {
      product_id: productId,
      product_name: productName,
      price: price,
      quantity: quantity,
      currency: 'TRY'
    });
  }
  /**
   * Satın alma
   */
  trackPurchase(orderId: string, total: number, items: any[]): void {
    this.trackEcommerceEvent('purchase', {
      order_id: orderId,
      total: total,
      items: items,
      currency: 'TRY'
    });
  }
  /**
   * Form gönderimi
   */
  trackFormSubmit(formName: string, formData?: any): void {
    this.trackEvent({
      event_type: 'form_submit',
      metadata: {
        form_name: formName,
        form_data: formData
      }
    });
  }
  /**
   * Button tıklama
   */
  trackButtonClick(buttonId: string, buttonText?: string): void {
    this.trackEvent({
      event_type: 'button_click',
      metadata: {
        button_id: buttonId,
        button_text: buttonText
      }
    });
  }
  /**
   * Link tıklama
   */
  trackLinkClick(linkUrl: string, linkText?: string): void {
    this.trackEvent({
      event_type: 'link_click',
      metadata: {
        link_url: linkUrl,
        link_text: linkText
      }
    });
  }
  /**
   * Scroll tracking
   */
  trackScroll(depth: number): void {
    this.trackEvent({
      event_type: 'scroll',
      metadata: {
        scroll_depth: depth,
        scroll_percentage: Math.round((depth / document.body.scrollHeight) * 100)
      }
    });
  }
  /**
   * Visibility change listener kur (debounced)
   */
  private setupVisibilityListener(): void {
    let visibilityTimeout: NodeJS.Timeout | null = null;
    let lastVisibilityChange = 0;
    document.addEventListener('visibilitychange', () => {
      const now = Date.now();
      // ✅ DEBOUNCE: Çok sık visibility change'i engelle
      if (now - lastVisibilityChange < 1000) {
        return;
      }
      // ✅ CLEAR TIMEOUT: Önceki timeout'u temizle
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
      // ✅ DELAYED TRACKING: 500ms bekle, gerçekten background mı?
      visibilityTimeout = setTimeout(() => {
        const finalState = document.visibilityState;
        if (finalState === 'visible') {
          this.trackEvent({
            event_type: 'page_visible',
            metadata: {
              visibility_state: 'visible'
            }
          });
        } else {
          this.trackEvent({
            event_type: 'page_hidden',
            metadata: {
              visibility_state: 'hidden'
            }
          });
        }
        lastVisibilityChange = Date.now();
      }, 500); // 500ms gecikme
    });
  }
  /**
   * Before unload listener kur
   */
  private setupBeforeUnloadListener(): void {
    window.addEventListener('beforeunload', () => {
      this.trackEvent({
        event_type: 'page_unload',
        metadata: {
          unload_time: Date.now()
        }
      });
    });
  }
  /**
   * Scroll tracking başlat
   */
  startScrollTracking(): void {
    let maxScroll = 0;
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      const scrollDepth = window.pageYOffset + window.innerHeight;
      if (scrollDepth > maxScroll) {
        maxScroll = scrollDepth;
        // Debounce scroll events
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.trackScroll(maxScroll);
        }, 100);
      }
    });
  }
  /**
   * Auto-tracking başlat (tüm link ve button'ları otomatik takip et)
   */
  startAutoTracking(): void {
    // Link tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a');
      if (link) {
        this.trackLinkClick(link.href, link.textContent || '');
      }
    });
    // Button tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button, input[type="button"], input[type="submit"]');
      if (button) {
        this.trackButtonClick(
          button.id || button.className || 'unknown',
          button.textContent || (button as HTMLInputElement).value || ''
        );
      }
    });
    // Form tracking
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.trackFormSubmit(form.name || form.id || 'unknown');
    });
  }
  /**
   * Sistem durumunu al
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      ...this.hybridSystem.getSystemStatus()
    };
  }
  /**
   * Offline verileri manuel senkronize et
   */
  async syncOfflineData(): Promise<void> {
    await this.hybridSystem.syncOfflineData();
  }
  /**
   * Debug modunu aç/kapat
   */
  setDebugMode(enabled: boolean): void {
    this.config.debug = enabled;
  }
}
// Global window objesine ekle
declare global {
  interface Window {
    UniversalTracking: typeof UniversalTracking;
  }
}
// Global olarak kullanılabilir hale getir
if (typeof window !== 'undefined') {
  window.UniversalTracking = UniversalTracking;
}
