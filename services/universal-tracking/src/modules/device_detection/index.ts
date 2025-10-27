/**
 * Device Detection Module
 * Entry point for all device detection functionality
 */
// Main detector
export { detectDevice, isMobileDevice, isTabletDevice } from './detector.js';
// Types
export type {
  DeviceType,
  PlatformType,
  BrowserType,
  UserAgentInfo,
  DetectedDeviceInfo,
  DeviceDetectionResult,
  DetectionConfig,
} from './types/index.js';
// Individual detectors (for advanced usage)
export { 
  detectAndroidMobile, 
  detectAndroidMobileSpoof 
} from './android_mobile/detector.js';
export { 
  detectAndroidTablet, 
  detectAndroidTabletSpoof 
} from './android_tablet/detector.js';
export { 
  detectiOSMobile, 
  detectiOSMobileSpoof 
} from './ios_mobile/detector.js';
export { 
  detectiOSTablet, 
  detectiPadFromMacintosh,
  distinguishMacFromiPad 
} from './ios_tablet/detector.js';
// Utility functions
export {
  getTouchSupport,
  getPointerType,
  getScreenInfo,
  getHardwareInfo,
  getVendorInfo,
  hasClientHints,
  getClientHints,
  parseUserAgent,
  getBrowserInfo,
  clearBrowserInfoCache,
} from './shared/utils.js';
// ✅ ML EXPORTS
export { 
  detectDeviceWithML, 
  updateAdaptiveWeights, 
  resetAdaptiveWeights,
  type MLScoringConfig,
  type MLDetectionResult 
} from './ml/scoring.js';
export { 
  generateFingerprint, 
  storeFingerprint, 
  findSimilarPatterns, 
  getHistoricalConfidence,
  learnFromFeedback,
  getFingerprintStats,
  exportFingerprintData,
  importFingerprintData,
  type DeviceFingerprint,
  type HistoricalPattern 
} from './ml/fingerprinting.js';
export { 
  startPerformanceMeasurement, 
  endPerformanceMeasurement,
  runBenchmark,
  getPerformanceMetrics,
  checkPerformanceAlerts,
  getOptimizationSuggestions,
  withPerformanceMonitoring,
  exportPerformanceData,
  clearPerformanceData,
  type PerformanceMetrics,
  type BenchmarkResult 
} from './ml/performance.js';
