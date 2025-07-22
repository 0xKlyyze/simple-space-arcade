import { useState, useEffect, useCallback, useRef } from 'react';
import { GAME_CONSTANTS } from '../utils/Constants';

/**
 * Custom hook for handling keyboard input
 * Provides key state tracking and input mapping for game controls
 */
export const useKeyboard = () => {
  // Track currently pressed keys
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  
  // Track key press events for single-press actions
  const [keyPresses, setKeyPresses] = useState<Set<string>>(new Set());
  
  // Ref to store the current state for event handlers
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const keyPressesRef = useRef<Set<string>>(new Set());
  
  // Update refs when state changes
  useEffect(() => {
    pressedKeysRef.current = pressedKeys;
  }, [pressedKeys]);
  
  useEffect(() => {
    keyPressesRef.current = keyPresses;
  }, [keyPresses]);
  
  // Handle key down events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.code;
    
    // Prevent default behavior for game keys
    if (isGameKey(key)) {
      event.preventDefault();
    }
    
    // Add to pressed keys if not already pressed
    if (!pressedKeysRef.current.has(key)) {
      const newPressedKeys = new Set(pressedKeysRef.current);
      newPressedKeys.add(key);
      setPressedKeys(newPressedKeys);
      
      // Add to key presses for single-press detection
      const newKeyPresses = new Set(keyPressesRef.current);
      newKeyPresses.add(key);
      setKeyPresses(newKeyPresses);
    }
  }, []);
  
  // Handle key up events
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.code;
    
    // Prevent default behavior for game keys
    if (isGameKey(key)) {
      event.preventDefault();
    }
    
    // Remove from pressed keys
    if (pressedKeysRef.current.has(key)) {
      const newPressedKeys = new Set(pressedKeysRef.current);
      newPressedKeys.delete(key);
      setPressedKeys(newPressedKeys);
    }
  }, []);
  
  // Set up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
  
  // Clear key presses after they've been consumed
  const clearKeyPresses = useCallback(() => {
    setKeyPresses(new Set());
  }, []);
  
  // Check if a specific key is currently pressed
  const isKeyPressed = useCallback((key: string): boolean => {
    return pressedKeys.has(key);
  }, [pressedKeys]);
  
  // Check if a specific key was just pressed (single press)
  const wasKeyPressed = useCallback((key: string): boolean => {
    return keyPresses.has(key);
  }, [keyPresses]);
  
  // Check if any of the provided keys are pressed
  const areAnyKeysPressed = useCallback((keys: string[]): boolean => {
    return keys.some(key => pressedKeys.has(key));
  }, [pressedKeys]);
  
  // Get player 1 input state
  const getPlayer1Input = useCallback(() => {
    const controls = GAME_CONSTANTS.INPUT.PLAYER1_CONTROLS;
    
    return {
      thrust: areAnyKeysPressed(controls.THRUST),
      rotateLeft: areAnyKeysPressed(controls.ROTATE_LEFT),
      rotateRight: areAnyKeysPressed(controls.ROTATE_RIGHT),
      shoot: areAnyKeysPressed(controls.SHOOT)
    };
  }, [areAnyKeysPressed]);
  
  // Get player 2 input state
  const getPlayer2Input = useCallback(() => {
    const controls = GAME_CONSTANTS.INPUT.PLAYER2_CONTROLS;
    
    return {
      thrust: areAnyKeysPressed(controls.THRUST),
      rotateLeft: areAnyKeysPressed(controls.ROTATE_LEFT),
      rotateRight: areAnyKeysPressed(controls.ROTATE_RIGHT),
      shoot: areAnyKeysPressed(controls.SHOOT)
    };
  }, [areAnyKeysPressed]);
  
  // Get input for a specific player
  const getPlayerInput = useCallback((playerId: number) => {
    switch (playerId) {
      case 0:
        return getPlayer1Input();
      case 1:
        return getPlayer2Input();
      default:
        return {
          thrust: false,
          rotateLeft: false,
          rotateRight: false,
          shoot: false
        };
    }
  }, [getPlayer1Input, getPlayer2Input]);
  
  // Check for menu/system key presses
  const getSystemInput = useCallback(() => {
    const controls = GAME_CONSTANTS.INPUT.SYSTEM_CONTROLS;
    
    return {
      pause: wasKeyPressed(controls.PAUSE),
      menu: wasKeyPressed(controls.MENU),
      restart: wasKeyPressed(controls.RESTART),
      fullscreen: wasKeyPressed(controls.FULLSCREEN)
    };
  }, [wasKeyPressed]);
  
  // Get all currently pressed keys (for debugging)
  const getAllPressedKeys = useCallback((): string[] => {
    return Array.from(pressedKeys);
  }, [pressedKeys]);
  
  // Reset all input state
  const resetInput = useCallback(() => {
    setPressedKeys(new Set());
    setKeyPresses(new Set());
  }, []);
  
  return {
    // Key state queries
    isKeyPressed,
    wasKeyPressed,
    areAnyKeysPressed,
    getAllPressedKeys,
    
    // Player input
    getPlayer1Input,
    getPlayer2Input,
    getPlayerInput,
    
    // System input
    getSystemInput,
    
    // State management
    clearKeyPresses,
    resetInput,
    
    // Raw state (for advanced usage)
    pressedKeys: Array.from(pressedKeys),
    keyPresses: Array.from(keyPresses)
  };
};

/**
 * Check if a key code is used for game controls
 */
function isGameKey(keyCode: string): boolean {
  const allGameKeys = [
    ...GAME_CONSTANTS.INPUT.PLAYER1_CONTROLS.THRUST,
    ...GAME_CONSTANTS.INPUT.PLAYER1_CONTROLS.ROTATE_LEFT,
    ...GAME_CONSTANTS.INPUT.PLAYER1_CONTROLS.ROTATE_RIGHT,
    ...GAME_CONSTANTS.INPUT.PLAYER1_CONTROLS.SHOOT,
    ...GAME_CONSTANTS.INPUT.PLAYER2_CONTROLS.THRUST,
    ...GAME_CONSTANTS.INPUT.PLAYER2_CONTROLS.ROTATE_LEFT,
    ...GAME_CONSTANTS.INPUT.PLAYER2_CONTROLS.ROTATE_RIGHT,
    ...GAME_CONSTANTS.INPUT.PLAYER2_CONTROLS.SHOOT,
    GAME_CONSTANTS.INPUT.SYSTEM_CONTROLS.PAUSE,
    GAME_CONSTANTS.INPUT.SYSTEM_CONTROLS.MENU,
    GAME_CONSTANTS.INPUT.SYSTEM_CONTROLS.RESTART,
    GAME_CONSTANTS.INPUT.SYSTEM_CONTROLS.FULLSCREEN
  ];
  
  return allGameKeys.includes(keyCode);
}

/**
 * Hook for handling keyboard input with custom key mappings
 */
export const useCustomKeyboard = (keyMappings: Record<string, string[]>) => {
  const keyboard = useKeyboard();
  
  const getCustomInput = useCallback((action: string): boolean => {
    const keys = keyMappings[action] || [];
    return keyboard.areAnyKeysPressed(keys);
  }, [keyboard, keyMappings]);
  
  const wasCustomKeyPressed = useCallback((action: string): boolean => {
    const keys = keyMappings[action] || [];
    return keys.some(key => keyboard.wasKeyPressed(key));
  }, [keyboard, keyMappings]);
  
  return {
    ...keyboard,
    getCustomInput,
    wasCustomKeyPressed
  };
};

/**
 * Hook for handling single-player keyboard input
 */
export const useSinglePlayerKeyboard = () => {
  const keyboard = useKeyboard();
  
  const getInput = useCallback(() => {
    // Use player 1 controls for single player
    return keyboard.getPlayer1Input();
  }, [keyboard]);
  
  return {
    ...keyboard,
    getInput
  };
};

// Export types for TypeScript support
export interface PlayerInput {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  shoot: boolean;
}

export interface SystemInput {
  pause: boolean;
  menu: boolean;
  restart: boolean;
  fullscreen: boolean;
}