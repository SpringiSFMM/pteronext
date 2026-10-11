import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
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
} from 'lucide-react';
import { Modal } from '../../common/Modal';

export const SchedulesTab: React.FC = () => {
  const { schedules, toggleSchedule, triggerScheduleNow, addSchedule, addToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 4 * * *');
  const [taskDescription, setTaskDescription] = useState('');

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

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-300" />
            <h3 className="text-sm font-semibold text-white font-mono uppercase">
              AUTOMATED CRON SCHEDULES
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Execute recurring maintenance, backups, and restarts automatically
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Schedule</span>
        </button>
      </div>

      {/* Schedules List */}
      <div className="grid grid-cols-1 gap-3">
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
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-zinc-200 border border-slate-800 font-semibold">
                    {sch.cron}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      sch.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {sch.isActive ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{sch.description}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start">
                <button
                  onClick={() => triggerScheduleNow(sch.id)}
                  title="Run Schedule Immediately"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-mono text-xs transition-colors active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Now</span>
                </button>

                <button
                  onClick={() => toggleSchedule(sch.id)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs border transition-colors ${
                    sch.isActive
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {sch.isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            {/* Sub details: Last run, Next run, Steps */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Last: <span className="text-slate-300">{sch.lastRun || 'Never'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Next: <span className="text-slate-300">{sch.nextRun}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px]">Tasks:</span>
                {sch.actions.map((act, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-300 border border-slate-800"
                  >
                    {act}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Schedule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Schedule Routine"
        subtitle="Define a recurring cron expression for automated container tasks"
        icon={<Clock className="w-4 h-4 text-amber-400" />}
        badge="CRON SCHEDULE"
        badgeColor="amber"
      >
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
              Task Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Weekly Server Maintenance Reboot"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
              Cron Expression
            </label>
            <input
              type="text"
              required
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[
                { label: 'Every Hour', exp: '0 * * * *' },
                { label: 'Daily @ 4 AM', exp: '0 4 * * *' },
                { label: 'Weekly (Sunday)', exp: '0 5 * * 0' },
                { label: 'Monthly', exp: '0 0 1 * *' },
              ].map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => setCronExpression(preset.exp)}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Explain the scheduled action..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs shadow-md active:scale-95"
            >
              Create Schedule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
