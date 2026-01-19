import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { IncomingMessage } from 'http';
import { EventEmitter } from 'events';

// Extend WebSocket with custom properties
interface WSClient extends WebSocket {
  sessionId?: string;
  isAlive: boolean;
  clientId: string;
}

// Message types from client to server
export interface WSClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'chat' | 'continue' | 'cancel' | 'yolo' | 'ping';
  sessionId?: string;
  content?: string;
  images?: string[];
}

// Message types from server to client
export interface WSServerMessage {
  type:
    | 'connected'
    | 'subscribed'
    | 'unsubscribed'
    | 'session_init'
    | 'text_delta'
    | 'message_type_hint'
    | 'assistant_message'
    | 'system'
    | 'progress'
    | 'checkpoint'
    | 'complete'
    | 'cancelled'
    | 'error'
    | 'pong'
    | 'heartbeat'
    // Phase 7 block-level events
    | 'block_start'
    | 'block_delta'
    | 'block_end'
    | 'message_start'
    | 'message_stop';
  sessionId?: string;
  text?: string;
  messageType?: 'thinking' | 'response';
  subtype?: string;
  data?: unknown;
  checkpoint?: unknown;
  progress?: unknown;
  awaitingInput?: boolean;
  sessionStats?: unknown;
  pipeline?: unknown;
  instrumentation?: unknown;
  response?: string;
  outputDir?: string;
  error?: string;
  timestamp?: string;
  // Phase 7 block-level event fields
  blockIndex?: number;
  blockType?: string;
  toolName?: string;
  toolId?: string;
  inputJsonDelta?: string;
  toolInput?: Record<string, unknown>;
  toolDuration?: number;
}

// Events emitted by WebSocketHandler
export interface WebSocketEvents {
  chat: { clientId: string; sessionId?: string; content: string; images?: string[] };
  continue: { clientId: string; sessionId: string; content?: string };
  cancel: { clientId: string; sessionId: string };
  yolo: { clientId: string; sessionId: string };
  subscribe: { clientId: string; sessionId: string };
  unsubscribe: { clientId: string; sessionId: string };
}

/**
 * WebSocketHandler - Manages WebSocket connections for real-time bidirectional communication
 *
 * Features:
 * - Session subscription (multiple clients can watch same session)
 * - Chat message initiation
 * - Session continuation
 * - Mid-generation cancellation
 * - YOLO mode activation
 * - Heartbeat ping/pong for connection health
 */
export class WebSocketHandler extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map(); // clientId -> WSClient
  private sessionSubscribers: Map<string, Set<string>> = new Map(); // sessionId -> Set<clientId>
  private heartbeatInterval: NodeJS.Timeout;

  constructor(server: HttpServer) {
    super();

    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws as WSClient, req);
    });

    // Heartbeat every 30s to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const client = ws as WSClient;
        if (!client.isAlive) {
          console.log(`💔 WebSocket client ${client.clientId} timed out`);
          this.cleanupClient(client);
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(this.heartbeatInterval);
    });

    console.log('🔌 WebSocket server initialized on /ws');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WSClient, _req: IncomingMessage): void {
    // Assign unique client ID
    ws.clientId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    ws.isAlive = true;

    this.clients.set(ws.clientId, ws);

    console.log(`🔌 WebSocket client connected: ${ws.clientId}`);

    // Send connected message
    this.sendToClient(ws, {
      type: 'connected',
      sessionId: ws.clientId,
      timestamp: new Date().toISOString(),
    });

    // Handle pong (heartbeat response)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log(`🔌 WebSocket client disconnected: ${ws.clientId}`);
      this.cleanupClient(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${ws.clientId}:`, error.message);
      this.cleanupClient(ws);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WSClient, data: Buffer): void {
    let msg: WSClientMessage;

    try {
      msg = JSON.parse(data.toString());
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        error: 'Invalid JSON message',
      });
      return;
    }

    console.log(`📨 WebSocket message from ${ws.clientId}:`, msg.type, msg.sessionId || '');

    switch (msg.type) {
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      case 'subscribe':
        if (msg.sessionId) {
          this.subscribeToSession(ws, msg.sessionId);
        } else {
          this.sendToClient(ws, { type: 'error', error: 'sessionId required for subscribe' });
        }
        break;

      case 'unsubscribe':
        if (msg.sessionId) {
          this.unsubscribeFromSession(ws, msg.sessionId);
        }
        break;

      case 'chat':
        if (!msg.content) {
          this.sendToClient(ws, { type: 'error', error: 'content required for chat' });
          return;
        }
        this.emit('chat', {
          clientId: ws.clientId,
          sessionId: msg.sessionId,
          content: msg.content,
          images: msg.images,
        });
        break;

      case 'continue':
        if (!ws.sessionId && !msg.sessionId) {
          this.sendToClient(ws, { type: 'error', error: 'sessionId required for continue' });
          return;
        }
        this.emit('continue', {
          clientId: ws.clientId,
          sessionId: msg.sessionId || ws.sessionId!,
          content: msg.content,
        });
        break;

      case 'cancel':
        if (!ws.sessionId && !msg.sessionId) {
          this.sendToClient(ws, { type: 'error', error: 'sessionId required for cancel' });
          return;
        }
        this.emit('cancel', {
          clientId: ws.clientId,
          sessionId: msg.sessionId || ws.sessionId!,
        });
        break;

      case 'yolo':
        if (!ws.sessionId && !msg.sessionId) {
          this.sendToClient(ws, { type: 'error', error: 'sessionId required for yolo' });
          return;
        }
        this.emit('yolo', {
          clientId: ws.clientId,
          sessionId: msg.sessionId || ws.sessionId!,
        });
        break;

      default:
        this.sendToClient(ws, { type: 'error', error: `Unknown message type: ${(msg as any).type}` });
    }
  }

  /**
   * Subscribe client to session updates
   */
  private subscribeToSession(ws: WSClient, sessionId: string): void {
    // Unsubscribe from previous session if any
    if (ws.sessionId && ws.sessionId !== sessionId) {
      this.unsubscribeFromSession(ws, ws.sessionId);
    }

    ws.sessionId = sessionId;

    if (!this.sessionSubscribers.has(sessionId)) {
      this.sessionSubscribers.set(sessionId, new Set());
    }
    this.sessionSubscribers.get(sessionId)!.add(ws.clientId);

    console.log(`📡 Client ${ws.clientId} subscribed to session ${sessionId}`);

    this.sendToClient(ws, {
      type: 'subscribed',
      sessionId,
      timestamp: new Date().toISOString(),
    });

    this.emit('subscribe', { clientId: ws.clientId, sessionId });
  }

  /**
   * Unsubscribe client from session
   */
  private unsubscribeFromSession(ws: WSClient, sessionId: string): void {
    const subscribers = this.sessionSubscribers.get(sessionId);
    if (subscribers) {
      subscribers.delete(ws.clientId);
      if (subscribers.size === 0) {
        this.sessionSubscribers.delete(sessionId);
      }
    }

    if (ws.sessionId === sessionId) {
      ws.sessionId = undefined;
    }

    console.log(`📡 Client ${ws.clientId} unsubscribed from session ${sessionId}`);

    this.sendToClient(ws, {
      type: 'unsubscribed',
      sessionId,
      timestamp: new Date().toISOString(),
    });

    this.emit('unsubscribe', { clientId: ws.clientId, sessionId });
  }

  /**
   * Clean up client on disconnect
   */
  private cleanupClient(ws: WSClient): void {
    // Remove from all session subscriptions
    if (ws.sessionId) {
      const subscribers = this.sessionSubscribers.get(ws.sessionId);
      if (subscribers) {
        subscribers.delete(ws.clientId);
        if (subscribers.size === 0) {
          this.sessionSubscribers.delete(ws.sessionId);
        }
      }
    }

    this.clients.delete(ws.clientId);
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(ws: WSClient, message: WSServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all subscribers of a session
   */
  broadcastToSession(sessionId: string, message: WSServerMessage): void {
    const subscribers = this.sessionSubscribers.get(sessionId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const messageStr = JSON.stringify({ ...message, sessionId });

    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  /**
   * Send message to a specific client by ID
   */
  sendToClientById(clientId: string, message: WSServerMessage): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Get number of subscribers for a session
   */
  getSessionSubscriberCount(sessionId: string): number {
    return this.sessionSubscribers.get(sessionId)?.size || 0;
  }

  /**
   * Get all connected client IDs
   */
  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if client is connected
   */
  isClientConnected(clientId: string): boolean {
    const client = this.clients.get(clientId);
    return client?.readyState === WebSocket.OPEN;
  }

  /**
   * Auto-subscribe a client to a session (used when starting generation)
   */
  autoSubscribeClient(clientId: string, sessionId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.subscribeToSession(client, sessionId);
    }
  }

  /**
   * Close the WebSocket server
   */
  close(): void {
    clearInterval(this.heartbeatInterval);
    this.wss.close();
  }
}
