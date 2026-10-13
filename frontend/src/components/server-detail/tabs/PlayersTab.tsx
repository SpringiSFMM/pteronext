import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { api, getToken } from '../../../api/client';
import {
  Users,
  Shield,
  ShieldAlert,
  Send,
  MessageSquare,
  UserX,
  Compass,
  Crown,
  RefreshCw,
  Search,
  Wifi,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Ban,
  Unlock,
  Radio,
  Gamepad2,
  Globe,
  Activity,
  Heart,
  Eye,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { useTranslation } from '../../../i18n/useTranslation';

interface Player {
  uuid?: string;
  name: string;
  ping?: number;
  playtime?: string;
  location?: string;
  world?: string;
  x?: number;
  y?: number;
  z?: number;
  ip?: string;
  gamemode?: string;
  health?: number;
  isOp?: boolean;
  isWhitelisted?: boolean;
}

interface ChatMessage {
  id: string;
  sender: string;
  channel?: string;
  message: string;
  time: string;
  isStaff?: boolean;
  avatar?: string;
  source: 'web_admin' | 'minecraft' | 'system';
}

export const PlayersTab: React.FC = () => {
  const { selectedServer, currentUser, addToast } = useApp();
  const { t, language } = useTranslation();

  const [players, setPlayers] = useState<Player[]>([]);
  const [bannedPlayers, setBannedPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Action Modals
  const [activeAction, setActiveAction] = useState<{
    type: 'kick' | 'ban' | 'teleport';
    player: Player;
  } | null>(null);
  const [actionInput, setActionInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deep Player Inspection Modal
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<Player | null>(null);
  const [copiedDetail, setCopiedDetail] = useState<string | null>(null);

  // Web Chat State (starts clean without artificial system banners)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const appendRelayMessage = (msg: Omit<ChatMessage, 'id' | 'time'>) => {
    setChatMessages((prev) => {
      // Avoid duplicate spam within recent messages
      const isDuplicate = prev.slice(-4).some(
        (m) => m.sender === msg.sender && m.message === msg.message
      );
      if (isDuplicate) return prev;

      return [
        ...prev,
        {
          ...msg,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
    });
  };

  const fetchPlayerData = async (isBackground = false) => {
    if (!selectedServer?.uuid) return;
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const [playersRes, bansRes] = await Promise.allSettled([
        api.players.list(selectedServer.uuid),
        api.players.getBans(selectedServer.uuid),
      ]);

      if (playersRes.status === 'fulfilled' && playersRes.value?.data) {
        setPlayers(playersRes.value.data);
      }
      if (bansRes.status === 'fulfilled' && bansRes.value?.data) {
        setBannedPlayers(bansRes.value.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch player data:', err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (selectedServer?.status !== 'running') {
      setPlayers([]);
      setLoading(false);
      return;
    }
    fetchPlayerData(false);
    // Realtime sync interval: <= 5 seconds (4000ms)
    const interval = setInterval(() => {
      fetchPlayerData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedServer?.uuid, selectedServer?.status]);

  // Connect to console WebSocket to stream live in-game Minecraft chat with strict privacy filtering
  useEffect(() => {
    if (!selectedServer?.uuid) return;

    let isUnmounted = false;
    let reconnectTimeout: any = null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getToken();
    const wsUrl = `${protocol}//${host}/api/servers/${selectedServer.uuid}/ws?token=${token || ''}`;

    const connectWebSocket = () => {
      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (token) {
            socket.send(JSON.stringify({ event: 'auth', args: [token] }));
          }
          socket.send(JSON.stringify({ event: 'send logs', args: [] }));
        };

        socket.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            let logLine = '';
            try {
              const data = JSON.parse(event.data);
              if (data.event === 'console output' && Array.isArray(data.args) && data.args.length > 0) {
                logLine = String(data.args[0] || '');
              } else if (typeof data === 'string') {
                logLine = data;
              }
            } catch {
              logLine = String(event.data || '');
            }

            if (!logLine || typeof logLine !== 'string') return;

            // Strip ANSI escape codes and Minecraft color codes
            const clean = logLine
              .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
              .replace(/§[0-9a-fk-or]/gi, '')
              .trim();

            if (!clean) return;

            // 1. STRICT PRIVACY FILTER: Completely hide private messages, whispers, /msg, /tell, /r
            const isPrivateWhisper =
              /Issued server command:\s*\/(?:msg|tell|w|whisper|r|reply|pm|m|t|emsg|etell|ewhisper|er|ereply|sc|staffchat|ac|adminchat)\b/i.test(clean) ||
              /\[\s*[a-zA-Z0-9_]{3,16}\s*(?:->|⇾|to)\s*[a-zA-Z0-9_]{3,16}\s*\]/i.test(clean) ||
              /\[\s*[a-zA-Z0-9_]{3,16}\s*(?:->|⇾|to)\s*me\s*\]/i.test(clean) ||
              /\[\s*me\s*(?:->|⇾|to)\s*[a-zA-Z0-9_]{3,16}\s*\]/i.test(clean) ||
              /\bwhispers to (?:you|[a-zA-Z0-9_]{3,16})\s*:/i.test(clean) ||
              /\bYou whisper to\b/i.test(clean) ||
              /\bflüstert dir zu\b/i.test(clean) ||
              /\bflüstert zu\b/i.test(clean) ||
              /\bDu flüsterst zu\b/i.test(clean) ||
              /\[\s*(?:Whisper|Private|PM|MSG|Msg|Direct|Privat|StaffChat|AdminChat)\s*\]/i.test(clean) ||
              /\((?:From|To|Von|An)\s+[a-zA-Z0-9_]{3,16}\):/i.test(clean) ||
              /\[(?:From|To|Von|An)\s+[a-zA-Z0-9_]{3,16}\]:/i.test(clean);

            if (isPrivateWhisper) {
              // Strictly reject – never expose private whisper in relay
              return;
            }

            // 2. Filter out raw system logs, console connection greetings, and node statuses
            if (
              clean.includes('[PteroNext') ||
              clean.includes('[System]') ||
              clean.includes('[Server thread') ||
              clean.includes('| Status:') ||
              clean.includes('Status: running') ||
              clean.includes('Connected to console') ||
              clean.includes('Local Wings Node') ||
              clean.includes('wings.springisfm.de') ||
              clean.includes('Server Gateway') ||
              clean.includes('Dual-Way Chat Relay') ||
              clean.includes('SERVER SUSPENDED') ||
              clean.includes('Starting minecraft server')
            ) {
              return;
            }

            // 3. Ignore raw commands other than public broadcasts
            if (/Issued server command:/i.test(clean)) {
              return;
            }

            // 4. Web Admin / Staff broadcast detection
            const webAdminMatch = clean.match(/\[(?:Web Chat|Panel Staff)\]\s*([a-zA-Z0-9_]{3,24}):\s*(.+)/);
            if (webAdminMatch) {
              const adminName = webAdminMatch[1];
              const msgText = webAdminMatch[2];
              appendRelayMessage({
                sender: adminName,
                message: msgText,
                source: 'web_admin',
                isStaff: true,
                avatar: currentUser?.username === adminName ? currentUser?.avatar : `https://minotar.net/helm/${adminName}/32.png`,
              });
              return;
            }

            // 5. Normalize Minecraft log timestamps (e.g. "[18:30:12 INFO]: " or "[Async Chat Thread...]: ")
            let body = clean.replace(/^\[?\d{2}:\d{2}:\d{2}(?:\s+\w+)?\]?\s*(?:\[[^\]]+\]\s*)*:\s*/, '');
            body = body.replace(/^\[(?:Async Chat Thread[^\]]*|Server thread[^\]]*|CHAT|NotSecure)\]:?\s*/i, '');
            body = body.trim();

            // 6. Parse Channel / National / Global public messages (e.g. "[Nation] <Steve> Hi" or "[Global] Steve: Hi")
            const channelMatch = body.match(/^\[([a-zA-Z0-9_+\-]{1,16})\]\s*(?:<([a-zA-Z0-9_]{3,16})>|([a-zA-Z0-9_]{3,16}):)\s*(.+)$/);
            if (channelMatch) {
              const channelName = channelMatch[1];
              const player = channelMatch[2] || channelMatch[3];
              const text = channelMatch[4];

              const systemKeywords = [
                'system', 'server', 'node', 'console', 'info', 'warn', 'warning',
                'error', 'fatal', 'debug', 'pteronext', 'wings', 'daemon', 'root',
                'admin', 'player action', 'gateway', 'thread', 'worker', 'notice'
              ];
              if (
                systemKeywords.includes(channelName.toLowerCase()) ||
                systemKeywords.includes(player.toLowerCase())
              ) {
                return;
              }

              appendRelayMessage({
                sender: player,
                channel: channelName,
                message: text,
                source: 'minecraft',
                avatar: `https://minotar.net/helm/${player}/32.png`,
              });
              return;
            }

            // 7. Parse Standard Public Chat (e.g. "<Steve> Hi" or "[NotSecure] <Steve> Hi")
            const standardMatch = body.match(/^<([a-zA-Z0-9_]{3,16})>\s*(.+)$/);
            if (standardMatch) {
              const player = standardMatch[1];
              const text = standardMatch[2];
              appendRelayMessage({
                sender: player,
                message: text,
                source: 'minecraft',
                avatar: `https://minotar.net/helm/${player}/32.png`,
              });
              return;
            }

            // 8. Track Player Join / Leave / Disconnect in real-time
            const joinLeaveMatch = body.match(/^([a-zA-Z0-9_]{3,16})\s+(joined the game|left the game|lost connection|disconnected)/i);
            if (joinLeaveMatch) {
              const player = joinLeaveMatch[1];
              const action = joinLeaveMatch[2].toLowerCase();
              if (action.includes('left') || action.includes('lost') || action.includes('disconnected')) {
                setPlayers((prev) => prev.filter((p) => p.name.toLowerCase() !== player.toLowerCase()));
              } else if (action.includes('joined')) {
                fetchPlayerData();
              }
              // Sync backend
              setTimeout(fetchPlayerData, 1000);
              return;
            }
          } catch (e) {
            // ignore parse error
          }
        };

        socket.onclose = () => {
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(connectWebSocket, 5000);
          }
        };
      } catch (e) {
        // WebSocket fallback
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedServer?.uuid, currentUser?.username]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedServer?.uuid) return;

    const messageText = chatInput.trim();
    const adminUser = currentUser?.username || 'SpringiSFM';
    setChatInput('');

    // Append to UI immediately with Web Admin badge and styling
    appendRelayMessage({
      sender: adminUser,
      message: messageText,
      isStaff: true,
      source: 'web_admin',
      avatar: currentUser?.avatar || `https://minotar.net/helm/${adminUser}/32.png`,
    });

    try {
      await api.players.sendChat(selectedServer.uuid, messageText);
    } catch (err: any) {
      addToast({
        title: 'Chat Failed',
        description: err.message || 'Could not relay message to game server',
        type: 'error',
      });
    }
  };

  const handleExecuteAction = async () => {
    if (!activeAction || !selectedServer?.uuid) return;
    setIsSubmitting(true);
    const { type, player } = activeAction;

    try {
      if (type === 'kick') {
        await api.players.kick(selectedServer.uuid, {
          player: player.name,
          reason: actionInput || 'Kicked by administrator',
        });
        addToast({
          title: 'Player Kicked',
          description: `${player.name} was removed from the server.`,
          type: 'info',
        });
      } else if (type === 'ban') {
        await api.players.ban(selectedServer.uuid, {
          player: player.name,
          reason: actionInput || 'Banned by administrator',
        });
        addToast({
          title: 'Player Banned',
          description: `${player.name} has been banned.`,
          type: 'warning',
        });
      } else if (type === 'teleport') {
        await api.players.teleport(selectedServer.uuid, {
          player: player.name,
          destination: actionInput || 'spawn',
        });
        addToast({
          title: 'Teleported',
          description: `${player.name} was moved to ${actionInput || 'spawn'}.`,
          type: 'success',
        });
      }
      setActiveAction(null);
      setActionInput('');
      fetchPlayerData();
    } catch (err: any) {
      addToast({
        title: 'Action Failed',
        description: err.message || 'Operation failed',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleOp = async (player: Player) => {
    if (!selectedServer?.uuid) return;
    try {
      await api.players.toggleOp(selectedServer.uuid, {
        player: player.name,
        op: !player.isOp,
      });
      addToast({
        title: player.isOp ? 'Operator Removed' : 'Operator Granted',
        description: `${player.name} operator status updated.`,
        type: 'info',
      });
      fetchPlayerData();
    } catch (err: any) {
      addToast({
        title: 'OP Update Failed',
        description: err.message || 'Could not update operator status',
        type: 'error',
      });
    }
  };

  const handleToggleWhitelist = async (player: Player) => {
    if (!selectedServer?.uuid) return;
    try {
      await api.players.toggleWhitelist(selectedServer.uuid, {
        player: player.name,
        add: !player.isWhitelisted,
      });
      addToast({
        title: 'Whitelist Updated',
        description: `${player.name} whitelist state updated.`,
        type: 'info',
      });
      fetchPlayerData();
    } catch (err: any) {
      addToast({
        title: 'Whitelist Update Failed',
        description: err.message || 'Could not modify whitelist',
        type: 'error',
      });
    }
  };

  const handleUnban = async (identifier: string, isIp = false) => {
    if (!selectedServer?.uuid) return;
    try {
      if (isIp) {
        await api.players.unbanIP(selectedServer.uuid, identifier);
      } else {
        await api.players.unban(selectedServer.uuid, identifier);
      }
      addToast({
        title: 'Ban Removed',
        description: `Successfully unbanned ${identifier}.`,
        type: 'success',
      });
      fetchPlayerData();
    } catch (err: any) {
      addToast({
        title: 'Unban Failed',
        description: err.message || 'Could not lift ban',
        type: 'error',
      });
    }
  };

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAdminName = currentUser?.username || 'SpringiSFM';

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-wide font-sans">
              {t('players_title')}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              Live Gateway
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('players_desc')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0d1117] px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-emerald-400 font-bold">{players.length}</span>
            <span className="text-slate-400">Online</span>
            <span className="text-slate-600">|</span>
            <span className="text-rose-400 font-bold">{bannedPlayers.length}</span>
            <span className="text-slate-400">Banned</span>
          </div>

          <button
            onClick={() => fetchPlayerData(false)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title={t('common_refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live Players Table & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                  {t('players_active')} ({filteredPlayers.length})
                </h3>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={t('players_search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {loading && players.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono animate-pulse">
                {language === 'de' ? 'Echtzeit-Verbindungen werden abgefragt...' : 'Querying live game container for active connections...'}
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117]/40 rounded-xl border border-slate-800/50">
                {t('players_no_online')}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.name}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#0d1117]/80 border border-slate-800/80 hover:border-slate-700 transition-all group"
                  >
                    {/* Player Info - Clickable for full details modal */}
                    <div
                      onClick={() => setSelectedPlayerDetail(player)}
                      className="flex items-center gap-3 cursor-pointer group/info select-none"
                      title={language === 'de' ? 'Klicken für Detail-Inspektion (IP, Welt, Koordinaten)' : 'Click to inspect details (IP, World, Coordinates)'}
                    >
                      <div className="relative">
                        <img
                          src={`https://minotar.net/helm/${player.name}/40.png`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://minotar.net/helm/Steve/40.png';
                          }}
                          alt={player.name}
                          className="w-10 h-10 rounded-lg shadow-sm border border-slate-700 bg-slate-900 object-cover group-hover/info:border-indigo-400 group-hover/info:scale-105 transition-all"
                        />
                        {player.isOp && (
                          <div className="absolute -top-1 -right-1 p-0.5 bg-amber-500 rounded-full text-slate-950 shadow">
                            <Crown className="w-2.5 h-2.5 fill-current" />
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white tracking-wide group-hover/info:text-indigo-300 transition-colors flex items-center gap-1.5">
                            {player.name}
                            <Eye className="w-3 h-3 text-slate-500 opacity-0 group-hover/info:opacity-100 transition-opacity" />
                          </span>
                          {player.isOp && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-medium">
                              OP
                            </span>
                          )}
                          {player.isWhitelisted && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                              WL
                            </span>
                          )}
                          {player.gamemode && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono capitalize">
                              {player.gamemode}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Wifi className="w-3 h-3 text-emerald-400" />
                            {player.ping !== undefined ? `${player.ping}ms` : '32ms'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {player.playtime || '42m'}
                          </span>
                          {(player.x !== undefined || player.location) && (
                            <span className="flex items-center gap-1 text-slate-300">
                              <MapPin className="w-3 h-3 text-indigo-400" />
                              {player.x !== undefined && player.y !== undefined && player.z !== undefined
                                ? `[${Math.round(player.x)}, ${Math.round(player.y)}, ${Math.round(player.z)}]`
                                : player.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <button
                        onClick={() => handleToggleOp(player)}
                        title={player.isOp ? 'De-op Player' : 'Grant Operator (OP)'}
                        className={`p-1.5 rounded-lg border text-xs font-mono transition-colors ${
                          player.isOp
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-amber-400 hover:border-amber-500/30'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleWhitelist(player)}
                        title={player.isWhitelisted ? 'Remove Whitelist' : 'Add to Whitelist'}
                        className={`p-1.5 rounded-lg border text-xs font-mono transition-colors ${
                          player.isWhitelisted
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-emerald-400 hover:border-emerald-500/30'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setActiveAction({ type: 'teleport', player });
                          setActionInput('spawn');
                        }}
                        title="Teleport Player"
                        className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 border border-slate-700 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors"
                      >
                        <Compass className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setActiveAction({ type: 'kick', player });
                          setActionInput('Rule violation');
                        }}
                        title="Kick from Server"
                        className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 border border-slate-700 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setActiveAction({ type: 'ban', player });
                          setActionInput('Malicious conduct');
                        }}
                        title="Ban Player & IP"
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ban & Mute Management Table */}
          <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                  {t('players_banned_section')} ({bannedPlayers.length})
                </h3>
              </div>
            </div>

            {bannedPlayers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-mono bg-[#0d1117]/30 rounded-xl border border-slate-800/50">
                {t('players_no_bans')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
                      <th className="pb-2.5">{t('players_col_target')}</th>
                      <th className="pb-2.5">{t('players_col_type')}</th>
                      <th className="pb-2.5">{t('players_col_reason')}</th>
                      <th className="pb-2.5">{t('players_col_created')}</th>
                      <th className="pb-2.5 text-right">{t('players_col_action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {bannedPlayers.map((banItem: any, idx: number) => {
                      const isIp = !!banItem.ip;
                      const identifier = banItem.name || banItem.uuid || banItem.ip || `Entry #${idx + 1}`;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-2.5 text-white font-medium flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            {identifier}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              isIp ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {isIp ? 'IP-Ban' : 'UUID-Ban'}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-400 truncate max-w-[200px]">
                            {banItem.reason || (language === 'de' ? 'Durch Administrator gesperrt' : 'Banned by operator')}
                          </td>
                          <td className="py-2.5 text-slate-500">
                            {banItem.created ? new Date(banItem.created).toLocaleDateString() : (language === 'de' ? 'Permanent' : 'Permanent')}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => handleUnban(banItem.name || banItem.ip, isIp)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium transition-colors inline-flex items-center gap-1 active:scale-95"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>{t('players_pardon')}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Web-Chat Relay & Console Broadcast with Admin Identification & Minecraft Chat */}
        <div className="space-y-6">
          <div className="cyber-glass rounded-2xl p-5 border border-slate-800 flex flex-col h-[580px] shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                  {t('chat_relay_title')}
                </h3>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t('chat_web_minecraft_sync')}
              </span>
            </div>

            {/* Privacy Shield Notice Banner */}
            <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[10px] font-mono text-emerald-300/90 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{t('chat_privacy_notice')}</span>
              </span>
            </div>

            {/* Chat Messages Log */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 font-mono text-xs custom-scrollbar"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                  <Gamepad2 className="w-8 h-8 mb-2 text-slate-600 opacity-60" />
                  <p className="font-semibold text-slate-400">{t('chat_no_messages')}</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[220px]">
                    {t('chat_no_messages_desc')}
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                const isWebAdmin = msg.source === 'web_admin' || msg.isStaff;
                const isMinecraft = msg.source === 'minecraft';

                return (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-xl border transition-all animate-chat-enter ${
                      isWebAdmin
                        ? 'bg-gradient-to-r from-indigo-950/40 to-purple-950/30 border-indigo-500/40 text-indigo-100 shadow-sm'
                        : isMinecraft
                        ? 'bg-[#0d141e]/90 border-emerald-500/25 text-emerald-100'
                        : 'bg-[#0d1117]/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Avatar */}
                        {msg.avatar ? (
                          <img
                            src={msg.avatar}
                            alt={msg.sender}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://minotar.net/helm/Steve/24.png';
                            }}
                            className="w-4 h-4 rounded shadow-sm border border-slate-700 object-cover"
                          />
                        ) : isWebAdmin ? (
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                        ) : isMinecraft ? (
                          <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Radio className="w-3.5 h-3.5 text-slate-500" />
                        )}

                        <span
                          onClick={() => {
                            const foundPlayer = players.find(
                              (p) => p.name.toLowerCase() === msg.sender.toLowerCase()
                            );
                            setSelectedPlayerDetail(
                              foundPlayer || {
                                name: msg.sender,
                                isOp: msg.isStaff,
                                playtime: 'Active',
                                location: 'world (~, ~, ~)',
                                world: 'world',
                                ip: '192.168.1.50',
                                gamemode: 'survival',
                                health: 20,
                              }
                            );
                          }}
                          className={`font-bold text-[11px] cursor-pointer hover:underline transition-all ${
                            isWebAdmin
                              ? 'text-indigo-300'
                              : isMinecraft
                              ? 'text-emerald-300'
                              : 'text-slate-400'
                          }`}
                          title={language === 'de' ? 'Spieler-Details ansehen' : 'Inspect player details'}
                        >
                          {msg.sender}
                        </span>

                        {/* Channel Badge if exists (e.g. [Nation], [Global], [World]) */}
                        {msg.channel && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {msg.channel}
                          </span>
                        )}

                        {/* Origin badge */}
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold ${
                            isWebAdmin
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : isMinecraft
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isWebAdmin ? t('chat_web_admin') : isMinecraft ? t('chat_in_game') : t('chat_system')}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-500 shrink-0">{msg.time}</span>
                    </div>

                    <p className="text-slate-200 break-words leading-relaxed pl-5 font-sans text-xs">
                      {msg.message}
                    </p>
                  </div>
                );
              }))}
            </div>

            {/* Quick Broadcast Chips */}
            <div className="flex items-center gap-1.5 pt-2 pb-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setChatInput((prev) => (prev ? prev : '[Global] '))}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors whitespace-nowrap"
              >
                + [Global]
              </button>
              <button
                type="button"
                onClick={() => setChatInput((prev) => (prev ? prev : '[Nation] '))}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 transition-colors whitespace-nowrap"
              >
                + [Nation]
              </button>
              <button
                type="button"
                onClick={() => setChatInput(t('chat_quick_maintenance'))}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 transition-colors whitespace-nowrap"
              >
                {t('chat_announcement')}
              </button>
            </div>

            {/* Chat Send Form */}
            <form onSubmit={handleSendChat} className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>{t('chat_send_as')}</span>
                  <span className="text-indigo-400 font-bold">
                    {activeAdminName}
                  </span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {t('chat_web_admin')}
                  </span>
                </span>
                <span className="text-emerald-400 text-[10px]">{t('chat_dual_way_relay')}</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder={t('chat_type_placeholder')}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all active:scale-95 shadow-md"
                  title={t('chat_send_title')}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Action Dialog Modal */}
      {activeAction && (
        <Modal
          isOpen={true}
          onClose={() => setActiveAction(null)}
          title={`${activeAction.type.toUpperCase()}: ${activeAction.player.name}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              {activeAction.type === 'teleport'
                ? `Enter coordinates (e.g. 0 100 0) or destination target for ${activeAction.player.name}:`
                : `Specify a reason for ${activeAction.type}ing ${activeAction.player.name}:`}
            </p>

            <input
              type="text"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              placeholder={activeAction.type === 'teleport' ? '0 100 0 or player' : 'Reason for moderation action'}
              className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              autoFocus
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={isSubmitting}
                className={`px-4 py-1.5 rounded-xl text-white text-xs font-mono font-bold transition-all shadow-md ${
                  activeAction.type === 'ban'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : activeAction.type === 'kick'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {isSubmitting ? 'Executing...' : `Confirm ${activeAction.type}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Deep Player Inspection Modal */}
      {selectedPlayerDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPlayerDetail(null)}
          title={language === 'de' ? `SPIELER-INSPEKTION: ${selectedPlayerDetail.name}` : `PLAYER INSPECTION: ${selectedPlayerDetail.name}`}
        >
          <div className="space-y-4">
            {/* Header with Avatar & Status */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0d1117] border border-slate-800">
              <img
                src={`https://minotar.net/helm/${selectedPlayerDetail.name}/64.png`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/64.png';
                }}
                alt={selectedPlayerDetail.name}
                className="w-16 h-16 rounded-xl border border-slate-700 shadow-md object-cover bg-slate-900"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white tracking-wide">{selectedPlayerDetail.name}</h4>
                  {selectedPlayerDetail.isOp && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold">
                      OP
                    </span>
                  )}
                  {selectedPlayerDetail.isWhitelisted && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      WL
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  UUID: <span className="text-slate-300">{selectedPlayerDetail.uuid || 'Offline / Direct Auth'}</span>
                </p>
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    {selectedPlayerDetail.ping !== undefined ? `${selectedPlayerDetail.ping}ms` : '20ms'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {selectedPlayerDetail.playtime || 'Live'}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid of Attributes (IP, World, Coordinates, Gamemode, Health) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              {/* IP Address */}
              <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase text-slate-500 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  {language === 'de' ? 'IP-Adresse & Verbindung' : 'IP Address & Connection'}
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">{selectedPlayerDetail.ip || '192.168.1.100'}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedPlayerDetail.ip || '192.168.1.100');
                      setCopiedDetail('ip');
                      setTimeout(() => setCopiedDetail(null), 1500);
                    }}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                    title="Copy IP"
                  >
                    {copiedDetail === 'ip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Current World */}
              <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  {language === 'de' ? 'Aktuelle Welt / Dimension' : 'Current World / Dimension'}
                </span>
                <span className="text-white font-bold block">{selectedPlayerDetail.world || 'world (Overworld)'}</span>
              </div>

              {/* Coordinates */}
              <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 space-y-1 sm:col-span-2">
                <span className="text-[10px] uppercase text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  {language === 'de' ? 'Welt-Koordinaten (X / Y / Z)' : 'World Coordinates (X / Y / Z)'}
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300 font-bold">
                    {selectedPlayerDetail.location || `${selectedPlayerDetail.x ?? 0}, ${selectedPlayerDetail.y ?? 64}, ${selectedPlayerDetail.z ?? 0}`}
                  </span>
                  <button
                    onClick={() => {
                      const coordStr = selectedPlayerDetail.location || `${selectedPlayerDetail.x ?? 0} ${selectedPlayerDetail.y ?? 64} ${selectedPlayerDetail.z ?? 0}`;
                      navigator.clipboard.writeText(`/tp @s ${coordStr.replace(/,/g, '')}`);
                      setCopiedDetail('tp');
                      setTimeout(() => setCopiedDetail(null), 1500);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
                  >
                    {copiedDetail === 'tp' ? <Check className="w-3 h-3 text-emerald-400" /> : <Compass className="w-3 h-3 text-indigo-400" />}
                    <span>{language === 'de' ? 'Teleport-Befehl kopieren' : 'Copy TP Command'}</span>
                  </button>
                </div>
              </div>

              {/* Gamemode */}
              <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase text-slate-500 flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
                  {language === 'de' ? 'Spielmodus' : 'Game Mode'}
                </span>
                <span className="text-white font-bold uppercase">{selectedPlayerDetail.gamemode || 'SURVIVAL'}</span>
              </div>

              {/* Health */}
              <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase text-slate-500 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  {language === 'de' ? 'Gesundheit (HP)' : 'Health (HP)'}
                </span>
                <span className="text-rose-400 font-bold">
                  {selectedPlayerDetail.health !== undefined ? `${selectedPlayerDetail.health} / 20.0 HP` : '20.0 / 20.0 HP'}
                </span>
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPlayerDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
              >
                {language === 'de' ? 'Schließen' : 'Close'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedPlayerDetail;
                    setSelectedPlayerDetail(null);
                    setActiveAction({ type: 'teleport', player: p });
                    setActionInput('spawn');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition-all shadow-md"
                >
                  Teleport
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedPlayerDetail;
                    setSelectedPlayerDetail(null);
                    setActiveAction({ type: 'kick', player: p });
                    setActionInput('Rule violation');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-bold transition-all shadow-md"
                >
                  Kick
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedPlayerDetail;
                    setSelectedPlayerDetail(null);
                    setActiveAction({ type: 'ban', player: p });
                    setActionInput('Malicious conduct');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all shadow-md"
                >
                  Ban
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
