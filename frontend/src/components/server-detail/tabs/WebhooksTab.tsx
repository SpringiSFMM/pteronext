import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import api from '../../../api/client';
import {
  Webhook as WebhookIcon,
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  Cpu,
  Archive,
  RefreshCw,
  ExternalLink,
  X,
  CheckCircle2,
  Sparkles,
  Play,
  Square,
  AlertOctagon,
} from 'lucide-react';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal';

interface WebhookItem {
  id: number;
  server_id?: number;
  name: string;
  url: string;
  platform: string;
  events: string; // JSON string or comma-separated
  is_active: boolean;
  created_at: string;
}

const AVAILABLE_EVENTS = [
  {
    id: 'server.start',
    label: 'Server gestartet / Online (Power ON)',
    description: 'Wird sofort ausgelöst, wenn der Server hochfährt und betriebsbereit ist.',
    icon: Play,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'server.stop',
    label: 'Server gestoppt / Offline (Power OFF)',
    description: 'Wird ausgelöst, wenn der Serverprozess regulär beendet oder heruntergefahren wird.',
    icon: Square,
    color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  },
  {
    id: 'server.oom',
    label: 'Out of Memory (OOM Killer)',
    description: 'Schlägt sofort Alarm, wenn das RAM-Limit überschritten und der Container vom Linux-Kernel gestoppt wird.',
    icon: AlertOctagon,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    id: 'server.crash',
    label: 'Server Crash / Unerwarteter Stopp',
    description: 'Triggers immediately when the container process exits abnormally with a non-zero exit code.',
    icon: AlertTriangle,
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
  },
  {
    id: 'server.high_cpu',
    label: 'High CPU Alert (> 90%)',
    description: 'Notifies staff when the server spikes above 90% CPU consumption for extended periods.',
    icon: Cpu,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'backup.completed',
    label: 'Backup Completed',
    description: 'Posts a snapshot report with archive size, encryption status, and direct restoration link.',
    icon: Archive,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
];

export const WebhooksTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Delete Modal State
  const [deleteTargetWebhook, setDeleteTargetWebhook] = useState<WebhookItem | null>(null);
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false);

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<'discord' | 'slack'>('discord');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'server.start',
    'server.stop',
    'server.oom',
    'server.crash',
    'server.high_cpu',
    'backup.completed',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const fetchWebhooks = useCallback(async () => {
    if (!selectedServer?.uuid) return;
    try {
      const res = await api.webhooks.list(selectedServer.uuid);
      setWebhooks(res.data || []);
    } catch (err: any) {
      console.error('Failed to load webhooks:', err);
      addToast({
        title: 'Failed Loading Webhooks',
        description: err?.message || 'Could not fetch webhooks from server.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedServer?.uuid, addToast]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWebhooks();
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer?.uuid) return;
    if (!name.trim()) {
      addToast({ title: 'Name Required', description: 'Please enter a webhook name.', type: 'error' });
      return;
    }
    if (!url.trim().startsWith('http')) {
      addToast({
        title: 'Invalid URL',
        description: 'Webhook URL must start with http:// or https://',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.webhooks.create(selectedServer.uuid, {
        name: name.trim(),
        url: url.trim(),
        platform,
        events: selectedEvents,
      });

      addToast({
        title: 'Webhook Registered',
        description: res.message || `Webhook "${name}" is now listening for events.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setName('');
      setUrl('');
      fetchWebhooks();
    } catch (err: any) {
      addToast({
        title: 'Creation Failed',
        description: err?.message || 'Could not save webhook.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (webhook: WebhookItem) => {
    setDeleteTargetWebhook(webhook);
  };

  const handleConfirmDelete = async () => {
    if (!selectedServer?.uuid || !deleteTargetWebhook) return;
    setIsDeletingWebhook(true);
    try {
      await api.webhooks.delete(selectedServer.uuid, deleteTargetWebhook.id);
      setWebhooks((prev) => prev.filter((w) => w.id !== deleteTargetWebhook.id));
      addToast({
        title: language === 'de' ? 'Webhook entfernt' : 'Webhook Removed',
        description:
          language === 'de'
            ? `Webhook "${deleteTargetWebhook.name}" wurde getrennt.`
            : `Webhook "${deleteTargetWebhook.name}" was disconnected.`,
        type: 'info',
      });
      setDeleteTargetWebhook(null);
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Löschen fehlgeschlagen' : 'Delete Failed',
        description: err?.message || 'Failed removing webhook.',
        type: 'error',
      });
    } finally {
      setIsDeletingWebhook(false);
    }
  };

  const handleTestPing = async (webhook: WebhookItem) => {
    if (!selectedServer?.uuid) return;
    setTestingId(webhook.id);
    try {
      const res = await api.webhooks.test(selectedServer.uuid, webhook.id);
      addToast({
        title: 'Ping Dispatched',
        description: res.message || 'Test embed with action buttons was sent to your channel!',
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Ping Failed',
        description: err?.message || 'Could not deliver test ping. Check webhook URL validity.',
        type: 'error',
      });
    } finally {
      setTestingId(null);
    }
  };

  const parseEvents = (raw: string): string[] => {
    try {
      if (raw.startsWith('[')) {
        return JSON.parse(raw);
      }
      return raw.split(',').map((s) => s.trim());
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <WebhookIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white tracking-wide">
                Discord- & Slack-First Webhook Automation
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Action-Buttons Native
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Instant alerts for server crashes, high CPU spikes & completed backups with interactive buttons
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-[#0d1117] hover:bg-[#21262d] text-slate-300 hover:text-white border border-[#30363d] rounded-xl transition-all disabled:opacity-50"
            title="Refresh webhooks list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-indigo-900/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Webhook</span>
          </button>
        </div>
      </div>

      {/* Webhooks List */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-3" />
            Loading automation webhooks...
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0d1117] border border-[#30363d] flex items-center justify-center mx-auto text-slate-500 mb-3">
              <WebhookIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-medium text-slate-300">No Webhooks Configured</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Add your Discord channel webhook to receive real-time crash notifications, high CPU alerts, and backup completions with one-click action buttons.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-medium rounded-xl border border-[#30363d] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Configure Discord Webhook
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#21262d]">
            {webhooks.map((w) => {
              const activeEvents = parseEvents(w.events);
              const isDiscord = w.platform.toLowerCase() === 'discord';
              const isSlack = w.platform.toLowerCase() === 'slack';

              return (
                <div
                  key={w.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#1a202c]/50 transition-colors"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className={`p-3 rounded-xl border flex-shrink-0 ${
                        isDiscord
                          ? 'bg-[#5865F2]/15 text-[#5865F2] border-[#5865F2]/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{w.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                            isDiscord
                              ? 'bg-[#5865F2]/15 text-[#7289da] border-[#5865F2]/30'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isDiscord ? 'Discord Native Embed' : 'Slack Webhook'}
                        </span>
                        {w.is_active && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-slate-400 truncate max-w-lg">
                        {w.url.replace(/(\/webhooks\/\d+\/)[a-zA-Z0-9_-]+/, '$1••••••••••••')}
                      </div>

                      {/* Event badges */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {activeEvents.map((ev) => {
                          const evDef = AVAILABLE_EVENTS.find((e) => e.id === ev);
                          return (
                            <span
                              key={ev}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#0d1117] text-slate-300 border border-[#30363d]"
                            >
                              {evDef?.label || ev}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleTestPing(w)}
                      disabled={testingId === w.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#21262d] hover:bg-[#30363d] text-indigo-300 hover:text-white text-xs font-medium rounded-xl border border-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
                      title="Send test message to channel"
                    >
                      {testingId === w.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending Ping...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Test Ping</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(w)}
                      className="p-2 bg-[#21262d] hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl border border-[#30363d] transition-all cursor-pointer"
                      title="Delete webhook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE WEBHOOK MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <WebhookIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Add Webhook Automation</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect Discord or Slack channel for automated event dispatch
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                  Webhook Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. #ops-alerts Discord"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                  Webhook URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://discord.com/api/webhooks/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                  Platform
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlatform('discord')}
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      platform === 'discord'
                        ? 'bg-[#5865F2]/20 border-[#5865F2] text-white'
                        : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Discord (Embeds + Buttons)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('slack')}
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      platform === 'slack'
                        ? 'bg-emerald-500/20 border-emerald-500 text-white'
                        : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Slack (Blocks)</span>
                  </button>
                </div>
              </div>

              {/* Subscribed Events */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-2">
                  Subscribed Trigger Events
                </label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((ev) => {
                    const isChecked = selectedEvents.includes(ev.id);
                    const Icon = ev.icon;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => toggleEvent(ev.id)}
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#0d1117] border-indigo-500/50'
                            : 'bg-[#0d1117]/50 border-[#30363d] opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded bg-[#161b22] border-[#30363d] text-indigo-500 w-4 h-4"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-white">{ev.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{ev.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white font-medium rounded-xl hover:bg-[#21262d] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedEvents.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-lg shadow-indigo-900/20 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Add Webhook'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cyber-Glass Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetWebhook}
        onClose={() => setDeleteTargetWebhook(null)}
        onConfirm={handleConfirmDelete}
        title={language === 'de' ? 'Webhook löschen' : 'Delete Webhook'}
        itemName={deleteTargetWebhook?.name}
        description={
          language === 'de'
            ? `Möchtest du den Webhook "${deleteTargetWebhook?.name}" (${deleteTargetWebhook?.platform}) wirklich unwiderruflich löschen? Es werden keine Benachrichtigungen mehr an diese URL gesendet.`
            : `Are you sure you want to permanently delete webhook "${deleteTargetWebhook?.name}" (${deleteTargetWebhook?.platform})? Notifications will no longer be sent to this endpoint.`
        }
        isDeleting={isDeletingWebhook}
      />
    </div>
  );
};
