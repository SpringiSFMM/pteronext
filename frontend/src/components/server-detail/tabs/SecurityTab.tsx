import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { api } from '../../../api/client';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  AlertTriangle,
  FileCode,
  Lock,
  RefreshCw,
  Bug,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ThreatViolation {
  rule: string;
  severity: string;
  file?: string;
  file_in_jar?: string;
  description?: string;
  snippet?: string;
}

interface ScanResult {
  file_name?: string;
  file?: string;
  sha256?: string;
  risk_score?: number;
  threat_level?: string;
  threats?: ThreatViolation[];
  violations?: ThreatViolation[];
  total_classes?: number;
  scanned_classes?: number;
  summary?: string;
}

export const SecurityTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { t, language } = useTranslation();

  const [jarFiles, setJarFiles] = useState<string[]>([]);
  const [selectedJar, setSelectedJar] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [activeResult, setActiveResult] = useState<ScanResult | null>(null);

  // Collapsible Accordion State
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(true);

  const fetchSecuritySummary = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setLoadingSummary(true);
      const res = await api.security.getSummary(selectedServer.uuid);
      if (res?.jar_files) {
        setJarFiles(res.jar_files);
        if (res.jar_files.length > 0 && !selectedJar) {
          setSelectedJar(res.jar_files[0]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load security summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSecuritySummary();
  }, [selectedServer?.uuid]);

  const handleScanJar = async (fileToScan?: string) => {
    const target = fileToScan || selectedJar;
    if (!selectedServer?.uuid || !target) return;

    try {
      setScanning(true);
      const res = await api.security.scanJar(selectedServer.uuid, target);
      if (res?.data) {
        setActiveResult(res.data);
        const risk = res.data.risk_score || 0;
        const threatLevel = (res.data.threat_level || (risk > 50 ? 'high' : risk > 0 ? 'medium' : 'clean')).toUpperCase();

        // Default all findings to expanded
        const findings = res.data.violations || res.data.threats || [];
        const initExpanded: Record<number, boolean> = {};
        findings.forEach((_: any, idx: number) => {
          initExpanded[idx] = true;
        });
        setExpandedItems(initExpanded);
        setAllExpanded(true);

        if (risk > 50) {
          addToast({
            title: 'Sicherheits-Warnung',
            description: `Kritisches Risiko in ${target}! Risikoscore: ${risk}/100`,
            type: 'error',
          });
        } else {
          addToast({
            title: 'Scan abgeschlossen',
            description: `Bytecode-Analyse von ${target} beendet. Threat Level: ${threatLevel}`,
            type: 'success',
          });
        }
      }
    } catch (err: any) {
      addToast({
        title: 'Scan fehlgeschlagen',
        description: err.message || 'Konnte JAR-Datei nicht analysieren',
        type: 'error',
      });
    } finally {
      setScanning(false);
    }
  };

  const toggleItem = (idx: number) => {
    setExpandedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleAll = () => {
    const findings = activeResult?.violations || activeResult?.threats || [];
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const updated: Record<number, boolean> = {};
    findings.forEach((_, idx) => {
      updated[idx] = nextState;
    });
    setExpandedItems(updated);
  };

  const getThreatBadge = (level?: string) => {
    const safeLevel = (level || 'clean').toLowerCase();
    switch (safeLevel) {
      case 'critical':
      case 'high':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono text-xs font-bold">
            <XCircle className="w-3.5 h-3.5" />
            CRITICAL THREAT
          </span>
        );
      case 'medium':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            SUSPICIOUS BYTECODE
          </span>
        );
      case 'low':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-mono text-xs font-bold">
            <Bug className="w-3.5 h-3.5" />
            LOW RISK
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            VERIFIED SECURE
          </span>
        );
    }
  };

  const findingsList = activeResult?.violations || activeResult?.threats || [];
  const riskScore = activeResult?.risk_score !== undefined ? activeResult.risk_score : 0;
  const fileName = activeResult?.file_name || activeResult?.file || selectedJar;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold text-white tracking-wide font-sans">
              {language === 'de' ? 'Sicherheits-Scan & Malicious Code Detection' : 'Security Scan & Threat Detection'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
              Heuristic Engine v2.6
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {language === 'de'
              ? 'Erkennt Hintertüren, Force-OP Exploits, Token-Grabber und Base64-verschleierte Payloads in Server-Plugins.'
              : 'Detects backdoors, Force-OP exploits, token grabbers, and obfuscated Base64 payloads in plugins.'}
          </p>
        </div>

        <button
          onClick={fetchSecuritySummary}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors self-start md:self-auto"
          title="Verfügbare JAR-Dateien neu laden"
        >
          <RefreshCw className={`w-4 h-4 ${loadingSummary ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Security Guardrails Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-mono uppercase">Log Secret Masking</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Passwörter, Discord-Webhooks und API-Tokens werden in Konsolen-Streams und Logs automatisch zensiert.
            </p>
          </div>
        </div>

        <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-mono uppercase">Bytecode Heuristik</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Prüft Aufrufe auf <code className="text-rose-400">Runtime.getRuntime().exec()</code>, ProcessBuilder und Netzwerk-Sockets.
            </p>
          </div>
        </div>

        <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <FileWarning className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-mono uppercase">Force-OP Schutz</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Identifiziert unautorisierte Berechtigungsinjektionen und verdeckte OP-Grant-Listener.
            </p>
          </div>
        </div>
      </div>

      {/* Target Selector & Scanner Launcher (Redesigned & Clean) */}
      <div className="cyber-glass rounded-2xl p-6 border border-slate-800 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCode className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              JAR-Archiv zur Sicherheitsprüfung auswählen
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Wähle eine Plugin- oder Server-Jar Datei aus dem Root-Verzeichnis aus:
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#0d1117] p-3 rounded-2xl border border-slate-800/80">
          <div className="relative flex-1">
            <select
              value={selectedJar}
              onChange={(e) => setSelectedJar(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              {jarFiles.length === 0 ? (
                <option value="">Keine .jar-Dateien im Server-Verzeichnis gefunden</option>
              ) : (
                jarFiles.map((file) => (
                  <option key={file} value={file}>
                    📦 {file}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={() => handleScanJar()}
            disabled={scanning || !selectedJar}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white font-mono text-xs font-bold transition-all shadow-lg active:scale-95 shrink-0"
          >
            <Search className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Analysiere Bytecode...' : 'Deep Bytecode Scan starten'}</span>
          </button>
        </div>

        {/* Scan Results View */}
        {activeResult ? (
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d1117] p-4 rounded-xl border border-slate-800">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Geprüfte Datei</span>
                <span className="text-sm font-bold text-white font-mono">{fileName}</span>
                {activeResult.sha256 && (
                  <div className="text-[11px] text-slate-400 font-mono">
                    SHA-256: <span className="text-slate-300">{activeResult.sha256.slice(0, 32)}...</span>
                  </div>
                )}
                {activeResult.total_classes !== undefined && (
                  <div className="text-[11px] text-slate-500 font-mono">
                    Analysierte Klassen: <span className="text-slate-300">{activeResult.total_classes}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Risiko-Score</span>
                  <span className={`text-2xl font-black font-mono ${
                    riskScore > 50 ? 'text-rose-400' : riskScore > 20 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {riskScore} / 100
                  </span>
                </div>
                {getThreatBadge(activeResult.threat_level)}
              </div>
            </div>

            {/* Collapsible Accordion Header */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono uppercase text-slate-400 font-semibold">
                Gefundene Heuristik-Muster ({findingsList.length})
              </span>

              {findingsList.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  {allExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{allExpanded ? 'Alle einklappen' : 'Alle ausklappen'}</span>
                </button>
              )}
            </div>

            {/* Findings List (Accordion Style) */}
            {findingsList.length === 0 ? (
              <div className="p-6 rounded-xl bg-emerald-950/15 border border-emerald-500/25 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white font-mono">Keine bösartigen Signaturen gefunden</p>
                <p className="text-[11px] text-slate-400 font-mono">
                  Das Archiv enthält keine RCE-, Backdoor- oder Token-Grabber-Signaturen.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {findingsList.map((threat, idx) => {
                  const isExpanded = expandedItems[idx] ?? true;
                  const severity = (threat.severity || 'HIGH').toUpperCase();
                  const targetFile = threat.file_in_jar || threat.file || 'Unknown.class';

                  return (
                    <div
                      key={idx}
                      className="rounded-xl bg-[#0d1117] border border-slate-800/80 overflow-hidden font-mono text-xs transition-all"
                    >
                      {/* Accordion Row Header */}
                      <div
                        onClick={() => toggleItem(idx)}
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/40 select-none transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span className="font-bold text-rose-300">{threat.rule}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            {severity}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="text-[11px] hidden sm:inline text-slate-500 truncate max-w-xs">
                            {targetFile}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Accordion Content (Collapsible) */}
                      {isExpanded && (
                        <div className="p-3 pt-0 border-t border-slate-800/40 space-y-2 bg-slate-950/40 animate-in fade-in duration-150">
                          <div className="text-[11px] text-slate-400 pt-2">
                            Pfad im Archiv: <span className="text-slate-200 font-semibold">{targetFile}</span>
                          </div>
                          {threat.description && (
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {threat.description}
                            </p>
                          )}
                          {threat.snippet && (
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase block mb-1">
                                Bytecode-Ausschnitt:
                              </span>
                              <pre className="p-2 rounded bg-black/60 border border-slate-800 text-[11px] text-rose-300/90 overflow-x-auto">
                                {threat.snippet}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs font-mono bg-[#0d1117]/30 rounded-xl border border-slate-800/50">
            Wähle oben eine .jar-Datei aus und starte den automatisierten Bytecode-Scan.
          </div>
        )}
      </div>
    </div>
  );
};
