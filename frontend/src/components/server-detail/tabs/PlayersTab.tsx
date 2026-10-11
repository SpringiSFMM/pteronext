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
} from 'lucide-react';
import { Modal } from '../../common/Modal';

interface Player {
  uuid?: string;
  name: string;
  ping?: number;
  playtime?: string;
  location?: string;
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

  // Web Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'System Gateway',
      message: 'Dual-Way Chat Relay aktiv. Öffentlicher & nationaler Server-Chat synchronisiert (Private MSGs gefiltert).',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'system',
    },
  ]);
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

  const fetchPlayerData = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayerData();
    const interval = setInterval(fetchPlayerData, 10000);
    return () => clearInterval(interval);
  }, [selectedServer?.uuid]);

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

            // 2. Ignore raw commands other than public broadcasts
            if (/Issued server command:/i.test(clean)) {
              return;
            }

            // 3. Web Admin / Staff broadcast detection
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

            // 4. Normalize Minecraft log timestamps (e.g. "[18:30:12 INFO]: " or "[Async Chat Thread...]: ")
            let body = clean.replace(/^\[?\d{2}:\d{2}:\d{2}(?:\s+\w+)?\]?\s*(?:\[[^\]]+\]\s*)*:\s*/, '');
            body = body.replace(/^\[(?:Async Chat Thread[^\]]*|Server thread[^\]]*|CHAT|NotSecure)\]:?\s*/i, '');
            body = body.trim();

            // 5. Parse Channel / National / Global public messages (e.g. "[Nation] <Steve> Hi" or "[Global] Steve: Hi")
            const channelMatch = body.match(/^\[([a-zA-Z0-9_+\-]{1,16})\]\s*(?:<([a-zA-Z0-9_]{3,16})>|([a-zA-Z0-9_]{3,16}):)\s*(.+)$/);
            if (channelMatch) {
              const channelName = channelMatch[1];
              const player = channelMatch[2] || channelMatch[3];
              const text = channelMatch[4];
              appendRelayMessage({
                sender: player,
                channel: channelName,
                message: text,
                source: 'minecraft',
                avatar: `https://minotar.net/helm/${player}/32.png`,
              });
              return;
            }

            // 6. Parse Standard Public Chat (e.g. "<Steve> Hi" or "[NotSecure] <Steve> Hi")
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

            // 7. Parse Server Join/Leave notifications
            const joinLeaveMatch = body.match(/^([a-zA-Z0-9_]{3,16})\s+(joined the game|left the game)/i);
            if (joinLeaveMatch) {
              const player = joinLeaveMatch[1];
              const action = joinLeaveMatch[2];
              appendRelayMessage({
                sender: 'Server Gateway',
                message: `⚡ ${player} ${action}`,
                source: 'system',
              });
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
              Player & Community Dashboard
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              Live Gateway
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time player monitoring, instant moderation quick-actions, and dual-way chat relay.
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
            onClick={fetchPlayerData}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Refresh Player List"
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
                  Active Players ({filteredPlayers.length})
                </h3>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search player..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {loading && players.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono animate-pulse">
                Querying live game container for active connections...
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117]/40 rounded-xl border border-slate-800/50">
                No active players online right now.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.name}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#0d1117]/80 border border-slate-800/80 hover:border-slate-700 transition-all group"
                  >
                    {/* Player Info */}
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={`https://minotar.net/helm/${player.name}/40.png`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://minotar.net/helm/Steve/40.png';
                          }}
                          alt={player.name}
                          className="w-10 h-10 rounded-lg shadow-sm border border-slate-700 bg-slate-900 object-cover"
                        />
                        {player.isOp && (
                          <div className="absolute -top-1 -right-1 p-0.5 bg-amber-500 rounded-full text-slate-950 shadow">
                            <Crown className="w-2.5 h-2.5 fill-current" />
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white tracking-wide">
                            {player.name}
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
                          {player.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-indigo-400" />
                              {player.location}
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
                  Banned Players & Network Blocks ({bannedPlayers.length})
                </h3>
              </div>
            </div>

            {bannedPlayers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-mono bg-[#0d1117]/30 rounded-xl border border-slate-800/50">
                No active bans recorded. The ban list is empty.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
                      <th className="pb-2.5">Target</th>
                      <th className="pb-2.5">Type</th>
                      <th className="pb-2.5">Reason</th>
                      <th className="pb-2.5">Created</th>
                      <th className="pb-2.5 text-right">Action</th>
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
                            {banItem.reason || 'Banned by operator'}
                          </td>
                          <td className="py-2.5 text-slate-500">
                            {banItem.created ? new Date(banItem.created).toLocaleDateString() : 'Permanent'}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => handleUnban(banItem.name || banItem.ip, isIp)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Pardon</span>
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
                  Live Chat Relay
                </h3>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Web & Minecraft Live-Sync
              </span>
            </div>

            {/* Privacy Shield Notice Banner */}
            <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[10px] font-mono text-emerald-300/90 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Öffentlicher & nationaler Chat aktiv. Private MSGs (/msg, /tell, /w) werden ausgeblendet.</span>
              </span>
            </div>

            {/* Chat Messages Log */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 font-mono text-xs custom-scrollbar"
            >
              {chatMessages.map((msg) => {
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
                          className={`font-bold text-[11px] ${
                            isWebAdmin
                              ? 'text-indigo-300'
                              : isMinecraft
                              ? 'text-emerald-300'
                              : 'text-slate-400'
                          }`}
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
                          {isWebAdmin ? 'Web Admin' : isMinecraft ? 'In-Game' : 'System'}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-500 shrink-0">{msg.time}</span>
                    </div>

                    <p className="text-slate-200 break-words leading-relaxed pl-5 font-sans text-xs">
                      {msg.message}
                    </p>
                  </div>
                );
              })}
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
                onClick={() => setChatInput('⚡ Wartungsarbeiten starten in Kürze.')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 transition-colors whitespace-nowrap"
              >
                ⚡ Ankündigung
              </button>
            </div>

            {/* Chat Send Form */}
            <form onSubmit={handleSendChat} className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>Sende als:</span>
                  <span className="text-indigo-400 font-bold">
                    {activeAdminName}
                  </span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Web Admin
                  </span>
                </span>
                <span className="text-emerald-400 text-[10px]">Dual-Way Relay</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder={`Öffentliche Nachricht an Server senden...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all active:scale-95 shadow-md"
                  title="In den Minecraft-Chat senden"
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
    </div>
  );
};
