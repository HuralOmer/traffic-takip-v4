/**
 * Device Detection Types
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type PlatformType = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown';
export type BrowserType = 'chrome' | 'safari' | 'firefox' | 'edge' | 'opera' | 'samsung' | 'unknown';
export interface UserAgentInfo {
  platform: PlatformType;
  device: DeviceType;
  browser: BrowserType;
  userAgent: string;
}
export interface DetectedDeviceInfo {
  device: DeviceType;
  platform: PlatformType;
  maxTouchPoints: number;
  screenWidth: number;
  screenHeight: number;
  hasCoarsePointer: boolean;
  hasFinePointer: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  vendor?: string;
  orientation?: string;
}
export interface DeviceDetectionResult {
  // User-Agent'tan gelen bilgiler
  reported: UserAgentInfo;
  // Gerçek tespit edilen bilgiler
  detected: DetectedDeviceInfo;
  // Analiz sonucu
  realDeviceType: 'android_mobile' | 'android_tablet' | 'ios_mobile' | 'ios_tablet' | 'desktop' | 'unknown';
  spoofingDetected: boolean;
  confidence: 'high' | 'medium' | 'low';
  // Detaylar
  reasons: string[];
  timestamp: number;
  // ✅ ML ENHANCEMENT: Additional ML data
  ml?: {
    deviceType: string;
    confidence: number;
    mlScore: number;
    signals: any[];
    reasoning: string[];
  };
  fingerprint?: string;
  historicalBoost?: number;
  performance?: {
    detectionTime: number;
    memoryUsage: number;
    cacheHitRate: number;
  };
}
export interface DetectionConfig {
  enableClientHints?: boolean;
  mobileMaxWidth?: number;
  tabletMinWidth?: number;
  debug?: boolean;
  // ✅ ML ENHANCEMENT: ML configuration options
  enableML?: boolean;
  enableHistoricalLearning?: boolean;
  enablePerformanceMonitoring?: boolean;
}
