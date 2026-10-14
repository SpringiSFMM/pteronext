import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Headphones,
  Users,
  Radio,
  FolderTree,
  Shield,
  Plus,
  Trash2,
  Settings,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Activity,
  MessageSquare,
  UserX,
  PhoneCall,
  Wifi,
} from 'lucide-react';

interface VoiceClient {
  id: number;
  name: string;
  channelId: number;
  isTalking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  ping: number;
  packetLoss: number;
  role: 'admin' | 'moderator' | 'user';
}

interface VoiceChannel {
  id: number;
  name: string;
  topic?: string;
  codec: string;
  bitrate: number; // in kbps
  maxClients: number;
  isDefault?: boolean;
}

export const VoiceDashboardTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();
  const isDe = language === 'de';

  const [refreshing, setRefreshing] = useState(false);
  const [channels, setChannels] = useState<VoiceChannel[]>([
    { id: 1, name: 'Lobby (Default)', topic: 'Welcome to PteroNext Voice', codec: 'Opus Voice (48kHz)', bitrate: 48, maxClients: 50, isDefault: true },
    { id: 2, name: 'Squad Alpha [Competitive]', topic: 'Tactical comms only', codec: 'Opus Voice (48kHz)', bitrate: 64, maxClients: 5 },
    { id: 3, name: 'Squad Bravo [Casual]', topic: 'Chill gaming', codec: 'Opus Voice (48kHz)', bitrate: 48, maxClients: 10 },
    { id: 4, name: 'Music Lounge [High-Fi]', topic: '24/7 Radio Bot stream', codec: 'Opus Music (96kHz)', bitrate: 96, maxClients: 25 },
    { id: 5, name: 'AFK / Away', topic: 'Auto-muted channel', codec: 'Opus Voice (32kHz)', bitrate: 32, maxClients: 100 },
  ]);

  const [clients, setClients] = useState<VoiceClient[]>([
    { id: 101, name: 'Commander_Vance', channelId: 2, isTalking: true, isMuted: false, isDeafened: false, ping: 14, packetLoss: 0.0, role: 'admin' },
    { id: 102, name: 'SniperWolf', channelId: 2, isTalking: false, isMuted: false, isDeafened: false, ping: 22, packetLoss: 0.1, role: 'user' },
    { id: 103, name: 'DJ_GrooveBot', channelId: 4, isTalking: true, isMuted: false, isDeafened: true, ping: 4, packetLoss: 0.0, role: 'moderator' },
    { id: 104, name: 'CasualGamer42', channelId: 1, isTalking: false, isMuted: true, isDeafened: false, ping: 35, packetLoss: 0.0, role: 'user' },
    { id: 105, name: 'SleepingBeauty', channelId: 5, isTalking: false, isMuted: true, isDeafened: true, ping: 45, packetLoss: 0.2, role: 'user' },
  ]);

  const [selectedClient, setSelectedClient] = useState<VoiceClient | null>(null);
  const [pokeMessage, setPokeMessage] = useState('');
  const [isPokeModalOpen, setIsPokeModalOpen] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      addToast({
        title: isDe ? 'Voice-Status aktualisiert' : 'Voice Status Refreshed',
        description: isDe ? 'Channels und Clients synchronisiert.' : 'Channels and clients synchronized.',
        type: 'success',
      });
    }, 500);
  };

  const handleKickClient = (client: VoiceClient) => {
    setClients((prev) => prev.filter((c) => c.id !== client.id));
    addToast({
      title: isDe ? 'Client getrennt' : 'Client Disconnected',
      description: `${client.name} ${isDe ? 'wurde vom Voice-Server getrennt' : 'was disconnected from voice server'}`,
      type: 'warning',
    });
  };

  const handleMoveClient = (client: VoiceClient, targetChannelId: number) => {
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, channelId: targetChannelId } : c))
    );
    const targetChannel = channels.find((ch) => ch.id === targetChannelId);
    addToast({
      title: isDe ? 'Client verschoben' : 'Client Moved',
      description: `${client.name} → ${targetChannel?.name}`,
      type: 'info',
    });
  };

  const handleSendPoke = () => {
    if (!selectedClient || !pokeMessage.trim()) return;
    addToast({
      title: isDe ? 'Poke gesendet' : 'Poke Sent',
      description: `"${pokeMessage}" an ${selectedClient.name}`,
      type: 'success',
    });
    setPokeMessage('');
    setIsPokeModalOpen(false);
  };

  const totalClients = clients.length;
  const talkingClients = clients.filter((c) => c.isTalking).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="cyber-glass rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <PhoneCall className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  VOICE SERVER
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  OPUS 48 kHz
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{selectedServer?.name || 'TeamSpeak 3 / Mumble Server'}</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {totalClients} {isDe ? 'verbundene Clients' : 'connected clients'} • {channels.length} Channels • {talkingClients} {isDe ? 'sprechen aktiv' : 'actively talking'}
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{isDe ? 'Aktualisieren' : 'Refresh'}</span>
          </button>
        </div>

        {/* Voice KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Aktive Sprecher' : 'Active Talkers'}</span>
            <span className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-1.5">
              <Mic className="w-4 h-4 animate-bounce" />
              {talkingClients}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Codec-Profil' : 'Codec Profile'}</span>
            <span className="text-sm font-bold text-white font-mono">Opus Ultra-Low Latency</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Durchschn. Ping' : 'Avg Latency'}</span>
            <span className="text-sm font-bold text-indigo-300 font-mono">18.4 ms</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Paketverlust' : 'Packet Loss'}</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">0.02 %</span>
          </div>
        </div>
      </div>

      {/* Channel Tree Layout */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              {isDe ? 'Channel-Struktur & Aktive Clients' : 'Channel Hierarchy & Clients'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {channels.length} Channels • {totalClients} Clients
          </span>
        </div>

        <div className="space-y-3">
          {channels.map((channel) => {
            const channelClients = clients.filter((c) => c.channelId === channel.id);

            return (
              <div
                key={channel.id}
                className="rounded-xl bg-[#0d1117] border border-slate-800/80 overflow-hidden"
              >
                {/* Channel Header */}
                <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white text-xs font-mono">{channel.name}</span>
                    {channel.isDefault && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400 border border-slate-700">
                        DEFAULT
                      </span>
                    )}
                    {channel.topic && (
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        — {channel.topic}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                    <span>{channel.codec}</span>
                    <span>{channel.bitrate} kbps</span>
                    <span className="text-indigo-300 font-bold">
                      ({channelClients.length}/{channel.maxClients})
                    </span>
                  </div>
                </div>

                {/* Channel Clients */}
                <div className="p-3">
                  {channelClients.length === 0 ? (
                    <div className="py-2 px-3 text-slate-600 text-xs font-mono italic">
                      {isDe ? 'Keine Benutzer in diesem Channel' : 'No clients in this channel'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {channelClients.map((client) => (
                        <div
                          key={client.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            client.isTalking
                              ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_12px_-3px_rgba(16,185,129,0.3)]'
                              : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                client.isTalking
                                  ? 'bg-emerald-500 text-black animate-pulse'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {client.isTalking ? (
                                <Mic className="w-3.5 h-3.5" />
                              ) : client.isMuted ? (
                                <MicOff className="w-3.5 h-3.5 text-rose-400" />
                              ) : (
                                client.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-xs font-mono">
                                  {client.name}
                                </span>
                                {client.role === 'admin' && (
                                  <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                <span>{client.ping}ms</span>
                                <span>loss: {client.packetLoss}%</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {client.isDeafened && (
                              <span title="Deafened">
                                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setSelectedClient(client);
                                setIsPokeModalOpen(true);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                              title="Poke / Nachricht"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleKickClient(client)}
                              className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px]"
                              title="Kick Client"
                            >
                              <UserX className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Poke Modal */}
      {isPokeModalOpen && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#161b22] border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white font-mono">
              {isDe ? 'Poke an' : 'Poke Client'} {selectedClient.name}
            </h3>
            <p className="text-xs text-slate-400">
              {isDe ? 'Sendet eine akustische Benachrichtigung an den Client.' : 'Sends an instant poke notification to the client.'}
            </p>
            <input
              type="text"
              placeholder={isDe ? 'Nachricht (z. B. Bitte in Squad Alpha kommen)...' : 'Message (e.g. Please join Squad Alpha)...'}
              value={pokeMessage}
              onChange={(e) => setPokeMessage(e.target.value)}
              className="w-full bg-[#0d1117] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPokeModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSendPoke}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-mono font-bold text-white shadow-md"
              >
                {isDe ? 'Senden' : 'Send Poke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
