import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Modal } from '../common/Modal';
import {
  Activity,
  Plus,
  ExternalLink,
  Power,
  Trash2,
  Edit3,
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  Search,
  Globe,
  Layers,
  Send,
  Zap,
  Radio,
  Server,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Flame,
  MessageSquare,
  Clock,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

export interface StatusComponent {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  uptime_90d: number;
  latency_ms?: number;
  type?: 'http' | 'tcp' | 'service' | 'cluster' | 'database';
}

export interface StatusIncident {
  id: string;
  title: string;
  title_de?: string;
  severity: 'minor' | 'major' | 'critical' | 'maintenance';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'scheduled' | 'in_progress' | 'completed';
  message: string;
  affected_components: string[];
  notify_discord?: boolean;
  created_at: string;
}

export interface StatusPageItem {
  id: string;
  name: string;
  slug: string;
  description_de?: string;
  description_en?: string;
  theme_color: 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  is_active: boolean;
  discord_webhook_url?: string;
  components: StatusComponent[];
  incidents: StatusIncident[];
  created_at: string;
  updated_at: string;
}

const THEME_PRESETS: Record<
  StatusPageItem['theme_color'],
  { name: string; border: string; bg: string; badge: string; text: string; dot: string; glow: string }
> = {
  indigo: {
    name: 'Indigo Core',
    border: 'border-indigo-500/30',
    bg: 'bg-indigo-500/10',
    badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    text: 'text-indigo-400',
    dot: 'bg-indigo-400',
    glow: 'rgba(99,102,241,0.25)',
  },
  cyan: {
    name: 'Cyber Cyan',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/10',
    badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
    glow: 'rgba(6,182,212,0.25)',
  },
  emerald: {
    name: 'Emerald Ops',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    glow: 'rgba(16,185,129,0.25)',
  },
  amber: {
    name: 'Amber Guard',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    glow: 'rgba(245,158,11,0.25)',
  },
  rose: {
    name: 'Rose Red',
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/10',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    glow: 'rgba(244,63,94,0.25)',
  },
  violet: {
    name: 'Obsidian Violet',
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/10',
    badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    text: 'text-violet-400',
    dot: 'bg-violet-400',
    glow: 'rgba(139,92,246,0.25)',
  },
};

const INITIAL_MOCK_PAGES: StatusPageItem[] = [
  {
    id: 'sp_pteronext_core',
    name: 'PteroNext Cloud Services',
    slug: 'pteronext',
    description_de: 'Offizielle globale Statusseite für das PteroNext Panel, Nodes und API-Cluster.',
    description_en: 'Official global status page for PteroNext panel, daemon nodes and API cluster.',
    theme_color: 'cyan',
    is_active: true,
    discord_webhook_url: 'https://discord.com/api/webhooks/123456789/pteronext-status-alerts',
    components: [
      { id: 'cmp_web', name: 'Web Panel & Auth', status: 'operational', uptime_90d: 99.99, latency_ms: 18, type: 'http' },
      { id: 'cmp_node1', name: 'Wings Node 1 (Frankfurt)', status: 'operational', uptime_90d: 100.0, latency_ms: 12, type: 'cluster' },
      { id: 'cmp_node2', name: 'Wings Node 2 (Nürnberg)', status: 'operational', uptime_90d: 99.95, latency_ms: 15, type: 'cluster' },
      { id: 'cmp_bot', name: 'Discord Bot & Sync API', status: 'operational', uptime_90d: 99.98, latency_ms: 24, type: 'tcp' },
      { id: 'cmp_db', name: 'PostgreSQL Database Cluster', status: 'operational', uptime_90d: 100.0, latency_ms: 5, type: 'database' },
    ],
    incidents: [],
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sp_voxelcraft',
    name: 'VoxelCraft SMP Network',
    slug: 'voxelcraft',
    description_de: 'Live-Verfügbarkeit des BungeeCord Netzwerks, CityBuild und Minigame Nodes.',
    description_en: 'Live status of VoxelCraft BungeeCord network, CityBuild and minigames.',
    theme_color: 'emerald',
    is_active: true,
    discord_webhook_url: '',
    components: [
      { id: 'cmp_bungee', name: 'BungeeCord Proxy (EU)', status: 'operational', uptime_90d: 99.99, latency_ms: 10, type: 'tcp' },
      { id: 'cmp_citybuild', name: 'CityBuild 1.20', status: 'operational', uptime_90d: 99.88, latency_ms: 19, type: 'service' },
      { id: 'cmp_minigames', name: 'BedWars & Minigames', status: 'operational', uptime_90d: 99.92, latency_ms: 14, type: 'service' },
    ],
    incidents: [],
    created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const STORAGE_KEY = 'pteronext_admin_status_pages';

export const AdminStatusPagesView: React.FC = () => {
  const { addToast } = useApp();
  const { language } = useTranslation();

  const [pages, setPages] = useState<StatusPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<StatusPageItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescDe, setFormDescDe] = useState('');
  const [formDescEn, setFormDescEn] = useState('');
  const [formTheme, setFormTheme] = useState<StatusPageItem['theme_color']>('indigo');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formWebhook, setFormWebhook] = useState('');
  const [formComponents, setFormComponents] = useState<StatusComponent[]>([]);

  // Incident Modal State
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  const [incidentTargetPage, setIncidentTargetPage] = useState<StatusPageItem | null>(null);
  const [incTitle, setIncTitle] = useState('');
  const [incTitleDe, setIncTitleDe] = useState('');
  const [incSeverity, setIncSeverity] = useState<StatusIncident['severity']>('minor');
  const [incStatus, setIncStatus] = useState<StatusIncident['status']>('investigating');
  const [incMessage, setIncMessage] = useState('');
  const [incNotifyDiscord, setIncNotifyDiscord] = useState(true);

  // Webhook Test State
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // Save to state and storage helper
  const persistPages = (newPages: StatusPageItem[]) => {
    setPages(newPages);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPages));
    } catch {
      // ignore
    }
  };

  // Load pages on mount
  useEffect(() => {
    const fetchPages = async () => {
      setLoading(true);
      try {
        // Try fetching remote status-pages API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch('https://pteronext.com/api/status-pages', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.pages) && data.pages.length > 0) {
            persistPages(data.pages);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Network or CORS or timeout - use fallback cache/mock
      }

      // Check localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPages(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {
        // ignore
      }

      // Default mock
      persistPages(INITIAL_MOCK_PAGES);
      setLoading(false);
    };

    fetchPages();
  }, []);

  // Filtered pages
  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.description_de && p.description_de.toLowerCase().includes(q)) ||
        (p.description_en && p.description_en.toLowerCase().includes(q))
    );
  }, [pages, search]);

  // Handle open Create Modal
  const handleOpenCreate = () => {
    setEditingPage(null);
    setFormName('');
    setFormSlug('');
    setFormDescDe('');
    setFormDescEn('');
    setFormTheme('cyan');
    setFormIsActive(true);
    setFormWebhook('');
    setFormComponents([
      { id: 'cmp_1', name: 'Web Portal', status: 'operational', uptime_90d: 99.99, latency_ms: 20, type: 'http' },
      { id: 'cmp_2', name: 'Compute Node', status: 'operational', uptime_90d: 100.0, latency_ms: 15, type: 'cluster' },
      { id: 'cmp_3', name: 'Database Service', status: 'operational', uptime_90d: 99.95, latency_ms: 8, type: 'database' },
    ]);
    setIsEditorOpen(true);
  };

  // Handle open Edit Modal
  const handleOpenEdit = (page: StatusPageItem) => {
    setEditingPage(page);
    setFormName(page.name);
    setFormSlug(page.slug);
    setFormDescDe(page.description_de || '');
    setFormDescEn(page.description_en || '');
    setFormTheme(page.theme_color || 'indigo');
    setFormIsActive(page.is_active);
    setFormWebhook(page.discord_webhook_url || '');
    setFormComponents(page.components ? [...page.components] : []);
    setIsEditorOpen(true);
  };

  // Save Page
  const handleSavePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      addToast({
        title: language === 'de' ? 'Fehlende Angaben' : 'Validation Error',
        description: language === 'de' ? 'Name und Slug sind Pflichtfelder.' : 'Name and Slug are required.',
        type: 'error',
      });
      return;
    }

    const cleanSlug = formSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-');

    if (editingPage) {
      const updated = pages.map((p) =>
        p.id === editingPage.id
          ? {
              ...p,
              name: formName.trim(),
              slug: cleanSlug,
              description_de: formDescDe.trim(),
              description_en: formDescEn.trim(),
              theme_color: formTheme,
              is_active: formIsActive,
              discord_webhook_url: formWebhook.trim(),
              components: formComponents,
              updated_at: new Date().toISOString(),
            }
          : p
      );
      persistPages(updated);
      addToast({
        title: language === 'de' ? 'Statusseite aktualisiert' : 'Status Page Updated',
        description:
          language === 'de'
            ? `Statusseite '${formName.trim()}' wurde erfolgreich gesichert.`
            : `Status page '${formName.trim()}' was updated successfully.`,
        type: 'success',
      });
    } else {
      const newPage: StatusPageItem = {
        id: `sp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: formName.trim(),
        slug: cleanSlug,
        description_de: formDescDe.trim(),
        description_en: formDescEn.trim(),
        theme_color: formTheme,
        is_active: formIsActive,
        discord_webhook_url: formWebhook.trim(),
        components: formComponents,
        incidents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      persistPages([newPage, ...pages]);
      addToast({
        title: language === 'de' ? 'Statusseite erstellt' : 'Status Page Created',
        description:
          language === 'de'
            ? `Statusseite '${newPage.name}' ist jetzt unter status.pteronext.com/${newPage.slug} verfügbar.`
            : `Status page '${newPage.name}' is live at status.pteronext.com/${newPage.slug}.`,
        type: 'success',
      });
    }

    setIsEditorOpen(false);
  };

  // Toggle Active State
  const handleToggleActive = (page: StatusPageItem) => {
    const updated = pages.map((p) =>
      p.id === page.id ? { ...p, is_active: !p.is_active, updated_at: new Date().toISOString() } : p
    );
    persistPages(updated);
    addToast({
      title: language === 'de' ? 'Status geändert' : 'Status Toggled',
      description:
        language === 'de'
          ? `'${page.name}' ist jetzt ${!page.is_active ? 'Aktiv (Online)' : 'Deaktiviert (Offline)'}.`
          : `'${page.name}' is now ${!page.is_active ? 'Active' : 'Disabled'}.`,
      type: 'info',
    });
  };

  // Delete Status Page
  const handleDeletePage = (page: StatusPageItem) => {
    if (
      !window.confirm(
        language === 'de'
          ? `Möchtest du die Statusseite '${page.name}' wirklich löschen?`
          : `Are you sure you want to delete status page '${page.name}'?`
      )
    ) {
      return;
    }
    const updated = pages.filter((p) => p.id !== page.id);
    persistPages(updated);
    addToast({
      title: language === 'de' ? 'Statusseite gelöscht' : 'Status Page Deleted',
      description: `'${page.name}' wurde entfernt.`,
      type: 'info',
    });
  };

  // Test Discord Webhook
  const handleTestWebhook = async (page: StatusPageItem, webhookUrl?: string) => {
    const url = webhookUrl || page.discord_webhook_url;
    if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
      addToast({
        title: language === 'de' ? 'Ungültige Webhook URL' : 'Invalid Webhook URL',
        description:
          language === 'de'
            ? 'Bitte gib eine gültige Discord Webhook URL ein (https://discord.com/api/webhooks/...)'
            : 'Please enter a valid Discord Webhook URL.',
        type: 'error',
      });
      return;
    }

    setTestingWebhookId(page.id || 'form');

    try {
      const payload = {
        username: 'PteroNext Status Sentinel',
        avatar_url: 'https://pteronext.com/pteronext-logo.png',
        embeds: [
          {
            title: `🟢 PteroNext Uptime & Status - Webhook Test`,
            description: `Test-Benachrichtigung für Statusseite **${page.name || 'PteroNext Status'}** (\`${page.slug || 'slug'}\`). Der Webhook ist aktiv und empfangsbereit!`,
            color: 0x10b981,
            fields: [
              {
                name: 'Statusseite (Host)',
                value: `[status.pteronext.com/${page.slug || 'pteronext'}](https://status.pteronext.com/${page.slug || 'pteronext'})`,
                inline: true,
              },
              {
                name: 'Monitore / Dienste',
                value: `${page.components?.length || 3} registriert`,
                inline: true,
              },
              {
                name: 'Panel Core',
                value: 'panel.pteronext.com (v2.9.1)',
                inline: true,
              },
            ],
            footer: {
              text: 'PteroNext Uptime Monitoring & Realtime Status',
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });

      addToast({
        title: language === 'de' ? 'Webhook Signal gesendet' : 'Webhook Signal Dispatched',
        description:
          language === 'de'
            ? `Testnachricht an Discord gesendet für '${page.name || 'Statusseite'}'.`
            : `Test message dispatched to Discord for '${page.name}'.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Webhook Test Error',
        description: err?.message || 'Fehler beim Senden des Discord Webhooks.',
        type: 'error',
      });
    } finally {
      setTestingWebhookId(null);
    }
  };

  // Open Incident Modal
  const handleOpenIncident = (page: StatusPageItem) => {
    setIncidentTargetPage(page);
    setIncTitle('');
    setIncTitleDe('');
    setIncSeverity('minor');
    setIncStatus('investigating');
    setIncMessage('');
    setIncNotifyDiscord(Boolean(page.discord_webhook_url));
    setIsIncidentOpen(true);
  };

  // Submit Incident
  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTargetPage || !incTitle.trim()) {
      addToast({
        title: language === 'de' ? 'Titel fehlt' : 'Title Missing',
        description: language === 'de' ? 'Bitte gib einen Vorfallstitel an.' : 'Please enter an incident title.',
        type: 'error',
      });
      return;
    }

    const newIncident: StatusIncident = {
      id: `inc_${Date.now()}`,
      title: incTitle.trim(),
      title_de: incTitleDe.trim() || incTitle.trim(),
      severity: incSeverity,
      status: incStatus,
      message: incMessage.trim(),
      affected_components: incidentTargetPage.components.map((c) => c.name),
      notify_discord: incNotifyDiscord,
      created_at: new Date().toISOString(),
    };

    const updated = pages.map((p) =>
      p.id === incidentTargetPage.id
        ? {
            ...p,
            incidents: [newIncident, ...(p.incidents || [])],
            updated_at: new Date().toISOString(),
          }
        : p
    );

    persistPages(updated);

    // Optionally notify Discord Webhook
    if (incNotifyDiscord && incidentTargetPage.discord_webhook_url) {
      const colorMap: Record<StatusIncident['severity'], number> = {
        minor: 0xf59e0b,
        major: 0xf97316,
        critical: 0xef4444,
        maintenance: 0x6366f1,
      };

      try {
        await fetch(incidentTargetPage.discord_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'PteroNext Status Sentinel',
            avatar_url: 'https://pteronext.com/pteronext-logo.png',
            embeds: [
              {
                title: `🚨 [${incSeverity.toUpperCase()}] ${newIncident.title}`,
                description: newIncident.message || 'Ein neuer Vorfall wurde auf der Statusseite dokumentiert.',
                color: colorMap[incSeverity],
                fields: [
                  { name: 'Status', value: incStatus.toUpperCase(), inline: true },
                  { name: 'Statusseite', value: `https://status.pteronext.com/${incidentTargetPage.slug}`, inline: true },
                  { name: 'Betroffene Dienste', value: newIncident.affected_components.join(', ') || 'Alle', inline: false },
                ],
                footer: { text: 'PteroNext Incident Response' },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
          mode: 'no-cors',
        });
      } catch {
        // ignore discord error
      }
    }

    addToast({
      title: language === 'de' ? 'Vorfall veröffentlicht' : 'Incident Published',
      description:
        language === 'de'
          ? `Vorfall '${newIncident.title}' wurde erfasst & live geschaltet.`
          : `Incident '${newIncident.title}' has been published.`,
      type: 'success',
    });

    setIsIncidentOpen(false);
  };

  // Add Component to Editor
  const handleAddComponent = () => {
    const newComp: StatusComponent = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: 'Neuer Dienst',
      status: 'operational',
      uptime_90d: 99.9,
      latency_ms: 15,
      type: 'http',
    };
    setFormComponents([...formComponents, newComp]);
  };

  // Update Component in Editor
  const handleUpdateComponent = (idx: number, updates: Partial<StatusComponent>) => {
    const list = [...formComponents];
    list[idx] = { ...list[idx], ...updates };
    setFormComponents(list);
  };

  // Remove Component
  const handleRemoveComponent = (idx: number) => {
    setFormComponents(formComponents.filter((_, i) => i !== idx));
  };

  // Copy URL helper
  const handleCopyLink = (slug: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedSlug(slug);
    addToast({
      title: language === 'de' ? 'Link kopiert' : 'Link Copied',
      description: url,
      type: 'info',
    });
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  return (
    <div className="space-y-6 view-enter pb-16">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
              <Radio className="w-3 h-3 animate-pulse text-cyan-400" />
              Realtime Monitoring & CDN
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300 border border-white/10">
              status.pteronext.com
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" />
            Uptime & Status Pages
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
            Verwalte gehostete Statusseiten unter{' '}
            <a
              href="https://status.pteronext.com"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline font-mono"
            >
              status.pteronext.com/&#123;project&#125;
            </a>{' '}
            mit vollautomatischen Discord Webhooks, SLA Uptime Balken und Incident Response.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition-all hover:text-white"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold font-mono transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'de' ? 'Statusseite erstellen' : 'Create Status Page'}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0d1117]/80 backdrop-blur-xl border border-white/[0.08] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Statusseiten Gesamt</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{pages.length}</span>
            <span className="text-[11px] font-mono text-emerald-400">
              {pages.filter((p) => p.is_active).length} aktiv online
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1117]/80 backdrop-blur-xl border border-white/[0.08] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Gemonitorte Dienste</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {pages.reduce((acc, p) => acc + (p.components?.length || 0), 0)}
            </span>
            <span className="text-[11px] font-mono text-slate-400">Services & Nodes</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1117]/80 backdrop-blur-xl border border-white/[0.08] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Discord Alerting</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {pages.filter((p) => Boolean(p.discord_webhook_url)).length}
            </span>
            <span className="text-[11px] font-mono text-indigo-400">Webhooks verknüpft</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0d1117]/80 backdrop-blur-xl border border-white/[0.08] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Aktive Vorfälle</span>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {pages.reduce(
                (acc, p) =>
                  acc +
                  (p.incidents?.filter(
                    (i) => i.status !== 'resolved' && i.status !== 'completed'
                  ).length || 0),
                0
              )}
            </span>
            <span className="text-[11px] font-mono text-emerald-400">Alles stabil</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-[#0d1117]/60 backdrop-blur-md border border-white/[0.06]">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              language === 'de'
                ? 'Statusseite suchen (Name, Slug, Beschreibung)...'
                : 'Search status pages by name, slug...'
            }
            className="w-full pl-9 pr-4 py-2 bg-[#161b22]/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>{filteredPages.length} von {pages.length} Seiten</span>
        </div>
      </div>

      {/* Main Status Pages List */}
      {loading ? (
        <div className="p-8 space-y-4 bg-[#0d1117]/80 rounded-2xl border border-white/[0.08]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 w-full bg-[#161b22]/70 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredPages.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0d1117]/80 border border-white/[0.08] backdrop-blur-xl">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 text-cyan-400">
            <Radio className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Keine Statusseiten gefunden</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {search
              ? 'Kein Eintrag entspricht deinen Suchkriterien.'
              : 'Erstelle jetzt deine erste gehostete Uptime-Seite mit Live-Verfügbarkeiten und Discord Alerting.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold font-mono transition-all"
          >
            Jetzt Statusseite anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredPages.map((page) => {
            const theme = THEME_PRESETS[page.theme_color] || THEME_PRESETS.indigo;
            const statusUrl = `https://status.pteronext.com/${page.slug}`;
            const altStatusUrl = `https://pteronext.com/status/${page.slug}`;
            const activeIncidents =
              page.incidents?.filter(
                (i) => i.status !== 'resolved' && i.status !== 'completed'
              ) || [];

            return (
              <div
                key={page.id}
                className={`p-5 rounded-2xl bg-[#0d1117]/90 backdrop-blur-xl border transition-all duration-200 hover:border-slate-600/80 shadow-lg relative overflow-hidden group ${
                  page.is_active ? 'border-white/[0.08]' : 'border-rose-900/30 opacity-75'
                }`}
                style={{
                  boxShadow: page.is_active ? `0 4px 24px -6px ${theme.glow}` : undefined,
                }}
              >
                {/* Accent top gradient stripe */}
                <div
                  className="absolute inset-x-0 top-0 h-[2px] opacity-70"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${theme.glow}, transparent)`,
                  }}
                />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Info & Links */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${page.is_active ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
                        {page.name}
                      </h3>

                      {/* Theme Badge */}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${theme.badge}`}>
                        {theme.name}
                      </span>

                      {/* Online / Offline Switch Badge */}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          page.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {page.is_active ? 'Aktiv (Online)' : 'Deaktiviert (Offline)'}
                      </span>

                      {/* Discord Webhook indicator */}
                      {page.discord_webhook_url ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                          <Bell className="w-3 h-3 text-indigo-400" />
                          Discord Alerting
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-400 border border-slate-700/60">
                          Kein Webhook
                        </span>
                      )}

                      {/* Incidents Badge */}
                      {activeIncidents.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {activeIncidents.length} Vorfall aktiv
                        </span>
                      )}
                    </div>

                    {/* Slug & Host Links */}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                      <div className="flex items-center gap-1.5 bg-[#161b22] px-2.5 py-1 rounded-lg border border-slate-800">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-slate-300">status.pteronext.com/{page.slug}</span>
                        <button
                          onClick={() => handleCopyLink(page.slug, statusUrl)}
                          className="text-slate-500 hover:text-white transition-colors ml-1"
                          title="URL kopieren"
                        >
                          {copiedSlug === page.slug ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <a
                        href={statusUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>Öffnen</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <span className="text-slate-600">•</span>

                      <a
                        href={altStatusUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-slate-200 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>Mirror (/status/{page.slug})</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 line-clamp-2 max-w-3xl">
                      {language === 'de'
                        ? page.description_de || page.description_en || 'Keine Beschreibung hinterlegt.'
                        : page.description_en || page.description_de || 'No description provided.'}
                    </p>

                    {/* Components Mini Badges */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {page.components?.length || 0} Dienste:
                      </span>
                      {page.components?.slice(0, 5).map((cmp) => (
                        <span
                          key={cmp.id}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161b22] border border-slate-800 text-slate-300 flex items-center gap-1.5"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cmp.status === 'operational'
                                ? 'bg-emerald-400'
                                : cmp.status === 'degraded'
                                ? 'bg-amber-400'
                                : cmp.status === 'maintenance'
                                ? 'bg-blue-400'
                                : 'bg-rose-500'
                            }`}
                          />
                          {cmp.name}
                          <span className="text-slate-400">({cmp.uptime_90d}%)</span>
                        </span>
                      ))}
                      {(page.components?.length || 0) > 5 && (
                        <span className="text-[10px] font-mono text-slate-400">
                          +{(page.components?.length || 0) - 5} weitere
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: 1-Click Action Buttons */}
                  <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                    <div className="flex items-center gap-2">
                      {/* Webhook Test Button */}
                      {page.discord_webhook_url && (
                        <button
                          onClick={() => handleTestWebhook(page)}
                          disabled={testingWebhookId === page.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-medium transition-all"
                          title="Discord Webhook Test senden"
                        >
                          <Send className={`w-3.5 h-3.5 ${testingWebhookId === page.id ? 'animate-spin' : ''}`} />
                          <span>Webhook Test</span>
                        </button>
                      )}

                      {/* Incident / Vorfall Button */}
                      <button
                        onClick={() => handleOpenIncident(page)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-medium transition-all"
                        title="Neuen Vorfall oder Wartung ankündigen"
                      >
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        <span>Vorfall posten</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEdit(page)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Bearbeiten</span>
                      </button>

                      {/* Toggle Active Button */}
                      <button
                        onClick={() => handleToggleActive(page)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all ${
                          page.is_active
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                        title={page.is_active ? 'Statusseite pausieren/deaktivieren' : 'Statusseite online schalten'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{page.is_active ? 'Deaktivieren' : 'Aktivieren'}</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeletePage(page)}
                        className="p-1.5 rounded-xl bg-slate-800/40 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/40 transition-all"
                        title="Statusseite löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CREATE / EDIT STATUS PAGE */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingPage ? `Statusseite bearbeiten: ${editingPage.name}` : 'Neue Uptime & Statusseite erstellen'}
        subtitle="Konfiguriere Slug, Branding, Discord Webhook & die zu überwachenden Dienste."
        icon={<Activity className="w-5 h-5 text-cyan-400" />}
        maxWidth="3xl"
      >
        <form onSubmit={handleSavePage} className="space-y-5">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Name der Statusseite <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z. B. PteroNext Cloud Infrastructure"
                className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                URL Slug <span className="text-cyan-400">*</span>
              </label>
              <div className="flex items-center">
                <span className="px-2.5 py-2 bg-[#0d1117] border border-r-0 border-slate-700 rounded-l-xl text-[11px] font-mono text-slate-400">
                  status.pteronext.com/
                </span>
                <input
                  type="text"
                  required
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                  placeholder="mein-projekt"
                  className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-r-xl text-xs text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Descriptions (DE & EN) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Beschreibung (Deutsch)
              </label>
              <textarea
                rows={2}
                value={formDescDe}
                onChange={(e) => setFormDescDe(e.target.value)}
                placeholder="Live-Status aller unserer Minecraft Server und Discord Bots..."
                className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Description (English)
              </label>
              <textarea
                rows={2}
                value={formDescEn}
                onChange={(e) => setFormDescEn(e.target.value)}
                placeholder="Live status of all our Minecraft servers and Discord bots..."
                className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-sans"
              />
            </div>
          </div>

          {/* Theme Color Picker & Active Switch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#0d1117] border border-slate-800">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-2">
                Akzentfarbe / Branding-Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(THEME_PRESETS) as Array<StatusPageItem['theme_color']>).map((col) => {
                  const p = THEME_PRESETS[col];
                  const isSel = formTheme === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setFormTheme(col)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-all ${
                        isSel
                          ? `${p.badge} ring-1 ring-white/20 font-bold`
                          : 'bg-[#161b22] border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${p.dot}`} />
                      <span>{p.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <label className="block text-xs font-mono font-medium text-slate-300 mb-2">
                Veröffentlichungsstatus
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formIsActive ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-mono text-slate-300">
                  {formIsActive ? 'Öffentlich erreichbar (Online)' : 'Deaktiviert (Privat / Wartung)'}
                </span>
              </div>
            </div>
          </div>

          {/* Discord Webhook Integration */}
          <div className="space-y-2 p-4 rounded-xl bg-[#0d1117] border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-medium text-slate-300 flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                Discord Webhook Benachrichtigungen
              </label>
              {formWebhook && (
                <button
                  type="button"
                  onClick={() =>
                    handleTestWebhook(
                      { id: 'form', name: formName || 'Test Page', slug: formSlug || 'test', components: formComponents } as any,
                      formWebhook
                    )
                  }
                  disabled={testingWebhookId === 'form'}
                  className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Webhook testen</span>
                </button>
              )}
            </div>
            <input
              type="url"
              value={formWebhook}
              onChange={(e) => setFormWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">
              Automatische Embed-Updates werden bei Statusänderungen oder neuen Vorfällen in diesen Discord-Kanal gepostet.
            </p>
          </div>

          {/* Components / Services List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Gemonitorte Komponenten & Dienste ({formComponents.length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Dienste wie Minecraft Server, Discord Bots oder Web APIs auf dieser Statusseite anzeigen.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddComponent}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dienst hinzufügen</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {formComponents.map((cmp, idx) => (
                <div
                  key={cmp.id || idx}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl bg-[#161b22] border border-slate-800"
                >
                  <input
                    type="text"
                    value={cmp.name}
                    onChange={(e) => handleUpdateComponent(idx, { name: e.target.value })}
                    placeholder="Name des Dienstes (z. B. Minecraft CityBuild)"
                    className="flex-1 min-w-[140px] px-2.5 py-1.5 bg-[#0d1117] border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />

                  <select
                    value={cmp.status}
                    onChange={(e) =>
                      handleUpdateComponent(idx, {
                        status: e.target.value as StatusComponent['status'],
                      })
                    }
                    className="px-2.5 py-1.5 bg-[#0d1117] border border-slate-700 rounded-lg text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="operational">🟢 Operational</option>
                    <option value="degraded">🟡 Degraded</option>
                    <option value="partial_outage">🟠 Partial Outage</option>
                    <option value="major_outage">🔴 Major Outage</option>
                    <option value="maintenance">🔵 Maintenance</option>
                  </select>

                  <div className="flex items-center gap-1 w-24">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={cmp.uptime_90d}
                      onChange={(e) =>
                        handleUpdateComponent(idx, { uptime_90d: parseFloat(e.target.value) || 99.9 })
                      }
                      className="w-16 px-2 py-1.5 bg-[#0d1117] border border-slate-700 rounded-lg text-xs text-white font-mono text-center focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-xs font-mono text-slate-400">%</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveComponent(idx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Dienst entfernen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold font-mono shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
            >
              {editingPage ? 'Änderungen speichern' : 'Statusseite erstellen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: PUBLISH INCIDENT */}
      <Modal
        isOpen={isIncidentOpen}
        onClose={() => setIsIncidentOpen(false)}
        title={`Vorfall oder Wartung melden: ${incidentTargetPage?.name}`}
        subtitle="Veröffentliche ein Live-Update für Nutzer und benachrichtige optional den Discord-Kanal."
        icon={<Flame className="w-5 h-5 text-rose-400" />}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveIncident} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Titel des Vorfalls <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={incTitle}
              onChange={(e) => setIncTitle(e.target.value)}
              placeholder="z. B. Erhöhte Latenz auf Wings Node 1 / Geplante Wartung"
              className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Schweregrad
              </label>
              <select
                value={incSeverity}
                onChange={(e) => setIncSeverity(e.target.value as StatusIncident['severity'])}
                className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-xs text-slate-300 font-mono focus:outline-none focus:border-rose-500"
              >
                <option value="minor">🟡 Minor / Geringe Beeinträchtigung</option>
                <option value="major">🟠 Major / Erheblicher Teilausfall</option>
                <option value="critical">🔴 Critical / Kritischer Gesamtausfall</option>
                <option value="maintenance">🔵 Wartungsarbeiten (Geplant)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Aktueller Status
              </label>
              <select
                value={incStatus}
                onChange={(e) => setIncStatus(e.target.value as StatusIncident['status'])}
                className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-xs text-slate-300 font-mono focus:outline-none focus:border-rose-500"
              >
                <option value="investigating">🔍 Untersuche (Investigating)</option>
                <option value="identified">🎯 Identifiziert (Identified)</option>
                <option value="monitoring">👀 Beobachtung (Monitoring)</option>
                <option value="resolved">✅ Behoben (Resolved)</option>
                <option value="scheduled">📅 Geplant (Scheduled)</option>
                <option value="in_progress">⚙️ In Arbeit (In Progress)</option>
                <option value="completed">🎉 Abgeschlossen (Completed)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Nachricht & Details für Status-Besucher
            </label>
            <textarea
              rows={3}
              value={incMessage}
              onChange={(e) => setIncMessage(e.target.value)}
              placeholder="Wir untersuchen derzeit vereinzelte Verbindungsabbrüche zum Datenbank-Cluster. Techniker sind informiert."
              className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none font-sans"
            />
          </div>

          {/* Discord Notify Switch */}
          {incidentTargetPage?.discord_webhook_url && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0d1117] border border-slate-800">
              <input
                type="checkbox"
                id="incDiscordCheck"
                checked={incNotifyDiscord}
                onChange={(e) => setIncNotifyDiscord(e.target.checked)}
                className="rounded border-slate-700 text-indigo-500 focus:ring-0 w-4 h-4"
              />
              <label htmlFor="incDiscordCheck" className="text-xs font-mono text-slate-300 cursor-pointer">
                Diesen Vorfall sofort via Discord Webhook an den Alarm-Channel senden
              </label>
            </div>
          )}

          {/* Incident Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsIncidentOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-400 hover:to-orange-500 text-white text-xs font-bold font-mono shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all"
            >
              Vorfall jetzt veröffentlichen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
