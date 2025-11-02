/**
 * Desktop Unload Handler - Simplified & Clean
 * Handles: reload, browser close, tab close, navigation
 */

import type { LeavePayload } from '../../types/Messages.js';

interface UnloadHandlerOptions {
  allowedOrigins?: string[];
  isMobileOrTablet?: boolean; // ✅ Mobile/Tablet flag for reload handling
}

export class UnloadHandler {
  private customerId: string;
  private sessionId: string;
  private tabId: string;
  private apiUrl: string;
  private allowedOrigins: Set<string>;
  
  private leaveSent = false;
  private isReloading = false;
  private isInternalNav = false;
  private isMobileOrTablet: boolean = false; // ✅ Mobile/Tablet flag

  constructor(
    customerId: string,
    sessionId: string,
    tabId: string,
    apiUrl: string,
    options: UnloadHandlerOptions = {}
  ) {
    this.customerId = customerId;
    this.sessionId = sessionId;
    this.tabId = tabId;
    this.apiUrl = apiUrl;

    this.allowedOrigins = new Set(
      options.allowedOrigins?.length ? options.allowedOrigins : [window.location.origin]
    );
    
    // ✅ Mobile/Tablet flag for reload handling
    this.isMobileOrTablet = options.isMobileOrTablet || false;
  }
  
  /**
   * Public API: Set mobile/tablet flag (called after device detection)
   */
  setIsMobileOrTablet(isMobileOrTablet: boolean): void {
    this.isMobileOrTablet = isMobileOrTablet;
  }

  setup(): void {
    // 1) Reload detection
    this.setupReloadDetection();

    // 2) Internal navigation detection (links, forms, SPA)
    this.setupInternalNavDetection();

    // 3) Unload handlers
    this.setupUnloadHandlers();
    
    // 4) Visibility change handler (emniyet kemeri for BFCache edge cases)
    this.setupVisibilityChangeHandler();
  }

  /**
   * Setup visibility change handler (emniyet kemeri for BFCache edge cases)
   * Some browsers may have edge cases with pageshow, so we also check visibilitychange
   * When page becomes visible after back/forward navigation, reset leaveSent flag
   */
  private setupVisibilityChangeHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        try {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const isBackForward = nav && nav.type === 'back_forward';
          const isLegacyBackForward = performance.navigation && performance.navigation.type === 2;
          
          // ✅ CRITICAL: Geri dönüş (back/forward) ve sayfa görünür olduğunda leaveSent'i sıfırla
          // Bu, BFCache davranışlarındaki tarayıcı farklarını yumuşatır
          // Bazı tarayıcılarda pageshow edge vakalarında şaşabiliyor
          if (isBackForward || isLegacyBackForward) {
            const currentOrigin = window.location.origin;
            if (this.isAllowedOrigin(currentOrigin)) {
              // Internal site'e geri döndük - leaveSent'i sıfırla
              console.log('[Unload:visibilitychange] visible + back_forward (internal) → reset leaveSent');
              this.leaveSent = false;
            }
          }
        } catch {}
      }
    });
  }

  /**
   * Public API: Reset internal leaveSent guard
   * Used by callers that need to allow a new LEAVE after a controlled rejoin
   */
  resetLeaveSentFlag(): void {
        this.leaveSent = false;
  }

  /**
   * Public API: Send LEAVE on demand
   * If force=true, bypasses leaveSent guard and sends LEAVE anyway
   */
  sendLeave(force?: boolean): void {
    if (force) {
      // Force send LEAVE even if leaveSent flag is true
      this.sendLeaveFinal('tabclose', true);
    } else {
      // Normal send (respects leaveSent flag)
      this.sendLeaveFinal('tabclose', false);
    }
  }

  /**
   * Detect page reload (F5, Ctrl+R, reload button, etc.)
   */
  private setupReloadDetection(): void {
    // Check on load if this was a reload using Navigation Timing API
    window.addEventListener('pageshow', (e: PageTransitionEvent) => {
      try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (nav.type === 'reload') {
          console.log('[Unload] RELOAD detected via Navigation Timing');
          this.isReloading = true;
        }
      } catch {}
    });

    // Note: window.location.reload cannot be intercepted in modern browsers (read-only)
    // Navigation Timing API is sufficient for reload detection
  }

  /**
   * Detect internal navigation (same domain)
   */
  private setupInternalNavDetection(): void {
    // Link clicks
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href) {
        try {
          const url = new URL(link.href, window.location.href);
          if (this.isAllowedOrigin(url.origin)) {
            console.log('[Unload] Internal link clicked:', url.href);
            this.isInternalNav = true;
          }
        } catch {}
      }
    }, true);

    // Form submissions
    document.addEventListener('submit', (e: Event) => {
      const form = e.target as HTMLFormElement;
      if (form.action) {
        try {
          const url = new URL(form.action, window.location.href);
          if (this.isAllowedOrigin(url.origin)) {
            console.log('[Unload] Internal form submitted');
            this.isInternalNav = true;
          }
          } catch {}
      }
    }, true);

    // SPA navigation
    window.addEventListener('hashchange', () => {
      console.log('[Unload] Internal navigation (hashchange)');
      this.isInternalNav = true;
    });

    // ✅ CRITICAL: popstate event'i hem capture hem bubble fazında dinle
    // Capture fazında erken algılama için, bubble fazında normal algılama için
    window.addEventListener('popstate', () => {
      // CRITICAL: Check if navigation stays within same origin
      // popstate fires AFTER navigation completes, so window.location.origin is correct
      try {
        const currentOrigin = window.location.origin;
        // For back/forward, we can't predict exact destination, but if we're still on same origin after popstate fires, it's internal
        // Note: popstate fires AFTER navigation, so we check current location
        if (this.isAllowedOrigin(currentOrigin)) {
          console.log('[Unload:popstate] Internal navigation (back-forward, same origin) → NO LEAVE');
          this.isInternalNav = true;
        } else {
          // ✅ CRITICAL: External site navigation via back/forward → Send LEAVE
          console.log('[Unload:popstate] External navigation (back-forward to different origin) → SEND LEAVE');
          this.isInternalNav = false;
          // Send LEAVE immediately since we're navigating to external site
          this.sendLeaveFinal('external', false);
        }
      } catch {
        // Fallback: assume internal if we can't determine
        this.isInternalNav = true;
      }
    }, true); // ✅ Capture fazında dinle (daha erken tetiklenir)

    // SPA pushState/replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const thatNav = this;
    
    history.pushState = function(...args: any[]) {
      console.log('[Unload] Internal navigation (pushState)');
      thatNav.isInternalNav = true;
      return originalPushState.apply(history, args as any);
    };

    history.replaceState = function(...args: any[]) {
      console.log('[Unload] Internal navigation (replaceState)');
      thatNav.isInternalNav = true;
      return originalReplaceState.apply(history, args as any);
    };
  }

  /**
   * Setup unload event handlers
   * 
   * CRITICAL: beforeunload içinde LEAVE göndermiyoruz çünkü:
   * 1. Back/forward navigation'ı her zaman algılayamıyor (timing issue)
   * 2. Internal navigation flag'i henüz set edilmemiş olabilir
   * 3. pagehide daha güvenilir (e.persisted bilgisi var)
   * 
   * beforeunload sadece flag'leri set eder, LEAVE gönderme pagehide'a bırakılır
   */
  private setupUnloadHandlers(): void {
    // beforeunload - Bu evrede gideceğin navigasyonu bilemeyiz; karar pagehide'da verilecek
    window.addEventListener('beforeunload', () => {
      // nav.type mevcut sayfanın nasıl YÜKLENDİĞİNİ gösterir, çıkış navigasyonunun türünü değil
      // Bu yüzden nav.type'a güvenmiyoruz, sadece isInternalNav flag'ini kontrol ediyoruz
      if (this.isInternalNav) {
        console.log('[Unload:beforeunload] internal flag set (will skip LEAVE on pagehide)');
      } else {
        console.log('[Unload:beforeunload] non-internal navigation (decision on pagehide)');
      }
    });

    // pagehide - Karar verme noktası
    window.addEventListener('pagehide', (e: PageTransitionEvent) => {
      const isBackground = document.hidden || !document.hasFocus();
      
      // LEAVE tekrar gönderimini engellemek için guard; force gereksinimi ayrı kalır
      if (this.leaveSent) {
        console.log('[Unload:pagehide] LEAVE already sent, skipping');
        this.isReloading = false;
        this.isInternalNav = false;
        return;
      }

      // ✅ CRITICAL: Backup flags before reset (for logging and decision making)
      let wasInternalNav = this.isInternalNav;
      let wasReloading = this.isReloading;

      // Şimdiki cycle için bayrakları temizle
      this.isInternalNav = false;
      this.isReloading = false;

      console.log('[Unload:pagehide] wasInternalNav:', wasInternalNav, '| wasReloading:', wasReloading);

      // ✅ CRITICAL: Mobile/Tablet reload → NO LEAVE (Redis'te kayıt kalmalı)
      // Desktop reload → NO LEAVE (zaten var)
      // Reload ise LEAVE gönderme
      if (wasReloading) {
        if (this.isMobileOrTablet) {
          console.log('[Unload:pagehide] RELOAD (Mobile/Tablet) → NO LEAVE (Redis kaydı korunuyor)');
        } else {
          console.log('[Unload:pagehide] RELOAD (Desktop) → NO LEAVE');
        }
        this.isReloading = false;
        return;
      }

      // İç navigasyon (link/form/pushState/replaceState/popstate) → NO LEAVE
      if (wasInternalNav) {
        console.log('[Unload:pagehide] INTERNAL NAV → NO LEAVE');
        return;
      }

      // Diğer her şey (browser/tab close, external navigation, adres çubuğu) → SEND LEAVE
      console.log('[Unload:pagehide] Browser/Tab close or external nav → SEND LEAVE');
      this.sendLeaveFinal('tabclose');
    });

    // pageshow - Detect back/forward navigation (BFCache restore or normal back/forward)
    window.addEventListener('pageshow', (e: PageTransitionEvent) => {
      // Check if this was a back/forward navigation
      try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const isBackForward = nav && nav.type === 'back_forward';
        
        // Also check legacy API
        const isLegacyBackForward = performance.navigation && performance.navigation.type === 2;
        
        // pageshow sadece gelen navigasyonu değerlendirir (back_forward veya BFCache restore)
        if (isBackForward || isLegacyBackForward || e.persisted) {
          // Navigation completed - now we can check the actual origin
          const currentOrigin = window.location.origin;
          if (this.isAllowedOrigin(currentOrigin)) {
            // ✅ Internal navigation - JOIN will re-add to Redis
            console.log('[Unload:pageshow] Back/Forward → Internal (same origin) → reset guards & JOIN flow');
            // ✅ CRITICAL FIX: BFCache/internal dönüşte LEAVE guard'ını kaldır
            this.leaveSent = false; // 🔧 kritik reset
            this.isInternalNav = false;
            this.isReloading = false;
          } else {
            // ✅ CRITICAL: External site navigation via back/forward → Send LEAVE
            if (!this.leaveSent) {
              console.log('[Unload:pageshow] Back/Forward → External (different origin) → SEND LEAVE');
              this.sendLeaveFinal('external', false);
      } else {
              console.log('[Unload:pageshow] Back/Forward → External → LEAVE already sent');
            }
            this.isInternalNav = false;
            this.isReloading = false;
      }
    }
      } catch {}
    });
  }

  /**
   * Send FINAL leave signal (immediate removal from Redis)
   * @param reason - Reason for leaving
   * @param force - If true, bypass leaveSent guard (for passive_active cleanup)
   */
  private sendLeaveFinal(reason: 'tabclose' | 'external', force: boolean = false): void {
    if (!force && this.leaveSent) {
      console.log('[Unload] LEAVE already sent, skipping (use force=true to bypass)');
      return;
    }
    this.leaveSent = true;

    const payload: LeavePayload = {
      customerId: this.customerId,
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
      mode: 'final',
      reason
    };

    try {
      // Try sendBeacon first
      const ok = navigator.sendBeacon?.(
        `${this.apiUrl}/presence/leave`,
        new Blob([JSON.stringify(payload)], { type: 'text/plain' })
      );
      
      if (ok) {
        console.log('[Unload] LEAVE sent via sendBeacon');
        return;
      }
    } catch (error) {
      console.error('[Unload] sendBeacon error:', error);
    }

    // Fallback: sync XHR
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.apiUrl}/presence/leave`, false);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      try {
        xhr.withCredentials = true;
      } catch {}
      xhr.send(JSON.stringify(payload));
      console.log('[Unload] LEAVE sent via sync XHR');
    } catch (error) {
      console.error('[Unload] sync XHR error:', error);
    }
  }

  /**
   * Check if origin is allowed (same site)
   */
  private isAllowedOrigin(origin: string): boolean {
    return this.allowedOrigins.has(origin);
  }
}

