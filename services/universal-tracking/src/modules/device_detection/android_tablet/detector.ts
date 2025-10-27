/**
 * Android Tablet Device Detector
 */
import { getTouchSupport, getPointerType, getScreenInfo, getVendorInfo, parseUserAgent } from '../shared/utils.js';
export interface AndroidTabletSignals {
  isAndroidTablet: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}
/**
 * Detect if device is Android Tablet
 */
export function detectAndroidTablet(userAgent: string): AndroidTabletSignals {
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
  // ÖNEMLİ: Android tablet'te "Mobile" kelimesi YOKTUR
  if (ua.hasAndroid && !ua.hasMobile) {
    score += 4;
    reasons.push('Android without Mobile keyword (tablet indicator)');
  }
  // 2. Ekran boyutu kontrolleri
  if (screen.width >= 768) {
    score += 3;
    reasons.push(`Screen width ${screen.width}px >= 768px (tablet range)`);
  }
  if (screen.width >= 800 && screen.width <= 1280) {
    score += 2;
    reasons.push(`Screen width ${screen.width}px in typical tablet range`);
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
  // 5. Aspect ratio (tablet genelde daha kare)
  if (screen.aspectRatio >= 0.6 && screen.aspectRatio <= 0.8) {
    score += 1;
    reasons.push(`Aspect ratio ${screen.aspectRatio.toFixed(2)} (tablet-like)`);
  }
  // Negatif sinyaller
  if (screen.width < 768) {
    score -= 4;
    reasons.push(`Screen width ${screen.width}px < 768px (mobile range)`);
  }
  if (ua.hasMobile) {
    score -= 3;
    reasons.push('User-Agent contains Mobile (likely phone, not tablet)');
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
    isAndroidTablet: score >= 7, // ✅ Threshold güncellendi
    confidence,
    reasons,
  };
}
/**
 * Detect desktop mode spoofing for Android Tablet
 */
export function detectAndroidTabletSpoof(userAgent: string): boolean {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  const screen = getScreenInfo();
  // Desktop mode sinyalleri:
  // 1. UA "Linux" diyor ama "Android" demiyor
  // 2. Ama touch var + tablet boyutu ekran
  const isReportingDesktop = !ua.hasAndroid && ua.isLinux;
  const hasRealTabletSignals = (
    touch.maxTouchPoints > 0 &&
    screen.width >= 768 &&
    screen.width <= 1366
  );
  return isReportingDesktop && hasRealTabletSignals;
}
