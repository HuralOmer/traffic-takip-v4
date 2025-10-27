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
  private ttlRefreshTimer: NodeJS.Timeout | null = null;
  // ✅ Mobile cleanup timer (for aggressive cleanup on mobile/tablet background)
  private mobileCleanupTimer: NodeJS.Timeout | null = null;
  // 🆕 JOIN debouncing (prevent duplicate requests)
  private pendingJoin: boolean = false;
  private joinDebounceTimer: NodeJS.Timeout | null = null;
  // 🆕 Passive Active Manager (Desktop only)
  private passiveActive: PassiveActiveManager | null = null;
  private currentSessionMode: SessionMode = 'active';
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
    this.unload = new UnloadHandler(
      this.config.customerId,
      this.session.getSessionId(),
      this.session.getTabId(),
      this.config.apiUrl
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
    
    // Initialize Passive Active Manager (Desktop only)
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
        
        // ✅ CRITICAL: Determine correct session_mode BEFORE sending JOIN
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
    
    this.logger.log('Client initialized', {
      customerId: this.config.customerId,
      sessionId: this.session.getSessionId(),
      tabId: this.session.getTabId(),
    });
  }
  /**
   * Handle session mode change (active ↔ passive_active)
   */
  private async handleSessionModeChange(newMode: SessionMode): Promise<void> {
    if (newMode === 'removed') return; // Ignore removed state
    
    const oldMode = this.currentSessionMode;
    
    // No change? Skip
    if (oldMode === newMode) {
      return;
    }
    
    this.currentSessionMode = newMode;
    
    // ✅ CRITICAL: Update Redis with new session_mode via JOIN
    await this.sendJoin();
    
    // Update connection mode (will switch to appropriate polling interval)
    this.connection.updateSessionMode(newMode);
    
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
      const isMobileOrTablet = this.platformDetector.isMobileOrTablet();
      
      if (isMobileOrTablet) {
        
        // ✅ Connection durumunu kontrol et
        const isConnected = this.connection.isConnected();
        
        // ✅ JOIN gönder
        await this.sendJoin();
        
        // ✅ Connection'ı restart et (stop edilmişse)
        if (!isConnected) {
          this.connection.start(
            'foreground',
            (metrics) => this.handleMetricsUpdate(metrics),
            (mode) => {
              this.store.setConnectionMode(mode);
              this.currentStatus.connection = mode;
            }
          );
        }
        
        // ✅ Leader election trigger et
        if (this.store.isTabLeader()) {
          this.startTTLRefresh();
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
      }
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
    // ✅ DEBOUNCE: 500ms bekle, gerçek mi yoksa geçici mi?
    setTimeout(() => {
      // Tekrar kontrol et, kullanıcı geri dönmüş olabilir
      const currentState = this.visibility.getState();
      this.store.setAppState(currentState);
      
      const isMobileOrTablet = this.platformDetector.isMobileOrTablet();
      const isLeader = this.store.isTabLeader();
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      // Update tab state (for tab counting)
      this.tabLeader.updateMyTabState(currentState);
      
      // Update connection app state
      this.connection.updateAppState(currentState);
      
      // ✅ MOBILE/TABLET: Aggressive cleanup on background
      if (isMobileOrTablet) {
        if (currentState === 'background') {
          this.startMobileCleanupTimer();
        } else {
          this.stopMobileCleanupTimer();
        }
      } else {
        // ✅ DESKTOP: Passive Active tracking
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
    
    // Select interval based on session mode
    const interval = this.currentSessionMode === 'passive_active' 
      ? this.config.ttlRefreshIntervalPassive 
      : this.config.ttlRefreshInterval;
    
    this.ttlRefreshTimer = setInterval(() => {
      // 🆕 CRITICAL: Only send TTL refresh if in WebSocket mode!
      // In polling mode, polling itself handles TTL refresh via JOIN requests
      if (this.connection.getMode() !== 'websocket') {
        return;
      }
      
      this.connection.sendTTLRefresh(this.currentSessionMode);
      this.statusLogger.logTTLRefresh(
        this.session.getSessionId(), 
        this.session.getTabId(), 
        interval
      );
    }, interval);
    
    const intervalMinutes = Math.floor(interval / 60000);
    this.statusLogger.logEvent('✅', `TTL refresh started (${intervalMinutes}min - ${this.currentSessionMode})`, 'success');
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
   * Send join notification
   * 🆕 Tab counts eklendi
   * 🆕 Debounced to prevent duplicate requests
   */
  private async sendJoin(): Promise<void> {
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
    const total_backgroundTab_quantity = tabCounts.background;
    
    this.session.refreshSession();
    try {
      await this.connection.sendJoin(
        platform,
        browser,
        device,
        userAgent,
        desktop_mode,
        total_tab_quantity,
        total_backgroundTab_quantity,
        this.currentSessionMode
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
      this.logger.log('Metrics updated:', smoothedMetrics);
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
