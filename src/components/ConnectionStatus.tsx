import React, { useState, useEffect } from 'react';
import { useNetwork } from '../hooks/useNetwork';
import type { ConnectionStatus as NetworkConnectionStatus, NetworkStats, PeerInfo } from '../network/NetworkTypes';
import styles from './ConnectionStatus.module.css';

/**
 * Connection status display mode
 */
export enum StatusDisplayMode {
  COMPACT = 'compact',
  DETAILED = 'detailed',
  MINIMAL = 'minimal'
}

/**
 * ConnectionStatus component props
 */
export interface ConnectionStatusProps {
  displayMode?: StatusDisplayMode;
  showStats?: boolean;
  showPeers?: boolean;
  className?: string;
  onStatusClick?: () => void;
}

/**
 * ConnectionStatus component for displaying network connection information
 * Shows connection status, network statistics, and connected peers
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  displayMode = StatusDisplayMode.COMPACT,
  showStats = true,
  showPeers = true,
  className = '',
  onStatusClick
}) => {
  const network = useNetwork();
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Update timestamp periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdateTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Get status color based on connection status
  const getStatusColor = (status: NetworkConnectionStatus): string => {
    switch (status) {
      case NetworkConnectionStatus.CONNECTED:
        return '#4caf50'; // Green
      case NetworkConnectionStatus.CONNECTING:
        return '#ff9800'; // Orange
      case NetworkConnectionStatus.DISCONNECTED:
        return '#f44336'; // Red
      case NetworkConnectionStatus.RECONNECTING:
        return '#2196f3'; // Blue
      case NetworkConnectionStatus.ERROR:
        return '#e91e63'; // Pink
      default:
        return '#9e9e9e'; // Gray
    }
  };

  // Get status text
  const getStatusText = (status: NetworkConnectionStatus): string => {
    switch (status) {
      case NetworkConnectionStatus.CONNECTED:
        return 'Connected';
      case NetworkConnectionStatus.CONNECTING:
        return 'Connecting...';
      case NetworkConnectionStatus.DISCONNECTED:
        return 'Disconnected';
      case NetworkConnectionStatus.RECONNECTING:
        return 'Reconnecting...';
      case NetworkConnectionStatus.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Handle status click
  const handleStatusClick = () => {
    if (onStatusClick) {
      onStatusClick();
    } else if (displayMode === StatusDisplayMode.COMPACT) {
      setIsExpanded(!isExpanded);
    }
  };

  // Render minimal status (just indicator)
  const renderMinimalStatus = () => (
    <div 
      className={`${styles.minimalStatus} ${className}`}
      onClick={handleStatusClick}
      style={{ '--status-color': getStatusColor(network.connectionStatus) } as React.CSSProperties}
    >
      <div className={styles.statusIndicator} />
      {network.connectionStatus === NetworkConnectionStatus.CONNECTING && (
        <div className={styles.pulseAnimation} />
      )}
    </div>
  );

  // Render compact status
  const renderCompactStatus = () => (
    <div className={`${styles.compactStatus} ${className}`}>
      <div 
        className={styles.statusHeader}
        onClick={handleStatusClick}
        style={{ '--status-color': getStatusColor(network.connectionStatus) } as React.CSSProperties}
      >
        <div className={styles.statusIndicator} />
        <span className={styles.statusText}>
          {getStatusText(network.connectionStatus)}
        </span>
        {network.isConnected && (
          <span className={styles.peerCount}>
            ({network.connectedPeers.length} peer{network.connectedPeers.length !== 1 ? 's' : ''})
          </span>
        )}
        <button className={styles.expandButton}>
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      {isExpanded && (
        <div className={styles.expandedContent}>
          {renderDetailedContent()}
        </div>
      )}
    </div>
  );

  // Render detailed content
  const renderDetailedContent = () => (
    <div className={styles.detailedContent}>
      {/* Connection Info */}
      <div className={styles.connectionInfo}>
        <h4>Connection</h4>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.label}>Status:</span>
            <span 
              className={styles.value}
              style={{ color: getStatusColor(network.connectionStatus) }}
            >
              {getStatusText(network.connectionStatus)}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.label}>Role:</span>
            <span className={styles.value}>
              {network.isHost ? 'Host' : 'Client'}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.label}>Local ID:</span>
            <span className={styles.value}>
              {network.localPeerId || 'N/A'}
            </span>
          </div>
          {network.lastError && (
            <div className={styles.infoItem}>
              <span className={styles.label}>Last Error:</span>
              <span className={`${styles.value} ${styles.error}`}>
                {network.lastError.message}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Network Statistics */}
      {showStats && network.isConnected && (
        <div className={styles.networkStats}>
          <h4>Network Statistics</h4>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Messages Sent:</span>
              <span className={styles.statValue}>
                {network.networkStats.messagesSent.toLocaleString()}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Messages Received:</span>
              <span className={styles.statValue}>
                {network.networkStats.messagesReceived.toLocaleString()}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Data Transferred:</span>
              <span className={styles.statValue}>
                {formatBytes(network.networkStats.bytesTransferred)}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Average Latency:</span>
              <span className={styles.statValue}>
                {network.networkStats.averageLatency}ms
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Connection Uptime:</span>
              <span className={styles.statValue}>
                {formatDuration(network.networkStats.connectionUptime)}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Reconnect Count:</span>
              <span className={styles.statValue}>
                {network.networkStats.reconnectCount}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Connected Peers */}
      {showPeers && network.isConnected && network.connectedPeers.length > 0 && (
        <div className={styles.connectedPeers}>
          <h4>Connected Peers ({network.connectedPeers.length})</h4>
          <div className={styles.peersList}>
            {network.connectedPeers.map((peer: PeerInfo) => (
              <div key={peer.id} className={styles.peerItem}>
                <div className={styles.peerInfo}>
                  <span className={styles.peerId}>{peer.id}</span>
                  {peer.metadata?.playerName && (
                    <span className={styles.peerName}>({peer.metadata.playerName})</span>
                  )}
                </div>
                <div className={styles.peerStats}>
                  <span className={styles.peerLatency}>
                    {peer.latency !== undefined ? `${peer.latency}ms` : 'N/A'}
                  </span>
                  <div 
                    className={styles.peerStatusIndicator}
                    style={{ 
                      backgroundColor: peer.connected ? '#4caf50' : '#f44336'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Update */}
      <div className={styles.lastUpdate}>
        Last updated: {new Date(lastUpdateTime).toLocaleTimeString()}
      </div>
    </div>
  );

  // Render detailed status
  const renderDetailedStatus = () => (
    <div className={`${styles.detailedStatus} ${className}`}>
      <div 
        className={styles.statusHeader}
        style={{ '--status-color': getStatusColor(network.connectionStatus) } as React.CSSProperties}
      >
        <div className={styles.statusIndicator} />
        <h3 className={styles.statusTitle}>
          Network Status: {getStatusText(network.connectionStatus)}
        </h3>
      </div>
      {renderDetailedContent()}
    </div>
  );

  // Render based on display mode
  switch (displayMode) {
    case StatusDisplayMode.MINIMAL:
      return renderMinimalStatus();
    case StatusDisplayMode.COMPACT:
      return renderCompactStatus();
    case StatusDisplayMode.DETAILED:
      return renderDetailedStatus();
    default:
      return renderCompactStatus();
  }
};

/**
 * Hook for getting connection status summary
 */
export const useConnectionStatusSummary = () => {
  const network = useNetwork();
  
  return {
    isOnline: network.isConnected,
    status: network.connectionStatus,
    statusText: (() => {
      switch (network.connectionStatus) {
        case NetworkConnectionStatus.CONNECTED:
          return 'Online';
        case NetworkConnectionStatus.CONNECTING:
          return 'Connecting';
        case NetworkConnectionStatus.DISCONNECTED:
          return 'Offline';
        case NetworkConnectionStatus.RECONNECTING:
          return 'Reconnecting';
        case NetworkConnectionStatus.ERROR:
          return 'Error';
        default:
          return 'Unknown';
      }
    })(),
    peerCount: network.connectedPeers.length,
    isHost: network.isHost,
    hasError: !!network.lastError,
    errorMessage: network.lastError?.message
  };
};

/**
 * Simple connection indicator component
 */
export const ConnectionIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isOnline, statusText } = useConnectionStatusSummary();
  
  return (
    <div className={`${styles.connectionIndicator} ${className}`}>
      <div 
        className={styles.indicator}
        style={{ backgroundColor: isOnline ? '#4caf50' : '#f44336' }}
      />
      <span className={styles.indicatorText}>{statusText}</span>
    </div>
  );
};

export default ConnectionStatus;