import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  HardDrive,
  Users,
  Package,
  Server,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Inbox,
  Plus,
  Activity,
  Cpu,
  Database,
  Globe,
  Zap,
  TrendingUp,
  MessageSquare,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  Bot,
  Palette,
  AlertTriangle,
  Sparkles,
  Trash2,
  Key,
} from 'lucide-react';
import { COLOR_THEMES } from '../../types';

const formatResourceMB = (mb: number): string => {
  if (isNaN(mb) || mb < 0) return '0 MB';
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
};

export const AdminDashboardView: React.FC = () => {
  const {
    adminNodes,
    adminUsers,
    adminNests,
    adminEggs,
    adminLoading,
    refreshAdminData,
    servers,
    setActiveView,
    setIsCreateServerOpen,
    openAccountSettings,
    selectServerAndNavigate,
    addToast,
    language,
    colorTheme,
    globalColorTheme,
    setGlobalColorTheme,
  } = useApp();

  // Discord Bot & OAuth Integration State
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordClientId, setDiscordClientId] = useState('');
  const [discordClientSecret, setDiscordClientSecret] = useState('');
  const [discordBotToken, setDiscordBotToken] = useState('');
  const [discordGuildId, setDiscordGuildId] = useState('');
  const [showBotToken, setShowBotToken] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [savingDiscord, setSavingDiscord] = useState(false);
  const [botActive, setBotActive] = useState(false);

  // Cloudflare DNS Automation Integration State
  const [cfEnabled, setCfEnabled] = useState(false);
  const [cfApiToken, setCfApiToken] = useState('');
  const [cfZoneId, setCfZoneId] = useState('');
  const [cfBaseDomain, setCfBaseDomain] = useState('');
  const [showCfToken, setShowCfToken] = useState(false);
  const [savingCf, setSavingCf] = useState(false);
  const [cfActive, setCfActive] = useState(false);

  // Watchdog & Disk Balancer Health State
  const [storageHealth, setStorageHealth] = useState<any>(null);
  const [watchdogInfo, setWatchdogInfo] = useState<any>(null);
  const [isCleaningLogs, setIsCleaningLogs] = useState(false);

  useEffect(() => {
    const loadDiscord = async () => {
      try {
        const res = await api.discord.getConfig();
        if (res) {
          setDiscordEnabled(Boolean(res.enabled));
          setDiscordClientId(res.client_id || '');
          setDiscordClientSecret(res.client_secret || '');
          setDiscordBotToken(res.bot_token || '');
          setDiscordGuildId(res.guild_id || '');
          setBotActive(Boolean(res.bot_active));
        }
      } catch (e) {
        console.warn('Could not load Discord config:', e);
      }
    };

    const loadCf = async () => {
      try {
        const res = await api.dns.getCloudflareConfig();
        if (res) {
          setCfEnabled(Boolean(res.enabled));
          setCfApiToken(res.api_token || '');
          setCfZoneId(res.zone_id || '');
          setCfBaseDomain(res.base_domain || '');
          setCfActive(Boolean(res.is_active));
        }
      } catch (e) {
        console.warn('Could not load Cloudflare config:', e);
      }
    };

    const loadHealthWatchdog = async () => {
      try {
        const [storageRes, watchdogRes] = await Promise.allSettled([
          api.stats.getStorageHealth(),
          api.stats.getWatchdogHealth(),
        ]);
        if (storageRes.status === 'fulfilled') {
          setStorageHealth(storageRes.value);
        }
        if (watchdogRes.status === 'fulfilled') {
          setWatchdogInfo(watchdogRes.value);
        }
      } catch (e) {
        console.warn('Could not load health watchdog:', e);
      }
    };

    loadDiscord();
    loadCf();
    loadHealthWatchdog();
  }, []);

  const handleCleanLogs = async () => {
    try {
      setIsCleaningLogs(true);
      const res = await api.stats.cleanOldLogs();
      addToast({
        title: language === 'de' ? 'Log-Dateien bereinigt' : 'Logs Cleaned',
        description: res.message || `${res.cleaned_files} alte Logs gelöscht (${res.freed_mb?.toFixed(1)} MB freigegeben).`,
        type: 'success',
      });
      const health = await api.stats.getStorageHealth();
      setStorageHealth(health);
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Bereinigung fehlgeschlagen' : 'Cleaning Failed',
        description: err.message || 'Could not clean logs',
        type: 'error',
      });
    } finally {
      setIsCleaningLogs(false);
    }
  };

  const handleSaveCf = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCf(true);
    try {
      await api.dns.saveCloudflareConfig({
        enabled: cfEnabled,
        api_token: cfApiToken,
        zone_id: cfZoneId,
        base_domain: cfBaseDomain,
      });
      setCfActive(Boolean(cfApiToken && cfZoneId));
      addToast({
        title: language === 'de' ? 'Cloudflare-Einstellungen gespeichert' : 'Cloudflare Settings Saved',
        description: language === 'de'
          ? 'Cloudflare DNS- & SRV-Automation erfolgreich aktualisiert.'
          : 'Cloudflare DNS & SRV settings successfully saved.',
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Speichern fehlgeschlagen' : 'Save Failed',
        description: err.message || 'Failed saving Cloudflare config',
        type: 'error',
      });
    } finally {
      setSavingCf(false);
    }
  };

  const handleSaveDiscord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDiscord(true);
    try {
      await api.discord.saveConfig({
        enabled: discordEnabled,
        client_id: discordClientId,
        client_secret: discordClientSecret,
        bot_token: discordBotToken,
        guild_id: discordGuildId,
        redirect_uri: window.location.origin + '/api/auth/discord/callback',
      });
      setBotActive(Boolean(discordBotToken));
      addToast({
        title: language === 'de' ? 'Discord-Einstellungen gespeichert' : 'Discord Settings Saved',
        description: language === 'de' ? 'Die Bot- und Authentifizierungs-Konfiguration wurde aktualisiert.' : 'Bot and OAuth configuration updated.',
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Fehler beim Speichern' : 'Save Error',
        description: err.message || 'Failed saving Discord config',
        type: 'error',
      });
    } finally {
      setSavingDiscord(false);
    }
  };

  const runningServers = servers.filter((s) => s.status === 'running').length;
  const stoppedServers = servers.filter((s) => s.status === 'offline').length;
  const startingServers = servers.filter((s) => s.status === 'starting').length;
  const rootAdmins = adminUsers.filter((u) => u.rootAdmin).length;

  // Calculate cluster totals
  const totalRamAllocatedMB = servers.reduce((acc, s) => acc + (s.stats.memoryLimit || 1024), 0);
  const totalDiskAllocatedMB = servers.reduce((acc, s) => acc + (s.stats.diskLimit || 5120), 0);
  const totalNodeRamMB = adminNodes.reduce((acc, n) => acc + (n.ramTotalMB || 8192), 0) || 16384;
  const totalNodeDiskMB = adminNodes.reduce((acc, n) => acc + (n.diskTotalMB || 102400), 0) || 102400;

  const ramUsagePercent = Math.min(100, Math.round((totalRamAllocatedMB / totalNodeRamMB) * 100));
  const diskUsagePercent = Math.min(100, Math.round((totalDiskAllocatedMB / totalNodeDiskMB) * 100));

  const stats = [
    {
      label: 'Managed Servers',
      value: servers.length,
      sub: `${runningServers} online, ${stoppedServers} offline`,
      icon: Server,
      tone: 'text-emerald-400',
      target: 'admin-servers',
    },
    {
      label: 'Compute Nodes (Wings)',
      value: adminNodes.length,
      sub: `${adminNodes.filter((n) => n.status === 'healthy').length} healthy`,
      icon: HardDrive,
      tone: 'text-zinc-300',
      target: 'admin-nodes',
    },
    {
      label: 'Panel Accounts',
      value: adminUsers.length,
      sub: `${rootAdmins} root administrator${rootAdmins === 1 ? '' : 's'}`,
      icon: Users,
      tone: 'text-slate-300',
      target: 'admin-users',
    },
    {
      label: 'Eggs & Nests',
      value: adminEggs.length,
      sub: `Across ${adminNests.length} game nest${adminNests.length === 1 ? '' : 's'}`,
      icon: Package,
      tone: 'text-purple-400',
      target: 'admin-eggs',
    },
  ];

  return (
    <div className="space-y-6 view-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
              Root Administration
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Cluster telemetry, Wings nodes, container allocations, and egg distributions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => refreshAdminData()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs font-medium text-slate-300 hover:text-white transition-colors"
            disabled={adminLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${adminLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => openAccountSettings('api-keys')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-indigo-500/30 text-xs font-medium text-indigo-300 hover:text-white transition-colors"
            title="API-Keys &amp; REST Tokens verwalten"
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>{language === 'de' ? 'API-Keys' : 'API Keys'}</span>
          </button>

          <button
            onClick={() => setIsCreateServerOpen(true)}
            className="btn btn-primary px-4 py-2 text-xs font-bold font-mono transition-all shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Server</span>
          </button>
        </div>
      </div>

      {/* Storage 90% Alert Banner & Watchdog Status */}
      {storageHealth?.overall_status === 'warning' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold font-mono uppercase tracking-wide">
                {language === 'de' ? 'Speicher-Warnung: Node Festplatten-Limit fast erreicht (>90%)' : 'Smart Storage Alert: Host Node nearing disk capacity (>90%)'}
              </p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                {storageHealth.alert_message || (language === 'de' ? 'Eine oder mehrere Nodes haben über 90% Speicherauslastung.' : 'One or more host nodes have exceeded 90% allocated disk storage.')}
              </p>
            </div>
          </div>
          <button
            onClick={handleCleanLogs}
            disabled={isCleaningLogs}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-mono font-bold transition-all whitespace-nowrap active:scale-95 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isCleaningLogs ? (language === 'de' ? 'Bereinige...' : 'Cleaning...') : (language === 'de' ? 'Alte Logs bereinigen (>14d)' : 'Auto-Clean Logs (>14d)')}</span>
          </button>
        </div>
      )}

      {/* Auto-Clean Logs Bar if healthy */}
      {storageHealth && storageHealth.overall_status !== 'warning' && (
        <div className="p-3.5 rounded-xl bg-[#11141a] border border-[#30363d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300 font-semibold">
              {language === 'de' ? 'Multi-Node Disk Space Balancer & Health Watchdog:' : 'Multi-Node Disk Space Balancer & Health Watchdog:'}
            </span>
            <span className="text-emerald-400">
              {storageHealth.nodes?.length || adminNodes.length} Nodes {language === 'de' ? 'geprüft' : 'monitored'}
            </span>
            {watchdogInfo?.unresponsive_count > 0 && (
              <span className="text-rose-400 font-bold">
                · {watchdogInfo.unresponsive_count} {language === 'de' ? 'Container unresponsive' : 'container(s) unresponsive'}
              </span>
            )}
          </div>
          <button
            onClick={handleCleanLogs}
            disabled={isCleaningLogs}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono transition-colors active:scale-95 disabled:opacity-50 self-start sm:self-auto"
          >
            <Trash2 className="w-3 h-3 text-slate-400" />
            <span>{isCleaningLogs ? '...' : (language === 'de' ? 'Log-Rotation & Auto-Clean' : 'Log-Rotation & Auto-Clean')}</span>
          </button>
        </div>
      )}

      {/* Admin Quick Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              onClick={() => setActiveView(stat.target as any)}
              className="p-5 rounded-2xl bg-[#11141a] border border-[#30363d] hover:border-[#484f58] transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
                  {stat.label}
                </span>
                <div className="p-2 rounded-xl bg-[#161b22] border border-[#30363d]">
                  <Icon className={`w-4 h-4 ${stat.tone}`} />
                </div>
              </div>
              {adminLoading ? (
                <div className="h-7 w-16 bg-[#161b22] rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-white font-mono">{stat.value}</p>
              )}
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                <span>{stat.sub}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>
          );
        })}
      </div>

      {/* Cluster Allocation & Telemetry Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Memory Capacity */}
        <div className="p-5 rounded-2xl bg-[#11141a] border border-[#30363d] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">
              RAM Commitment
            </span>
            <span className="text-xs font-mono text-zinc-200 font-bold">
              {ramUsagePercent}%
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-400">Allocated RAM</span>
              <span className="text-white font-semibold">
                {(totalRamAllocatedMB / 1024).toFixed(1)} / {(totalNodeRamMB / 1024).toFixed(1)} GB
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#161b22] overflow-hidden">
              <div
                className="h-full bg-zinc-300 rounded-full transition-all duration-500"
                style={{ width: `${ramUsagePercent}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 font-mono">
            Sum of all max memory bounds assigned across active containers.
          </p>
        </div>

        {/* Disk Capacity */}
        <div className="p-5 rounded-2xl bg-[#11141a] border border-[#30363d] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">
              Disk Commitment
            </span>
            <span className="text-xs font-mono text-purple-400 font-bold">
              {diskUsagePercent}%
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-400">Storage Assigned</span>
              <span className="text-white font-semibold">
                {(totalDiskAllocatedMB / 1024).toFixed(1)} / {(totalNodeDiskMB / 1024).toFixed(1)} GB
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#161b22] overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${diskUsagePercent}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 font-mono">
            Host volume disk limits bound across node volumes.
          </p>
        </div>

        {/* Server State Distribution */}
        <div className="p-5 rounded-2xl bg-[#11141a] border border-[#30363d] space-y-3">
          <span className="text-xs font-mono uppercase text-slate-400 font-bold block">
            Container Fleet Status
          </span>

          <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-lg font-bold text-emerald-400 block">{runningServers}</span>
              <span className="text-[10px] text-slate-400">Running</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-[#30363d]">
              <span className="text-lg font-bold text-slate-300 block">{stoppedServers}</span>
              <span className="text-[10px] text-slate-400">Stopped</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-lg font-bold text-amber-400 block">{startingServers}</span>
              <span className="text-[10px] text-slate-400">Starting</span>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Daemon Protocol: Wings REST/WS</span>
            <span className="text-emerald-400">Active</span>
          </div>
        </div>
      </div>

      {/* Cluster Node Capacity Overview */}
      <div className="p-6 rounded-2xl bg-[#11141a] border border-[#30363d] space-y-4">
        <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Wings Infrastructure Nodes ({adminNodes.length})
            </h2>
          </div>

          <button
            onClick={() => setActiveView('admin-nodes')}
            className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>Manage Nodes</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {adminNodes.length === 0 ? (
          <div className="py-8 text-center">
            <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">No nodes registered yet</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Register a Wings daemon under Nodes to schedule containers.
            </p>
            <button
              onClick={() => setActiveView('admin-nodes')}
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 font-mono text-xs font-bold"
            >
              Register First Node
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {adminNodes.map((node) => (
              <div
                key={node.id}
                className="p-4 rounded-xl bg-[#0d1017] border border-[#30363d] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] text-slate-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white truncate">{node.name}</h3>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{node.fqdn}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                      node.status === 'healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {node.status === 'healthy' ? 'Online' : 'Maintenance'}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>RAM Allocation</span>
                      <span className="text-slate-200">
                        {formatResourceMB(node.ramAllocatedMB)} / {formatResourceMB(node.ramTotalMB)} ({node.ramUsage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#161b22] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          node.ramUsage > 100
                            ? 'bg-amber-400'
                            : node.ramUsage >= 90
                            ? 'bg-rose-400'
                            : 'bg-zinc-300'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, node.ramUsage))}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Disk Allocation</span>
                      <span className="text-slate-200">
                        {formatResourceMB(node.diskAllocatedMB)} / {formatResourceMB(node.diskTotalMB)} ({node.diskUsage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#161b22] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          node.diskUsage > 100
                            ? 'bg-amber-400'
                            : node.diskUsage >= 90
                            ? 'bg-rose-400'
                            : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, node.diskUsage))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-slate-400 pt-1">
                    <span>Active Containers</span>
                    <span className="text-slate-200">
                      {node.activeServers} / {node.totalAllocations} allocations
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discord Bot & OAuth2 Integration Panel */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#11141a] to-[#5865F2]/10 border border-[#5865F2]/30 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#5865F2]/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5865F2] flex items-center justify-center text-white shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white font-mono">
                  {language === 'de' ? 'Discord-Bot & OAuth2-Authentifizierung' : 'Discord Bot & OAuth2 Integration'}
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                    discordEnabled && botActive
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {discordEnabled && botActive
                    ? (language === 'de' ? 'Bot Aktiv & Verbunden' : 'Bot Active & Connected')
                    : (language === 'de' ? 'Nicht Konfiguriert' : 'Not Configured')}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {language === 'de'
                  ? 'Ermöglicht 1-Klick Discord-Anmeldung für Benutzer und automatisierte Bot-Server-Benachrichtigungen.'
                  : 'Enables 1-click Discord sign-in for panel users and automated bot status notifications.'}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto">
            <span className="text-xs font-mono text-slate-300 font-semibold">
              {language === 'de' ? 'Discord-Login Aktiv' : 'Enable Discord Login'}
            </span>
            <input
              type="checkbox"
              checked={discordEnabled}
              onChange={(e) => setDiscordEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-[#5865F2] focus:ring-0 bg-slate-900 border-slate-700"
            />
          </label>
        </div>

        <form onSubmit={handleSaveDiscord} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                Discord Client ID
              </label>
              <input
                type="text"
                placeholder="102938475610293847"
                value={discordClientId}
                onChange={(e) => setDiscordClientId(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#5865F2]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                Discord Client Secret
              </label>
              <div className="relative">
                <input
                  type={showClientSecret ? 'text' : 'password'}
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={discordClientSecret}
                  onChange={(e) => setDiscordClientSecret(e.target.value)}
                  className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3.5 py-2 pr-10 text-xs text-white font-mono focus:outline-none focus:border-[#5865F2]"
                />
                <button
                  type="button"
                  onClick={() => setShowClientSecret(!showClientSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showClientSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                Discord Bot Token {language === 'de' ? '(Vollzugriff ein-/ausblenden)' : '(Full access show/hide)'}
              </label>
              <div className="relative">
                <input
                  type={showBotToken ? 'text' : 'password'}
                  placeholder="MTAyOTM4NDc1NjEwMjkzODQ3.G..."
                  value={discordBotToken}
                  onChange={(e) => setDiscordBotToken(e.target.value)}
                  className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3.5 py-2 pr-10 text-xs text-white font-mono focus:outline-none focus:border-[#5865F2]"
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title={showBotToken ? 'Token verbergen' : 'Token einblenden'}
                >
                  {showBotToken ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                Discord Guild / Server ID {language === 'de' ? '(Erforderlich für Bot-DM-Verifikation)' : '(Required for Bot DM Verification)'}
              </label>
              <input
                type="text"
                placeholder="109283746510928374"
                value={discordGuildId}
                onChange={(e) => setDiscordGuildId(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#5865F2]"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <p className="text-[11px] font-mono text-slate-400">
              OAuth2 Redirect URI: <code className="text-indigo-300">{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/discord/callback</code>
            </p>
            <button
              type="submit"
              disabled={savingDiscord}
              className="px-5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-mono font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95 self-end sm:self-auto"
            >
              {savingDiscord ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{language === 'de' ? 'Discord-Konfiguration speichern' : 'Save Discord Configuration'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Cloudflare DNS- & SRV-Automation Integration Panel */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#11141a] to-sky-950/20 border border-sky-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363d] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide font-mono">
                  {language === 'de' ? 'Cloudflare DNS- & SRV-Automation' : 'Cloudflare DNS & SRV Automation'}
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    cfEnabled && cfActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {cfEnabled && cfActive
                    ? (language === 'de' ? 'API Verbunden' : 'API Connected')
                    : (language === 'de' ? 'Nicht Aktiv' : 'Inactive')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'de'
                  ? 'Ermöglicht automatische A- & SRV-Records für Server-Subdomains direkt über die Cloudflare-API.'
                  : 'Automates A & SRV record provisioning for gaming subdomains via the Cloudflare API.'}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto">
            <span className="text-xs font-mono text-slate-300">
              {language === 'de' ? 'Cloudflare Aktiv' : 'Enable Cloudflare'}
            </span>
            <input
              type="checkbox"
              checked={cfEnabled}
              onChange={(e) => setCfEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 border-slate-700 bg-slate-900 focus:ring-0"
            />
          </label>
        </div>

        <form onSubmit={handleSaveCf} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Cloudflare Zone ID
              </label>
              <input
                type="text"
                placeholder="z. B. 023e105f4ecef8ad9ca31a8372d0c353"
                value={cfZoneId}
                onChange={(e) => setCfZoneId(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                {language === 'de' ? 'Standard Base Domain' : 'Default Base Domain'}
              </label>
              <input
                type="text"
                placeholder="z. B. springisfm.de"
                value={cfBaseDomain}
                onChange={(e) => setCfBaseDomain(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Cloudflare API Token {language === 'de' ? '(Ein-/Ausblenden)' : '(Show/Hide)'}
            </label>
            <div className="relative">
              <input
                type={showCfToken ? 'text' : 'password'}
                placeholder="Cloudflare API Bearer Token (Berechtigung: Zone.DNS:Edit)"
                value={cfApiToken}
                onChange={(e) => setCfApiToken(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3.5 py-2 pr-10 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowCfToken((prev) => !prev)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-mono"
              >
                {showCfToken ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              disabled={savingCf}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-mono font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              {savingCf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{language === 'de' ? 'Cloudflare-Einstellungen speichern' : 'Save Cloudflare Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Cluster Servers Management Snapshot */}
      <div className="p-6 rounded-2xl bg-[#11141a] border border-[#30363d] space-y-4">
        <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Managed Cluster Servers ({servers.length})
            </h2>
          </div>

          <button
            onClick={() => setActiveView('admin-servers')}
            className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 font-semibold transition-colors"
          >
            <span>Open All in Server Manager</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {servers.slice(0, 6).map((srv) => (
            <div
              key={srv.id}
              className="p-3.5 rounded-xl bg-[#0d1017] border border-[#2b3342] hover:border-[#484f58] transition-all flex flex-col justify-between gap-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      onClick={() => selectServerAndNavigate(srv, 'console')}
                      className="text-xs font-bold text-white hover:underline cursor-pointer truncate"
                    >
                      {srv.name}
                    </h3>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    {srv.node} • {srv.allocation}
                  </p>
                </div>

                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 font-medium ${
                    srv.isSuspended
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : srv.status === 'running'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {srv.isSuspended ? 'Suspended' : srv.status === 'running' ? 'Online' : 'Stopped'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1e2530] text-[11px] font-mono">
                <span className="text-slate-400">
                  RAM: <strong className="text-white">{(srv.stats.memoryLimit / 1024).toFixed(1)}GB</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => selectServerAndNavigate(srv, 'console')}
                    className="px-2 py-1 rounded bg-[#161b22] hover:bg-slate-800 text-slate-300 hover:text-white border border-[#30363d] text-[10px]"
                    title="Console"
                  >
                    Console
                  </button>
                  <button
                    onClick={() => setActiveView('admin-servers')}
                    className="px-2 py-1 rounded bg-[#161b22] hover:bg-slate-800 text-slate-300 border border-[#30363d] text-[10px]"
                    title="Configure in Admin Servers"
                  >
                    Settings
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Global Theme & UI Styling Configuration */}
      <div className="p-6 rounded-2xl bg-[#11141a] border border-[#30363d] space-y-4">
        <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              {language === 'de' ? 'Globales Panel Theme & Akzentfarben' : 'Global Panel Theme & Accent Colors'}
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {language === 'de' ? 'Globales Theme:' : 'Global Theme:'} <strong className="text-white capitalize">{globalColorTheme}</strong>
          </span>
        </div>

        <p className="text-xs text-slate-400">
          {language === 'de'
            ? 'Wähle das systemweite Standard-Theme für alle Nutzer und Gäste. Nutzer, die in ihren Account-Settings ein persönliches Theme gewählt haben, behalten ihr eigenes Theme.'
            : 'Select the system-wide default theme for all users and guests. Users who have chosen a personal theme in their Account Settings will retain their personal theme.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
          {COLOR_THEMES.map((theme) => {
            const isSelected = globalColorTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={async () => {
                  const ok = await setGlobalColorTheme(theme.id);
                  if (ok) {
                    addToast({
                      title: language === 'de' ? 'Globales Theme aktualisiert' : 'Global Theme Updated',
                      description: `${theme.name} ${language === 'de' ? 'wurde als globales Standard-Theme aktiviert' : 'has been set as the global default theme'}`,
                      type: 'success',
                    });
                  }
                }}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#161b22] border-indigo-500 ring-1 ring-indigo-500/50 shadow-md'
                    : 'bg-[#0d1017] border-[#2b3342] hover:border-[#484f58] hover:bg-[#161b22]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                      style={{ backgroundColor: theme.accent }}
                    />
                    <span className="text-xs font-bold text-white tracking-tight">{theme.name}</span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {theme.description}
                </p>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span className="px-1.5 py-0.5 rounded bg-white/5">{theme.badge}</span>
                  <span style={{ color: theme.accent }}>{theme.accent}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
