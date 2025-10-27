/**
 * Shared Device Detection Utilities
 */
// ✅ PERFORMANCE OPTIMIZATION: Cache for browser info to avoid duplicate calls
let browserInfoCache: any = null;
let lastCacheTime = 0;
const CACHE_DURATION = 100; // 100ms cache (very short, just for same call)
/**
 * Get all browser information in a single optimized call
 * Caches results for 100ms to avoid duplicate DOM queries
 */
export function getBrowserInfo(): {
  touch: ReturnType<typeof getTouchSupport>;
  pointer: ReturnType<typeof getPointerType>;
  screen: ReturnType<typeof getScreenInfo>;
  hardware: ReturnType<typeof getHardwareInfo>;
  vendor: ReturnType<typeof getVendorInfo>;
  ua: ReturnType<typeof parseUserAgent>;
} {
  const now = Date.now();
  // Return cached result if within cache duration
  if (browserInfoCache && (now - lastCacheTime) < CACHE_DURATION) {
    return browserInfoCache;
  }
  // Collect all browser info in single call
  const touch = getTouchSupport();
  const pointer = getPointerType();
  const screen = getScreenInfo();
  const hardware = getHardwareInfo();
  const vendor = getVendorInfo();
  const ua = parseUserAgent(navigator.userAgent);
  // Cache the result
  browserInfoCache = { touch, pointer, screen, hardware, vendor, ua };
  lastCacheTime = now;
  return browserInfoCache;
}
/**
 * Clear browser info cache (useful for testing or when screen changes)
 */
export function clearBrowserInfoCache(): void {
  browserInfoCache = null;
  lastCacheTime = 0;
}
/**
 * Get touch support information
 */
export function getTouchSupport(): {
  maxTouchPoints: number;
  hasTouchSupport: boolean;
} {
  return {
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hasTouchSupport: (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore - Legacy support
      (window.DocumentTouch && document instanceof window.DocumentTouch)
    ),
  };
}
/**
 * Get pointer type information
 */
export function getPointerType(): {
  hasCoarsePointer: boolean;
  hasFinePointer: boolean;
} {
  return {
    hasCoarsePointer: window.matchMedia('(pointer: coarse)').matches,
    hasFinePointer: window.matchMedia('(pointer: fine)').matches,
  };
}
/**
 * Get screen information
 */
export function getScreenInfo(): {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape';
} {
  const width = window.screen.width;
  const height = window.screen.height;
  return {
    width,
    height,
    aspectRatio: width / height,
    orientation: width > height ? 'landscape' : 'portrait',
  };
}
/**
 * Get device memory and CPU info
 */
export function getHardwareInfo(): {
  deviceMemory?: number;
  hardwareConcurrency?: number;
} {
  return {
    // @ts-ignore - Not all browsers support this
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  };
}
/**
 * Get vendor information
 */
export function getVendorInfo(): {
  vendor: string;
  platform: string;
} {
  return {
    vendor: navigator.vendor || '',
    // @ts-ignore - navigator.platform is deprecated but still useful
    platform: navigator.platform || '',
  };
}
/**
 * Check if Client Hints API is available
 */
export function hasClientHints(): boolean {
  // @ts-ignore
  return 'userAgentData' in navigator && typeof navigator.userAgentData?.getHighEntropyValues === 'function';
}
/**
 * Get Client Hints data (if available)
 */
export async function getClientHints(): Promise<any> {
  if (!hasClientHints()) {
    return null;
  }
  try {
    // @ts-ignore
    return await navigator.userAgentData.getHighEntropyValues([
      'platform',
      'platformVersion',
      'model',
      'mobile',
      'architecture',
      'bitness',
    ]);
  } catch (error) {
    console.warn('[DeviceDetection] Client Hints error:', error);
    return null;
  }
}
/**
 * Parse User-Agent string (basic)
 */
export function parseUserAgent(ua: string): {
  hasAndroid: boolean;
  hasIOS: boolean;
  hasiPhone: boolean;
  hasiPad: boolean;
  hasMobile: boolean;
  hasTablet: boolean;
  isMacintosh: boolean;
  isLinux: boolean;
  isWindows: boolean;
} {
  const uaLower = ua.toLowerCase();
  return {
    hasAndroid: uaLower.includes('android'),
    hasIOS: /iphone|ipad|ipod/.test(uaLower),
    hasiPhone: uaLower.includes('iphone'),
    hasiPad: uaLower.includes('ipad'),
    hasMobile: uaLower.includes('mobile'),
    hasTablet: /tablet|ipad/.test(uaLower),
    isMacintosh: uaLower.includes('macintosh'),
    isLinux: uaLower.includes('linux'),
    isWindows: uaLower.includes('windows'),
  };
}
