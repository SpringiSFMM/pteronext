import { ServerStatus, PowerAction, ServerStats } from '../../types';

export type WebSocketConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting' 
  | 'error';

export interface WingsSocketAuthMessage {
  event: 'auth';
  args: [string];
}

export interface WingsSocketCommandMessage {
  event: 'send command';
  args: [string];
}

export interface WingsSocketPowerMessage {
  event: 'set state';
  args: [PowerAction];
}

export interface WingsSocketStatsEvent {
  event: 'stats';
  args: [string | WingsStatsPayload];
}

export interface WingsStatsPayload {
  memory_bytes: number;
  memory_limit_bytes: number;
  cpu_absolute: number;
  disk_bytes: number;
  disk_limit_bytes?: number;
  network?: {
    rx_bytes: number;
    tx_bytes: number;
  };
  uptime?: number;
  state?: ServerStatus;
}

export interface MetricsHistoryPoint {
  time: string;
  timestamp: number;
  cpu: number; // %
  memoryUsedMB: number;
  memoryLimitMB: number;
  memoryPercent: number; // %
  diskUsedMB: number;
  diskLimitMB: number;
  diskPercent: number; // %
  networkRxKB: number; // KB/s
  networkTxKB: number; // KB/s
}

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;
  formattedTime: string;
  raw: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'system';
}

export interface QuickShortcut {
  id: string;
  label: string;
  command: string;
  category?: 'general' | 'admin' | 'ops' | 'custom';
  description?: string;
  color?: string;
}

export interface ServerWebSocketOptions {
  serverUuid: string;
  wsUrl?: string;
  token?: string;
  fallbackToDemo?: boolean;
  maxLogLines?: number;
  maxHistoryPoints?: number;
  initialStatus?: ServerStatus;
  initialStats?: ServerStats;
}
