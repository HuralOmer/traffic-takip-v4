/**
 * WebSocket Client
 * Handles WebSocket connection with auto-reconnect
 */
import type { ClientMessage, ServerMessage } from '../../types/Messages.js';
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isIntentionallyClosed: boolean = false;
  private onMessage: ((message: ServerMessage) => void) | null = null;
  private onStateChange: ((connected: boolean) => void) | null = null;
  constructor(url: string) {
    this.url = url;
  }
  connect(
    onMessage: (message: ServerMessage) => void,
    onStateChange: (connected: boolean) => void
  ): void {
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
    this.isIntentionallyClosed = false;
    this.createConnection();
  }
  private createConnection(): void {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        // ✅ Duplicate log kaldırıldı (parent StatusLogger kullanacak)
        if (this.onStateChange) {
          this.onStateChange(true);
        }
      };
      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          if (this.onMessage) {
            this.onMessage(message);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        // ✅ Duplicate log kaldırıldı
        if (this.onStateChange) {
          this.onStateChange(false);
        }
        // Auto-reconnect if not intentionally closed
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
      this.ws.onerror = (error) => {
        console.error(`[WebSocket] Connection error to ${this.url}:`, error);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      this.scheduleReconnect();
    }
  }
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimeout = setTimeout(() => {
      this.createConnection();
    }, delay);
  }
  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send, not connected');
    }
  }
  disconnect(): void {
    this.isIntentionallyClosed = true; // Set flag FIRST
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      // Remove all event listeners before closing
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      
      this.ws.close();
      this.ws = null;
    }
  }
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}
