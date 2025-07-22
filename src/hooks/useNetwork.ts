import { useState, useEffect, useCallback, useRef } from 'react';
import { PeerConnection } from '../network/PeerConnection';
import { GameSync } from '../network/GameSync';
import {
  ConnectionStatus,
  NetworkMessageType
} from '../network/NetworkTypes';
import type {
  NetworkMessage,
  PeerInfo,
  NetworkError,
  NetworkStats,
  PlayerInputMessage,
  GameEventMessage
} from '../network/NetworkTypes';
import { GameState } from '../game/core/GameState';

/**
 * Network hook interface
 */
export interface NetworkHookReturn {
  // Connection management
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  localPeerId: string;
  connectedPeers: PeerInfo[];
  networkStats: NetworkStats;
  
  // Connection methods
  initializeAsHost: (hostId?: string) => Promise<string>;
  connectToHost: (hostId: string) => Promise<void>;
  disconnect: () => void;
  
  // Game synchronization
  startGameSync: () => void;
  stopGameSync: () => void;
  sendPlayerInput: (playerId: number, input: PlayerInputMessage['input']) => void;
  sendGameEvent: (event: GameEventMessage['event']) => void;
  requestSync: () => void;
  
  // Event handlers
  onNetworkMessage: (messageType: NetworkMessageType, handler: (message: NetworkMessage) => void) => void;
  onNetworkError: (handler: (error: NetworkError) => void) => void;
  onConnectionStatusChange: (handler: (status: ConnectionStatus, peerId?: string) => void) => void;
  
  // Utility methods
  isConnected: boolean;
  canStartGame: boolean;
  lastError: NetworkError | null;
}

/**
 * Network hook options
 */
export interface NetworkHookOptions {
  gameState?: GameState;
  autoReconnect?: boolean;
  enablePrediction?: boolean;
  enableInterpolation?: boolean;
  syncRate?: number;
}

/**
 * React hook for managing network connections and game synchronization
 * Provides a React-friendly interface for peer-to-peer networking
 */
export const useNetwork = (options: NetworkHookOptions = {}): NetworkHookReturn => {
  const {
    gameState,
    autoReconnect = true,
    enablePrediction = true,
    enableInterpolation = true,
    syncRate = 20
  } = options;

  // State management
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [localPeerId, setLocalPeerId] = useState<string>('');
  const [connectedPeers, setConnectedPeers] = useState<PeerInfo[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransferred: 0,
    averageLatency: 0,
    connectionUptime: 0,
    reconnectCount: 0
  });
  const [lastError, setLastError] = useState<NetworkError | null>(null);
  const [isGameSyncActive, setIsGameSyncActive] = useState<boolean>(false);

  // Refs for persistent objects
  const peerConnectionRef = useRef<PeerConnection | null>(null);
  const gameSyncRef = useRef<GameSync | null>(null);
  const messageHandlersRef = useRef<Map<NetworkMessageType, ((message: NetworkMessage) => void)[]>>(new Map());
  const errorHandlersRef = useRef<((error: NetworkError) => void)[]>([]);
  const statusHandlersRef = useRef<((status: ConnectionStatus, peerId?: string) => void)[]>([]);
  const statsUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new PeerConnection({
      maxReconnectAttempts: autoReconnect ? 5 : 0,
      reconnectDelay: 2000,
      pingInterval: 5000,
      timeoutDuration: 10000,
      maxMessageQueueSize: 100
    });

    // Set up connection status handler
    peerConnection.onStatusChange((status, peerId) => {
      setConnectionStatus(status);
      setLocalPeerId(peerConnection.getLocalPeerId());
      setIsHost(peerConnection.isHostPeer());
      setConnectedPeers(peerConnection.getConnectedPeers());
      
      // Notify external handlers
      statusHandlersRef.current.forEach(handler => {
        try {
          handler(status, peerId);
        } catch (error) {
          console.error('Error in status handler:', error);
        }
      });

      // Handle reconnection logic
      if (status === ConnectionStatus.DISCONNECTED && autoReconnect) {
        handleAutoReconnect();
      }
    });

    // Set up error handler
    peerConnection.onError((error) => {
      setLastError(error);
      
      // Notify external handlers
      errorHandlersRef.current.forEach(handler => {
        try {
          handler(error);
        } catch (handlerError) {
          console.error('Error in error handler:', handlerError);
        }
      });
    });

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [autoReconnect]);

  // Initialize game sync
  const initializeGameSync = useCallback(() => {
    if (!gameState || !peerConnectionRef.current) {
      return null;
    }

    if (gameSyncRef.current) {
      return gameSyncRef.current;
    }

    const gameSync = new GameSync(peerConnectionRef.current, gameState);
    gameSyncRef.current = gameSync;
    return gameSync;
  }, [gameState]);

  // Auto-reconnection logic
  const handleAutoReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      if (connectionStatus === ConnectionStatus.DISCONNECTED && autoReconnect) {
        console.log('Attempting auto-reconnect...');
        // Note: This would need the original host ID to reconnect
        // In a real implementation, you'd store this information
      }
    }, 5000);
  }, [connectionStatus, autoReconnect]);

  // Update network statistics periodically
  const startStatsUpdate = useCallback(() => {
    if (statsUpdateIntervalRef.current) {
      clearInterval(statsUpdateIntervalRef.current);
    }

    statsUpdateIntervalRef.current = setInterval(() => {
      if (peerConnectionRef.current) {
        setNetworkStats(peerConnectionRef.current.getStats());
        setConnectedPeers(peerConnectionRef.current.getConnectedPeers());
      }
    }, 1000);
  }, []);

  // Connection methods
  const initializeAsHost = useCallback(async (hostId?: string): Promise<string> => {
    try {
      const peerConnection = initializePeerConnection();
      const peerId = await peerConnection.initializeAsHost(hostId);
      setIsHost(true);
      setLocalPeerId(peerId);
      startStatsUpdate();
      return peerId;
    } catch (error) {
      console.error('Failed to initialize as host:', error);
      throw error;
    }
  }, [initializePeerConnection, startStatsUpdate]);

  const connectToHost = useCallback(async (hostId: string): Promise<void> => {
    try {
      const peerConnection = initializePeerConnection();
      await peerConnection.connectToHost(hostId);
      setIsHost(false);
      startStatsUpdate();
    } catch (error) {
      console.error('Failed to connect to host:', error);
      throw error;
    }
  }, [initializePeerConnection, startStatsUpdate]);

  const disconnect = useCallback(() => {
    try {
      // Stop game sync
      if (gameSyncRef.current) {
        gameSyncRef.current.stopSync();
        gameSyncRef.current = null;
      }

      // Disconnect peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.disconnect();
        peerConnectionRef.current = null;
      }

      // Clear intervals and timeouts
      if (statsUpdateIntervalRef.current) {
        clearInterval(statsUpdateIntervalRef.current);
        statsUpdateIntervalRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Reset state
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      setIsHost(false);
      setLocalPeerId('');
      setConnectedPeers([]);
      setIsGameSyncActive(false);
      setLastError(null);
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }, []);

  // Game synchronization methods
  const startGameSync = useCallback(() => {
    const gameSync = initializeGameSync();
    if (gameSync) {
      gameSync.startSync();
      setIsGameSyncActive(true);
    } else {
      console.warn('Cannot start game sync: GameState not provided or connection not established');
    }
  }, [initializeGameSync]);

  const stopGameSync = useCallback(() => {
    if (gameSyncRef.current) {
      gameSyncRef.current.stopSync();
      setIsGameSyncActive(false);
    }
  }, []);

  const sendPlayerInput = useCallback((playerId: number, input: PlayerInputMessage['input']) => {
    if (gameSyncRef.current) {
      gameSyncRef.current.sendPlayerInput(playerId, input);
    }
  }, []);

  const sendGameEvent = useCallback((event: GameEventMessage['event']) => {
    if (gameSyncRef.current) {
      gameSyncRef.current.sendGameEvent(event);
    }
  }, []);

  const requestSync = useCallback(() => {
    if (gameSyncRef.current) {
      gameSyncRef.current.requestSync();
    }
  }, []);

  // Event handler registration
  const onNetworkMessage = useCallback((messageType: NetworkMessageType, handler: (message: NetworkMessage) => void) => {
    if (!messageHandlersRef.current.has(messageType)) {
      messageHandlersRef.current.set(messageType, []);
    }
    messageHandlersRef.current.get(messageType)!.push(handler);

    // Register with peer connection if available
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onMessage(messageType, handler);
    }
  }, []);

  const onNetworkError = useCallback((handler: (error: NetworkError) => void) => {
    errorHandlersRef.current.push(handler);
  }, []);

  const onConnectionStatusChange = useCallback((handler: (status: ConnectionStatus, peerId?: string) => void) => {
    statusHandlersRef.current.push(handler);
  }, []);

  // Computed values
  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;
  const canStartGame = isConnected && (isHost || connectedPeers.length > 0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Auto-start stats update when connected
  useEffect(() => {
    if (isConnected && !statsUpdateIntervalRef.current) {
      startStatsUpdate();
    }
  }, [isConnected, startStatsUpdate]);

  // Register message handlers with peer connection when it's available
  useEffect(() => {
    if (peerConnectionRef.current) {
      messageHandlersRef.current.forEach((handlers, messageType) => {
        handlers.forEach(handler => {
          peerConnectionRef.current!.onMessage(messageType, handler);
        });
      });
    }
  }, [peerConnectionRef.current]);

  return {
    // Connection state
    connectionStatus,
    isHost,
    localPeerId,
    connectedPeers,
    networkStats,
    
    // Connection methods
    initializeAsHost,
    connectToHost,
    disconnect,
    
    // Game synchronization
    startGameSync,
    stopGameSync,
    sendPlayerInput,
    sendGameEvent,
    requestSync,
    
    // Event handlers
    onNetworkMessage,
    onNetworkError,
    onConnectionStatusChange,
    
    // Utility properties
    isConnected,
    canStartGame,
    lastError
  };
};

/**
 * Hook for simplified host setup
 */
export const useNetworkHost = (gameState: GameState, hostId?: string) => {
  const network = useNetwork({ gameState });
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await network.initializeAsHost(hostId);
        setIsInitialized(true);
        setInitError(null);
      } catch (error) {
        setInitError(error instanceof Error ? error.message : 'Failed to initialize host');
        setIsInitialized(false);
      }
    };

    if (!isInitialized && !initError) {
      initialize();
    }
  }, [network, hostId, isInitialized, initError]);

  return {
    ...network,
    isInitialized,
    initError
  };
};

/**
 * Hook for simplified client connection
 */
export const useNetworkClient = (gameState: GameState, hostId: string) => {
  const network = useNetwork({ gameState });
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const connect = async () => {
      try {
        await network.connectToHost(hostId);
        setIsConnected(true);
        setConnectionError(null);
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : 'Failed to connect to host');
        setIsConnected(false);
      }
    };

    if (hostId && !isConnected && !connectionError) {
      connect();
    }
  }, [network, hostId, isConnected, connectionError]);

  return {
    ...network,
    isConnected,
    connectionError
  };
};