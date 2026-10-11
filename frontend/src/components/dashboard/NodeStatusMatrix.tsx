import React from 'react';
import { useApp } from '../../context/AppContext';
import { Radio, Wifi, Server, Cpu, HardDrive, ShieldCheck, ArrowUpRight, Activity } from 'lucide-react';

export const NodeStatusMatrix: React.FC = () => {
  const { nodes, setActiveView } = useApp();

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
                {nodes.length} {nodes.length === 1 ? 'Node Online' : 'Nodes Online'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Compute virtualization daemons running Wings
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveView('admin-nodes')}
          className="text-xs font-mono font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1 hover:underline"
        >
          <span>Manage Nodes</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {nodes.length === 0 ? (
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
        <div className={`grid ${nodes.length > 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-3.5`}>
          {nodes.map((node) => (
            <div
              key={node.id}
              className="p-4 rounded-xl bg-[#0d1117]/80 border border-slate-800 hover:border-slate-700 transition-all group space-y-3.5 glass-card-interactive"
            >
              {/* Node Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 shadow-inner">
                    {node.flag || 'DE'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {node.name}
                      </h4>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate" title={node.location}>
                      {node.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    <Wifi className="w-3 h-3" />
                    <span className="font-semibold">{node.latencyMs}ms</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-[#161b22] px-2 py-1 rounded-lg border border-slate-800">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>TLS 1.3</span>
                  </div>
                </div>
              </div>

              {/* Resource Utilization Cards */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2.5 rounded-xl bg-[#161b22]/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>CPU</span>
                    <Cpu className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-white font-bold text-xs">{node.cpuUsage}%</div>
                  <div className="w-full bg-[#0d1117] rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, node.cpuUsage))}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#161b22]/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>RAM</span>
                    <HardDrive className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-white font-bold text-xs">{node.ramUsage}%</div>
                  <div className="w-full bg-[#0d1117] rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, node.ramUsage))}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#161b22]/70 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>INSTANCES</span>
                    <Server className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-white font-bold text-xs">{node.activeServers} srv</div>
                  <div className="w-full bg-[#0d1117] rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(10, node.activeServers * 20))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Node Footer / Status details */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-mono border-t border-slate-800/60">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span>Wings Daemon Active</span>
                </span>
                <span className="text-slate-500 text-[10px]">Docker Containerized</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
