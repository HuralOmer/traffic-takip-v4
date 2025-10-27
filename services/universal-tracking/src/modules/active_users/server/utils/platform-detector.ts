export class PlatformDetector {
  /**
   * Detect platform from user agent
   */
  static detectPlatform(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/i.test(ua)) {
      return 'ios';
    }
    if (/android/i.test(ua)) {
      return 'android';
    }
    if (/windows/i.test(ua)) {
      return 'windows';
    }
    if (/macintosh|mac os x/i.test(ua)) {
      return 'macos';
    }
    if (/linux/i.test(ua)) {
      return 'linux';
    }
    
    return 'unknown';
  }

  /**
   * Get platform-specific configuration
   */
  static getConfig(platform: string, sessionMode: string) {
    const baseConfig = {
      ttl: 600, // 10 minutes
      cleanupInterval: 300000, // 5 minutes
      inactivityWindow: 300000, // 5 minutes
    };

    // Platform-specific adjustments
    switch (platform) {
      case 'ios':
        return {
          ...baseConfig,
          ttl: sessionMode === 'passive_active' ? 1800 : 600, // 30min passive, 10min active
          inactivityWindow: 240000, // 4 minutes
        };
      case 'android':
        return {
          ...baseConfig,
          ttl: sessionMode === 'passive_active' ? 1800 : 600, // 30min passive, 10min active
          inactivityWindow: 240000, // 4 minutes
        };
      case 'windows':
      case 'macos':
      case 'linux':
        return {
          ...baseConfig,
          ttl: sessionMode === 'passive_active' ? 1200 : 600, // 20min passive, 10min active
          inactivityWindow: 300000, // 5 minutes
        };
      default:
        return baseConfig;
    }
  }

  /**
   * Get TTL safety value
   */
  static getTTLSafety(): number {
    return 300000; // 5 minutes in milliseconds
  }

  /**
   * Get removal delay based on platform
   */
  static getRemovalDelay(platform: string): number {
    switch (platform) {
      case 'ios':
        return 2000; // 2 seconds
      case 'android':
        return 2000; // 2 seconds
      case 'windows':
      case 'macos':
      case 'linux':
        return 1000; // 1 second
      default:
        return 1500; // 1.5 seconds
    }
  }
}

