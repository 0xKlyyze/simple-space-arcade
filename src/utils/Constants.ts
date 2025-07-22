/**
 * Game constants and configuration values
 * Centralized configuration for all game mechanics
 */
export const GAME_CONSTANTS = {
  // Canvas and viewport settings
  CANVAS: {
    WIDTH: 800,
    HEIGHT: 600,
    BACKGROUND_COLOR: '#0a0a0a'
  },

  // Ship properties
  SHIP: {
    // Movement
    ACCELERATION: 300, // pixels/second²
    MAX_SPEED: 250, // pixels/second
    ROTATION_SPEED: 4, // radians/second
    FRICTION: 0.98, // velocity multiplier per frame
    
    // Combat
    MAX_HEALTH: 100,
    COLLISION_RADIUS: 16, // pixels
    RESPAWN_TIME: 3000, // milliseconds
    INVULNERABILITY_TIME: 2000, // milliseconds after respawn
    
    // Shooting
    SHOOT_COOLDOWN: 250, // milliseconds between shots
    PROJECTILE_SPAWN_DISTANCE: 20, // pixels from ship center
    
    // Visual
    SIZE: 32, // sprite size in pixels
    THRUST_PARTICLE_COUNT: 3
  },

  // Projectile properties
  PROJECTILE: {
    SPEED: 400, // pixels/second
    LIFETIME: 2000, // milliseconds
    DAMAGE: 25, // health points
    COLLISION_RADIUS: 4, // pixels
    SIZE: 8, // sprite size in pixels
    MAX_COUNT_PER_PLAYER: 5 // maximum projectiles per player
  },

  // Physics settings
  PHYSICS: {
    FIXED_TIMESTEP: 1000 / 60, // 60 FPS in milliseconds
    MAX_DELTA_TIME: 50, // maximum frame time to prevent spiral of death
    COLLISION_EPSILON: 0.1, // small value for collision detection
    BOUNDARY_BUFFER: 50 // pixels outside canvas before cleanup
  },

  // Game mechanics
  GAME: {
    SCORE_TO_WIN: 5, // kills needed to win
    MATCH_TIMEOUT: 300000, // 5 minutes in milliseconds
    COUNTDOWN_TIME: 3000, // milliseconds before game starts
    END_GAME_DELAY: 3000 // milliseconds to show results
  },

  // Network settings
  NETWORK: {
    SYNC_RATE: 20, // times per second to sync game state
    PING_INTERVAL: 1000, // milliseconds between ping messages
    CONNECTION_TIMEOUT: 10000, // milliseconds before connection timeout
    RECONNECT_ATTEMPTS: 3,
    MESSAGE_BUFFER_SIZE: 100
  },

  // Input settings
  INPUT: {
    DEADZONE: 0.1, // for analog inputs (future gamepad support)
    KEY_REPEAT_DELAY: 100, // milliseconds
    DOUBLE_TAP_TIME: 300 // milliseconds for double-tap detection
  },

  // Visual effects
  EFFECTS: {
    EXPLOSION_DURATION: 500, // milliseconds
    HIT_FLASH_DURATION: 100, // milliseconds
    PARTICLE_COUNT: 10,
    SCREEN_SHAKE_INTENSITY: 5, // pixels
    SCREEN_SHAKE_DURATION: 200 // milliseconds
  },

  // UI settings
  UI: {
    HEALTH_BAR_WIDTH: 100,
    HEALTH_BAR_HEIGHT: 10,
    SCORE_FONT_SIZE: 24,
    HUD_MARGIN: 20, // pixels from screen edge
    NOTIFICATION_DURATION: 2000 // milliseconds
  },

  // Audio settings (for future implementation)
  AUDIO: {
    MASTER_VOLUME: 0.7,
    SFX_VOLUME: 0.8,
    MUSIC_VOLUME: 0.5
  },

  // Player spawn positions
  SPAWN_POSITIONS: [
    { x: 200, y: 300 }, // Player 1 (left side)
    { x: 600, y: 300 }  // Player 2 (right side)
  ],

  // Colors for players and UI
  COLORS: {
    PLAYER_1: '#00ff88',
    PLAYER_2: '#ff4444',
    PROJECTILE: '#ffff00',
    UI_PRIMARY: '#ffffff',
    UI_SECONDARY: '#cccccc',
    HEALTH_FULL: '#00ff00',
    HEALTH_LOW: '#ff0000',
    BACKGROUND_STARS: '#444444'
  },

  // Debug settings
  DEBUG: {
    SHOW_COLLISION_BOUNDS: false,
    SHOW_FPS: false,
    SHOW_NETWORK_INFO: false,
    LOG_PHYSICS: false
  }
} as const;

// Type definitions for better TypeScript support
export type GameConstants = typeof GAME_CONSTANTS;
export type PlayerSpawnPosition = { readonly x: number; readonly y: number };

// Utility functions for constants
export const getSpawnPosition = (playerIndex: number): PlayerSpawnPosition => {
  return GAME_CONSTANTS.SPAWN_POSITIONS[playerIndex] || GAME_CONSTANTS.SPAWN_POSITIONS[0];
};

export const getPlayerColor = (playerIndex: number): string => {
  return playerIndex === 0 ? GAME_CONSTANTS.COLORS.PLAYER_1 : GAME_CONSTANTS.COLORS.PLAYER_2;
};