/**
 * iOS Tablet (iPad) Device Detector
 * 
 * IMPORTANT: iOS 13+ iPads default to desktop mode, reporting as "Macintosh"
 * Main detection relies on: maxTouchPoints = 5 + tablet screen size
 */
import { getTouchSupport, getPointerType, getScreenInfo, getVendorInfo, parseUserAgent } from '../shared/utils.js';
export interface iOSTabletSignals {
  isiOSTablet: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}
/**
 * Detect if device is iPad
 */
export function detectiOSTablet(userAgent: string): iOSTabletSignals {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  const pointer = getPointerType();
  const screen = getScreenInfo();
  const vendor = getVendorInfo();
  const reasons: string[] = [];
  let score = 0;
  // ✅ CRITICAL: Android cihazları hariç tut!
  if (ua.hasAndroid) {
    score -= 20;
    reasons.push('❌ User-Agent contains Android (NOT iOS)');
  }
  // ✅ CRITICAL: Apple vendor YOKSA iOS olamaz!
  if (touch.maxTouchPoints > 0 && !vendor.vendor.includes('Apple')) {
    score -= 15;
    reasons.push('❌ Touch device but NOT Apple vendor (NOT iOS)');
  }
  // 1. User-Agent kontrolleri (GÜÇLENDİRİLDİ)
  if (ua.hasiPad) {
    score += 10;
    reasons.push('✅ User-Agent contains iPad (VERY STRONG - iOS 12 and below)');
  }
  // iOS 13+ iPads report as Macintosh!
  if (ua.isMacintosh && !ua.hasiPad && !ua.hasAndroid) {
    score += 5;
    reasons.push('✅ User-Agent is Macintosh without Android (STRONG - iOS 13+ iPad in desktop mode)');
  }
  // ✅ CRITICAL: Macintosh + Safari (not Chrome) = very likely iPad!
  const isSafari = userAgent.toLowerCase().includes('safari') && !userAgent.toLowerCase().includes('chrome');
  if (ua.isMacintosh && isSafari && !ua.hasAndroid) {
    score += 6;
    reasons.push('✅ Macintosh + Safari (VERY STRONG iPad indicator)');
  }
  // ✅ ADDITIONAL: "Version/XX.X" in UA = iOS version indicator
  if (userAgent.includes('Version/') && ua.isMacintosh) {
    score += 4;
    reasons.push('✅ Version number in UA (iOS indicator on Macintosh)');
  }
  // 2. Ekran boyutu kontrolleri (iPad specific)
  if (screen.width >= 768 && screen.width <= 1366) {
    score += 3;
    reasons.push(`Screen width ${screen.width}px in iPad range (768-1366px)`);
  }
  // ✅ Small screen + Macintosh + Safari = iPad mini or older iPad
  if (screen.width >= 600 && screen.width < 768 && ua.isMacintosh && isSafari) {
    score += 5;
    reasons.push('✅ Small tablet screen + Macintosh + Safari (iPad mini/older)');
  }
  // Common iPad resolutions
  if (
    screen.width === 768 || // iPad mini, iPad (portrait)
    screen.width === 810 || // iPad 10.2" (portrait)
    screen.width === 834 || // iPad Air/Pro 10.5-11" (portrait)
    screen.width === 1024 || // iPad (landscape)
    screen.width === 1080 || // iPad 10.2" (landscape)
    screen.width === 1112 || // iPad Air/Pro 10.5-11" (landscape)
    screen.width === 1366 // iPad Pro 12.9" (landscape)
  ) {
    score += 3;
    reasons.push(`Screen width ${screen.width}px matches known iPad resolution`);
  }
  // 3. Touch kontrolleri - EN ÖNEMLİ!
  // iPad ALWAYS has exactly 5 touch points (Apple standard)
  // Desktop Mac has 0 touch points
  if (touch.maxTouchPoints === 5) {
    score += 6;
    reasons.push('Exactly 5 touch points - STRONG iPad indicator (Mac has 0)');
  } else if (touch.maxTouchPoints > 0) {
    score += 2;
    reasons.push(`Has touch support (${touch.maxTouchPoints} points)`);
  }
  // 4. Pointer type kontrolü
  if (pointer.hasCoarsePointer) {
    score += 2;
    reasons.push('Has coarse pointer (touch input)');
  }
  // 5. Vendor kontrolü (Apple) - GÜÇLENDİRİLDİ
  if (vendor.vendor.includes('Apple')) {
    score += 5;
    reasons.push('✅ Vendor is Apple Computer, Inc. (STRONG)');
  }
  // 6. Platform kontrolü
  if (vendor.platform === 'iPad') {
    score += 4;
    reasons.push('Platform is iPad (iOS 12 and below)');
  } else if (vendor.platform === 'MacIntel') {
    score += 1;
    reasons.push('Platform is MacIntel (iOS 13+ iPad reports this)');
  }
  // 7. Aspect ratio (iPad genelde 3:4 veya 4:3)
  const aspectRatio = screen.aspectRatio;
  if ((aspectRatio >= 0.7 && aspectRatio <= 0.8) || (aspectRatio >= 1.3 && aspectRatio <= 1.4)) {
    score += 2;
    reasons.push(`Aspect ratio ${aspectRatio.toFixed(2)} matches iPad (3:4 or 4:3)`);
  }
  // ✅ SUPER CRITICAL: Macintosh + Apple vendor = %99 iPad! (Mac has no touch)
  if (ua.isMacintosh && vendor.vendor.includes('Apple') && touch.maxTouchPoints > 0) {
    score += 10;
    reasons.push('✅ SUPER CRITICAL: Macintosh + Apple vendor + Touch = iPad! (Mac has 0 touch)');
  }
  // KRITIK KOMBINASYON: Macintosh + 5 touch points + tablet screen = iPad!
  if (ua.isMacintosh && touch.maxTouchPoints === 5 && screen.width >= 768 && screen.width <= 1366) {
    score += 5;
    reasons.push('CRITICAL: Macintosh + 5 touch points + tablet screen = iPad detected!');
  }
  // ✅ ULTIMATE: Macintosh + Safari + Version/ + Apple vendor = %100 iPad!
  if (ua.isMacintosh && isSafari && userAgent.includes('Version/') && vendor.vendor.includes('Apple')) {
    score += 8;
    reasons.push('✅ ULTIMATE: Macintosh + Safari + Version + Apple = %100 iPad!');
  }
  // Negatif sinyaller - Ekran boyutu kritik!
  if (screen.width < 600) {
    score -= 10;
    reasons.push(`❌ Screen width ${screen.width}px < 600px (iPhone range, NOT iPad)`);
  }
  // ✅ 600-768px range = iPad mini territory (but weak signal)
  else if (screen.width >= 600 && screen.width < 768) {
    score += 2;
    reasons.push(`Screen width ${screen.width}px in iPad mini range (600-768px)`);
  }
  if (ua.hasiPhone) {
    score -= 5;
    reasons.push('User-Agent contains iPhone (not iPad)');
  }
  
  // ✅ CRITICAL FIX: Macintosh + No touch = REAL MAC DESKTOP, NOT iPad!
  // iPad ALWAYS has exactly 5 touch points, Mac has 0
  if (touch.maxTouchPoints === 0 && ua.isMacintosh) {
    score -= 20; // Strong negative - definitely not iPad
    reasons.push('❌ CRITICAL: No touch points + Macintosh = Real Mac desktop, NOT iPad!');
  }
  
  // ✅ Additional check: Large desktop screen + no touch = Mac desktop
  if (touch.maxTouchPoints === 0 && screen.width > 1366) {
    score -= 10;
    reasons.push('❌ Large desktop screen + no touch = Mac desktop, NOT iPad');
  }
  
  // Güvenilirlik hesapla
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 15) {
    confidence = 'high';
  } else if (score >= 8) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  return {
    isiOSTablet: score >= 8, // ✅ Threshold güncellendi
    confidence,
    reasons,
  };
}
/**
 * Detect if a Macintosh UA is actually an iPad
 * This is the most reliable iPad detection for iOS 13+
 */
export function detectiPadFromMacintosh(userAgent: string): boolean {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  const screen = getScreenInfo();
  const vendor = getVendorInfo();
  
  // ✅ CRITICAL: If no touch points, this is DEFINITELY a real Mac, NOT iPad
  if (touch.maxTouchPoints === 0) {
    return false; // Real Mac desktop
  }
  
  // iPad masquerades as Macintosh in iOS 13+
  // Key difference: iPad has exactly 5 touch points, Mac has 0
  const isMacintosh = ua.isMacintosh && !ua.hasiPad;
  const hasExactly5TouchPoints = touch.maxTouchPoints === 5;
  const hasTabletScreen = screen.width >= 768 && screen.width <= 1366;
  const isApple = vendor.vendor.includes('Apple');
  
  return isMacintosh && hasExactly5TouchPoints && hasTabletScreen && isApple;
}
/**
 * Distinguish between real Mac and iPad
 */
export function distinguishMacFromiPad(userAgent: string): 'ipad' | 'mac' | 'unknown' {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  if (!ua.isMacintosh) {
    return 'unknown';
  }
  // The GOLDEN RULE:
  // iPad: maxTouchPoints = 5
  // Mac:  maxTouchPoints = 0
  if (touch.maxTouchPoints === 5) {
    return 'ipad';
  } else if (touch.maxTouchPoints === 0) {
    return 'mac';
  }
  return 'unknown';
}
