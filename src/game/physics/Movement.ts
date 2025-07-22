import { Vector2D } from './Vector2D';

/**
 * Movement physics utilities for game entities
 * Handles acceleration, velocity, and boundary checking
 */
export class Movement {
  /**
   * Apply acceleration to velocity with delta time
   */
  static applyAcceleration(
    velocity: Vector2D,
    acceleration: Vector2D,
    deltaTime: number,
    maxSpeed?: number
  ): Vector2D {
    // Apply acceleration
    const accelDelta = acceleration.clone().multiply(deltaTime);
    velocity.add(accelDelta);
    
    // Limit to max speed if specified
    if (maxSpeed !== undefined) {
      velocity.limit(maxSpeed);
    }
    
    return velocity;
  }

  /**
   * Apply velocity to position with delta time
   */
  static applyVelocity(
    position: Vector2D,
    velocity: Vector2D,
    deltaTime: number
  ): Vector2D {
    const velocityDelta = velocity.clone().multiply(deltaTime);
    position.add(velocityDelta);
    return position;
  }

  /**
   * Apply friction/drag to velocity
   */
  static applyFriction(
    velocity: Vector2D,
    friction: number,
    deltaTime: number
  ): Vector2D {
    const frictionForce = velocity.clone().multiply(-friction * deltaTime);
    velocity.add(frictionForce);
    
    // Stop very small velocities to prevent jitter
    if (velocity.magnitudeSquared() < 0.01) {
      velocity.set(0, 0);
    }
    
    return velocity;
  }

  /**
   * Rotate an entity towards a target angle
   */
  static rotateTowards(
    currentAngle: number,
    targetAngle: number,
    rotationSpeed: number,
    deltaTime: number
  ): number {
    // Normalize angles to [-π, π]
    const normalizeAngle = (angle: number): number => {
      while (angle > Math.PI) angle -= 2 * Math.PI;
      while (angle < -Math.PI) angle += 2 * Math.PI;
      return angle;
    };

    const current = normalizeAngle(currentAngle);
    const target = normalizeAngle(targetAngle);
    
    let angleDiff = target - current;
    angleDiff = normalizeAngle(angleDiff);
    
    const maxRotation = rotationSpeed * deltaTime;
    
    if (Math.abs(angleDiff) <= maxRotation) {
      return target;
    }
    
    return current + Math.sign(angleDiff) * maxRotation;
  }

  /**
   * Check if position is within rectangular bounds
   */
  static isWithinBounds(
    position: Vector2D,
    bounds: { width: number; height: number; x?: number; y?: number }
  ): boolean {
    const minX = bounds.x || 0;
    const minY = bounds.y || 0;
    const maxX = minX + bounds.width;
    const maxY = minY + bounds.height;
    
    return position.x >= minX && position.x <= maxX &&
           position.y >= minY && position.y <= maxY;
  }

  /**
   * Wrap position around bounds (for screen wrapping)
   */
  static wrapAroundBounds(
    position: Vector2D,
    bounds: { width: number; height: number; x?: number; y?: number }
  ): Vector2D {
    const minX = bounds.x || 0;
    const minY = bounds.y || 0;
    const maxX = minX + bounds.width;
    const maxY = minY + bounds.height;
    
    if (position.x < minX) position.x = maxX;
    if (position.x > maxX) position.x = minX;
    if (position.y < minY) position.y = maxY;
    if (position.y > maxY) position.y = minY;
    
    return position;
  }

  /**
   * Clamp position within bounds
   */
  static clampToBounds(
    position: Vector2D,
    bounds: { width: number; height: number; x?: number; y?: number }
  ): Vector2D {
    const minX = bounds.x || 0;
    const minY = bounds.y || 0;
    const maxX = minX + bounds.width;
    const maxY = minY + bounds.height;
    
    position.x = Math.max(minX, Math.min(maxX, position.x));
    position.y = Math.max(minY, Math.min(maxY, position.y));
    
    return position;
  }

  /**
   * Calculate trajectory for projectiles
   */
  static calculateTrajectory(
    startPosition: Vector2D,
    angle: number,
    speed: number,
    time: number
  ): Vector2D {
    const velocity = Vector2D.fromAngle(angle, speed);
    const displacement = velocity.multiply(time);
    return startPosition.clone().add(displacement);
  }

  /**
   * Apply simple physics integration (Euler method)
   */
  static integrateEuler(
    position: Vector2D,
    velocity: Vector2D,
    acceleration: Vector2D,
    deltaTime: number
  ): { position: Vector2D; velocity: Vector2D } {
    // Update velocity first
    const newVelocity = velocity.clone();
    Movement.applyAcceleration(newVelocity, acceleration, deltaTime);
    
    // Update position
    const newPosition = position.clone();
    Movement.applyVelocity(newPosition, newVelocity, deltaTime);
    
    return {
      position: newPosition,
      velocity: newVelocity
    };
  }
}