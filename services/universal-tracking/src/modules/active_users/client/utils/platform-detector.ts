/**
 * Platform & Browser Detector
 * Detects OS, browser, and device type from User Agent
 */
export interface PlatformInfo {
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
  browser: 'chrome' | 'safari' | 'firefox' | 'opera' | 'edge' | 'samsung' | 'unknown';
  device: 'mobile' | 'tablet' | 'desktop';
}
export class PlatformDetector {
  private ua: string;
  constructor() {
    this.ua = navigator.userAgent;
  }
  /**
   * Detect OS/Platform
   */
  private detectPlatform(): PlatformInfo['platform'] {
    const ua = this.ua;
    // iOS (iPhone, iPad, iPod)
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return 'ios';
    }
    // Android
    if (/Android/i.test(ua)) {
      return 'android';
    }
    // Windows
    if (/Windows/i.test(ua)) {
      return 'windows';
    }
    // macOS
    if (/Macintosh|Mac OS X/i.test(ua)) {
      return 'macos';
    }
    // Linux
    if (/Linux/i.test(ua)) {
      return 'linux';
    }
    return 'unknown';
  }
  /**
   * Detect Browser
   */
  private detectBrowser(): PlatformInfo['browser'] {
    const ua = this.ua;
    // Samsung Browser
    if (/SamsungBrowser/i.test(ua)) {
      return 'samsung';
    }
    // Opera (OPR or Opera)
    if (/OPR|Opera/i.test(ua)) {
      return 'opera';
    }
    // Edge (Edg)
    if (/Edg/i.test(ua)) {
      return 'edge';
    }
    // Chrome (but not Edge/Opera)
    if (/Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)) {
      return 'chrome';
    }
    // Safari (but not Chrome/Edge)
    if (/Safari/i.test(ua) && !/Chrome|Edg/i.test(ua)) {
      return 'safari';
    }
    // Firefox
    if (/Firefox/i.test(ua)) {
      return 'firefox';
    }
    return 'unknown';
  }
  /**
   * Detect Device Type
   */
  private detectDevice(): PlatformInfo['device'] {
    const ua = this.ua;
    // Tablet
    if (/iPad|Android(?=.*Tablet)|Windows.*Touch/i.test(ua)) {
      return 'tablet';
    }
    // Mobile
    if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return 'mobile';
    }
    // Desktop
    return 'desktop';
  }
  /**
   * Get all platform information
   */
  detect(): PlatformInfo {
    const info: PlatformInfo = {
      platform: this.detectPlatform(),
      browser: this.detectBrowser(),
      device: this.detectDevice(),
    };
    return info;
  }
  /**
   * Check if device is mobile or tablet
   */
  isMobileOrTablet(): boolean {
    const device = this.detectDevice();
    return device === 'mobile' || device === 'tablet';
  }
}
