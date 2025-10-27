/**
 * Hibrit Tracking Sistemi - Ana Export
 */
export { HybridTrackingSystem } from './HybridTrackingSystem';
export { UniversalTracking } from './UniversalTracking';
export { LegacySupport } from './LegacySupport';
export type { TrackingEvent, TrackingMethod } from './HybridTrackingSystem';
export type { TrackingConfig } from './UniversalTracking';
// Import for internal use
import type { TrackingConfig } from './UniversalTracking';
import { UniversalTracking as UniversalTrackingClass } from './UniversalTracking';
import { HybridTrackingSystem as HybridTrackingSystemClass } from './HybridTrackingSystem';
import { LegacySupport as LegacySupportClass } from './LegacySupport';
// Otomatik başlatma script'i
export const createTrackingScript = (config: TrackingConfig): string => {
  // Sınıfların string representation'larını al
  const universalTrackingClassString = UniversalTrackingClass.toString();
  const hybridTrackingSystemClassString = HybridTrackingSystemClass.toString();
  const legacySupportClassString = LegacySupportClass.toString();
  return `
<!-- Universal Tracking Script - Hibrit Sistem + Legacy Support -->
<script>
(function() {
    'use strict';
    // Konfigürasyon
    const config = {
        customerId: '${config.customerId}',
        domain: '${config.domain}',
        apiEndpoint: '${config.apiEndpoint || `https://tracking.${config.domain}`}',
        debug: ${config.debug || false}
    };
    // Universal Tracking sınıfını yükle
    ${universalTrackingClassString}
    ${hybridTrackingSystemClassString}
    ${legacySupportClassString}
    // Tracking instance oluştur
    const tracking = new UniversalTrackingClass(config);
    // Otomatik başlatma
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            tracking.init().then(() => {
                // Auto-tracking başlat
                tracking.startAutoTracking();
                tracking.startScrollTracking();
            });
        });
    } else {
        tracking.init().then(() => {
            // Auto-tracking başlat
            tracking.startAutoTracking();
            tracking.startScrollTracking();
        });
    }
    // Global olarak erişilebilir yap
    window.UniversalTracking = tracking;
    window.HybridUniversalTracking = tracking; // Hibrit sistem için
})();
</script>
<!-- Universal Tracking Script End -->
  `.trim();
};
// Legacy script oluşturucu (artık createTrackingScript içinde)
// export const createLegacyScript = (): string => { ... };