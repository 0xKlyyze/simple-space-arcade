import React, { useState, useEffect, useCallback } from 'react';
import { useNetwork } from '../hooks/useNetwork';
import { GameState } from '../game/core/GameState';
import type { ConnectionStatus, PeerInfo, NetworkError } from '../network/NetworkTypes';
import styles from './MultiplayerLobby.module.css';

/**
 * Lobby mode types
 */
export enum LobbyMode {
  MENU = 'menu',
  CREATE = 'create',
  JOIN = 'join',
  LOBBY = 'lobby'
}

/**
 * Player ready state
 */
export interface PlayerReadyState {
  playerId: string;
  playerName: string;
  isReady: boolean;
  isHost: boolean;
}

/**
 * Lobby settings
 */
export interface LobbySettings {
  maxPlayers: number;
  gameMode: string;
  mapName: string;
  timeLimit: number;
  scoreLimit: number;
  friendlyFire: boolean;
  powerUpsEnabled: boolean;
}

/**
 * MultiplayerLobby component props
 */
export interface MultiplayerLobbyProps {
  gameState: GameState;
  onStartGame: () => void;
  onBackToMenu: () => void;
  playerName?: string;
  initialLobbyId?: string;
}

/**
 * MultiplayerLobby component for managing multiplayer game lobbies
 * Handles lobby creation, joining, player management, and game settings
 */
export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  gameState,
  onStartGame,
  onBackToMenu,
  playerName = 'Player',
  initialLobbyId
}) => {
  // Network hook
  const network = useNetwork({ gameState });

  // Component state
  const [mode, setMode] = useState<LobbyMode>(initialLobbyId ? LobbyMode.JOIN : LobbyMode.MENU);
  const [lobbyId, setLobbyId] = useState<string>(initialLobbyId || '');
  const [joinLobbyId, setJoinLobbyId] = useState<string>('');
  const [isCreatingLobby, setIsCreatingLobby] = useState<boolean>(false);
  const [isJoiningLobby, setIsJoiningLobby] = useState<boolean>(false);
  const [playerReadyStates, setPlayerReadyStates] = useState<Map<string, PlayerReadyState>>(new Map());
  const [isLocalPlayerReady, setIsLocalPlayerReady] = useState<boolean>(false);
  const [lobbySettings, setLobbySettings] = useState<LobbySettings>({
    maxPlayers: 4,
    gameMode: 'Deathmatch',
    mapName: 'Space Arena',
    timeLimit: 300, // 5 minutes
    scoreLimit: 20,
    friendlyFire: false,
    powerUpsEnabled: true
  });
  const [chatMessages, setChatMessages] = useState<Array<{ playerId: string; playerName: string; message: string; timestamp: number }>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isStartingGame, setIsStartingGame] = useState<boolean>(false);

  // Handle network messages
  useEffect(() => {
    // Player ready state updates
    network.onNetworkMessage('PLAYER_READY', (message: any) => {
      const { playerId, playerName: msgPlayerName, isReady } = message.data;
      setPlayerReadyStates(prev => {
        const newStates = new Map(prev);
        const existingState = newStates.get(playerId);
        newStates.set(playerId, {
          playerId,
          playerName: msgPlayerName || existingState?.playerName || 'Unknown',
          isReady,
          isHost: existingState?.isHost || false
        });
        return newStates;
      });
    });

    // Lobby settings updates
    network.onNetworkMessage('LOBBY_SETTINGS', (message: any) => {
      setLobbySettings(message.data.settings);
    });

    // Chat messages
    network.onNetworkMessage('CHAT_MESSAGE', (message: any) => {
      const { playerId, playerName: msgPlayerName, text, timestamp } = message.data;
      setChatMessages(prev => [...prev, {
        playerId,
        playerName: msgPlayerName,
        message: text,
        timestamp
      }]);
    });

    // Game start signal
    network.onNetworkMessage('GAME_START', () => {
      setIsStartingGame(true);
      setTimeout(() => {
        onStartGame();
      }, 1000); // Brief delay for UI feedback
    });

    // Player disconnection
    network.onNetworkMessage('PLAYER_DISCONNECT', (message: any) => {
      const { playerId } = message.data;
      setPlayerReadyStates(prev => {
        const newStates = new Map(prev);
        newStates.delete(playerId);
        return newStates;
      });
    });
  }, [network, onStartGame]);

  // Handle connection status changes
  useEffect(() => {
    network.onConnectionStatusChange((status, peerId) => {
      if (status === ConnectionStatus.CONNECTED) {
        setConnectionError(null);
        if (mode === LobbyMode.CREATE || mode === LobbyMode.JOIN) {
          setMode(LobbyMode.LOBBY);
          // Initialize local player state
          const localPlayerId = network.localPeerId;
          setPlayerReadyStates(prev => {
            const newStates = new Map(prev);
            newStates.set(localPlayerId, {
              playerId: localPlayerId,
              playerName,
              isReady: false,
              isHost: network.isHost
            });
            return newStates;
          });
        }
      } else if (status === ConnectionStatus.DISCONNECTED) {
        if (mode === LobbyMode.LOBBY) {
          setConnectionError('Connection lost. Returning to menu.');
          setTimeout(() => {
            handleBackToMenu();
          }, 3000);
        }
      }
    });

    network.onNetworkError((error: NetworkError) => {
      setConnectionError(error.message);
      setIsCreatingLobby(false);
      setIsJoiningLobby(false);
    });
  }, [network, mode, playerName]);

  // Create lobby
  const handleCreateLobby = useCallback(async () => {
    setIsCreatingLobby(true);
    setConnectionError(null);
    try {
      const hostId = await network.initializeAsHost();
      setLobbyId(hostId);
      setMode(LobbyMode.LOBBY);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to create lobby');
    } finally {
      setIsCreatingLobby(false);
    }
  }, [network]);

  // Join lobby
  const handleJoinLobby = useCallback(async () => {
    if (!joinLobbyId.trim()) {
      setConnectionError('Please enter a lobby ID');
      return;
    }

    setIsJoiningLobby(true);
    setConnectionError(null);
    try {
      await network.connectToHost(joinLobbyId.trim());
      setLobbyId(joinLobbyId.trim());
      setMode(LobbyMode.LOBBY);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to join lobby');
    } finally {
      setIsJoiningLobby(false);
    }
  }, [network, joinLobbyId]);

  // Toggle ready state
  const handleToggleReady = useCallback(() => {
    const newReadyState = !isLocalPlayerReady;
    setIsLocalPlayerReady(newReadyState);
    
    // Send ready state to other players
    network.sendGameEvent({
      type: 'PLAYER_READY',
      data: {
        playerId: network.localPeerId,
        playerName,
        isReady: newReadyState
      }
    });

    // Update local state
    setPlayerReadyStates(prev => {
      const newStates = new Map(prev);
      const localPlayerId = network.localPeerId;
      const existingState = newStates.get(localPlayerId);
      if (existingState) {
        newStates.set(localPlayerId, {
          ...existingState,
          isReady: newReadyState
        });
      }
      return newStates;
    });
  }, [network, playerName, isLocalPlayerReady]);

  // Update lobby settings (host only)
  const handleUpdateSettings = useCallback((newSettings: Partial<LobbySettings>) => {
    if (!network.isHost) return;

    const updatedSettings = { ...lobbySettings, ...newSettings };
    setLobbySettings(updatedSettings);

    // Broadcast settings to all players
    network.sendGameEvent({
      type: 'LOBBY_SETTINGS',
      data: {
        settings: updatedSettings
      }
    });
  }, [network, lobbySettings]);

  // Send chat message
  const handleSendChatMessage = useCallback(() => {
    if (!chatInput.trim()) return;

    const message = {
      playerId: network.localPeerId,
      playerName,
      text: chatInput.trim(),
      timestamp: Date.now()
    };

    // Add to local chat
    setChatMessages(prev => [...prev, {
      playerId: message.playerId,
      playerName: message.playerName,
      message: message.text,
      timestamp: message.timestamp
    }]);

    // Send to other players
    network.sendGameEvent({
      type: 'CHAT_MESSAGE',
      data: message
    });

    setChatInput('');
  }, [network, playerName, chatInput]);

  // Start game (host only)
  const handleStartGame = useCallback(() => {
    if (!network.isHost) return;

    // Check if all players are ready
    const allPlayersReady = Array.from(playerReadyStates.values()).every(player => player.isReady);
    if (!allPlayersReady) {
      setConnectionError('All players must be ready before starting the game');
      return;
    }

    if (playerReadyStates.size < 2) {
      setConnectionError('At least 2 players are required to start the game');
      return;
    }

    setIsStartingGame(true);

    // Broadcast game start to all players
    network.sendGameEvent({
      type: 'GAME_START',
      data: {
        settings: lobbySettings,
        players: Array.from(playerReadyStates.values())
      }
    });

    // Start game locally
    setTimeout(() => {
      onStartGame();
    }, 1000);
  }, [network, playerReadyStates, lobbySettings, onStartGame]);

  // Back to menu
  const handleBackToMenu = useCallback(() => {
    network.disconnect();
    setMode(LobbyMode.MENU);
    setLobbyId('');
    setJoinLobbyId('');
    setPlayerReadyStates(new Map());
    setIsLocalPlayerReady(false);
    setChatMessages([]);
    setConnectionError(null);
    onBackToMenu();
  }, [network, onBackToMenu]);

  // Disconnect from lobby
  const handleLeaveLobby = useCallback(() => {
    network.disconnect();
    setMode(LobbyMode.MENU);
    setLobbyId('');
    setPlayerReadyStates(new Map());
    setIsLocalPlayerReady(false);
    setChatMessages([]);
    setConnectionError(null);
  }, [network]);

  // Copy lobby ID to clipboard
  const handleCopyLobbyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(lobbyId);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy lobby ID:', error);
    }
  }, [lobbyId]);

  // Render lobby menu
  const renderMenu = () => (
    <div className={styles.menuContainer}>
      <h2 className={styles.title}>Multiplayer</h2>
      
      <div className={styles.menuButtons}>
        <button
          className={styles.primaryButton}
          onClick={handleCreateLobby}
          disabled={isCreatingLobby}
        >
          {isCreatingLobby ? 'Creating...' : 'Create Lobby'}
        </button>
        
        <button
          className={styles.secondaryButton}
          onClick={() => setMode(LobbyMode.JOIN)}
        >
          Join Lobby
        </button>
        
        <button
          className={styles.backButton}
          onClick={handleBackToMenu}
        >
          Back to Menu
        </button>
      </div>
      
      {connectionError && (
        <div className={styles.errorMessage}>
          {connectionError}
        </div>
      )}
    </div>
  );

  // Render join lobby form
  const renderJoinForm = () => (
    <div className={styles.joinContainer}>
      <h2 className={styles.title}>Join Lobby</h2>
      
      <div className={styles.joinForm}>
        <input
          type="text"
          className={styles.lobbyIdInput}
          placeholder="Enter Lobby ID"
          value={joinLobbyId}
          onChange={(e) => setJoinLobbyId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleJoinLobby()}
        />
        
        <div className={styles.joinButtons}>
          <button
            className={styles.primaryButton}
            onClick={handleJoinLobby}
            disabled={isJoiningLobby || !joinLobbyId.trim()}
          >
            {isJoiningLobby ? 'Joining...' : 'Join'}
          </button>
          
          <button
            className={styles.secondaryButton}
            onClick={() => setMode(LobbyMode.MENU)}
          >
            Back
          </button>
        </div>
      </div>
      
      {connectionError && (
        <div className={styles.errorMessage}>
          {connectionError}
        </div>
      )}
    </div>
  );

  // Render lobby interface
  const renderLobby = () => {
    const players = Array.from(playerReadyStates.values());
    const allPlayersReady = players.every(player => player.isReady);
    const canStartGame = network.isHost && allPlayersReady && players.length >= 2;

    return (
      <div className={styles.lobbyContainer}>
        <div className={styles.lobbyHeader}>
          <h2 className={styles.title}>Lobby</h2>
          <div className={styles.lobbyInfo}>
            <span className={styles.lobbyId}>ID: {lobbyId}</span>
            <button
              className={styles.copyButton}
              onClick={handleCopyLobbyId}
              title="Copy Lobby ID"
            >
              📋
            </button>
          </div>
        </div>
        
        <div className={styles.lobbyContent}>
          {/* Players List */}
          <div className={styles.playersSection}>
            <h3>Players ({players.length}/{lobbySettings.maxPlayers})</h3>
            <div className={styles.playersList}>
              {players.map(player => (
                <div
                  key={player.playerId}
                  className={`${styles.playerItem} ${
                    player.isReady ? styles.ready : styles.notReady
                  } ${player.isHost ? styles.host : ''}`}
                >
                  <span className={styles.playerName}>
                    {player.playerName}
                    {player.isHost && ' (Host)'}
                  </span>
                  <span className={styles.playerStatus}>
                    {player.isReady ? '✓ Ready' : '⏳ Not Ready'}
                  </span>
                </div>
              ))}
            </div>
            
            <div className={styles.readySection}>
              <button
                className={`${styles.readyButton} ${
                  isLocalPlayerReady ? styles.ready : styles.notReady
                }`}
                onClick={handleToggleReady}
              >
                {isLocalPlayerReady ? '✓ Ready' : 'Ready Up'}
              </button>
            </div>
          </div>
          
          {/* Game Settings (Host Only) */}
          {network.isHost && (
            <div className={styles.settingsSection}>
              <h3>Game Settings</h3>
              <div className={styles.settingsGrid}>
                <div className={styles.settingItem}>
                  <label>Max Players:</label>
                  <select
                    value={lobbySettings.maxPlayers}
                    onChange={(e) => handleUpdateSettings({ maxPlayers: parseInt(e.target.value) })}
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                    <option value={8}>8</option>
                  </select>
                </div>
                
                <div className={styles.settingItem}>
                  <label>Game Mode:</label>
                  <select
                    value={lobbySettings.gameMode}
                    onChange={(e) => handleUpdateSettings({ gameMode: e.target.value })}
                  >
                    <option value="Deathmatch">Deathmatch</option>
                    <option value="Team Deathmatch">Team Deathmatch</option>
                    <option value="Capture the Flag">Capture the Flag</option>
                    <option value="King of the Hill">King of the Hill</option>
                  </select>
                </div>
                
                <div className={styles.settingItem}>
                  <label>Time Limit (minutes):</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={lobbySettings.timeLimit / 60}
                    onChange={(e) => handleUpdateSettings({ timeLimit: parseInt(e.target.value) * 60 })}
                  />
                </div>
                
                <div className={styles.settingItem}>
                  <label>Score Limit:</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={lobbySettings.scoreLimit}
                    onChange={(e) => handleUpdateSettings({ scoreLimit: parseInt(e.target.value) })}
                  />
                </div>
                
                <div className={styles.settingItem}>
                  <label>
                    <input
                      type="checkbox"
                      checked={lobbySettings.friendlyFire}
                      onChange={(e) => handleUpdateSettings({ friendlyFire: e.target.checked })}
                    />
                    Friendly Fire
                  </label>
                </div>
                
                <div className={styles.settingItem}>
                  <label>
                    <input
                      type="checkbox"
                      checked={lobbySettings.powerUpsEnabled}
                      onChange={(e) => handleUpdateSettings({ powerUpsEnabled: e.target.checked })}
                    />
                    Power-ups
                  </label>
                </div>
              </div>
            </div>
          )}
          
          {/* Chat */}
          <div className={styles.chatSection}>
            <h3>Chat</h3>
            <div className={styles.chatMessages}>
              {chatMessages.map((msg, index) => (
                <div key={index} className={styles.chatMessage}>
                  <span className={styles.chatPlayerName}>{msg.playerName}:</span>
                  <span className={styles.chatText}>{msg.message}</span>
                </div>
              ))}
            </div>
            <div className={styles.chatInput}>
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
              />
              <button onClick={handleSendChatMessage}>Send</button>
            </div>
          </div>
        </div>
        
        <div className={styles.lobbyActions}>
          {network.isHost ? (
            <button
              className={styles.startGameButton}
              onClick={handleStartGame}
              disabled={!canStartGame || isStartingGame}
            >
              {isStartingGame ? 'Starting Game...' : 'Start Game'}
            </button>
          ) : (
            <div className={styles.waitingMessage}>
              Waiting for host to start the game...
            </div>
          )}
          
          <button
            className={styles.leaveButton}
            onClick={handleLeaveLobby}
          >
            Leave Lobby
          </button>
        </div>
        
        {connectionError && (
          <div className={styles.errorMessage}>
            {connectionError}
          </div>
        )}
      </div>
    );
  };

  // Render based on current mode
  switch (mode) {
    case LobbyMode.MENU:
      return renderMenu();
    case LobbyMode.JOIN:
      return renderJoinForm();
    case LobbyMode.LOBBY:
      return renderLobby();
    default:
      return renderMenu();
  }
};