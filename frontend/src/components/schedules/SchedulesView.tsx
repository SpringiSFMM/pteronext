import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CalendarClock, Play, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';

export const SchedulesView: React.FC = () => {
  const { schedules, toggleSchedule, triggerScheduleNow, addSchedule } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [cron, setCron] = useState('0 */6 * * *');
  const [description, setDescription] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cron) return;
    addSchedule({
      name,
      cron,
      description,
      isActive: true,
      nextRun: 'In 6 hours',
      actions: ['execute_command: save-all', 'backup: create'],
    });
    setName('');
    setDescription('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Schedules & Automation
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Automated cluster tasks, scheduled cron backups, and maintenance routines.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Schedule</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((sch) => (
          <div
            key={sch.id}
            className={`p-4 sm:p-5 rounded-xl border bg-[#161b22] transition-colors flex flex-col justify-between ${
              sch.isActive ? 'border-[#30363d] hover:border-[#484f58]' : 'border-[#30363d]/50 opacity-70'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white font-sans">{sch.name}</h3>
                  <span className="inline-block mt-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[#0d1117] text-slate-300 border border-[#30363d]">
                    {sch.cron}
                  </span>
                </div>
                <button
                  onClick={() => toggleSchedule(sch.id)}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                    sch.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {sch.isActive ? 'Active' : 'Paused'}
                </button>
              </div>

              <p className="text-xs text-slate-400 mt-1">{sch.description}</p>

              <div className="mt-4 pt-3 border-t border-[#30363d]/80 space-y-1.5 text-xs font-mono text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Last Run:</span>
                  <span className="text-slate-300">{sch.lastRun || 'Never'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Next Run:</span>
                  <span className="text-emerald-400">{sch.nextRun}</span>
                </div>
              </div>

              {sch.actions && sch.actions.length > 0 && (
                <div className="mt-3 pt-2 border-t border-[#30363d]/60">
                  <span className="text-[10px] uppercase font-mono text-slate-500">Actions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sch.actions.map((act, i) => (
                      <span key={i} className="text-[10px] font-mono bg-[#0d1117] text-slate-400 px-1.5 py-0.5 rounded border border-[#30363d]">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#30363d] flex items-center justify-end">
              <button
                onClick={() => triggerScheduleNow(sch.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] text-xs font-medium transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Now</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Automated Schedule"
        subtitle="Configure cron triggers for automated backups and tasks"
        icon={<CalendarClock className="w-4 h-4 text-amber-400" />}
        badge="AUTOMATION"
        badgeColor="amber"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Schedule Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Daily World Backup"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Cron Expression
            </label>
            <input
              type="text"
              required
              placeholder="0 4 * * *"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
            />
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Syntax: min hour day month weekday (e.g. 0 0 * * * = midnight daily)
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="What this schedule does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-sans"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-xs transition-colors"
            >
              Create Schedule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
