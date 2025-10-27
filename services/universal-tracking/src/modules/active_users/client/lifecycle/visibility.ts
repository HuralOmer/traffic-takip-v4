/**
 * Page Visibility Tracker
 * Detects foreground/background state changes
 * 
 * Tracks both:
 * 1. Tab visibility (document.hidden) - tab switching
 * 2. Window focus (document.hasFocus()) - switching to other apps
 * 
 * Mobile/Tablet Behavior:
 * - Background için aggressive cleanup (30 saniye sonra leave)
 * - Device lock detection
 * - App switch detection
 */
export type VisibilityState = 'foreground' | 'background';
export class VisibilityTracker {
  private currentState: VisibilityState = 'foreground';
  private onStateChange: ((state: VisibilityState) => void) | null = null;
  private visibilityTimeout: NodeJS.Timeout | null = null;
  private focusTimeout: NodeJS.Timeout | null = null;
  private lastVisibilityChange = 0;
  // DevTools detection
  private devToolsOpen = false;
  private devToolsCheckInterval: NodeJS.Timeout | null = null;
  // 🆕 Background → Foreground transition callback
  private onBecameForeground: (() => void | Promise<void>) | null = null;
  start(onStateChange: (state: VisibilityState) => void): void {
    this.onStateChange = onStateChange;
    // 🆕 CRITICAL FIX: Initial state always 'foreground'
    // Sayfa yüklenirken document.hidden true olabilir (browser optimization)
    // Bu yanlış tab count'a neden olur
    // VisibilityChange event gelince zaten doğru state'e geçecek
    this.currentState = 'foreground';
    // Start DevTools detection
    this.startDevToolsDetection();
    // Visibility change listener (tab switching and window minimize)
    document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
    });
    // ✅ Window focus event - user returned to window
    // This happens when: closing DevTools, switching back from another app
    window.addEventListener('focus', () => {
            // Clear any pending blur timeout
      if (this.focusTimeout) {
        clearTimeout(this.focusTimeout);
        this.focusTimeout = null;
      }
      // Always check state when gaining focus
      // If tab is visible, we'll switch to foreground
      this.checkAndUpdateState();
    });
    // ✅ Window blur event - user switched to another app OR DevTools got focus
    window.addEventListener('blur', () => {
            // Clear any existing timeout
      if (this.focusTimeout) {
        clearTimeout(this.focusTimeout);
      }
      // ✅ FIX: Kısa bir gecikme ile kontrol et
      // Eğer document.hidden = true ise, zaten visibilitychange tetiklenecek
      // Bu blur event sadece "aynı browser içinde başka yere focus" için
      this.focusTimeout = setTimeout(() => {
        // Tab hidden = başka tab'a geçti (visibilitychange zaten handle etti)
        if (document.hidden) {
                    return;
        }
        // Tab görünür ama focus yok = başka Windows uygulamasına geçti
        // NOT: DevTools check kaldırıldı - visibilitychange event'i yeterli
        if (!document.hasFocus()) {
                    this.checkAndUpdateState();
        }
      }, 200);
    });
  }
  /**
   * Calculate current state based on tab visibility and focus
   * Background if: 
   * 1. Tab is hidden (switched to another tab)
   * 2. Lost focus to another app (detected by blur handler with delay)
   */
  private calculateState(): VisibilityState {
    // ✅ Primary check: Is the tab hidden?
    if (document.hidden) {
      return 'background';
    }
    // ✅ Secondary check: Complete focus loss
    // If we don't have focus, we're in background
    // Note: DevTools blur is handled by the blur handler with delay logic
    if (!document.hasFocus()) {
      return 'background';
    }
    // Tab is visible + has focus = foreground
    return 'foreground';
  }
  /**
   * Check current state and update if changed
   */
  private checkAndUpdateState(): void {
    const newState = this.calculateState();
    if (newState !== this.currentState) {
            this.setState(newState);
    }
  }
  private handleVisibilityChange(): void {
    const now = Date.now();
    // ✅ DEBOUNCE: Çok sık visibility change'i engelle
    if (now - this.lastVisibilityChange < 1000) {
      return;
    }
    // ✅ CLEAR TIMEOUT: Önceki timeout'u temizle
    if (this.visibilityTimeout) {
      clearTimeout(this.visibilityTimeout);
    }
    // ✅ DELAYED CHANGE: 500ms bekle, gerçekten değişti mi?
    this.visibilityTimeout = setTimeout(() => {
            this.lastVisibilityChange = Date.now();
      this.checkAndUpdateState();
    }, 500); // 500ms gecikme
  }
  private setState(state: VisibilityState): void {
    if (this.currentState !== state) {
      const previousState = this.currentState;
      this.currentState = state;
      
      // ✅ DEBUG: Açık log mesajları
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      if (state === 'background') {
      }
      
      // 🆕 Background → Foreground geçişini tespit et
      if (previousState === 'background' && state === 'foreground') {
        if (this.onBecameForeground) {
          const result = this.onBecameForeground();
          // Handle async callback
          if (result instanceof Promise) {
            result.catch(err => {
              console.error('[Visibility] onBecameForeground error:', err);
            });
          }
        }
      }
      // ✅ Duplicate log kaldırıldı (parent StatusLogger kullanacak)
      if (this.onStateChange) {
        this.onStateChange(state);
      }
    }
  }
  getState(): VisibilityState {
    return this.currentState;
  }
  isForeground(): boolean {
    return this.currentState === 'foreground';
  }
  isBackground(): boolean {
    return this.currentState === 'background';
  }
  // 🆕 Background → Foreground callback ayarla
  setOnBecameForeground(callback: () => void | Promise<void>): void {
    this.onBecameForeground = callback;
  }
  /**
   * Start DevTools detection
   * Checks every 1 second if DevTools is open
   */
  private startDevToolsDetection(): void {
    // Initial check
    this.checkDevTools();
    // Periodic check
    this.devToolsCheckInterval = setInterval(() => {
      this.checkDevTools();
    }, 1000); // Check every second
  }
  /**
   * Detect if DevTools is open
   * Uses window size difference (most reliable method)
   */
  private checkDevTools(): void {
    const wasOpen = this.devToolsOpen;
    // Window size difference detection
    const threshold = 160; // DevTools minimum size
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    // DevTools docked to right/left → width difference
    // DevTools docked to bottom → height difference
    this.devToolsOpen = widthDiff > threshold || heightDiff > threshold;
    // Log changes only
    if (wasOpen !== this.devToolsOpen) {
          }
  }
  /**
   * Cleanup timers
   */
  destroy(): void {
    if (this.visibilityTimeout) {
      clearTimeout(this.visibilityTimeout);
      this.visibilityTimeout = null;
    }
    if (this.focusTimeout) {
      clearTimeout(this.focusTimeout);
      this.focusTimeout = null;
    }
    if (this.devToolsCheckInterval) {
      clearInterval(this.devToolsCheckInterval);
      this.devToolsCheckInterval = null;
    }
  }
}
