import { PeerConnection } from './PeerConnection';
import {
  NetworkMessageType,
  createBaseMessage
} from './NetworkTypes';
import type {
  NetworkMessage,
  GameStateUpdateMessage,
  PlayerInputMessage,
  GameEventMessage,
  SyncRequestMessage,
  SyncResponseMessage
} from './NetworkTypes';
import { GameState } from '../game/core/GameState';
import { Ship } from '../game/entities/Ship';
import { Projectile } from '../game/entities/Projectile';

/**
 * Game state synchronization manager
 * Handles synchronization of game state between peers in multiplayer games
 */
export class GameSync {
  private peerConnection: PeerConnection;
  private gameState: GameState;
  private isHost: boolean = false;
  private lastSyncTime: number = 0;
  private syncInterval: number = 1000 / 20; // 20 FPS sync rate
  private syncTimer: NodeJS.Timeout | null = null;
  private inputBuffer: Map<number, PlayerInputMessage[]> = new Map();
  private lastProcessedSequence: Map<string, number> = new Map();
  private stateHistory: GameStateUpdateMessage[] = [];
  private maxHistorySize: number = 60; // Keep 3 seconds of history at 20 FPS
  private conflictResolutionEnabled: boolean = true;
  private interpolationEnabled: boolean = true;
  private predictionEnabled: boolean = true;

  constructor(peerConnection: PeerConnection, gameState: GameState) {
    this.peerConnection = peerConnection;
    this.gameState = gameState;
    this.isHost = peerConnection.isHostPeer();
    this.setupMessageHandlers();
  }

  /**
   * Start game state synchronization
   */
  startSync(): void {
    if (this.syncTimer) {
      this.stopSync();
    }

    // Host sends regular state updates
    if (this.isHost) {
      this.syncTimer = setInterval(() => {
        this.sendGameStateUpdate();
      }, this.syncInterval);
    }

    console.log(`Game sync started as ${this.isHost ? 'host' : 'client'}`);
  }

  /**
   * Stop game state synchronization
   */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    console.log('Game sync stopped');
  }

  /**
   * Send player input to other peers
   * @param playerId The player ID
   * @param input The input state
   */
  sendPlayerInput(playerId: number, input: PlayerInputMessage['input']): void {
    const message: PlayerInputMessage = {
      ...createBaseMessage(NetworkMessageType.PLAYER_INPUT, this.peerConnection.getLocalPeerId()),
      type: NetworkMessageType.PLAYER_INPUT,
      playerId,
      input,
      sequenceNumber: Date.now() // Use timestamp as sequence for input
    };

    this.peerConnection.sendMessage(message);
  }

  /**
   * Send a game event to other peers
   * @param event The game event to send
   */
  sendGameEvent(event: GameEventMessage['event']): void {
    const message: GameEventMessage = {
      ...createBaseMessage(NetworkMessageType.GAME_EVENT, this.peerConnection.getLocalPeerId()),
      type: NetworkMessageType.GAME_EVENT,
      event
    };

    this.peerConnection.sendMessage(message);
  }

  /**
   * Request full game state synchronization
   */
  requestSync(): void {
    const lastSequence = this.stateHistory.length > 0 
      ? this.stateHistory[this.stateHistory.length - 1].sequenceNumber 
      : 0;

    const message: SyncRequestMessage = {
      ...createBaseMessage(NetworkMessageType.SYNC_REQUEST, this.peerConnection.getLocalPeerId()),
      type: NetworkMessageType.SYNC_REQUEST,
      lastKnownSequence: lastSequence
    };

    this.peerConnection.sendMessage(message);
  }

  /**
   * Apply client-side prediction for smooth gameplay
   * @param playerId The player ID to predict for
   * @param input The input to predict with
   * @param deltaTime Time since last update
   */
  applyPrediction(playerId: number, input: PlayerInputMessage['input'], deltaTime: number): void {
    if (!this.predictionEnabled || this.isHost) {
      return;
    }

    const ship = this.gameState.getShipByPlayerId(playerId);
    if (!ship) {
      return;
    }

    // Apply input prediction locally
    this.applyInputToShip(ship, input, deltaTime);
  }

  /**
   * Interpolate between game states for smooth rendering
   * @param renderTime The current render time
   */
  interpolateState(renderTime: number): void {
    if (!this.interpolationEnabled || this.stateHistory.length < 2) {
      return;
    }

    // Find two states to interpolate between
    const targetTime = renderTime - 100; // 100ms interpolation delay
    let fromState: GameStateUpdateMessage | null = null;
    let toState: GameStateUpdateMessage | null = null;

    for (let i = 0; i < this.stateHistory.length - 1; i++) {
      const current = this.stateHistory[i];
      const next = this.stateHistory[i + 1];

      if (current.timestamp <= targetTime && next.timestamp >= targetTime) {
        fromState = current;
        toState = next;
        break;
      }
    }

    if (fromState && toState) {
      const alpha = (targetTime - fromState.timestamp) / (toState.timestamp - fromState.timestamp);
      this.interpolateGameState(fromState, toState, alpha);
    }
  }

  /**
   * Handle network latency compensation
   * @param message The received message
   * @param estimatedLatency The estimated network latency
   */
  compensateLatency(message: NetworkMessage, estimatedLatency: number): void {
    // Adjust message timestamp based on estimated latency
    const adjustedTimestamp = message.timestamp + estimatedLatency;
    
    // Apply latency compensation based on message type
    if (message.type === NetworkMessageType.PLAYER_INPUT) {
      const inputMessage = message as PlayerInputMessage;
      // Process input with timestamp adjustment
      this.processPlayerInputWithLatencyCompensation(inputMessage, adjustedTimestamp);
    }
  }

  /**
   * Detect and resolve state conflicts
   * @param receivedState The received game state
   * @param localState The local game state
   */
  resolveStateConflict(receivedState: GameStateUpdateMessage, localState: GameState): void {
    if (!this.conflictResolutionEnabled) {
      return;
    }

    // Compare critical game elements
    const conflicts = this.detectConflicts(receivedState, localState);
    
    if (conflicts.length > 0) {
      console.log('State conflicts detected:', conflicts);
      
      // Apply conflict resolution strategy
      if (this.isHost) {
        // Host authority: ignore client state, send correction
        this.sendGameStateUpdate();
      } else {
        // Client: accept host authority
        this.applyReceivedGameState(receivedState);
      }
    }
  }

  // Private methods

  private setupMessageHandlers(): void {
    this.peerConnection.onMessage(NetworkMessageType.PLAYER_INPUT, (message: PlayerInputMessage) => {
      this.handlePlayerInput(message);
    });

    this.peerConnection.onMessage(NetworkMessageType.GAME_STATE_UPDATE, (message: GameStateUpdateMessage) => {
      this.handleGameStateUpdate(message);
    });

    this.peerConnection.onMessage(NetworkMessageType.GAME_EVENT, (message: GameEventMessage) => {
      this.handleGameEvent(message);
    });

    this.peerConnection.onMessage(NetworkMessageType.SYNC_REQUEST, (message: SyncRequestMessage) => {
      this.handleSyncRequest(message);
    });

    this.peerConnection.onMessage(NetworkMessageType.SYNC_RESPONSE, (message: SyncResponseMessage) => {
      this.handleSyncResponse(message);
    });
  }

  private sendGameStateUpdate(): void {
    const gameStateData = this.serializeGameState();
    const sequenceNumber = Date.now();

    const message: GameStateUpdateMessage = {
      ...createBaseMessage(NetworkMessageType.GAME_STATE_UPDATE, this.peerConnection.getLocalPeerId()),
      type: NetworkMessageType.GAME_STATE_UPDATE,
      gameState: gameStateData,
      sequenceNumber
    };

    this.peerConnection.sendMessage(message);
    
    // Store in history for conflict resolution
    this.stateHistory.push(message);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    this.lastSyncTime = Date.now();
  }

  private handlePlayerInput(message: PlayerInputMessage): void {
    // Store input in buffer for processing
    if (!this.inputBuffer.has(message.playerId)) {
      this.inputBuffer.set(message.playerId, []);
    }

    const buffer = this.inputBuffer.get(message.playerId)!;
    buffer.push(message);

    // Sort by sequence number
    buffer.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Process inputs in order
    this.processInputBuffer(message.playerId);
  }

  private handleGameStateUpdate(message: GameStateUpdateMessage): void {
    // Check if this is a newer state
    const lastSequence = this.lastProcessedSequence.get(message.senderId) || 0;
    if (message.sequenceNumber <= lastSequence) {
      return; // Ignore old or duplicate states
    }

    this.lastProcessedSequence.set(message.senderId, message.sequenceNumber);

    // Apply received state if not host
    if (!this.isHost) {
      this.applyReceivedGameState(message);
    }

    // Store in history
    this.stateHistory.push(message);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  private handleGameEvent(message: GameEventMessage): void {
    const { event } = message;
    
    switch (event.type) {
      case 'ship_hit':
        this.handleShipHitEvent(event);
        break;
      case 'ship_destroyed':
        this.handleShipDestroyedEvent(event);
        break;
      case 'projectile_fired':
        this.handleProjectileFiredEvent(event);
        break;
      case 'player_respawned':
        this.handlePlayerRespawnedEvent(event);
        break;
      case 'score_updated':
        this.handleScoreUpdatedEvent(event);
        break;
    }
  }

  private handleSyncRequest(message: SyncRequestMessage): void {
    if (!this.isHost) {
      return; // Only host responds to sync requests
    }

    const gameStateData = this.serializeGameState();
    const response: SyncResponseMessage = {
      ...createBaseMessage(NetworkMessageType.SYNC_RESPONSE, this.peerConnection.getLocalPeerId()),
      type: NetworkMessageType.SYNC_RESPONSE,
      gameState: gameStateData,
      sequenceNumber: Date.now()
    };

    this.peerConnection.sendMessage(response, message.senderId);
  }

  private handleSyncResponse(message: SyncResponseMessage): void {
    // Apply the synchronized state
    this.applyReceivedGameState(message);
  }

  private processInputBuffer(playerId: number): void {
    const buffer = this.inputBuffer.get(playerId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    const ship = this.gameState.getShipByPlayerId(playerId);
    if (!ship) {
      return;
    }

    // Process all buffered inputs
    while (buffer.length > 0) {
      const input = buffer.shift()!;
      const deltaTime = this.syncInterval / 1000; // Convert to seconds
      this.applyInputToShip(ship, input.input, deltaTime);
    }
  }

  private applyInputToShip(ship: Ship, input: PlayerInputMessage['input'], deltaTime: number): void {
    // Apply movement input
    if (input.moveUp) ship.thrust(deltaTime);
    if (input.moveLeft) ship.rotateLeft(deltaTime);
    if (input.moveRight) ship.rotateRight(deltaTime);
    if (input.shoot) ship.shoot();
    
    // Apply rotation if provided
    if (input.rotation !== undefined) {
      ship.setRotation(input.rotation);
    }
  }

  private serializeGameState(): GameStateUpdateMessage['gameState'] {
    const ships = this.gameState.getShips().map(ship => ({
      id: ship.getId(),
      playerId: ship.getPlayerId(),
      position: { x: ship.getPosition().x, y: ship.getPosition().y },
      velocity: { x: ship.getVelocity().x, y: ship.getVelocity().y },
      rotation: ship.getRotation(),
      health: ship.getHealth(),
      isAlive: ship.isAlive(),
      lastShot: ship.getLastShotTime()
    }));

    const projectiles = this.gameState.getProjectiles().map(projectile => ({
      id: projectile.getId(),
      position: { x: projectile.getPosition().x, y: projectile.getPosition().y },
      velocity: { x: projectile.getVelocity().x, y: projectile.getVelocity().y },
      ownerId: projectile.getOwnerId(),
      damage: projectile.getDamage(),
      isActive: projectile.isActive()
    }));

    const players = this.gameState.getPlayers().map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      kills: player.kills,
      deaths: player.deaths
    }));

    return {
      ships,
      projectiles,
      players,
      gameStatus: this.gameState.getGameStatus(),
      gameTimer: this.gameState.getGameTimer(),
      winner: this.gameState.getWinner()
    };
  }

  private applyReceivedGameState(message: GameStateUpdateMessage | SyncResponseMessage): void {
    const { gameState } = message;
    
    // Update ships
    gameState.ships.forEach(shipData => {
      const ship = this.gameState.getShipById(shipData.id);
      if (ship) {
        ship.setPosition(shipData.position.x, shipData.position.y);
        ship.setVelocity(shipData.velocity.x, shipData.velocity.y);
        ship.setRotation(shipData.rotation);
        ship.setHealth(shipData.health);
        if (!shipData.isAlive && ship.isAlive()) {
          ship.destroy();
        }
      }
    });

    // Update projectiles
    this.gameState.clearProjectiles();
    gameState.projectiles.forEach(projectileData => {
      if (projectileData.isActive) {
        const projectile = new Projectile(
          projectileData.position.x,
          projectileData.position.y,
          projectileData.velocity.x,
          projectileData.velocity.y,
          projectileData.ownerId,
          projectileData.damage
        );
        projectile.setId(projectileData.id);
        this.gameState.addProjectile(projectile);
      }
    });

    // Update players
    gameState.players.forEach(playerData => {
      const player = this.gameState.getPlayerById(playerData.id);
      if (player) {
        player.score = playerData.score;
        player.kills = playerData.kills;
        player.deaths = playerData.deaths;
      }
    });

    // Update game status
    this.gameState.setGameStatus(gameState.gameStatus);
    this.gameState.setGameTimer(gameState.gameTimer);
    if (gameState.winner) {
      this.gameState.setWinner(gameState.winner);
    }
  }

  private interpolateGameState(fromState: GameStateUpdateMessage, toState: GameStateUpdateMessage, alpha: number): void {
    // Interpolate ship positions and rotations
    fromState.gameState.ships.forEach((fromShip, index) => {
      const toShip = toState.gameState.ships[index];
      if (!toShip) return;

      const ship = this.gameState.getShipById(fromShip.id);
      if (!ship) return;

      // Linear interpolation for position
      const x = fromShip.position.x + (toShip.position.x - fromShip.position.x) * alpha;
      const y = fromShip.position.y + (toShip.position.y - fromShip.position.y) * alpha;
      ship.setPosition(x, y);

      // Angular interpolation for rotation
      const rotation = this.interpolateAngle(fromShip.rotation, toShip.rotation, alpha);
      ship.setRotation(rotation);
    });
  }

  private interpolateAngle(from: number, to: number, alpha: number): number {
    // Handle angle wrapping for smooth rotation interpolation
    let diff = to - from;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    return from + diff * alpha;
  }

  private detectConflicts(receivedState: GameStateUpdateMessage, localState: GameState): string[] {
    const conflicts: string[] = [];

    // Check for position conflicts
    receivedState.gameState.ships.forEach(receivedShip => {
      const localShip = localState.getShipById(receivedShip.id);
      if (localShip) {
        const positionDiff = Math.sqrt(
          Math.pow(receivedShip.position.x - localShip.getPosition().x, 2) +
          Math.pow(receivedShip.position.y - localShip.getPosition().y, 2)
        );
        
        if (positionDiff > 50) { // Threshold for position conflict
          conflicts.push(`Ship ${receivedShip.id} position conflict: ${positionDiff}px difference`);
        }
      }
    });

    return conflicts;
  }

  private processPlayerInputWithLatencyCompensation(message: PlayerInputMessage, adjustedTimestamp: number): void {
    // Apply input with timestamp adjustment for better synchronization
    const ship = this.gameState.getShipByPlayerId(message.playerId);
    if (!ship) return;

    const deltaTime = (Date.now() - adjustedTimestamp) / 1000;
    this.applyInputToShip(ship, message.input, Math.max(deltaTime, 0.016)); // Min 16ms
  }

  // Event handlers

  private handleShipHitEvent(event: any): void {
    if (event.targetId) {
      const ship = this.gameState.getShipById(event.targetId);
      if (ship && event.data?.damage) {
        ship.takeDamage(event.data.damage);
      }
    }
  }

  private handleShipDestroyedEvent(event: any): void {
    if (event.targetId) {
      const ship = this.gameState.getShipById(event.targetId);
      if (ship) {
        ship.destroy();
      }
    }
  }

  private handleProjectileFiredEvent(event: any): void {
    if (event.position && event.data) {
      const projectile = new Projectile(
        event.position.x,
        event.position.y,
        event.data.velocity.x,
        event.data.velocity.y,
        event.playerId || 0,
        event.data.damage || 10
      );
      this.gameState.addProjectile(projectile);
    }
  }

  private handlePlayerRespawnedEvent(event: any): void {
    if (event.playerId) {
      const ship = this.gameState.getShipByPlayerId(event.playerId);
      if (ship) {
        ship.respawn();
        if (event.position) {
          ship.setPosition(event.position.x, event.position.y);
        }
      }
    }
  }

  private handleScoreUpdatedEvent(event: any): void {
    if (event.playerId && event.data) {
      const player = this.gameState.getPlayerById(event.playerId);
      if (player) {
        player.score = event.data.score || player.score;
        player.kills = event.data.kills || player.kills;
        player.deaths = event.data.deaths || player.deaths;
      }
    }
  }
}