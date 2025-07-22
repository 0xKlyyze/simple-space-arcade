import { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine, GameEvent, PlayerInput } from '../game/core/GameEngine';
import { GameState } from '../game/core/GameState';
import { useKeyboard } from './useKeyboard';

/**
 * Custom hook for managing the game loop and engine integration
 * Provides game state management, input handling, and lifecycle control
 */
export const useGameLoop = () => {
  // Game engine instance
  const gameEngineRef = useRef<GameEngine | null>(null);
  
  // Game state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameData, setGameData] = useState<any>(null);
  const [fps, setFPS] = useState(0);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([]);
  
  // Performance metrics
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  
  // Keyboard input
  const keyboard = useKeyboard();
  
  // Refs for stable references in callbacks
  const gameDataRef = useRef<any>(null);
  const playersRef = useRef<Set<number>>(new Set());
  
  // Initialize game engine
  const initializeEngine = useCallback(() => {
    if (!gameEngineRef.current) {
      gameEngineRef.current = new GameEngine();
      
      // Set up engine callbacks
      gameEngineRef.current.setOnRender((renderData) => {
        setGameData(renderData);
        gameDataRef.current = renderData;
      });
      
      gameEngineRef.current.setOnUpdate((gameState, deltaTime) => {
        // Update FPS
        setFPS(gameEngineRef.current?.getFPS() || 0);
        
        // Update performance metrics
        setPerformanceMetrics(gameEngineRef.current?.getPerformanceMetrics());
      });
      
      gameEngineRef.current.setOnGameEvent((event) => {
        setGameEvents(prev => [...prev.slice(-9), event]); // Keep last 10 events
      });
      
      gameEngineRef.current.initialize();
      setIsInitialized(true);
    }
  }, []);
  
  // Start the game engine
  const startEngine = useCallback(() => {
    if (gameEngineRef.current && !isRunning) {
      gameEngineRef.current.start();
      setIsRunning(true);
      setIsPaused(false);
    }
  }, [isRunning]);
  
  // Stop the game engine
  const stopEngine = useCallback(() => {
    if (gameEngineRef.current && isRunning) {
      gameEngineRef.current.stop();
      setIsRunning(false);
      setIsPaused(false);
    }
  }, [isRunning]);
  
  // Pause the game
  const pauseGame = useCallback(() => {
    if (gameEngineRef.current && isRunning && !isPaused) {
      gameEngineRef.current.pause();
      setIsPaused(true);
    }
  }, [isRunning, isPaused]);
  
  // Resume the game
  const resumeGame = useCallback(() => {
    if (gameEngineRef.current && isRunning && isPaused) {
      gameEngineRef.current.resume();
      setIsPaused(false);
    }
  }, [isRunning, isPaused]);
  
  // Toggle pause state
  const togglePause = useCallback(() => {
    if (isPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  }, [isPaused, pauseGame, resumeGame]);
  
  // Reset the game
  const resetGame = useCallback(() => {
    if (gameEngineRef.current) {
      gameEngineRef.current.reset();
      setIsRunning(false);
      setIsPaused(false);
      setGameData(null);
      setGameEvents([]);
      playersRef.current.clear();
    }
  }, []);
  
  // Add a player
  const addPlayer = useCallback((playerId: number, playerName: string): boolean => {
    if (gameEngineRef.current) {
      const success = gameEngineRef.current.addPlayer(playerId, playerName);
      if (success) {
        playersRef.current.add(playerId);
      }
      return success;
    }
    return false;
  }, []);
  
  // Remove a player
  const removePlayer = useCallback((playerId: number) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.removePlayer(playerId);
      playersRef.current.delete(playerId);
    }
  }, []);
  
  // Start a match
  const startMatch = useCallback(() => {
    if (gameEngineRef.current) {
      gameEngineRef.current.startMatch();
    }
  }, []);
  
  // End a match
  const endMatch = useCallback((winnerId?: number) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.endMatch(winnerId);
    }
  }, []);
  
  // Configure engine settings
  const configureEngine = useCallback((settings: {
    targetFPS?: number;
    gameMode?: 'deathmatch' | 'survival' | 'practice';
    scoreLimit?: number;
    timeLimit?: number;
  }) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.configure(settings);
    }
  }, []);
  
  // Handle input updates
  useEffect(() => {
    if (!gameEngineRef.current || !isRunning) {
      return;
    }
    
    // Update player inputs
    playersRef.current.forEach(playerId => {
      const input = keyboard.getPlayerInput(playerId);
      gameEngineRef.current?.setPlayerInput(playerId, input);
    });
    
    // Handle system input
    const systemInput = keyboard.getSystemInput();
    
    if (systemInput.pause) {
      togglePause();
    }
    
    if (systemInput.restart) {
      resetGame();
    }
    
    // Clear key presses after processing
    keyboard.clearKeyPresses();
  }, [keyboard, isRunning, togglePause, resetGame]);
  
  // Initialize engine on mount
  useEffect(() => {
    initializeEngine();
    
    // Cleanup on unmount
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.stop();
      }
    };
  }, [initializeEngine]);
  
  // Get current game state
  const getGameState = useCallback((): GameState | null => {
    return gameEngineRef.current?.getGameState() || null;
  }, []);
  
  // Get engine status
  const getEngineStatus = useCallback(() => {
    return gameEngineRef.current?.getStatus() || {
      isRunning: false,
      isPaused: false,
      fps: 0,
      frameCount: 0,
      uptime: 0
    };
  }, []);
  
  // Manual input setting (for network play or AI)
  const setPlayerInput = useCallback((playerId: number, input: PlayerInput) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setPlayerInput(playerId, input);
    }
  }, []);
  
  return {
    // Engine state
    isInitialized,
    isRunning,
    isPaused,
    fps,
    gameData,
    gameEvents,
    performanceMetrics,
    
    // Engine control
    startEngine,
    stopEngine,
    pauseGame,
    resumeGame,
    togglePause,
    resetGame,
    
    // Player management
    addPlayer,
    removePlayer,
    
    // Match control
    startMatch,
    endMatch,
    
    // Configuration
    configureEngine,
    
    // Input
    setPlayerInput,
    keyboard,
    
    // State access
    getGameState,
    getEngineStatus,
    
    // Engine reference (for advanced usage)
    gameEngine: gameEngineRef.current
  };
};

/**
 * Hook for single-player game loop
 */
export const useSinglePlayerGameLoop = () => {
  const gameLoop = useGameLoop();
  
  // Auto-add single player on initialization
  useEffect(() => {
    if (gameLoop.isInitialized && !gameLoop.isRunning) {
      gameLoop.addPlayer(0, 'Player 1');
    }
  }, [gameLoop.isInitialized, gameLoop.isRunning, gameLoop.addPlayer]);
  
  // Start single player match
  const startSinglePlayerMatch = useCallback(() => {
    gameLoop.configureEngine({ gameMode: 'practice' });
    gameLoop.startEngine();
    gameLoop.startMatch();
  }, [gameLoop]);
  
  return {
    ...gameLoop,
    startSinglePlayerMatch
  };
};

/**
 * Hook for local multiplayer game loop
 */
export const useLocalMultiplayerGameLoop = () => {
  const gameLoop = useGameLoop();
  
  // Auto-add both players on initialization
  useEffect(() => {
    if (gameLoop.isInitialized && !gameLoop.isRunning) {
      gameLoop.addPlayer(0, 'Player 1');
      gameLoop.addPlayer(1, 'Player 2');
    }
  }, [gameLoop.isInitialized, gameLoop.isRunning, gameLoop.addPlayer]);
  
  // Start local multiplayer match
  const startLocalMatch = useCallback(() => {
    gameLoop.configureEngine({ gameMode: 'deathmatch' });
    gameLoop.startEngine();
    gameLoop.startMatch();
  }, [gameLoop]);
  
  return {
    ...gameLoop,
    startLocalMatch
  };
};

// Export types
export interface GameLoopHook {
  isInitialized: boolean;
  isRunning: boolean;
  isPaused: boolean;
  fps: number;
  gameData: any;
  gameEvents: GameEvent[];
  performanceMetrics: any;
  startEngine: () => void;
  stopEngine: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  togglePause: () => void;
  resetGame: () => void;
  addPlayer: (playerId: number, playerName: string) => boolean;
  removePlayer: (playerId: number) => void;
  startMatch: () => void;
  endMatch: (winnerId?: number) => void;
  configureEngine: (settings: any) => void;
  setPlayerInput: (playerId: number, input: PlayerInput) => void;
  getGameState: () => GameState | null;
  getEngineStatus: () => any;
  gameEngine: GameEngine | null;
}