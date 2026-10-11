import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 md:px-0">
      {toasts.map((toast) => {
        let borderClass = 'border-[#30363d]';
        let icon = <Info className="w-4 h-4 text-slate-400 shrink-0" />;

        if (toast.type === 'success') {
          borderClass = 'border-emerald-500/40';
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
        } else if (toast.type === 'warning') {
          borderClass = 'border-amber-500/40';
          icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
        } else if (toast.type === 'error') {
          borderClass = 'border-rose-500/40';
          icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-[#1c2128] border ${borderClass} shadow-xl transition-all duration-200`}
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-medium text-white tracking-tight">
                {toast.title}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed break-words">
                {toast.description}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-[#21262d]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
