/**
 * Hybrid Connection Manager
 * Manages WebSocket and Polling connections with automatic fallback
 */
import { WebSocketClient } from '../transport/websocket.js';
import { PollingClient } from '../transport/polling.js';
import { HttpClient } from '../transport/http.js';
import type { ClientConfig } from '../../types/Config.js';
import type { ServerMessage, ClientMessage, MetricsResponse, JoinPayload } from '../../types/Messages.js';
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
  private appStateTimeout: NodeJS.Timeout | null = null;
  private lastAppStateChange = 0;
  private onMetricsUpdate: ((metrics: MetricsResponse) => void) | null = null;
  private onConnectionChange: ((mode: ConnectionMode) => void) | null = null;
  // 🆕 Cache device info for TTL refresh in polling mode
  private cachedDeviceInfo: {
    platform?: string;
    browser?: string;
    device?: string;
    desktop_mode?: boolean;
    userAgent?: string;
  } = {};
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
    onConnectionChange: (mode: ConnectionMode) => void
  ): void {
    this.appState = appState;
    this.onMetricsUpdate = onMetricsUpdate;
    this.onConnectionChange = onConnectionChange;
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
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    console.log(`[HybridConnection] Selecting connection | SessionMode: ${this.sessionMode} | AppState: ${this.appState} | WebSocket enabled: ${this.config.enableWebSocket}`);
    
    // ✅ PRIORITY 1: passive_active → Polling (90 dakika)
    if (this.sessionMode === 'passive_active') {
      const passiveInterval = this.config.pollingIntervalPassive;
      console.log(`[HybridConnection] → Polling (passive_active mode, ${passiveInterval}ms interval)`);
      this.switchToPolling(passiveInterval);
      return;
    }
    
    // ✅ PRIORITY 2: active + foreground → WebSocket (if enabled)
    if (this.sessionMode === 'active' && this.appState === 'foreground' && this.config.enableWebSocket) {
      console.log(`[HybridConnection] → WebSocket (active + foreground)`);
      this.switchToWebSocket();
      return;
    }
    
    // ✅ PRIORITY 3: active + background → Polling (default)
    console.log(`[HybridConnection] → Polling (active + background OR WebSocket disabled)`);
    this.switchToPolling();
  }
  /**
   * ✅ FIXED: Switch to WebSocket mode
   * - Polling'i durdur
   * - WebSocket başlat
   */
  private switchToWebSocket(): void {
    if (this.currentMode === 'websocket') {
      console.log(`[HybridConnection] Already in WebSocket mode, skipping`);
      return;
    }
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    console.log(`[HybridConnection] 🔄 Switching to WebSocket mode`);
    
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
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    console.log(`[HybridConnection] 🔄 Switching to Polling mode (${interval}ms interval)`);
    
    // ✅ If already polling, just update interval if needed
    if (this.currentMode === 'polling') {
      console.log(`[HybridConnection] Already in polling mode, updating interval to ${interval}ms`);
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
      
      this.pollingClient.start(interval, (metrics) => {
        if (this.onMetricsUpdate) {
          this.onMetricsUpdate(metrics);
        }
      });
      
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
      console.log(`[HybridConnection] 🔐 Sending WebSocket auth message`);
      const authMessage: ClientMessage = {
        type: 'auth',
        customerId: this.customerId,
        sessionId: this.sessionId,
        tabId: this.tabId,
      };
      this.wsClient.send(authMessage);
    } else if (!connected && this.currentMode === 'websocket') {
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
    total_backgroundTab_quantity?: number,
    session_mode?: SessionMode
  ): Promise<void> {
    // 🆕 Cache device info for TTL refresh
    // Only set properties that have defined values (exactOptionalPropertyTypes compliance)
    if (platform) this.cachedDeviceInfo.platform = platform;
    if (browser) this.cachedDeviceInfo.browser = browser;
    if (device) this.cachedDeviceInfo.device = device;
    if (desktop_mode !== undefined) this.cachedDeviceInfo.desktop_mode = desktop_mode;
    if (userAgent) this.cachedDeviceInfo.userAgent = userAgent;
    
    const payload: JoinPayload = {
      customerId: this.customerId,
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
      platform,
      browser,
      device,
      userAgent,
      desktop_mode,
      total_tab_quantity,
      total_backgroundTab_quantity,
      ...(session_mode && session_mode !== 'removed' && { session_mode }),
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
   */
  stop(): void {
    this.wsClient.disconnect();
    this.pollingClient.stop();
    this.currentMode = null;
  }
}
