import React from 'react';

interface ServerCardSkeletonProps {
  count?: number;
}

export const ServerCardSkeleton: React.FC<ServerCardSkeletonProps> = ({ count = 6 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`skeleton-card-${idx}`}
          className="rounded-2xl p-5 border border-[#30363d]/60 bg-[#161b22]/70 backdrop-blur-md flex flex-col justify-between animate-pulse relative overflow-hidden"
        >
          {/* Shimmer gradient line at top */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px] opacity-40"
            style={{
              background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
            }}
          />

          <div>
            {/* Top header skeleton */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-16 bg-[#21262d] rounded-md" />
                  <div className="h-3 w-24 bg-[#21262d]/70 rounded" />
                </div>
                <div className="h-5 w-40 bg-[#21262d] rounded-lg" />
                <div className="h-3 w-48 bg-[#21262d]/50 rounded" />
              </div>
              <div className="h-6 w-20 bg-[#21262d] rounded-full" />
            </div>

            {/* IP Pill Skeleton */}
            <div className="h-7 w-32 bg-[#0d1117] rounded-xl border border-[#30363d]/50 mb-4" />

            {/* Metrics meters skeleton */}
            <div className="space-y-3 pt-3 border-t border-[#30363d]/60 mb-4">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-[#21262d] rounded" />
                  <div className="h-3 w-10 bg-[#21262d] rounded" />
                </div>
                <div className="h-1.5 w-full bg-[#21262d] rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-indigo-500/30 rounded-full" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-[#21262d] rounded" />
                  <div className="h-3 w-14 bg-[#21262d] rounded" />
                </div>
                <div className="h-1.5 w-full bg-[#21262d] rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-indigo-500/30 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer controls skeleton */}
          <div className="pt-3 border-t border-[#30363d]/60 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-[#21262d]" />
              <div className="w-8 h-8 rounded-lg bg-[#21262d]" />
            </div>
            <div className="h-8 w-24 rounded-lg bg-[#21262d]" />
          </div>
        </div>
      ))}
    </>
  );
};

export const ServerTableRowSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={`skeleton-row-${idx}`} className="animate-pulse border-b border-[#30363d]/50">
          <td className="py-4 px-4">
            <div className="h-5 w-20 bg-[#21262d] rounded-full" />
          </td>
          <td className="py-4 px-4 space-y-1.5">
            <div className="h-4 w-32 bg-[#21262d] rounded" />
            <div className="h-3 w-20 bg-[#21262d]/60 rounded font-mono" />
          </td>
          <td className="py-4 px-4 space-y-1.5">
            <div className="h-5 w-28 bg-[#0d1117] border border-[#30363d] rounded" />
            <div className="h-3 w-16 bg-[#21262d]/50 rounded" />
          </td>
          <td className="py-4 px-4">
            <div className="h-4 w-12 bg-[#21262d] rounded font-mono" />
          </td>
          <td className="py-4 px-4">
            <div className="h-4 w-20 bg-[#21262d] rounded font-mono" />
          </td>
          <td className="py-4 px-4 text-right">
            <div className="h-7 w-8 bg-[#21262d] rounded-md inline-block" />
          </td>
        </tr>
      ))}
    </>
  );
};
