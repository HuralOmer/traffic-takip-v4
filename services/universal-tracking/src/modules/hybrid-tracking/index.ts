/**
 * Hibrit Tracking Sistemi - Modules Export
 * Bu dosya ana hybrid-tracking klasöründeki dosyaları re-export eder
 */

// Ana hybrid-tracking klasöründen export'ları al
export { HybridTrackingSystem } from '../../hybrid-tracking/HybridTrackingSystem';
export { UniversalTracking } from '../../hybrid-tracking/UniversalTracking';
export { LegacySupport } from '../../hybrid-tracking/LegacySupport';
export type { TrackingEvent, TrackingMethod } from '../../hybrid-tracking/HybridTrackingSystem';
export type { TrackingConfig } from '../../hybrid-tracking/UniversalTracking';

// createTrackingScript fonksiyonunu da export et
export { createTrackingScript } from '../../hybrid-tracking/index';
