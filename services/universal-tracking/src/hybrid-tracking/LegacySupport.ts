/**
 * Legacy Support - Eski scriptlerle uyumluluk
 * Eski API'leri yeni hibrit sisteme yönlendirir
 */
import { UniversalTracking } from './UniversalTracking';
export interface TrackingConfig {
  customerId: string;
  domain: string;
  apiEndpoint?: string;
  debug?: boolean;
}
export class LegacySupport {
  private tracking: UniversalTracking;
  private legacyConfig: any;
  constructor(tracking: UniversalTracking) {
    this.tracking = tracking;
    this.legacyConfig = {};
  }
  /**
   * Eski global namespace'i kur
   */
  setupLegacyGlobalNamespace(): void {
    // Eski window.UniversalTracking objesi
    (window as any).UniversalTracking = {
      // Eski init metodu
      init: async (config: any) => {
        this.legacyConfig = config;
        return await this.tracking.init();
      },
      // Eski track metodu
      track: (eventType: string, data: any) => {
        return this.tracking.trackEvent({
          event_type: eventType,
          metadata: data
        });
      },
      // Eski pageView metodu
      pageView: (url?: string) => {
        return this.tracking.trackPageView();
      },
      // Eski heartbeat metodu (artık kullanılmıyor ama uyumluluk için)
      heartbeat: () => {
        console.warn('⚠️ Heartbeat artık kullanılmıyor, pageView kullanın');
        return this.tracking.trackPageView();
      },
      // Eski bye metodu (artık kullanılmıyor ama uyumluluk için)
      bye: () => {
        console.warn('⚠️ Bye artık kullanılmıyor, pageView kullanın');
        return this.tracking.trackEvent({
          event_type: 'page_unload',
          metadata: { legacy_method: 'bye' }
        });
      },
      // Eski presence metodu
      presence: {
        beat: () => {
          console.warn('⚠️ Presence beat artık kullanılmıyor, pageView kullanın');
          return this.tracking.trackPageView();
        },
        bye: () => {
          console.warn('⚠️ Presence bye artık kullanılmıyor, pageView kullanın');
          return this.tracking.trackEvent({
            event_type: 'page_unload',
            metadata: { legacy_method: 'presence_bye' }
          });
        }
      },
      // Eski ecommerce metodu
      ecommerce: {
        track: (eventType: string, data: any) => {
          return this.tracking.trackEcommerceEvent(eventType, data);
        }
      }
    };
  }
  /**
   * Eski API endpoint'lerini mock'la
   */
  setupLegacyAPIEndpoints(): void {
    // Eski /presence/beat endpoint'i
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      // Eski endpoint'leri yakala
      if (url.includes('/presence/beat')) {
        console.warn('⚠️ Eski /presence/beat endpoint çağrıldı, hibrit sisteme yönlendiriliyor...');
        this.tracking.trackPageView();
        return new Response(JSON.stringify({ success: true, message: 'Legacy endpoint - redirected to hybrid system' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('/presence/bye')) {
        console.warn('⚠️ Eski /presence/bye endpoint çağrıldı, hibrit sisteme yönlendiriliyor...');
        this.tracking.trackEvent({
          event_type: 'page_unload',
          metadata: { legacy_method: 'presence_bye' }
        });
        return new Response(JSON.stringify({ success: true, message: 'Legacy endpoint - redirected to hybrid system' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('/presence/collect/events')) {
        console.warn('⚠️ Eski /presence/collect/events endpoint çağrıldı, hibrit sisteme yönlendiriliyor...');
        // Eski event data'sını parse et ve yeni sisteme gönder
        if (init?.body) {
          try {
            const eventData = JSON.parse(init.body as string);
            this.tracking.trackEvent({
              event_type: eventData.event_type || 'unknown',
              metadata: eventData
            });
          } catch (error) {
            console.warn('Legacy event data parse edilemedi:', error);
          }
        }
        return new Response(JSON.stringify({ success: true, message: 'Legacy endpoint - redirected to hybrid system' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Diğer istekleri normal şekilde işle
      return originalFetch(input, init);
    };
  }
  /**
   * Eski event type'larını map'le
   */
  mapLegacyEventTypes(eventType: string): string {
    const mapping: { [key: string]: string } = {
      'presence_beat': 'page_view',
      'presence_leave': 'page_unload',
      'active_users': 'page_view', // active_users artık yok
      'heartbeat': 'page_view',
      'page_view': 'page_view',
      'add_to_cart': 'add_to_cart',
      'purchase': 'purchase',
      'checkout': 'checkout'
    };
    return mapping[eventType] || eventType;
  }
  /**
   * Eski config'i yeni sisteme çevir
   */
  convertLegacyConfig(legacyConfig: any): TrackingConfig {
    return {
      customerId: legacyConfig.site_id || legacyConfig.customerId || 'unknown',
      domain: legacyConfig.domain || window.location.hostname,
      apiEndpoint: legacyConfig.apiEndpoint,
      debug: legacyConfig.debug || false
    };
  }
  /**
   * Legacy desteği başlat
   */
  initializeLegacySupport(): void {
    this.setupLegacyGlobalNamespace();
    this.setupLegacyAPIEndpoints();
  }
}