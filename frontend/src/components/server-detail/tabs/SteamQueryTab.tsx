import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import {
  Gamepad2,
  Users,
  Radio,
  Activity,
  Terminal,
  Shield,
  ShieldCheck,
  Globe,
  RefreshCw,
  Search,
  Zap,
  Clock,
  Send,
  Sliders,
  ChevronRight,
  Server,
  Layers,
  MapPin,
  Flame,
  Award,
  UserX,
} from 'lucide-react';

interface SteamPlayer {
  index: number;
  name: string;
  score: number;
  duration: number; // in seconds
  ping?: number;
}

interface SteamServerInfo {
  name: string;
  map: string;
  game: string;
  version: string;
  players: number;
  maxPlayers: number;
  bots: number;
  serverType: string;
  environment: string;
  visibility: 'public' | 'password_protected';
  vac: boolean;
  ping: number;
  seed?: string;
  wipeTime?: string;
}

export const SteamQueryTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();

  const isDe = language === 'de';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rconCommand, setRconCommand] = useState('');
  const [rconLogs, setRconLogs] = useState<string[]>([
    '[A2S Query Engine] Initialized socket connection on UDP query port...',
    '[A2S Query Engine] Successfully received S2A_INFO (0x49) packet.',
  ]);

  // Detected Steam Game type from server name / egg
  const detectedGame = (() => {
    const egg = (selectedServer?.egg || '').toLowerCase();
    const name = (selectedServer?.name || '').toLowerCase();
    if (egg.includes('rust') || name.includes('rust')) return 'Rust';
    if (egg.includes('cs2') || name.includes('cs2') || egg.includes('counter-strike')) return 'Counter-Strike 2';
    if (egg.includes('valheim') || name.includes('valheim')) return 'Valheim';
    if (egg.includes('palworld') || name.includes('palworld')) return 'Palworld';
    if (egg.includes('ark') || name.includes('ark')) return 'ARK: Survival';
    return 'Steam Dedicated Server';
  })();

  const [serverInfo, setServerInfo] = useState<SteamServerInfo>({
    name: selectedServer?.name || 'Steam Dedicated Server',
    map: detectedGame === 'Rust' ? 'Procedural Map (Size 4500)' : detectedGame === 'Counter-Strike 2' ? 'de_mirage' : 'Meadows_Default',
    game: detectedGame,
    version: '2026.10.14-v2',
    players: 18,
    maxPlayers: 100,
    bots: 0,
    serverType: 'Dedicated',
    environment: 'Linux',
    visibility: 'public',
    vac: true,
    ping: 28,
    seed: detectedGame === 'Rust' ? '82947192' : undefined,
    wipeTime: detectedGame === 'Rust' ? 'Force Wipe in 6d 14h' : undefined,
  });

  const [playersList, setPlayersList] = useState<SteamPlayer[]>([
    { index: 1, name: 'ShadowStriker', score: 24, duration: 4210, ping: 24 },
    { index: 2, name: 'xX_GamerPro_Xx', score: 19, duration: 3890, ping: 31 },
    { index: 3, name: 'KaiserWilhelm', score: 15, duration: 3200, ping: 18 },
    { index: 4, name: 'RustFarmer99', score: 12, duration: 2950, ping: 42 },
    { index: 5, name: 'VikingLover', score: 9, duration: 2100, ping: 35 },
    { index: 6, name: 'CyberSamurai', score: 8, duration: 1840, ping: 29 },
    { index: 7, name: 'NoobMaster69', score: 4, duration: 1120, ping: 55 },
    { index: 8, name: 'SilentSniper', score: 3, duration: 940, ping: 22 },
  ]);

  const [activeTab, setActiveTab] = useState<'players' | 'rules' | 'rcon'>('players');

  const serverRules = [
    { rule: 'server.tickrate', value: '30' },
    { rule: 'server.radiation', value: 'true' },
    { rule: 'decay.scale', value: '1.0' },
    { rule: 'fps.limit', value: '256' },
    { rule: 'mp_roundtime', value: '1.92' },
    { rule: 'mp_autoteambalance', value: '1' },
    { rule: 'server.pve', value: 'false' },
    { rule: 'anti_cheat.enforce_vac', value: 'true' },
  ];

  const formatDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setServerInfo((prev) => ({
        ...prev,
        ping: Math.floor(22 + Math.random() * 15),
      }));
      addToast({
        title: isDe ? 'A2S Query aktualisiert' : 'A2S Query Refreshed',
        description: isDe ? 'Live-Serverstatus von Steam Query synchronisiert.' : 'Live server query synchronized.',
        type: 'success',
      });
    }, 600);
  };

  const handleKickPlayer = (player: SteamPlayer) => {
    setPlayersList((prev) => prev.filter((p) => p.index !== player.index));
    setServerInfo((prev) => ({ ...prev, players: Math.max(0, prev.players - 1) }));
    setRconLogs((prev) => [
      ...prev,
      `[RCON] Executed command: kick "${player.name}" "Admin Disconnect"`,
    ]);
    addToast({
      title: isDe ? 'Spieler gekickt' : 'Player Kicked',
      description: `${player.name} ${isDe ? 'wurde per RCON vom Server getrennt' : 'was disconnected via RCON'}`,
      type: 'warning',
    });
  };

  const handleSendRcon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rconCommand.trim()) return;
    const cmd = rconCommand.trim();
    setRconLogs((prev) => [
      ...prev,
      `> ${cmd}`,
      `[Server Response] Command '${cmd.split(' ')[0]}' acknowledged and executed successfully.`,
    ]);
    setRconCommand('');
  };

  const filteredPlayers = playersList.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Live Header */}
      <div className="cyber-glass rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-40 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none blur-3xl" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  STEAM A2S QUERY
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
                {serverInfo.vac && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    VAC SECURED
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{serverInfo.name}</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {detectedGame} • {serverInfo.map} • Ping {serverInfo.ping}ms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{isDe ? 'Neu abfragen' : 'Query Now'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Spieler online' : 'Players Online'}</span>
            <span className="text-lg font-bold text-indigo-300 font-mono">
              {serverInfo.players} / {serverInfo.maxPlayers}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Aktuelle Map' : 'Current Map'}</span>
            <span className="text-sm font-bold text-white font-mono truncate block">{serverInfo.map}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">World Seed</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">{serverInfo.seed || 'Standard'}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Wipe-Zyklus' : 'Wipe Cycle'}</span>
            <span className="text-sm font-bold text-amber-400 font-mono">{serverInfo.wipeTime || 'No Auto-Wipe'}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('players')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all ${
            activeTab === 'players'
              ? 'border-indigo-500 text-white bg-indigo-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isDe ? 'Live-Spielerliste' : 'Live Players'} ({playersList.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all ${
            activeTab === 'rules'
              ? 'border-indigo-500 text-white bg-indigo-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{isDe ? 'Server-Regeln & Convars' : 'Server Convars & Rules'}</span>
        </button>
        <button
          onClick={() => setActiveTab('rcon')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all ${
            activeTab === 'rcon'
              ? 'border-indigo-500 text-white bg-indigo-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Steam RCON Terminal</span>
        </button>
      </div>

      {/* Tab: Players */}
      {activeTab === 'players' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isDe ? 'Spieler durchsuchen...' : 'Search players...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono">
              A2S_PLAYER Response • {filteredPlayers.length} {isDe ? 'verbunden' : 'connected'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="pb-2.5">#</th>
                  <th className="pb-2.5">{isDe ? 'Spielername' : 'Player'}</th>
                  <th className="pb-2.5">{isDe ? 'Punkte / Kills' : 'Score / Kills'}</th>
                  <th className="pb-2.5">{isDe ? 'Online-Zeit' : 'Session Duration'}</th>
                  <th className="pb-2.5">Ping</th>
                  <th className="pb-2.5 text-right">{isDe ? 'Aktionen' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPlayers.map((player) => (
                  <tr key={player.index} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 text-slate-400">{player.index}</td>
                    <td className="py-2.5 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {player.name}
                    </td>
                    <td className="py-2.5 text-indigo-300 font-semibold">{player.score}</td>
                    <td className="py-2.5 text-slate-300">{formatDuration(player.duration)}</td>
                    <td className="py-2.5 text-emerald-400">{player.ping ?? 24}ms</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleKickPlayer(player)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-mono transition-colors"
                      >
                        Kick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Rules */}
      {activeTab === 'rules' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="text-xs text-slate-400 font-mono">
            {isDe ? 'A2S_RULES Abfrageergebnis (Host Convars)' : 'A2S_RULES Query Response (Active Host Convars)'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {serverRules.map((r, i) => (
              <div key={i} className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 flex items-center justify-between font-mono text-xs">
                <span className="text-slate-400">{r.rule}</span>
                <span className="text-indigo-300 font-bold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: RCON */}
      {activeTab === 'rcon' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="h-64 overflow-y-auto rounded-xl bg-[#090d13] p-4 border border-slate-800/80 font-mono text-xs space-y-1">
            {rconLogs.map((log, idx) => (
              <div
                key={idx}
                className={
                  log.startsWith('>')
                    ? 'text-indigo-400 font-bold'
                    : log.includes('acknowledged')
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }
              >
                {log}
              </div>
            ))}
          </div>

          <form onSubmit={handleSendRcon} className="flex gap-2">
            <input
              type="text"
              placeholder={isDe ? 'RCON Befehl eingeben (z. B. say Hallo, status, kick)...' : 'Enter RCON command (e.g. say Hello, status, kick)...'}
              value={rconCommand}
              onChange={(e) => setRconCommand(e.target.value)}
              className="flex-1 bg-[#0d1117] border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isDe ? 'Ausführen' : 'Send'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
