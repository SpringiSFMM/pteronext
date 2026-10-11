import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import { ScheduleTask } from '../../../types';
import {
  Calendar,
  Clock,
  Play,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronRight,
  Zap,
  Flame,
  ArrowRight,
  ShieldAlert,
  HardDrive,
  RefreshCw,
  Bell,
  Cpu,
  Layers,
  Terminal,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal';

interface EventActionStep {
  type: string;
  target: string;
  description: string;
}

interface EventTriggerRule {
  id: string;
  server_uuid: string;
  name: string;
  event_type: string;
  condition_text: string;
  webhook_url: string;
  is_enabled: boolean;
  actions: EventActionStep[];
  last_triggered?: string;
  execution_count: number;
  created_at: string;
}

export const SchedulesTab: React.FC = () => {
  const { schedules, toggleSchedule, triggerScheduleNow, addSchedule, addToast, selectedServer } = useApp();
  const { t, language } = useTranslation();

  // Mode switcher: 'cron' or 'events'
  const [activeMode, setActiveMode] = useState<'cron' | 'events'>('events');

  // Cron schedule modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 4 * * *');
  const [taskDescription, setTaskDescription] = useState('');

  // Event trigger state
  const [triggers, setTriggers] = useState<EventTriggerRule[]>([]);
  const [isNewTriggerModalOpen, setIsNewTriggerModalOpen] = useState(false);
  const [testingTriggerId, setTestingTriggerId] = useState<string | null>(null);
  const [deleteTargetTrigger, setDeleteTargetTrigger] = useState<EventTriggerRule | null>(null);
  const [isDeletingTrigger, setIsDeletingTrigger] = useState(false);

  // New Trigger form fields
  const [newTriggerName, setNewTriggerName] = useState('');
  const [newTriggerEvent, setNewTriggerEvent] = useState('server_crash');
  const [newTriggerCondition, setNewTriggerCondition] = useState('');
  const [newTriggerWebhook, setNewTriggerWebhook] = useState('');
  const [newTriggerChainPreset, setNewTriggerChainPreset] = useState('crash_restart');

  const fetchTriggers = async () => {
    if (!selectedServer?.uuid) return;
    try {
      const res = await api.automation.listTriggers(selectedServer.uuid);
      if (res?.triggers) {
        setTriggers(res.triggers);
      }
    } catch (e) {
      // quiet fallback
    }
  };

  useEffect(() => {
    fetchTriggers();
  }, [selectedServer?.uuid]);

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName) return;

    addSchedule({
      name: taskName,
      cron: cronExpression,
      description: taskDescription || `Automated job running on ${cronExpression}`,
      isActive: true,
      nextRun: 'Calculated by cron engine',
      actions: ['Command Trigger', 'Notification Log'],
    });

    setIsModalOpen(false);
    setTaskName('');
    setTaskDescription('');
  };

  const handleTestTrigger = async (rule: EventTriggerRule) => {
    if (!selectedServer?.uuid) return;
    try {
      setTestingTriggerId(rule.id);
      const res = await api.automation.testTrigger(selectedServer.uuid, rule.id);
      addToast({
        title: language === 'de' ? 'Aktionskette ausgeführt' : 'Event Chain Triggered',
        description: res.message || 'Alle verketteten Schritte durchlaufen.',
        type: 'success',
      });
      fetchTriggers();
    } catch (err: any) {
      addToast({
        title: 'Fehler',
        description: err.message || 'Trigger Test fehlgeschlagen.',
        type: 'error',
      });
    } finally {
      setTestingTriggerId(null);
    }
  };

  const handleCreateTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer?.uuid || !newTriggerName.trim()) return;

    let defaultActions: EventActionStep[] = [];
    if (newTriggerChainPreset === 'crash_restart') {
      defaultActions = [
        { type: 'discord', target: 'Crash-Summary', description: 'Discord Alert senden' },
        { type: 'delay', target: '3', description: 'Warte 3s' },
        { type: 'power', target: 'restart', description: 'Container neu starten' },
      ];
    } else if (newTriggerChainPreset === 'ram_heapdump') {
      defaultActions = [
        { type: 'discord', target: 'High RAM Alert', description: 'Admin-Warnung' },
        { type: 'heapdump', target: 'heapdump.hprof', description: 'JVM Heap-Dump sichern' },
        { type: 'command', target: 'broadcast Server Wartungsneustart in 30s', description: 'Spieler benachrichtigen' },
      ];
    } else if (newTriggerChainPreset === 'backup_hibernate') {
      defaultActions = [
        { type: 'command', target: 'save-all', description: 'save-all' },
        { type: 'delay', target: '5', description: 'Warte 5s' },
        { type: 'backup', target: 'Zero-Players-Auto-Backup', description: 'Backup erstellen' },
        { type: 'power', target: 'stop', description: 'Sleep-Modus aktivieren' },
      ];
    } else {
      defaultActions = [
        { type: 'command', target: 'say Automated Event Chain Started', description: 'Chat Broadcast' },
        { type: 'delay', target: '2', description: 'Warte 2s' },
      ];
    }

    try {
      const res = await api.automation.createTrigger(selectedServer.uuid, {
        name: newTriggerName.trim(),
        event_type: newTriggerEvent,
        condition_text: newTriggerCondition.trim() || 'Benutzerdefinierte Bedingung',
        webhook_url: newTriggerWebhook.trim(),
        is_enabled: true,
        actions: defaultActions,
      });

      addToast({
        title: language === 'de' ? 'Event-Trigger erstellt' : 'Event Trigger Created',
        description: res.message || 'Trigger erfolgreich gespeichert.',
        type: 'success',
      });

      setIsNewTriggerModalOpen(false);
      setNewTriggerName('');
      setNewTriggerCondition('');
      setNewTriggerWebhook('');
      fetchTriggers();
    } catch (err: any) {
      addToast({
        title: 'Fehler',
        description: err.message || 'Konnte Trigger nicht anlegen.',
        type: 'error',
      });
    }
  };

  const handleConfirmDeleteTrigger = async () => {
    if (!selectedServer?.uuid || !deleteTargetTrigger) return;
    setIsDeletingTrigger(true);
    const targetId = deleteTargetTrigger.id;
    try {
      // Optimistic instant UI removal
      setTriggers((prev) => prev.filter((t) => t.id !== targetId));
      await api.automation.deleteTrigger(selectedServer.uuid, targetId);
      addToast({
        title: language === 'de' ? 'Trigger gelöscht' : 'Trigger Deleted',
        description:
          language === 'de'
            ? 'Der Automations-Trigger wurde dauerhaft gelöscht.'
            : 'Automation trigger deleted successfully.',
        type: 'info',
      });
      setDeleteTargetTrigger(null);
      fetchTriggers();
    } catch (e: any) {
      addToast({
        title: language === 'de' ? 'Fehler beim Löschen' : 'Deletion Error',
        description: e.message || 'Trigger konnte nicht gelöscht werden.',
        type: 'error',
      });
      fetchTriggers();
    } finally {
      setIsDeletingTrigger(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* ── Mode Switcher & Top Header ── */}
      <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0d1117] p-1 rounded-xl border border-slate-800 font-mono text-xs">
            <button
              onClick={() => setActiveMode('events')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
                activeMode === 'events'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Smart Event-Chains (No-Code)</span>
            </button>
            <button
              onClick={() => setActiveMode('cron')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
                activeMode === 'cron'
                  ? 'bg-white text-zinc-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Cron Schedules</span>
            </button>
          </div>
        </div>

        <div>
          {activeMode === 'events' ? (
            <button
              onClick={() => setIsNewTriggerModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Neuer Event-Trigger</span>
            </button>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Schedule</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Mode 1: Smart Webhook-Trigger & Event-Chains (No-Code Automation) ── */}
      {activeMode === 'events' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/25 text-xs font-mono text-amber-300 flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-0.5">
                {language === 'de' ? 'Ereignisgesteuerte Automation' : 'Event-Driven Reactive Automation'}
              </p>
              <p className="text-slate-300">
                {language === 'de'
                  ? 'Reagiert in Echtzeit auf Server-Crashes, RAM-Peaks über 90 % und 0-Spieler-Inaktivität. Führt verkettete Aktionen nacheinander mit Pausen aus (z. B. save-all → 5s Pause → Backup → Stop).'
                  : 'Reacts in real-time to crashes, high RAM spikes, and zero-player idle states. Executes chained action steps sequentially.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {triggers.map((rule) => (
              <div
                key={rule.id}
                className="cyber-glass rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all shadow-md font-mono text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{rule.name}</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                        {rule.event_type}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        AKTIV
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1">Bedingung: {rule.condition_text}</p>
                    {rule.webhook_url && (
                      <p className="text-slate-500 text-[11px] mt-0.5 truncate max-w-lg">
                        Alert-Webhook: {rule.webhook_url}
                      </p>
                    )}
                  </div>

                  {/* Actions & Test run */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTestTrigger(rule)}
                      disabled={testingTriggerId === rule.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold transition-all active:scale-95 disabled:opacity-50"
                      title={language === 'de' ? 'Simuliert den Event-Trigger und führt alle Ketten-Aktionen aus' : 'Simulate event trigger and run chained actions'}
                    >
                      {testingTriggerId === rule.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          <span>{language === 'de' ? 'Führe aus...' : 'Running...'}</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-amber-400" />
                          <span>{language === 'de' ? 'Kette testen' : 'Test Chain'}</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteTargetTrigger(rule)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title={language === 'de' ? 'Löschen' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chained Action Visual Steps */}
                <div className="p-3 rounded-xl bg-[#0a0e17] border border-slate-800/80 mt-3">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">
                    {language === 'de'
                      ? `Verkettete Aktionsfolge (${rule.actions.length} Schritte nacheinander):`
                      : `Chained Action Sequence (${rule.actions.length} sequential steps):`}
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap sm:flex-nowrap">
                    {rule.actions.map((act, idx) => (
                      <React.Fragment key={idx}>
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white flex items-center gap-1.5 shrink-0 shadow-sm">
                          {act.type === 'command' && <Terminal className="w-3 h-3 text-cyan-400" />}
                          {act.type === 'delay' && <Clock className="w-3 h-3 text-amber-400" />}
                          {act.type === 'power' && <Zap className="w-3 h-3 text-emerald-400" />}
                          {act.type === 'backup' && <HardDrive className="w-3 h-3 text-purple-400" />}
                          {act.type === 'discord' && <Bell className="w-3 h-3 text-indigo-400" />}
                          {act.type === 'heapdump' && <Cpu className="w-3 h-3 text-rose-400" />}
                          <span>{act.description || act.target}</span>
                        </div>
                        {idx < rule.actions.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-800/60">
                  <span>Ausführungen: {rule.execution_count}x</span>
                  <span>Zuletzt ausgelöst: {rule.last_triggered || 'Noch nie'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Mode 2: Traditional Cron Schedules ── */}
      {activeMode === 'cron' && (
        <div className="grid grid-cols-1 gap-3 font-mono text-xs">
          {schedules.map((sch) => (
            <div
              key={sch.id}
              className={`cyber-glass rounded-2xl p-4 sm:p-5 border transition-all ${
                sch.isActive ? 'border-slate-800' : 'border-slate-800/40 opacity-75'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="text-sm font-bold text-white font-mono">{sch.name}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-zinc-300 border border-slate-700">
                      {sch.cron}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        sch.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {sch.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{sch.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => triggerScheduleNow(sch.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-semibold transition-all active:scale-95"
                    title="Trigger immediately"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Now</span>
                  </button>
                  <button
                    onClick={() => toggleSchedule(sch.id)}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold border transition-all active:scale-95 ${
                      sch.isActive
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    {sch.isActive ? 'Pause' : 'Activate'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                <span>Nächster Lauf: {sch.nextRun}</span>
                <span>Aktionen: {sch.actions?.length || 2} Jobs</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Event Trigger Modal */}
      <Modal
        isOpen={isNewTriggerModalOpen}
        onClose={() => setIsNewTriggerModalOpen(false)}
        title={language === 'de' ? 'Neuen Smart Webhook-Trigger erstellen' : 'Create Smart Webhook Trigger'}
      >
        <form onSubmit={handleCreateTrigger} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              {language === 'de' ? 'Name des Triggers' : 'Trigger Name'}
            </label>
            <input
              type="text"
              required
              placeholder={language === 'de' ? 'z. B. Auto-Recovery bei Crash' : 'e.g. Crash Auto-Recovery'}
              value={newTriggerName}
              onChange={(e) => setNewTriggerName(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              {language === 'de' ? 'Ereignis-Bedingung' : 'Event Condition'}
            </label>
            <select
              value={newTriggerEvent}
              onChange={(e) => setNewTriggerEvent(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            >
              <option value="server_crash">
                {language === 'de' ? 'Server crasht (Exit-Code != 0)' : 'Server crashes (Exit code != 0)'}
              </option>
              <option value="ram_exceeded">
                {language === 'de' ? 'RAM-Auslastung > 90 % für 5 Minuten' : 'RAM usage > 90% for 5 minutes'}
              </option>
              <option value="players_zero">
                {language === 'de' ? 'Spielerzahl fällt auf 0 (Inaktivität)' : 'Player count drops to 0 (Idle)'}
              </option>
              <option value="tps_drop">
                {language === 'de' ? 'TPS fallen unter 12 für > 15 Sekunden' : 'TPS drops below 12 for > 15 seconds'}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              {language === 'de' ? 'Aktionsketten-Vorlage' : 'Action Chain Template'}
            </label>
            <select
              value={newTriggerChainPreset}
              onChange={(e) => setNewTriggerChainPreset(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            >
              <option value="crash_restart">
                {language === 'de'
                  ? 'Discord Crash-Alert → 3s warten → Auto-Restart Container'
                  : 'Discord Crash Alert → Wait 3s → Auto-Restart Container'}
              </option>
              <option value="ram_heapdump">
                {language === 'de'
                  ? 'Admin Discord-Warnung → JVM Heap-Dump erstellen → Chat Broadcast'
                  : 'Admin Discord Alert → JVM Heap Dump → Chat Broadcast'}
              </option>
              <option value="backup_hibernate">
                {language === 'de'
                  ? 'save-all → 5s warten → Backup erstellen → Server in Ruhezustand stoppen'
                  : 'save-all → Wait 5s → Create Backup → Stop Server into Hibernate'}
              </option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Discord / Slack Webhook URL (Optional)</label>
            <input
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={newTriggerWebhook}
              onChange={(e) => setNewTriggerWebhook(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewTriggerModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-all shadow-md active:scale-95"
            >
              {language === 'de' ? 'Trigger speichern' : 'Save Trigger'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cron Schedule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={language === 'de' ? 'Neuen Cron-Zeitplan erstellen' : 'Create New Cron Schedule'}
      >
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
              {language === 'de' ? 'Zeitplan Name' : 'Schedule Name'}
            </label>
            <input
              type="text"
              required
              placeholder={language === 'de' ? 'z. B. Täglicher Wartungs-Neustart' : 'Daily Maintenance Restart'}
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
              {language === 'de' ? 'Cron Ausdruck' : 'Cron Expression'}
            </label>
            <input
              type="text"
              required
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
            >
              {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs"
            >
              {language === 'de' ? 'Zeitplan anlegen' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cyber-Glass Delete Modal for Event Triggers */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetTrigger}
        onClose={() => setDeleteTargetTrigger(null)}
        onConfirm={handleConfirmDeleteTrigger}
        title={language === 'de' ? 'Event-Trigger löschen' : 'Delete Event Trigger'}
        itemName={deleteTargetTrigger?.name}
        description={
          language === 'de'
            ? `Möchtest du die Automations-Regel "${deleteTargetTrigger?.name}" wirklich dauerhaft löschen?`
            : `Are you sure you want to permanently delete the automation trigger rule "${deleteTargetTrigger?.name}"?`
        }
        isDeleting={isDeletingTrigger}
      />
    </div>
  );
};
