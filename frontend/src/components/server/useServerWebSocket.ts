import { useState, useEffect, useRef, useCallback } from 'react';
import { ServerStatus, PowerAction, ServerStats } from '../../types';
import {
  WebSocketConnectionStatus,
  MetricsHistoryPoint,
  ConsoleLogEntry,
  ServerWebSocketOptions,
  WingsStatsPayload,
} from './types';

// Initial default stats
const DEFAULT_STATS: ServerStats = {
  cpu: 18.5,
  memory: 1420,
  memoryLimit: 4096,
  disk: 8400,
  diskLimit: 20480,
  networkRx: 125,
  networkTx: 84,
  uptime: 14320,
};

// Initial realistic ANSI logs for instant interactive experience
const SEED_LOGS = [
  '\x1b[38;5;244m[00:00:01 INFO]\x1b[0m \x1b[38;5;81m[PteroNext Core]\x1b[0m Initializing isolated container environment...',
  '\x1b[38;5;244m[00:00:01 INFO]\x1b[0m \x1b[38;5;81m[PteroNext Core]\x1b[0m Allocated vCPU Cores: 4, RAM Ceiling: 4096MB, RootFS: OverlayFS (WAL enabled)',
  '\x1b[38;5;244m[00:00:02 INFO]\x1b[0m \x1b[32m[System]\x1b[0m Loading native runtime: OpenJDK 64-Bit Server VM (build 21.0.3+9-LTS)',
  '\x1b[38;5;244m[00:00:02 INFO]\x1b[0m \x1b[36m[PaperMC]\x1b[0m Starting Minecraft server version 1.20.4',
  '\x1b[38;5;244m[00:00:03 INFO]\x1b[0m \x1b[36m[PaperMC]\x1b[0m Loading recipes and datapacks... \x1b[32m[OK]\x1b[0m',
  '\x1b[38;5;244m[00:00:04 INFO]\x1b[0m \x1b[35m[AetherNet]\x1b[0m Binding to interface 0.0.0.0:25565',
  '\x1b[38;5;244m[00:00:05 INFO]\x1b[0m \x1b[33m[World]\x1b[0m Preparing level "world" (Overworld, Nether, The_End)',
  '\x1b[38;5;244m[00:00:06 INFO]\x1b[0m \x1b[32m[Server]\x1b[0m Done (3.842s)! For help, type "help"',
  '\x1b[38;5;244m[00:00:08 INFO]\x1b[0m \x1b[38;5;81m[AetherNet]\x1b[0m Live WebSocket telemetry streaming established \x1b[32m(12ms latency)\x1b[0m',
];

export function useServerWebSocket({
  serverUuid,
  wsUrl,
  token,
  fallbackToDemo = true,
  maxLogLines = 1500,
  maxHistoryPoints = 30,
  initialStatus = 'running',
  initialStats = DEFAULT_STATS,
}: ServerWebSocketOptions) {
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>(
    wsUrl ? 'connecting' : 'connected'
  );
  const [latency, setLatency] = useState<number>(14);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(initialStatus);
  const [currentStats, setCurrentStats] = useState<ServerStats>(initialStats);
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistoryPoint[]>(() => {
    // Generate initial history points for smooth charts immediately
    const now = Date.now();
    const points: MetricsHistoryPoint[] = [];
    for (let i = maxHistoryPoints - 1; i >= 0; i--) {
      const ts = now - i * 1500;
      const d = new Date(ts);
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      const cpu = Math.max(5, Math.min(85, 20 + Math.sin(i / 3) * 15 + (Math.random() * 8 - 4)));
      const memMB = Math.round(1400 + Math.sin(i / 5) * 60 + Math.random() * 20);
      points.push({
        time: timeStr,
        timestamp: ts,
        cpu: parseFloat(cpu.toFixed(1)),
        memoryUsedMB: memMB,
        memoryLimitMB: initialStats.memoryLimit,
        memoryPercent: parseFloat(((memMB / initialStats.memoryLimit) * 100).toFixed(1)),
        diskUsedMB: initialStats.disk,
        diskLimitMB: initialStats.diskLimit,
        diskPercent: parseFloat(((initialStats.disk / initialStats.diskLimit) * 100).toFixed(1)),
        networkRxKB: Math.round(80 + Math.random() * 120),
        networkTxKB: Math.round(40 + Math.random() * 80),
      });
    }
    return points;
  });

  const [logs, setLogs] = useState<ConsoleLogEntry[]>(() => {
    const now = Date.now();
    return SEED_LOGS.map((raw, idx) => ({
      id: `init-${now}-${idx}`,
      timestamp: now - (SEED_LOGS.length - idx) * 1000,
      formattedTime: new Date(now - (SEED_LOGS.length - idx) * 1000).toLocaleTimeString(),
      raw,
      level: raw.includes('ERROR') ? 'error' : raw.includes('WARN') ? 'warn' : 'info',
    }));
  });

  const [isPaused, setIsPaused] = useState(false);
  const [pausedNewCount, setPausedNewCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDemoModeRef = useRef(false);

  // Helper to append a single log line safely
  const appendLog = useCallback((raw: string, level: ConsoleLogEntry['level'] = 'info') => {
    const now = Date.now();
    const entry: ConsoleLogEntry = {
      id: `log-${now}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      formattedTime: new Date(now).toLocaleTimeString(),
      raw,
      level,
    };

    setLogs((prev) => {
      const next = [...prev, entry];
      if (next.length > maxLogLines) {
        return next.slice(next.length - maxLogLines);
      }
      return next;
    });

    setIsPaused((paused) => {
      if (paused) {
        setPausedNewCount((c) => c + 1);
      }
      return paused;
    });
  }, [maxLogLines]);

  // Helper to push a new metric data point to history buffer
  const pushMetricPoint = useCallback((stats: ServerStats) => {
    const now = Date.now();
    const d = new Date(now);
    const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

    const newPoint: MetricsHistoryPoint[] = [{
      time: timeStr,
      timestamp: now,
      cpu: parseFloat(stats.cpu.toFixed(1)),
      memoryUsedMB: Math.round(stats.memory),
      memoryLimitMB: stats.memoryLimit,
      memoryPercent: parseFloat(((stats.memory / (stats.memoryLimit || 1)) * 100).toFixed(1)),
      diskUsedMB: Math.round(stats.disk),
      diskLimitMB: stats.diskLimit,
      diskPercent: parseFloat(((stats.disk / (stats.diskLimit || 1)) * 100).toFixed(1)),
      networkRxKB: Math.round(stats.networkRx),
      networkTxKB: Math.round(stats.networkTx),
    }];

    setMetricsHistory((prev) => {
      const updated = [...prev, ...newPoint];
      if (updated.length > maxHistoryPoints) {
        return updated.slice(updated.length - maxHistoryPoints);
      }
      return updated;
    });
  }, [maxHistoryPoints]);

  // Auto-simulation / fallback runner when no real wsUrl is provided or during demo
  const startDemoSimulation = useCallback(() => {
    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    isDemoModeRef.current = true;
    setConnectionStatus('connected');
    setLatency(Math.floor(10 + Math.random() * 15));

    let tick = 0;
    demoIntervalRef.current = setInterval(() => {
      tick++;

      // Update fluctuating stats
      setCurrentStats((prev) => {
        if (serverStatus !== 'running') {
          return {
            ...prev,
            cpu: 0,
            networkRx: 0,
            networkTx: 0,
          };
        }

        const cpuNoise = (Math.random() - 0.48) * 6;
        const targetCpu = Math.max(8, Math.min(92, prev.cpu + cpuNoise));
        const memNoise = (Math.random() - 0.5) * 15;
        const targetMem = Math.max(800, Math.min(prev.memoryLimit * 0.95, prev.memory + memNoise));
        const rx = Math.max(10, Math.round(100 + Math.random() * 250 + (tick % 5 === 0 ? 500 : 0)));
        const tx = Math.max(5, Math.round(60 + Math.random() * 180));

        const updated: ServerStats = {
          ...prev,
          cpu: parseFloat(targetCpu.toFixed(1)),
          memory: Math.round(targetMem),
          networkRx: rx,
          networkTx: tx,
          uptime: prev.uptime + 1,
        };

        pushMetricPoint(updated);
        return updated;
      });

      // Fluctuate latency slightly
      if (tick % 4 === 0) {
        setLatency(Math.floor(12 + Math.random() * 18));
      }

      // Periodically generate simulated server console traffic if running
      if (serverStatus === 'running' && tick % 3 === 0) {
        const sampleLogs = [
          `\x1b[38;5;244m[${new Date().toLocaleTimeString()} INFO]\x1b[0m \x1b[32mPlayer connected:\x1b[0m \x1b[36mCyberGhost#${Math.floor(1000 + Math.random() * 9000)}\x1b[0m [10.244.0.${Math.floor(10 + Math.random() * 200)}:53281]`,
          `\x1b[38;5;244m[${new Date().toLocaleTimeString()} INFO]\x1b[0m \x1b[38;5;248mChunk generation in background:\x1b[0m region[-2, 1] took \x1b[33m${Math.floor(12 + Math.random() * 35)}ms\x1b[0m`,
          `\x1b[38;5;244m[${new Date().toLocaleTimeString()} INFO]\x1b[0m \x1b[35m[AetherNet Metrics]\x1b[0m WebSocket heartbeat ACK received from wings daemon`,
          `\x1b[38;5;244m[${new Date().toLocaleTimeString()} DEBUG]\x1b[0m GC cycle completed: freed \x1b[32m${Math.floor(64 + Math.random() * 128)}MB\x1b[0m heap space`,
          `\x1b[38;5;244m[${new Date().toLocaleTimeString()} INFO]\x1b[0m \x1b[32mWorld auto-save completed\x1b[0m (saved 42 chunks, 0 entities dropped)`,
        ];
        const randomLog = sampleLogs[Math.floor(Math.random() * sampleLogs.length)];
        appendLog(randomLog);
      }
    }, 1500);
  }, [serverStatus, pushMetricPoint, appendLog]);

  // Connect to actual WebSocket
  const connectWebSocket = useCallback(() => {
    if (!wsUrl) {
      if (fallbackToDemo) {
        startDemoSimulation();
      } else {
        setConnectionStatus('disconnected');
      }
      return;
    }

    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    setConnectionStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        appendLog('\x1b[32m[WebSocket]\x1b[0m Connected to server live streaming socket.', 'system');

        // Authenticate with Wings if token is provided
        if (token) {
          socket.send(JSON.stringify({ event: 'auth', args: [token] }));
        }

        // Request logs and stats
        socket.send(JSON.stringify({ event: 'send logs', args: [] }));
        socket.send(JSON.stringify({ event: 'send stats', args: [] }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 1. Standard Wings protocol
          if (data.event) {
            switch (data.event) {
              case 'auth success':
                appendLog('\x1b[32m[WebSocket]\x1b[0m Authentication successful.', 'system');
                break;

              case 'status': {
                const newStatus = data.args?.[0] as ServerStatus;
                if (newStatus) {
                  setServerStatus(newStatus);
                  appendLog(`\x1b[33m[Status]\x1b[0m Server status changed to: \x1b[1m${newStatus.toUpperCase()}\x1b[0m`, 'system');
                }
                break;
              }

              case 'console output': {
                const text = data.args?.[0];
                if (typeof text === 'string') {
                  appendLog(text);
                }
                break;
              }

              case 'stats': {
                const rawPayload = data.args?.[0];
                const statsPayload: WingsStatsPayload = typeof rawPayload === 'string' 
                  ? JSON.parse(rawPayload) 
                  : rawPayload;

                if (statsPayload) {
                  const memMB = Math.round((statsPayload.memory_bytes || 0) / (1024 * 1024));
                  const memLimitMB = Math.round((statsPayload.memory_limit_bytes || DEFAULT_STATS.memoryLimit * 1024 * 1024) / (1024 * 1024));
                  const diskMB = Math.round((statsPayload.disk_bytes || 0) / (1024 * 1024));
                  const diskLimitMB = Math.round((statsPayload.disk_limit_bytes || DEFAULT_STATS.diskLimit * 1024 * 1024) / (1024 * 1024));

                  const mappedStats: ServerStats = {
                    cpu: parseFloat((statsPayload.cpu_absolute || 0).toFixed(1)),
                    memory: memMB,
                    memoryLimit: memLimitMB || DEFAULT_STATS.memoryLimit,
                    disk: diskMB,
                    diskLimit: diskLimitMB || DEFAULT_STATS.diskLimit,
                    networkRx: Math.round((statsPayload.network?.rx_bytes || 0) / 1024),
                    networkTx: Math.round((statsPayload.network?.tx_bytes || 0) / 1024),
                    uptime: statsPayload.uptime ?? currentStats.uptime + 1,
                  };

                  setCurrentStats(mappedStats);
                  pushMetricPoint(mappedStats);
                }
                break;
              }

              case 'token expiring':
                appendLog('\x1b[33m[Warning]\x1b[0m WebSocket auth token is expiring soon...', 'warn');
                break;

              case 'token expired':
                appendLog('\x1b[31m[Error]\x1b[0m WebSocket auth token expired. Re-authenticating...', 'error');
                break;
            }
          } 
          // 2. Generic PteroNext / JSON format
          else if (data.type) {
            if (data.type === 'log') {
              appendLog(data.data);
            } else if (data.type === 'stats') {
              setCurrentStats(data.data);
              pushMetricPoint(data.data);
            } else if (data.type === 'status') {
              setServerStatus(data.data);
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      socket.onerror = () => {
        setConnectionStatus('error');
        appendLog('\x1b[31m[WebSocket Error]\x1b[0m Socket encountered a connection error.', 'error');
      };

      socket.onclose = (event) => {
        setConnectionStatus('disconnected');
        socketRef.current = null;

        // Auto-reconnect with exponential backoff
        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;
        const delay = Math.min(1000 * Math.pow(1.5, attempt), 15000) + Math.random() * 500;

        appendLog(
          `\x1b[33m[WebSocket]\x1b[0m Socket closed (code ${event.code}). Reconnecting in ${(delay / 1000).toFixed(1)}s...`,
          'warn'
        );

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      };
    } catch {
      setConnectionStatus('error');
      if (fallbackToDemo) {
        startDemoSimulation();
      }
    }
  }, [wsUrl, token, fallbackToDemo, startDemoSimulation, appendLog, pushMetricPoint, currentStats.uptime]);

  // Trigger manual reconnect
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = 0;
    connectWebSocket();
  }, [connectWebSocket]);

  // Send terminal command
  const sendCommand = useCallback((command: string) => {
    if (!command.trim()) return;

    // Echo locally to console
    appendLog(`\x1b[38;5;81m>\x1b[0m \x1b[1m${command}\x1b[0m`);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event: 'send command', args: [command] }));
    } else if (isDemoModeRef.current) {
      // Simulate command response in demo mode
      setTimeout(() => {
        const cmdLower = command.toLowerCase().trim();
        if (cmdLower === 'help' || cmdLower === '/help') {
          appendLog('\x1b[33m--- Available Commands ---\x1b[0m');
          appendLog('  \x1b[36m/status\x1b[0m      - Displays current container & node telemetry');
          appendLog('  \x1b[36m/list\x1b[0m        - Lists connected clients / player matrix');
          appendLog('  \x1b[36m/save-all\x1b[0m    - Flushes state to persistent SQLite/Disk store');
          appendLog('  \x1b[36m/tps\x1b[0m         - Reports server tickrate and cycle latency');
          appendLog('  \x1b[36m/say <msg>\x1b[0m   - Broadcasts message to server channels');
          appendLog('  \x1b[36m/reload\x1b[0m      - Hot-reloads configuration files');
          appendLog('  \x1b[36m/stop\x1b[0m        - Initiates graceful server shutdown');
        } else if (cmdLower === 'status' || cmdLower === '/status') {
          appendLog(`\x1b[32m[Status]\x1b[0m Uptime: ${currentStats.uptime}s | CPU: ${currentStats.cpu}% | RAM: ${currentStats.memory}MB/${currentStats.memoryLimit}MB`);
        } else if (cmdLower.startsWith('say ') || cmdLower.startsWith('/say ')) {
          const msg = command.replace(/^\/?say\s+/, '');
          appendLog(`\x1b[35m[Broadcast]\x1b[0m Server: ${msg}`);
        } else if (cmdLower === 'tps' || cmdLower === '/tps') {
          appendLog(`\x1b[32m[Tickrate]\x1b[0m TPS from last 1m, 5m, 15m: \x1b[1;32m20.0\x1b[0m, \x1b[1;32m19.98\x1b[0m, \x1b[1;32m20.0\x1b[0m (MSP: 14.2ms)`);
        } else if (cmdLower === 'list' || cmdLower === '/list') {
          appendLog(`\x1b[36m[Online Players (3/50)]:\x1b[0m CyberGhost, NeonRider, ByteMaster`);
        } else if (cmdLower === 'save-all' || cmdLower === '/save-all') {
          appendLog(`\x1b[32m[Saved]\x1b[0m Forced save completed in 18ms.`);
        } else {
          appendLog(`\x1b[38;5;244m[Console Output]\x1b[0m Executed: ${command}`);
        }
      }, 150);
    }
  }, [appendLog, currentStats]);

  // Send power action (start, stop, restart, kill)
  const sendPowerAction = useCallback((action: PowerAction) => {
    appendLog(`\x1b[33m[Action Sent]\x1b[0m Power signal: \x1b[1;36m${action.toUpperCase()}\x1b[0m`, 'system');

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event: 'set state', args: [action] }));
    } else if (isDemoModeRef.current) {
      // Simulate state transition
      if (action === 'start') {
        setServerStatus('starting');
        appendLog('\x1b[32m[Container]\x1b[0m Initializing boot sequence and mounting volumes...');
        setTimeout(() => {
          setServerStatus('running');
          appendLog('\x1b[32m[Server]\x1b[0m Server process online and listening on assigned port.');
        }, 2000);
      } else if (action === 'stop') {
        appendLog('\x1b[33m[Server]\x1b[0m Graceful shutdown sequence initiated...');
        setTimeout(() => {
          setServerStatus('stopped');
          appendLog('\x1b[31m[Server]\x1b[0m Server marked as stopped. Process exited with code 0.');
        }, 1500);
      } else if (action === 'restart') {
        appendLog('\x1b[33m[Server]\x1b[0m Restarting server process...');
        setServerStatus('starting');
        setTimeout(() => {
          setServerStatus('running');
          appendLog('\x1b[32m[Server]\x1b[0m Server restarted successfully.');
        }, 2200);
      } else if (action === 'kill') {
        setServerStatus('offline');
        appendLog('\x1b[1;31m[KILL SIGNAL]\x1b[0m SIGKILL sent! Process forcibly terminated.', 'error');
      }
    }
  }, [appendLog]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    setPausedNewCount(0);
  }, []);

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      if (prev) {
        setPausedNewCount(0); // Resuming resets paused counter
      }
      return !prev;
    });
  }, []);

  const resetPausedCount = useCallback(() => {
    setPausedNewCount(0);
  }, []);

  // Initialize connection on mount or props change
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, [serverUuid, wsUrl, token, connectWebSocket]);

  return {
    connectionStatus,
    latency,
    serverStatus,
    currentStats,
    metricsHistory,
    logs,
    isPaused,
    setIsPaused,
    togglePause,
    pausedNewCount,
    resetPausedCount,
    sendCommand,
    sendPowerAction,
    clearLogs,
    reconnect,
  };
}
