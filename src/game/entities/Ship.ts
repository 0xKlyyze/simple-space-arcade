import { Vector2D } from '../physics/Vector2D';
import { Movement } from '../physics/Movement';
import { GAME_CONSTANTS, getPlayerColor } from '../../utils/Constants';
import { MathUtils } from '../../utils/MathUtils';

/**
 * Ship entity representing a player's spaceship
 * Handles movement, rotation, health, shooting, and rendering
 */
export class Ship {
  // Position and movement
  public position: Vector2D;
  public velocity: Vector2D;
  public acceleration: Vector2D;
  public rotation: number; // in radians
  public angularVelocity: number;

  // Combat properties
  public health: number;
  public maxHealth: number;
  public isAlive: boolean;
  public lastShotTime: number;
  public invulnerableUntil: number;

  // Player identification
  public playerId: number;
  public color: string;

  // Input state
  public input: {
    thrust: boolean;
    rotateLeft: boolean;
    rotateRight: boolean;
    shoot: boolean;
  };

  // Visual properties
  public size: number;
  public collisionRadius: number;

  constructor(playerId: number, spawnPosition: Vector2D) {
    this.playerId = playerId;
    this.color = getPlayerColor(playerId);
    
    // Initialize position and movement
    this.position = spawnPosition.clone();
    this.velocity = new Vector2D(0, 0);
    this.acceleration = new Vector2D(0, 0);
    this.rotation = playerId === 0 ? 0 : Math.PI; // Player 1 faces right, Player 2 faces left
    this.angularVelocity = 0;

    // Initialize combat properties
    this.maxHealth = GAME_CONSTANTS.SHIP.MAX_HEALTH;
    this.health = this.maxHealth;
    this.isAlive = true;
    this.lastShotTime = 0;
    this.invulnerableUntil = 0;

    // Initialize input state
    this.input = {
      thrust: false,
      rotateLeft: false,
      rotateRight: false,
      shoot: false
    };

    // Visual properties
    this.size = GAME_CONSTANTS.SHIP.SIZE;
    this.collisionRadius = GAME_CONSTANTS.SHIP.COLLISION_RADIUS;
  }

  /**
   * Update ship physics and state
   */
  update(deltaTime: number): void {
    if (!this.isAlive) {
      return;
    }

    this.updateRotation(deltaTime);
    this.updateMovement(deltaTime);
    this.updatePosition(deltaTime);
    this.handleBoundaries();
  }

  /**
   * Update ship rotation based on input
   */
  private updateRotation(deltaTime: number): void {
    let rotationInput = 0;
    
    if (this.input.rotateLeft) {
      rotationInput -= 1;
    }
    if (this.input.rotateRight) {
      rotationInput += 1;
    }

    if (rotationInput !== 0) {
      this.rotation += rotationInput * GAME_CONSTANTS.SHIP.ROTATION_SPEED * (deltaTime / 1000);
      this.rotation = MathUtils.normalizeAngle(this.rotation);
    }
  }

  /**
   * Update ship movement based on input and physics
   */
  private updateMovement(deltaTime: number): void {
    // Reset acceleration
    this.acceleration.set(0, 0);

    // Apply thrust if input is active
    if (this.input.thrust) {
      const thrustForce = Vector2D.fromAngle(this.rotation, GAME_CONSTANTS.SHIP.ACCELERATION);
      this.acceleration.add(thrustForce);
    }

    // Apply acceleration to velocity
    Movement.applyAcceleration(
      this.velocity,
      this.acceleration,
      deltaTime / 1000,
      GAME_CONSTANTS.SHIP.MAX_SPEED
    );

    // Apply friction
    Movement.applyFriction(
      this.velocity,
      1 - GAME_CONSTANTS.SHIP.FRICTION,
      deltaTime / 1000
    );
  }

  /**
   * Update ship position based on velocity
   */
  private updatePosition(deltaTime: number): void {
    Movement.applyVelocity(this.position, this.velocity, deltaTime / 1000);
  }

  /**
   * Handle screen boundaries (wrap around)
   */
  private handleBoundaries(): void {
    const bounds = {
      width: GAME_CONSTANTS.CANVAS.WIDTH,
      height: GAME_CONSTANTS.CANVAS.HEIGHT,
      x: 0,
      y: 0
    };

    Movement.wrapAroundBounds(this.position, bounds);
  }

  /**
   * Attempt to shoot a projectile
   */
  canShoot(currentTime: number): boolean {
    if (!this.isAlive) {
      return false;
    }

    const timeSinceLastShot = currentTime - this.lastShotTime;
    return timeSinceLastShot >= GAME_CONSTANTS.SHIP.SHOOT_COOLDOWN;
  }

  /**
   * Get projectile spawn position and direction
   */
  getProjectileSpawnData(): { position: Vector2D; direction: Vector2D } {
    const spawnOffset = Vector2D.fromAngle(
      this.rotation,
      GAME_CONSTANTS.SHIP.PROJECTILE_SPAWN_DISTANCE
    );
    const spawnPosition = this.position.clone().add(spawnOffset);
    const direction = Vector2D.fromAngle(this.rotation, 1);

    return {
      position: spawnPosition,
      direction: direction
    };
  }

  /**
   * Record that a shot was fired
   */
  recordShot(currentTime: number): void {
    this.lastShotTime = currentTime;
  }

  /**
   * Take damage and handle death
   */
  takeDamage(damage: number, currentTime: number): boolean {
    if (!this.isAlive || this.isInvulnerable(currentTime)) {
      return false;
    }

    this.health -= damage;
    
    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return true; // Ship was killed
    }

    return false; // Ship took damage but survived
  }

  /**
   * Check if ship is currently invulnerable
   */
  isInvulnerable(currentTime: number): boolean {
    return currentTime < this.invulnerableUntil;
  }

  /**
   * Handle ship death
   */
  private die(): void {
    this.isAlive = false;
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
  }

  /**
   * Respawn the ship at its spawn position
   */
  respawn(spawnPosition: Vector2D, currentTime: number): void {
    this.position = spawnPosition.clone();
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
    this.rotation = this.playerId === 0 ? 0 : Math.PI;
    
    this.health = this.maxHealth;
    this.isAlive = true;
    this.invulnerableUntil = currentTime + GAME_CONSTANTS.SHIP.INVULNERABILITY_TIME;
    
    // Clear input state
    this.input = {
      thrust: false,
      rotateLeft: false,
      rotateRight: false,
      shoot: false
    };
  }

  /**
   * Update input state
   */
  setInput(input: Partial<typeof this.input>): void {
    Object.assign(this.input, input);
  }

  /**
   * Get ship's current state for rendering
   */
  getRenderData(): {
    position: Vector2D;
    rotation: number;
    color: string;
    size: number;
    health: number;
    maxHealth: number;
    isAlive: boolean;
    isInvulnerable: boolean;
  } {
    return {
      position: this.position.clone(),
      rotation: this.rotation,
      color: this.color,
      size: this.size,
      health: this.health,
      maxHealth: this.maxHealth,
      isAlive: this.isAlive,
      isInvulnerable: this.isInvulnerable(Date.now())
    };
  }

  /**
   * Get ship's collision bounds
   */
  getCollisionBounds(): { center: Vector2D; radius: number } {
    return {
      center: this.position.clone(),
      radius: this.collisionRadius
    };
  }

  /**
   * Serialize ship state for network transmission
   */
  serialize(): any {
    return {
      playerId: this.playerId,
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      rotation: this.rotation,
      health: this.health,
      isAlive: this.isAlive,
      invulnerableUntil: this.invulnerableUntil,
      input: { ...this.input }
    };
  }

  /**
   * Deserialize ship state from network data
   */
  deserialize(data: any): void {
    this.position.set(data.position.x, data.position.y);
    this.velocity.set(data.velocity.x, data.velocity.y);
    this.rotation = data.rotation;
    this.health = data.health;
    this.isAlive = data.isAlive;
    this.invulnerableUntil = data.invulnerableUntil;
    this.input = { ...data.input };
  }

  /**
   * Create a copy of this ship
   */
  clone(): Ship {
    const clone = new Ship(this.playerId, this.position);
    clone.deserialize(this.serialize());
    return clone;
  }
}