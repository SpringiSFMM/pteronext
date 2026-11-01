import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Modal } from '../common/Modal';
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
  MessageSquare,
  Hash,
  Layers,
  History,
  Settings,
  Search,
  FileText,
  Bell,
  Sparkles,
  Trophy,
  Users,
  Plus,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0=text, 2=voice, 4=category, 5=announcement
  parentId?: string | null;
  position: number;
}

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
  isMainGuild: boolean;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  config: GuildConfig;
}

interface GuildConfig {
  guild_id?: string;
  guild_name?: string;
  leveling_enabled: boolean;
  tickets_enabled: boolean;
  moderation_enabled: boolean;
  suggestions_enabled: boolean;
  giveaways_enabled: boolean;
  ticket_transcripts_enabled: boolean;
  ticket_claim_enabled: boolean;
  level_roles_enabled: boolean;
  level_pings_enabled: boolean;
  welcome_dm_enabled: boolean;
  automod_links_enabled: boolean;
  automod_spam_enabled: boolean;
  ai_assistant_enabled: boolean;
  starboard_enabled: boolean;
  welcome_channel_id?: string | null;
  leave_channel_id?: string | null;
  log_channel_id?: string | null;
  ticket_category_id?: string | null;
  ticket_transcript_channel_id?: string | null;
  ticket_support_role_id?: string | null;
  level_up_channel_id?: string | null;
  suggestion_channel_id?: string | null;
  starboard_channel_id?: string | null;
  alerts_channel_id?: string | null;
  welcome_message?: string | null;
  leave_message?: string | null;
  ticket_welcome_message?: string | null;
  level_up_message?: string | null;
  disabled_commands?: string[];
  updated_by?: string | null;
  updated_at?: string;
}

interface BotCommand {
  name: string;
  description: string;
  category: string;
  mainGuildOnly: boolean;
  optionsCount: number;
}

interface AuditLogEntry {
  id: number;
  event: string;
  properties: string;
  ip: string;
  timestamp: string;
  actor_id?: number;
}

export const AdminDiscordBotView: React.FC = () => {
  const { addToast, currentUser, setIsAccountSettingsOpen } = useApp();
  const { language } = useTranslation();
  const isDe = language === 'de';

  const isDiscordLinked = Boolean(currentUser?.discordId || (currentUser as any)?.discord_id);
  const linkedDiscordUsername = currentUser?.discordUsername || (currentUser as any)?.discord_username || currentUser?.discordId || (currentUser as any)?.discord_id;

  const isRootAdmin = Boolean(currentUser?.rootAdmin || currentUser?.role === 'root_admin');
  const allowedGuildScope = currentUser?.betaDiscordScope || (currentUser as any)?.beta_discord_scope || [];
  const isRestrictedScope = !isRootAdmin && allowedGuildScope.length > 0 && !allowedGuildScope.includes('*');

  const t = {
    title: isDe ? 'PteroNext Discord Bot — Server-Steuerung' : 'PteroNext Discord Bot — Server Control',
    subtitle: isDe
      ? 'Verwalte alle PteroNext Bot-Funktionen in Echtzeit: Module, Befehle, automatische Nachrichten, Kanäle und detaillierte Audit-Logs.'
      : 'Manage all PteroNext Bot features in real time: modules, commands, automated messages, channels, and audit logs.',
    refresh: isDe ? 'Aktualisieren' : 'Refresh',
    save_changes: isDe ? 'Änderungen speichern & anwenden' : 'Save & Apply Changes',
    saving: isDe ? 'Speichere...' : 'Saving...',
    target_server: isDe ? 'Ziel-Server:' : 'Target Server:',
    none: isDe ? 'keine' : 'none',
    users: isDe ? 'User' : 'Users',
    tab_modules: isDe ? 'Module & Systeme' : 'Modules & Systems',
    tab_channels: isDe ? 'Kanäle & Rollen' : 'Channels & Roles',
    tab_messages: isDe ? 'Nachrichten & Vorlagen' : 'Messages & Templates',
    tab_commands: isDe ? 'Befehle steuern' : 'Command Manager',
    tab_commands_off: isDe ? 'aus' : 'off',
    tab_audit: isDe ? 'Admin Audit-Log' : 'Admin Audit Log',
    tab_credentials: isDe ? 'Bot Credentials' : 'Bot Credentials',

    // Modules
    mod_leveling_title: isDe ? 'Level- & XP-System' : 'Leveling & XP System',
    mod_leveling_desc: isDe
      ? 'Vergibt XP für aktive Nachrichten im Discord und schaltet konfigurierte Level-Rollen frei.'
      : 'Awards XP for active chat participation and unlocks configured level roles.',
    mod_level_roles: isDe ? 'Rollen-Belohnungen' : 'Role Rewards',
    mod_level_pings: isDe ? 'Level-Up Pings' : 'Level-Up Pings',

    mod_tickets_title: isDe ? 'Support- & Ticket-System' : 'Support & Ticket System',
    mod_tickets_desc: isDe
      ? 'Erlaubt Usern das Öffnen von Support-Tickets via Buttons & Modals mit Kategorien und Staff-Routing.'
      : 'Allows users to create support tickets via buttons & modals with categories and staff routing.',
    mod_ticket_transcripts: isDe ? 'Transkripte speichern' : 'Save Transcripts',
    mod_ticket_claims: isDe ? 'Claiming-Button' : 'Claiming Button',

    mod_automod_title: isDe ? 'Auto-Mod & Sicherheits-Schutz' : 'Auto-Mod & Security Protection',
    mod_automod_desc: isDe
      ? 'Blockiert Einladungslinks, verdächtige Domains, Mass-Mentions und schützt den Chat vor Spam.'
      : 'Blocks invite links, suspicious domains, mass mentions, and protects chat from spam.',
    mod_automod_links: isDe ? 'Links blockieren' : 'Block Links',
    mod_automod_spam: isDe ? 'Anti-Spam Filter' : 'Anti-Spam Filter',

    mod_moderation_title: isDe ? 'Moderations-Suite (/warn, /ban)' : 'Moderation Suite (/warn, /ban)',
    mod_moderation_desc: isDe
      ? 'Aktiviert Moderationsbefehle wie /warn, /mute, /kick, /ban und Fallprotokolle im Log-Kanal.'
      : 'Enables moderation commands like /warn, /mute, /kick, /ban, and incident logging.',

    mod_suggestions_title: isDe ? 'Vorschlags-System (/suggest)' : 'Suggestions System (/suggest)',
    mod_suggestions_desc: isDe
      ? 'Ermöglicht Community-Vorschläge mit automatischen Upvote/Downvote Buttons.'
      : 'Enables community suggestions with automated upvote/downvote buttons.',

    mod_giveaways_title: isDe ? 'Giveaways (/giveaway)' : 'Giveaways (/giveaway)',
    mod_giveaways_desc: isDe
      ? 'Automatisierte Verlosungen mit Countdown-Timer und zufälliger Gewinnerziehung.'
      : 'Automated giveaways with countdown timer and random winner selection.',

    mod_starboard_title: isDe ? 'Starboard Highlights' : 'Starboard Highlights',
    mod_starboard_desc: isDe
      ? 'Postet Nachrichten mit genügend ⭐-Reaktionen automatisch in den Starboard-Kanal.'
      : 'Pins messages with enough ⭐ reactions to the dedicated starboard channel.',

    mod_welcome_dm_title: isDe ? 'Willkommens-Direktnachrichten (DM)' : 'Welcome Direct Messages (DM)',
    mod_welcome_dm_desc: isDe
      ? 'Sendet neuen Mitgliedern beim Beitreten automatisch eine Begrüßungs-DM mit Server-Informationen.'
      : 'Sends new members an automated direct message greeting upon joining the server.',

    mod_ai_title: isDe ? 'KI Support-Assistent' : 'AI Support Assistant',
    mod_ai_desc: isDe
      ? 'Beantwortet Server- und Support-Fragen autonom basierend auf der PteroNext Dokumentation.'
      : 'Autonomously answers server and support inquiries based on PteroNext documentation.',

    // Channels
    channels_title: isDe ? 'Kanal- & Rollen-Zuweisung für' : 'Channel & Role Mappings for',
    channels_remove: isDe ? 'Entfernen' : 'Remove',
    channel_not_set: isDe ? '-- Nicht festgelegt (Deaktiviert) --' : '-- Not assigned (Disabled) --',
    channel_not_assigned: isDe ? '-- Nicht festgelegt --' : '-- Not assigned --',
    channel_auto_cat: isDe ? '-- Automatisch / Keine Kategorie --' : '-- Automatic / No Category --',
    role_none: isDe ? '-- Keine spezifische Rolle (Server Admins) --' : '-- No specific role (Server Admins) --',
    level_current_chat: isDe ? '-- Im aktuellen Chat-Kanal des Nutzers --' : '-- In user current chat channel --',

    lbl_welcome_channel: isDe ? '👋 Willkommens-Kanal (Welcome)' : '👋 Welcome Channel',
    lbl_leave_channel: isDe ? '🚪 Verlassens-Kanal (Goodbye)' : '🚪 Goodbye Channel',
    lbl_log_channel: isDe ? '📜 Mod-Logs & Sicherheits-Protokolle' : '📜 Mod Logs & Security Audit',
    lbl_ticket_cat: isDe ? '📂 Ticket-Kategorie (Parent Category)' : '📂 Ticket Category (Folder)',
    lbl_ticket_transcripts: isDe ? '📑 Ticket-Transkripte Archiv-Kanal' : '📑 Ticket Transcripts Archive Channel',
    lbl_ticket_staff: isDe ? '🛡️ Support-Team Discord-Rolle' : '🛡️ Support Staff Discord Role',
    lbl_level_channel: isDe ? '🏆 Level-Up Ankündigungs-Kanal' : '🏆 Level-Up Announcement Channel',
    lbl_suggestions_channel: isDe ? '💡 Vorschläge (Suggestions) Kanal' : '💡 Suggestions Channel',
    lbl_alerts_channel: isDe ? '🚨 Server-Alerts & Crash-Benachrichtigungen' : '🚨 Server Alerts & Crash Notifications',
    lbl_starboard_channel: isDe ? '⭐ Starboard Highlight-Kanal' : '⭐ Starboard Highlight Channel',
    lbl_rules_channel: isDe ? '📋 Regelwerk & Info Kanal' : '📋 Rules & Info Channel',
    lbl_general_role: isDe ? '👥 Allgemeine Mitglieder-Rolle' : '👥 General Member Role',
    lbl_admin_role: isDe ? '👑 Bot-Admin-Rolle (Volle Berechtigungen)' : '👑 Bot Admin Role (Full Access)',
    lbl_muted_role: isDe ? '🔇 Muted / Stumm-Rolle (Timeout)' : '🔇 Muted / Timeout Role',

    // Messages
    msg_variables: isDe ? 'Variablen:' : 'Variables:',
    msg_welcome_title: isDe ? 'Willkommens-Nachricht (Welcome Message)' : 'Public Welcome Message',
    msg_welcome_hint: isDe
      ? 'Wird im Willkommens-Kanal gesendet, sobald ein neues Mitglied dem Server beitritt. Bleibt leer für Standard-Text.'
      : 'Dispatched to the welcome channel whenever a new member joins. Leave empty for default text.',
    msg_leave_title: isDe ? 'Verlassens-Nachricht (Leave Message)' : 'Leave Message (Goodbye)',
    msg_ticket_title: isDe ? 'Ticket Eröffnungs-Nachricht' : 'Ticket Opening Greeting Message',
    msg_levelup_title: isDe ? 'Level-Up Nachricht' : 'Level-Up Congratulations Message',
    msg_dm_title: isDe ? 'Private Willkommens-DM' : 'Private Welcome Direct Message (DM)',

    // Commands
    cmd_title: isDe ? 'Befehle steuern & deaktivieren' : 'Command Control & Overrides',
    cmd_registered: isDe ? 'registriert' : 'registered',
    cmd_subtitle: isDe
      ? 'Schalte einzelne Slash-Commands für den gewählten Server ein oder aus.'
      : 'Toggle individual slash commands on or off for the selected server in real time.',
    cmd_search_ph: isDe ? 'Befehl suchen...' : 'Search command...',
    cmd_no_desc: isDe ? 'Keine Beschreibung vorhanden.' : 'No description available.',
    cmd_active: isDe ? 'Aktiv' : 'Active',
    cmd_disabled: isDe ? 'Deaktiviert' : 'Disabled',

    // Audit
    audit_title: isDe ? 'Detailliertes Admin Audit-Log (Discord Bot Aktionen)' : 'Detailed Admin Audit Log (Discord Bot Actions)',
    audit_refresh: isDe ? 'Aktualisieren' : 'Refresh',
    audit_empty: isDe
      ? 'Bisher keine dokumentierten Discord-Bot-Konfigurationsänderungen im Audit-Log.'
      : 'No documented Discord bot configuration changes found in audit log yet.',
    audit_changes_count: isDe ? 'Protokollierte Änderungen' : 'Logged Changes',

    // Credentials
    creds_title: isDe ? 'Bot-Zugangsdaten (Discord Developer Portal)' : 'Bot Credentials (Discord Developer Portal)',
    creds_dev_portal: isDe ? 'Developer Portal öffnen' : 'Open Developer Portal',
    creds_token_lbl: isDe ? 'Discord Bot-Token' : 'Discord Bot Token',
    creds_mask: isDe ? 'Maskieren' : 'Mask',
    creds_show: isDe ? 'Anzeigen' : 'Show',
    creds_client_id: isDe ? 'Application / Client-ID' : 'Application / Client ID',
    creds_guild_id: isDe ? 'Discord Guild-ID (Haupt-Server)' : 'Discord Guild ID (Primary Server)',
    creds_secret: isDe ? 'Client-Secret (OAuth2 Web-Login)' : 'Client Secret (OAuth2 Web Login)',
    creds_redirect: isDe ? 'Redirect URI' : 'Redirect URI',
    creds_sync_btn: isDe ? 'Slash-Commands auf Discord registrieren' : 'Register Slash Commands with Discord',
    creds_save_btn: isDe ? 'Zugangsdaten speichern' : 'Save Credentials',
  };

  const [loading, setLoading] = useState(true);
  const [savingGuild, setSavingGuild] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'modules' | 'channels' | 'messages' | 'commands' | 'audit' | 'credentials'>('modules');

  // Integration credentials state
  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [botToken, setBotToken] = useState('');
  const [guildId, setGuildId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [slashCommandsEnabled, setSlashCommandsEnabled] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [botTag, setBotTag] = useState('');

  // Multi-Guild Data & Deep Config
  const [guilds, setGuilds] = useState<GuildInfo[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');

  const visibleGuilds = useMemo(() => {
    if (!isRestrictedScope) return guilds;
    return guilds.filter((g) => allowedGuildScope.includes(g.id));
  }, [guilds, isRestrictedScope, allowedGuildScope]);
  const [guildConfig, setGuildConfig] = useState<GuildConfig>({
    leveling_enabled: true,
    tickets_enabled: true,
    moderation_enabled: true,
    suggestions_enabled: true,
    giveaways_enabled: true,
    ticket_transcripts_enabled: true,
    ticket_claim_enabled: true,
    level_roles_enabled: true,
    level_pings_enabled: true,
    welcome_dm_enabled: true,
    automod_links_enabled: true,
    automod_spam_enabled: true,
    ai_assistant_enabled: true,
    starboard_enabled: true,
    disabled_commands: [],
  });

  // Commands & Audit Data
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [commandSearch, setCommandSearch] = useState('');
  const [commandCategory, setCommandCategory] = useState<string>('all');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Claim Server Modal State
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimGuildId, setClaimGuildId] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimInviteUrl, setClaimInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCredentials(),
      fetchStatus(),
      fetchGuilds(),
      fetchCommands(),
      fetchAuditLogs(),
    ]);
    setLoading(false);
  };

  const fetchStatus = async () => {
    try {
      const res = await api.get('/admin/integrations/discord/status');
      if (res.data?.bot_running !== undefined) {
        setBotRunning(Boolean(res.data.bot_running));
      }
      if (res.data?.bot_tag) {
        setBotTag(res.data.bot_tag);
      }
    } catch (_) {}
  };

  const fetchCredentials = async () => {
    try {
      const res = await api.get('/admin/integrations/discord');
      if (res.data?.success && res.data.config) {
        const c = res.data.config;
        setEnabled(!!c.enabled);
        setClientId(c.client_id || '');
        setClientSecret(c.client_secret || '');
        setBotToken(c.bot_token || '');
        setGuildId(c.guild_id || '');
        setRedirectUri(c.redirect_uri || '');
        setSlashCommandsEnabled(c.slash_commands_enabled !== false);
        setBotRunning(!!res.data.bot_running);
        setBotTag(res.data.bot_user?.bot_tag || '');
      }
    } catch (err: any) {
      console.warn('Could not load discord credentials:', err.message);
    }
  };

  const fetchGuilds = async () => {
    try {
      const res = await api.get('/admin/integrations/discord/guilds');
      if (res.data?.success && Array.isArray(res.data.guilds)) {
        const rawGuilds: GuildInfo[] = res.data.guilds;
        setGuilds(rawGuilds);
        if (res.data.bot_running !== undefined) {
          setBotRunning(Boolean(res.data.bot_running));
        } else if (rawGuilds.length > 0) {
          setBotRunning(true);
        }
        if (res.data.bot_tag) {
          setBotTag(res.data.bot_tag);
        }
        const filtered = isRestrictedScope
          ? rawGuilds.filter((g) => allowedGuildScope.includes(g.id))
          : rawGuilds;
        if (filtered.length > 0) {
          const target = filtered.find((g: GuildInfo) => g.id === selectedGuildId) || (filtered.find((g: GuildInfo) => g.isMainGuild) || filtered[0]);
          setSelectedGuildId(target.id);
          if (target.config) {
            setGuildConfig({
              ...target.config,
              disabled_commands: Array.isArray(target.config.disabled_commands) ? target.config.disabled_commands : [],
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('Could not load guilds:', err.message);
    }
  };

  const handleClaimGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = claimGuildId.trim();
    if (!cleanId) return;

    setIsClaiming(true);
    setClaimError(null);
    setClaimInviteUrl(null);

    try {
      const res = await api.post('/admin/integrations/discord/guilds/claim', { guild_id: cleanId });
      if (res.data?.success) {
        addToast({
          title: isDe ? 'Discord-Server freigeschaltet!' : 'Discord Server Claimed!',
          description: isDe
            ? res.data.message || `Server '${res.data.guild?.name || cleanId}' wurde erfolgreich freigeschaltet.`
            : res.data.message_en || `Server '${res.data.guild?.name || cleanId}' claimed successfully.`,
          type: 'success',
        });
        setIsClaimModalOpen(false);
        setClaimGuildId('');
        await fetchGuilds();
        setSelectedGuildId(cleanId);
      } else {
        setClaimError(
          isDe
            ? res.data?.error || 'Verifikation fehlgeschlagen'
            : res.data?.error_en || res.data?.error || 'Verification failed'
        );
        if (res.data?.invite_url) setClaimInviteUrl(res.data.invite_url);
      }
    } catch (err: any) {
      const errData = err.response?.data;
      const msg = isDe
        ? errData?.error || err.message || 'Fehler beim Verifizieren des Discord-Servers.'
        : errData?.error_en || errData?.error || err.message || 'Failed to verify Discord server.';
      setClaimError(msg);
      if (errData?.invite_url) setClaimInviteUrl(errData.invite_url);
    } finally {
      setIsClaiming(false);
    }
  };

  const fetchCommands = async () => {
    try {
      const res = await api.get('/admin/integrations/discord/commands');
      if (res.data?.success && Array.isArray(res.data.commands)) {
        setCommands(res.data.commands);
      }
    } catch (err: any) {
      console.warn('Could not load commands:', err.message);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/admin/integrations/discord/audit-logs');
      if (res.data?.success && Array.isArray(res.data.logs)) {
        setAuditLogs(res.data.logs);
      }
    } catch (err: any) {
      console.warn('Could not load audit logs:', err.message);
    }
  };

  const handleGuildSelect = (gid: string) => {
    if (isRestrictedScope && !allowedGuildScope.includes(gid)) {
      return;
    }
    setSelectedGuildId(gid);
    const target = guilds.find((g) => g.id === gid);
    if (target && target.config) {
      setGuildConfig({
        ...target.config,
        disabled_commands: Array.isArray(target.config.disabled_commands) ? target.config.disabled_commands : [],
      });
    }
  };

  const handleModuleToggle = (key: keyof GuildConfig) => {
    setGuildConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleChannelSelect = (key: keyof GuildConfig, value: string) => {
    setGuildConfig((prev) => ({
      ...prev,
      [key]: value === '' ? null : value,
    }));
  };

  const handleMessageChange = (key: keyof GuildConfig, value: string) => {
    setGuildConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const insertPlaceholder = (key: keyof GuildConfig, placeholder: string) => {
    const current = (guildConfig[key] as string) || '';
    setGuildConfig((prev) => ({
      ...prev,
      [key]: current + ' ' + placeholder,
    }));
  };

  const handleToggleCommand = (cmdName: string) => {
    setGuildConfig((prev) => {
      const currentList = Array.isArray(prev.disabled_commands) ? [...prev.disabled_commands] : [];
      const index = currentList.indexOf(cmdName);
      if (index >= 0) {
        currentList.splice(index, 1);
      } else {
        currentList.push(cmdName);
      }
      return {
        ...prev,
        disabled_commands: currentList,
      };
    });
  };

  const handleSaveGuildConfig = async () => {
    if (!selectedGuildId) {
      addToast({
        title: isDe ? 'Kein Server gewählt' : 'No Server Selected',
        description: isDe
          ? 'Bitte wähle einen Discord-Server aus, um die Einstellungen zu speichern.'
          : 'Please select a Discord server to save configuration.',
        type: 'warning',
      });
      return;
    }

    try {
      setSavingGuild(true);
      const res = await api.post(`/admin/integrations/discord/guilds/${selectedGuildId}/config`, guildConfig);
      if (res.data?.success) {
        const changesCount = Array.isArray(res.data.changes) ? res.data.changes.length : 0;
        addToast({
          title: isDe ? 'Erfolgreich gespeichert & live angewendet!' : 'Saved & Applied Live!',
          description: isDe
            ? `${changesCount} Änderung(en) in der Datenbank gespeichert und sofort im Bot synchronisiert.`
            : `${changesCount} change(s) saved to database and synchronized live to the bot.`,
          type: 'success',
        });
        setGuilds((prev) =>
          prev.map((g) => (g.id === selectedGuildId ? { ...g, config: res.data.config } : g))
        );
        fetchAuditLogs();
      }
    } catch (err: any) {
      addToast({
        title: isDe ? 'Speichern fehlgeschlagen' : 'Save Failed',
        description: err.response?.data?.error || (isDe ? 'Konnte Guild-Konfiguration nicht speichern.' : 'Could not save guild configuration.'),
        type: 'error',
      });
    } finally {
      setSavingGuild(false);
    }
  };

  const handleSaveCredentials = async () => {
    try {
      setSavingCreds(true);
      await api.post('/admin/integrations/discord', {
        enabled,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        bot_token: botToken.trim(),
        guild_id: guildId.trim(),
        redirect_uri: redirectUri.trim(),
        slash_commands_enabled: slashCommandsEnabled,
      });

      addToast({
        title: isDe ? 'Zugangsdaten gespeichert' : 'Credentials Saved',
        description: isDe
          ? 'Discord Bot-Token und Credentials erfolgreich aktualisiert.'
          : 'Discord Bot token and credentials updated successfully.',
        type: 'success',
      });
      setTimeout(fetchCredentials, 1000);
    } catch (err: any) {
      addToast({
        title: isDe ? 'Speichern fehlgeschlagen' : 'Save Failed',
        description: err.response?.data?.error || (isDe ? 'Fehler beim Speichern der Zugangsdaten.' : 'Failed saving credentials.'),
        type: 'error',
      });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleTestConnection = async () => {
    if (!botToken.trim()) {
      addToast({
        title: isDe ? 'Token fehlt' : 'Token Missing',
        description: isDe
          ? 'Bitte trage zuerst ein gültiges Bot-Token ein.'
          : 'Please enter a valid bot token first.',
        type: 'warning',
      });
      return;
    }

    try {
      setTesting(true);
      const res = await api.post('/admin/integrations/discord/test', {
        bot_token: botToken.trim(),
      });
      if (res.data?.success) {
        setBotTag(res.data.bot_user?.bot_tag || '');
        addToast({
          title: isDe ? 'Verbindung erfolgreich' : 'Connection Successful',
          description: isDe
            ? `Erfolgreich mit Discord als @${res.data.bot_user?.bot_tag} verbunden!`
            : `Successfully connected to Discord as @${res.data.bot_user?.bot_tag}!`,
          type: 'success',
        });
      }
    } catch (err: any) {
      addToast({
        title: isDe ? 'Verbindung fehlgeschlagen' : 'Connection Failed',
        description: err.response?.data?.error || (isDe ? 'Discord hat das Bot-Token abgelehnt.' : 'Discord rejected the bot token.'),
        type: 'error',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncCommands = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/admin/integrations/discord/sync-commands');
      addToast({
        title: isDe ? 'Slash-Commands synchronisiert' : 'Slash Commands Synced',
        description: res.data?.message || (isDe ? 'Slash-Commands wurden auf Discord registriert.' : 'Slash commands registered with Discord.'),
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: isDe ? 'Synchronisation fehlgeschlagen' : 'Sync Failed',
        description: err.response?.data?.error || (isDe ? 'Konnte Slash-Commands nicht registrieren.' : 'Failed registering slash commands.'),
        type: 'error',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Helper getters
  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);
  const textChannels = selectedGuild?.channels.filter((c) => c.type === 0 || c.type === 5) || [];
  const categoryChannels = selectedGuild?.channels.filter((c) => c.type === 4) || [];
  const guildRoles = selectedGuild?.roles.filter((r) => r.name !== '@everyone') || [];

  const disabledCmdList = Array.isArray(guildConfig.disabled_commands) ? guildConfig.disabled_commands : [];
  const filteredCommands = commands.filter((cmd) => {
    const matchesSearch = cmd.name.toLowerCase().includes(commandSearch.toLowerCase()) ||
      cmd.description.toLowerCase().includes(commandSearch.toLowerCase());
    const matchesCategory = commandCategory === 'all' || cmd.category.toLowerCase() === commandCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm font-mono text-slate-400">
            {isDe ? 'Lade Discord Bot-Konfiguration...' : 'Loading Discord Bot configuration...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 view-enter pb-12">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & GLOBAL ACTIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Bot className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white flex items-center gap-2.5 tracking-tight font-mono">
                <span>{t.title}</span>
              </h1>
              {botRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ONLINE {botTag ? `(@${botTag})` : ''}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>OFFLINE</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadAllData}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono font-medium transition-all active:scale-95 flex items-center gap-2"
            title={t.refresh}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.refresh}</span>
          </button>

          {activeTab !== 'credentials' && activeTab !== 'audit' && (
            <button
              type="button"
              onClick={handleSaveGuildConfig}
              disabled={savingGuild}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-cyan-600/25 active:scale-95 flex items-center gap-2 border border-cyan-400/30 disabled:opacity-50"
            >
              {savingGuild ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingGuild ? t.saving : t.save_changes}</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State Banner if user has no assigned guild yet */}
      {visibleGuilds.length === 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-cyan-500/10 border border-purple-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-purple-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-mono">
                {isDe ? 'Eigenen Discord-Server freischalten' : 'Unlock Your Discord Server'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {isDe
                  ? 'Trage deine Discord Server-ID ein, um deinen Server als Owner im Dashboard freizuschalten (Verknüpfter Discord-Account erforderlich).'
                  : 'Enter your Discord Guild ID to claim and manage your server as an owner (Discord account link required).'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setClaimError(null);
              setClaimInviteUrl(null);
              setIsClaimModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 shrink-0 active:scale-95 border border-purple-400/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isDe ? 'Server jetzt eintragen' : 'Claim Server Now'}</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. GUILD SELECTOR BAR (ACTIVE ON CONFIG TABS)
      ───────────────────────────────────────────────────────────── */}
      {activeTab !== 'credentials' && activeTab !== 'audit' && (
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-[#161b22]/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>{t.target_server}</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {visibleGuilds.length === 0 ? (
                <span className="text-xs font-mono text-amber-400 py-1">
                  {isDe ? 'Kein Discord-Server zugewiesen' : 'No Discord server assigned to your scope'}
                </span>
              ) : (
                visibleGuilds.map((g: any) => (
                  <button
                    key={g.id}
                    onClick={() => handleGuildSelect(g.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 border ${
                      selectedGuildId === g.id
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {g.icon ? (
                      <img src={g.icon} alt={g.name} className="w-4 h-4 rounded-full" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-white">
                        {g.name.slice(0, 1)}
                      </div>
                    )}
                    <span>{g.name}</span>
                    {g.isMainGuild && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                        HQ
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 font-mono">({g.memberCount} {t.users})</span>
                  </button>
                ))
              )}

              <button
                type="button"
                onClick={() => {
                  setClaimError(null);
                  setClaimInviteUrl(null);
                  setIsClaimModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-1.5 border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 active:scale-95 shadow-sm"
                title={isDe ? 'Eigenen Discord-Server freischalten (Owner-Claim)' : 'Claim your Discord Server (Owner Verification)'}
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>{isDe ? 'Server hinzufügen' : 'Add Server'}</span>
              </button>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono text-slate-500">
              ID: <span className="text-slate-300">{selectedGuildId || t.none}</span>
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. NAVIGATION TABS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'modules'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{t.tab_modules}</span>
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'channels'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Hash className="w-4 h-4" />
          <span>{t.tab_channels}</span>
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'messages'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{t.tab_messages}</span>
        </button>

        <button
          onClick={() => setActiveTab('commands')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'commands'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>{t.tab_commands}</span>
          {disabledCmdList.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30">
              {disabledCmdList.length} {t.tab_commands_off}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t.tab_audit}</span>
        </button>

        {isRootAdmin && (
          <button
            onClick={() => setActiveTab('credentials')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'credentials'
                ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>{t.tab_credentials}</span>
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MODULES & SYSTEMS (TOGGLES)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'modules' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Leveling Module */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>{t.mod_leveling_title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_leveling_desc}
                </p>
                <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guildConfig.level_roles_enabled}
                      onChange={() => handleModuleToggle('level_roles_enabled')}
                      className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>{t.mod_level_roles}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guildConfig.level_pings_enabled}
                      onChange={() => handleModuleToggle('level_pings_enabled')}
                      className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>{t.mod_level_pings}</span>
                  </label>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.leveling_enabled}
                  onChange={() => handleModuleToggle('leveling_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Support Ticket System */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>{t.mod_tickets_title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_tickets_desc}
                </p>
                <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guildConfig.ticket_transcripts_enabled}
                      onChange={() => handleModuleToggle('ticket_transcripts_enabled')}
                      className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>{t.mod_ticket_transcripts}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guildConfig.ticket_claim_enabled}
                      onChange={() => handleModuleToggle('ticket_claim_enabled')}
                      className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>{t.mod_ticket_claims}</span>
                  </label>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.tickets_enabled}
                  onChange={() => handleModuleToggle('tickets_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Auto-Mod & Security */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>{t.mod_automod_title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_automod_desc}
                </p>
                <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guildConfig.automod_links_enabled}
                      onChange={() => handleModuleToggle('automod_links_enabled')}
                      className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>{t.mod_automod_links}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guildConfig.automod_spam_enabled}
                      onChange={() => handleModuleToggle('automod_spam_enabled')}
                      className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>{t.mod_automod_spam}</span>
                  </label>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.automod_links_enabled || guildConfig.automod_spam_enabled}
                  onChange={() => {
                    const next = !(guildConfig.automod_links_enabled || guildConfig.automod_spam_enabled);
                    setGuildConfig((prev) => ({
                      ...prev,
                      automod_links_enabled: next,
                      automod_spam_enabled: next,
                    }));
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Moderation */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span>{t.mod_moderation_title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_moderation_desc}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.moderation_enabled}
                  onChange={() => handleModuleToggle('moderation_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Suggestions */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span>{t.mod_suggestions_title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_suggestions_desc}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.suggestions_enabled}
                  onChange={() => handleModuleToggle('suggestions_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Giveaways */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>{t.mod_giveaways_title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_giveaways_desc}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.giveaways_enabled}
                  onChange={() => handleModuleToggle('giveaways_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Starboard */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{t.mod_starboard_title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_starboard_desc}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.starboard_enabled !== false}
                  onChange={() => handleModuleToggle('starboard_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Welcome DMs */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>{t.mod_welcome_dm_title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_welcome_dm_desc}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.welcome_dm_enabled}
                  onChange={() => handleModuleToggle('welcome_dm_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* AI Assistant */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-[#161b22]/90 flex items-start justify-between gap-4 md:col-span-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span>{t.mod_ai_title}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    NEURAL
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.mod_ai_desc}
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={guildConfig.ai_assistant_enabled !== false}
                  onChange={() => handleModuleToggle('ai_assistant_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: CHANNELS & CATEGORIES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'channels' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Hash className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              {t.channels_title} {selectedGuild?.name || 'Server'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
            {/* Welcome Channel */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_welcome_channel}</span>
                {guildConfig.welcome_channel_id && (
                  <button
                    onClick={() => handleChannelSelect('welcome_channel_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.welcome_channel_id || ''}
                onChange={(e) => handleChannelSelect('welcome_channel_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.channel_not_set}</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Leave Channel */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_leave_channel}</span>
                {guildConfig.leave_channel_id && (
                  <button
                    onClick={() => handleChannelSelect('leave_channel_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.leave_channel_id || ''}
                onChange={(e) => handleChannelSelect('leave_channel_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.channel_not_set}</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Mod-Logs Channel */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_log_channel}</span>
                {guildConfig.log_channel_id && (
                  <button
                    onClick={() => handleChannelSelect('log_channel_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.log_channel_id || ''}
                onChange={(e) => handleChannelSelect('log_channel_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.channel_not_set}</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Ticket Category */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_ticket_cat}</span>
                {guildConfig.ticket_category_id && (
                  <button
                    onClick={() => handleChannelSelect('ticket_category_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.ticket_category_id || ''}
                onChange={(e) => handleChannelSelect('ticket_category_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.channel_auto_cat}</option>
                {categoryChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    📁 {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Ticket Transcripts Channel */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_ticket_transcripts}</span>
                {guildConfig.ticket_transcript_channel_id && (
                  <button
                    onClick={() => handleChannelSelect('ticket_transcript_channel_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.ticket_transcript_channel_id || ''}
                onChange={(e) => handleChannelSelect('ticket_transcript_channel_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.channel_not_assigned}</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Support Staff Role */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_ticket_staff}</span>
                {guildConfig.ticket_support_role_id && (
                  <button
                    onClick={() => handleChannelSelect('ticket_support_role_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.ticket_support_role_id || ''}
                onChange={(e) => handleChannelSelect('ticket_support_role_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.role_none}</option>
                {guildRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name} ({r.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Level-Up Channel */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_level_channel}</span>
                {guildConfig.level_up_channel_id && (
                  <button
                    onClick={() => handleChannelSelect('level_up_channel_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.level_up_channel_id || ''}
                onChange={(e) => handleChannelSelect('level_up_channel_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.level_current_chat}</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Suggestions Channel */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_suggestions_channel}</span>
                {guildConfig.suggestion_channel_id && (
                  <button
                    onClick={() => handleChannelSelect('suggestion_channel_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.suggestion_channel_id || ''}
                onChange={(e) => handleChannelSelect('suggestion_channel_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.channel_not_assigned}</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Server Alerts Channel */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>{t.lbl_alerts_channel}</span>
                {guildConfig.alerts_channel_id && (
                  <button
                    onClick={() => handleChannelSelect('alerts_channel_id', '')}
                    className="text-[10px] text-rose-400 hover:text-rose-300"
                  >
                    {t.channels_remove}
                  </button>
                )}
              </label>
              <select
                value={guildConfig.alerts_channel_id || ''}
                onChange={(e) => handleChannelSelect('alerts_channel_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="">{t.channel_not_assigned}</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: MESSAGE & NOTIFICATION TEMPLATES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'messages' && (
        <div className="space-y-6">
          {/* Welcome Message */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>{t.msg_welcome_title}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500">{t.msg_variables}</span>
                {['{user}', '{guild}', '{memberCount}'].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder('welcome_message', ph)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[10px] border border-slate-700"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              value={guildConfig.welcome_message || ''}
              onChange={(e) => handleMessageChange('welcome_message', e.target.value)}
              placeholder="Willkommen {user} auf {guild}! Du bist Mitglied #{memberCount}."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-xs leading-relaxed"
            />
            <p className="text-[11px] text-slate-500">
              {t.msg_welcome_hint}
            </p>
          </div>

          {/* Leave Message */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Users className="w-4 h-4 text-rose-400" />
                <span>{t.msg_leave_title}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500">{t.msg_variables}</span>
                {['{user}', '{guild}', '{memberCount}'].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder('leave_message', ph)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-rose-300 font-mono text-[10px] border border-slate-700"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              value={guildConfig.leave_message || ''}
              onChange={(e) => handleMessageChange('leave_message', e.target.value)}
              placeholder="{user} hat den Server verlassen. Wir sind nun {memberCount} Mitglieder."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Ticket Welcome Message */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>{t.msg_ticket_title}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500">{t.msg_variables}</span>
                {['{user}', '{guild}', '{ticketType}'].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder('ticket_welcome_message', ph)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono text-[10px] border border-slate-700"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              value={guildConfig.ticket_welcome_message || ''}
              onChange={(e) => handleMessageChange('ticket_welcome_message', e.target.value)}
              placeholder="Hallo {user}! Vielen Dank für deine Anfrage bezüglich {ticketType}. Unser Support-Team ist gleich für dich da."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Level Up Message */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{t.msg_levelup_title}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500">{t.msg_variables}</span>
                {['{user}', '{level}', '{xp}'].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder('level_up_message', ph)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-[10px] border border-slate-700"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              value={guildConfig.level_up_message || ''}
              onChange={(e) => handleMessageChange('level_up_message', e.target.value)}
              placeholder="Herzlichen Glückwunsch {user}! Du hast soeben Level {level} erreicht! 🚀"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-xs leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: SLASH COMMANDS MANAGER
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'commands' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>{t.cmd_title} ({commands.length} {t.cmd_registered})</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.cmd_subtitle}
              </p>
            </div>

            {/* Filter & Search */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={commandSearch}
                  onChange={(e) => setCommandSearch(e.target.value)}
                  placeholder={t.cmd_search_ph}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-cyan-500 font-mono w-48"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                {['all', 'general', 'moderation', 'pteronext', 'admin'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCommandCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                      commandCategory === cat
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Commands Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCommands.map((cmd) => {
              const isDisabled = disabledCmdList.includes(cmd.name);
              return (
                <div
                  key={cmd.name}
                  className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    isDisabled
                      ? 'bg-rose-950/10 border-rose-900/30 opacity-70'
                      : 'bg-[#0d1117] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold ${isDisabled ? 'line-through text-slate-500' : 'text-white'}`}>
                        /{cmd.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700">
                        {cmd.category}
                      </span>
                      {cmd.mainGuildOnly && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          HQ Only
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {cmd.description || t.cmd_no_desc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleCommand(cmd.name)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all shrink-0 border ${
                      isDisabled
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    }`}
                  >
                    {isDisabled ? t.cmd_disabled : t.cmd_active}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: ADMIN AUDIT-LOG & HISTORY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <History className="w-4 h-4 text-cyan-400" />
              <span>{t.audit_title}</span>
            </div>
            <button
              onClick={fetchAuditLogs}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.audit_refresh}</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {auditLogs.length === 0 ? (
              <div className="text-center py-10 text-xs font-mono text-slate-500">
                {t.audit_empty}
              </div>
            ) : (
              auditLogs.map((log) => {
                let props: any = {};
                try {
                  props = JSON.parse(log.properties || '{}');
                } catch (_) {}

                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800 space-y-1.5 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold text-[10px]">
                          {log.event}
                        </span>
                        <span className="text-slate-300 font-bold">
                          {props.guild_name || 'Discord Guild'}
                        </span>
                        {props.guild_id && (
                          <span className="text-slate-500 text-[10px]">
                            ({props.guild_id})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>IP: {log.ip}</span>
                        <span>•</span>
                        <span>{new Date(log.timestamp).toLocaleString(isDe ? 'de-DE' : 'en-US')}</span>
                      </div>
                    </div>

                    {props.summary && (
                      <p className="text-slate-300 text-[11px]">
                        {props.summary}
                      </p>
                    )}

                    {Array.isArray(props.changes) && props.changes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-850 space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                          {t.audit_changes_count} ({props.changes.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {props.changes.map((c: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-cyan-200"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: BOT CREDENTIALS & DEVELOPER PORTAL
      ───────────────────────────────────────────────────────────── */}
      {isRootAdmin && activeTab === 'credentials' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#161b22]/90 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              <span>{t.creds_title}</span>
            </div>
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              <span>{t.creds_dev_portal}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Bot Token */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.creds_token_lbl} <span className="text-rose-400">*</span></span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showToken ? t.creds_mask : t.creds_show}</span>
                </button>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="MTEzNDU2Nzg5... (Bot Token)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                />
              </div>
            </div>

            {/* Client ID */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <span>{t.creds_client_id} <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="134567890123456789"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>

            {/* Guild ID */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <span>{t.creds_guild_id} <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="text"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="987654321098765432"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>

            {/* Client Secret */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <span>{t.creds_secret}</span>
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>

            {/* Redirect URI */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <span>{t.creds_redirect}</span>
              </label>
              <input
                type="text"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                placeholder="https://panel.springisfm.de/api/auth/discord/callback"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSyncCommands}
              disabled={syncing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium transition-all flex items-center gap-2"
            >
              {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{t.creds_sync_btn}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCredentials}
              disabled={savingCreds}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-cyan-600/25 flex items-center gap-2"
            >
              {savingCreds ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{t.creds_save_btn}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CLAIM GUILD MODAL
      ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        title={isDe ? 'Discord-Server freischalten' : 'Claim Discord Server'}
        subtitle={isDe ? 'Füge deinen eigenen Discord-Server zum Dashboard hinzu' : 'Add and manage your own Discord server in the panel'}
        badge={isDe ? 'Owner-Claim' : 'Owner Claim'}
        badgeColor="purple"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Step 1: Discord Account Link Check */}
          {!isDiscordLinked ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold font-mono text-rose-300 uppercase">
                    {isDe ? 'Discord-Verknüpfung erforderlich' : 'Discord Account Link Required'}
                  </h5>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {isDe
                      ? 'Um die Inhaberschaft deines Discord-Servers zu verifizieren, muss dein PteroNext-Account mit deinem Discord-Konto verknüpft sein.'
                      : 'To verify ownership of your Discord server, your PteroNext account must be linked with your Discord profile.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsClaimModalOpen(false);
                  setIsAccountSettingsOpen(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{isDe ? 'Discord-Account in Profileinstellungen verknüpfen' : 'Link Discord in Profile Settings'}</span>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{isDe ? 'Verknüpft als:' : 'Linked as:'}</span>
                <span className="font-bold text-white">@{linkedDiscordUsername}</span>
              </span>
              <span className="text-[10px] text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/20 font-bold">
                {isDe ? 'Verifiziert' : 'Verified'}
              </span>
            </div>
          )}

          {/* Step 2: Information Checklist */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs font-mono text-slate-300">
            <span className="font-bold text-white text-[11px] uppercase tracking-wider block">
              {isDe ? 'Voraussetzungen für die Freischaltung:' : 'Requirements for unlocking:'}
            </span>
            <ul className="space-y-1.5 text-[11px] text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{isDe ? '1. Der PteroNext-Bot muss auf deinem Discord-Server sein.' : '1. PteroNext Bot must be in your Discord server.'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{isDe ? '2. Dein verknüpfter Discord-Account muss der Server-Eigentümer (Owner) sein.' : '2. Your linked Discord account must be the server owner.'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{isDe ? '3. Du benötigst die Discord Server-ID (Rechtsklick auf deinen Server -> Server-ID kopieren).' : '3. Copy your Discord Server ID (Right-click server icon -> Copy Server ID).'}</span>
              </li>
            </ul>
          </div>

          {/* Step 3: Input Form */}
          <form onSubmit={handleClaimGuild} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                {isDe ? 'Discord Server-ID (Guild ID) *' : 'Discord Server ID (Guild ID) *'}
              </label>
              <input
                type="text"
                required
                disabled={!isDiscordLinked || isClaiming}
                placeholder="z. B. 1565665887221059665"
                value={claimGuildId}
                onChange={(e) => setClaimGuildId(e.target.value.trim())}
                className="w-full bg-[#0d1017] border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors disabled:opacity-50"
              />
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                {isDe ? 'Aktivieren in Discord: Benutzereinstellungen -> Erweitert -> Entwicklermodus' : 'Enable in Discord: Settings -> Advanced -> Developer Mode'}
              </p>
            </div>

            {claimError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{claimError}</span>
                </div>
                {claimInviteUrl && (
                  <a
                    href={claimInviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 underline pt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isDe ? 'Hier klicken: PteroNext Bot auf deinen Server einladen' : 'Click here: Invite PteroNext Bot to your server'}</span>
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-3">
              <a
                href="https://discord.com/oauth2/authorize?client_id=1560663382296895608&permissions=8&scope=bot%20applications.commands"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-mono"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isDe ? 'Bot einladen' : 'Invite Bot'}</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
                >
                  {isDe ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!isDiscordLinked || !claimGuildId.trim() || isClaiming}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 active:scale-95"
                >
                  {isClaiming ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isClaiming ? (isDe ? 'Prüfe Inhaberschaft...' : 'Verifying Owner...') : (isDe ? 'Server freischalten' : 'Claim & Unlock Server')}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
