import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  color?: 'neutral' | 'emerald' | 'amber' | 'violet' | 'orange';
  progress?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  trend,
  color = 'neutral',
  progress,
}) => {
  const getProgressColor = () => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-500';
      case 'amber':
        return 'bg-amber-500';
      case 'violet':
        return 'bg-purple-400';
      case 'orange':
        return 'bg-orange-500';
      default:
        return 'bg-zinc-300';
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-[#484f58] transition-colors duration-150 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400 tracking-wide">
            {label}
          </span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#21262d] border border-[#30363d] text-slate-300">
            {icon}
          </div>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-sans tabular-nums">
            {value}
          </span>
          {subValue && (
            <span className="text-xs text-slate-400 font-normal">
              / {subValue}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3.5 pt-2">
        {progress !== undefined && (
          <div className="w-full bg-[#21262d] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {trend && (
          <div className="flex items-center gap-1.5 text-xs mt-1.5">
            <span
              className={`${
                trend.isNeutral
                  ? 'text-slate-400'
                  : trend.isPositive
                  ? 'text-emerald-400 font-medium'
                  : 'text-rose-400 font-medium'
              }`}
            >
              {trend.value}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
