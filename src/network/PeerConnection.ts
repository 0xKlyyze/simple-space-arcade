import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import {
  NetworkMessageType,
  ConnectionStatus,
  NetworkErrorType,
  DEFAULT_NETWORK_CONFIG,
  isValidNetworkMessage,
  createBaseMessage
} from './NetworkTypes';
import type {
  NetworkMessage,
  PeerInfo,
  NetworkConfig,
  NetworkError,
  NetworkStats,
  NetworkEventHandler,
  NetworkErrorHandler,
  ConnectionStatusHandler
} from './NetworkTypes';

/**
 * PeerJS connection wrapper for peer-to-peer communication
 * Handles connection management, message routing, and error handling
 */
export class PeerConnection {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private messageHandlers: Map<NetworkMessageType, NetworkEventHandler[]> = new Map();
  private errorHandlers: NetworkErrorHandler[] = [];
  private statusHandlers: ConnectionStatusHandler[] = [];
  private config: NetworkConfig;
  private isHost: boolean = false;
  private localPeerId: string = '';
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private stats: NetworkStats;
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private messageQueue: Map<string, NetworkMessage[]> = new Map();
  private sequenceNumber: number = 0;

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = { ...DEFAULT_NETWORK_CONFIG, ...config };
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      averageLatency: 0,
      connectionUptime: 0,
      reconnectCount: 0
    };
  }

  /**
   * Initialize peer connection as host
   * @param hostId Optional custom host ID
   * @returns Promise resolving to the host peer ID
   */
  async initializeAsHost(hostId?: string): Promise<string> {
    try {
      this.isHost = true;
      this.setConnectionStatus(ConnectionStatus.CONNECTING);

      this.peer = new Peer(hostId, {
        config: {
          iceServers: this.config.iceServers
        },
        debug: 2
      });

      return new Promise((resolve, reject) => {
        if (!this.peer) {
          reject(new Error('Failed to create peer'));
          return;
        }

        this.peer.on('open', (id) => {
          this.localPeerId = id;
          this.setConnectionStatus(ConnectionStatus.CONNECTED);
          console.log('Host peer initialized with ID:', id);
          resolve(id);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (error) => {
          this.handlePeerError(error);
          reject(error);
        });

        this.peer.on('disconnected', () => {
          this.handlePeerDisconnected();
        });
      });
    } catch (error) {
      this.handleError(NetworkErrorType.CONNECTION_FAILED, 'Failed to initialize as host', error);
      throw error;
    }
  }

  /**
   * Connect to a host peer
   * @param hostId The host peer ID to connect to
   * @returns Promise resolving when connection is established
   */
  async connectToHost(hostId: string): Promise<void> {
    try {
      this.isHost = false;
      this.setConnectionStatus(ConnectionStatus.CONNECTING);

      this.peer = new Peer({
        config: {
          iceServers: this.config.iceServers
        },
        debug: 2
      });

      return new Promise((resolve, reject) => {
        if (!this.peer) {
          reject(new Error('Failed to create peer'));
          return;
        }

        this.peer.on('open', (id) => {
          this.localPeerId = id;
          console.log('Client peer initialized with ID:', id);
          
          // Connect to host
          const conn = this.peer!.connect(hostId, {
            reliable: true,
            serialization: 'json'
          });

          this.handleOutgoingConnection(conn, hostId);
          
          conn.on('open', () => {
            this.setConnectionStatus(ConnectionStatus.CONNECTED);
            resolve();
          });

          conn.on('error', (error) => {
            this.handleConnectionError(hostId, error);
            reject(error);
          });
        });

        this.peer.on('error', (error) => {
          this.handlePeerError(error);
          reject(error);
        });

        this.peer.on('disconnected', () => {
          this.handlePeerDisconnected();
        });
      });
    } catch (error) {
      this.handleError(NetworkErrorType.CONNECTION_FAILED, 'Failed to connect to host', error);
      throw error;
    }
  }

  /**
   * Send a message to a specific peer or all connected peers
   * @param message The message to send
   * @param targetPeerId Optional target peer ID (if not provided, broadcasts to all)
   */
  sendMessage(message: NetworkMessage, targetPeerId?: string): void {
    try {
      const messageWithSequence = {
        ...message,
        sequenceNumber: this.sequenceNumber++,
        senderId: this.localPeerId
      };

      if (targetPeerId) {
        this.sendToSpecificPeer(messageWithSequence, targetPeerId);
      } else {
        this.broadcastMessage(messageWithSequence);
      }

      this.stats.messagesSent++;
      this.stats.bytesTransferred += JSON.stringify(messageWithSequence).length;
    } catch (error) {
      this.handleError(NetworkErrorType.MESSAGE_SEND_FAILED, 'Failed to send message', error);
    }
  }

  /**
   * Add a message handler for a specific message type
   * @param messageType The message type to handle
   * @param handler The handler function
   */
  onMessage<T extends NetworkMessage>(messageType: NetworkMessageType, handler: NetworkEventHandler<T>): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler as NetworkEventHandler);
  }

  /**
   * Add an error handler
   * @param handler The error handler function
   */
  onError(handler: NetworkErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Add a connection status handler
   * @param handler The status handler function
   */
  onStatusChange(handler: ConnectionStatusHandler): void {
    this.statusHandlers.push(handler);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get connected peers information
   */
  getConnectedPeers(): PeerInfo[] {
    const peers: PeerInfo[] = [];
    
    this.connections.forEach((conn, peerId) => {
      peers.push({
        id: peerId,
        name: peerId, // TODO: Get actual player name from game state
        isHost: this.isHost && peerId === this.localPeerId,
        connectionStatus: conn.open ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED,
        lastSeen: Date.now()
      });
    });

    return peers;
  }

  /**
   * Get network statistics
   */
  getStats(): NetworkStats {
    return { ...this.stats };
  }

  /**
   * Disconnect from all peers and cleanup
   */
  disconnect(): void {
    try {
      // Clear ping intervals
      this.pingIntervals.forEach(interval => clearInterval(interval));
      this.pingIntervals.clear();

      // Close all connections
      this.connections.forEach(conn => {
        if (conn.open) {
          conn.close();
        }
      });
      this.connections.clear();

      // Destroy peer
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }

      this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
      this.localPeerId = '';
      this.messageQueue.clear();
      this.reconnectAttempts.clear();
    } catch (error) {
      this.handleError(NetworkErrorType.CONNECTION_LOST, 'Error during disconnect', error);
    }
  }

  /**
   * Get local peer ID
   */
  getLocalPeerId(): string {
    return this.localPeerId;
  }

  /**
   * Check if this peer is the host
   */
  isHostPeer(): boolean {
    return this.isHost;
  }

  // Private methods

  private handleIncomingConnection(conn: DataConnection): void {
    console.log('Incoming connection from:', conn.peer);
    this.setupConnection(conn);
  }

  private handleOutgoingConnection(conn: DataConnection, peerId: string): void {
    console.log('Outgoing connection to:', peerId);
    this.setupConnection(conn);
  }

  private setupConnection(conn: DataConnection): void {
    this.connections.set(conn.peer, conn);
    this.messageQueue.set(conn.peer, []);
    this.reconnectAttempts.set(conn.peer, 0);

    conn.on('data', (data) => {
      this.handleReceivedMessage(data, conn.peer);
    });

    conn.on('close', () => {
      this.handleConnectionClosed(conn.peer);
    });

    conn.on('error', (error) => {
      this.handleConnectionError(conn.peer, error);
    });

    // Start ping interval for this connection
    this.startPingInterval(conn.peer);

    // Send connection established message if host
    if (this.isHost) {
      const message = createBaseMessage(NetworkMessageType.CONNECTION_ESTABLISHED, this.localPeerId);
      this.sendToSpecificPeer({
        ...message,
        type: NetworkMessageType.CONNECTION_ESTABLISHED,
        hostId: this.localPeerId,
        clientId: conn.peer,
        gameSettings: {
          maxPlayers: 2, // TODO: Get from game settings
          gameMode: 'deathmatch'
        }
      }, conn.peer);
    }
  }

  private handleReceivedMessage(data: any, senderId: string): void {
    try {
      if (!isValidNetworkMessage(data)) {
        this.handleError(NetworkErrorType.INVALID_MESSAGE, 'Received invalid message format');
        return;
      }

      const message = data as NetworkMessage;
      this.stats.messagesReceived++;
      this.stats.bytesTransferred += JSON.stringify(message).length;

      // Handle ping/pong messages internally
      if (message.type === NetworkMessageType.PING) {
        this.sendPong(senderId, message.timestamp);
        return;
      }

      if (message.type === NetworkMessageType.PONG) {
        this.handlePong(message as any);
        return;
      }

      // Dispatch message to handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('Error in message handler:', error);
          }
        });
      }
    } catch (error) {
      this.handleError(NetworkErrorType.INVALID_MESSAGE, 'Error processing received message', error);
    }
  }

  private sendToSpecificPeer(message: NetworkMessage, peerId: string): void {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
    } else {
      // Queue message for later delivery
      const queue = this.messageQueue.get(peerId) || [];
      if (queue.length < this.config.maxMessageQueueSize) {
        queue.push(message);
        this.messageQueue.set(peerId, queue);
      }
    }
  }

  private broadcastMessage(message: NetworkMessage): void {
    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  private startPingInterval(peerId: string): void {
    const interval = setInterval(() => {
      this.sendPing(peerId);
    }, this.config.pingInterval);
    
    this.pingIntervals.set(peerId, interval);
  }

  private sendPing(peerId: string): void {
    const message = createBaseMessage(NetworkMessageType.PING, this.localPeerId);
    this.sendToSpecificPeer(message, peerId);
  }

  private sendPong(peerId: string, originalTimestamp: number): void {
    const message = {
      ...createBaseMessage(NetworkMessageType.PONG, this.localPeerId),
      type: NetworkMessageType.PONG,
      originalTimestamp
    };
    this.sendToSpecificPeer(message, peerId);
  }

  private handlePong(message: any): void {
    const latency = Date.now() - message.originalTimestamp;
    // Update average latency calculation
    this.stats.averageLatency = (this.stats.averageLatency + latency) / 2;
  }

  private handleConnectionClosed(peerId: string): void {
    console.log('Connection closed with peer:', peerId);
    this.cleanupPeerConnection(peerId);
    
    // Attempt reconnection if not intentional disconnect
    if (this.connectionStatus === ConnectionStatus.CONNECTED) {
      this.attemptReconnection(peerId);
    }
  }

  private handleConnectionError(peerId: string, error: any): void {
    console.error('Connection error with peer:', peerId, error);
    this.handleError(NetworkErrorType.CONNECTION_LOST, `Connection error with peer ${peerId}`, error);
    this.cleanupPeerConnection(peerId);
  }

  private handlePeerError(error: any): void {
    console.error('Peer error:', error);
    this.handleError(NetworkErrorType.WEBRTC_ERROR, 'Peer connection error', error);
    this.setConnectionStatus(ConnectionStatus.ERROR);
  }

  private handlePeerDisconnected(): void {
    console.log('Peer disconnected');
    this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    
    // Attempt to reconnect
    if (this.peer && !this.peer.destroyed) {
      this.peer.reconnect();
      this.setConnectionStatus(ConnectionStatus.RECONNECTING);
    }
  }

  private cleanupPeerConnection(peerId: string): void {
    // Clear ping interval
    const interval = this.pingIntervals.get(peerId);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(peerId);
    }

    // Remove connection
    this.connections.delete(peerId);
    this.messageQueue.delete(peerId);
  }

  private attemptReconnection(peerId: string): void {
    const attempts = this.reconnectAttempts.get(peerId) || 0;
    
    if (attempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts.set(peerId, attempts + 1);
      this.stats.reconnectCount++;
      
      setTimeout(() => {
        if (this.peer && !this.peer.destroyed) {
          console.log(`Attempting to reconnect to ${peerId} (attempt ${attempts + 1})`);
          const conn = this.peer.connect(peerId);
          this.handleOutgoingConnection(conn, peerId);
        }
      }, this.config.reconnectDelay * (attempts + 1));
    } else {
      console.log(`Max reconnection attempts reached for peer ${peerId}`);
      this.handleError(NetworkErrorType.CONNECTION_FAILED, `Failed to reconnect to peer ${peerId}`);
    }
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.statusHandlers.forEach(handler => {
        try {
          handler(status);
        } catch (error) {
          console.error('Error in status handler:', error);
        }
      });
    }
  }

  private handleError(type: NetworkErrorType, message: string, details?: any): void {
    const error: NetworkError = {
      type,
      message,
      details,
      timestamp: Date.now()
    };

    this.stats.lastError = error;
    console.error('Network error:', error);

    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }
}