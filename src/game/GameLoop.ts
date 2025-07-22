import { GameEngine } from './core/GameEngine';
import type { GameEvent, PlayerInput } from './core/GameEngine';
import { GameState } from './core/GameState';
import { GameSync } from '../network/GameSync';
import { PeerConnection } from '../network/PeerConnection';
import { GAME_CONSTANTS } from '../utils/Constants';

/**
 * Enhanced game loop with networking support for multiplayer games
 * Manages both local and networked game state synchronization
 */
export class GameLoop {
  private gameEngine: GameEngine;
  private gameSync: GameSync | null = null;
  private peerConnection: PeerConnection | null = null;
  private isNetworked: boolean = false;
  private isHost: boolean = false;
  private localPlayerId: number = 0;
  
  // Input management
  private inputBuffer: Map<number, PlayerInput[]> = new Map();
  private lastInputSequence: number = 0;
  
  // Timing
  private lastUpdateTime: number = 0;
  private accumulator: number = 0;
  private fixedTimeStep: number = 1000 / 60; // 60 FPS fixed timestep
  
  // Network timing
  private lastNetworkSync: number = 0;
  private networkSyncInterval: number = 1000 / 20; // 20 FPS network sync
  
  // Event callbacks
  private onGameEventCallback?: (event: GameEvent) => void;
  private onNetworkEventCallback?: (event: any) => void;
  
  constructor() {
    this.gameEngine = new GameEngine();
    this.setupEngineCallbacks();
  }
  
  /**
   * Initialize the game loop
   * @param networked Whether this is a networked game
   * @param isHost Whether this instance is the host (for networked games)
   * @param playerId The local player ID
   */
  initialize(networked: boolean = false, isHost: boolean = false, playerId: number = 0): void {
    this.isNetworked = networked;
    this.isHost = isHost;
    this.localPlayerId = playerId;
    
    this.gameEngine.initialize();
    
    if (this.isNetworked && this.peerConnection) {
      this.setupNetworking();
    }
    
    this.lastUpdateTime = performance.now();
  }
  
  /**
   * Set the peer connection for networked games
   * @param peerConnection The peer connection instance
   */
  setPeerConnection(peerConnection: PeerConnection): void {
    this.peerConnection = peerConnection;
    
    if (this.isNetworked) {
      this.setupNetworking();
    }
  }
  
  /**
   * Start the game loop
   */
  start(): void {
    this.gameEngine.start();
    
    if (this.gameSync) {
      this.gameSync.startSync();
    }
  }
  
  /**
   * Stop the game loop
   */
  stop(): void {
    this.gameEngine.stop();
    
    if (this.gameSync) {
      this.gameSync.stopSync();
    }
  }
  
  /**
   * Pause the game
   */
  pause(): void {
    this.gameEngine.pause();
  }
  
  /**
   * Resume the game
   */
  resume(): void {
    this.gameEngine.resume();
    this.lastUpdateTime = performance.now();
  }
  
  /**
   * Process player input
   * @param playerId The player ID
   * @param input The input state
   */
  processInput(playerId: number, input: PlayerInput): void {
    // Store input in buffer
    if (!this.inputBuffer.has(playerId)) {
      this.inputBuffer.set(playerId, []);
    }
    
    const buffer = this.inputBuffer.get(playerId)!;
    buffer.push({ ...input, timestamp: performance.now() });
    
    // Send input to network if networked
    if (this.isNetworked && this.gameSync && playerId === this.localPlayerId) {
      this.gameSync.sendPlayerInput(playerId, {
        moveUp: input.thrust,
        moveLeft: input.rotateLeft,
        moveRight: input.rotateRight,
        shoot: input.shoot,
        rotation: undefined // Will be filled by ship's current rotation
      });
    }
    
    // Apply input immediately for local player (client-side prediction)
    if (playerId === this.localPlayerId) {
      this.gameEngine.setPlayerInput(playerId, input);
      
      // Apply prediction if networked
      if (this.isNetworked && this.gameSync) {
        this.gameSync.applyPrediction(playerId, {
          moveUp: input.thrust,
          moveLeft: input.rotateLeft,
          moveRight: input.rotateRight,
          shoot: input.shoot,
          rotation: undefined
        }, this.fixedTimeStep / 1000);
      }
    }
  }
  
  /**
   * Update the game loop
   * @param currentTime Current timestamp
   */
  update(currentTime: number): void {
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Accumulate time for fixed timestep
    this.accumulator += deltaTime;
    
    // Process fixed timestep updates
    while (this.accumulator >= this.fixedTimeStep) {
      this.fixedUpdate(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }
    
    // Handle network synchronization
    if (this.isNetworked) {
      this.handleNetworkSync(currentTime);
    }
    
    // Apply interpolation for smooth rendering
    if (this.gameSync) {
      this.gameSync.interpolateState(currentTime);
    }
  }
  
  /**
   * Fixed timestep update
   * @param deltaTime Fixed delta time
   */
  private fixedUpdate(deltaTime: number): void {
    // Process buffered inputs
    this.processInputBuffers();
    
    // Update game engine (only host updates physics in networked games)
    if (!this.isNetworked || this.isHost) {
      // Host or single player: full physics simulation
      this.gameEngine.update(performance.now(), deltaTime);
    } else {
      // Client: limited local updates (UI, effects, etc.)
      this.gameEngine.updateClient(performance.now(), deltaTime);
    }
  }
  
  /**
   * Handle network synchronization
   * @param currentTime Current timestamp
   */
  private handleNetworkSync(currentTime: number): void {
    if (!this.gameSync) return;
    
    // Send periodic sync updates (host only)
    if (this.isHost && currentTime - this.lastNetworkSync >= this.networkSyncInterval) {
      // Host sends game state updates automatically via GameSync
      this.lastNetworkSync = currentTime;
    }
    
    // Handle latency compensation
    const estimatedLatency = this.peerConnection?.getLatency() || 0;
    if (estimatedLatency > 0) {
      // Apply latency compensation logic
      this.compensateNetworkLatency(estimatedLatency);
    }
  }
  
  /**
   * Process input buffers for all players
   */
  private processInputBuffers(): void {
    this.inputBuffer.forEach((buffer, playerId) => {
      if (buffer.length === 0) return;
      
      // Process inputs in chronological order
      buffer.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      // Apply inputs to game engine
      while (buffer.length > 0) {
        const input = buffer.shift()!;
        
        // Only apply non-local inputs in networked mode
        if (!this.isNetworked || playerId !== this.localPlayerId) {
          this.gameEngine.setPlayerInput(playerId, input);
        }
      }
    });
  }
  
  /**
   * Setup networking components
   */
  private setupNetworking(): void {
    if (!this.peerConnection) return;
    
    const gameState = this.gameEngine.getGameState();
    this.gameSync = new GameSync(this.peerConnection, gameState);
    
    // Setup network event handlers
    this.peerConnection.onConnectionStateChange((state) => {
      this.handleConnectionStateChange(state);
    });
    
    this.peerConnection.onError((error) => {
      this.handleNetworkError(error);
    });
  }
  
  /**
   * Setup game engine callbacks
   */
  private setupEngineCallbacks(): void {
    this.gameEngine.onUpdate((gameState, deltaTime) => {
      // Handle game state updates
      this.handleGameStateUpdate(gameState, deltaTime);
    });
    
    this.gameEngine.onGameEvent((event) => {
      // Handle game events
      this.handleGameEvent(event);
      
      // Send game events over network
      if (this.isNetworked && this.gameSync) {
        this.sendGameEventOverNetwork(event);
      }
    });
  }
  
  /**
   * Handle game state updates
   * @param gameState Current game state
   * @param deltaTime Delta time
   */
  private handleGameStateUpdate(gameState: GameState, deltaTime: number): void {
    // Perform any additional processing needed for networked games
    if (this.isNetworked && this.isHost) {
      // Host: validate and broadcast state changes
      this.validateAndBroadcastState(gameState);
    }
  }
  
  /**
   * Handle game events
   * @param event Game event
   */
  private handleGameEvent(event: GameEvent): void {
    if (this.onGameEventCallback) {
      this.onGameEventCallback(event);
    }
  }
  
  /**
   * Send game event over network
   * @param event Game event to send
   */
  private sendGameEventOverNetwork(event: GameEvent): void {
    if (!this.gameSync) return;
    
    // Convert GameEvent to network event format
    const networkEvent = {
      type: event.type,
      timestamp: event.timestamp,
      playerId: this.localPlayerId,
      data: event.data
    };
    
    this.gameSync.sendGameEvent(networkEvent);
  }
  
  /**
   * Handle connection state changes
   * @param state New connection state
   */
  private handleConnectionStateChange(state: string): void {
    if (this.onNetworkEventCallback) {
      this.onNetworkEventCallback({
        type: 'connection_state_change',
        state,
        timestamp: Date.now()
      });
    }
    
    // Handle disconnections
    if (state === 'disconnected' || state === 'failed') {
      this.handleNetworkDisconnection();
    }
  }
  
  /**
   * Handle network errors
   * @param error Network error
   */
  private handleNetworkError(error: any): void {
    console.error('Network error in game loop:', error);
    
    if (this.onNetworkEventCallback) {
      this.onNetworkEventCallback({
        type: 'network_error',
        error,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Handle network disconnection
   */
  private handleNetworkDisconnection(): void {
    // Stop network sync
    if (this.gameSync) {
      this.gameSync.stopSync();
    }
    
    // Pause game or switch to single player mode
    this.pause();
    
    if (this.onNetworkEventCallback) {
      this.onNetworkEventCallback({
        type: 'disconnected',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Compensate for network latency
   * @param latency Estimated network latency in milliseconds
   */
  private compensateNetworkLatency(latency: number): void {
    // Implement latency compensation logic
    // This could involve rewinding game state and re-simulating
    // For now, we'll just log the latency
    if (latency > 100) { // High latency threshold
      console.warn(`High network latency detected: ${latency}ms`);
    }
  }
  
  /**
   * Validate and broadcast game state (host only)
   * @param gameState Current game state
   */
  private validateAndBroadcastState(gameState: GameState): void {
    // Perform validation checks
    if (!this.isValidGameState(gameState)) {
      console.warn('Invalid game state detected, correcting...');
      this.correctGameState(gameState);
    }
  }
  
  /**
   * Validate game state
   * @param gameState Game state to validate
   * @returns Whether the game state is valid
   */
  private isValidGameState(gameState: GameState): boolean {
    // Implement validation logic
    // Check for impossible positions, invalid health values, etc.
    return true; // Placeholder
  }
  
  /**
   * Correct invalid game state
   * @param gameState Game state to correct
   */
  private correctGameState(gameState: GameState): void {
    // Implement correction logic
    // Reset invalid values, teleport out-of-bounds entities, etc.
  }
  
  // Public getters
  
  /**
   * Get the game engine instance
   */
  getGameEngine(): GameEngine {
    return this.gameEngine;
  }
  
  /**
   * Get the game sync instance
   */
  getGameSync(): GameSync | null {
    return this.gameSync;
  }
  
  /**
   * Check if this is a networked game
   */
  isNetworkedGame(): boolean {
    return this.isNetworked;
  }
  
  /**
   * Check if this instance is the host
   */
  isHostInstance(): boolean {
    return this.isHost;
  }
  
  /**
   * Get the local player ID
   */
  getLocalPlayerId(): number {
    return this.localPlayerId;
  }
  
  // Event callback setters
  
  /**
   * Set game event callback
   * @param callback Game event callback
   */
  onGameEvent(callback: (event: GameEvent) => void): void {
    this.onGameEventCallback = callback;
  }
  
  /**
   * Set network event callback
   * @param callback Network event callback
   */
  onNetworkEvent(callback: (event: any) => void): void {
    this.onNetworkEventCallback = callback;
  }
}

// Extended PlayerInput interface with timestamp
export interface TimestampedPlayerInput extends PlayerInput {
  timestamp?: number;
}