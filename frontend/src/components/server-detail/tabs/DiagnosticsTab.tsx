import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import { Modal } from '../../common/Modal';
import {
  Gauge,
  Activity,
  Radar,
  AlertTriangle,
  Flame,
  Clock,
  Cpu,
  Layers,
  MapPin,
  RefreshCw,
  Copy,
  Check,
  Download,
  Eye,
  Zap,
  Play,
  ShieldAlert,
  Sliders,
} from 'lucide-react';

interface HeatmapPoint {
  timestamp: number;
  tps: number;
  mspt: number;
  health: 'optimal' | 'warning' | 'critical';
}

interface RadarHotspot {
  id: string;
  world: string;
  chunk_x: number;
  chunk_z: number;
  block_x: number;
  block_z: number;
  count: number;
  type: string;
  severity: string;
  description: string;
  suspect_type: string;
}

interface LagDump {
  id: string;
  timestamp: string;
  duration_sec: number;
  average_tps: number;
  average_mspt: number;
  trigger: string;
  top_threads: Array<{ name: string; cpu_percent: number; activity: string }>;
  hotspots: string[];
}

export const DiagnosticsTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { t, language } = useTranslation();

  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [currentTps, setCurrentTps] = useState(20.0);
  const [currentMspt, setCurrentMspt] = useState(24.5);
  const [currentHealth, setCurrentHealth] = useState<'optimal' | 'warning' | 'critical'>('optimal');

  const [radarHotspots, setRadarHotspots] = useState<RadarHotspot[]>([]);
  const [radarSummary, setRadarSummary] = useState<any>(null);

  const [lagDumps, setLagDumps] = useState<LagDump[]>([]);
  const [selectedDump, setSelectedDump] = useState<LagDump | null>(null);
  const [isTriggeringDump, setIsTriggeringDump] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    if (!selectedServer?.uuid) return;
    try {
      const [hmRes, radRes, ldRes] = await Promise.all([
        api.diagnostics.getTpsHeatmap(selectedServer.uuid),
        api.diagnostics.getRadar(selectedServer.uuid),
        api.diagnostics.getLagDumps(selectedServer.uuid),
      ]);

      if (hmRes?.data) {
        setHeatmapData(hmRes.data as any);
        setCurrentTps(hmRes.current_tps);
        setCurrentMspt(hmRes.current_mspt);
        setCurrentHealth(hmRes.current_health as any);
      }
      if (radRes?.hotspots) {
        setRadarHotspots(radRes.hotspots);
        setRadarSummary(radRes.summary);
      }
      if (ldRes?.dumps) {
        setLagDumps(ldRes.dumps);
      }
    } catch (e) {
      // quiet fallback
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 3000);
    return () => clearInterval(interval);
  }, [selectedServer?.uuid]);

  const handleTriggerManualDump = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setIsTriggeringDump(true);
      const res = await api.diagnostics.triggerLagDump(selectedServer.uuid);
      addToast({
        title: language === 'de' ? 'Lag-Dump abgeschlossen' : 'Lag-Dump Completed',
        description: res.message || 'Snapshot erfolgreich erfasst.',
        type: 'success',
      });
      if (res.dump) {
        setLagDumps((prev) => [res.dump, ...prev]);
        setSelectedDump(res.dump);
      }
    } catch (err: any) {
      addToast({
        title: 'Fehler',
        description: err.message || 'Konnte Snapshot nicht erstellen.',
        type: 'error',
      });
    } finally {
      setIsTriggeringDump(false);
    }
  };

  const copyTpCommand = (hotspot: RadarHotspot) => {
    const cmd = `/tp @s ${hotspot.block_x} 100 ${hotspot.block_z}`;
    navigator.clipboard?.writeText(cmd);
    setCopiedCmd(hotspot.id);
    addToast({
      title: language === 'de' ? 'Befehl kopiert' : 'Command Copied',
      description: `${cmd} in die Zwischenablage kopiert`,
      type: 'info',
    });
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  // Color helper for MSPT (green < 40ms, yellow 40-50ms, red > 50ms)
  const getMsptColor = (mspt: number) => {
    if (mspt < 40) return '#10b981'; // emerald
    if (mspt <= 50) return '#f59e0b'; // amber
    return '#ef4444'; // rose
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── 1. Integrierte MSPT- & TPS-Heatmap ── */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <span>{t('diag_heatmap_title')}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    currentHealth === 'optimal'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : currentHealth === 'warning'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                  }`}
                >
                  {currentHealth === 'optimal'
                    ? '20.0 TPS · Perfekt'
                    : currentHealth === 'warning'
                    ? 'TPS gedrosselt'
                    : 'KRITISCHER LAG'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('diag_heatmap_desc')}</p>
            </div>
          </div>

          {/* Realtime KPI Pill Badges */}
          <div className="flex items-center gap-2 font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-center">
              <span className="text-[10px] text-slate-500 block uppercase">Tick Rate</span>
              <span
                className={`text-sm font-bold ${
                  currentTps >= 19.5 ? 'text-emerald-400' : currentTps >= 15 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {currentTps.toFixed(1)} TPS
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-center">
              <span className="text-[10px] text-slate-500 block uppercase">MSPT (Tick Time)</span>
              <span
                className={`text-sm font-bold ${
                  currentMspt < 40 ? 'text-emerald-400' : currentMspt <= 50 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {currentMspt.toFixed(1)} ms
              </span>
            </div>
          </div>
        </div>

        {/* Heatmap Bar / Wave Visualization (60s rolling) */}
        <div className="p-4 rounded-xl bg-[#0a0e17] border border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
            <span>{language === 'de' ? 'Vor 60 Sekunden' : '60 seconds ago'}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                <span className="text-slate-300">&lt; 40ms (20 TPS)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                <span className="text-slate-300">40-50ms (Tick Warnung)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                <span className="text-slate-300">&gt; 50ms (&lt; 15 TPS Lag)</span>
              </span>
            </div>
            <span>{language === 'de' ? 'Jetzt (Live)' : 'Now (Live)'}</span>
          </div>

          <div className="h-28 flex items-end gap-1 w-full pt-2">
            {heatmapData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                {language === 'de' ? 'Telemetriedaten werden initialisiert...' : 'Initializing telemetry stream...'}
              </div>
            ) : (
              heatmapData.map((pt, i) => {
                const heightPercent = Math.min(100, Math.max(12, (pt.mspt / 70) * 100));
                const barColor = getMsptColor(pt.mspt);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all duration-300 relative group cursor-pointer hover:brightness-125"
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: barColor,
                      boxShadow: pt.mspt > 50 ? '0 0 8px rgba(239, 68, 68, 0.4)' : 'none',
                    }}
                  >
                    {/* Hover detail tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-[10px] whitespace-nowrap shadow-2xl pointer-events-none">
                      <div className="font-bold text-white">{pt.tps.toFixed(1)} TPS</div>
                      <div style={{ color: barColor }}>{pt.mspt.toFixed(1)} ms/tick</div>
                      <div className="text-slate-400 text-[9px]">
                        {new Date(pt.timestamp * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Entity- & Tile-Radar ── */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 border border-indigo-500/30 flex items-center justify-center text-cyan-400">
              <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <span>{t('diag_radar_title')}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {radarHotspots.length} Hotspots erkannt
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('diag_radar_desc')}</p>
            </div>
          </div>
        </div>

        {/* World summary overview */}
        {radarSummary?.worlds && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 font-mono text-xs">
            {radarSummary.worlds.map((w: any) => (
              <div key={w.name} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white uppercase text-[11px]">{w.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      w.status === 'optimal'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {w.status}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Entities:</span>
                  <span className="text-white font-semibold">{w.entities.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px] mt-0.5">
                  <span>Tile Entities:</span>
                  <span className="text-white font-semibold">{w.tiles.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hotspots Card List */}
        <div className="space-y-2.5 font-mono text-xs">
          {radarHotspots.map((hs) => (
            <div
              key={hs.id}
              className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                hs.severity === 'critical'
                  ? 'bg-rose-950/20 border-rose-500/30 shadow-md'
                  : hs.severity === 'warning'
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                    hs.severity === 'critical'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">{hs.description}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        hs.severity === 'critical'
                          ? 'bg-rose-500/30 text-rose-200'
                          : 'bg-amber-500/30 text-amber-200'
                      }`}
                    >
                      {hs.type === 'entities' ? 'Entity Cluster' : 'Hopper / Tile Lag'}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs mt-1">{hs.suspect_type}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Chunk [{hs.chunk_x}, {hs.chunk_z}] · Block X: {hs.block_x}, Z: {hs.block_z}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyTpCommand(hs)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-all active:scale-95"
                  title="Kopiert /tp Befehl"
                >
                  {copiedCmd === hs.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Kopiert</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Teleport-Befehl</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Automatischer Lag-Dump ── */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-purple-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <span>{t('diag_lagdump_title')}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  DAEMON AKTIV
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('diag_lagdump_desc')}</p>
            </div>
          </div>

          <button
            onClick={handleTriggerManualDump}
            disabled={isTriggeringDump}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isTriggeringDump ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Erstelle Snapshot...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Manuellen Lag-Dump starten</span>
              </>
            )}
          </button>
        </div>

        {/* Snapshot history */}
        <div className="space-y-2.5 font-mono text-xs">
          {lagDumps.map((dump) => (
            <div
              key={dump.id}
              className="p-4 rounded-xl bg-[#0a0e17] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white">{dump.id}</span>
                  <span className="text-slate-400 text-[11px]">· {new Date(dump.timestamp).toLocaleString()}</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                    {dump.average_tps.toFixed(1)} TPS ({dump.average_mspt.toFixed(1)} ms)
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">{dump.trigger}</p>
                <div className="flex items-center gap-3 text-slate-500 text-[11px] mt-1">
                  <span>Dauer: {dump.duration_sec}s Snapshot</span>
                  <span>Threads: {dump.top_threads.length} erfasst</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedDump(dump)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-semibold transition-all active:scale-95 shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Snapshot analysieren</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lag Dump Detail Modal */}
      {selectedDump && (
        <Modal
          isOpen={!!selectedDump}
          onClose={() => setSelectedDump(null)}
          title={`Lag-Dump Analyse: ${selectedDump.id}`}
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Auslöser:</span>
                <span className="text-white font-bold">{selectedDump.trigger}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Durchschnittsleistung:</span>
                <span className="text-rose-400 font-bold">
                  {selectedDump.average_tps.toFixed(1)} TPS · {selectedDump.average_mspt.toFixed(1)} MSPT
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Zeitstempel:</span>
                <span className="text-slate-300">{new Date(selectedDump.timestamp).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Top CPU Thread Aktivität
              </h4>
              <div className="space-y-2">
                {selectedDump.top_threads.map((th, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#0a0e17] border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">{th.name}</span>
                      <span className="text-amber-400 font-bold">{th.cpu_percent}% CPU</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{th.activity}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Betroffene Chunks & Empfehlungen
              </h4>
              <ul className="space-y-1 list-disc list-inside text-slate-300">
                {selectedDump.hotspots.map((hs, idx) => (
                  <li key={idx}>{hs}</li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedDump(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all"
              >
                Schließen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
