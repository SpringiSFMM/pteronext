import React, { useId, useState } from 'react';

interface SparklineProps {
  data: number[];
  color?: 'neutral' | 'emerald' | 'amber' | 'rose' | 'violet' | 'orange';
  height?: number;
  min?: number;
  max?: number;
  filled?: boolean;
  strokeWidth?: number;
  showLatestDot?: boolean;
  unit?: string;
  labels?: string[];
  className?: string;
}

const COLOR_MAP = {
  neutral: {
    stroke: '#e4e4e7',
    fillStart: 'rgba(228, 228, 231, 0.25)',
    fillEnd: 'rgba(228, 228, 231, 0.0)',
    dot: '#ffffff',
  },
  orange: {
    stroke: '#f97316',
    fillStart: 'rgba(249, 115, 22, 0.35)',
    fillEnd: 'rgba(249, 115, 22, 0.0)',
    dot: '#fb923c',
  },
  emerald: {
    stroke: '#10b981',
    fillStart: 'rgba(16, 185, 129, 0.35)',
    fillEnd: 'rgba(16, 185, 129, 0.0)',
    dot: '#34d399',
  },
  amber: {
    stroke: '#f59e0b',
    fillStart: 'rgba(245, 158, 11, 0.35)',
    fillEnd: 'rgba(245, 158, 11, 0.0)',
    dot: '#fbbf24',
  },
  rose: {
    stroke: '#f43f5e',
    fillStart: 'rgba(244, 63, 94, 0.35)',
    fillEnd: 'rgba(244, 63, 94, 0.0)',
    dot: '#fb7185',
  },
  violet: {
    stroke: '#8b5cf6',
    fillStart: 'rgba(139, 92, 246, 0.35)',
    fillEnd: 'rgba(139, 92, 246, 0.0)',
    dot: '#a78bfa',
  },
};

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = 'neutral',
  height = 48,
  min: customMin,
  max: customMax,
  filled = true,
  strokeWidth = 2,
  showLatestDot = true,
  unit = '',
  labels = [],
  className = '',
}) => {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length < 2) {
    return (
      <div
        className={`w-full flex items-center justify-center text-xs text-slate-500 font-mono ${className}`}
        style={{ height }}
      >
        Waiting for telemetry...
      </div>
    );
  }

  const values = data;
  const dataMin = customMin !== undefined ? customMin : Math.min(...values);
  const dataMax = customMax !== undefined ? customMax : Math.max(...values);
  const range = dataMax - dataMin || 1;

  const width = 100;
  const paddingY = 4;
  const chartHeight = height - paddingY * 2;

  // Convert values to SVG coordinate points (x: 0..100, y: paddingY..height-paddingY)
  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const normalized = (val - dataMin) / range;
    const y = height - paddingY - normalized * chartHeight;
    return { x, y, val, label: labels[idx] };
  });

  // Build smooth bezier SVG path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const fillD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const theme = (color && COLOR_MAP[color]) || COLOR_MAP.neutral;
  const latestPoint = points[points.length - 1];
  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  return (
    <div
      className={`relative w-full select-none ${className}`}
      style={{ height }}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.fillStart} />
            <stop offset="100%" stopColor={theme.fillEnd} />
          </linearGradient>
        </defs>

        {/* Gradient Fill under curve */}
        {filled && <path d={fillD} fill={`url(#${gradientId})`} />}

        {/* Main Curve Stroke */}
        <path
          d={pathD}
          fill="none"
          stroke={theme.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Hover vertical guideline */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={0}
            x2={activePoint.x}
            y2={height}
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="1"
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Latest live point pulsing dot */}
        {showLatestDot && !activePoint && (
          <g>
            <circle
              cx={latestPoint.x}
              cy={latestPoint.y}
              r="3.5"
              fill={theme.dot}
            />
            <circle
              cx={latestPoint.x}
              cy={latestPoint.y}
              r="6.5"
              fill="none"
              stroke={theme.dot}
              strokeWidth="1"
              opacity="0.6"
              className="animate-ping"
            />
          </g>
        )}

        {/* Active hovered point dot */}
        {activePoint && (
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="4"
            fill={theme.dot}
            stroke="#080b11"
            strokeWidth="1.5"
          />
        )}

        {/* Interactive touch/mouse hit zones */}
        {points.map((p, idx) => (
          <rect
            key={idx}
            x={Math.max(0, p.x - width / points.length / 2)}
            y="0"
            width={width / points.length}
            height={height}
            fill="transparent"
            className="cursor-crosshair"
            onMouseEnter={() => setHoverIndex(idx)}
            onTouchStart={() => setHoverIndex(idx)}
          />
        ))}
      </svg>

      {/* Hover Floating Tooltip */}
      {activePoint && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1 text-[11px] font-mono rounded bg-slate-900/90 border border-slate-700 text-slate-100 shadow-xl backdrop-blur-md transform -translate-x-1/2 -top-8 whitespace-nowrap"
          style={{ left: `${activePoint.x}%` }}
        >
          <span className="font-semibold text-white">
            {activePoint.val}
            {unit}
          </span>
          {activePoint.label && (
            <span className="text-slate-400 ml-1.5 text-[10px]">({activePoint.label})</span>
          )}
        </div>
      )}
    </div>
  );
};
