import { Vector2D } from './physics/Vector2D';

// Type alias for Vector2D for easier usage
export type { Vector2D };

/**
 * Represents a player in the game
 */
export interface Player {
  id: number;
  peerId: string;
  name: string;
  position: Vector2D;
  velocity: Vector2D;
  rotation: number;
  health: number;
  maxHealth: number;
  score: number;
  isAlive: boolean;
  lastInputTime: number;
}

/**
 * Represents a projectile in the game
 */
export interface Projectile {
  id: string;
  playerId: number;
  position: Vector2D;
  velocity: Vector2D;
  rotation: number;
  damage: number;
  createdAt: number;
  lifespan: number;
}

/**
 * Represents a power-up in the game
 */
export interface PowerUp {
  id: string;
  type: 'health' | 'speed' | 'damage' | 'shield';
  position: Vector2D;
  createdAt: number;
  duration: number;
}

/**
 * Represents the current game state
 */
export interface GameState {
  // Game metadata
  gameId: string;
  isActive: boolean;
  isPaused: boolean;
  gameMode: 'singleplayer' | 'multiplayer';
  startTime: number;
  lastUpdateTime: number;
  
  // Players
  players: Map<number, Player>;
  maxPlayers: number;
  
  // Game objects
  projectiles: Map<string, Projectile>;
  powerUps: Map<string, PowerUp>;
  
  // Game settings
  worldBounds: {
    width: number;
    height: number;
  };
  
  // Game statistics
  gameStats: {
    totalShots: number;
    totalHits: number;
    totalKills: number;
    gameTime: number;
  };
}

/**
 * Creates an initial game state
 */
export function createInitialGameState(gameId: string, worldWidth: number = 800, worldHeight: number = 600): GameState {
  return {
    gameId,
    isActive: false,
    isPaused: false,
    gameMode: 'multiplayer',
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    
    players: new Map(),
    maxPlayers: 4,
    
    projectiles: new Map(),
    powerUps: new Map(),
    
    worldBounds: {
      width: worldWidth,
      height: worldHeight
    },
    
    gameStats: {
      totalShots: 0,
      totalHits: 0,
      totalKills: 0,
      gameTime: 0
    }
  };
}

/**
 * Creates a new player
 */
export function createPlayer(id: number, peerId: string, name: string, spawnPosition: Vector2D): Player {
  return {
    id,
    peerId,
    name,
    position: { ...spawnPosition },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    health: 100,
    maxHealth: 100,
    score: 0,
    isAlive: true,
    lastInputTime: Date.now()
  };
}

/**
 * Creates a new projectile
 */
export function createProjectile(id: string, playerId: number, position: Vector2D, velocity: Vector2D, rotation: number): Projectile {
  return {
    id,
    playerId,
    position: { ...position },
    velocity: { ...velocity },
    rotation,
    damage: 25,
    createdAt: Date.now(),
    lifespan: 3000 // 3 seconds
  };
}

/**
 * Creates a new power-up
 */
export function createPowerUp(id: string, type: PowerUp['type'], position: Vector2D): PowerUp {
  return {
    id,
    type,
    position: { ...position },
    createdAt: Date.now(),
    duration: 30000 // 30 seconds
  };
}