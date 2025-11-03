/**
 * Hybrid Connection Manager
 * Manages WebSocket and Polling connections with automatic fallback
 */
import { WebSocketClient } from '../transport/websocket.js';
import { PollingClient } from '../transport/polling.js';
import { HttpClient } from '../transport/http.js';
import type { ClientConfig } from '../../types/Config.js';
import type { ServerMessage, ClientMessage, MetricsResponse, JoinPayload } from '../../types/Messages.js';
import type { ReferrerInfo } from '../../../referrer/types.js';
export type ConnectionMode = 'websocket' | 'polling';
export type AppState = 'foreground' | 'background';
export type SessionMode = 'active' | 'passive_active' | 'removed';

export class HybridConnectionManager {
  private config: Required<ClientConfig>;
  private customerId: string;
  private sessionId: string;
  private tabId: string;
  private wsClient: WebSocketClient;
  private pollingClient: PollingClient;
  private httpClient: HttpClient;
  private currentMode: ConnectionMode | null = null;
  private appState: AppState = 'foreground';
  private sessionMode: SessionMode = 'active';
  private appStateTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastAppStateChange = 0;
  private onMetricsUpdate: ((metrics: MetricsResponse) => void) | null = null;
  private onConnectionChange: ((mode: ConnectionMode) => void) | null = null;
  private onFallbackToPolling: (() => void | Promise<void>) | null = null; // 🆕 Callback for polling fallback
  // ✅ Flag to prevent JOIN when intentionally stopped (e.g., mobile/tablet background)
  private isIntentionallyStopped: boolean = false;
  // 🆕 Cache device info for TTL refresh in polling mode
  private cachedDeviceInfo: {
    platform?: string;
    browser?: string;
    device?: string;
    desktop_mode?: boolean;
    userAgent?: string;
  } = {};
  private cachedReferrer?: ReferrerInfo;
  constructor(
    config: Required<ClientConfig>,
    customerId: string,
    sessionId: string,
    tabId: string
  ) {
    this.config = config;
    this.customerId = customerId;
    this.sessionId = sessionId;
    this.tabId = tabId;
    this.wsClient = new WebSocketClient(config.websocketUrl);
    this.pollingClient = new PollingClient(config.apiUrl, customerId);
    this.httpClient = new HttpClient(config.apiUrl);
  }
  /**
   * Start connection based on app state
   */
  start(
    appState: AppState,
    onMetricsUpdate: (metrics: MetricsResponse) => void,
    onConnectionChange: (mode: ConnectionMode) => void,
    onFallbackToPolling?: () => void | Promise<void> // 🆕 Optional callback for polling fallback
  ): void {
    this.appState = appState;
    this.onMetricsUpdate = onMetricsUpdate;
    this.onConnectionChange = onConnectionChange;
    this.onFallbackToPolling = onFallbackToPolling || null;
    this.selectOptimalConnection();
  }
  /**
   * ✅ Connection selection based on session_mode and appState
   * 
   * LOGIC:
   * 1. passive_active → Polling (90 dakika)
   * 2. active + foreground → WebSocket
   * 3. active + background → Polling (45 saniye)
   */
  private selectOptimalConnection(): void {
    // ✅ CRITICAL: Check if intentionally stopped before selecting connection
    // This prevents JOIN from being sent when mobile/tablet goes to background
    if (this.isIntentionallyStopped) {
      console.log(`[HybridConnection] ⏭️ Intentionally stopped - skipping connection selection`);
      return;
    }
    
    // ✅ Desktop: Allow connection selection even when page is hidden (passive_active system)
    // Mobile/Tablet: Handled by isIntentionallyStopped flag (set in handleVisibilityChange)
    
    // ✅ PRIORITY 1: passive_active → Polling (90 dakika)
    if (this.sessionMode === 'passive_active') {
      const passiveInterval = this.config.pollingIntervalPassive;
      this.switchToPolling(passiveInterval);
      return;
    }
    
    // ✅ PRIORITY 2: active + foreground → WebSocket (if enabled)
    if (this.sessionMode === 'active' && this.appState === 'foreground' && this.config.enableWebSocket) {
      this.switchToWebSocket();
      return;
    }
    
    // ✅ PRIORITY 3: active + background → Polling (default)
    this.switchToPolling();
  }
  /**
   * ✅ FIXED: Switch to WebSocket mode
   * - Polling'i durdur
   * - WebSocket başlat
   */
  private switchToWebSocket(): void {
    if (this.currentMode === 'websocket') {
      return;
    }
    
    // ✅ Stop polling (if active)
    if (this.currentMode === 'polling') {
      this.pollingClient.stop();
    }
    
    // Start WebSocket
    this.wsClient.connect(
      (message) => this.handleWebSocketMessage(message),
      (connected) => this.handleWebSocketStateChange(connected)
    );
    
    this.currentMode = 'websocket';
    
    if (this.onConnectionChange) {
      this.onConnectionChange('websocket');
    }
  }
  /**
   * ✅ FIXED: Switch to Polling mode
   * - WebSocket'i TAMAMEN kapat
   * - Polling başlat (custom interval veya default)
   */
  private switchToPolling(customInterval?: number): void {
    const interval = customInterval || this.config.pollingInterval;
    
    // ✅ If already polling, just update interval if needed
    if (this.currentMode === 'polling') {
      this.pollingClient.updateInterval(interval);
      return;
    }
    
    // ✅ CRITICAL: Stop WebSocket completely (if active)
    if (this.currentMode === 'websocket') {
      this.wsClient.disconnect();
    }
    
    // ✅ IMPORTANT: Set mode IMMEDIATELY (before async polling start)
    // This ensures getMode() returns correct value right away
    this.currentMode = 'polling';
    
    // Start polling after a short delay (ensure WebSocket is fully closed)
    setTimeout(() => {
      // ✅ CRITICAL: Check isIntentionallyStopped BEFORE starting polling
      // This prevents JOIN from being sent if flag was set during delay
      if (this.isIntentionallyStopped) {
        console.log(`[HybridConnection] ⏭️ Intentionally stopped - skipping polling start and JOIN`);
        this.currentMode = null; // Set mode to null instead of polling
        return;
      }
      
      // ✅ CRITICAL: Check if page is hidden (mobile/tablet background scenario)
      // This is a safety check in case visibility change event hasn't fired yet
      const isPageHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden');
      if (isPageHidden) {
        console.log(`[HybridConnection] ⏭️ Page is hidden - skipping polling start and JOIN (mobile/tablet background?)`);
        this.currentMode = null; // Set mode to null instead of polling
        return;
      }
      
      this.pollingClient.start(interval, (metrics) => {
        if (this.onMetricsUpdate) {
          this.onMetricsUpdate(metrics);
        }
      });
      
      // 🆕 CRITICAL: WebSocket'ten polling'e geçişte JOIN gönder
      // Bu, Redis'teki session'ın güncel olduğundan emin olur
      // ✅ SKIP JOIN if intentionally stopped (e.g., mobile/tablet background)
      // ✅ CRITICAL: Double check flag here (might have been set during setTimeout delay)
      // ✅ CRITICAL: Also check page hidden state (might have changed during delay)
      if (this.onFallbackToPolling && !this.isIntentionallyStopped) {
        // ✅ CRITICAL: Final check before calling callback
        // Triple check: isIntentionallyStopped, isPageHidden, and visibility state
        const isPageHiddenNow = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden');
        
        // ✅ CRITICAL: If page is hidden, DO NOT call callback (mobile/tablet background)
        // This prevents handleWebSocketFallback() from being called even if it has checks
        if (isPageHiddenNow) {
          console.log(`[HybridConnection] ⏭️ Page is hidden - skipping JOIN callback (mobile/tablet background?)`);
          return; // Early return - don't call callback at all
        }
        
        // ✅ CRITICAL: Double check isIntentionallyStopped (might have changed during delay)
        if (this.isIntentionallyStopped) {
          console.log(`[HybridConnection] ⏭️ Intentionally stopped - skipping JOIN callback`);
          return; // Early return - don't call callback at all
        }
        
        // ✅ Only call callback if page is visible and not intentionally stopped
        console.log(`[HybridConnection] ✅ Calling onFallbackToPolling callback (page visible, not stopped)`);
        const result = this.onFallbackToPolling();
        if (result instanceof Promise) {
          result.catch(err => {
            console.error('[HybridConnection] Error sending JOIN on polling fallback:', err);
          });
        }
      }
      
      if (this.onConnectionChange) {
        this.onConnectionChange('polling');
      }
    }, 100); // 100ms delay
  }
  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'metrics:update':
        if (this.onMetricsUpdate) {
          this.onMetricsUpdate(message.data);
        }
        break;
      case 'hello':
        // Server hello received
        break;
      case 'error':
        console.error('[HybridConnection] Server error:', message.message);
        break;
      case 'pong':
        // Pong response to ping
        break;
    }
  }
  /**
   * Handle WebSocket state change
   * ✅ OPTIMIZATION: WebSocket kopunca otomatik polling fallback
   */
  private handleWebSocketStateChange(connected: boolean): void {
    if (connected) {
      // 🆕 WebSocket bağlandı, auth mesajı gönder
      const authMessage: ClientMessage = {
        type: 'auth',
        customerId: this.customerId,
        sessionId: this.sessionId,
        tabId: this.tabId,
      };
      this.wsClient.send(authMessage);
    } else if (!connected && this.currentMode === 'websocket') {
      // ✅ CRITICAL: Skip fallback if intentionally stopped (e.g., mobile/tablet background)
      // This prevents JOIN from being sent when connection.stop() is called
      if (this.isIntentionallyStopped) {
        console.log(`[HybridConnection] ❌ WebSocket disconnected but intentionally stopped - skipping fallback`);
        this.currentMode = null; // Set mode to null instead of polling
        return;
      }
      
      // ✅ Desktop: Allow fallback even when page is hidden (passive_active system)
      // Mobile/Tablet: Handled by isIntentionallyStopped flag (set in handleVisibilityChange)
      
      // WebSocket disconnected, fallback to polling
      console.log(`[HybridConnection] ❌ WebSocket disconnected, falling back to polling`);
      this.switchToPolling();
    }
  }
  /**
   * Update app state (foreground/background) - DEBOUNCED
   */
  updateAppState(newState: AppState): void {
    if (this.appState === newState) return;
    
    // ✅ CRITICAL: Skip update if intentionally stopped (e.g., mobile/tablet background)
    // This prevents selectOptimalConnection() from switching to polling and sending JOIN
    if (this.isIntentionallyStopped) {
      return;
    }
    
    // ✅ Desktop: Allow app state updates even when page is hidden (passive_active system)
    // Mobile/Tablet: Handled by isIntentionallyStopped flag (set in handleVisibilityChange)
    
    const now = Date.now();
    // ✅ DEBOUNCE: Çok sık app state change'i engelle
    if (now - this.lastAppStateChange < 1000) {
      return;
    }
    // ✅ CLEAR TIMEOUT: Önceki timeout'u temizle
    if (this.appStateTimeout) {
      clearTimeout(this.appStateTimeout);
    }
    // ✅ DELAYED CHANGE: 500ms bekle, gerçekten background mı?
    this.appStateTimeout = setTimeout(() => {
      // ✅ CRITICAL: Double check flag before selectOptimalConnection
      // Flags might have been set during setTimeout delay
      if (this.isIntentionallyStopped) {
        console.log(`[HybridConnection] ⏭️ Intentionally stopped during delay - skipping app state update`);
        return;
      }
      
      // ✅ Desktop: Allow app state update (passive_active system)
      // Mobile/Tablet: Flag check above will prevent update
      
      this.appState = newState;
      this.lastAppStateChange = Date.now();
      // Re-evaluate connection mode
      this.selectOptimalConnection();
    }, 500); // 500ms gecikme
  }
  
  /**
   * Update session mode (active / passive_active)
   */
  updateSessionMode(newMode: SessionMode): void {
    if (this.sessionMode === newMode) return;
    
    this.sessionMode = newMode;
    
    // Re-evaluate connection mode
    this.selectOptimalConnection();
  }
  
  /**
   * Send join via HTTP
   */
  async sendJoin(
    platform?: string,
    browser?: string,
    device?: string,
    userAgent?: string,
    desktop_mode?: boolean,
    total_tab_quantity?: number,
    session_mode?: SessionMode,
    referrer?: ReferrerInfo
  ): Promise<void> {
    // 🆕 Cache device info for TTL refresh
    // Only set properties that have defined values (exactOptionalPropertyTypes compliance)
    if (platform) this.cachedDeviceInfo.platform = platform;
    if (browser) this.cachedDeviceInfo.browser = browser;
    if (device) this.cachedDeviceInfo.device = device;
    if (desktop_mode !== undefined) this.cachedDeviceInfo.desktop_mode = desktop_mode;
    if (userAgent) this.cachedDeviceInfo.userAgent = userAgent;
    if (referrer) this.cachedReferrer = referrer;
    
    // Determine update-only intent on fresh page load
    let updateOnly: boolean | undefined = undefined;
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (nav && nav.type === 'reload') {
        updateOnly = true;
      }
    } catch {}
    // Same-origin referrer implies internal navigation between pages
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin) {
          updateOnly = true;
        }
      }
    } catch {}

    const payload: JoinPayload = {
      customerId: this.customerId,
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
      ...(updateOnly ? { updateOnly: true } : {}),
      platform,
      browser,
      device,
      userAgent,
      desktop_mode,
      total_tab_quantity,
      ...(session_mode && session_mode !== 'removed' && { session_mode }),
      ...(referrer ?? this.cachedReferrer ? { referrer: referrer ?? this.cachedReferrer } : {}),
    };
    await this.httpClient.join(payload);
  }
  /**
   * ✅ MOBILE: Send leave via HTTP (for mobile cleanup)
   */
  async sendLeave(): Promise<void> {
    const payload = {
      customerId: this.customerId,
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
    };
    await this.httpClient.leave(payload);
  }
  /**
   * ✅ Send TTL refresh via WebSocket or HTTP (with session_mode)
   * WebSocket mode: Send ttl_refresh message
   * Polling mode: Send JOIN request (which refreshes TTL)
   * 
   * ⚠️ IMPORTANT: Client should pass correct session_mode
   * For mobile/tablet, always pass 'active' (passive_active disabled)
   */
  async sendTTLRefresh(sessionMode: SessionMode): Promise<void> {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    if (this.currentMode === 'websocket') {
      // WebSocket mode: Send ttl_refresh message with session_mode
      console.log(`[HybridConnection] 🔄 Sending TTL refresh (WebSocket, mode: ${sessionMode})`);
      const message: ClientMessage = {
        type: 'ttl_refresh',
        customerId: this.customerId,
        sessionId: this.sessionId,
        tabId: this.tabId,
        timestamp: Date.now(),
        ...(sessionMode !== 'removed' && { session_mode: sessionMode }),
      };
      this.wsClient.send(message);
    } else {
      // Polling mode: Send JOIN request to refresh TTL
      // ✅ CRITICAL FIX: Include cached device info to preserve fields in Redis
      const payload: JoinPayload = {
        customerId: this.customerId,
        sessionId: this.sessionId,
        tabId: this.tabId,
        timestamp: Date.now(),
        ...(sessionMode !== 'removed' && { session_mode: sessionMode }),
        // 🆕 Include cached device info
        platform: this.cachedDeviceInfo.platform,
        browser: this.cachedDeviceInfo.browser,
        device: this.cachedDeviceInfo.device,
        desktop_mode: this.cachedDeviceInfo.desktop_mode,
        userAgent: this.cachedDeviceInfo.userAgent,
        // Note: Tab counts not cached, will be undefined
        // Server will keep existing tab counts from Redis
      };
      await this.httpClient.join(payload);
    }
  }
  /**
   * Get current connection mode
   */
  getMode(): ConnectionMode | null {
    return this.currentMode;
  }
  /**
   * Get connection status
   */
  isConnected(): boolean {
    if (this.currentMode === 'websocket') {
      return this.wsClient.isConnected();
    } else if (this.currentMode === 'polling') {
      return this.pollingClient.isPolling();
    }
    return false;
  }
  /**
   * Stop all connections
   * @param intentionallyStopped - If true, prevents JOIN from being sent on fallback
   */
  stop(intentionallyStopped: boolean = false): void {
    // ✅ CRITICAL: Set flag FIRST (before any disconnect operations)
    // This ensures that if WebSocket disconnect event fires synchronously,
    // handleWebSocketStateChange() will see the flag and skip fallback
    if (intentionallyStopped) {
      this.isIntentionallyStopped = true;
      console.log(`[HybridConnection] 🛑 Stop called with intentionallyStopped=true - flag set`);
    }
    
    // ✅ CRITICAL: Clear any pending timeouts that might trigger polling
    if (this.appStateTimeout) {
      clearTimeout(this.appStateTimeout);
      this.appStateTimeout = null;
    }
    
    // ✅ CRITICAL: Stop polling first (if active) to prevent any JOIN requests
    this.pollingClient.stop();
    
    // ✅ CRITICAL: Disconnect WebSocket (this may trigger handleWebSocketStateChange)
    // But flag is already set, so fallback will be skipped
    this.wsClient.disconnect();
    
    // ✅ CRITICAL: Set mode to null AFTER disconnect (prevents any state changes)
    this.currentMode = null;
  }
  
  /**
   * ✅ Reset intentionally stopped flag (used when reconnecting)
   */
  resetIntentionallyStopped(): void {
    this.isIntentionallyStopped = false;
  }

  /**
   * 🆕 Debug API: Public methods for testing
   * Manual WebSocket close - triggers polling fallback with JOIN
   */
  debugCloseWebSocket(): void {
    if (this.currentMode === 'websocket') {
      // ✅ CRITICAL: Disconnect öncesi polling'e geçiş yap (JOIN otomatik gönderilir)
      // disconnect() içinde onclose = null yapıldığı için onclose event'i tetiklenmiyor
      // Bu yüzden manuel olarak switchToPolling() çağırıyoruz
      this.switchToPolling();
      // Artık polling mode'a geçildi, WebSocket'i temizle
      this.wsClient.disconnect();
    }
  }

  debugSwitchToPolling(): void {
    this.switchToPolling();
  }

  debugSwitchToWebSocket(): void {
    if (this.appState === 'foreground' && this.sessionMode === 'active' && this.config.enableWebSocket) {
      this.switchToWebSocket();
    } else {
      console.warn('[Debug] Cannot switch to WebSocket: appState or sessionMode not suitable');
    }
  }
}
