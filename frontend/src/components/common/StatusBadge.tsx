import React from 'react';
import { ServerStatus } from '../../types';

interface StatusBadgeProps {
  status: ServerStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  const getStatusConfig = () => {
    const s = (status || 'offline').toLowerCase();
    switch (s) {
      case 'running':
        return {
          dotBg: 'bg-[#10b981]',
          badgeBg: 'bg-[#10b981]/10 text-emerald-300 border-[#10b981]/25',
          label: 'Running',
        };
      case 'starting':
        return {
          dotBg: 'bg-[#f59e0b]',
          badgeBg: 'bg-[#f59e0b]/10 text-amber-300 border-[#f59e0b]/25',
          label: 'Starting',
        };
      case 'stopping':
        return {
          dotBg: 'bg-[#f97316]',
          badgeBg: 'bg-[#f97316]/10 text-orange-300 border-[#f97316]/25',
          label: 'Stopping',
        };
      case 'installing':
        return {
          dotBg: 'bg-[#3b82f6]',
          badgeBg: 'bg-[#3b82f6]/10 text-blue-300 border-[#3b82f6]/25',
          label: 'Installing',
        };
      case 'suspended':
        return {
          dotBg: 'bg-[#a855f7]',
          badgeBg: 'bg-[#a855f7]/10 text-purple-300 border-[#a855f7]/25',
          label: 'Suspended',
        };
      case 'stopped':
        return {
          dotBg: 'bg-[#64748b]',
          badgeBg: 'bg-[#64748b]/10 text-slate-400 border-slate-700/60',
          label: 'Stopped',
        };
      case 'offline':
      default:
        return {
          dotBg: 'bg-[#ef4444]',
          badgeBg: 'bg-[#ef4444]/10 text-rose-300 border-rose-500/25',
          label: status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'Offline',
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-0.5 gap-2',
    lg: 'text-sm px-3 py-1 gap-2.5',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${sizeClasses[size]} ${config.badgeBg}`}
    >
      <span className={`inline-block rounded-full shrink-0 ${dotSizes[size]} ${config.dotBg}`} />
      {showLabel && <span className="tracking-normal font-sans">{config.label}</span>}
    </span>
  );
};
