import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Ship } from '../game/entities/Ship';
import { Projectile } from '../game/entities/Projectile';
import { GameState } from '../game/core/GameState';
import { Vector2D } from '../game/physics/Vector2D';
import { GAME_CONSTANTS } from '../utils/Constants';
import styles from './GameCanvas.module.css';

// Asset loading interface
interface GameAssets {
  ship1: HTMLImageElement;
  ship2: HTMLImageElement;
  projectile: HTMLImageElement;
}

// Asset loading utility
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Load all game assets
const loadGameAssets = async (): Promise<GameAssets> => {
  const [ship1, ship2, projectile] = await Promise.all([
    loadImage('/assets/ship1.svg'),
    loadImage('/assets/ship2.svg'),
    loadImage('/assets/projectile.svg')
  ]);
  
  return { ship1, ship2, projectile };
};

interface GameCanvasProps {
  gameData?: any;
  gameState?: GameState;
  width?: number;
  height?: number;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => void;
  showDebugInfo?: boolean;
  showPerformanceMetrics?: boolean;
  performanceMetrics?: any;
}

/**
 * GameCanvas component for rendering the game
 * Handles all visual rendering including ships, projectiles, effects, and UI overlays
 */
export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameData,
  gameState,
  width = GAME_CONSTANTS.CANVAS.WIDTH,
  height = GAME_CONSTANTS.CANVAS.HEIGHT,
  className,
  onCanvasReady,
  showDebugInfo = false,
  showPerformanceMetrics = false,
  performanceMetrics
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  
  // Load game assets
  useEffect(() => {
    const loadAssets = async () => {
      try {
        setAssetsLoading(true);
        setAssetsError(null);
        const gameAssets = await loadGameAssets();
        setAssets(gameAssets);
      } catch (error) {
        console.error('Failed to load game assets:', error);
        setAssetsError('Failed to load game assets. Using fallback rendering.');
      } finally {
        setAssetsLoading(false);
      }
    };
    
    loadAssets();
  }, []);
  
  // Initialize canvas and context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    contextRef.current = context;
    
    // Set canvas properties
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    setIsCanvasReady(true);
    
    // Notify parent component
    if (onCanvasReady) {
      onCanvasReady(canvas, context);
    }
  }, [onCanvasReady]);
  
  // Clear canvas
  const clearCanvas = useCallback(() => {
    const context = contextRef.current;
    if (!context) return;
    
    context.fillStyle = GAME_CONSTANTS.CANVAS.BACKGROUND_COLOR;
    context.fillRect(0, 0, width, height);
  }, [width, height]);
  
  // Draw ship
  const drawShip = useCallback((ship: Ship, context: CanvasRenderingContext2D) => {
    if (!ship.isAlive) return;
    
    context.save();
    
    // Move to ship position
    context.translate(ship.position.x, ship.position.y);
    context.rotate(ship.rotation);
    
    // Draw ship sprite if assets are loaded, otherwise fallback to basic shape
    if (assets) {
      const shipSprite = ship.playerId === 0 ? assets.ship1 : assets.ship2;
      const spriteSize = GAME_CONSTANTS.SHIP.SIZE * 2; // Scale up the 32px sprite
      
      // Draw ship sprite centered
      context.drawImage(
        shipSprite,
        -spriteSize / 2,
        -spriteSize / 2,
        spriteSize,
        spriteSize
      );
    } else {
      // Fallback to basic shape rendering
      context.fillStyle = ship.color || GAME_CONSTANTS.COLORS.PLAYER_1;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      
      // Ship triangle shape
      context.beginPath();
      context.moveTo(GAME_CONSTANTS.SHIP.SIZE, 0);
      context.lineTo(-GAME_CONSTANTS.SHIP.SIZE / 2, -GAME_CONSTANTS.SHIP.SIZE / 2);
      context.lineTo(-GAME_CONSTANTS.SHIP.SIZE / 4, 0);
      context.lineTo(-GAME_CONSTANTS.SHIP.SIZE / 2, GAME_CONSTANTS.SHIP.SIZE / 2);
      context.closePath();
      
      context.fill();
      context.stroke();
    }
    
    // Draw thrust effect if accelerating
    if (ship.isAccelerating) {
      context.fillStyle = '#ff6600';
      context.beginPath();
      context.moveTo(-GAME_CONSTANTS.SHIP.SIZE / 4, -GAME_CONSTANTS.SHIP.SIZE / 4);
      context.lineTo(-GAME_CONSTANTS.SHIP.SIZE, 0);
      context.lineTo(-GAME_CONSTANTS.SHIP.SIZE / 4, GAME_CONSTANTS.SHIP.SIZE / 4);
      context.closePath();
      context.fill();
    }
    
    // Draw health bar
    if (ship.health < ship.maxHealth) {
      const barWidth = GAME_CONSTANTS.SHIP.SIZE * 1.5;
      const barHeight = 4;
      const healthPercent = ship.health / ship.maxHealth;
      
      context.fillStyle = '#333333';
      context.fillRect(-barWidth / 2, -GAME_CONSTANTS.SHIP.SIZE - 15, barWidth, barHeight);
      
      context.fillStyle = healthPercent > 0.5 ? GAME_CONSTANTS.COLORS.HEALTH_FULL : 
                         healthPercent > 0.25 ? '#ffff00' : 
                         GAME_CONSTANTS.COLORS.HEALTH_LOW;
      context.fillRect(-barWidth / 2, -GAME_CONSTANTS.SHIP.SIZE - 15, barWidth * healthPercent, barHeight);
    }
    
    // Draw shield effect if active
    if (ship.shieldActive) {
      context.strokeStyle = '#00ffff';
      context.lineWidth = 3;
      context.globalAlpha = 0.6;
      context.beginPath();
      context.arc(0, 0, GAME_CONSTANTS.SHIP.SIZE * 1.5, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
    
    context.restore();
  }, [assets]);
  
  // Draw projectile
  const drawProjectile = useCallback((projectile: Projectile, context: CanvasRenderingContext2D) => {
    if (!projectile.isActive) return;
    
    context.save();
    
    // Draw projectile sprite if assets are loaded, otherwise fallback to basic shape
    if (assets) {
      const spriteSize = GAME_CONSTANTS.PROJECTILE.SIZE * 2; // Scale up the 8px sprite
      
      // Draw projectile sprite centered
      context.drawImage(
        assets.projectile,
        projectile.position.x - spriteSize / 2,
        projectile.position.y - spriteSize / 2,
        spriteSize,
        spriteSize
      );
    } else {
      // Fallback to basic shape rendering
      context.fillStyle = projectile.color || GAME_CONSTANTS.COLORS.PROJECTILE;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1;
      
      // Draw projectile as a small circle
      context.beginPath();
      context.arc(projectile.position.x, projectile.position.y, GAME_CONSTANTS.PROJECTILE.SIZE, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    
    // Draw trail effect
    if (projectile.velocity.magnitude() > 0) {
      const trailLength = 10;
      const trailDirection = projectile.velocity.normalized().multiply(-trailLength);
      const trailEnd = projectile.position.add(trailDirection);
      
      const gradient = context.createLinearGradient(
        projectile.position.x, projectile.position.y,
        trailEnd.x, trailEnd.y
      );
      gradient.addColorStop(0, projectile.color || GAME_CONSTANTS.COLORS.PROJECTILE);
      gradient.addColorStop(1, 'transparent');
      
      context.strokeStyle = gradient;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(projectile.position.x, projectile.position.y);
      context.lineTo(trailEnd.x, trailEnd.y);
      context.stroke();
    }
    
    context.restore();
  }, [assets]);
  
  // Draw background stars
  const drawStars = useCallback((context: CanvasRenderingContext2D) => {
    context.fillStyle = GAME_CONSTANTS.COLORS.BACKGROUND_STARS;
    
    // Generate consistent star pattern
    for (let i = 0; i < 100; i++) {
      const x = (i * 37) % width;
      const y = (i * 73) % height;
      const size = (i % 3) + 1;
      
      context.beginPath();
      context.arc(x, y, size * 0.5, 0, Math.PI * 2);
      context.fill();
    }
  }, [width, height]);
  
  // Draw debug information
  const drawDebugInfo = useCallback((context: CanvasRenderingContext2D) => {
    if (!showDebugInfo || !gameState) return;
    
    context.fillStyle = GAME_CONSTANTS.COLORS.UI_PRIMARY;
    context.font = '12px monospace';
    
    let y = 20;
    const lineHeight = 15;
    
    // Game state info
    context.fillText(`Game State: ${gameState.gameStatus}`, 10, y);
    y += lineHeight;
    context.fillText(`Players: ${gameState.players.size}`, 10, y);
    y += lineHeight;
    context.fillText(`Ships: ${gameState.ships.length}`, 10, y);
    y += lineHeight;
    context.fillText(`Projectiles: ${gameState.projectiles.length}`, 10, y);
    y += lineHeight;
    
    // Ship debug info
    gameState.ships.forEach((ship, index) => {
      if (ship.isAlive) {
        context.fillText(
          `Ship ${index}: (${ship.position.x.toFixed(1)}, ${ship.position.y.toFixed(1)}) ` +
          `Health: ${ship.health}/${ship.maxHealth}`,
          10, y
        );
        y += lineHeight;
      }
    });
  }, [showDebugInfo, gameState]);
  
  // Draw performance metrics
  const drawPerformanceMetrics = useCallback((context: CanvasRenderingContext2D) => {
    if (!showPerformanceMetrics || !performanceMetrics) return;
    
    context.fillStyle = GAME_CONSTANTS.COLORS.UI_PRIMARY;
    context.font = '12px monospace';
    
    const x = width - 150;
    let y = 20;
    const lineHeight = 15;
    
    context.fillText(`FPS: ${performanceMetrics.fps || 0}`, x, y);
    y += lineHeight;
    context.fillText(`Frame Time: ${(performanceMetrics.frameTime || 0).toFixed(2)}ms`, x, y);
    y += lineHeight;
    context.fillText(`Update Time: ${(performanceMetrics.updateTime || 0).toFixed(2)}ms`, x, y);
    y += lineHeight;
    context.fillText(`Render Time: ${(performanceMetrics.renderTime || 0).toFixed(2)}ms`, x, y);
  }, [showPerformanceMetrics, performanceMetrics, width]);
  
  // Main render function
  const render = useCallback(() => {
    const context = contextRef.current;
    if (!context || !isCanvasReady) return;
    
    // Clear canvas
    clearCanvas();
    
    // Draw background
    drawStars(context);
    
    // Draw game objects if game data is available
    if (gameData || gameState) {
      const state = gameData || gameState;
      
      // Draw ships
      if (state.ships) {
        state.ships.forEach((ship: Ship) => {
          drawShip(ship, context);
        });
      }
      
      // Draw projectiles
      if (state.projectiles) {
        state.projectiles.forEach((projectile: Projectile) => {
          drawProjectile(projectile, context);
        });
      }
    }
    
    // Draw debug information
    drawDebugInfo(context);
    
    // Draw performance metrics
    drawPerformanceMetrics(context);
  }, [isCanvasReady, clearCanvas, drawStars, drawShip, drawProjectile, drawDebugInfo, drawPerformanceMetrics, gameData, gameState]);
  
  // Render on data changes
  useEffect(() => {
    render();
  }, [render]);
  
  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = width;
    canvas.height = height;
    
    // Re-render after resize
    render();
  }, [width, height, render]);
  
  return (
    <div className={`${styles.canvasContainer} ${className || ''}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.gameCanvas}
      />
      
      {/* Asset loading overlay */}
      {assetsLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContent}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading game assets...</p>
          </div>
        </div>
      )}
      
      {/* Asset loading error */}
      {assetsError && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorContent}>
            <h3>⚠️ Asset Loading Error</h3>
            <p>{assetsError}</p>
            <p>Game will use fallback graphics.</p>
          </div>
        </div>
      )}
      
      {/* Game overlay UI */}
      <div className={styles.gameOverlay}>
        {gameState?.gameStatus === 'paused' && (
          <div className={styles.pauseOverlay}>
            <h2>PAUSED</h2>
            <p>Press ESC to resume</p>
          </div>
        )}
        
        {gameState?.gameStatus === 'ended' && (
          <div className={styles.gameOverOverlay}>
            <h2>GAME OVER</h2>
            {gameState.winner && (
              <p>Winner: {gameState.winner.name}</p>
            )}
            <p>Press R to restart</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameCanvas;