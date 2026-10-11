import React, { useState } from 'react';
import { ServerStatus, PowerAction } from '../../types';
import { Play, Square, RotateCw, Skull, AlertTriangle, X } from 'lucide-react';
import { Modal } from '../common/Modal';

interface PowerButtonsProps {
  status: ServerStatus;
  onAction: (action: PowerAction) => void;
  disabled?: boolean;
  className?: string;
}

export const PowerButtons: React.FC<PowerButtonsProps> = ({
  status,
  onAction,
  disabled = false,
  className = '',
}) => {
  const [showKillModal, setShowKillModal] = useState(false);
  const [killConfirmed, setKillConfirmed] = useState(false);

  const isRunning = status === 'running';
  const isStarting = status === 'starting';
  const isStopped = status === 'stopped' || status === 'offline';

  const handleStart = () => {
    if (!disabled && isStopped) {
      onAction('start');
    }
  };

  const handleStop = () => {
    if (!disabled && (isRunning || isStarting)) {
      onAction('stop');
    }
  };

  const handleRestart = () => {
    if (!disabled && isRunning) {
      onAction('restart');
    }
  };

  const handleOpenKill = () => {
    if (!disabled && !isStopped) {
      setKillConfirmed(false);
      setShowKillModal(true);
    }
  };

  const handleConfirmKill = () => {
    setShowKillModal(false);
    onAction('kill');
  };

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {/* Start Button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={disabled || isRunning || isStarting}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
            isRunning || isStarting
              ? 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-60'
              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 hover:border-emerald-400 shadow-sm hover:shadow-emerald-500/20 active:scale-95'
          }`}
          title={isRunning ? 'Server already running' : 'Start Server'}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Start
        </button>

        {/* Restart Button */}
        <button
          type="button"
          onClick={handleRestart}
          disabled={disabled || isStopped}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
            isStopped
              ? 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-60'
              : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-400 shadow-sm hover:shadow-amber-500/20 active:scale-95'
          }`}
          title={isStopped ? 'Server is offline' : 'Restart Server'}
        >
          <RotateCw className="w-3.5 h-3.5" />
          Restart
        </button>

        {/* Stop Button */}
        <button
          type="button"
          onClick={handleStop}
          disabled={disabled || isStopped}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
            isStopped
              ? 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-60'
              : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-400 shadow-sm hover:shadow-amber-500/20 active:scale-95'
          }`}
          title={isStopped ? 'Server is offline' : 'Graceful Stop'}
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          Stop
        </button>

        {/* Kill Button (Red / Safety Guarded) */}
        <button
          type="button"
          onClick={handleOpenKill}
          disabled={disabled || isStopped}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
            isStopped
              ? 'bg-slate-800/60 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-60'
              : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 hover:border-rose-400 shadow-sm hover:shadow-rose-500/20 active:scale-95'
          }`}
          title="Force Kill Process (SIGKILL)"
        >
          <Skull className="w-3.5 h-3.5 text-rose-400" />
          Kill
        </button>
      </div>

      {/* Safety Confirmation Modal for KILL */}
      <Modal
        isOpen={showKillModal}
        onClose={() => setShowKillModal(false)}
        title="Confirm Force Kill"
        subtitle="Immediate ungraceful process termination (SIGKILL)"
        icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
        badge="SIGKILL"
        badgeColor="rose"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2 leading-relaxed">
            <p className="font-medium text-slate-200">
              Killing the server will immediately terminate the container process without allowing it to save current world state, unsaved player data, or flush file buffers.
            </p>
            <p className="text-amber-400 font-medium flex items-center gap-1.5 pt-1 border-t border-rose-500/20">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                This may cause unrecoverable file corruption. Only proceed if the server is completely frozen or unresponsive.
              </span>
            </p>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-[#212836] cursor-pointer select-none hover:bg-white/[0.04] transition-colors">
            <input
              type="checkbox"
              checked={killConfirmed}
              onChange={(e) => setKillConfirmed(e.target.checked)}
              className="w-4 h-4 rounded border-[#30363d] text-rose-500 focus:ring-rose-500 bg-[#0d1117]"
            />
            <span className="text-xs text-slate-300 font-medium">
              I understand the risk of permanent data corruption
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#212836]">
            <button
              type="button"
              onClick={() => setShowKillModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmKill}
              disabled={!killConfirmed}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                killConfirmed
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 active:scale-95'
                  : 'bg-rose-950/40 text-rose-400/40 border border-rose-900/30 cursor-not-allowed'
              }`}
            >
              <Skull className="w-3.5 h-3.5" />
              <span>Force Kill Process</span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
