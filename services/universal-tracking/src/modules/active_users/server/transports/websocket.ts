/**
 * WebSocket Server
 * Handles WebSocket connections for real-time metrics
 */
import type { WebSocketServer as WSServer } from 'ws';
import { BroadcastService } from '../services/broadcast.service.js';
import { PresenceService } from '../services/presence.service.js';
import { getCurrentTimestamp } from '../utils/timestamp.js';
import type { ClientMessage, ServerMessage } from '../../types/Messages.js';
interface ClientInfo {
  customerId: string;
  sessionId?: string;
  tabId?: string;
  device?: string; // 🆕 mobile, tablet, desktop
  platform?: string; // 🆕 ios, android, windows, etc.
}
export class WebSocketServer {
  private wss: WSServer;
  private broadcast: BroadcastService;
  private presence: PresenceService;
  private clientCustomerMap: WeakMap<any, string> = new WeakMap();
  private clientInfoMap: WeakMap<any, ClientInfo> = new WeakMap(); // 🆕 Session tracking
  private activeCustomers: Map<string, Set<any>> = new Map(); // 🆕 Track active connections per customer
  constructor(wss: WSServer, broadcastService: BroadcastService, presenceService: PresenceService) {
    this.wss = wss;
    this.broadcast = broadcastService;
    this.presence = presenceService;
    this.setupServer();
  }
  private setupServer(): void {
    this.wss.on('connection', (ws: any) => {
      console.log('[WebSocket] 🔌 New connection established');
      let customerId: string | null = null;
      let missedPongCount = 0;
      // ✅ PHASE 1: Server-side ping mechanism (25s interval)
      const pingInterval = setInterval(() => {
        if (ws.readyState === 1) { // OPEN state
          const timestamp = getCurrentTimestamp();
          console.log(`[WebSocket] 📤 PING sent to ${customerId || 'unauthorized'}`);
          ws.ping(); // Native WebSocket ping
        }
      }, 25000); // 25 seconds
      // ✅ PHASE 1: Pong handler (track missed pongs)
      ws.on('pong', () => {
        const timestamp = getCurrentTimestamp();
        console.log(`[WebSocket] 📥 PONG received from ${customerId || 'unauthorized'}`);
        missedPongCount = 0;
      });
      // ✅ PHASE 1: Check for missed pongs (every 30s)
      const pongCheckInterval = setInterval(() => {
        missedPongCount++;
        if (missedPongCount >= 2) {
                    clearInterval(pingInterval);
          clearInterval(pongCheckInterval);
          ws.close();
        }
      }, 30000); // Check every 30s (25s ping + 5s grace period)
      // Handle incoming messages
      ws.on('message', async (data: any) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          switch (message.type) {
            case 'auth':
              // Authenticate and register client
              customerId = message.customerId;
              console.log(`[WebSocket] 🔐 Auth received from ${message.sessionId?.substring(0, 8)} (customer: ${customerId})`);
              this.clientCustomerMap.set(ws, customerId);
              // 🆕 CRITICAL: Get device/platform info from Redis
              // This is needed for platform-aware disconnect handling
              const presenceData = await this.presence.getPresence(message.customerId, message.sessionId);
              // 🆕 Store session, tab, and device info
              const clientInfo: ClientInfo = {
                customerId: message.customerId,
                sessionId: message.sessionId,
                tabId: message.tabId,
                device: presenceData?.device || 'unknown', // mobile, tablet, desktop
                platform: presenceData?.platform || 'unknown', // ios, android, windows, etc.
              };
              this.clientInfoMap.set(ws, clientInfo);
              // 🆕 CRITICAL: Cancel any pending disconnect timer for this session
              // Kullanıcı tab switcher'dan geri döndü!
              this.presence.cancelDisconnectTimer(message.customerId, message.sessionId);
              // 🆕 Track active connection
              if (!this.activeCustomers.has(customerId)) {
                this.activeCustomers.set(customerId, new Set());
              }
              this.activeCustomers.get(customerId)!.add(ws);
              this.broadcast.registerClient(customerId, ws);
              // Send hello
              const hello: ServerMessage = {
                type: 'hello',
                timestamp: Date.now(),
                sessionId: message.sessionId,
              };
              ws.send(JSON.stringify(hello));
              break;
            case 'ping':
              // Respond with pong
              const pong: ServerMessage = {
                type: 'pong',
                timestamp: Date.now(),
              };
              ws.send(JSON.stringify(pong));
              break;
            case 'ttl_refresh':
              // ✅ Handle TTL refresh with session_mode
              if (customerId) {
                console.log(`[WebSocket] 🔄 TTL refresh from ${message.sessionId?.substring(0, 8)} (mode: ${message.session_mode})`);
                await this.presence.refreshTTL(
                  message.customerId,
                  message.sessionId,
                  message.tabId,
                  message.session_mode
                );
              }
              break;
          }
        } catch (error) {
          console.error('[WebSocket] Message handling error:', error);
          const errorMessage: ServerMessage = {
            type: 'error',
            message: 'Invalid message format',
          };
          ws.send(JSON.stringify(errorMessage));
        }
      });
      // Handle disconnection
      ws.on('close', () => {
        // ✅ PHASE 1: Clean up intervals
        clearInterval(pingInterval);
        clearInterval(pongCheckInterval);
        if (customerId) {
          // 🆕 Remove from active connections
          const customerConnections = this.activeCustomers.get(customerId);
          if (customerConnections) {
            customerConnections.delete(ws);
            if (customerConnections.size === 0) {
              this.activeCustomers.delete(customerId);
            }
          }
          this.broadcast.unregisterClient(customerId, ws);
          // 🆕 Get client info before cleanup
          const clientInfo = this.clientInfoMap.get(ws);
          // 🆕 CRITICAL FIX: Remove specific session from Redis when WebSocket disconnects
          // This handles mobile tab switcher where X button doesn't fire leave events
          if (clientInfo?.sessionId) {
            this.handleWebSocketDisconnect(customerId, clientInfo.sessionId, clientInfo.device);
          }
        }
      });
      // Handle errors
      ws.on('error', (error: any) => {
        console.error('[WebSocket] Error:', error);
      });
    });
  }
  /**
   * Get server instance
   */
  getServer(): WSServer {
    return this.wss;
  }
  /**
   * 🆕 Handle WebSocket disconnect - remove specific session from Redis
   * ⚠️ PLATFORM-AWARE: Only for mobile/tablet! Desktop uses TTL expiry.
   * ⚠️ Grace period (500ms) + Wait 10 seconds to avoid false positives
   */
  private async handleWebSocketDisconnect(customerId: string, sessionId: string, device?: string): Promise<void> {
    try {
      // 🆕 CRITICAL: Desktop → Skip aggressive cleanup!
      // Desktop users often switch tabs or apps, but should stay in Redis
      // TTL (30s) will handle cleanup naturally
      if (device === 'desktop') {
        return; // Desktop: Let TTL handle cleanup
      }
      // 📱 Mobile/Tablet: Aggressive cleanup (10s timer)
            // 🆕 CRITICAL: 500ms grace period - JOIN request olabilir!
      // Sayfa navigation, tab duplicate gibi durumlarda JOIN gelebilir
      await new Promise(resolve => setTimeout(resolve, 500));
      // Grace period sonrası kontrol: Timer iptal edilmiş mi?
      const sessionKey = `${customerId}:${sessionId}`;
      // Eğer bu süre içinde JOIN geldi ve timer iptal edildiyse, burada durmalıyız
      // Ama henüz timer başlatılmadı, o yüzden devam edebiliriz
            // ✅ Wait 10 seconds before cleanup to avoid false positives
      // Mobilde tab switcher açılınca da disconnect oluyor, ama hemen kapanmıyor
      // X'e basınca gerçekten kapanıyor, 10 saniye reconnect yok
      const timer = setTimeout(async () => {
        try {
          // 🆕 CRITICAL FIRST: Remove timer from map IMMEDIATELY (silent mode)
          this.presence.cancelDisconnectTimer(customerId, sessionId, true);
                    // 🆕 SIMPLE & RELIABLE: Redis'ten key TTL'ini kontrol et
          // Eğer kullanıcı geri döndüyse, JOIN request gelmiş ve TTL 30s'ye set edilmiştir
          const keyTTL = await this.presence.getKeyTTL(customerId, sessionId);
                    if (keyTTL === -2) {
            // Key yok, zaten silinmiş
                        return;
          }
          if (keyTTL > 15) {
            // TTL > 15s = Kullanıcı aktif (yakın zamanda JOIN geldi)
            return;
          }
          // TTL < 15s veya -1 (TTL yok) = Kullanıcı inactive
          // Remove this specific session
          await this.presence.removePresence(customerId, sessionId);
                  } catch (error) {
          console.error(`[WebSocket] Error during delayed disconnect cleanup for ${sessionId}:`, error);
        }
      }, 10000); // 10 second delay (tab switcher için yeterli süre)
      // 🆕 Store timer in PresenceService (shared between WebSocket and REST endpoints)
      this.presence.setDisconnectTimer(customerId, sessionId, timer);
          } catch (error) {
      console.error(`[WebSocket] Error during disconnect cleanup for ${sessionId}:`, error);
    }
  }
  /**
   * Close all connections
   */
  close(): void {
    this.wss.close();
  }
}
