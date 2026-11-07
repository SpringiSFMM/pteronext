import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import {
  FolderTree,
  PhoneCall,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  Key,
  Users,
  Play,
  RotateCw,
  Plus,
  Radio,
  Trash2,
  Shield,
  ShieldCheck,
  UserX,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Search,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface VoiceClient {
  id: number;
  clid: number;
  name: string;
  channel_id: number;
  channel_name?: string;
  uid?: string;
  version?: string;
  platform?: string;
  muted?: boolean;
  deafened?: boolean;
  talking?: boolean;
  idle_time?: number;
  connected_at?: number;
}

interface VoiceChannel {
  id: number;
  parent_id?: number;
  name: string;
  topic?: string;
  codec: string;
  codec_id?: number;
  codec_quality?: number;
  max_clients: number;
  total_clients?: number;
  is_default?: boolean;
  is_permanent?: boolean;
}

interface VoiceRole {
  id: number;
  name: string;
  type: number;
  icon_id: number;
  is_admin: boolean;
}

interface VoiceToken {
  token: string;
  group_id: number;
  group_name: string;
  description: string;
  created_at: number;
}

type VoiceSubtab = 'channels' | 'clients' | 'roles' | 'tokens' | 'connection';

export const VoiceDashboardTab: React.FC = () => {
  const { selectedServer, addToast, handlePowerAction } = useApp();
  const { language } = useTranslation();
  const isDe = language === 'de';

  const [activeSubtab, setActiveSubtab] = useState<VoiceSubtab>('channels');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const serverUuid = selectedServer?.uuid || selectedServer?.id || '';

  // Data states
  const [channels, setChannels] = useState<VoiceChannel[]>([]);
  const [clients, setClients] = useState<VoiceClient[]>([]);
  const [roles, setRoles] = useState<VoiceRole[]>([]);
  const [tokens, setTokens] = useState<VoiceToken[]>([]);
  const [savedToken, setSavedToken] = useState<string>('');

  // Modals & Action States
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [newChannelMaxClients, setNewChannelMaxClients] = useState<number>(-1);

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const [isAddingToken, setIsAddingToken] = useState(false);
  const [tokenGroupId, setTokenGroupId] = useState<number>(6); // Default Server Admin
  const [tokenDescription, setTokenDescription] = useState('');

  const [clientToKick, setClientToKick] = useState<VoiceClient | null>(null);
  const [kickReason, setKickReason] = useState('');

  const [channelToDelete, setChannelToDelete] = useState<VoiceChannel | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<VoiceRole | null>(null);
  const [tokenToDelete, setTokenToDelete] = useState<VoiceToken | null>(null);

  // Filter state for clients
  const [clientSearch, setClientSearch] = useState('');

  // Parse connection details
  const allocation = selectedServer?.allocation || '127.0.0.1:9987';
  const [host, rawPort] = allocation.split(':');
  const voicePort = rawPort || '9987';
  const queryPort = '10011';
  const fileTransferPort = '30033';

  const isRunning = selectedServer?.status === 'running';

  // Load live voice data
  const loadVoiceData = useCallback(async (isSilent = false) => {
    if (!serverUuid) return;
    if (!isSilent) setLoading(true);
    try {
      const res = await api.voice.getStatus(serverUuid);
      if (res) {
        if (Array.isArray(res.channels)) setChannels(res.channels);
        if (Array.isArray(res.clients)) setClients(res.clients);
        if (Array.isArray(res.roles)) setRoles(res.roles);
        if (Array.isArray(res.tokens)) setTokens(res.tokens);
        if (res.token) setSavedToken(res.token);
      }
    } catch (err: any) {
      console.warn('Voice query error:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [serverUuid]);

  useEffect(() => {
    loadVoiceData();
  }, [loadVoiceData]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVoiceData();
    setTimeout(() => {
      setRefreshing(false);
      addToast({
        title: isDe ? 'Status aktualisiert' : 'Status Refreshed',
        description: isDe
          ? `${clients.length} Clients, ${channels.length} Kanäle, ${roles.length} Rollen synchronisiert.`
          : `Synced ${clients.length} clients, ${channels.length} channels, ${roles.length} roles.`,
        type: 'success',
      });
    }, 400);
  };

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

  // Channel Creation
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      await api.voice.createChannel(serverUuid, {
        name: newChannelName.trim(),
        topic: newChannelTopic.trim() || undefined,
        max_clients: newChannelMaxClients > 0 ? newChannelMaxClients : undefined,
      });

      addToast({
        title: isDe ? 'Kanal erstellt' : 'Channel Created',
        description: newChannelName.trim(),
        type: 'success',
      });

      setNewChannelName('');
      setNewChannelTopic('');
      setNewChannelMaxClients(-1);
      setIsAddingChannel(false);
      loadVoiceData(true);
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Erstellen' : 'Creation Failed',
        description: err?.message || 'Failed to create channel',
        type: 'error',
      });
    }
  };

  // Channel Deletion
  const handleDeleteChannel = async () => {
    if (!channelToDelete) return;
    try {
      await api.voice.deleteChannel(serverUuid, channelToDelete.id);
      addToast({
        title: isDe ? 'Kanal gelöscht' : 'Channel Deleted',
        description: channelToDelete.name,
        type: 'info',
      });
      setChannelToDelete(null);
      loadVoiceData(true);
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Löschen' : 'Deletion Failed',
        description: err?.message || 'Could not delete channel',
        type: 'error',
      });
    }
  };

  // Role Creation
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      await api.voice.createRole(serverUuid, { name: newRoleName.trim() });
      addToast({
        title: isDe ? 'Rolle erstellt' : 'Role Created',
        description: newRoleName.trim(),
        type: 'success',
      });
      setNewRoleName('');
      setIsAddingRole(false);
      loadVoiceData(true);
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Erstellen der Rolle' : 'Role Creation Failed',
        description: err?.message || 'Failed to create server role',
        type: 'error',
      });
    }
  };

  // Role Deletion
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      await api.voice.deleteRole(serverUuid, roleToDelete.id);
      addToast({
        title: isDe ? 'Rolle gelöscht' : 'Role Deleted',
        description: roleToDelete.name,
        type: 'info',
      });
      setRoleToDelete(null);
      loadVoiceData(true);
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Löschen der Rolle' : 'Failed to Delete Role',
        description: err?.message || 'Built-in groups cannot be removed.',
        type: 'error',
      });
    }
  };

  // Token Creation
  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.voice.createToken(serverUuid, {
        group_id: tokenGroupId,
        description: tokenDescription.trim() || undefined,
      });

      addToast({
        title: isDe ? 'Berechtigungsschlüssel generiert' : 'Privilege Key Generated',
        description: res?.token || (isDe ? 'Schlüssel erfolgreich angelegt' : 'Key created'),
        type: 'success',
      });

      setIsAddingToken(false);
      setTokenDescription('');
      loadVoiceData(true);
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Erstellen des Keys' : 'Token Creation Failed',
        description: err?.message || 'Could not generate token',
        type: 'error',
      });
    }
  };

  // Token Deletion
  const handleDeleteToken = async () => {
    if (!tokenToDelete) return;
    try {
      await api.voice.deleteToken(serverUuid, tokenToDelete.token);
      addToast({
        title: isDe ? 'Schlüssel widerrufen' : 'Key Revoked',
        description: tokenToDelete.token,
        type: 'info',
      });
      setTokenToDelete(null);
      loadVoiceData(true);
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Widerrufen' : 'Revocation Failed',
        description: err?.message || 'Could not revoke token',
        type: 'error',
      });
    }
  };

  // Client Kick
  const handleKickClient = async () => {
    if (!clientToKick) return;
    try {
      await api.voice.kickClient(serverUuid, {
        clid: clientToKick.clid,
        message: kickReason.trim() || undefined,
      });

      addToast({
        title: isDe ? 'Benutzer gekickt' : 'Client Kicked',
        description: clientToKick.name,
        type: 'warning',
      });

      setClientToKick(null);
      setKickReason('');
      loadVoiceData(true);
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Kicken' : 'Kick Failed',
        description: err?.message || 'Could not kick client',
        type: 'error',
      });
    }
  };

  const ts3ConnectUrl = `ts3server://${host}?port=${voicePort}`;

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.channel_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.platform?.toLowerCase().includes(clientSearch.toLowerCase())
  );

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
                  ? `${clients.length} ${isDe ? 'verbundene Clients' : 'connected clients'} • ${channels.length} ${channels.length === 1 ? 'Kanal' : 'Kanäle'} • ${roles.length} ${isDe ? 'Rollen' : 'Roles'}`
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
              {isDe ? 'Aktive Kanäle' : 'Active Channels'}
            </span>
            <span className="text-lg font-bold text-indigo-400 font-mono flex items-center gap-1.5">
              <FolderTree className="w-4 h-4" />
              {isRunning ? channels.length : 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">
              {isDe ? 'Server-Gruppen' : 'Server Groups'}
            </span>
            <span className="text-lg font-bold text-amber-400 font-mono flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              {isRunning ? roles.length : 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">
              {isDe ? 'Query Port' : 'Query Port'}
            </span>
            <span className="text-sm font-bold text-slate-200 font-mono pt-1 block">{queryPort} (TCP)</span>
          </div>
        </div>
      </div>

      {/* Subtab Navigation Strip */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d1117] border border-slate-800/80 overflow-x-auto">
        <button
          onClick={() => setActiveSubtab('channels')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
            activeSubtab === 'channels'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>{isDe ? 'Kanäle & Struktur' : 'Channels & Hierarchy'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950/60 text-indigo-300 border border-indigo-700/40">
            {channels.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubtab('clients')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
            activeSubtab === 'clients'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isDe ? 'Verbundene Clients' : 'Connected Clients'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-700/40">
            {clients.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubtab('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
            activeSubtab === 'roles'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>{isDe ? 'Server-Rollen / Gruppen' : 'Server Roles / Groups'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950/60 text-amber-300 border border-amber-700/40">
            {roles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubtab('tokens')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
            activeSubtab === 'tokens'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>{isDe ? 'Berechtigungsschlüssel' : 'Privilege Keys'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {tokens.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubtab('connection')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
            activeSubtab === 'connection'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Wifi className="w-4 h-4" />
          <span>{isDe ? 'Verbindung & Ports' : 'Connection & Ports'}</span>
        </button>
      </div>

      {/* SUBTAB 1: CHANNELS & HIERARCHY */}
      {activeSubtab === 'channels' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                {isDe ? 'TeamSpeak 3 Kanäle & Struktur' : 'Channel Tree & Hierarchy'}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {isRunning && (
                <button
                  onClick={() => setIsAddingChannel(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-medium transition-colors active:scale-95 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Kanal anlegen' : 'Create Channel'}</span>
                </button>
              )}
            </div>
          </div>

          {!isRunning ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
              <PhoneCall className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-slate-400 font-semibold mb-1">
                {isDe ? 'TeamSpeak 3 Server ist gestoppt' : 'TeamSpeak 3 Server is stopped'}
              </p>
              <p className="text-slate-500 max-w-md mx-auto">
                {isDe
                  ? 'Starte den Container, um Sprachkanäle abzufragen und zu verwalten.'
                  : 'Start the container to query and manage voice channels.'}
              </p>
            </div>
          ) : channels.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
              <Radio className="w-8 h-8 text-indigo-400/60 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold mb-1">
                {isDe ? 'Keine Kanäle gefunden' : 'No Channels Found'}
              </p>
              <p className="text-slate-500 max-w-md mx-auto mb-3">
                {isDe
                  ? 'Erstelle deinen ersten permanenten TeamSpeak 3 Kanal.'
                  : 'Create your first permanent TeamSpeak 3 channel.'}
              </p>
              <button
                onClick={() => setIsAddingChannel(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isDe ? 'Kanal anlegen' : 'Create Channel'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => {
                const channelClients = clients.filter((c) => c.channel_id === channel.id);

                return (
                  <div
                    key={channel.id}
                    className="rounded-xl bg-[#0d1117] border border-slate-800/80 overflow-hidden transition-all hover:border-slate-700"
                  >
                    {/* Channel Header */}
                    <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Radio className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-white text-xs font-mono">{channel.name}</span>
                        {channel.is_default && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            DEFAULT
                          </span>
                        )}
                        {channel.topic && (
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            — {channel.topic}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-slate-400">{channel.codec}</span>
                        <span className="text-[11px] font-mono text-indigo-300 font-bold">
                          ({channelClients.length}/{channel.max_clients > 0 ? channel.max_clients : '∞'})
                        </span>

                        {!channel.is_default && (
                          <button
                            onClick={() => setChannelToDelete(channel)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title={isDe ? 'Kanal löschen' : 'Delete Channel'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Channel Clients */}
                    <div className="p-4">
                      {channelClients.length === 0 ? (
                        <div className="py-2 text-center text-slate-600 text-xs font-mono">
                          {isDe ? 'Aktuell keine Benutzer in diesem Kanal' : 'No clients currently in this channel'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {channelClients.map((client) => (
                            <div
                              key={client.clid}
                              className="p-3 rounded-xl border bg-slate-900/40 border-slate-800/80 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative shrink-0">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                                    {client.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d1117] ${
                                      client.talking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                                    }`}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white text-xs font-mono truncate">
                                      {client.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                    <span>{client.platform || 'Client'}</span>
                                    {client.muted ? (
                                      <MicOff className="w-3 h-3 text-rose-400" />
                                    ) : (
                                      <Mic className="w-3 h-3 text-emerald-400" />
                                    )}
                                    {client.deafened && <VolumeX className="w-3 h-3 text-rose-400" />}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => setClientToKick(client)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                                title={isDe ? 'Vom Server kicken' : 'Kick from Server'}
                              >
                                <UserX className="w-4 h-4" />
                              </button>
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
      )}

      {/* SUBTAB 2: CONNECTED CLIENTS */}
      {activeSubtab === 'clients' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                {isDe ? 'Verbundene Benutzer' : 'Connected Clients'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {clients.length}
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isDe ? 'Clients filtern...' : 'Filter clients...'}
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#0d1117] border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {!isRunning ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
              <PhoneCall className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-slate-400 font-semibold mb-1">
                {isDe ? 'TeamSpeak 3 Server ist gestoppt' : 'TeamSpeak 3 Server is stopped'}
              </p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-slate-300 font-semibold mb-1">
                {isDe ? 'Aktuell sind keine Benutzer verbunden' : 'No clients connected'}
              </p>
              <p className="text-slate-500 max-w-md mx-auto mb-3">
                {isDe
                  ? 'Verbinde dich über deinen TeamSpeak 3 Client, um hier live aufzutauchen.'
                  : 'Connect using your TeamSpeak 3 client to appear here live.'}
              </p>
              <a
                href={ts3ConnectUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-mono transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isDe ? 'Jetzt verbinden' : 'Connect now'}</span>
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] font-mono uppercase text-slate-400">
                    <th className="py-2.5 px-3">{isDe ? 'Benutzer' : 'Client'}</th>
                    <th className="py-2.5 px-3">{isDe ? 'Kanal' : 'Channel'}</th>
                    <th className="py-2.5 px-3">{isDe ? 'Plattform' : 'Platform'}</th>
                    <th className="py-2.5 px-3">{isDe ? 'Status' : 'Audio Status'}</th>
                    <th className="py-2.5 px-3">{isDe ? 'Client ID' : 'Client ID'}</th>
                    <th className="py-2.5 px-3 text-right">{isDe ? 'Aktion' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-xs font-mono">
                  {filteredClients.map((client) => (
                    <tr key={client.clid} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-500/30">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{client.name}</span>
                            <span className="text-[10px] text-slate-500 truncate block max-w-[140px]">
                              {client.uid}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 text-[11px]">
                          {client.channel_name || `Kanal #${client.channel_id}`}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        <span>{client.platform || 'TeamSpeak 3'}</span>
                        {client.version && (
                          <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">
                            {client.version}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {client.talking ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                              TALKING
                            </span>
                          ) : client.muted ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold flex items-center gap-1">
                              <MicOff className="w-3 h-3" /> MUTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                              <Mic className="w-3 h-3 text-emerald-400" /> ACTIVE
                            </span>
                          )}

                          {client.deafened && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold flex items-center gap-1">
                              <VolumeX className="w-3 h-3" /> DEAF
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        <span>CLID {client.clid} (DB {client.id})</span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setClientToKick(client)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono ml-auto transition-colors active:scale-95"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>{isDe ? 'Kicken' : 'Kick'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: SERVER ROLES / GROUPS */}
      {activeSubtab === 'roles' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                {isDe ? 'TeamSpeak 3 Server-Gruppen & Rollen' : 'Server Groups & Roles'}
              </h3>
            </div>

            {isRunning && (
              <button
                onClick={() => setIsAddingRole(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-medium transition-colors active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isDe ? 'Rolle erstellen' : 'Create Role'}</span>
              </button>
            )}
          </div>

          {!isRunning ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
              <PhoneCall className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-slate-400 font-semibold mb-1">
                {isDe ? 'TeamSpeak 3 Server ist gestoppt' : 'TeamSpeak 3 Server is stopped'}
              </p>
            </div>
          ) : roles.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
              <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-slate-300 font-semibold mb-1">
                {isDe ? 'Keine Server-Gruppen geladen' : 'No Server Groups Found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="p-4 rounded-xl bg-[#0d1117] border border-slate-800/80 flex flex-col justify-between gap-3 transition-all hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                          role.is_admin
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xs font-mono flex items-center gap-2">
                          {role.name}
                          {role.is_admin && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                              ADMIN
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {role.id} • {role.type === 1 ? 'Server Group' : role.type === 2 ? 'Query Group' : 'Template'}
                        </span>
                      </div>
                    </div>

                    {/* Delete action for custom server groups (built-in templates <= 8 protected) */}
                    {role.id > 8 && (
                      <button
                        onClick={() => setRoleToDelete(role)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                        title={isDe ? 'Rolle löschen' : 'Delete Role'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setTokenGroupId(role.id);
                        setTokenDescription(`Token für ${role.name}`);
                        setIsAddingToken(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-medium transition-colors w-full justify-center active:scale-95"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>{isDe ? 'Privilege Key generieren' : 'Generate Key'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: PRIVILEGE KEYS (TOKENS) */}
      {activeSubtab === 'tokens' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                {isDe ? 'Berechtigungsschlüssel (Privilege Keys)' : 'Privilege Tokens & Keys'}
              </h3>
            </div>

            {isRunning && (
              <button
                onClick={() => setIsAddingToken(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-medium transition-colors active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isDe ? 'Schlüssel erstellen' : 'Generate Key'}</span>
              </button>
            )}
          </div>

          {/* Explanation Alert */}
          <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 flex items-start gap-3 text-xs font-mono text-slate-300 leading-relaxed">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              {isDe
                ? 'Mit Berechtigungsschlüsseln (Privilege Keys) können sich Benutzer im TeamSpeak-Client (über Rechte > Berechtigungsschlüssel benutzen) sofort Admin- oder Moderator-Rechte zuweisen. Ein Key kann einmalig eingelöst werden.'
                : 'Privilege tokens allow connected users in their TeamSpeak client (Permissions > Use Privilege Key) to claim server roles. Each key is single-use.'}
            </p>
          </div>

          {!isRunning ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
              <PhoneCall className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-slate-400 font-semibold mb-1">
                {isDe ? 'TeamSpeak 3 Server ist gestoppt' : 'TeamSpeak 3 Server is stopped'}
              </p>
            </div>
          ) : tokens.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117] rounded-xl border border-slate-800/80">
              <Key className="w-8 h-8 text-indigo-400/60 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold mb-1">
                {isDe ? 'Keine aktiven Berechtigungsschlüssel vorhanden' : 'No active privilege keys'}
              </p>
              <p className="text-slate-500 max-w-md mx-auto mb-3">
                {isDe
                  ? 'Erstelle einen neuen Schlüssel, um dir oder anderen Admins Rechte zu verleihen.'
                  : 'Generate a new token to grant admin rights to yourself or others.'}
              </p>
              <button
                onClick={() => setIsAddingToken(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isDe ? 'Schlüssel erstellen' : 'Generate Key'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#0d1117] border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                      <Key className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-amber-300 font-mono text-xs bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                          {token.group_name || `Gruppe #${token.group_id}`}
                        </span>
                        {token.description && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {token.description}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-xs text-white bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800 break-all select-text">
                        {token.token}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    <button
                      onClick={() => handleCopy(token.token, `token_${idx}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
                    >
                      {copiedKey === `token_${idx}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{isDe ? 'Kopiert' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{isDe ? 'Kopieren' : 'Copy'}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setTokenToDelete(token)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title={isDe ? 'Schlüssel widerrufen' : 'Revoke Token'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 5: CONNECTION ENDPOINTS */}
      {activeSubtab === 'connection' && (
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
      )}

      {/* MODAL: ADD CHANNEL */}
      {isAddingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateChannel}
            className="w-full max-w-md rounded-2xl bg-[#0d1117] border border-indigo-500/30 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                {isDe ? 'Neuen TeamSpeak 3 Kanal erstellen' : 'Create New Voice Channel'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingChannel(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  {isDe ? 'Kanalname *' : 'Channel Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isDe ? 'z. B. Talk 1 / Gaming Lounge' : 'e.g. Gaming Lounge'}
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  {isDe ? 'Thema / Beschreibung (Optional)' : 'Topic / Description (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={isDe ? 'z. B. Bitte keine laute Musik' : 'e.g. General Discussion'}
                  value={newChannelTopic}
                  onChange={(e) => setNewChannelTopic(e.target.value)}
                  className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  {isDe ? 'Maximale Clients (-1 für unbegrenzt)' : 'Max Clients (-1 for unlimited)'}
                </label>
                <input
                  type="number"
                  value={newChannelMaxClients}
                  onChange={(e) => setNewChannelMaxClients(parseInt(e.target.value) || -1)}
                  className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddingChannel(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition-colors shadow-md"
              >
                {isDe ? 'Kanal speichern' : 'Save Channel'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD ROLE */}
      {isAddingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateRole}
            className="w-full max-w-md rounded-2xl bg-[#0d1117] border border-amber-500/30 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                {isDe ? 'Neue Server-Gruppe erstellen' : 'Create New Server Role'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingRole(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                {isDe ? 'Rollenname *' : 'Role Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={isDe ? 'z. B. Moderator / Supporter' : 'e.g. Moderator'}
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddingRole(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-bold transition-colors shadow-md"
              >
                {isDe ? 'Rolle anlegen' : 'Create Role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD TOKEN */}
      {isAddingToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateToken}
            className="w-full max-w-md rounded-2xl bg-[#0d1117] border border-indigo-500/30 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                {isDe ? 'Berechtigungsschlüssel generieren' : 'Generate Privilege Token'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingToken(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  {isDe ? 'Ziel-Rolle / Server-Gruppe *' : 'Target Server Role *'}
                </label>
                <select
                  value={tokenGroupId}
                  onChange={(e) => setTokenGroupId(parseInt(e.target.value))}
                  className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                >
                  {roles.length > 0 ? (
                    roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (ID: {r.id})
                      </option>
                    ))
                  ) : (
                    <option value={6}>Server Admin (ID: 6)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  {isDe ? 'Beschreibung (Optional)' : 'Description (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={isDe ? 'z. B. Für Max Mustermann' : 'e.g. Admin key for Patrick'}
                  value={tokenDescription}
                  onChange={(e) => setTokenDescription(e.target.value)}
                  className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddingToken(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition-colors shadow-md"
              >
                {isDe ? 'Key generieren' : 'Generate Key'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: KICK CLIENT */}
      {clientToKick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1117] border border-rose-500/30 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  {isDe ? 'Benutzer vom Server kicken' : 'Kick Client from Server'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {clientToKick.name} (CLID: {clientToKick.clid})
                </p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                {isDe ? 'Kick-Grund (Optional)' : 'Kick Reason (Optional)'}
              </label>
              <input
                type="text"
                placeholder={isDe ? 'z. B. Bitte Mikrofon stummschalten' : 'e.g. Inappropriate nickname'}
                value={kickReason}
                onChange={(e) => setKickReason(e.target.value)}
                className="w-full bg-[#161b22] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setClientToKick(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleKickClient}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-colors shadow-md"
              >
                {isDe ? 'Jetzt kicken' : 'Kick Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION: DELETE CHANNEL */}
      {channelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0d1117] border border-rose-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  {isDe ? 'Kanal löschen?' : 'Delete Channel?'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{channelToDelete.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              {isDe
                ? 'Möchtest du diesen Sprachkanal wirklich dauerhaft aus dem TeamSpeak 3 Server entfernen? Aktive Clients werden in den Standard-Kanal verschoben.'
                : 'Are you sure you want to permanently delete this voice channel? Any connected clients will be moved to the default channel.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeleteChannel}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-colors shadow-md"
              >
                {isDe ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION: DELETE ROLE */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0d1117] border border-rose-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  {isDe ? 'Rolle löschen?' : 'Delete Role?'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{roleToDelete.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              {isDe
                ? 'Möchtest du diese Server-Gruppe unwiderruflich löschen? Alle Berechtigungen und Zuweisungen gehen verloren.'
                : 'Are you sure you want to delete this server group? All assigned permissions and user links will be removed.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeleteRole}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-colors shadow-md"
              >
                {isDe ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION: DELETE TOKEN */}
      {tokenToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0d1117] border border-rose-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  {isDe ? 'Schlüssel widerrufen?' : 'Revoke Key?'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[220px]">
                  {tokenToDelete.token}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              {isDe
                ? 'Möchtest du diesen Berechtigungsschlüssel widerrufen? Er kann anschließend nicht mehr eingelöst werden.'
                : 'Are you sure you want to revoke this privilege key? It will immediately become invalid.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTokenToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeleteToken}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-colors shadow-md"
              >
                {isDe ? 'Widerrufen' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
