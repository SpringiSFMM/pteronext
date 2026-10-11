import React, { useState } from 'react';
import { QuickShortcut } from './types';
import { Sparkles, Plus, X, Command, SlidersHorizontal } from 'lucide-react';

interface QuickShortcutsProps {
  onExecute: (command: string) => void;
  serverUuid?: string;
  className?: string;
}

const DEFAULT_SHORTCUTS: QuickShortcut[] = [
  { id: '1', label: 'help', command: 'help', category: 'general' },
  { id: '2', label: 'status', command: 'status', category: 'general' },
  { id: '3', label: 'list players', command: 'list', category: 'general' },
  { id: '4', label: 'save-all', command: 'save-all', category: 'ops' },
  { id: '5', label: 'tps / tickrate', command: 'tps', category: 'ops' },
  { id: '6', label: 'reload configs', command: 'reload', category: 'admin' },
  { id: '7', label: 'broadcast reboot (5m)', command: 'say Server restart in 5 minutes!', category: 'admin' },
  { id: '8', label: 'version info', command: 'version', category: 'general' },
];

export const QuickShortcuts: React.FC<QuickShortcutsProps> = ({
  onExecute,
  serverUuid = 'default',
  className = '',
}) => {
  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>(() => {
    try {
      const stored = localStorage.getItem(`ptero_custom_shortcuts_${serverUuid}`);
      if (stored) {
        return [...DEFAULT_SHORTCUTS, ...JSON.parse(stored)];
      }
    } catch {}
    return DEFAULT_SHORTCUTS;
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCommand, setNewCommand] = useState('');

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newCommand.trim()) return;

    const item: QuickShortcut = {
      id: `custom-${Date.now()}`,
      label: newLabel.trim(),
      command: newCommand.trim(),
      category: 'custom',
    };

    const customOnly = shortcuts.filter((s) => s.category === 'custom');
    const updatedCustom = [...customOnly, item];

    try {
      localStorage.setItem(`ptero_custom_shortcuts_${serverUuid}`, JSON.stringify(updatedCustom));
    } catch {}

    setShortcuts([...DEFAULT_SHORTCUTS, ...updatedCustom]);
    setNewLabel('');
    setNewCommand('');
    setIsAdding(false);
  };

  const handleRemoveCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = shortcuts.filter((s) => s.id !== id);
    const customOnly = updated.filter((s) => s.category === 'custom');

    try {
      localStorage.setItem(`ptero_custom_shortcuts_${serverUuid}`, JSON.stringify(customOnly));
    } catch {}

    setShortcuts(updated);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Shortcut Chips Bar with horizontal swipe on mobile */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-1 pr-2 shrink-0 select-none">
          <Command className="w-3 h-3 text-zinc-400" />
          <span>Quick:</span>
        </div>

        {shortcuts.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => onExecute(sc.command)}
            className="group shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-zinc-600 text-slate-300 hover:text-white transition-all active:scale-95 shadow-sm"
            title={`Run: ${sc.command}`}
          >
            <span>{sc.label}</span>
            {sc.category === 'custom' && (
              <span
                onClick={(e) => handleRemoveCustom(sc.id, e)}
                className="opacity-40 group-hover:opacity-100 hover:text-rose-400 transition-opacity ml-0.5 p-0.5 rounded"
              >
                <X className="w-2.5 h-2.5" />
              </span>
            )}
          </button>
        ))}

        {/* Add Custom Shortcut Button */}
        {!isAdding ? (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-white/[0.05] hover:bg-white/10 border border-white/10 text-zinc-300 transition-colors"
            title="Add Custom Command Shortcut"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Add</span>
          </button>
        ) : null}
      </div>

      {/* Mini Inline Creator Modal / Dropdown */}
      {isAdding && (
        <form
          onSubmit={handleAddCustom}
          className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-900/95 border border-white/15 text-xs animate-in fade-in"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
            <input
              type="text"
              placeholder="Label (e.g. reload)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-zinc-500"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-1.5 flex-2 min-w-[180px]">
            <input
              type="text"
              placeholder="Command (e.g. /reload all)"
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-white text-zinc-950 font-bold hover:bg-zinc-200 transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
