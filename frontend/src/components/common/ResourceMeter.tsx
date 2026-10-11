import React from 'react';

interface ResourceMeterProps {
  label: string;
  value: number; // percentage or absolute value
  max?: number; // if specified, percentage is value/max * 100
  unit?: string;
  displayValue?: string;
  icon?: React.ReactNode;
  variant?: 'neutral' | 'emerald' | 'amber' | 'rose' | 'auto';
  size?: 'sm' | 'md';
}

export const ResourceMeter: React.FC<ResourceMeterProps> = ({
  label,
  value,
  max,
  unit = '%',
  displayValue,
  icon,
  variant = 'auto',
  size = 'md',
}) => {
  const percentage = max ? Math.min(100, Math.max(0, (value / max) * 100)) : Math.min(100, Math.max(0, value));

  let colorScheme = {
    bar: 'bg-zinc-300',
    text: 'text-zinc-200',
  };

  if (variant === 'auto') {
    if (percentage > 85) {
      colorScheme = {
        bar: 'bg-rose-500',
        text: 'text-rose-400',
      };
    } else if (percentage > 70) {
      colorScheme = {
        bar: 'bg-amber-500',
        text: 'text-amber-400',
      };
    } else {
      colorScheme = {
        bar: 'bg-emerald-500',
        text: 'text-emerald-400',
      };
    }
  } else if (variant === 'emerald') {
    colorScheme = {
      bar: 'bg-emerald-500',
      text: 'text-emerald-400',
    };
  } else if (variant === 'amber') {
    colorScheme = {
      bar: 'bg-amber-500',
      text: 'text-amber-400',
    };
  } else if (variant === 'rose') {
    colorScheme = {
      bar: 'bg-rose-500',
      text: 'text-rose-400',
    };
  } else if (variant === 'neutral') {
    colorScheme = {
      bar: 'bg-zinc-400',
      text: 'text-zinc-300',
    };
  }

  const formattedDisplay =
    displayValue !== undefined
      ? displayValue
      : max
      ? `${Math.round(value)} / ${max} ${unit}`
      : `${percentage.toFixed(1)}${unit}`;

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span>{label}</span>
        </div>
        <span className={`font-mono text-xs font-medium ${colorScheme.text}`}>
          {formattedDisplay}
        </span>
      </div>

      <div
        className={`w-full bg-[#21262d] rounded-full overflow-hidden ${
          size === 'sm' ? 'h-1.5' : 'h-2'
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorScheme.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
