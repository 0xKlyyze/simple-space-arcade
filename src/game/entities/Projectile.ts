import { Vector2D } from '../physics/Vector2D';
import { Movement } from '../physics/Movement';
import { GAME_CONSTANTS } from '../../utils/Constants';
import { MathUtils } from '../../utils/MathUtils';

/**
 * Projectile entity representing a bullet fired by a ship
 * Handles movement, collision detection, and lifecycle management
 */
export class Projectile {
  // Position and movement
  public position: Vector2D;
  public velocity: Vector2D;
  public direction: Vector2D;
  
  // Projectile properties
  public ownerId: number; // ID of the ship that fired this projectile
  public damage: number;
  public speed: number;
  public size: number;
  public collisionRadius: number;
  
  // Lifecycle properties
  public isActive: boolean;
  public createdAt: number;
  public lifespan: number;
  
  // Visual properties
  public color: string;
  
  constructor(ownerId: number, startPosition: Vector2D, direction: Vector2D, color: string) {
    this.ownerId = ownerId;
    this.color = color;
    
    // Initialize position and movement
    this.position = startPosition.clone();
    this.direction = direction.clone().normalize();
    this.speed = GAME_CONSTANTS.PROJECTILE.SPEED;
    this.velocity = this.direction.clone().multiply(this.speed);
    
    // Initialize projectile properties
    this.damage = GAME_CONSTANTS.PROJECTILE.DAMAGE;
    this.size = GAME_CONSTANTS.PROJECTILE.SIZE;
    this.collisionRadius = GAME_CONSTANTS.PROJECTILE.COLLISION_RADIUS;
    
    // Initialize lifecycle properties
    this.isActive = true;
    this.createdAt = Date.now();
    this.lifespan = GAME_CONSTANTS.PROJECTILE.LIFESPAN;
  }
  
  /**
   * Update projectile physics and state
   */
  update(deltaTime: number): void {
    if (!this.isActive) {
      return;
    }
    
    this.updatePosition(deltaTime);
    this.checkLifespan();
    this.handleBoundaries();
  }
  
  /**
   * Update projectile position based on velocity
   */
  private updatePosition(deltaTime: number): void {
    Movement.applyVelocity(this.position, this.velocity, deltaTime / 1000);
  }
  
  /**
   * Check if projectile has exceeded its lifespan
   */
  private checkLifespan(): void {
    const currentTime = Date.now();
    const age = currentTime - this.createdAt;
    
    if (age >= this.lifespan) {
      this.destroy();
    }
  }
  
  /**
   * Handle screen boundaries (destroy when out of bounds)
   */
  private handleBoundaries(): void {
    const bounds = {
      width: GAME_CONSTANTS.CANVAS.WIDTH,
      height: GAME_CONSTANTS.CANVAS.HEIGHT,
      x: 0,
      y: 0
    };
    
    // Check if projectile is out of bounds
    if (!Movement.isWithinBounds(this.position, bounds)) {
      this.destroy();
    }
  }
  
  /**
   * Check collision with a circular object
   */
  checkCollision(targetPosition: Vector2D, targetRadius: number): boolean {
    if (!this.isActive) {
      return false;
    }
    
    const distance = this.position.distanceTo(targetPosition);
    return distance <= (this.collisionRadius + targetRadius);
  }
  
  /**
   * Check collision with a ship entity
   */
  checkShipCollision(ship: { position: Vector2D; collisionRadius: number; playerId: number; isAlive: boolean }): boolean {
    // Don't collide with own ship or dead ships
    if (!this.isActive || !ship.isAlive || ship.playerId === this.ownerId) {
      return false;
    }
    
    return this.checkCollision(ship.position, ship.collisionRadius);
  }
  
  /**
   * Handle collision with a target
   */
  onCollision(): void {
    this.destroy();
  }
  
  /**
   * Destroy the projectile
   */
  destroy(): void {
    this.isActive = false;
  }
  
  /**
   * Get projectile's current state for rendering
   */
  getRenderData(): {
    position: Vector2D;
    direction: Vector2D;
    size: number;
    color: string;
    isActive: boolean;
  } {
    return {
      position: this.position.clone(),
      direction: this.direction.clone(),
      size: this.size,
      color: this.color,
      isActive: this.isActive
    };
  }
  
  /**
   * Get projectile's collision bounds
   */
  getCollisionBounds(): { center: Vector2D; radius: number } {
    return {
      center: this.position.clone(),
      radius: this.collisionRadius
    };
  }
  
  /**
   * Get the age of the projectile in milliseconds
   */
  getAge(): number {
    return Date.now() - this.createdAt;
  }
  
  /**
   * Get the remaining lifespan as a percentage (0-1)
   */
  getLifespanPercentage(): number {
    const age = this.getAge();
    return Math.max(0, 1 - (age / this.lifespan));
  }
  
  /**
   * Check if projectile is near the end of its lifespan
   */
  isNearExpiry(threshold: number = 0.2): boolean {
    return this.getLifespanPercentage() <= threshold;
  }
  
  /**
   * Serialize projectile state for network transmission
   */
  serialize(): any {
    return {
      ownerId: this.ownerId,
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      direction: { x: this.direction.x, y: this.direction.y },
      damage: this.damage,
      speed: this.speed,
      isActive: this.isActive,
      createdAt: this.createdAt,
      color: this.color
    };
  }
  
  /**
   * Deserialize projectile state from network data
   */
  deserialize(data: any): void {
    this.position.set(data.position.x, data.position.y);
    this.velocity.set(data.velocity.x, data.velocity.y);
    this.direction.set(data.direction.x, data.direction.y);
    this.damage = data.damage;
    this.speed = data.speed;
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
    this.color = data.color;
  }
  
  /**
   * Create a copy of this projectile
   */
  clone(): Projectile {
    const clone = new Projectile(this.ownerId, this.position, this.direction, this.color);
    clone.deserialize(this.serialize());
    return clone;
  }
  
  /**
   * Static method to create a projectile from ship data
   */
  static fromShip(ship: {
    playerId: number;
    position: Vector2D;
    rotation: number;
    color: string;
  }): Projectile {
    const spawnOffset = Vector2D.fromAngle(
      ship.rotation,
      GAME_CONSTANTS.SHIP.PROJECTILE_SPAWN_DISTANCE
    );
    const spawnPosition = ship.position.clone().add(spawnOffset);
    const direction = Vector2D.fromAngle(ship.rotation, 1);
    
    return new Projectile(ship.playerId, spawnPosition, direction, ship.color);
  }
}