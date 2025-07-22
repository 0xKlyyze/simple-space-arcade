import React from 'react';
import { ConnectionStatus } from '../network/NetworkTypes';
import type { PeerInfo } from '../network/NetworkTypes';
import styles from './NetworkLobby.module.css';

interface NetworkLobbyProps {
  isHost: boolean;
  hostId: string;
  connectionStatus: ConnectionStatus;
  connectedPeers: PeerInfo[];
  onGameStart: () => void;
  onBackToMenu: () => void;
  onJoinGame: (hostId: string) => void;
}

export const NetworkLobby: React.FC<NetworkLobbyProps> = ({
  isHost,
  hostId,
  connectionStatus,
  connectedPeers,
  onGameStart,
  onBackToMenu,
  onJoinGame
}) => {
  const [joinHostId, setJoinHostId] = React.useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinHostId.trim()) {
      onJoinGame(joinHostId.trim());
    }
  };

  const canStartGame = isHost && connectedPeers.length >= 1;

  return (
    <div className={styles.networkLobby}>
      <div className={styles.lobbyContainer}>
        <h1 className={styles.title}>Multiplayer Lobby</h1>
        
        {isHost ? (
          <div className={styles.hostSection}>
            <h2>Host Game</h2>
            <div className={styles.hostInfo}>
              <label>Your Host ID:</label>
              <div className={styles.hostIdDisplay}>
                <code className={styles.hostId}>{hostId}</code>
                <button 
                  className={styles.copyButton}
                  onClick={() => navigator.clipboard.writeText(hostId)}
                  title="Copy Host ID"
                >
                  📋
                </button>
              </div>
              <p className={styles.instruction}>
                Share this ID with other players so they can join your game.
              </p>
            </div>
            
            <div className={styles.playersSection}>
              <h3>Connected Players ({connectedPeers.length + 1})</h3>
              <div className={styles.playersList}>
                <div className={styles.playerItem}>
                  <span className={styles.playerName}>You (Host)</span>
                  <span className={styles.playerStatus}>Connected</span>
                </div>
                {connectedPeers.map((peer) => (
                  <div key={peer.id} className={styles.playerItem}>
                    <span className={styles.playerName}>{peer.name || peer.id}</span>
                    <span className={`${styles.playerStatus} ${styles[peer.connectionStatus]}`}>
                      {peer.connectionStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className={styles.gameControls}>
              <button 
                className={`${styles.startButton} ${!canStartGame ? styles.disabled : ''}`}
                onClick={onGameStart}
                disabled={!canStartGame}
              >
                {canStartGame ? 'Start Game' : 'Waiting for players...'}
              </button>
              <p className={styles.startInfo}>
                {canStartGame 
                  ? 'Ready to start the game!' 
                  : 'At least 2 players needed to start the game.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.clientSection}>
            <h2>Join Game</h2>
            <form onSubmit={handleJoinSubmit} className={styles.joinForm}>
              <div className={styles.inputGroup}>
                <label htmlFor="hostId">Host ID:</label>
                <input
                  type="text"
                  id="hostId"
                  value={joinHostId}
                  onChange={(e) => setJoinHostId(e.target.value)}
                  placeholder="Enter host ID to join game"
                  className={styles.hostIdInput}
                  required
                />
              </div>
              <button type="submit" className={styles.joinButton}>
                Join Game
              </button>
            </form>
            
            {connectedPeers.length > 0 && (
              <div className={styles.playersSection}>
                <h3>Players in Lobby ({connectedPeers.length + 1})</h3>
                <div className={styles.playersList}>
                  {connectedPeers.map((peer) => (
                    <div key={peer.id} className={styles.playerItem}>
                      <span className={styles.playerName}>{peer.name || peer.id}</span>
                      <span className={`${styles.playerStatus} ${styles[peer.connectionStatus]}`}>
                        {peer.connectionStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className={styles.connectionInfo}>
          <div className={styles.statusIndicator}>
            <span className={`${styles.statusDot} ${styles[connectionStatus]}`}></span>
            <span className={styles.statusText}>Status: {connectionStatus}</span>
          </div>
        </div>
        
        <div className={styles.lobbyActions}>
          <button onClick={onBackToMenu} className={styles.backButton}>
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};