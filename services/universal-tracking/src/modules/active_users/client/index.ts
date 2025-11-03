/**
 * Active Users Client
 * Main entry point for browser-side tracking
 */
import { mergeConfig } from './config.js';
import { SessionState } from './state/session.js';
import { StateStore } from './state/store.js';
import { TabLeaderManager } from './lifecycle/leader-tab.js';
import { VisibilityTracker } from './lifecycle/visibility.js';
import { UnloadHandler } from './lifecycle/unload.js';
import { HybridConnectionManager } from './connection/HybridConnectionManager.js';
import { EMACalculator } from './metrics/ema.js';
import { MetricsSampler } from './metrics/sampler.js';
import { Logger } from './utils/logger.js';
import { StatusLogger } from './utils/StatusLogger.js';
import { PlatformDetector } from './utils/platform-detector.js';
import type { ClientConfig } from '../types/Config.js';
import type { ActiveUserMetrics, MetricsResponse } from '../types/index.js';
// Device Detection integration
import { detectDevice } from '../../device_detection/index.js';
// Passive Active module
import { PassiveActiveManager, type SessionMode } from './passive_active/index.js';
import { extractReferrerInfo, type ReferrerInfo, type ReferrerNavigationType } from '../../referrer/index.js';
export class ActiveUsersClient {
  private config: Required<ClientConfig>;
  private session: SessionState;
  private store: StateStore;
  private tabLeader: TabLeaderManager;
  private visibility: VisibilityTracker;
  private unload: UnloadHandler;
  private connection: HybridConnectionManager;
  private ema: EMACalculator;
  private sampler: MetricsSampler;
  private logger: Logger;
  private statusLogger: StatusLogger;
  private platformDetector: PlatformDetector;
  // ✅ PHASE 2: TTL Refresh Timer (replaces HeartbeatTracker)
  private ttlRefreshTimer: ReturnType<typeof setInterval> | null = null;
  // ✅ Mobile cleanup timer (for aggressive cleanup on mobile/tablet background)
  private mobileCleanupTimer: ReturnType<typeof setTimeout> | null = null;
  // 🆕 JOIN debouncing (prevent duplicate requests)
  private pendingJoin: boolean = false;
  private joinDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  // 🆕 Passive Active Manager (Desktop only)
  private passiveActive: PassiveActiveManager | null = null;
  private currentSessionMode: SessionMode = 'active';
  // ✅ Mobile/Tablet: Force 'active' mode (prevent passive_active)
  private isMobileOrTabletDevice: boolean = false;
  // ✅ Mobile/Tablet: Flag to prevent JOIN after LEAVE in background
  private mobileLeaveSent: boolean = false;
  private referrerInfo: ReferrerInfo | null = null;
  // Current status tracking
  private currentStatus = {
    connection: 'disconnected' as 'websocket' | 'polling' | 'disconnected',
    visibilityState: 'foreground' as 'foreground' | 'background',
    isLeader: false,
    tabId: '', // Will be set after session initialization
    ttlRefreshInterval: 60000,
  };
  constructor(config: ClientConfig) {
    this.config = mergeConfig(config);
    this.logger = new Logger('[ActiveUsers]', this.config.debug);
    this.statusLogger = new StatusLogger(this.config.debug);
    this.platformDetector = new PlatformDetector();
    // Initialize session
    this.session = new SessionState(this.config.customerId);
    // ✅ Set tabId in currentStatus
    this.currentStatus.tabId = this.session.getTabId();
    // Initialize store
    this.store = new StateStore();
    // Initialize lifecycle managers
    this.tabLeader = new TabLeaderManager(
      this.config.customerId,
      this.session.getSessionId(),
      this.session.getTabId()
    );
    this.visibility = new VisibilityTracker();
    
    // ✅ Build allowed origins from API URL (automatic subdomain support)
    const allowedOrigins = this.getAllowedOrigins();
    
    this.unload = new UnloadHandler(
      this.config.customerId,
      this.session.getSessionId(),
      this.session.getTabId(),
      this.config.apiUrl,
      { allowedOrigins }
    );
    // Initialize connection
    this.connection = new HybridConnectionManager(
      this.config,
      this.config.customerId,
      this.session.getSessionId(),
      this.session.getTabId()
    );
    // Initialize metrics
    this.ema = new EMACalculator(this.config.emaAlpha, this.config.emaWindowSize);
    this.sampler = new MetricsSampler(1000);
    
    // ✅ NOTE: PassiveActive Manager will be initialized in init() after device detection
    // This is because device detection is async and we need to know if it's mobile/tablet first
    this.passiveActive = null;
    
  }
  /**
   * Handle session mode change (active ↔ passive_active)
   * ✅ Desktop ONLY - Mobile/Tablet disabled
   */
  private async handleSessionModeChange(newMode: SessionMode): Promise<void> {
    if (newMode === 'removed') return; // Ignore removed state
    
    // ✅ Mobile/Tablet: Session mode changes disabled (always 'active')
    if (this.isMobileOrTabletDevice) {
      // ✅ CRITICAL: Force 'active' mode and prevent any passive_active
      if (this.currentSessionMode !== 'active') {
        this.currentSessionMode = 'active';
      }
      return; // Mobile/Tablet'ta passive_active yok, ignore
    }
    
    const oldMode = this.currentSessionMode;
    
    // No change? Skip
    if (oldMode === newMode) {
      return;
    }
    
    this.currentSessionMode = newMode;
    
    // ✅ DEBUG: Log mode transition (temporary, for debugging)
    if (this.config.debug) {
      console.log(`[PassiveActive] Mode transition: ${oldMode} → ${newMode}`);
    }
    
    // ✅ CRITICAL: Update Redis with new session_mode via JOIN
    await this.sendJoin();
    
    // Update connection mode (will switch to appropriate polling interval)
    // ✅ Mobile/Tablet: Session mode changes disabled, skip connection update
    if (!this.isMobileOrTabletDevice) {
      this.connection.updateSessionMode(newMode);
    }
    
    // Update TTL refresh interval
    if (this.store.isTabLeader()) {
      this.stopTTLRefresh();
      this.startTTLRefresh();
    }
  }
  
  /**
   * Update and log system status
   */
  private updateStatus(updates: Partial<typeof this.currentStatus>): void {
    // ✅ FIX: Önce currentStatus'u güncelle
    Object.assign(this.currentStatus, updates);
    // ✅ FIX: Leader değişiminde hemen log, diğer durumlar debounce
    const shouldLogImmediately = updates.hasOwnProperty('isLeader');
    if (shouldLogImmediately) {
      // Leader değişti, hemen log gönder (debounce bypass)
      this.statusLogger.logStatusImmediate({
        ...this.currentStatus,
        userId: this.session.getSessionId(),
        tabId: this.session.getTabId(),
      });
    } else {
      // Normal log (debounce ile)
      this.statusLogger.logStatus({
        ...this.currentStatus,
        userId: this.session.getSessionId(),
        tabId: this.session.getTabId(),
      });
    }
  }
  /**
   * Start active users tracking
   */
  async init(): Promise<void> {
    // ✅ CRITICAL FIX: Setup unload handler IMMEDIATELY (before page load)
    // Cache clear sonrası ilk load'da user hızlı kapatırsa setup tamamlanmadan sayfa kapanabilir
    this.unload.setup();
    
    // ✅ CRITICAL: Sayfa tam yüklenene kadar bekleme
    // Kullanıcı URL yazmış olabilir ama Enter'a basmamış olabilir
    await this.waitForPageLoad();
    
    // ✅ CRITICAL: Detect mobile/tablet using device detection (handles desktop mode)
    // Desktop mode açıkken User Agent desktop gibi görünür, bu yüzden device detection kullanıyoruz
    const userAgent = navigator.userAgent;
    const deviceDetectionResult = await detectDevice(userAgent, {
      enableClientHints: true,
      debug: this.config.debug,
    });
    // ✅ Use detected device type (not User Agent) - works even in desktop mode
    const detectedDevice = deviceDetectionResult.detected.device;
    const detectedPlatform = deviceDetectionResult.detected.platform;
    // Mobile/Tablet: device is 'mobile' or 'tablet', OR platform is 'android' or 'ios'
    this.isMobileOrTabletDevice = detectedDevice === 'mobile' || detectedDevice === 'tablet' || 
                                   detectedPlatform === 'android' || detectedPlatform === 'ios';
    
    // ✅ CRITICAL: Initialize Passive Active Manager AFTER device detection (Desktop ONLY)
    if (!this.isMobileOrTabletDevice) {
      // Desktop: Enable PassiveActive
      this.passiveActive = new PassiveActiveManager({
        customerId: this.config.customerId,
        sessionId: this.session.getSessionId(),
        onStateChange: (newState: SessionMode) => {
          this.handleSessionModeChange(newState);
        },
        onRemoveFromRedis: () => {
          this.unload.sendLeave(true); // force=true (bypass leaveSent flag)
          this.stopTTLRefresh();
        },
        onRejoinToRedis: async () => {
          // ✅ CRITICAL: Reset leaveSent flag to allow next LEAVE
          this.unload.resetLeaveSentFlag();
          
          // ✅ Desktop: Determine correct session_mode based on visibility
          const currentVisibility = this.visibility.isForeground();
          const sessionModeAfterRejoin = currentVisibility ? 'active' : 'passive_active';
          
          // Update internal state FIRST
          this.currentSessionMode = sessionModeAfterRejoin;
          
          // Send JOIN with correct session_mode
          await this.sendJoin();
          
          // Update connection mode
          this.connection.updateSessionMode(sessionModeAfterRejoin);
          
          // Start TTL refresh
          if (this.store.isTabLeader()) {
            this.startTTLRefresh();
          }
          
          // ✅ Start tracking with correct visibility (NO state change callback!)
          if (this.passiveActive?.shouldBeActive()) {
            this.passiveActive.startTrackingWithVisibility(currentVisibility);
          }
        },
        isLeaderTab: () => this.store.isTabLeader(),
      });
    } else {
      // Mobile/Tablet: PassiveActive disabled (always active mode)
      this.passiveActive = null;
    }
    
    // Start visibility tracking
    this.visibility.start((state) => {
      this.handleVisibilityChange(state);
    });
    // 🆕 Background → Foreground geçişinde Redis güncellemesi
    this.visibility.setOnBecameForeground(async () => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      this.store.setAppState('foreground');
      this.tabLeader.updateMyTabState('foreground');
      
      // ✅ MOBILE/TABLET FIX: Ekran kilidi açıldığında Redis'e yeniden JOIN gönder
      if (this.isMobileOrTabletDevice) {
        const wasConnected = this.connection.isConnected();
        const previousMobileLeaveSent = this.mobileLeaveSent;
        const previousIntentionalFlag = (this.connection as any).isIntentionallyStopped;

        // Geçici olarak bayrakları sıfırla, JOIN'e izin ver; başarısız olursa geri alacağız
        this.mobileLeaveSent = false;
        (this.connection as any).resetIntentionallyStopped?.();

        let joinSucceeded = false;
        try {
          await this.sendJoin();
          joinSucceeded = true;
        } catch (error) {
          // JOIN başarısızsa bayrakları eski haline getir
          this.mobileLeaveSent = previousMobileLeaveSent;
          if (previousIntentionalFlag !== undefined) {
            (this.connection as any).isIntentionallyStopped = previousIntentionalFlag;
          }
          throw error;
        }

        // ✅ Connection'ı restart et (stop edilmişse)
        if (!wasConnected) {
          this.connection.start(
            'foreground',
            (metrics) => this.handleMetricsUpdate(metrics),
            (mode) => {
              this.store.setConnectionMode(mode);
              this.currentStatus.connection = mode;
            },
            // 🆕 Callback: WebSocket koptuğunda polling'e geçerken JOIN gönder
            // ✅ CRITICAL: Mobil/tablet için sadece foreground'da JOIN gönder
            () => this.handleWebSocketFallback()
          );
        }

        // ✅ Leader election trigger et
        if (this.store.isTabLeader()) {
          this.startTTLRefresh();
        }

        if (joinSucceeded) {
          // JOIN başarıyla gönderildiyse bayraklar sıfırlanmış olarak kalsın
          this.mobileLeaveSent = false;
          (this.connection as any).resetIntentionallyStopped?.();
        }
        
      }
    });
    // Start tab leader election
    this.tabLeader.start((isLeader) => {
      this.handleLeaderChange(isLeader);
    });
    
    // Setup user activity listeners (for PassiveActive)
    if (this.passiveActive) {
      this.setupUserActivityListeners();
    }
    
    // Send initial join
    await this.sendJoin();
    
    // ✅ CRITICAL: Start connection with ACTUAL visibility state
    const initialAppState = this.visibility.isForeground() ? 'foreground' : 'background';
    
    // ✅ CRITICAL: Reset intentionally stopped flag before starting
    (this.connection as any).resetIntentionallyStopped?.();
    
    this.connection.start(
      initialAppState,
      (metrics) => this.handleMetricsUpdate(metrics),
      (mode) => {
        this.store.setConnectionMode(mode);
        this.currentStatus.connection = mode;
        this.statusLogger.logStatus({
          ...this.currentStatus,
          userId: this.session.getSessionId(),
          tabId: this.session.getTabId(),
        });
      },
      // 🆕 Callback: WebSocket koptuğunda polling'e geçerken JOIN gönder
      // ✅ CRITICAL: Mobil/tablet için sadece foreground'da JOIN gönder
      () => this.handleWebSocketFallback()
    );
    
    // ✅ Start PassiveActive tracking (Desktop)
    if (this.passiveActive?.shouldBeActive()) {
      this.passiveActive.startTracking();
    }
    
    // ✅ Log initial status
    this.statusLogger.logEvent('✅', 'Active Users SDK initialized successfully', 'success');
  }
  /**
   * 🆕 Sayfa tam yüklenene kadar bekle
   * Kullanıcı URL yazmış olabilir ama Enter'a basmamış olabilir
   */
  private async waitForPageLoad(): Promise<void> {
    // Sayfa zaten yüklenmişse hemen dön
    if (document.readyState === 'complete') {
            return;
    }
    // DOMContentLoaded'ı bekle (HTML parse edildi, ama resimler/CSS henüz yüklenmemiş olabilir)
    if (document.readyState === 'loading') {
            await new Promise<void>((resolve) => {
        document.addEventListener('DOMContentLoaded', () => {
                    resolve();
        }, { once: true });
      });
    }
    // İlave güvenlik: 500ms daha bekle (kullanıcı hala vazgeçebilir)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
  /**
   * Setup user activity listeners (click, scroll, keypress)
   */
  private setupUserActivityListeners(): void {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach(eventName => {
      document.addEventListener(eventName, () => {
        this.passiveActive?.onUserActivity();
      }, { passive: true });
    });
    
  }
  
  /**
   * ✅ Handle visibility change
   */
  private handleVisibilityChange(state: 'foreground' | 'background'): void {
    // ✅ CRITICAL FIX: Set flag IMMEDIATELY for mobile/tablet background (before debounce)
    // This prevents JOIN from being sent if WebSocket disconnects during debounce period
    // Works for: Home button, Screen lock, Tab switch, App switch
    if (this.isMobileOrTabletDevice && state === 'background') {
      // Set flag immediately to prevent any JOIN after WebSocket disconnect
      this.mobileLeaveSent = true;
      // ✅ CRITICAL: Also set connection flag immediately (before any async operations)
      // This ensures handleWebSocketStateChange() will see the flag even if disconnect happens during debounce
      (this.connection as any).isIntentionallyStopped = true;
      console.log(`[handleVisibilityChange] 🚨 Mobile/Tablet background detected - flags set immediately (state: ${state})`);
    }
    
    // ✅ DEBOUNCE: 500ms bekle, gerçek mi yoksa geçici mi?
    setTimeout(() => {
      // Tekrar kontrol et, kullanıcı geri dönmüş olabilir
      const currentState = this.visibility.getState();
      this.store.setAppState(currentState);
      
      const isLeader = this.store.isTabLeader();
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      // Update tab state (for tab counting)
      this.tabLeader.updateMyTabState(currentState);
      
      // ✅ MOBILE/TABLET: Immediate LEAVE on background (no passive_active mode)
      if (this.isMobileOrTabletDevice) {
        if (currentState === 'background') {
          // ✅ Mobile/Tablet: Background'a geçildiğinde hemen LEAVE gönder
          this.logger.log('📱 Mobile/Tablet background → Sending LEAVE immediately');
          // ✅ CRITICAL: Flag already set above (before debounce), but ensure it's set here too
          this.mobileLeaveSent = true;
          // sendLeave() metodu FINAL LEAVE gönderir (mode: 'final')
          this.unload.sendLeave(); // Send FINAL LEAVE (Redis'ten hemen sil)
          this.stopTTLRefresh();
          this.stopMobileCleanupTimer();
          // ✅ CRITICAL: Set intentionally stopped flag BEFORE calling stop()
          // This ensures that if WebSocket disconnect event fires during stop(),
          // handleWebSocketStateChange() will see the flag and skip fallback
          (this.connection as any).isIntentionallyStopped = true;
          // ✅ CRITICAL: Stop connection BEFORE updating app state
          // This prevents selectOptimalConnection() from switching to polling and sending JOIN
          // Pass true to indicate this is an intentional stop (mobile/tablet background)
          this.connection.stop(true);
          // Update connection app state AFTER stop (won't trigger selectOptimalConnection)
          this.connection.updateAppState(currentState);
          this.updateStatus({
            connection: 'disconnected',
            ttlRefreshInterval: 0,
          });
        } else {
          // ✅ Mobile/Tablet: Foreground'a döndüğünde JOIN gönder ve bağlantıyı başlat
          this.logger.log('📱 Mobile/Tablet foreground → Sending JOIN and reconnecting');
          // ✅ CRITICAL: Reset flags when foreground (JOIN allowed again)
          this.mobileLeaveSent = false;
          (this.connection as any).resetIntentionallyStopped?.();
          this.stopMobileCleanupTimer();
          // Update connection app state
          this.connection.updateAppState(currentState);
          // JOIN ve connection restart zaten onBecameForeground callback'inde yapılıyor (index.ts:209-238)
          // Burada sadece cleanup timer'ı durduruyoruz
        }
      } else {
        // ✅ DESKTOP: Passive Active tracking (no immediate LEAVE)
        // Update connection app state
        this.connection.updateAppState(currentState);
        this.passiveActive?.onVisibilityChange(currentState === 'foreground');
      }
      
      // ✅ Leader election (foreground'a dönüldüğünde)
      if (currentState === 'foreground' && !this.store.isTabLeader()) {
        this.tabLeader.triggerLeaderElection();
      }
      
      // ✅ Log status
      this.updateStatus({ 
        visibilityState: currentState,
      });
    }, 500);
  }
  /**
   * ✅ PHASE 2: Handle leader change (TTL refresh replaces heartbeat)
   */
  private handleLeaderChange(isLeader: boolean): void {
    this.store.setLeader(isLeader);
    if (isLeader) {
      // ✅ HIZLI LOG: Leader olduğunda hemen log gönder
      this.statusLogger.logEvent('👑', 'Leader election: BECAME LEADER', 'success');
      // ✅ FIX: TTL refresh'i connection kurulduktan sonra başlat (WebSocket VE Polling için)
      if (this.store.isTabLeader()) {
        this.startTTLRefresh();
      }
      // ✅ Start PassiveActive tracking (Desktop only)
      if (this.passiveActive?.shouldBeActive()) {
        this.passiveActive.startTracking();
      }
    } else {
      // ✅ PHASE 2: Stop TTL refresh (follower tabs don't refresh TTL)
      this.stopTTLRefresh();
      // ✅ HIZLI LOG: Leader olmadığında hemen log gönder
      this.statusLogger.logEvent('📋', 'Leader election: BECAME FOLLOWER', 'info');
      // ✅ Stop PassiveActive tracking
      if (this.passiveActive) {
        this.passiveActive.stopTracking();
      }
    }
    // ✅ FIX: TTL refresh değerini ÖNCE güncelle
    const ttlInterval = isLeader ? this.config.ttlRefreshInterval : 0;
    this.currentStatus.ttlRefreshInterval = ttlInterval;
    // ✅ Update and log consolidated status (StatusLogger'da hemen gönderilecek)
    this.updateStatus({ 
      isLeader,
      ttlRefreshInterval: ttlInterval,
    });
  }
  /**
   * ✅ Start TTL refresh timer (session_mode aware)
   */
  private startTTLRefresh(): void {
    this.stopTTLRefresh(); // Clear existing
    
    // ✅ Mobile/Tablet: Always use active interval (no passive_active)
    // Desktop: Select interval based on session mode
    const effectiveSessionMode = this.isMobileOrTabletDevice ? 'active' : this.currentSessionMode;
    
    const interval = effectiveSessionMode === 'passive_active' 
      ? this.config.ttlRefreshIntervalPassive 
      : this.config.ttlRefreshInterval;
    
    this.ttlRefreshTimer = setInterval(() => {
      // 🆕 CRITICAL: Only send TTL refresh if in WebSocket mode!
      // In polling mode, polling itself handles TTL refresh via JOIN requests
      if (this.connection.getMode() !== 'websocket') {
        return;
      }
      
      // ✅ Mobile/Tablet: Always send 'active' mode for TTL refresh
      // Desktop: Use current session mode
      const sessionModeForTTL = this.isMobileOrTabletDevice ? 'active' : this.currentSessionMode;
      
      this.connection.sendTTLRefresh(sessionModeForTTL);
      this.statusLogger.logTTLRefresh(
        this.session.getSessionId(), 
        this.session.getTabId(), 
        interval
      );
    }, interval);
    
    const intervalMinutes = Math.floor(interval / 60000);
    const modeToLog = this.isMobileOrTabletDevice ? 'active' : this.currentSessionMode;
    this.statusLogger.logEvent('✅', `TTL refresh started (${intervalMinutes}min - ${modeToLog})`, 'success');
  }
  /**
   * ✅ PHASE 2: Stop TTL refresh timer
   */
  private stopTTLRefresh(): void {
    if (this.ttlRefreshTimer) {
      clearInterval(this.ttlRefreshTimer);
      this.ttlRefreshTimer = null;
      this.statusLogger.logEvent('⏹️', 'TTL refresh stopped', 'info');
    }
  }
  /**
   * ✅ Mobile/Tablet cleanup: Start aggressive cleanup timer
   */
  private startMobileCleanupTimer(): void {
    this.stopMobileCleanupTimer(); // Clear existing
    // Wait 30 seconds before aggressive cleanup
    this.mobileCleanupTimer = setTimeout(() => {
      // Double-check: Still in background?
      if (this.visibility.getState() === 'background') {
        this.statusLogger.logEvent('📱', 'Mobile cleanup: Background timeout reached, disconnecting...', 'warning');
        // Stop TTL refresh
        this.stopTTLRefresh();
        // Stop connection (graceful disconnect)
        this.connection.stop();
        // Update status
        this.updateStatus({
          connection: 'disconnected',
          ttlRefreshInterval: 0,
        });
        this.statusLogger.logEvent('📱', 'Mobile cleanup: Disconnected', 'info');
      }
    }, 30000); // 30 seconds
    this.statusLogger.logEvent('📱', 'Mobile cleanup timer started (30s)', 'info');
  }
  /**
   * ✅ Mobile/Tablet cleanup: Stop cleanup timer
   */
  private stopMobileCleanupTimer(): void {
    if (this.mobileCleanupTimer) {
      clearTimeout(this.mobileCleanupTimer);
      this.mobileCleanupTimer = null;
      this.statusLogger.logEvent('📱', 'Mobile cleanup timer stopped', 'info');
    }
  }
  /**
   * ✅ Handle WebSocket fallback to polling
   * Desktop için: Her zaman JOIN gönder (passive_active sistemi var)
   * Mobil/tablet için: Sadece foreground'da JOIN gönder
   * 
   * CRITICAL: Mobil/tablet'te background'a geçildiğinde JOIN gönderilmesin.
   * Sadece sayfa foreground durumunda ise ve WebSocket bağlantısı koptuğunda JOIN gönderilsin.
   */
  private async handleWebSocketFallback(): Promise<void> {
    // ✅ Desktop: Her zaman JOIN gönder (passive_active sistemi var)
    if (!this.isMobileOrTabletDevice) {
      await this.sendJoin();
      return;
    }
    
    // ✅ Mobil/Tablet: Sadece foreground'da JOIN gönder
    // Background'da JOIN gönderme (çünkü zaten LEAVE gönderildi ve passive_active yok)
    
    // ✅ CRITICAL: Check document.hidden FIRST (most reliable browser API)
    // This check should be FIRST because it's the most direct indicator of page visibility
    // If page is hidden, DO NOT send JOIN regardless of other flags
    const isPageHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden');
    if (isPageHidden) {
      console.log(`[handleWebSocketFallback] ❌ BLOCKED - Page is hidden (mobile/tablet background)`);
      this.logger.log('📱 Mobile/Tablet WebSocket fallback → Page hidden → Skipping JOIN');
      return;
    }
    
    // ✅ CRITICAL: Check isIntentionallyStopped flag SECOND (set by handleVisibilityChange)
    // This is the second most reliable check because it's set immediately when background detected
    if ((this.connection as any).isIntentionallyStopped) {
      console.log(`[handleWebSocketFallback] ❌ BLOCKED - Connection intentionally stopped (mobile/tablet background)`);
      this.logger.log('📱 Mobile/Tablet WebSocket fallback → Intentionally stopped → Skipping JOIN');
      return;
    }
    
    // ✅ CRITICAL: Multiple checks to ensure JOIN is not sent when background
    // 1. Check mobileLeaveSent flag (set immediately when background detected)
    // 2. Check visibility tracker state (our internal state)
    // 3. Check app state (internal state)
    const isForeground = this.visibility.isForeground();
    const appState = this.store.getAppState();
    const isBackgroundState = appState === 'background' || appState === 'closed';
    
    // ✅ DEBUG: Log fallback attempt with all checks
    console.log(`[handleWebSocketFallback] Mobile/Tablet - mobileLeaveSent: ${this.mobileLeaveSent}, isPageHidden: ${isPageHidden}, isForeground: ${isForeground}, appState: ${appState}, isBackgroundState: ${isBackgroundState}, isIntentionallyStopped: ${(this.connection as any).isIntentionallyStopped}`);
    
    // ✅ CRITICAL: If ANY of these conditions are true, DON'T send JOIN
    // - document.hidden is true (already checked above - early return)
    // - isIntentionallyStopped flag is set (already checked above - early return)
    // - mobileLeaveSent flag is set (background detected)
    // - visibility tracker says not foreground
    // - app state is background or closed
    if (this.mobileLeaveSent || !isForeground || isBackgroundState) {
      this.logger.log('📱 Mobile/Tablet WebSocket fallback → Background → Skipping JOIN (LEAVE already sent or not foreground)');
      return;
    }
    
    // ✅ Only send JOIN if ALL checks pass:
    // - isIntentionallyStopped is false
    // - mobileLeaveSent is false
    // - document.hidden is false
    // - visibilityState is 'visible'
    // - visibility tracker says foreground
    // - app state is foreground
    this.logger.log('📱 Mobile/Tablet WebSocket fallback → Foreground → Sending JOIN');
    await this.sendJoin();
  }
  
  /**
   * Send join notification
   * 🆕 Tab counts eklendi
   * 🆕 Debounced to prevent duplicate requests
   */
  private async sendJoin(): Promise<void> {
    // ✅ DEBUG: Log JOIN attempt
    console.log(`[sendJoin] Called - mobileLeaveSent: ${this.mobileLeaveSent}, isMobileOrTabletDevice: ${this.isMobileOrTabletDevice}`);
    
    // ✅ CRITICAL: Check mobileLeaveSent flag BEFORE sending JOIN
    // This prevents JOIN from being sent when mobile/tablet goes to background
    if (this.isMobileOrTabletDevice && this.mobileLeaveSent) {
      console.log(`[sendJoin] ❌ BLOCKED - Mobile/Tablet background, LEAVE already sent`);
      return;
    }
    
    // ✅ CRITICAL: Mobil/tablet için ek kontrol - sayfa background'da ise JOIN gönderme
    // Bu kontrol, handleWebSocketFallback() kontrolünü tamamlar
    // Tab switch'te timing sorunu olabilir, bu yüzden burada da kontrol ediyoruz
    if (this.isMobileOrTabletDevice) {
      // ✅ CRITICAL: Check isIntentionallyStopped flag FIRST (most reliable)
      if ((this.connection as any).isIntentionallyStopped) {
        console.log(`[sendJoin] ❌ BLOCKED - Connection intentionally stopped (mobile/tablet background)`);
        return;
      }
      
      const isPageHidden = document.hidden || document.visibilityState === 'hidden';
      const isForeground = this.visibility.isForeground();
      const appState = this.store.getAppState();
      const isBackgroundState = appState === 'background' || appState === 'closed';
      
      // ✅ DEBUG: Log additional checks
      console.log(`[sendJoin] Mobile/Tablet checks - isPageHidden: ${isPageHidden}, isForeground: ${isForeground}, appState: ${appState}, isBackgroundState: ${isBackgroundState}, isIntentionallyStopped: ${(this.connection as any).isIntentionallyStopped}`);
      
      // Eğer sayfa background'da ise JOIN gönderme
      if (isPageHidden || !isForeground || isBackgroundState) {
        console.log(`[sendJoin] ❌ BLOCKED - Mobile/Tablet background detected (page hidden or not foreground)`);
        return;
      }
    }
    
    // Debounce: Skip if JOIN request is already in progress
    if (this.pendingJoin) {
      return;
    }
    this.pendingJoin = true;
    if (this.joinDebounceTimer) {
      clearTimeout(this.joinDebounceTimer);
    }
    
    const userAgent = navigator.userAgent;
    const deviceDetectionResult = await detectDevice(userAgent, {
      enableClientHints: true,
      debug: this.config.debug,
    });
    
    const platform = deviceDetectionResult.detected.platform;
    const device = deviceDetectionResult.detected.device;
    const browser = deviceDetectionResult.reported.browser;
    const desktop_mode = deviceDetectionResult.spoofingDetected;
    
    const tabCounts = this.tabLeader.getTabCounts();
    const total_tab_quantity = tabCounts.total;

    if (!this.referrerInfo) {
      try {
        const navigationType = this.getNavigationType();
        this.referrerInfo = extractReferrerInfo({
          referrer: typeof document !== 'undefined' ? document.referrer : null,
          currentUrl: typeof window !== 'undefined' ? window.location.href : null,
          navigationType,
        });
      } catch (error) {
        if (this.config.debug) {
          console.warn('[ActiveUsers] Failed to extract referrer info:', error);
        }
        this.referrerInfo = null;
      }
    }
    
    this.session.refreshSession();
    try {
      // ✅ Mobile/Tablet: Always 'active' mode (no passive_active)
      // Desktop: Use current session mode (can be 'active' or 'passive_active')
      // ✅ CRITICAL: Force 'active' for mobile/tablet (override currentSessionMode if it was set incorrectly)
      const sessionModeToSend = this.isMobileOrTabletDevice ? 'active' : this.currentSessionMode;
      
      await this.connection.sendJoin(
        platform,
        browser,
        device,
        userAgent,
        desktop_mode,
        total_tab_quantity,
        sessionModeToSend,
        this.referrerInfo || undefined
      );
    } finally {
      // 🆕 Reset pending flag after 1 second (allow next JOIN)
      this.joinDebounceTimer = setTimeout(() => {
        this.pendingJoin = false;
              }, 1000); // 1 second cooldown
    }
  }
  /**
   * Handle metrics update
   */
  private handleMetricsUpdate(metrics: MetricsResponse): void {
    // Update client-side EMA for smooth rendering
    const smoothedCount = this.ema.update(metrics.count);
    // Throttle UI updates
    if (this.sampler.shouldUpdate()) {
      const smoothedMetrics: ActiveUserMetrics = {
        customerId: metrics.customerId,
        timestamp: metrics.timestamp,
        count: metrics.count,
        ema: metrics.ema, // Server-side EMA
        raw: metrics.count,
      };
      this.store.updateMetrics(smoothedMetrics);
    }
  }
  /**
   * Subscribe to metrics updates
   */
  onMetrics(callback: (metrics: ActiveUserMetrics) => void): () => void {
    return this.store.onMetricsUpdate(callback);
  }
  /**
   * Get current metrics
   */
  getMetrics(): ActiveUserMetrics | null {
    return this.store.getMetrics();
  }
  /**
   * Get current active user count (client-side EMA smoothed)
   */
  getActiveUserCount(): number {
    return this.ema.getRounded();
  }

  /**
   * 🆕 Debug API: WebSocket bağlantısını test etmek için
   * Konsoldan: window.ActiveUsersTracker.debug.closeWebSocket()
   */
  debug = {
    /**
     * WebSocket bağlantısını manuel olarak kapat (test için)
     * Örnek: window.ActiveUsersTracker.debug.closeWebSocket()
     */
    closeWebSocket: () => {
      if (this.connection.getMode() === 'websocket') {
        console.log('[Debug] 🔌 Closing WebSocket connection manually...');
        this.connection.debugCloseWebSocket();
        console.log('[Debug] ✅ WebSocket closed, should fallback to polling');
      } else {
        console.log('[Debug] ⚠️ Not in WebSocket mode, current mode:', this.connection.getMode());
      }
    },
    
    /**
     * Mevcut bağlantı modunu göster
     * Örnek: window.ActiveUsersTracker.debug.getConnectionMode()
     */
    getConnectionMode: () => {
      const mode = this.connection.getMode();
      const isConnected = this.connection.isConnected();
      console.log('[Debug] Connection Mode:', mode, '| Connected:', isConnected);
      return { mode, isConnected };
    },
    
    /**
     * Polling'e manuel geçiş yap (test için)
     * Örnek: window.ActiveUsersTracker.debug.switchToPolling()
     */
    switchToPolling: () => {
      console.log('[Debug] 🔄 Switching to Polling mode manually...');
      this.connection.debugSwitchToPolling();
    },
    
    /**
     * WebSocket'e manuel geçiş yap (test için)
     * Örnek: window.ActiveUsersTracker.debug.switchToWebSocket()
     */
    switchToWebSocket: () => {
      console.log('[Debug] 🔄 Switching to WebSocket mode manually...');
      this.connection.debugSwitchToWebSocket();
    },
    
    /**
     * JOIN mesajı gönder (test için)
     * Örnek: window.ActiveUsersTracker.debug.sendJoin()
     */
    sendJoin: async () => {
      console.log('[Debug] 📤 Sending JOIN message manually...');
      await this.sendJoin();
      console.log('[Debug] ✅ JOIN sent');
    },
    
    /**
     * Mevcut durumu göster
     * Örnek: window.ActiveUsersTracker.debug.getStatus()
     */
    getStatus: () => {
      const status = {
        connectionMode: this.connection.getMode(),
        isConnected: this.connection.isConnected(),
        visibilityState: this.visibility.getState(),
        isLeader: this.store.isTabLeader(),
        sessionMode: this.currentSessionMode,
        metrics: this.getMetrics(),
        activeUserCount: this.getActiveUserCount(),
      };
      console.log('[Debug] Current Status:', status);
      return status;
    },
  };

  private getNavigationType(): ReferrerNavigationType {
    if (typeof performance === 'undefined') {
      return 'unknown';
    }
    try {
      const entries = performance.getEntriesByType?.('navigation');
      if (entries && entries.length > 0) {
        const nav = entries[0] as PerformanceNavigationTiming;
        if (nav && nav.type) {
          switch (nav.type) {
            case 'navigate':
              return 'navigate';
            case 'reload':
              return 'reload';
            case 'back_forward':
              return 'back_forward';
            case 'prerender':
              return 'prerender';
            default:
              return 'unknown';
          }
        }
      }
    } catch {}
    try {
      const legacy = (performance as any).navigation;
      if (legacy) {
        const type = legacy.type;
        if (type === legacy.TYPE_NAVIGATE) return 'navigate';
        if (type === legacy.TYPE_RELOAD) return 'reload';
        if (type === legacy.TYPE_BACK_FORWARD) return 'back_forward';
        if (type === 4) return 'prerender';
      }
    } catch {}
    return 'unknown';
  }

  /**
   * Check if this tab is leader
   */
  isLeader(): boolean {
    return this.store.isTabLeader();
  }
  /**
   * Get connection status
   */
  getConnectionStatus(): {
    mode: 'websocket' | 'polling' | null;
    connected: boolean;
    isLeader: boolean;
    appState: 'foreground' | 'background';
  } {
    const appState = this.store.getAppState();
    return {
      mode: this.connection.getMode(),
      connected: this.connection.isConnected(),
      isLeader: this.store.isTabLeader(),
      appState: appState === 'closed' ? 'background' : appState,
    };
  }
  /**
   * ✅ Build allowed origins for unload handler (subdomain support)
   */
  private getAllowedOrigins(): string[] {
    try {
      const apiUrlObj = new URL(this.config.apiUrl);
      const currentOrigin = window.location.origin;
      
      const origins = new Set<string>([
        currentOrigin, // Mevcut sayfa origin'i
      ]);
      
      // API URL'den origin ekle (aynı domain içinde)
      if (apiUrlObj.origin !== currentOrigin) {
        origins.add(apiUrlObj.origin);
      }
      
      // Subdomain varyasyonları ekle (www, app, vb.)
      const currentUrlObj = new URL(currentOrigin);
      const apiUrlHostname = apiUrlObj.hostname;
      const currentHostname = currentUrlObj.hostname;
      
      // Ana domain'i bul (www. olmadan)
      const mainDomain = currentHostname.replace(/^www\./, '');
      const apiMainDomain = apiUrlHostname.replace(/^www\./, '');
      
      // Eğer aynı main domain ise, hem www hem www olmayan varyasyonları ekle
      if (mainDomain === apiMainDomain) {
        origins.add(`https://${mainDomain}`);
        origins.add(`https://www.${mainDomain}`);
        origins.add(`http://${mainDomain}`);
        origins.add(`http://www.${mainDomain}`);
      }
      
      return Array.from(origins);
    } catch (error) {
      console.warn('[ActiveUsers] Error building allowed origins:', error);
      return [window.location.origin]; // Fallback
    }
  }
  
  /**
   * ✅ PHASE 2: Cleanup and disconnect
   */
  destroy(): void {
    this.logger.log('Destroying client...');
    this.stopTTLRefresh();
    this.stopMobileCleanupTimer();
    // 🆕 Clear JOIN debounce timer
    if (this.joinDebounceTimer) {
      clearTimeout(this.joinDebounceTimer);
      this.joinDebounceTimer = null;
    }
    // Cleanup PassiveActive
    this.passiveActive?.destroy();
    this.tabLeader.stop();
    this.connection.stop();
    this.store.clear();
    this.logger.log('Client destroyed');
  }
}
