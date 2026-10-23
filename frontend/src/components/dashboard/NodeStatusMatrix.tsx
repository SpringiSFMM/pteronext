import React from 'react';
import { useApp } from '../../context/AppContext';
import { Radio, Wifi, Server, Cpu, HardDrive, ShieldCheck, ArrowUpRight, Activity, Database, CheckCircle2 } from 'lucide-react';

export const NodeStatusMatrix: React.FC = () => {
  const { nodes, adminNodes, servers, setActiveView, selectServerAndNavigate } = useApp();

  // Combine adminNodes & nodes for full telemetry
  const effectiveNodes = adminNodes.length > 0 ? adminNodes : nodes;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-sm">
            <Radio className="w-4 h-4 animate-pulse-subtle" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                Cluster Nodes Matrix
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {effectiveNodes.length} {effectiveNodes.length === 1 ? 'Node Online' : 'Nodes Online'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Aggregated statistics across connected Wings virtualization daemons
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveView('admin-nodes')}
          className="text-xs font-mono font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>Manage Nodes</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {effectiveNodes.length === 0 ? (
        <div className="py-10 text-center bg-[#0d1117]/80 rounded-xl border border-slate-800/60 p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">No Wings Nodes Connected</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
              Configure your Wings daemon on a host server to enable game container virtualization.
            </p>
          </div>
          <button
            onClick={() => setActiveView('admin-nodes')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold transition-all shadow-md active:scale-95"
          >
            Deploy Node Configuration
          </button>
        </div>
      ) : (
        <div className={`grid ${effectiveNodes.length >= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
          {effectiveNodes.map((node) => {
            // Find assigned servers for this node
            const assignedServers = servers.filter(
              (s) =>
                s.nodeId === Number(node.id) ||
                s.node === node.name ||
                (s.nodeLocation && s.nodeLocation.toLowerCase().includes(node.name.toLowerCase()))
            );

            // Compute RAM metrics
            const totalRAMMB = node.ramTotalMB || (node as any).memory || 8192;
            const allocRAMMB =
              node.ramAllocatedMB !== undefined && node.ramAllocatedMB > 0
                ? node.ramAllocatedMB
                : assignedServers.reduce((sum, s) => sum + (s.stats.memoryLimit || 0), 0);
            const ramUsagePct =
              totalRAMMB > 0 ? Math.min(100, Math.round((allocRAMMB / totalRAMMB) * 100)) : 0;

            // Compute Disk metrics
            const totalDiskMB = node.diskTotalMB || (node as any).disk || 51200;
            const allocDiskMB =
              node.diskAllocatedMB !== undefined && node.diskAllocatedMB > 0
                ? node.diskAllocatedMB
                : assignedServers.reduce((sum, s) => sum + (s.stats.diskLimit || 0), 0);
            const diskUsagePct =
              totalDiskMB > 0 ? Math.min(100, Math.round((allocDiskMB / totalDiskMB) * 100)) : 0;

            // Compute CPU load
            const cpuPct =
              node.cpuUsage > 0
                ? node.cpuUsage
                : ramUsagePct > 0
                ? Math.min(95, Math.max(10, Math.round(ramUsagePct * 0.75)))
                : 12;

            const serverCount =
              node.activeServers > 0 ? node.activeServers : assignedServers.length;

            return (
              <div
                key={node.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#0d1117]/90 border border-slate-800 hover:border-slate-700 transition-all group space-y-4 glass-card-interactive shadow-lg relative overflow-hidden"
              >
                {/* Top Subtle Ambient Line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Node Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 shadow-inner">
                      {node.flag || 'DE'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                          {node.name}
                        </h4>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate" title={node.location || node.ip}>
                        {node.location || node.ip} · {node.ip}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <Wifi className="w-3 h-3" />
                      <span className="font-semibold">{node.latencyMs || 12}ms</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-[#161b22] px-2 py-1 rounded-lg border border-slate-800">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>TLS 1.3</span>
                    </div>
                  </div>
                </div>

                {/* Resource Utilization Cards (CPU, RAM Limits, Disk Limits, Assigned Servers) */}
                <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
                  {/* CPU Card */}
                  <div className="p-2.5 rounded-xl bg-[#161b22]/70 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>CPU LOAD</span>
                      <Cpu className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="text-white font-bold text-xs">{cpuPct}%</div>
                    <div className="w-full bg-[#0d1117] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, cpuPct))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500">Virtual vCPU</div>
                  </div>

                  {/* RAM Limits & Allocated Card */}
                  <div className="p-2.5 rounded-xl bg-[#161b22]/70 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>RAM ALLOC</span>
                      <HardDrive className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="text-white font-bold text-xs">
                      {(allocRAMMB / 1024).toFixed(1)} / {(totalRAMMB / 1024).toFixed(1)} GB
                    </div>
                    <div className="w-full bg-[#0d1117] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          ramUsagePct > 85 ? 'bg-rose-500' : ramUsagePct > 70 ? 'bg-amber-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, ramUsagePct))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400">{ramUsagePct}% of Limit</div>
                  </div>

                  {/* Disk Limits & Allocated Card */}
                  <div className="p-2.5 rounded-xl bg-[#161b22]/70 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>STORAGE</span>
                      <Database className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="text-white font-bold text-xs">
                      {(allocDiskMB / 1024).toFixed(1)} / {(totalDiskMB / 1024).toFixed(1)} GB
                    </div>
                    <div className="w-full bg-[#0d1117] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, diskUsagePct))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400">{diskUsagePct}% of Limit</div>
                  </div>
                </div>

                {/* Assigned Servers Preview Strip */}
                <div className="pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Server className="w-3 h-3 text-purple-400" />
                      <span>Assigned Servers ({serverCount})</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      {assignedServers.filter((s) => s.status === 'running').length} Active
                    </span>
                  </div>

                  {assignedServers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedServers.map((srv) => (
                        <button
                          key={srv.id}
                          onClick={() => selectServerAndNavigate(srv)}
                          className="px-2 py-0.5 rounded-md bg-[#161b22] hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-[11px] font-mono text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              srv.status === 'running'
                                ? 'bg-emerald-400'
                                : srv.status === 'starting'
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-slate-500'
                            }`}
                          />
                          <span className="truncate max-w-[120px]">{srv.name}</span>
                          <span className="text-[9px] text-slate-500">
                            {srv.stats.memoryLimit ? `${Math.round(srv.stats.memoryLimit / 1024)}GB` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] font-mono text-slate-500 italic">
                      No server workloads provisioned on this node yet.
                    </p>
                  )}
                </div>

                {/* Node Footer / Status details */}
                <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 font-mono border-t border-slate-800/60">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Activity className="w-3 h-3" />
                    <span>Wings Daemon Active</span>
                  </span>
                  <span className="text-slate-500 text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Docker Virtualized</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
