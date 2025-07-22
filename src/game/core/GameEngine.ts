import { GameState } from './GameState';
import { Vector2D } from '../physics/Vector2D';
import { GAME_CONSTANTS } from '../../utils/Constants';

/**
 * Main game engine that manages the game loop, state updates, and coordination
 * between different game systems
 */
export class GameEngine {
  private gameState: GameState;
  private isRunning: boolean;
  private lastFrameTime: number;
  private frameCount: number;
  private fps: number;
  private fpsUpdateTime: number;
  
  // Game loop management
  private animationFrameId: number | null;
  private targetFPS: number;
  private frameInterval: number;
  
  // Event callbacks
  private onUpdateCallback?: (gameState: GameState, deltaTime: number) => void;
  private onRenderCallback?: (renderData: any) => void;
  private onGameEventCallback?: (event: GameEvent) => void;
  
  // Performance monitoring
  private performanceMetrics: {
    averageFrameTime: number;
    minFrameTime: number;
    maxFrameTime: number;
    frameTimeHistory: number[];
  };
  
  constructor() {
    this.gameState = new GameState();
    this.isRunning = false;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsUpdateTime = 0;
    
    this.animationFrameId = null;
    this.targetFPS = GAME_CONSTANTS.GAME.TARGET_FPS;
    this.frameInterval = 1000 / this.targetFPS;
    
    this.performanceMetrics = {
      averageFrameTime: 0,
      minFrameTime: Infinity,
      maxFrameTime: 0,
      frameTimeHistory: []
    };
  }
  
  /**
   * Initialize the game engine
   */
  initialize(): void {
    this.gameState.initialize();
    this.lastFrameTime = performance.now();
    this.fpsUpdateTime = this.lastFrameTime;
    this.resetPerformanceMetrics();
  }
  
  /**
   * Start the game engine and begin the game loop
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop();
    
    this.emitGameEvent({
      type: 'engine_started',
      timestamp: Date.now()
    });
  }
  
  /**
   * Stop the game engine and halt the game loop
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.emitGameEvent({
      type: 'engine_stopped',
      timestamp: Date.now()
    });
  }
  
  /**
   * Pause the game engine
   */
  pause(): void {
    this.gameState.isPaused = true;
    
    this.emitGameEvent({
      type: 'game_paused',
      timestamp: Date.now()
    });
  }
  
  /**
   * Resume the game engine
   */
  resume(): void {
    this.gameState.isPaused = false;
    this.lastFrameTime = performance.now();
    
    this.emitGameEvent({
      type: 'game_resumed',
      timestamp: Date.now()
    });
  }
  
  /**
   * Main game loop
   */
  private gameLoop(): void {
    if (!this.isRunning) {
      return;
    }
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    // Update game state
    this.update(currentTime, deltaTime);
    
    // Render game
    this.render();
    
    // Update performance metrics
    this.updatePerformanceMetrics(deltaTime);
    
    // Update frame timing
    this.lastFrameTime = currentTime;
    this.frameCount++;
    
    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }
  
  /**
   * Update game state
   */
  private update(currentTime: number, deltaTime: number): void {
    // Update game state
    this.gameState.update(currentTime);
    
    // Call update callback if provided
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.gameState, deltaTime);
    }
    
    // Update FPS counter
    this.updateFPS(currentTime);
  }
  
  /**
   * Render game
   */
  private render(): void {
    if (this.onRenderCallback) {
      const renderData = this.gameState.getRenderData();
      this.onRenderCallback(renderData);
    }
  }
  
  /**
   * Update FPS counter
   */
  private updateFPS(currentTime: number): void {
    if (currentTime - this.fpsUpdateTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = currentTime;
    }
  }
  
  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(deltaTime: number): void {
    const metrics = this.performanceMetrics;
    
    // Update min/max frame times
    metrics.minFrameTime = Math.min(metrics.minFrameTime, deltaTime);
    metrics.maxFrameTime = Math.max(metrics.maxFrameTime, deltaTime);
    
    // Update frame time history
    metrics.frameTimeHistory.push(deltaTime);
    if (metrics.frameTimeHistory.length > 60) {
      metrics.frameTimeHistory.shift();
    }
    
    // Calculate average frame time
    const sum = metrics.frameTimeHistory.reduce((a, b) => a + b, 0);
    metrics.averageFrameTime = sum / metrics.frameTimeHistory.length;
  }
  
  /**
   * Reset performance metrics
   */
  private resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      averageFrameTime: 0,
      minFrameTime: Infinity,
      maxFrameTime: 0,
      frameTimeHistory: []
    };
  }
  
  /**
   * Emit a game event
   */
  private emitGameEvent(event: GameEvent): void {
    if (this.onGameEventCallback) {
      this.onGameEventCallback(event);
    }
  }
  
  /**
   * Add a player to the game
   */
  addPlayer(playerId: number, playerName: string): boolean {
    const success = this.gameState.addPlayer(playerId, playerName);
    
    if (success) {
      this.emitGameEvent({
        type: 'player_joined',
        timestamp: Date.now(),
        data: { playerId, playerName }
      });
    }
    
    return success;
  }
  
  /**
   * Remove a player from the game
   */
  removePlayer(playerId: number): void {
    this.gameState.removePlayer(playerId);
    
    this.emitGameEvent({
      type: 'player_left',
      timestamp: Date.now(),
      data: { playerId }
    });
  }
  
  /**
   * Set player input
   */
  setPlayerInput(playerId: number, input: PlayerInput): void {
    this.gameState.setPlayerInput(playerId, input);
  }
  
  /**
   * Start a new match
   */
  startMatch(): void {
    this.gameState.startMatch();
    
    this.emitGameEvent({
      type: 'match_started',
      timestamp: Date.now()
    });
  }
  
  /**
   * End the current match
   */
  endMatch(winnerId?: number): void {
    this.gameState.endMatch(winnerId);
    
    this.emitGameEvent({
      type: 'match_ended',
      timestamp: Date.now(),
      data: { winnerId }
    });
  }
  
  /**
   * Get current game state
   */
  getGameState(): GameState {
    return this.gameState;
  }
  
  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.fps;
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }
  
  /**
   * Get engine status
   */
  getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    fps: number;
    frameCount: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      isPaused: this.gameState.isPaused,
      fps: this.fps,
      frameCount: this.frameCount,
      uptime: this.isRunning ? performance.now() - this.lastFrameTime : 0
    };
  }
  
  /**
   * Set update callback
   */
  setOnUpdate(callback: (gameState: GameState, deltaTime: number) => void): void {
    this.onUpdateCallback = callback;
  }
  
  /**
   * Set render callback
   */
  setOnRender(callback: (renderData: any) => void): void {
    this.onRenderCallback = callback;
  }
  
  /**
   * Set game event callback
   */
  setOnGameEvent(callback: (event: GameEvent) => void): void {
    this.onGameEventCallback = callback;
  }
  
  /**
   * Configure engine settings
   */
  configure(settings: {
    targetFPS?: number;
    gameMode?: 'deathmatch' | 'survival' | 'practice';
    scoreLimit?: number;
    timeLimit?: number;
  }): void {
    if (settings.targetFPS) {
      this.targetFPS = settings.targetFPS;
      this.frameInterval = 1000 / this.targetFPS;
    }
    
    if (settings.gameMode) {
      this.gameState.gameMode = settings.gameMode;
    }
    
    if (settings.scoreLimit) {
      this.gameState.scoreLimit = settings.scoreLimit;
    }
    
    if (settings.timeLimit) {
      this.gameState.timeLimit = settings.timeLimit;
    }
  }
  
  /**
   * Reset the game engine to initial state
   */
  reset(): void {
    this.stop();
    this.gameState.reset();
    this.resetPerformanceMetrics();
    this.frameCount = 0;
    this.fps = 0;
    
    this.emitGameEvent({
      type: 'engine_reset',
      timestamp: Date.now()
    });
  }
}

// Type definitions
export interface PlayerInput {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  shoot: boolean;
}

export interface GameEvent {
  type: 'engine_started' | 'engine_stopped' | 'engine_reset' | 
        'game_paused' | 'game_resumed' | 'match_started' | 'match_ended' |
        'player_joined' | 'player_left' | 'player_killed' | 'player_respawned';
  timestamp: number;
  data?: any;
}