/**
 * Main Device Detection Orchestrator
 * Combines all detectors and returns final result
 */
import type { DeviceDetectionResult, DetectionConfig } from './types/index.js';
import { detectAndroidMobile, detectAndroidMobileSpoof } from './android_mobile/detector.js';
import { detectAndroidTablet, detectAndroidTabletSpoof } from './android_tablet/detector.js';
import { detectiOSMobile, detectiOSMobileSpoof } from './ios_mobile/detector.js';
import { detectiOSTablet, detectiPadFromMacintosh, distinguishMacFromiPad } from './ios_tablet/detector.js';
import { 
  getTouchSupport, 
  getPointerType, 
  getScreenInfo, 
  getHardwareInfo,
  getVendorInfo,
  parseUserAgent,
  getClientHints,
  getBrowserInfo,
  clearBrowserInfoCache
} from './shared/utils.js';
import { 
  detectDeviceWithML, 
  type MLScoringConfig,
  updateAdaptiveWeights 
} from './ml/scoring.js';
import { 
  generateFingerprint, 
  storeFingerprint, 
  findSimilarPatterns, 
  getHistoricalConfidence,
  learnFromFeedback,
  getFingerprintStats 
} from './ml/fingerprinting.js';
import { 
  startPerformanceMeasurement, 
  endPerformanceMeasurement,
  runBenchmark,
  getPerformanceMetrics,
  checkPerformanceAlerts,
  withPerformanceMonitoring 
} from './ml/performance.js';

/**
 * Helper: Convert string confidence to numeric value
 */
function confidenceToNumber(confidence: 'high' | 'medium' | 'low'): number {
  switch (confidence) {
    case 'high': return 0.9;
    case 'medium': return 0.6;
    case 'low': return 0.3;
  }
}

/**
 * Helper: Convert numeric confidence to string
 */
function numberToConfidence(value: number): 'high' | 'medium' | 'low' {
  if (value >= 0.75) return 'high';
  if (value >= 0.5) return 'medium';
  return 'low';
}

/**
 * Main device detection function
 */
export async function detectDevice(
  userAgent: string,
  config: DetectionConfig = {}
): Promise<DeviceDetectionResult> {
  const {
    enableClientHints = true,
    mobileMaxWidth = 768,
    tabletMinWidth = 768,
    debug = false,
    enableML = true,
    enableHistoricalLearning = true,
    enablePerformanceMonitoring = true,
  } = config;
  // ✅ PERFORMANCE MONITORING: Start measurement
  const { startTime, startMemory } = enablePerformanceMonitoring 
    ? startPerformanceMeasurement() 
    : { startTime: 0, startMemory: 0 };
  // ✅ PERFORMANCE OPTIMIZATION: Single call to get all browser info (with 100ms cache)
  const browserInfo = getBrowserInfo();
  const { touch, pointer, screen, hardware, vendor, ua: uaFromCache } = browserInfo;
  // Override UA with provided userAgent (for server-side usage)
  const ua = parseUserAgent(userAgent);
  // Try Client Hints if enabled
  let clientHints = null;
  if (enableClientHints) {
    clientHints = await getClientHints();
  }
  // ✅ CRITICAL FIX: Safari/Macintosh ön kontrolü - Safari sadece iOS/macOS'ta çalışır!
  const isSafari = userAgent.toLowerCase().includes('safari') && !userAgent.toLowerCase().includes('chrome');
  const hasMacintosh = ua.isMacintosh;
  const hasAppleVendor = vendor.vendor.includes('Apple');
  // ✅ PRE-CHECK: Safari veya Macintosh varsa bu iOS/macOS'tur, Android OLAMAZ!
  const isDefinitelyApple = isSafari || hasMacintosh || hasAppleVendor;
  if (debug && isDefinitelyApple) {
  }
  // Run detectors based on pre-check
  let androidMobile, androidTablet, iosMobile, iosTablet;
  if (isDefinitelyApple) {
    // ✅ Only run iOS detectors (skip Android completely)
    androidMobile = { isAndroidMobile: false, confidence: 'low' as const, reasons: ['Skipped: Apple device detected'] };
    androidTablet = { isAndroidTablet: false, confidence: 'low' as const, reasons: ['Skipped: Apple device detected'] };
    iosMobile = detectiOSMobile(userAgent);
    iosTablet = detectiOSTablet(userAgent);
  } else {
    // Run all detectors
    androidMobile = detectAndroidMobile(userAgent);
    androidTablet = detectAndroidTablet(userAgent);
    iosMobile = detectiOSMobile(userAgent);
    iosTablet = detectiOSTablet(userAgent);
  }
  // Debug: Log all detector results
  if (debug) {
      }
  // Detect spoofing
  const androidMobileSpoof = detectAndroidMobileSpoof(userAgent);
  const androidTabletSpoof = detectAndroidTabletSpoof(userAgent);
  const iosMobileSpoof = detectiOSMobileSpoof(userAgent);
  const iPadFromMac = detectiPadFromMacintosh(userAgent);
  // ✅ MAJOR FIX: Collect ALL valid detections, then choose the BEST one
  interface DetectionCandidate {
    type: DeviceDetectionResult['realDeviceType'];
    confidence: 'high' | 'medium' | 'low';
    score: number;
    reasons: string[];
    spoofing: boolean;
  }
  const candidates: DetectionCandidate[] = [];
  // Confidence to numeric score mapping
  const confidenceScore = { high: 100, medium: 50, low: 10 };
  if (androidMobile.isAndroidMobile) {
    candidates.push({
      type: 'android_mobile',
      confidence: androidMobile.confidence,
      score: confidenceScore[androidMobile.confidence],
      reasons: androidMobile.reasons,
      spoofing: androidMobileSpoof,
    });
  }
  if (androidTablet.isAndroidTablet) {
    candidates.push({
      type: 'android_tablet',
      confidence: androidTablet.confidence,
      score: confidenceScore[androidTablet.confidence],
      reasons: androidTablet.reasons,
      spoofing: androidTabletSpoof,
    });
  }
  if (iosMobile.isiOSMobile) {
    candidates.push({
      type: 'ios_mobile',
      confidence: iosMobile.confidence,
      score: confidenceScore[iosMobile.confidence],
      reasons: iosMobile.reasons,
      spoofing: iosMobileSpoof,
    });
  }
  if (iosTablet.isiOSTablet) {
    candidates.push({
      type: 'ios_tablet',
      confidence: iosTablet.confidence,
      score: confidenceScore[iosTablet.confidence],
      reasons: iosTablet.reasons,
      spoofing: iPadFromMac,
    });
  }
  // ✅ FIX: Safari + Android = IMPOSSIBLE! Remove Android candidates if Safari detected
  if (isSafari) {
    const beforeFilter = candidates.length;
    candidates.forEach((candidate) => {
      if (candidate.type.includes('android')) {
        candidate.score = -1000; // Invalidate
        candidate.reasons.push('❌ IMPOSSIBLE: Safari does not run on Android!');
      }
    });
    if (debug && beforeFilter !== candidates.filter(c => c.score > 0).length) {
          }
  }
  // ✅ FIX: Choose the BEST candidate (highest score, then confidence)
  const validCandidates = candidates.filter(c => c.score > 0);
  let realDeviceType: DeviceDetectionResult['realDeviceType'] = 'unknown';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let spoofingDetected = false;
  const allReasons: string[] = [];
  if (validCandidates.length > 0) {
    // Sort by score (highest first)
    validCandidates.sort((a, b) => b.score - a.score);
    const winner = validCandidates[0]!; // Safe: length check guarantees this exists
    realDeviceType = winner.type;
    confidence = winner.confidence;
    spoofingDetected = winner.spoofing;
    allReasons.push(...winner.reasons);
    if (debug) {
      if (validCandidates.length > 1) {
      }
    }
  } else if (touch.maxTouchPoints === 0 && !pointer.hasCoarsePointer) {
    // No touch, fine pointer = Real desktop
    realDeviceType = 'desktop';
    confidence = 'high';
    allReasons.push('No touch support + fine pointer = Desktop');
  } else {
    // ✅ FIX: No valid candidates - try to make educated guess
    if (touch.maxTouchPoints > 0) {
      // Has touch = mobile or tablet
      if (screen.width < 768) {
        realDeviceType = hasAppleVendor ? 'ios_mobile' : 'android_mobile';
        confidence = 'low';
        allReasons.push(`⚠️ FALLBACK: Touch device with small screen, assuming ${realDeviceType}`);
      } else {
        realDeviceType = hasAppleVendor ? 'ios_tablet' : 'android_tablet';
        confidence = 'low';
        allReasons.push(`⚠️ FALLBACK: Touch device with large screen, assuming ${realDeviceType}`);
      }
    } else {
      realDeviceType = 'desktop';
      confidence = 'low';
      allReasons.push('⚠️ FALLBACK: Assuming desktop');
    }
  }
  // ✅ CRITICAL FIX: Safari + Macintosh + No Touch = Real Mac Desktop!
  if (isSafari && hasMacintosh && touch.maxTouchPoints === 0) {
    realDeviceType = 'desktop';
    confidence = 'high';
    allReasons.push('✅ Safari + Macintosh + No Touch = Real Mac Desktop (NOT iPad!)');
    spoofingDetected = false; // This is legitimate, not spoofing
  }
  // ✅ VALIDATION: Impossible combinations check
  else if (isSafari && realDeviceType.includes('android')) {
    // Silent correction: Safari can only run on iOS/macOS
    // Force correction based on screen size and touch
    if (touch.maxTouchPoints === 0) {
      // No touch = desktop
      realDeviceType = 'desktop';
      allReasons.push('🔧 AUTO-CORRECTED: Safari + Android + No Touch = Mac Desktop');
      confidence = 'high';
    } else if (screen.width < 600) {
      realDeviceType = 'ios_mobile';
      allReasons.push('🔧 AUTO-CORRECTED: Safari + Android impossible, forced to iOS Mobile (screen < 600px)');
      confidence = 'medium';
    } else if (screen.width >= 768 && touch.maxTouchPoints === 5) {
      realDeviceType = 'ios_tablet';
      allReasons.push('🔧 AUTO-CORRECTED: Safari + Android impossible, forced to iOS Tablet (screen >= 768px + 5 touch)');
      confidence = 'medium';
    } else {
      // 600-768px range - could be iPad mini
      realDeviceType = 'ios_tablet';
      allReasons.push('🔧 AUTO-CORRECTED: Safari + Android impossible, forced to iOS Tablet (iPad mini range)');
      confidence = 'medium';
    }
    spoofingDetected = true; // If we're correcting, there's likely desktop mode
  }
  // ✅ ADDITIONAL VALIDATION: Apple vendor + Android = impossible
  if (hasAppleVendor && realDeviceType.includes('android')) {
    // Silent correction: Apple vendor can only be on iOS/macOS
    if (screen.width < 600) {
      realDeviceType = 'ios_mobile';
    } else {
      realDeviceType = 'ios_tablet';
    }
    confidence = 'medium';
    allReasons.push('🔧 AUTO-CORRECTED: Apple vendor + Android impossible, forced to iOS');
    spoofingDetected = true;
  }
  // ✅ ADDITIONAL VALIDATION: Macintosh + Android = impossible
  if (hasMacintosh && realDeviceType.includes('android')) {
    // Silent correction: Macintosh UA can only be on iOS/macOS
    if (screen.width < 600) {
      realDeviceType = 'ios_mobile';
    } else {
      realDeviceType = 'ios_tablet';
    }
    confidence = 'medium';
    allReasons.push('🔧 AUTO-CORRECTED: Macintosh + Android impossible, forced to iOS');
    spoofingDetected = true;
  }
  // Parse reported info from User-Agent
  const reportedPlatform = ua.hasAndroid ? 'android' :
                          ua.hasIOS ? 'ios' :
                          ua.isMacintosh ? 'macos' :
                          ua.isWindows ? 'windows' :
                          ua.isLinux ? 'linux' : 'unknown';
  const reportedDevice = ua.hasMobile ? 'mobile' :
                        ua.hasTablet ? 'tablet' : 'desktop';
  // ✅ CRITICAL: Check browsers in order of specificity (most specific first)
  const reportedBrowser = userAgent.toLowerCase().includes('yabrowser') ? 'yandex' :
                         userAgent.toLowerCase().includes('edg/') || userAgent.toLowerCase().includes('edgios') || userAgent.toLowerCase().includes('edga') ? 'edge' :
                         userAgent.toLowerCase().includes('opr/') || userAgent.toLowerCase().includes('opera') ? 'opera' :
                         userAgent.toLowerCase().includes('firefox') || userAgent.toLowerCase().includes('fxios') ? 'firefox' :
                         userAgent.toLowerCase().includes('chrome') || userAgent.toLowerCase().includes('crios') ? 'chrome' :
                         userAgent.toLowerCase().includes('safari') ? 'safari' :
                         userAgent.toLowerCase().includes('samsung') ? 'samsung' : 'unknown';
  // ✅ FIX: Determine detected platform with better logic
  let detectedPlatform: typeof reportedPlatform;
  if (realDeviceType.includes('android')) {
    detectedPlatform = 'android';
  } else if (realDeviceType.includes('ios')) {
    detectedPlatform = 'ios';
  } else if (realDeviceType === 'desktop') {
    // For desktop, use signals to determine OS
    if (hasAppleVendor || hasMacintosh) {
      // ✅ CRITICAL: Desktop + Apple = macOS (not iOS)
      detectedPlatform = 'macos';
    } else if (ua.isWindows) {
      detectedPlatform = 'windows';
    } else if (ua.isLinux) {
      detectedPlatform = 'linux';
    } else {
      detectedPlatform = reportedPlatform; // Use UA reported platform
    }
  } else {
    // Unknown case - use best guess from signals
    if (hasAppleVendor || hasMacintosh || isSafari) {
      // ✅ FIX: If no touch, it's macOS desktop, not iOS
      if (touch.maxTouchPoints === 0) {
        detectedPlatform = 'macos';
      } else {
        detectedPlatform = 'ios'; // Has touch = likely iOS
      }
    } else if (ua.hasAndroid) {
      detectedPlatform = 'android';
    } else {
      detectedPlatform = 'unknown';
    }
  }
  const detectedDevice = realDeviceType.includes('mobile') ? 'mobile' :
                        realDeviceType.includes('tablet') ? 'tablet' :
                        realDeviceType === 'desktop' ? 'desktop' : 'mobile';
  // ✅ ML ENHANCEMENT: Run ML-based detection for comparison
  let mlResult = null;
  let historicalBoost = 0;
  let fingerprint = '';
  if (enableML) {
    try {
      // Generate device fingerprint
      fingerprint = generateFingerprint(userAgent, screen, touch, vendor, hardware);
      // Run ML detection
      const mlConfig: MLScoringConfig = {
        enableAdaptiveWeights: true,
        enableHistoricalLearning,
        confidenceThreshold: 0.7,
        debug
      };
      mlResult = detectDeviceWithML(userAgent, screen, touch, vendor, hardware, mlConfig);
      // Get historical confidence boost
      if (enableHistoricalLearning) {
        const baseConfidenceNum = confidenceToNumber(confidence);
        const boostedConfidenceNum = getHistoricalConfidence(fingerprint, realDeviceType, baseConfidenceNum);
        historicalBoost = boostedConfidenceNum - baseConfidenceNum;
        // Store fingerprint for future learning
        storeFingerprint(
          fingerprint,
          realDeviceType,
          boostedConfidenceNum,
          {
            userAgent: userAgent.substring(0, 100),
            screen: `${screen.width}x${screen.height}`,
            touch: touch.maxTouchPoints,
            vendor: vendor.vendor,
            platform: detectedPlatform,
            device: detectedDevice
          }
        );
      }
      // Find similar patterns
      const similarPatterns = findSimilarPatterns({
        screen: `${screen.width}x${screen.height}`,
        touch: touch.maxTouchPoints,
        vendor: vendor.vendor,
        platform: detectedPlatform
      });
      // Similar patterns log removed for cleaner console
    } catch (error) {
      console.warn('⚠️ [ML] ML detection failed, using traditional method:', error);
    }
  }
  // ✅ PERFORMANCE MONITORING: End measurement
  let performanceMetrics = null;
  if (enablePerformanceMonitoring) {
    performanceMetrics = endPerformanceMeasurement(
      startTime,
      startMemory,
      confidenceToNumber(confidence) + historicalBoost,
      Object.keys({ touch, pointer, screen, hardware, vendor }).length,
      mlResult?.confidence || 0,
      historicalBoost
    );
  }
  // Debug logs removed for cleaner console
  // Calculate final confidence
  const finalConfidenceNum = confidenceToNumber(confidence) + historicalBoost;
  const finalConfidence = numberToConfidence(finalConfidenceNum);
  
  // Build detected object with proper optional handling
  const detected: DeviceDetectionResult['detected'] = {
    device: detectedDevice,
    platform: detectedPlatform,
    maxTouchPoints: touch.maxTouchPoints,
    screenWidth: screen.width,
    screenHeight: screen.height,
    hasCoarsePointer: pointer.hasCoarsePointer,
    hasFinePointer: pointer.hasFinePointer,
  };
  
  // Add optional properties only if defined
  if (hardware.deviceMemory !== undefined) {
    detected.deviceMemory = hardware.deviceMemory;
  }
  if (hardware.hardwareConcurrency !== undefined) {
    detected.hardwareConcurrency = hardware.hardwareConcurrency;
  }
  if (vendor.vendor !== undefined) {
    detected.vendor = vendor.vendor;
  }
  if (screen.orientation !== undefined) {
    detected.orientation = screen.orientation;
  }
  
  // Build result object
  const result: DeviceDetectionResult = {
    reported: {
      platform: reportedPlatform,
      device: reportedDevice,
      browser: reportedBrowser,
      userAgent,
    },
    detected,
    realDeviceType,
    spoofingDetected,
    confidence: finalConfidence,
    reasons: allReasons,
    timestamp: Date.now(),
  };
  
  // Add optional properties only if defined
  if (mlResult) {
    result.ml = {
      deviceType: mlResult.deviceType,
      confidence: mlResult.confidence,
      mlScore: mlResult.confidence,
      signals: mlResult.signals,
      reasoning: mlResult.reasoning,
    };
  }
  if (fingerprint) {
    result.fingerprint = fingerprint;
  }
  if (historicalBoost > 0) {
    result.historicalBoost = historicalBoost;
  }
  if (performanceMetrics) {
    result.performance = {
      detectionTime: performanceMetrics.detectionTime,
      memoryUsage: performanceMetrics.memoryUsage,
      cacheHitRate: performanceMetrics.cacheHitRate,
    };
  }
  
  return result;
}
/**
 * Quick check if device is mobile (any mobile)
 */
export function isMobileDevice(userAgent: string): boolean {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  const screen = getScreenInfo();
  return (
    (ua.hasMobile || touch.maxTouchPoints > 0) &&
    screen.width < 768
  );
}
/**
 * Quick check if device is tablet (any tablet)
 */
export function isTabletDevice(userAgent: string): boolean {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  const screen = getScreenInfo();
  return (
    touch.maxTouchPoints > 0 &&
    screen.width >= 768 &&
    screen.width <= 1366
  );
}
