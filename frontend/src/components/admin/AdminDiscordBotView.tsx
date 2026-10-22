import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  Bot,
  Shield,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Terminal,
  Zap,
  Eye,
  EyeOff,
  Server,
  Save,
  Radio,
  ExternalLink,
  Sliders,
  Check,
  AlertTriangle,
  Info,
  Lock,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

interface RoleMapping {
  role_id: string;
  role_name: string;
  power_access: boolean;
  all_servers: boolean;
}

export const AdminDiscordBotView: React.FC = () => {
  const { addToast } = useApp();
  const { language } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fetchingRoles, setFetchingRoles] = useState(false);

  // Form states
  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [botToken, setBotToken] = useState('');
  const [guildId, setGuildId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [slashCommandsEnabled, setSlashCommandsEnabled] = useState(true);
  const [showToken, setShowToken] = useState(false);

  // Live status from backend
  const [botRunning, setBotRunning] = useState(false);
  const [botTag, setBotTag] = useState('');

  // Available Guild Roles & Mappings
  const [guildRoles, setGuildRoles] = useState<DiscordRole[]>([]);
  const [roleMappings, setRoleMappings] = useState<RoleMapping[]>([]);

  // Load config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/integrations/discord');
      const data = res.data;
      if (data) {
        setEnabled(Boolean(data.enabled));
        setClientId(data.client_id || '');
        setClientSecret(data.client_secret || '');
        setBotToken(data.bot_token || '');
        setGuildId(data.guild_id || '');
        setRedirectUri(data.redirect_uri || `${window.location.origin}/api/auth/discord/callback`);
        setSlashCommandsEnabled(data.slash_commands_enabled !== false);
        setBotRunning(Boolean(data.bot_running));
        setBotTag(data.bot_tag || '');

        if (data.role_mappings) {
          try {
            const parsed = JSON.parse(data.role_mappings);
            if (Array.isArray(parsed)) {
              setRoleMappings(parsed);
            }
          } catch {
            setRoleMappings([]);
          }
        }
      }
    } catch (err: any) {
      addToast({
        title: 'Fehler beim Laden',
        description: err.response?.data?.error || 'Konnte Discord-Einstellungen nicht abrufen.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (enabled && (!botToken.trim() || !clientId.trim() || !guildId.trim())) {
      addToast({
        title: 'Pflichtfelder fehlen',
        description: 'Um den Discord-Bot zu aktivieren, müssen Bot-Token, Client-ID und Guild-ID ausgefüllt sein.',
        type: 'warning',
      });
      return;
    }

    try {
      setSaving(true);
      await api.post('/admin/integrations/discord', {
        enabled,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        bot_token: botToken.trim(),
        guild_id: guildId.trim(),
        redirect_uri: redirectUri.trim(),
        slash_commands_enabled: slashCommandsEnabled,
        role_mappings: JSON.stringify(roleMappings),
      });

      addToast({
        title: 'Einstellungen gespeichert',
        description: 'Discord Bot-Konfiguration wurde erfolgreich aktualisiert.',
        type: 'success',
      });

      // Refresh status after reload
      setTimeout(fetchConfig, 1000);
    } catch (err: any) {
      addToast({
        title: 'Speichern fehlgeschlagen',
        description: err.response?.data?.error || 'Fehler beim Speichern der Discord-Konfiguration.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!botToken.trim()) {
      addToast({
        title: 'Token fehlt',
        description: 'Bitte gib zuerst ein Discord Bot-Token ein.',
        type: 'warning',
      });
      return;
    }

    try {
      setTesting(true);
      const res = await api.post('/admin/integrations/discord/test', {
        bot_token: botToken.trim(),
      });
      const data = res.data;
      if (data.success) {
        setBotTag(data.bot_user?.bot_tag || '');
        addToast({
          title: 'Verbindung erfolgreich',
          description: `Erfolgreich als @${data.bot_user?.bot_tag} angemeldet!`,
          type: 'success',
        });
      }
    } catch (err: any) {
      addToast({
        title: 'Verbindungstest fehlgeschlagen',
        description: err.response?.data?.error || 'Discord API hat das Token abgelehnt.',
        type: 'error',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleFetchRoles = async () => {
    if (!guildId.trim() || !botToken.trim()) {
      addToast({
        title: 'Daten unvollständig',
        description: 'Guild-ID und Bot-Token erforderlich, um Rollen abzufragen.',
        type: 'warning',
      });
      return;
    }

    try {
      setFetchingRoles(true);
      const res = await api.get('/admin/integrations/discord/roles');
      if (res.data?.roles) {
        setGuildRoles(res.data.roles);
        addToast({
          title: 'Rollen geladen',
          description: `${res.data.roles.length} Rollen vom Discord-Server abgerufen.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      addToast({
        title: 'Rollen-Abruf fehlgeschlagen',
        description: err.response?.data?.error || 'Konnte Guild-Rollen nicht abfragen.',
        type: 'error',
      });
    } finally {
      setFetchingRoles(false);
    }
  };

  const handleSyncCommands = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/admin/integrations/discord/sync-commands');
      addToast({
        title: 'Slash-Commands synchronisiert',
        description: res.data?.message || 'Befehle wurden auf Discord registriert!',
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Synchronisation fehlgeschlagen',
        description: err.response?.data?.error || 'Konnte Slash-Commands nicht registrieren.',
        type: 'error',
      });
    } finally {
      setSyncing(false);
    }
  };

  const toggleRolePower = (roleId: string, roleName: string) => {
    setRoleMappings((prev) => {
      const existing = prev.find((m) => m.role_id === roleId);
      if (existing) {
        return prev.map((m) =>
          m.role_id === roleId ? { ...m, power_access: !m.power_access } : m
        );
      }
      return [...prev, { role_id: roleId, role_name: roleName, power_access: true, all_servers: false }];
    });
  };

  const toggleRoleScope = (roleId: string, roleName: string) => {
    setRoleMappings((prev) => {
      const existing = prev.find((m) => m.role_id === roleId);
      if (existing) {
        return prev.map((m) =>
          m.role_id === roleId ? { ...m, all_servers: !m.all_servers } : m
        );
      }
      return [...prev, { role_id: roleId, role_name: roleName, power_access: true, all_servers: true }];
    });
  };

  const removeRoleMapping = (roleId: string) => {
    setRoleMappings((prev) => prev.filter((m) => m.role_id !== roleId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <span className="text-xs font-mono text-slate-400">Lade Discord-Konfiguration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-smooth-in max-w-6xl mx-auto pb-12">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & STATUS BANNER
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight">Discord Bot &amp; Slash-Commands</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border flex items-center gap-1.5 ${
                enabled && botRunning
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : enabled
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${enabled && botRunning ? 'bg-emerald-400 animate-pulse' : enabled ? 'bg-amber-400' : 'bg-slate-500'}`} />
                <span>{enabled && botRunning ? (botTag ? `@${botTag} (Online)` : 'Bot Online') : enabled ? 'Aktiviert (Verbinde...)' : 'Deaktiviert'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Verknüpfe deinen Discord-Server direkt mit PteroNext. Führe Power-Befehle (/server start, stop) per Slash-Command aus und weise administrative Discord-Rollen zu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !botToken}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-indigo-400" />}
            <span>Verbindung testen</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-indigo-600/25 active:scale-95 flex items-center gap-2 border border-indigo-400/30 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Speichern</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MASTER ACTIVATION TOGGLE CARD
      ───────────────────────────────────────────────────────────── */}
      <div className={`p-5 rounded-2xl border transition-all ${
        enabled
          ? 'border-indigo-500/40 bg-indigo-950/20'
          : 'border-slate-800 bg-[#161b22]/70'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Discord-Bot-Infrastruktur aktivieren</span>
            </div>
            <p className="text-xs text-slate-400">
              Bei Aktivierung hält PteroNext eine langlebige WebSocket-Verbindung zu Discord aufrecht und verarbeitet Slash-Commands in Echtzeit.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. DISCORD CREDENTIALS & CREDENTIALS VAULT
      ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>Bot-Zugangsdaten (Discord Developer Portal)</span>
          </div>
          <a
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
          >
            <span>Developer Portal öffnen</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Bot Token */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Discord Bot-Token <span className="text-rose-400">*</span></span>
              </span>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showToken ? 'Maskieren' : 'Anzeigen'}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="MTEzNDU2Nzg5... (Bot Token aus Developer Portal)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Wird zur Authentifizierung am Gateway und für REST-Aufrufe genutzt. Wird niemals im Klartext nach außen gegeben.
            </p>
          </div>

          {/* Client ID */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Application / Client-ID <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="134567890123456789"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Guild ID */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Discord Guild-ID (Server-ID) <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="987654321098765432"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Client Secret (OAuth2) */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Client-Secret (OAuth2 Web-Login)</span>
            </label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="OAuth2 Secret (Optional für Website-Login)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Redirect URI */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>OAuth2 Redirect-URI</span>
            </label>
            <input
              type="text"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder="https://panel.../api/auth/discord/callback"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. SLASH COMMANDS & SYNCHRONISATION
      ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Slash-Commands &amp; Befehls-Registrierung</span>
          </div>

          <button
            type="button"
            onClick={handleSyncCommands}
            disabled={syncing || !botToken || !clientId || !guildId}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 border border-emerald-400/30 disabled:opacity-50"
          >
            {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Befehle auf Discord registrieren</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-emerald-400 font-bold">/server list</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Listet alle Server auf, auf die der verknüpfte Discord-Nutzer Zugriff hat (oder alle für Admins).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-sky-400 font-bold">/server status &lt;name&gt;</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Ruft den Live-Zustand, RAM, CPU-Auslastung und die Node ab.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-emerald-400 font-bold">/server start &lt;name&gt;</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Startet die Instanz über den Wings Daemon (Prüft Benutzerrechte).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-rose-400 font-bold">/server stop &lt;name&gt;</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Fährt den Server sicher herunter.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-amber-400 font-bold">/server restart &lt;name&gt;</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Startet die Instanz neu (z. B. nach Crash oder Config-Änderung).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-purple-400 font-bold">/link &lt;code&gt;</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Ermöglicht Benutzern, ihren Account direkt in Discord per 6-stelligem Code zu verbinden.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-rose-400 font-bold">/purge &lt;amount&gt; [user]</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Bulk-Löschung von 1–100 Nachrichten (erfordert 'Nachrichten verwalten' Berechtigung).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-pink-400 font-bold">/giveaway start</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Startet Gewinnspiel mit Countdown-Embed, Teilnahme-Button und automatischer Auslosung.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-cyan-400 font-bold">/poll (oder /umfrage)</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Interaktive Abstimmung mit Klick-Buttons und Live-Stimmenanzeige in Echtzeit.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-indigo-400 font-bold">/userinfo &amp; /serverinfo</div>
            <p className="text-[11px] text-slate-400 font-sans">
              Ausführliche Karten zu Profilen, Rollen, Account-Alter und Server-Statistiken.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/90 space-y-1">
            <div className="text-yellow-400 font-bold">/rank &amp; /leaderboard</div>
            <p className="text-[11px] text-slate-400 font-sans">
              XP-Karten &amp; Top 10 Ranglisten mit automatischer Rollenerstellung bei Level-Aufstieg.
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4.1 LEVEL-SYSTEM & AUTOMATISCHE ROLLEN-ERSTELLUNG
      ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Level-System &amp; Automatische Rollenerstellung</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Chat-Nachrichten gewähren 15–25 XP (60s Cooldown). Erreicht ein Mitglied einen Meilenstein, wird die Rolle automatisch auf Discord angelegt &amp; zugewiesen.
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Aktiv (Gateway Intent 513)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-amber-900/40 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">Level 5</span>
              <span className="text-[10px] text-slate-500">1.500 XP</span>
            </div>
            <div className="text-slate-300 font-semibold">Bronze Rang</div>
            <div className="text-[11px] text-emerald-400/80">Auto-Provision: Ja</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-700/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">Level 10</span>
              <span className="text-[10px] text-slate-500">5.500 XP</span>
            </div>
            <div className="text-slate-300 font-semibold">Silber Rang</div>
            <div className="text-[11px] text-emerald-400/80">Auto-Provision: Ja</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-yellow-800/50 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-yellow-400">Level 20</span>
              <span className="text-[10px] text-slate-500">21.000 XP</span>
            </div>
            <div className="text-slate-300 font-semibold">Gold Rang</div>
            <div className="text-[11px] text-emerald-400/80">Auto-Provision: Ja</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-cyan-800/50 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400">Level 30</span>
              <span className="text-[10px] text-slate-500">46.500 XP</span>
            </div>
            <div className="text-slate-300 font-semibold">Platin Rang</div>
            <div className="text-[11px] text-emerald-400/80">Auto-Provision: Ja</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-indigo-800/50 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-400">Level 50</span>
              <span className="text-[10px] text-slate-500">127.500 XP</span>
            </div>
            <div className="text-slate-300 font-semibold">Diamant Elite</div>
            <div className="text-[11px] text-emerald-400/80">Auto-Provision: Ja</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-800/30 text-[11px] text-indigo-300 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-indigo-400" />
          <span>
            Fehlt eine Meilenstein-Rolle auf deinem Discord-Server, generiert der Bot die Rolle über die Discord-REST-API mit farblicher Abstufung automatisch, speichert sie in der Datenbank und weist sie dem Mitglied direkt zu.
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. ROLE MAPPING & PERMISSION MATRIX
      ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Discord-Rollen &amp; Berechtigungs-Mapping</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Weise Discord-Rollen Berechtigungen für Slash-Commands zu (z. B. Admins dürfen alle Server steuern, Moderatoren nur eigene).
            </p>
          </div>

          <button
            type="button"
            onClick={handleFetchRoles}
            disabled={fetchingRoles || !botToken || !guildId}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition-all active:scale-95 flex items-center gap-2 border border-slate-700 disabled:opacity-50"
          >
            {fetchingRoles ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />}
            <span>Rollen vom Discord-Server abrufen</span>
          </button>
        </div>

        {/* Available Roles from Guild */}
        {guildRoles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 font-mono">
              Verfügbare Rollen auf Discord (Klicken zum Hinzufügen / Umschalten):
            </div>
            <div className="flex flex-wrap gap-2">
              {guildRoles.map((role) => {
                const isMapped = roleMappings.some((m) => m.role_id === role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRolePower(role.id, role.name)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all flex items-center gap-2 ${
                      isMapped
                        ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200 font-bold'
                        : 'border-slate-800 bg-[#0d1117] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#818cf8' }}
                    />
                    <span>{role.name}</span>
                    {isMapped ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="text-slate-500">+</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Configured Role Mappings Table */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-300 font-mono">
            Aktive Rollen-Berechtigungen:
          </div>

          {roleMappings.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 font-mono">
              Noch keine Rollen-Zuordnungen konfiguriert. Rufe oben die Rollen deines Discord-Servers ab, um Berechtigungen festzulegen.
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar rounded-xl border border-slate-800 bg-[#0d1117]">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider bg-slate-900/40">
                    <th className="py-3 px-4">Discord-Rolle</th>
                    <th className="py-3 px-4 text-center">Power-Befehle (Start / Stop)</th>
                    <th className="py-3 px-4 text-center">Server-Umfang</th>
                    <th className="py-3 px-4 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {roleMappings.map((m) => (
                    <tr key={m.role_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        <span className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{m.role_name}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRolePower(m.role_id, m.role_name)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            m.power_access
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                              : 'border-slate-800 bg-slate-900 text-slate-500'
                          }`}
                        >
                          {m.power_access ? 'Erlaubt' : 'Gesperrt'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRoleScope(m.role_id, m.role_name)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            m.all_servers
                              ? 'border-purple-500/30 bg-purple-500/15 text-purple-300'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          {m.all_servers ? 'Alle Server (Admin)' : 'Nur zugewiesene Server'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeRoleMapping(m.role_id)}
                          className="text-slate-500 hover:text-rose-400 text-xs transition-colors p-1"
                          title="Entfernen"
                        >
                          Entfernen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
