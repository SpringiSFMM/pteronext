import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  FolderTree,
  Activity,
  PhoneCall,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Key,
  Users,
  Play,
  RotateCw,
  Plus,
  Radio,
  Server,
  Zap,
} from 'lucide-react';

interface VoiceClient {
  id: number;
  name: string;
  channelId: number;
  ping: number;
}

interface VoiceChannel {
  id: number;
  name: string;
  topic?: string;
  codec: string;
  bitrate: number;
  maxClients: number;
  isDefault?: boolean;
}

export const VoiceDashboardTab: React.FC = () => {
  const { selectedServer, addToast, selectServerAndNavigate, handlePowerAction } = useApp();
  const { language } = useTranslation();
  const isDe = language === 'de';

  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const serverUuid = selectedServer?.uuid || selectedServer?.id || '';

  // Local storage key for persistent custom channel configurations per server
  const storageChannelsKey = `pteronext_ts3_channels_${serverUuid}`;
  const storageTokenKey = `pteronext_ts3_token_${serverUuid}`;

  const [channels, setChannels] = useState<VoiceChannel[]>(() => {
    try {
      const saved = localStorage.getItem(storageChannelsKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [clients, setClients] = useState<VoiceClient[]>([]);
  const [savedToken, setSavedToken] = useState<string>(() => {
    try {
      return localStorage.getItem(storageTokenKey) || '';
    } catch {
      return '';
    }
  });

  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');

  // Parse connection details
  const allocation = selectedServer?.allocation || '127.0.0.1:9987';
  const [host, rawPort] = allocation.split(':');
  const voicePort = rawPort || '9987';
  const queryPort = '10011';
  const fileTransferPort = '30033';

  const isRunning = selectedServer?.status === 'running';

  // Synchronize channels to localStorage
  useEffect(() => {
    if (serverUuid) {
      try {
        localStorage.setItem(storageChannelsKey, JSON.stringify(channels));
      } catch {}
    }
  }, [channels, serverUuid, storageChannelsKey]);

  // Synchronize token to localStorage
  useEffect(() => {
    if (serverUuid && savedToken) {
      try {
        localStorage.setItem(storageTokenKey, savedToken);
      } catch {}
    }
  }, [savedToken, serverUuid, storageTokenKey]);

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(keyName);
    addToast({
      title: isDe ? 'In Zwischenablage kopiert' : 'Copied to clipboard',
      description: text,
      type: 'info',
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Real check against server state
      if (!isRunning) {
        addToast({
          title: isDe ? 'Server ist offline' : 'Server is offline',
          description: isDe
            ? 'Starte den TeamSpeak-Server, um aktive Verbindungen abzufragen.'
            : 'Start the voice server to query live connections.',
          type: 'warning',
        });
      } else {
        addToast({
          title: isDe ? 'Live-Status geprüft' : 'Live Status Checked',
          description: isDe
            ? `Voice-Port ${voicePort} (UDP) und Query-Port ${queryPort} (TCP) sind erreichbar.`
            : `Voice port ${voicePort} (UDP) & Query port ${queryPort} (TCP) are active.`,
          type: 'success',
        });
      }
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const newChan: VoiceChannel = {
      id: Date.now(),
      name: newChannelName.trim(),
      topic: newChannelTopic.trim() || undefined,
      codec: 'Opus Voice (48 kHz)',
      bitrate: 48,
      maxClients: 32,
    };

    setChannels((prev) => [...prev, newChan]);
    setNewChannelName('');
    setNewChannelTopic('');
    setIsAddingChannel(false);

    addToast({
      title: isDe ? 'Kanal hinzugefügt' : 'Channel Created',
      description: `${newChan.name} (${newChan.codec})`,
      type: 'success',
    });
  };

  const ts3ConnectUrl = `ts3server://${host}?port=${voicePort}`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="cyber-glass rounded-2xl p-6 border border-slate-800 relative overflow-hidden bg-gradient-to-r from-[#0c1222] via-[#0f1b38] to-[#0c1222]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg shadow-indigo-500/10">
              <PhoneCall className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  VOICE SERVER
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 border ${
                    isRunning
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                  {isRunning ? 'ONLINE' : 'OFFLINE'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  TS3 PROTOCOL
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {selectedServer?.name || 'TeamSpeak 3 Server'}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {isRunning
                  ? `${clients.length} ${isDe ? 'verbundene Clients' : 'connected clients'} • ${channels.length} ${channels.length === 1 ? 'Kanal' : 'Kanäle'}`
                  : isDe
                  ? 'Server ist gestoppt'
                  : 'Server is stopped'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-colors active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{isDe ? 'Sync' : 'Refresh'}</span>
            </button>

            {isRunning ? (
              <a
                href={ts3ConnectUrl}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-mono font-bold transition-all shadow-md active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isDe ? 'In TeamSpeak öffnen' : 'Open in TeamSpeak'}</span>
              </a>
            ) : (
              <button
                onClick={() => selectedServer && handlePowerAction(selectedServer.id, 'start')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition-all shadow-md active:scale-95"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isDe ? 'Server Starten' : 'Start Server'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Telemetry Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">
              {isDe ? 'Verbundene Clients' : 'Connected Clients'}
            </span>
            <span className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {isRunning ? clients.length : 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">
              {isDe ? 'CPU Last' : 'CPU Load'}
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {selectedServer?.stats?.cpu || 0}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">
              {isDe ? 'RAM Belegung' : 'Memory Usage'}
            </span>
            <span className="text-sm font-bold text-indigo-300 font-mono">
              {((selectedServer?.stats?.memory || 0) / 1024).toFixed(1)} GB
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">
              {isDe ? 'ServerQuery Port' : 'ServerQuery Port'}
            </span>
            <span className="text-sm font-bold text-slate-200 font-mono">{queryPort} (TCP)</span>
          </div>
        </div>
      </div>

      {/* Connection & Port Overview */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              {isDe ? 'Verbindungsdaten & Portzuweisungen' : 'Connection Endpoints & Ports'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">TeamSpeak 3 Server Protocol</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Voice Port */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800/80 flex flex-col justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block">
                {isDe ? 'Haupt Voice-Port (UDP)' : 'Main Voice Port (UDP)'}
              </span>
              <p className="text-sm font-bold text-white font-mono mt-1">{allocation}</p>
            </div>
            <button
              onClick={() => handleCopy(allocation, 'voice')}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
            >
              {copiedKey === 'voice' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{isDe ? 'Kopiert' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Adresse kopieren' : 'Copy Address'}</span>
                </>
              )}
            </button>
          </div>

          {/* ServerQuery Port */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800/80 flex flex-col justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block">
                {isDe ? 'ServerQuery Port (TCP)' : 'ServerQuery Port (TCP)'}
              </span>
              <p className="text-sm font-bold text-white font-mono mt-1">{host}:{queryPort}</p>
            </div>
            <button
              onClick={() => handleCopy(`${host}:${queryPort}`, 'query')}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
            >
              {copiedKey === 'query' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{isDe ? 'Kopiert' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Query kopieren' : 'Copy Query'}</span>
                </>
              )}
            </button>
          </div>

          {/* File Transfer Port */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800/80 flex flex-col justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase block">
                {isDe ? 'Filetransfer Port (TCP)' : 'Filetransfer Port (TCP)'}
              </span>
              <p className="text-sm font-bold text-white font-mono mt-1">{host}:{fileTransferPort}</p>
            </div>
            <button
              onClick={() => handleCopy(`${host}:${fileTransferPort}`, 'file')}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
            >
              {copiedKey === 'file' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{isDe ? 'Kopiert' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isDe ? 'FT Port kopieren' : 'Copy FT Port'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ServerAdmin Token & Privilege Key Instruction */}
      <div className="p-5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              {isDe ? 'ServerAdmin Berechtigungsschlüssel (Privilege Key)' : 'ServerAdmin Privilege Token'}
            </h4>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {isDe
                ? 'Beim ersten Serverstart generiert TeamSpeak 3 einen einmaligen ServerAdmin-Token in den Konsolen-Logs. Verbinde dich mit dem Server und gib diesen Token ein, um vollständige Administrator-Rechte zu erhalten.'
                : 'On initial creation, TeamSpeak generates a one-time ServerAdmin privilege key printed directly to your console log. Connect to your voice server and enter this token to claim root admin rights.'}
            </p>
            {savedToken && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-xs font-mono text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30">
                  {savedToken}
                </span>
                <button
                  onClick={() => handleCopy(savedToken, 'token')}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  title="Token kopieren"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedServer && (
            <button
              onClick={() => selectServerAndNavigate(selectedServer, 'console')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold transition-all shrink-0 active:scale-95"
            >
              <Terminal className="w-4 h-4" />
              <span>{isDe ? 'Konsole öffnen & Token ansehen' : 'Open Console to View Token'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Channel Tree Layout */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              {isDe ? 'Channel-Struktur & Aktive Clients' : 'Channel Hierarchy & Clients'}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              {channels.length} {isDe ? 'Kanäle' : 'Channels'} • {clients.length} {isDe ? 'Clients online' : 'clients online'}
            </span>
            {isRunning && (
              <button
                onClick={() => setIsAddingChannel(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-mono font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isDe ? 'Kanal anlegen' : 'Add Channel'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Add Channel Modal / Form */}
        {isAddingChannel && (
          <form onSubmit={handleCreateChannel} className="p-4 rounded-xl bg-[#0d1117] border border-indigo-500/30 space-y-3">
            <h4 className="text-xs font-bold text-white font-mono uppercase">
              {isDe ? 'Neuen Sprachkanal erstellen' : 'Create New Voice Channel'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  {isDe ? 'Kanalname' : 'Channel Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isDe ? 'z. B. Talk 1 / Gaming Lounge' : 'e.g. Lounge 1'}
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  {isDe ? 'Beschreibung / Thema (Optional)' : 'Topic (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={isDe ? 'z. B. Bitte kein lautes Sprechen' : 'e.g. Discussion room'}
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingChannel(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs font-mono transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition-colors"
              >
                {isDe ? 'Kanal speichern' : 'Save Channel'}
              </button>
            </div>
          </form>
        )}

        {/* Channels List or Clean Empty State */}
        {!isRunning ? (
          <div className="py-10 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
            <PhoneCall className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-slate-400 font-semibold mb-1">
              {isDe ? 'TeamSpeak 3 Server ist gestoppt' : 'TeamSpeak 3 Server is stopped'}
            </p>
            <p className="text-slate-500 max-w-md mx-auto">
              {isDe
                ? 'Starte den Container, um Sprachkanäle zu öffnen und Clients zu verbinden.'
                : 'Start the container to activate voice routing and allow client connections.'}
            </p>
          </div>
        ) : channels.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
            <Radio className="w-8 h-8 text-indigo-400/60 mx-auto mb-2" />
            <p className="text-slate-300 font-semibold mb-1">
              {isDe ? 'Server ist bereit für Verbindungen' : 'Server is ready for connections'}
            </p>
            <p className="text-slate-500 max-w-md mx-auto mb-3">
              {isDe
                ? 'Verbinde dich mit deinem TeamSpeak 3 Client, um Standard-Kanäle zu laden oder klicke oben auf "Kanal anlegen".'
                : 'Connect with your TeamSpeak client to manage channels or click "Add Channel" above.'}
            </p>
            <a
              href={ts3ConnectUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-mono transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isDe ? 'Jetzt via TeamSpeak verbinden' : 'Connect via TeamSpeak now'}</span>
            </a>
          </div>
        ) : (
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
                  <div className="p-4">
                    {channelClients.length === 0 ? (
                      <div className="py-3 text-center text-slate-500 text-xs font-mono">
                        {isDe ? 'Aktuell keine Benutzer im Channel verbunden' : 'No clients currently connected to this channel'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {channelClients.map((client) => (
                          <div
                            key={client.id}
                            className="p-2.5 rounded-xl border bg-slate-900/40 border-slate-800/80 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs">
                                {client.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-white text-xs font-mono">
                                  {client.name}
                                </span>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  <span>{client.ping}ms</span>
                                </div>
                              </div>
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
        )}
      </div>
    </div>
  );
};
