import React from 'react';
import { GameState } from '../game/core/GameState';
import { Ship } from '../game/entities/Ship';
import styles from './GameUI.module.css';

interface GameUIProps {
  gameState?: GameState;
  currentPlayerId?: number;
  showDebugInfo?: boolean;
  performanceMetrics?: {
    fps: number;
    frameTime: number;
    updateTime: number;
    renderTime: number;
  };
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onQuit?: () => void;
}

/**
 * GameUI component for displaying game interface elements
 * Shows player stats, scores, controls, and game information
 */
export const GameUI: React.FC<GameUIProps> = ({
  gameState,
  currentPlayerId = 0,
  showDebugInfo = false,
  performanceMetrics,
  onPause,
  onResume,
  onRestart,
  onQuit
}) => {
  // Get current player's ship
  const currentPlayerShip = gameState?.ships.find(ship => ship.playerId === currentPlayerId);
  
  // Get all players for scoreboard
  const players = gameState ? Array.from(gameState.players.values()) : [];
  
  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };
  
  return (
    <div className={styles.gameUI}>
      {/* Top HUD */}
      <div className={styles.topHUD}>
        {/* Player Stats */}
        {currentPlayerShip && (
          <div className={styles.playerStats}>
            <div className={styles.playerInfo}>
              <span className={styles.playerName}>
                {gameState?.players.get(currentPlayerId)?.name || `Player ${currentPlayerId + 1}`}
              </span>
              <span className={styles.playerScore}>
                Score: {formatNumber(gameState?.players.get(currentPlayerId)?.score || 0)}
              </span>
            </div>
            
            {/* Health Bar */}
            <div className={styles.healthContainer}>
              <span className={styles.healthLabel}>Health</span>
              <div className={styles.healthBar}>
                <div 
                  className={styles.healthFill}
                  style={{ 
                    width: `${(currentPlayerShip.health / currentPlayerShip.maxHealth) * 100}%`,
                    backgroundColor: currentPlayerShip.health > 50 ? '#00ff00' : 
                                   currentPlayerShip.health > 25 ? '#ffff00' : '#ff0000'
                  }}
                />
              </div>
              <span className={styles.healthText}>
                {currentPlayerShip.health}/{currentPlayerShip.maxHealth}
              </span>
            </div>
            
            {/* Shield Status */}
            {currentPlayerShip.shieldActive && (
              <div className={styles.shieldStatus}>
                <span className={styles.shieldIcon}>🛡️</span>
                <span>Shield Active</span>
              </div>
            )}
          </div>
        )}
        
        {/* Game Timer */}
        {gameState?.gameTimer !== undefined && (
          <div className={styles.gameTimer}>
            <span className={styles.timerLabel}>Time</span>
            <span className={styles.timerValue}>
              {formatTime(gameState.gameTimer)}
            </span>
          </div>
        )}
        
        {/* Game Status */}
        <div className={styles.gameStatus}>
          <span className={`${styles.statusIndicator} ${styles[gameState?.gameStatus || 'waiting']}`}>
            {gameState?.gameStatus?.toUpperCase() || 'WAITING'}
          </span>
        </div>
      </div>
      
      {/* Scoreboard */}
      {players.length > 1 && (
        <div className={styles.scoreboard}>
          <h3 className={styles.scoreboardTitle}>Scoreboard</h3>
          <div className={styles.scoreboardList}>
            {players
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .map((player, index) => (
                <div 
                  key={player.id} 
                  className={`${styles.scoreboardEntry} ${
                    player.id === currentPlayerId ? styles.currentPlayer : ''
                  }`}
                >
                  <span className={styles.playerRank}>#{index + 1}</span>
                  <span className={styles.playerName}>{player.name}</span>
                  <span className={styles.playerScore}>{formatNumber(player.score || 0)}</span>
                  <span className={styles.playerKills}>K: {player.kills || 0}</span>
                  <span className={styles.playerDeaths}>D: {player.deaths || 0}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
      
      {/* Controls Help */}
      <div className={styles.controlsHelp}>
        <h4>Controls</h4>
        <div className={styles.controlsList}>
          <div className={styles.controlItem}>
            <span className={styles.controlKey}>WASD</span>
            <span className={styles.controlAction}>Move</span>
          </div>
          <div className={styles.controlItem}>
            <span className={styles.controlKey}>SPACE</span>
            <span className={styles.controlAction}>Shoot</span>
          </div>
          <div className={styles.controlItem}>
            <span className={styles.controlKey}>ESC</span>
            <span className={styles.controlAction}>Pause</span>
          </div>
          <div className={styles.controlItem}>
            <span className={styles.controlKey}>R</span>
            <span className={styles.controlAction}>Restart</span>
          </div>
        </div>
      </div>
      
      {/* Game Controls */}
      <div className={styles.gameControls}>
        {gameState?.gameStatus === 'running' && onPause && (
          <button className={styles.controlButton} onClick={onPause}>
            ⏸️ Pause
          </button>
        )}
        
        {gameState?.gameStatus === 'paused' && onResume && (
          <button className={styles.controlButton} onClick={onResume}>
            ▶️ Resume
          </button>
        )}
        
        {onRestart && (
          <button className={styles.controlButton} onClick={onRestart}>
            🔄 Restart
          </button>
        )}
        
        {onQuit && (
          <button className={`${styles.controlButton} ${styles.quitButton}`} onClick={onQuit}>
            🚪 Quit
          </button>
        )}
      </div>
      
      {/* Performance Metrics */}
      {showDebugInfo && performanceMetrics && (
        <div className={styles.performanceMetrics}>
          <h4>Performance</h4>
          <div className={styles.metricsList}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>FPS:</span>
              <span className={styles.metricValue}>{performanceMetrics.fps}</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Frame:</span>
              <span className={styles.metricValue}>{performanceMetrics.frameTime.toFixed(2)}ms</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Update:</span>
              <span className={styles.metricValue}>{performanceMetrics.updateTime.toFixed(2)}ms</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Render:</span>
              <span className={styles.metricValue}>{performanceMetrics.renderTime.toFixed(2)}ms</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Debug Info */}
      {showDebugInfo && gameState && (
        <div className={styles.debugInfo}>
          <h4>Debug Info</h4>
          <div className={styles.debugList}>
            <div className={styles.debugItem}>
              <span className={styles.debugLabel}>Ships:</span>
              <span className={styles.debugValue}>{gameState.ships.length}</span>
            </div>
            <div className={styles.debugItem}>
              <span className={styles.debugLabel}>Projectiles:</span>
              <span className={styles.debugValue}>{gameState.projectiles.length}</span>
            </div>
            <div className={styles.debugItem}>
              <span className={styles.debugLabel}>Players:</span>
              <span className={styles.debugValue}>{gameState.players.size}</span>
            </div>
            <div className={styles.debugItem}>
              <span className={styles.debugLabel}>Game Mode:</span>
              <span className={styles.debugValue}>{gameState.gameMode}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Match Info */}
      {gameState?.matchSettings && (
        <div className={styles.matchInfo}>
          <h4>Match Settings</h4>
          <div className={styles.matchDetails}>
            {gameState.matchSettings.scoreLimit && (
              <div className={styles.matchDetail}>
                <span>Score Limit: {gameState.matchSettings.scoreLimit}</span>
              </div>
            )}
            {gameState.matchSettings.timeLimit && (
              <div className={styles.matchDetail}>
                <span>Time Limit: {formatTime(gameState.matchSettings.timeLimit)}</span>
              </div>
            )}
            <div className={styles.matchDetail}>
              <span>Mode: {gameState.gameMode}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameUI;