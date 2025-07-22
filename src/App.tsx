import { useState, useEffect, useCallback } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { NetworkLobby } from './components/NetworkLobby'
import { GameUI } from './components/GameUI'
import { useNetwork } from './hooks/useNetwork'
import { ConnectionStatus } from './network/NetworkTypes'
import { ErrorHandler, ErrorType, handleNetworkError, handleWebRTCError } from './utils/ErrorHandler'
import styles from './App.module.css'

type AppState = 'menu' | 'lobby' | 'connecting' | 'game' | 'error'

function App() {
  const [appState, setAppState] = useState<AppState>('menu')
  const [isHost, setIsHost] = useState<boolean>(false)
  const [hostId, setHostId] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  
  // Initialize error handler
  const errorHandler = ErrorHandler.getInstance({
    enableLogging: true,
    maxErrorHistory: 50,
    enableUserNotifications: true,
    enableAutoRecovery: true
  })
  
  // Initialize network hook
  const network = useNetwork({
    autoReconnect: true,
    enablePrediction: true,
    enableInterpolation: true,
    syncRate: 20
  })

  // Network event handlers
  useEffect(() => {
    // Set up error handler listener
    const unsubscribeErrorHandler = errorHandler.onError((gameError) => {
      setErrorMessage(gameError.userMessage)
      if (gameError.severity === 'CRITICAL' || gameError.severity === 'HIGH') {
        setAppState('error')
      }
    })

    // Handle connection status changes
    network.onConnectionStatusChange((status, peerId) => {
      switch (status) {
        case ConnectionStatus.CONNECTING:
          setAppState('connecting')
          break
        case ConnectionStatus.CONNECTED:
          if (appState === 'connecting') {
            setAppState('lobby')
          }
          break
        case ConnectionStatus.DISCONNECTED:
          if (appState === 'game' || appState === 'lobby') {
            handleNetworkError('Connection lost', {
              previousState: appState,
              peerId,
              timestamp: Date.now()
            })
          }
          break
        case ConnectionStatus.ERROR:
          handleNetworkError('Connection error occurred', {
            status,
            peerId,
            timestamp: Date.now()
          })
          break
      }
    })

    // Handle network errors
    network.onNetworkError((error) => {
      handleNetworkError(error.message || 'Network error occurred', {
        errorCode: error.code,
        errorType: error.type,
        timestamp: Date.now()
      })
    })

    // Cleanup
    return () => {
      unsubscribeErrorHandler()
    }
  }, [network, appState, errorHandler])

  // Connection management functions
  const handleHostGame = useCallback(async () => {
    try {
      setAppState('connecting')
      const generatedHostId = await network.initializeAsHost()
      setHostId(generatedHostId)
      setIsHost(true)
    } catch (error) {
      handleWebRTCError(error instanceof Error ? error : 'Failed to host game', {
        action: 'hostGame',
        timestamp: Date.now()
      })
    }
  }, [network])

  const handleJoinGame = useCallback(async (targetHostId: string) => {
    try {
      setAppState('connecting')
      await network.connectToHost(targetHostId)
      setIsHost(false)
    } catch (error) {
      const gameError = errorHandler.handleError(
        error instanceof Error ? error : 'Failed to join game',
        ErrorType.NETWORK_INVALID_PEER_ID,
        {
          action: 'joinGame',
          targetHostId,
          timestamp: Date.now()
        }
      )
      setErrorMessage(gameError.userMessage)
      setAppState('error')
    }
  }, [network, errorHandler])

  const handleStartGame = useCallback(() => {
    try {
      if (network.canStartGame) {
        network.startGameSync()
        setAppState('game')
      } else {
        const gameError = errorHandler.handleError(
          'Cannot start game - insufficient players connected',
          ErrorType.GAME_INITIALIZATION_FAILED,
          {
            action: 'startGame',
            connectedPeers: network.connectedPeers.length,
            canStartGame: network.canStartGame,
            timestamp: Date.now()
          }
        )
        setErrorMessage(gameError.userMessage)
        setAppState('error')
      }
    } catch (error) {
      errorHandler.handleError(
        error instanceof Error ? error : 'Failed to start game',
        ErrorType.GAME_INITIALIZATION_FAILED,
        {
          action: 'startGame',
          timestamp: Date.now()
        }
      )
    }
  }, [network, errorHandler])

  const handleBackToMenu = useCallback(() => {
    network.disconnect()
    setAppState('menu')
    setErrorMessage('')
    setHostId('')
    setIsHost(false)
  }, [network])

  const handleRetryConnection = useCallback(() => {
    setErrorMessage('')
    setAppState('menu')
  }, [])

  const renderCurrentView = () => {
    switch (appState) {
      case 'connecting':
        return (
          <div className={styles.connecting}>
            <div className={styles.connectingContent}>
              <div className={styles.spinner}></div>
              <h2>Connecting...</h2>
              <p>{isHost ? 'Setting up host connection...' : 'Connecting to host...'}</p>
              <button onClick={handleBackToMenu} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        )
      
      case 'lobby':
        return (
          <NetworkLobby 
            isHost={isHost}
            hostId={hostId}
            connectionStatus={network.connectionStatus}
            connectedPeers={network.connectedPeers}
            onGameStart={handleStartGame}
            onBackToMenu={handleBackToMenu}
            onJoinGame={handleJoinGame}
          />
        )
      
      case 'game':
        return (
          <>
            <GameCanvas network={network} />
            <GameUI 
              network={network}
              onBackToMenu={handleBackToMenu}
            />
          </>
        )
      
      case 'error':
        return (
          <div className={styles.error}>
            <div className={styles.errorContent}>
              <h2>⚠️ Error</h2>
              <p>{errorMessage}</p>
              <div className={styles.errorButtons}>
                <button onClick={handleRetryConnection} className={styles.retryButton}>
                  Back to Menu
                </button>
                {appState === 'error' && network.connectionStatus === ConnectionStatus.DISCONNECTED && (
                  <button onClick={handleBackToMenu} className={styles.reconnectButton}>
                    Reconnect
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      
      case 'menu':
      default:
        return (
          <div className={styles.menu}>
            <h1>Simple Space Arcade</h1>
            <div className={styles.menuButtons}>
              <button 
                onClick={handleHostGame}
                disabled={network.connectionStatus === ConnectionStatus.CONNECTING}
              >
                Host Game
              </button>
              <button 
                onClick={() => {
                  // This will be handled by NetworkLobby component
                  setIsHost(false)
                  setAppState('lobby')
                }}
                disabled={network.connectionStatus === ConnectionStatus.CONNECTING}
              >
                Join Game
              </button>
            </div>
            
            {/* Connection status indicator */}
            {network.connectionStatus !== ConnectionStatus.DISCONNECTED && (
              <div className={styles.statusIndicator}>
                <span className={`${styles.statusDot} ${styles[network.connectionStatus.toLowerCase()]}`}></span>
                <span>Status: {network.connectionStatus}</span>
              </div>
            )}
            
            {/* Network stats for debugging */}
            {network.isConnected && (
              <div className={styles.networkStats}>
                <p>Connected Peers: {network.connectedPeers.length}</p>
                <p>Latency: {network.networkStats.averageLatency}ms</p>
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <div className={styles.app}>
      {renderCurrentView()}
    </div>
  )
}

export default App
