/**
 * iOS Mobile (iPhone) Device Detector
 */
import { getTouchSupport, getPointerType, getScreenInfo, getVendorInfo, parseUserAgent } from '../shared/utils.js';
export interface iOSMobileSignals {
  isiOSMobile: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}
/**
 * Detect if device is iPhone
 */
export function detectiOSMobile(userAgent: string): iOSMobileSignals {
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
  if (ua.hasiPhone) {
    score += 10;
    reasons.push('✅ User-Agent contains iPhone (VERY STRONG)');
  }
  if (ua.hasIOS) {
    score += 5;
    reasons.push('✅ User-Agent contains iOS indicators (STRONG)');
  }
  // Safari on small screen = likely iPhone (but check for Macintosh)
  const isSafari = userAgent.toLowerCase().includes('safari') && !userAgent.toLowerCase().includes('chrome');
  if (isSafari && screen.width < 768 && !ua.isMacintosh) {
    score += 4;
    reasons.push('✅ Safari on small screen without Macintosh (likely iPhone)');
  }
  // ✅ SUPER IMPORTANT: Macintosh + iPhone screen size = iPhone desktop mode!
  if (ua.isMacintosh && screen.width < 600 && vendor.vendor.includes('Apple')) {
    score += 10;
    reasons.push('✅ CRITICAL: Macintosh + iPhone screen (<600px) + Apple = iPhone desktop mode!');
  }
  // ✅ Macintosh + Safari + Version/ + small screen = iPhone desktop mode
  if (ua.isMacintosh && isSafari && userAgent.includes('Version/') && screen.width < 600) {
    score += 8;
    reasons.push('✅ Macintosh + Safari + Version + small screen = iPhone desktop mode!');
  }
  // 2. Ekran boyutu kontrolleri (iPhone specific)
  if (screen.width >= 375 && screen.width <= 428) {
    score += 3;
    reasons.push(`Screen width ${screen.width}px in iPhone range (375-428px)`);
  }
  if (screen.width < 768 && !ua.isMacintosh) {
    score += 2;
    reasons.push(`Screen width ${screen.width}px < 768px (mobile range, not Macintosh)`);
  }
  // 3. Touch kontrolleri (iPhone always has 5 touch points)
  if (touch.maxTouchPoints === 5) {
    score += 4;
    reasons.push('Exactly 5 touch points (Apple standard)');
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
  if (vendor.platform === 'iPhone') {
    score += 3;
    reasons.push('Platform is iPhone');
  }
  // 7. Orientation (iPhone genelde portrait)
  if (screen.orientation === 'portrait') {
    score += 1;
    reasons.push('Portrait orientation (typical mobile)');
  }
  // Negatif sinyaller
  if (screen.width >= 768) {
    score -= 4;
    reasons.push(`Screen width ${screen.width}px >= 768px (tablet range)`);
  }
  if (ua.hasiPad) {
    score -= 5;
    reasons.push('User-Agent contains iPad (not iPhone)');
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
    isiOSMobile: score >= 8, // ✅ Threshold güncellendi (yeni skorlara uyumlu)
    confidence,
    reasons,
  };
}
/**
 * Detect desktop mode spoofing for iPhone
 */
export function detectiOSMobileSpoof(userAgent: string): boolean {
  const ua = parseUserAgent(userAgent);
  const touch = getTouchSupport();
  const screen = getScreenInfo();
  const vendor = getVendorInfo();
  // Desktop mode sinyalleri:
  // 1. UA "Macintosh" diyor (desktop mode)
  // 2. Ama touch points = 5 (Apple standardı)
  // 3. Ve küçük ekran boyutu
  const isReportingDesktop = ua.isMacintosh && !ua.hasiPhone;
  const hasRealiPhoneSignals = (
    touch.maxTouchPoints === 5 &&
    screen.width < 768 &&
    vendor.vendor.includes('Apple')
  );
  return isReportingDesktop && hasRealiPhoneSignals;
}
