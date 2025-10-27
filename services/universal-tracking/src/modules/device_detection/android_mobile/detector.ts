/**
 * Android Mobile Device Detector
 */
import { getTouchSupport, getPointerType, getScreenInfo, getVendorInfo, parseUserAgent } from '../shared/utils.js';
export interface AndroidMobileSignals {
  isAndroidMobile: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}
/**
 * Detect if device is Android Mobile
 */
export function detectAndroidMobile(userAgent: string): AndroidMobileSignals {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  const pointer = getPointerType();
  const screen = getScreenInfo();
  const reasons: string[] = [];
  let score = 0;
  // ✅ CRITICAL: iOS cihazları hariç tut!
  if (ua.hasIOS || ua.hasiPhone || ua.hasiPad) {
    score -= 20;
    reasons.push('❌ User-Agent contains iOS/iPhone/iPad (NOT Android)');
  }
  // 1. User-Agent kontrolleri
  if (ua.hasAndroid) {
    score += 5;
    reasons.push('✅ User-Agent contains Android (STRONG)');
  }
  if (ua.hasMobile) {
    score += 2;
    reasons.push('User-Agent contains Mobile keyword');
  }
  // 2. Ekran boyutu kontrolleri
  if (screen.width < 768) {
    score += 3;
    reasons.push(`Screen width ${screen.width}px < 768px (mobile range)`);
  }
  if (screen.width >= 360 && screen.width <= 480) {
    score += 2;
    reasons.push(`Screen width ${screen.width}px in typical mobile range`);
  }
  // 3. Touch kontrolleri (ANDROID'İN EN GÜÇLÜ SİNYALİ!)
  if (touch.maxTouchPoints > 0) {
    score += 2;
    reasons.push(`Has touch support (${touch.maxTouchPoints} points)`);
  }
  // ✅ CRITICAL: Android'in ayırt edici özelliği - 5'ten fazla touch point
  if (touch.maxTouchPoints > 5) {
    score += 6;
    reasons.push(`✅ High touch points (${touch.maxTouchPoints}) - STRONG Android indicator (Apple always = 5)`);
  }
  // ✅ ADDITIONAL: Apple vendor YOKSA Android olabilir
  if (touch.maxTouchPoints > 0 && !getVendorInfo().vendor.includes('Apple')) {
    score += 4;
    reasons.push('✅ Touch device but NOT Apple vendor - likely Android');
  }
  // 4. Pointer type kontrolü
  if (pointer.hasCoarsePointer) {
    score += 2;
    reasons.push('Has coarse pointer (touch input)');
  }
  // 5. Orientation (mobil genelde portrait)
  if (screen.orientation === 'portrait') {
    score += 1;
    reasons.push('Portrait orientation (typical mobile)');
  }
  // Negatif sinyaller
  if (screen.width >= 768) {
    score -= 3;
    reasons.push(`Screen width ${screen.width}px >= 768px (tablet/desktop range)`);
  }
  if (!ua.hasMobile && ua.hasAndroid) {
    score -= 2;
    reasons.push('Android without Mobile keyword (likely tablet)');
  }
  // Güvenilirlik hesapla
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 12) {
    confidence = 'high';
  } else if (score >= 7) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  return {
    isAndroidMobile: score >= 7, // ✅ Threshold güncellendi
    confidence,
    reasons,
  };
}
/**
 * Detect desktop mode spoofing for Android Mobile
 */
export function detectAndroidMobileSpoof(userAgent: string): boolean {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  const screen = getScreenInfo();
  // Desktop mode sinyalleri:
  // 1. UA "Linux" diyor ama "Android" demiyor
  // 2. Ama touch var + küçük ekran
  const isReportingDesktop = !ua.hasAndroid && (ua.isLinux || ua.isMacintosh);
  const hasRealMobileSignals = (
    touch.maxTouchPoints > 0 &&
    screen.width < 768
  );
  return isReportingDesktop && hasRealMobileSignals;
}
