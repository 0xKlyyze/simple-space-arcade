/**
 * Network message types and interfaces for peer-to-peer communication
 * Defines all message structures used for game state synchronization
 */

// Base message interface
export interface BaseNetworkMessage {
  type: NetworkMessageType;
  timestamp: number;
  senderId: string;
}

// Message types const object
export const NetworkMessageType = {
  // Connection management
  PING: 'ping',
  PONG: 'pong',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  CONNECTION_ESTABLISHED: 'connection_established',
  
  // Game state synchronization
  GAME_STATE_UPDATE: 'game_state_update',
  PLAYER_INPUT: 'player_input',
  GAME_EVENT: 'game_event',
  
  // Game control
  START_GAME: 'start_game',
  PAUSE_GAME: 'pause_game',
  RESUME_GAME: 'resume_game',
  END_GAME: 'end_game',
  RESTART_GAME: 'restart_game',
  
  // Error handling
  ERROR: 'error',
  SYNC_REQUEST: 'sync_request',
  SYNC_RESPONSE: 'sync_response'
} as const;

export type NetworkMessageType = typeof NetworkMessageType[keyof typeof NetworkMessageType];

// Player input message
export interface PlayerInputMessage extends BaseNetworkMessage {
  type: 'player_input';
  playerId: number;
  input: {
    moveUp: boolean;
    moveDown: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    shoot: boolean;
    rotation?: number;
  };
  sequenceNumber: number;
}

// Game state update message
export interface GameStateUpdateMessage extends BaseNetworkMessage {
  type: 'game_state_update';
  gameState: {
    ships: Array<{
      id: number;
      playerId: number;
      position: { x: number; y: number };
      velocity: { x: number; y: number };
      rotation: number;
      health: number;
      isAlive: boolean;
      lastShot: number;
    }>;
    projectiles: Array<{
      id: number;
      position: { x: number; y: number };
      velocity: { x: number; y: number };
      ownerId: number;
      damage: number;
      isActive: boolean;
    }>;
    players: Array<{
      id: number;
      name: string;
      score: number;
      kills: number;
      deaths: number;
    }>;
    gameStatus: 'waiting' | 'starting' | 'running' | 'paused' | 'ended';
    gameTimer: number;
    winner?: { id: number; name: string };
  };
  sequenceNumber: number;
}

// Game event message
export interface GameEventMessage extends BaseNetworkMessage {
  type: 'game_event';
  event: {
    type: 'ship_hit' | 'ship_destroyed' | 'projectile_fired' | 'player_respawned' | 'score_updated';
    playerId?: number;
    targetId?: number;
    position?: { x: number; y: number };
    data?: any;
  };
}

// Connection messages
export interface PingMessage extends BaseNetworkMessage {
  type: 'ping';
}

export interface PongMessage extends BaseNetworkMessage {
  type: 'pong';
  originalTimestamp: number;
}

export interface PlayerJoinedMessage extends BaseNetworkMessage {
  type: 'player_joined';
  player: {
    id: number;
    name: string;
    isHost: boolean;
  };
}

export interface PlayerLeftMessage extends BaseNetworkMessage {
  type: 'player_left';
  playerId: number;
}

export interface ConnectionEstablishedMessage extends BaseNetworkMessage {
  type: 'connection_established';
  hostId: string;
  clientId: string;
  gameSettings: {
    maxPlayers: number;
    gameMode: 'deathmatch' | 'survival' | 'practice';
    scoreLimit?: number;
    timeLimit?: number;
  };
}

// Game control messages
export interface StartGameMessage extends BaseNetworkMessage {
  type: 'start_game';
  gameSettings: {
    gameMode: 'deathmatch' | 'survival' | 'practice';
    scoreLimit?: number;
    timeLimit?: number;
  };
}

export interface PauseGameMessage extends BaseNetworkMessage {
  type: 'pause_game';
}

export interface ResumeGameMessage extends BaseNetworkMessage {
  type: 'resume_game';
}

export interface EndGameMessage extends BaseNetworkMessage {
  type: 'end_game';
  winner?: { id: number; name: string };
  finalScores: Array<{ playerId: number; score: number; kills: number; deaths: number }>;
}

export interface RestartGameMessage extends BaseNetworkMessage {
  type: 'restart_game';
}

// Error and sync messages
export interface ErrorMessage extends BaseNetworkMessage {
  type: 'error';
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface SyncRequestMessage extends BaseNetworkMessage {
  type: 'sync_request';
  lastKnownSequence: number;
}

export interface SyncResponseMessage extends BaseNetworkMessage {
  type: 'sync_response';
  gameState: GameStateUpdateMessage['gameState'];
  sequenceNumber: number;
}

// Union type for all network messages
export type NetworkMessage = 
  | PlayerInputMessage
  | GameStateUpdateMessage
  | GameEventMessage
  | PingMessage
  | PongMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ConnectionEstablishedMessage
  | StartGameMessage
  | PauseGameMessage
  | ResumeGameMessage
  | EndGameMessage
  | RestartGameMessage
  | ErrorMessage
  | SyncRequestMessage
  | SyncResponseMessage;

// Connection status const object
export const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  RECONNECTING: 'reconnecting'
} as const;

export type ConnectionStatus = typeof ConnectionStatus[keyof typeof ConnectionStatus];

// Peer information interface
export interface PeerInfo {
  id: string;
  name: string;
  isHost: boolean;
  connectionStatus: ConnectionStatus;
  lastSeen: number;
  latency?: number;
}

// Network configuration
export interface NetworkConfig {
  iceServers: RTCIceServer[];
  maxReconnectAttempts: number;
  reconnectDelay: number;
  pingInterval: number;
  timeoutDuration: number;
  maxMessageQueueSize: number;
}

// Default network configuration
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  maxReconnectAttempts: 5,
  reconnectDelay: 2000,
  pingInterval: 5000,
  timeoutDuration: 10000,
  maxMessageQueueSize: 100
};

// Message validation helpers
export const isValidNetworkMessage = (message: any): message is NetworkMessage => {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    Object.values(NetworkMessageType).includes(message.type) &&
    typeof message.timestamp === 'number' &&
    typeof message.senderId === 'string'
  );
};

export const createBaseMessage = (type: NetworkMessageType, senderId: string): BaseNetworkMessage => {
  return {
    type,
    timestamp: Date.now(),
    senderId
  };
};

// Network error types const object
export const NetworkErrorType = {
  CONNECTION_FAILED: 'connection_failed',
  CONNECTION_LOST: 'connection_lost',
  MESSAGE_SEND_FAILED: 'message_send_failed',
  INVALID_MESSAGE: 'invalid_message',
  PEER_NOT_FOUND: 'peer_not_found',
  TIMEOUT: 'timeout',
  WEBRTC_ERROR: 'webrtc_error'
} as const;

export type NetworkErrorType = typeof NetworkErrorType[keyof typeof NetworkErrorType];

export interface NetworkError {
  type: NetworkErrorType;
  message: string;
  details?: any;
  timestamp: number;
}

// Event handler types
export type NetworkEventHandler<T = any> = (data: T) => void;
export type NetworkErrorHandler = (error: NetworkError) => void;
export type ConnectionStatusHandler = (status: ConnectionStatus, peerId?: string) => void;

// Network statistics
export interface NetworkStats {
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  averageLatency: number;
  connectionUptime: number;
  reconnectCount: number;
  lastError?: NetworkError;
}