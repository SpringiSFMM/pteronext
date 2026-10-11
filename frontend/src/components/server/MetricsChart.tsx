import React, { useState, useMemo } from 'react';
import { MetricsHistoryPoint } from './types';
import { Sparkline } from './Sparkline';
import { formatBytes } from './utils';
import { Cpu, HardDrive, Activity, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface MetricsChartProps {
  history: MetricsHistoryPoint[];
  className?: string;
}

type MetricMode = 'cpu' | 'memory' | 'network' | 'disk';

export const MetricsChart: React.FC<MetricsChartProps> = ({
  history,
  className = '',
}) => {
  const [mode, setMode] = useState<MetricMode>('cpu');

  const { data, labels, unit, color, min, max, currentVal, avgVal, peakVal } = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        data: [],
        labels: [],
        unit: '',
        color: 'neutral' as const,
        min: 0,
        max: 100,
        currentVal: '0',
        avgVal: '0',
        peakVal: '0',
      };
    }

    const labels = history.map((h) => h.time);

    if (mode === 'cpu') {
      const data = history.map((h) => h.cpu);
      const current = data[data.length - 1] || 0;
      const peak = Math.max(...data, 0);
      const avg = data.reduce((a, b) => a + b, 0) / (data.length || 1);
      return {
        data,
        labels,
        unit: '%',
        color: 'neutral' as const,
        min: 0,
        max: 100,
        currentVal: `${current.toFixed(1)}%`,
        avgVal: `${avg.toFixed(1)}%`,
        peakVal: `${peak.toFixed(1)}%`,
      };
    }

    if (mode === 'memory') {
      const data = history.map((h) => h.memoryUsedMB);
      const limit = history[history.length - 1]?.memoryLimitMB || 4096;
      const current = data[data.length - 1] || 0;
      const peak = Math.max(...data, 0);
      const avg = data.reduce((a, b) => a + b, 0) / (data.length || 1);
      return {
        data,
        labels,
        unit: ' MB',
        color: 'emerald' as const,
        min: 0,
        max: limit,
        currentVal: `${(current / 1024).toFixed(2)} GB`,
        avgVal: `${(avg / 1024).toFixed(2)} GB`,
        peakVal: `${(peak / 1024).toFixed(2)} GB`,
      };
    }

    if (mode === 'network') {
      const data = history.map((h) => h.networkRxKB + h.networkTxKB);
      const current = data[data.length - 1] || 0;
      const peak = Math.max(...data, 0);
      const avg = data.reduce((a, b) => a + b, 0) / (data.length || 1);
      return {
        data,
        labels,
        unit: ' KB/s',
        color: 'violet' as const,
        min: 0,
        max: Math.max(peak * 1.25, 200),
        currentVal: formatBytes(current * 1024) + '/s',
        avgVal: formatBytes(avg * 1024) + '/s',
        peakVal: formatBytes(peak * 1024) + '/s',
      };
    }

    // Disk
    const data = history.map((h) => h.diskUsedMB);
    const limit = history[history.length - 1]?.diskLimitMB || 20480;
    const current = data[data.length - 1] || 0;
    const peak = Math.max(...data, 0);
    const avg = data.reduce((a, b) => a + b, 0) / (data.length || 1);
    return {
      data,
      labels,
      unit: ' MB',
      color: 'amber' as const,
      min: 0,
      max: limit,
      currentVal: `${(current / 1024).toFixed(2)} GB`,
      avgVal: `${(avg / 1024).toFixed(2)} GB`,
      peakVal: `${(peak / 1024).toFixed(2)} GB`,
    };
  }, [history, mode]);

  return (
    <div className={`p-4 rounded-xl border border-slate-800 bg-[#0d131f]/80 backdrop-blur-md shadow-lg ${className}`}>
      {/* Top Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 text-zinc-300">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Performance Timeline
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-zinc-300">
                LIVE
              </span>
            </h3>
            <p className="text-xs text-slate-400">High-resolution resource metrics history</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setMode('cpu')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
              mode === 'cpu'
                ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            CPU
          </button>
          <button
            type="button"
            onClick={() => setMode('memory')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
              mode === 'memory'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Memory
          </button>
          <button
            type="button"
            onClick={() => setMode('network')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
              mode === 'network'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Network
          </button>
          <button
            type="button"
            onClick={() => setMode('disk')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium ${
              mode === 'disk'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Disk
          </button>
        </div>
      </div>

      {/* Numerical Stats Summary Bar */}
      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 mb-3 text-xs font-mono">
        <div>
          <span className="text-[11px] text-slate-500 block uppercase">Current</span>
          <span className="text-sm font-semibold text-slate-100">{currentVal}</span>
        </div>
        <div>
          <span className="text-[11px] text-slate-500 block uppercase">Average</span>
          <span className="text-sm font-medium text-slate-300">{avgVal}</span>
        </div>
        <div>
          <span className="text-[11px] text-slate-500 block uppercase">Peak</span>
          <span className="text-sm font-medium text-white">{peakVal}</span>
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="relative pt-2 pb-1">
        <Sparkline
          data={data}
          labels={labels}
          unit={unit}
          color={color}
          height={96}
          min={min}
          max={max}
          filled={true}
          strokeWidth={2}
          showLatestDot={true}
        />

        {/* Timestamp Range Legend */}
        {labels.length > 0 && (
          <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-500">
            <span>{labels[0]}</span>
            <span>Live Window (~{labels.length * 1.5}s)</span>
            <span>{labels[labels.length - 1]}</span>
          </div>
        )}
      </div>
    </div>
  );
};
