/**
 * Error handling utilities for the Simple Space Arcade game
 * Provides centralized error management for network, game, and UI errors
 */

export const ErrorType = {
  NETWORK_CONNECTION: 'NETWORK_CONNECTION',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_PEER_DISCONNECTED: 'NETWORK_PEER_DISCONNECTED',
  NETWORK_WEBRTC_FAILED: 'NETWORK_WEBRTC_FAILED',
  NETWORK_INVALID_PEER_ID: 'NETWORK_INVALID_PEER_ID',
  GAME_STATE_SYNC_FAILED: 'GAME_STATE_SYNC_FAILED',
  GAME_INITIALIZATION_FAILED: 'GAME_INITIALIZATION_FAILED',
  ASSET_LOADING_FAILED: 'ASSET_LOADING_FAILED',
  CANVAS_CONTEXT_FAILED: 'CANVAS_CONTEXT_FAILED',
  UNKNOWN: 'UNKNOWN'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

export const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

export interface GameError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  timestamp: number;
  context?: Record<string, any>;
  recoverable: boolean;
  userMessage: string;
}

export interface ErrorHandlerOptions {
  enableLogging?: boolean;
  maxErrorHistory?: number;
  enableUserNotifications?: boolean;
  enableAutoRecovery?: boolean;
}

/**
 * Centralized error handler for the game
 */
export class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private errorHistory: GameError[] = [];
  private errorListeners: ((error: GameError) => void)[] = [];
  private options: Required<ErrorHandlerOptions>;

  private constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      enableLogging: true,
      maxErrorHistory: 50,
      enableUserNotifications: true,
      enableAutoRecovery: true,
      ...options
    };
  }

  /**
   * Get singleton instance of ErrorHandler
   */
  public static getInstance(options?: ErrorHandlerOptions): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(options);
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error with automatic categorization and user-friendly messaging
   */
  public handleError(
    error: Error | string,
    type: ErrorType = ErrorType.UNKNOWN,
    context?: Record<string, any>
  ): GameError {
    const gameError = this.createGameError(error, type, context);
    
    // Add to history
    this.addToHistory(gameError);
    
    // Log if enabled
    if (this.options.enableLogging) {
      this.logError(gameError);
    }
    
    // Notify listeners
    this.notifyListeners(gameError);
    
    // Attempt auto-recovery if enabled
    if (this.options.enableAutoRecovery && gameError.recoverable) {
      this.attemptRecovery(gameError);
    }
    
    return gameError;
  }

  /**
   * Create a structured GameError from various input types
   */
  private createGameError(
    error: Error | string,
    type: ErrorType,
    context?: Record<string, any>
  ): GameError {
    const message = typeof error === 'string' ? error : error.message;
    const details = error instanceof Error ? error.stack : undefined;
    
    return {
      type,
      severity: this.determineSeverity(type),
      message,
      details,
      timestamp: Date.now(),
      context,
      recoverable: this.isRecoverable(type),
      userMessage: this.generateUserMessage(type, message)
    };
  }

  /**
   * Determine error severity based on type
   */
  private determineSeverity(type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.NETWORK_WEBRTC_FAILED:
      case ErrorType.CANVAS_CONTEXT_FAILED:
      case ErrorType.GAME_INITIALIZATION_FAILED:
        return ErrorSeverity.CRITICAL;
      
      case ErrorType.NETWORK_CONNECTION:
      case ErrorType.NETWORK_PEER_DISCONNECTED:
      case ErrorType.GAME_STATE_SYNC_FAILED:
        return ErrorSeverity.HIGH;
      
      case ErrorType.NETWORK_TIMEOUT:
      case ErrorType.ASSET_LOADING_FAILED:
        return ErrorSeverity.MEDIUM;
      
      case ErrorType.NETWORK_INVALID_PEER_ID:
      default:
        return ErrorSeverity.LOW;
    }
  }

  /**
   * Determine if an error type is recoverable
   */
  private isRecoverable(type: ErrorType): boolean {
    switch (type) {
      case ErrorType.NETWORK_CONNECTION:
      case ErrorType.NETWORK_TIMEOUT:
      case ErrorType.NETWORK_PEER_DISCONNECTED:
      case ErrorType.GAME_STATE_SYNC_FAILED:
      case ErrorType.ASSET_LOADING_FAILED:
        return true;
      
      case ErrorType.NETWORK_WEBRTC_FAILED:
      case ErrorType.CANVAS_CONTEXT_FAILED:
      case ErrorType.GAME_INITIALIZATION_FAILED:
      case ErrorType.NETWORK_INVALID_PEER_ID:
      default:
        return false;
    }
  }

  /**
   * Generate user-friendly error messages
   */
  private generateUserMessage(type: ErrorType, originalMessage: string): string {
    switch (type) {
      case ErrorType.NETWORK_CONNECTION:
        return 'Unable to establish network connection. Please check your internet connection and try again.';
      
      case ErrorType.NETWORK_TIMEOUT:
        return 'Connection timed out. The other player may have disconnected.';
      
      case ErrorType.NETWORK_PEER_DISCONNECTED:
        return 'The other player has disconnected from the game.';
      
      case ErrorType.NETWORK_WEBRTC_FAILED:
        return 'WebRTC connection failed. Please ensure your browser supports WebRTC and try again.';
      
      case ErrorType.NETWORK_INVALID_PEER_ID:
        return 'Invalid peer ID. Please check the host ID and try again.';
      
      case ErrorType.GAME_STATE_SYNC_FAILED:
        return 'Game synchronization failed. The game may become unstable.';
      
      case ErrorType.GAME_INITIALIZATION_FAILED:
        return 'Failed to initialize the game. Please refresh the page and try again.';
      
      case ErrorType.ASSET_LOADING_FAILED:
        return 'Failed to load game assets. The game will use fallback graphics.';
      
      case ErrorType.CANVAS_CONTEXT_FAILED:
        return 'Failed to initialize graphics. Please ensure your browser supports HTML5 Canvas.';
      
      default:
        return `An unexpected error occurred: ${originalMessage}`;
    }
  }

  /**
   * Add error to history with size limit
   */
  private addToHistory(error: GameError): void {
    this.errorHistory.unshift(error);
    
    if (this.errorHistory.length > this.options.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(0, this.options.maxErrorHistory);
    }
  }

  /**
   * Log error to console with appropriate level
   */
  private logError(error: GameError): void {
    const logMessage = `[${error.type}] ${error.message}`;
    const logData = {
      severity: error.severity,
      timestamp: new Date(error.timestamp).toISOString(),
      context: error.context,
      details: error.details
    };
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(logMessage, logData);
        break;
      case ErrorSeverity.HIGH:
        console.error(logMessage, logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(logMessage, logData);
        break;
      case ErrorSeverity.LOW:
      default:
        console.log(logMessage, logData);
        break;
    }
  }

  /**
   * Notify all registered error listeners
   */
  private notifyListeners(error: GameError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  /**
   * Attempt automatic recovery for recoverable errors
   */
  private attemptRecovery(error: GameError): void {
    switch (error.type) {
      case ErrorType.NETWORK_CONNECTION:
      case ErrorType.NETWORK_TIMEOUT:
        // Could trigger reconnection logic
        console.log('Attempting network reconnection...');
        break;
      
      case ErrorType.GAME_STATE_SYNC_FAILED:
        // Could trigger state resync
        console.log('Attempting game state resync...');
        break;
      
      case ErrorType.ASSET_LOADING_FAILED:
        // Could retry asset loading
        console.log('Retrying asset loading...');
        break;
      
      default:
        // No automatic recovery available
        break;
    }
  }

  /**
   * Register an error listener
   */
  public onError(listener: (error: GameError) => void): () => void {
    this.errorListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get error history
   */
  public getErrorHistory(): GameError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  public clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get errors by type
   */
  public getErrorsByType(type: ErrorType): GameError[] {
    return this.errorHistory.filter(error => error.type === type);
  }

  /**
   * Get errors by severity
   */
  public getErrorsBySeverity(severity: ErrorSeverity): GameError[] {
    return this.errorHistory.filter(error => error.severity === severity);
  }

  /**
   * Check if there are any critical errors
   */
  public hasCriticalErrors(): boolean {
    return this.errorHistory.some(error => error.severity === ErrorSeverity.CRITICAL);
  }

  /**
   * Get the most recent error
   */
  public getLastError(): GameError | null {
    return this.errorHistory.length > 0 ? this.errorHistory[0] : null;
  }
}

// Convenience functions for common error scenarios
export const handleNetworkError = (error: Error | string, context?: Record<string, any>) => {
  return ErrorHandler.getInstance().handleError(error, ErrorType.NETWORK_CONNECTION, context);
};

export const handleGameError = (error: Error | string, context?: Record<string, any>) => {
  return ErrorHandler.getInstance().handleError(error, ErrorType.GAME_INITIALIZATION_FAILED, context);
};

export const handleAssetError = (error: Error | string, context?: Record<string, any>) => {
  return ErrorHandler.getInstance().handleError(error, ErrorType.ASSET_LOADING_FAILED, context);
};

export const handleWebRTCError = (error: Error | string, context?: Record<string, any>) => {
  return ErrorHandler.getInstance().handleError(error, ErrorType.NETWORK_WEBRTC_FAILED, context);
};

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();