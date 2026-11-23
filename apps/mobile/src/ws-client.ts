/**
 * WebSocket client for SilentCall mobile app
 * Handles authentication, room joining, message sending, and event receiving
 */

import { WSMessage } from "@silentcall/shared";

export interface WSClientConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number;
  private reconnectDelay: number;
  private currentReconnectAttempt: number = 0;
  private messageHandlers: Map<string, (payload: any) => void> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private isAuthenticated: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: WSClientConfig) {
    this.url = config.url;
    this.reconnectAttempts = config.reconnectAttempts || 5;
    this.reconnectDelay = config.reconnectDelay || 3000;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("[WSClient] Connected");
          this.currentReconnectAttempt = 0;
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const msg: WSMessage = JSON.parse(event.data);
            this._handleMessage(msg);
          } catch (err) {
            console.error("[WSClient] Error parsing message:", err);
          }
        };

        this.ws.onerror = (event: Event) => {
          console.error("[WSClient] Error:", event);
          reject(new Error("WebSocket connection failed"));
        };

        this.ws.onclose = () => {
          console.log("[WSClient] Disconnected");
          this.ws = null;
          if (this.isAuthenticated) {
            this._attemptReconnect();
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send a message to server
   */
  send(type: string, payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WSClient] Not connected, cannot send message");
      return;
    }

    const msg: WSMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(msg));
  }

  /**
   * Register event handler (one-time)
   */
  on(eventType: string, handler: (payload: any) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(handler);
  }

  /**
   * Unregister event handler
   */
  off(eventType: string, handler: Function): void {
    const handlers = this.eventListeners.get(eventType);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  /**
   * Authenticate with token
   */
  authenticate(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = (payload: any) => {
        if (payload.userId) {
          this.isAuthenticated = true;
          this.off("auth:ready", handler);
          resolve();
        }
      };

      const errorHandler = (payload: any) => {
        this.off("error", errorHandler);
        reject(new Error(payload.message));
      };

      this.on("auth:ready", handler);
      this.on("error", errorHandler);

      this.send("auth:init", { token });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error("Auth timeout"));
      }, 10000);
    });
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.isAuthenticated = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Is connected?
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Is authenticated?
   */
  getAuthStatus(): boolean {
    return this.isAuthenticated;
  }

  /**
   * =========================================================================
   // PRIVATE METHODS
   ========================================================================= */

  private _handleMessage(msg: WSMessage): void {
    // Emit to all registered listeners for this event type
    const handlers = this.eventListeners.get(msg.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(msg.payload);
        } catch (err) {
          console.error(`[WSClient] Error in handler for ${msg.type}:`, err);
        }
      });
    }

    // Also emit to generic "message" listeners
    const generalHandlers = this.eventListeners.get("message");
    if (generalHandlers) {
      generalHandlers.forEach((handler) => {
        try {
          handler(msg);
        } catch (err) {
          console.error("[WSClient] Error in general message handler:", err);
        }
      });
    }
  }

  private _attemptReconnect(): void {
    if (this.currentReconnectAttempt >= this.reconnectAttempts) {
      console.log("[WSClient] Max reconnection attempts reached");
      return;
    }

    this.currentReconnectAttempt++;
    console.log(
      `[WSClient] Reconnecting... (attempt ${this.currentReconnectAttempt}/${this.reconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect()
        .then(() => {
          console.log("[WSClient] Reconnected successfully");
          // Re-authenticate would happen at app level
        })
        .catch((err) => {
          console.error("[WSClient] Reconnection failed:", err);
          this._attemptReconnect();
        });
    }, this.reconnectDelay);
  }
}
