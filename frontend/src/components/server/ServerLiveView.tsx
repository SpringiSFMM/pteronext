import React from 'react';
import { Server, ServerStatus, ServerStats } from '../../types';
import { useServerWebSocket } from './useServerWebSocket';
import { ServerMetrics } from './ServerMetrics';
import { ServerConsole } from './ServerConsole';

interface ServerLiveViewProps {
  server?: Server;
  serverUuid?: string;
  serverName?: string;
  wsUrl?: string;
  token?: string;
  initialStatus?: ServerStatus;
  initialStats?: ServerStats;
  className?: string;
}

export const ServerLiveView: React.FC<ServerLiveViewProps> = ({
  server,
  serverUuid: customUuid,
  serverName: customName,
  wsUrl,
  token,
  initialStatus,
  initialStats,
  className = '',
}) => {
  const effectiveUuid = customUuid || server?.uuid || server?.id || 'demo-server-01';
  const effectiveName = customName || server?.name || 'Production Matrix Server';
  const effectiveStatus = initialStatus || server?.status || 'running';
  const effectiveStats = initialStats || server?.stats;

  // Initialize unified WebSocket manager
  const {
    connectionStatus,
    latency,
    serverStatus,
    currentStats,
    metricsHistory,
    logs,
    isPaused,
    pausedNewCount,
    togglePause,
    resetPausedCount,
    sendCommand,
    sendPowerAction,
    clearLogs,
    reconnect,
  } = useServerWebSocket({
    serverUuid: effectiveUuid,
    wsUrl,
    token,
    initialStatus: effectiveStatus,
    initialStats: effectiveStats,
    fallbackToDemo: true,
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Real-time Metrics & Hardware Dashboard */}
      <ServerMetrics
        stats={currentStats}
        history={metricsHistory}
        connectionStatus={connectionStatus}
        latency={latency}
        onReconnect={reconnect}
        showHistoricalChart={true}
      />

      {/* 2. Real-time Live Console with ANSI Rendering & Command Bar */}
      <ServerConsole
        logs={logs}
        serverStatus={serverStatus}
        serverName={effectiveName}
        serverUuid={effectiveUuid}
        isPaused={isPaused}
        pausedNewCount={pausedNewCount}
        onTogglePause={togglePause}
        onResetPausedCount={resetPausedCount}
        onSendCommand={sendCommand}
        onPowerAction={sendPowerAction}
        onClearLogs={clearLogs}
      />
    </div>
  );
};
