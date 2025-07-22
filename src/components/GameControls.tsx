import React, { useState, useEffect } from 'react';
import styles from './GameControls.module.css';

interface GameControlsProps {
  isVisible?: boolean;
  onToggle?: (visible: boolean) => void;
  gameMode?: 'single' | 'multiplayer' | 'practice';
  showToggleButton?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * GameControls component that displays game control instructions
 * Provides toggleable help overlay with movement and shooting controls
 */
export const GameControls: React.FC<GameControlsProps> = ({
  isVisible = false,
  onToggle,
  gameMode = 'single',
  showToggleButton = true,
  compact = false,
  className = ''
}) => {
  const [visible, setVisible] = useState(isVisible);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible]);

  const handleToggle = () => {
    const newVisible = !visible;
    setAnimating(true);
    setVisible(newVisible);
    
    if (onToggle) {
      onToggle(newVisible);
    }
    
    // Reset animation state
    setTimeout(() => setAnimating(false), 300);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'h' || event.key === 'H') {
      handleToggle();
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleGlobalKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'h' || event.key === 'H') {
        if (!event.ctrlKey && !event.altKey && !event.metaKey) {
          event.preventDefault();
          handleToggle();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyPress);
    return () => document.removeEventListener('keydown', handleGlobalKeyPress);
  }, [visible]);

  const getControlsData = () => {
    const baseControls = [
      {
        category: 'Movement',
        controls: [
          { key: 'W', action: 'Thrust Forward', description: 'Accelerate your ship forward' },
          { key: 'A', action: 'Rotate Left', description: 'Turn your ship counterclockwise' },
          { key: 'D', action: 'Rotate Right', description: 'Turn your ship clockwise' },
        ]
      },
      {
        category: 'Combat',
        controls: [
          { key: 'SPACE', action: 'Shoot', description: 'Fire projectiles at enemies' },
        ]
      },
      {
        category: 'Game',
        controls: [
          { key: 'H', action: 'Toggle Help', description: 'Show/hide this help overlay' },
          { key: 'ESC', action: 'Pause/Menu', description: 'Pause game or return to menu' },
        ]
      }
    ];

    if (gameMode === 'multiplayer') {
      baseControls.push({
        category: 'Multiplayer',
        controls: [
          { key: 'ENTER', action: 'Chat', description: 'Open chat (if available)' },
          { key: 'TAB', action: 'Scoreboard', description: 'Show player statistics' },
        ]
      });
    }

    return baseControls;
  };

  const getGameTips = () => {
    const baseTips = [
      'Use momentum to your advantage - coast to conserve energy',
      'Lead your shots when targeting moving enemies',
      'Stay near the center to avoid getting cornered',
      'Watch your health and retreat when necessary'
    ];

    if (gameMode === 'multiplayer') {
      baseTips.push(
        'Communication is key in multiplayer matches',
        'Coordinate with teammates for better strategy'
      );
    }

    return baseTips;
  };

  if (compact) {
    return (
      <div className={`${styles.compactControls} ${className}`}>
        {showToggleButton && (
          <button 
            className={styles.helpButton}
            onClick={handleToggle}
            title="Show Controls (H)"
            aria-label="Show game controls"
          >
            ?
          </button>
        )}
        
        {visible && (
          <div className={styles.compactOverlay}>
            <div className={styles.compactContent}>
              <h4>Quick Controls</h4>
              <div className={styles.quickControls}>
                <span><kbd>W</kbd> Thrust</span>
                <span><kbd>A</kbd>/<kbd>D</kbd> Turn</span>
                <span><kbd>Space</kbd> Shoot</span>
                <span><kbd>H</kbd> Help</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.gameControls} ${className}`}>
      {showToggleButton && (
        <button 
          className={styles.helpButton}
          onClick={handleToggle}
          title="Show Controls (H)"
          aria-label="Show game controls"
        >
          <span className={styles.helpIcon}>?</span>
          <span className={styles.helpText}>Controls</span>
        </button>
      )}
      
      {visible && (
        <div 
          className={`${styles.overlay} ${animating ? styles.animating : ''}`}
          onClick={handleToggle}
          onKeyDown={handleKeyPress}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-labelledby="controls-title"
        >
          <div 
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 id="controls-title" className={styles.title}>
                Game Controls
              </h2>
              <button 
                className={styles.closeButton}
                onClick={handleToggle}
                aria-label="Close controls"
              >
                ×
              </button>
            </div>
            
            <div className={styles.content}>
              <div className={styles.controlsGrid}>
                {getControlsData().map((category, index) => (
                  <div key={index} className={styles.controlCategory}>
                    <h3 className={styles.categoryTitle}>{category.category}</h3>
                    <div className={styles.controlsList}>
                      {category.controls.map((control, controlIndex) => (
                        <div key={controlIndex} className={styles.controlItem}>
                          <div className={styles.keyContainer}>
                            <kbd className={styles.key}>{control.key}</kbd>
                          </div>
                          <div className={styles.controlInfo}>
                            <div className={styles.action}>{control.action}</div>
                            <div className={styles.description}>{control.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className={styles.tipsSection}>
                <h3 className={styles.tipsTitle}>Game Tips</h3>
                <ul className={styles.tipsList}>
                  {getGameTips().map((tip, index) => (
                    <li key={index} className={styles.tip}>{tip}</li>
                  ))}
                </ul>
              </div>
              
              <div className={styles.footer}>
                <div className={styles.shortcut}>
                  Press <kbd>H</kbd> to toggle this help or <kbd>ESC</kbd> to close
                </div>
                <div className={styles.gameMode}>
                  Mode: {gameMode.charAt(0).toUpperCase() + gameMode.slice(1)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Hook for managing game controls visibility
 */
export const useGameControls = (initialVisible: boolean = false) => {
  const [isVisible, setIsVisible] = useState(initialVisible);
  
  const toggle = () => setIsVisible(!isVisible);
  const show = () => setIsVisible(true);
  const hide = () => setIsVisible(false);
  
  return {
    isVisible,
    toggle,
    show,
    hide,
    setVisible: setIsVisible
  };
};

/**
 * Simplified controls display component
 */
export const SimpleControls: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.simpleControls} ${className}`}>
      <div className={styles.simpleGrid}>
        <div className={styles.simpleItem}>
          <kbd>W</kbd>
          <span>Thrust</span>
        </div>
        <div className={styles.simpleItem}>
          <kbd>A</kbd> <kbd>D</kbd>
          <span>Turn</span>
        </div>
        <div className={styles.simpleItem}>
          <kbd>Space</kbd>
          <span>Shoot</span>
        </div>
        <div className={styles.simpleItem}>
          <kbd>H</kbd>
          <span>Help</span>
        </div>
      </div>
    </div>
  );
};

export default GameControls;