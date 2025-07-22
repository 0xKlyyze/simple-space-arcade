import { Ship } from '../entities/Ship';
import { Projectile } from '../entities/Projectile';
import { Vector2D } from '../physics/Vector2D';
import { GAME_CONSTANTS } from '../../utils/Constants';
import { MathUtils } from '../../utils/MathUtils';

/**
 * Represents the current state of the game
 * Manages all entities, game logic, and state transitions
 */
export class GameState {
  // Game entities
  public ships: Map<number, Ship>;
  public projectiles: Projectile[];
  
  // Game state
  public isRunning: boolean;
  public isPaused: boolean;
  public gameStartTime: number;
  public lastUpdateTime: number;
  
  // Player management
  public players: Map<number, {
    id: number;
    name: string;
    score: number;
    kills: number;
    deaths: number;
    isConnected: boolean;
  }>;
  
  // Game settings
  public maxPlayers: number;
  public gameMode: 'deathmatch' | 'survival' | 'practice';
  public scoreLimit: number;
  public timeLimit: number; // in milliseconds
  
  // Match state
  public matchStartTime: number;
  public matchEndTime: number;
  public isMatchActive: boolean;
  public winner: number | null;
  
  constructor() {
    this.ships = new Map();
    this.projectiles = [];
    
    this.isRunning = false;
    this.isPaused = false;
    this.gameStartTime = 0;
    this.lastUpdateTime = 0;
    
    this.players = new Map();
    
    // Default game settings
    this.maxPlayers = GAME_CONSTANTS.GAME.MAX_PLAYERS;
    this.gameMode = 'deathmatch';
    this.scoreLimit = GAME_CONSTANTS.GAME.SCORE_LIMIT;
    this.timeLimit = GAME_CONSTANTS.GAME.TIME_LIMIT;
    
    this.matchStartTime = 0;
    this.matchEndTime = 0;
    this.isMatchActive = false;
    this.winner = null;
  }
  
  /**
   * Initialize the game state
   */
  initialize(): void {
    this.reset();
    this.gameStartTime = Date.now();
    this.lastUpdateTime = this.gameStartTime;
    this.isRunning = true;
  }
  
  /**
   * Reset the game state to initial conditions
   */
  reset(): void {
    this.ships.clear();
    this.projectiles = [];
    
    this.isRunning = false;
    this.isPaused = false;
    this.isMatchActive = false;
    this.winner = null;
    
    // Reset player scores but keep player data
    this.players.forEach(player => {
      player.score = 0;
      player.kills = 0;
      player.deaths = 0;
    });
  }
  
  /**
   * Start a new match
   */
  startMatch(): void {
    this.reset();
    this.matchStartTime = Date.now();
    this.isMatchActive = true;
    this.isRunning = true;
    
    // Spawn all connected players
    this.players.forEach(player => {
      if (player.isConnected) {
        this.spawnPlayer(player.id);
      }
    });
  }
  
  /**
   * End the current match
   */
  endMatch(winnerId?: number): void {
    this.isMatchActive = false;
    this.matchEndTime = Date.now();
    this.winner = winnerId || null;
    
    // Stop all ships
    this.ships.forEach(ship => {
      ship.setInput({
        thrust: false,
        rotateLeft: false,
        rotateRight: false,
        shoot: false
      });
    });
  }
  
  /**
   * Update the game state
   */
  update(currentTime: number): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }
    
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Update ships
    this.updateShips(deltaTime);
    
    // Update projectiles
    this.updateProjectiles(deltaTime);
    
    // Handle collisions
    this.handleCollisions();
    
    // Clean up inactive projectiles
    this.cleanupProjectiles();
    
    // Check win conditions
    this.checkWinConditions(currentTime);
  }
  
  /**
   * Update all ships
   */
  private updateShips(deltaTime: number): void {
    this.ships.forEach(ship => {
      ship.update(deltaTime);
      
      // Handle shooting
      if (ship.input.shoot && ship.canShoot(Date.now())) {
        this.createProjectile(ship);
        ship.recordShot(Date.now());
      }
    });
  }
  
  /**
   * Update all projectiles
   */
  private updateProjectiles(deltaTime: number): void {
    this.projectiles.forEach(projectile => {
      projectile.update(deltaTime);
    });
  }
  
  /**
   * Handle all collision detection
   */
  private handleCollisions(): void {
    // Check projectile-ship collisions
    for (const projectile of this.projectiles) {
      if (!projectile.isActive) continue;
      
      for (const ship of this.ships.values()) {
        if (projectile.checkShipCollision(ship)) {
          this.handleProjectileHit(projectile, ship);
          break;
        }
      }
    }
  }
  
  /**
   * Handle projectile hitting a ship
   */
  private handleProjectileHit(projectile: Projectile, ship: Ship): void {
    const wasKilled = ship.takeDamage(projectile.damage, Date.now());
    projectile.onCollision();
    
    if (wasKilled) {
      this.handleShipDestroyed(ship, projectile.ownerId);
    }
  }
  
  /**
   * Handle ship destruction
   */
  private handleShipDestroyed(ship: Ship, killerId: number): void {
    const victim = this.players.get(ship.playerId);
    const killer = this.players.get(killerId);
    
    if (victim) {
      victim.deaths++;
    }
    
    if (killer && killerId !== ship.playerId) {
      killer.kills++;
      killer.score += GAME_CONSTANTS.GAME.KILL_SCORE;
    }
    
    // Schedule respawn
    setTimeout(() => {
      this.respawnPlayer(ship.playerId);
    }, GAME_CONSTANTS.GAME.RESPAWN_DELAY);
  }
  
  /**
   * Clean up inactive projectiles
   */
  private cleanupProjectiles(): void {
    this.projectiles = this.projectiles.filter(projectile => projectile.isActive);
  }
  
  /**
   * Check win conditions
   */
  private checkWinConditions(currentTime: number): void {
    if (!this.isMatchActive) {
      return;
    }
    
    // Check score limit
    for (const player of this.players.values()) {
      if (player.score >= this.scoreLimit) {
        this.endMatch(player.id);
        return;
      }
    }
    
    // Check time limit
    if (this.timeLimit > 0) {
      const matchDuration = currentTime - this.matchStartTime;
      if (matchDuration >= this.timeLimit) {
        // Find player with highest score
        let highestScore = -1;
        let winnerId: number | null = null;
        
        this.players.forEach(player => {
          if (player.score > highestScore) {
            highestScore = player.score;
            winnerId = player.id;
          }
        });
        
        this.endMatch(winnerId || undefined);
      }
    }
  }
  
  /**
   * Add a player to the game
   */
  addPlayer(playerId: number, playerName: string): boolean {
    if (this.players.size >= this.maxPlayers) {
      return false;
    }
    
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      score: 0,
      kills: 0,
      deaths: 0,
      isConnected: true
    });
    
    return true;
  }
  
  /**
   * Remove a player from the game
   */
  removePlayer(playerId: number): void {
    this.players.delete(playerId);
    this.ships.delete(playerId);
  }
  
  /**
   * Spawn a player's ship
   */
  spawnPlayer(playerId: number): void {
    const player = this.players.get(playerId);
    if (!player || !player.isConnected) {
      return;
    }
    
    const spawnPosition = this.getSpawnPosition(playerId);
    const ship = new Ship(playerId, spawnPosition);
    this.ships.set(playerId, ship);
  }
  
  /**
   * Respawn a player's ship
   */
  respawnPlayer(playerId: number): void {
    const ship = this.ships.get(playerId);
    if (!ship) {
      this.spawnPlayer(playerId);
      return;
    }
    
    const spawnPosition = this.getSpawnPosition(playerId);
    ship.respawn(spawnPosition, Date.now());
  }
  
  /**
   * Get spawn position for a player
   */
  private getSpawnPosition(playerId: number): Vector2D {
    const spawnPositions = GAME_CONSTANTS.SPAWN_POSITIONS;
    const index = playerId % spawnPositions.length;
    return new Vector2D(spawnPositions[index].x, spawnPositions[index].y);
  }
  
  /**
   * Create a projectile from a ship
   */
  private createProjectile(ship: Ship): void {
    const spawnData = ship.getProjectileSpawnData();
    const projectile = new Projectile(
      ship.playerId,
      spawnData.position,
      spawnData.direction,
      ship.color
    );
    
    this.projectiles.push(projectile);
  }
  
  /**
   * Set player input
   */
  setPlayerInput(playerId: number, input: any): void {
    const ship = this.ships.get(playerId);
    if (ship) {
      ship.setInput(input);
    }
  }
  
  /**
   * Get game state for rendering
   */
  getRenderData(): {
    ships: any[];
    projectiles: any[];
    players: any[];
    gameInfo: {
      isRunning: boolean;
      isPaused: boolean;
      isMatchActive: boolean;
      timeRemaining: number;
      winner: number | null;
    };
  } {
    const ships = Array.from(this.ships.values()).map(ship => ship.getRenderData());
    const projectiles = this.projectiles.map(projectile => projectile.getRenderData());
    const players = Array.from(this.players.values());
    
    const timeRemaining = this.timeLimit > 0 && this.isMatchActive
      ? Math.max(0, this.timeLimit - (Date.now() - this.matchStartTime))
      : 0;
    
    return {
      ships,
      projectiles,
      players,
      gameInfo: {
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        isMatchActive: this.isMatchActive,
        timeRemaining,
        winner: this.winner
      }
    };
  }
  
  /**
   * Serialize game state for network transmission
   */
  serialize(): any {
    return {
      ships: Array.from(this.ships.entries()).map(([id, ship]) => [id, ship.serialize()]),
      projectiles: this.projectiles.map(p => p.serialize()),
      players: Array.from(this.players.entries()),
      gameInfo: {
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        isMatchActive: this.isMatchActive,
        matchStartTime: this.matchStartTime,
        winner: this.winner
      }
    };
  }
  
  /**
   * Deserialize game state from network data
   */
  deserialize(data: any): void {
    // Restore ships
    this.ships.clear();
    data.ships.forEach(([id, shipData]: [number, any]) => {
      const spawnPos = new Vector2D(shipData.position.x, shipData.position.y);
      const ship = new Ship(id, spawnPos);
      ship.deserialize(shipData);
      this.ships.set(id, ship);
    });
    
    // Restore projectiles
    this.projectiles = data.projectiles.map((projData: any) => {
      const pos = new Vector2D(projData.position.x, projData.position.y);
      const dir = new Vector2D(projData.direction.x, projData.direction.y);
      const projectile = new Projectile(projData.ownerId, pos, dir, projData.color);
      projectile.deserialize(projData);
      return projectile;
    });
    
    // Restore players
    this.players.clear();
    data.players.forEach(([id, playerData]: [number, any]) => {
      this.players.set(id, playerData);
    });
    
    // Restore game info
    this.isRunning = data.gameInfo.isRunning;
    this.isPaused = data.gameInfo.isPaused;
    this.isMatchActive = data.gameInfo.isMatchActive;
    this.matchStartTime = data.gameInfo.matchStartTime;
    this.winner = data.gameInfo.winner;
  }
}