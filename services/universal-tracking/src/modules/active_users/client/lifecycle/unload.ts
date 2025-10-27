/**
 * Desktop Unload / Leave Handler (Hardened)
 * - ✅ LEAVE: tab close, browser close, external navigation (harici origin)
 * - ❌ NO LEAVE: reload, same-site navigation (SPA & MPA), back/forward restore
 * - Çoklu sinyal: visibilitychange(hidden) + pagehide
 * - Yenileme tespiti: PerformanceNavigationTiming.type === 'reload'
 * - İç navigasyon: click, submit, hashchange, popstate, pushState/replaceState, Navigation API
 */

import type { LeavePayload } from '../../types/Messages.js';

type DestType = 'internal' | 'external' | 'reload' | 'unknown';

interface UnloadHandlerOptions {
  /** Aynı site olarak kabul edilecek originler (subdomain desteği için). Boşsa window.location.origin tek başına kullanılır. */
  allowedOrigins?: string[];
  /** SPA router kullanıyorsan true bırak; pushState/replaceState interception açık kalır. */
  enableSpaDetection?: boolean;
}

export class UnloadHandler {
  private customerId: string;
  private sessionId: string;
  private tabId: string;
  private apiUrl: string;

  private leaveSent = false;
  private isDesktop = false;

  // ✅ NEW: Visibility change timeout tracking
  private visibilityChangeTimeoutId: NodeJS.Timeout | null = null;

  private isInternalNavPlanned = false;   // bir sonraki unload için
  private isReloadPlanned = false;        // bir sonraki unload için
  private plannedExternal = false;        // güvenli yakalama

  private options: UnloadHandlerOptions;
  private readonly REFRESH_FLAG_KEY = 'uts_page_refreshing_v2'; // sadece fallback
  private readonly NAV_INTENT_KEY   = 'uts_nav_intent_v2';      // 'internal' | 'external' | 'reload'

  private allowedOrigins: Set<string>;

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
    this.options = { enableSpaDetection: true, ...options };

    this.allowedOrigins = new Set(
      (options.allowedOrigins && options.allowedOrigins.length > 0)
        ? options.allowedOrigins
        : [window.location.origin]
    );

    this.detectDesktop();
  }

  private detectDesktop(): void {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileOS =
      /android|iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isDesktopOS = /windows|macintosh|mac os x|linux/i.test(ua) && !isMobileOS;
    this.isDesktop = isDesktopOS;
    
    console.log(
      `[Unload] Device: ${this.isDesktop ? 'Desktop' : 'Mobile/Tablet'}`
    );
  }

  /**
   * Public API
   */
  setup(): void {
    // BFCache dönüşlerinde state reset
    window.addEventListener('pageshow', (e: PageTransitionEvent) => {
      if ((e as any).persisted) {
        this.leaveSent = false;
        this.isInternalNavPlanned = false;
        this.isReloadPlanned = false;
        this.plannedExternal = false;
        sessionStorage.removeItem(this.NAV_INTENT_KEY);
        sessionStorage.removeItem(this.REFRESH_FLAG_KEY);
        console.log('[Unload] Page restored from BFCache - state reset');
      }

      // Navigation Timing ile "geldiğimiz yolun" tespiti
      try {
        // ✅ FIX: Retry navigation timing (ilk load'da henüz hazır olmayabilir)
        let nav: PerformanceNavigationTiming | undefined;
        
        // İlk denemede kontrol et
        const entries = performance.getEntriesByType('navigation');
        nav = entries[0] as PerformanceNavigationTiming | undefined;
        
        // Henüz hazır değilse kısa bir delay ile tekrar dene (cache clear sonrası ilk load için)
        if (!nav && performance.navigation) {
          // @ts-ignore: PerformanceNavigation API
          const legacyType = performance.navigation.type;
          if (legacyType === 1) { // TYPE_RELOAD
            console.log('[Unload] Arrived via RELOAD (legacy API)');
            this.markIntent('reload');
            try {
              sessionStorage.setItem(this.REFRESH_FLAG_KEY, 'true');
            } catch { /* ignore */ }
            return;
          }
        }
        
        if (nav?.type === 'reload') {
          // Bu sayfaya reload ile geldik → reload olarak işaretle
          console.log('[Unload] Arrived via RELOAD');
          this.markIntent('reload');
          try {
            sessionStorage.setItem(this.REFRESH_FLAG_KEY, 'true');
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }

      // Reload detection: Eğer REFRESH_FLAG_KEY varsa, bu bir reload'dır
      try {
        const refreshFlag = sessionStorage.getItem(this.REFRESH_FLAG_KEY) === 'true';
        if (refreshFlag) {
          console.log('[Unload] pageshow: REFRESH_FLAG_KEY detected → marking as reload');
          this.markIntent('reload');
        }
      } catch { /* ignore */ }
    }, { capture: true }); // ✅ CRITICAL: Capture phase for early binding

    // ✅ FIX: Always setup hooks regardless of isDesktop detection
    // Mobile/tablet might be incorrectly detected as desktop (iPadOS, Android desktop mode)
    // Hook'ları her zaman bağla, en azından "best effort" leave gönderir
    if (!this.isDesktop) {
      console.log('[Unload] Non-desktop: still wiring hooks for best effort.');
    }

    // ✅ CRITICAL FIX: Don't wait for load - bind hooks IMMEDIATELY
    // If user closes tab before page fully loads, hooks won't be attached
    this.setupDesktopHooks();
  }

  private setupDesktopHooks(): void {
    console.log('[Unload] Setting up desktop leave detection (hardened)…');

    // --- 0) RELOAD ERKEN BAYRAKLAMA (Race condition önleme) -------------------------------
    
    // A. Klavye kısayolları (F5, Ctrl+R, Cmd+R)
    document.addEventListener('keydown', (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase();
      if (key === 'f5' || ((ev.ctrlKey || ev.metaKey) && key === 'r')) {
        this.markIntent('reload');
        try {
          sessionStorage.setItem(this.REFRESH_FLAG_KEY, 'true');
        } catch { /* ignore */ }
      }
    }, true);

    // B. window.location.reload() interception
    try {
      const originalReload = window.location.reload.bind(window.location);
      // @ts-ignore
      window.location.reload = function(this: any) {
        this.markIntent('reload');
        try {
          sessionStorage.setItem(this.REFRESH_FLAG_KEY, 'true');
        } catch { /* ignore */ }
        // @ts-ignore
        return originalReload.apply(window.location, arguments);
      }.bind(this);
    } catch { /* ignore */ }

    // C. Navigation API (toolbar refresh'i proaktif yakala)
    try {
      // @ts-ignore
      if (typeof navigation !== 'undefined' && 'addEventListener' in navigation) {
        // @ts-ignore
        navigation.addEventListener('navigate', (e: any) => {
          const navType = e.navigationType || e.type || '';
          if (String(navType).toLowerCase() === 'reload') {
            this.markIntent('reload');
            try { sessionStorage.setItem(this.REFRESH_FLAG_KEY, 'true'); } catch {}
            console.log('[Unload] Navigation API: RELOAD detected');
            return;
          }
          // reload değilse, destination origin'e göre internal/external
          try {
            const destUrl = new URL(e.destination?.url ?? '', window.location.href);
            const same = this.isAllowedOrigin(destUrl.origin);
            this.markIntent(same ? 'internal' : 'external');
          } catch {}
        });
      }
    } catch { /* ignore */ }

    // --- 1) İç navigasyon niyetini olabildiğince erken işaretle --------------------------------

    // A. Link tıklamaları (capture)
    document.addEventListener(
      'click',
      (ev) => {
        const t = ev.target as HTMLElement | null;
        const a = t?.closest('a') as HTMLAnchorElement | null;
        if (!a || !a.href) return;

        // Yeni sekme / arka planda açmalar LEAVE sebebi değildir.
        const openInNewTab =
          a.target === '_blank' ||
          (ev instanceof MouseEvent && (ev.ctrlKey || ev.metaKey || ev.button === 1));

        // Hedef URL
        let dest: URL | null = null;
        try {
          dest = new URL(a.href, window.location.href);
        } catch { /*ignore*/ }

        if (!dest) return;

        const isSameSite = this.isAllowedOrigin(dest.origin);

        if (openInNewTab) {
          // Mevcut sekme ayrılmıyor → NO LEAVE
          this.markIntent('internal');
          return;
        }
      
        if (isSameSite) {
          this.markIntent('internal');
        } else {
          this.markIntent('external');
        }
      },
      true
    );

    // B. Form gönderimleri
    document.addEventListener(
      'submit',
      (ev) => {
        const form = ev.target as HTMLFormElement;
        const action = form.getAttribute('action') || window.location.href;
        let dest: URL | null = null;
        try {
          dest = new URL(action, window.location.href);
        } catch { /*ignore*/ }
        const isSameSite = dest ? this.isAllowedOrigin(dest.origin) : true;
        this.markIntent(isSameSite ? 'internal' : 'external');
      },
      true
    );

    // C. beforeunload → Hiçbir şey yapma, çok güvenilir değil
    // Removed: beforeunload her durumda tetiklenir, sadece reload'da değil

    // D. SPA navigasyonları
    if (this.options.enableSpaDetection) {
      // hash tabanlı
      window.addEventListener('hashchange', () => this.markIntent('internal'), true);
      // back/forward
      window.addEventListener('popstate', () => this.markIntent('internal'), true);

      // pushState/replaceState interception
      try {
        const _ps = history.pushState;
        const _rs = history.replaceState;
        history.pushState = function (...args: any[]) {
          _ps.apply(history, args as any);
          window.dispatchEvent(new Event('spa:navigate'));
        } as any;
        history.replaceState = function (...args: any[]) {
          _rs.apply(history, args as any);
          window.dispatchEvent(new Event('spa:navigate'));
        } as any;

        window.addEventListener('spa:navigate', () => this.markIntent('internal'), true);
      } catch { /* ignore */ }
    }

    // ⚠️ REMOVED: Duplicate Navigation API listener (zaten satır 154-175'te var)
    // ⚠️ REMOVED: beforeunload listener (gereksiz, pagehide zaten tüm durumları handle ediyor)

    // --- 2) Çıkış yakalama: visibilitychange + pagehide ----------------------------------------

    // A) visibilitychange (erken faz + kısa gecikme)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && !this.leaveSent) {
        // ✅ CRITICAL FIX: visibilitychange event'i de karar verme işlemini tetikle
        // Bazı tarayıcılarda pagehide tetiklenmeden önce visibilitychange tetiklenir
        // Özellikle tarayıcı kapatıldığında
        console.log('[Unload:visibilitychange] hidden → will decide after delay');
        
        // Önceki timeout'u temizle (multiple visibilitychange önle)
        if (this.visibilityChangeTimeoutId) {
          clearTimeout(this.visibilityChangeTimeoutId);
        }
        
        // Kısa bir delay ile karar ver (pagehide hala tetiklenebilir)
        this.visibilityChangeTimeoutId = setTimeout(() => {
          if (!this.leaveSent) {
            this.decideAndMaybeSendLeave('visibilitychange');
          }
          this.visibilityChangeTimeoutId = null;
        }, 10); // ✅ FIX: 10ms delay for faster response
      } else if (document.visibilityState === 'visible') {
        // ✅ FIX: Sayfa visible olduğunda timeout'u iptal et
        if (this.visibilityChangeTimeoutId) {
          clearTimeout(this.visibilityChangeTimeoutId);
          this.visibilityChangeTimeoutId = null;
          console.log('[Unload:visibilitychange] Visible → timeout cancelled');
        }
      }
    }, { capture: true }); // ✅ NEW: Capture phase

    // B) pagehide (erken faz)
    window.addEventListener('pagehide', (ev: PageTransitionEvent) => {
      // ✅ FIX: Cancel visibilitychange timeout (pagehide daha kesin)
      if (this.visibilityChangeTimeoutId) {
        clearTimeout(this.visibilityChangeTimeoutId);
        this.visibilityChangeTimeoutId = null;
      }
      
      // BFCache: unknown ise NO LEAVE
      const storageIntent = this.readIntentFromStorage();
      if ((ev as any).persisted && storageIntent === 'unknown') {
        this.clearIntentFlags();
        console.log('[Unload:pagehide] BFCache persisted & unknown → NO LEAVE');
        return;
      }
      this.decideAndMaybeSendLeave('pagehide');
    }, { capture: true }); // ✅ NEW: Capture phase

    // ✅ NEW: C) freeze (Chromium, sayfa askıya alma)
    try {
      // @ts-ignore
      document.addEventListener('freeze', () => {
        // ✅ FIX: Cancel visibilitychange timeout (freeze son çare)
        if (this.visibilityChangeTimeoutId) {
          clearTimeout(this.visibilityChangeTimeoutId);
          this.visibilityChangeTimeoutId = null;
        }
        
        if (!this.leaveSent) {
          console.log('[Unload:freeze] → decide');
          this.decideAndMaybeSendLeave('visibilitychange'); // benzer davranış
        }
      }, { capture: true });
    } catch { /* ignore */ }

    // ✅ NEW: D) unload (deprecate ama sigorta; sadece sendBeacon kullan)
    window.addEventListener('unload', () => {
      // ✅ FIX: Cancel visibilitychange timeout (unload son çare)
      if (this.visibilityChangeTimeoutId) {
        clearTimeout(this.visibilityChangeTimeoutId);
        this.visibilityChangeTimeoutId = null;
      }
      
      if (!this.leaveSent) {
        // Unload sadece son çare, reload/internal control için pagehide zaten çalıştı
        console.log('[Unload:unload] last-chance leave (race condition fallback)');
        this.decideAndMaybeSendLeave('pagehide'); // Use same logic as pagehide
      }
    });

    // ✅ FIX: beforeunload - ONLY sendBeacon (no fetch/XHR)
    window.addEventListener('beforeunload', () => {
      if (!this.leaveSent) {
        // Check if it's a reload first
        const refreshFlag = sessionStorage.getItem(this.REFRESH_FLAG_KEY) === 'true';
        const storageIntent = this.readIntentFromStorage();
        const isReload = refreshFlag || storageIntent === 'reload' || this.isReloadPlanned;
        
        if (isReload) {
          console.log('[Unload:beforeunload] RELOAD detected → NO LEAVE');
          return;
        }
        
        console.log('[Unload:beforeunload] browser close/navigation detected - sending beacon');
        // ✅ ONLY sendBeacon - never fetch/XHR
        try {
          const payload = {
            customerId: this.customerId,
            sessionId: this.sessionId,
            tabId: this.tabId,
            timestamp: Date.now(),
            mode: 'pending' as const,
            reason: 'tabclose' as const
          };
          const ok = navigator.sendBeacon?.(
            `${this.apiUrl}/presence/leave`,
            new Blob([JSON.stringify(payload)], { type: 'text/plain' })
          );
          // ✅ Prevent duplicate sends by setting flag if beacon was queued
          if (ok) {
            this.leaveSent = true;
            console.log('[Unload:beforeunload] ✅ Beacon queued, flag set to prevent duplicate');
          }
        } catch {}
      }
    }, { capture: true });

    console.log('[Unload] Desktop leave detection ready.');
  }

  private isAllowedOrigin(origin: string): boolean {
    if (this.allowedOrigins.has(origin)) return true;
    // Gerekirse eTLD+1 genişletmesi burada yapılabilir (public suffix list gerektirir).
    return false;
  }

  private markIntent(kind: DestType) {
    // ✅ FIX: Calculate effective intent based on priority (external > reload > internal)
    // Store the effective intent, not the raw kind
    let effective: DestType = kind;

    if (kind === 'external') {
      this.plannedExternal = true;
      this.isInternalNavPlanned = false;
      this.isReloadPlanned = false;
      effective = 'external';
    } else if (kind === 'internal') {
      if (!this.plannedExternal) {
        this.isInternalNavPlanned = true;
        this.isReloadPlanned = false;
        effective = 'internal';
      } else {
        effective = 'external'; // external baskın
      }
    } else if (kind === 'reload') {
      if (!this.plannedExternal) {
        this.isReloadPlanned = true;
        this.isInternalNavPlanned = false;
        effective = 'reload';
      } else {
        effective = 'external'; // external baskın
      }
    }

    try {
      sessionStorage.setItem(this.NAV_INTENT_KEY, effective);
    } catch { /* ignore */ }
  }

  private readIntentFromStorage(): DestType {
    try {
      const v = sessionStorage.getItem(this.NAV_INTENT_KEY) as DestType | null;
      return v ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private decideAndMaybeSendLeave(source: 'visibilitychange' | 'pagehide') {
    // ✅ FIX: Remove isDesktop check - hooks are always connected regardless
    // Mobile/tablet might incorrectly detect as desktop
    if (this.leaveSent) return;

    // 1) Reload bayrakları (Navigation Timing değil, sadece kendi bayraklarımız)
    const refreshFlag = sessionStorage.getItem(this.REFRESH_FLAG_KEY) === 'true';

    // 2) İç/harici niyet (çok kaynaklı)
    const storageIntent = this.readIntentFromStorage();
    const internalPlanned = this.isInternalNavPlanned || storageIntent === 'internal';
    const externalPlanned = this.plannedExternal || storageIntent === 'external';

    // Debug log
    console.log(`[Unload:${source}] Decision - refreshFlag: ${refreshFlag}, storageIntent: ${storageIntent}, isReloadPlanned: ${this.isReloadPlanned}, internalPlanned: ${internalPlanned}, externalPlanned: ${externalPlanned}`);

    // Karar matrisi:
    // - RELOAD → NO LEAVE (kendi bayraklarımıza güven)
    if (refreshFlag || storageIntent === 'reload' || this.isReloadPlanned) {
      this.clearIntentFlags();
      sessionStorage.removeItem(this.REFRESH_FLAG_KEY); // Reload sonrası temizle
      this.leaveSent = true; // ✅ LEAVE gönderilmeyeceğini işaretle
      console.log(`[Unload:${source}] RELOAD detected (own flags) → NO LEAVE`);
      return;
    }

    // - İç navigasyon → NO LEAVE
    if (internalPlanned) {
      this.clearIntentFlags();
      this.leaveSent = true; // ✅ LEAVE gönderilmeyeceğini işaretle
      console.log(`[Unload:${source}] Internal navigation → NO LEAVE`);
      return;
    }

    // - Harici navigasyon → LEAVE (final)
    if (externalPlanned) {
      this.clearIntentFlags();
      console.log(`[Unload:${source}] External navigation → SEND LEAVE (final)`);
      this.sendLeaveFinal('external');
      return;
    }

    // - Niyet bilinmiyorsa: pending leave gönder (backend 300-1000ms pencerede JOIN gelirse silme)
    this.clearIntentFlags();
    console.log(`[Unload:${source}] Unknown intent → SEND PENDING LEAVE`);
    this.sendLeavePending('unknown');
  }

  private clearIntentFlags() {
    this.isInternalNavPlanned = false;
    this.isReloadPlanned = false;
    this.plannedExternal = false;
    sessionStorage.removeItem(this.NAV_INTENT_KEY);
    // REFRESH_FLAG_KEY'i silme, pagehide'da kullanılacak
  }

  /**
   * ✅ CRITICAL FIX: Synchronous network transmission for unload events
   * Tries sendBeacon → sync XHR
   * MUST be synchronous because browser shuts down during unload
   * 
   * IMPORTANT: sendBeacon sends as text/plain regardless of Content-Type
   * Server MUST accept text/plain and parse as JSON
   */
  private sendWithKeepaliveSync(url: string, payload: any): boolean {
    const jsonString = JSON.stringify(payload);
    
    try {
      // 1) sendBeacon dene (MOST RELIABLE)
      // Browser ignores Content-Type and always sends as text/plain
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(url, new Blob([jsonString], { type: 'text/plain' }));
        if (ok) {
          console.log('[Unload] ✅ sendBeacon success');
          return true;
        } else {
          console.log('[Unload] ⚠️ sendBeacon returned false');
        }
      }
    } catch (e) {
      console.error('[Unload] ❌ sendBeacon error:', e);
    }

    // 2) sync XHR fallback (BLOCKS until complete)
    // Don't set Content-Type to avoid CORS preflight
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, false); // false = synchronous
      xhr.send(jsonString);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('[Unload] ✅ sync XHR success');
        return true;
      } else {
        console.error('[Unload] ❌ sync XHR failed:', xhr.status);
      }
    } catch (e) {
      console.error('[Unload] ❌ sync XHR error:', e);
    }
    
    return false;
  }

  /**
   * Public: Force or normal LEAVE send
   * ✅ CRITICAL FIX: Now synchronous to work during page unload
   */
  private sendLeaveFinal(reason: 'external' | 'tabclose' = 'external'): void {
    if (this.leaveSent) return;
    this.leaveSent = true;

    const payload: LeavePayload = {
      customerId: this.customerId,
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
      mode: 'final',
      reason,
    };

    // ✅ CRITICAL: Use synchronous send during unload
    const ok = this.sendWithKeepaliveSync(`${this.apiUrl}/presence/leave`, payload);
    console.log(ok ? '[Unload] ✅ LEAVE sent' : '[Unload] ❌ LEAVE failed');
  }

  private sendLeavePending(reason: 'unknown' | 'tabclose' | 'external' = 'unknown'): void {
    if (this.leaveSent) return;
    this.leaveSent = true;

    const payload: LeavePayload = {
      customerId: this.customerId,
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
      mode: 'pending',
      reason,
    };

    // ✅ CRITICAL: Use synchronous send during unload
    const ok = this.sendWithKeepaliveSync(`${this.apiUrl}/presence/leave`, payload);
    console.log(ok ? '[Unload] ✅ PENDING LEAVE sent' : '[Unload] ❌ PENDING LEAVE failed');
  }

  public resetLeaveSentFlag(): void {
    this.leaveSent = false;
    console.log('[Unload] leaveSent reset');
  }

  public sendLeave(force: boolean = false, reason: 'tabclose' | 'external' = 'tabclose'): void {
    if (!force && this.leaveSent) {
      console.log('[Unload] sendLeave skipped: leaveSent already true');
      return;
    }
    
    if (force) {
      this.leaveSent = false; // Reset flag before sending
    }
    
    console.log(`[Unload] sendLeave called (force: ${force}, reason: ${reason})`);
    this.sendLeavePending(reason);
  }

  public isDesktopDevice(): boolean {
    return this.isDesktop;
  }
}
