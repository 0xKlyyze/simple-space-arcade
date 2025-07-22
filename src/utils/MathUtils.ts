import { Vector2D } from '../game/physics/Vector2D';

/**
 * Mathematical utilities for game calculations
 * Provides angle calculations, collision detection, and other math functions
 */
export class MathUtils {
  /**
   * Convert degrees to radians
   */
  static degToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  static radToDeg(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Normalize angle to range [-π, π]
   */
  static normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Calculate angle between two points
   */
  static angleBetweenPoints(from: Vector2D, to: Vector2D): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  /**
   * Calculate distance between two points
   */
  static distance(point1: Vector2D, point2: Vector2D): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate squared distance (for performance when comparing distances)
   */
  static distanceSquared(point1: Vector2D, point2: Vector2D): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return dx * dx + dy * dy;
  }

  /**
   * Check if two circles are colliding
   */
  static circleCollision(
    center1: Vector2D,
    radius1: number,
    center2: Vector2D,
    radius2: number
  ): boolean {
    const distanceSquared = MathUtils.distanceSquared(center1, center2);
    const radiusSum = radius1 + radius2;
    return distanceSquared <= radiusSum * radiusSum;
  }

  /**
   * Check if a point is inside a circle
   */
  static pointInCircle(
    point: Vector2D,
    circleCenter: Vector2D,
    radius: number
  ): boolean {
    return MathUtils.distanceSquared(point, circleCenter) <= radius * radius;
  }

  /**
   * Check if a point is inside a rectangle
   */
  static pointInRectangle(
    point: Vector2D,
    rectPosition: Vector2D,
    width: number,
    height: number
  ): boolean {
    return point.x >= rectPosition.x &&
           point.x <= rectPosition.x + width &&
           point.y >= rectPosition.y &&
           point.y <= rectPosition.y + height;
  }

  /**
   * Clamp a value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Linear interpolation between two values
   */
  static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Map a value from one range to another
   */
  static map(
    value: number,
    fromMin: number,
    fromMax: number,
    toMin: number,
    toMax: number
  ): number {
    const normalized = (value - fromMin) / (fromMax - fromMin);
    return toMin + normalized * (toMax - toMin);
  }

  /**
   * Generate a random number between min and max
   */
  static random(min: number = 0, max: number = 1): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Check if a number is approximately equal to another (within epsilon)
   */
  static approximately(a: number, b: number, epsilon: number = 0.001): boolean {
    return Math.abs(a - b) < epsilon;
  }

  /**
   * Calculate the shortest angle difference between two angles
   */
  static angleDifference(angle1: number, angle2: number): number {
    const diff = MathUtils.normalizeAngle(angle2 - angle1);
    return diff;
  }

  /**
   * Smooth step interpolation (ease in/out)
   */
  static smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  /**
   * Calculate reflection vector for bouncing
   */
  static reflect(incident: Vector2D, normal: Vector2D): Vector2D {
    const dot = Vector2D.dot(incident, normal);
    return incident.clone().subtract(normal.clone().multiply(2 * dot));
  }

  /**
   * Check if a value is within a range
   */
  static inRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Round to specified decimal places
   */
  static roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}