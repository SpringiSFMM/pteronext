import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import {
  Send,
  Trash2,
  Download,
  Terminal,
  Cpu,
  HardDrive,
  Play,
  Pause,
  AlertTriangle,
  Wrench,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { ResourceMeter } from '../../common/ResourceMeter';

export const ConsoleTab: React.FC = () => {
  const {
    terminalLogs,
    addTerminalCommand,
    clearTerminal,
    selectedServer,
    addToast,
    handlePowerAction,
  } = useApp();

  const { language } = useTranslation();
  const isServerSuspended = Boolean(selectedServer?.isSuspended || selectedServer?.suspended);

  const [inputVal, setInputVal] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pteronext_cmd_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [autoScroll, setAutoScroll] = useState(true);

  // Crash Analyzer State
  const [crashAnalysis, setCrashAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  const fetchCrashAnalysis = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setIsAnalyzing(true);
      const res = await api.servers.getCrashAnalysis(selectedServer.uuid);
      if (res && res.crashed) {
        setCrashAnalysis(res);
      } else {
        setCrashAnalysis(null);
      }
    } catch (e) {
      // Quiet ignore if not crashed
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchCrashAnalysis();
  }, [selectedServer?.uuid, selectedServer?.status]);

  const handleApplyCrashFix = async () => {
    if (!selectedServer?.uuid || !crashAnalysis) return;
    try {
      setIsFixing(true);
      const res = await api.servers.applyCrashFix(selectedServer.uuid, {
        action: crashAnalysis.fix_action,
        target_file: crashAnalysis.target_file,
      });

      addToast({
        title: language === 'de' ? 'Crash-Fix angewendet' : 'Crash Fix Applied',
        description: res.message || (language === 'de' ? 'Reparatur erfolgreich. Server wird neu gestartet...' : 'Fix applied. Server restarting...'),
        type: 'success',
      });

      // Clear crash banner and trigger power restart
      setCrashAnalysis(null);
      setTimeout(() => {
        handlePowerAction(selectedServer.id, 'restart');
      }, 500);
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Fehler beim Anwenden' : 'Fix Failed',
        description: err.message || 'Could not apply automated fix',
        type: 'error',
      });
    } finally {
      setIsFixing(false);
    }
  };

  // Common Standard Commands for Autocomplete
  const AUTOCOMPLETE_COMMANDS = [
    'stop',
    'restart',
    'whitelist on',
    'whitelist off',
    'whitelist add',
    'whitelist remove',
    'whitelist list',
    'op',
    'deop',
    'reload',
    'save-all',
    'list',
    'say',
    'kick',
    'ban',
    'pardon',
    'gamemode creative',
    'gamemode survival',
    'tp',
    'weather clear',
    'time set day',
    'help',
  ];

  const matchingSuggestions = inputVal.trim()
    ? AUTOCOMPLETE_COMMANDS.filter((c) =>
        c.toLowerCase().startsWith(inputVal.trim().toLowerCase()) && c.toLowerCase() !== inputVal.trim().toLowerCase()
      ).slice(0, 5)
    : [];

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal when new logs appear
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, autoScroll]);

  const saveCommandToHistory = (cmd: string) => {
    setCommandHistory((prev) => {
      const next = [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 50);
      try {
        localStorage.setItem('pteronext_cmd_history', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isServerSuspended) return;

    addTerminalCommand(inputVal.trim());
    saveCommandToHistory(inputVal.trim());
    setInputVal('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      if (matchingSuggestions.length > 0) {
        e.preventDefault();
        setInputVal(matchingSuggestions[0] + ' ');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputVal(commandHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIdx = historyIndex - 1;
        setHistoryIndex(prevIdx);
        setInputVal(commandHistory[prevIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const handleShortcutClick = (cmd: string) => {
    if (isServerSuspended) return;
    addTerminalCommand(cmd);
    saveCommandToHistory(cmd);
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([terminalLogs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedServer?.name || 'server').replace(/\s+/g, '_')}_console.log`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      title: 'Logs Downloaded',
      description: 'Exported active console buffer to disk.',
      type: 'info',
    });
  };

  // Comprehensive ANSI color map including high-intensity Paper/Spigot colors
  const ANSI_COLORS: Record<string, string> = {
    '30': '#475569', // Black/Slate
    '31': '#ef4444', // Red
    '32': '#10b981', // Green
    '33': '#f59e0b', // Yellow
    '34': '#3b82f6', // Blue
    '35': '#a855f7', // Magenta
    '36': '#06b6d4', // Cyan
    '37': '#e2e8f0', // White
    '90': '#64748b', // Bright Black / Gray (e.g. [90m-)
    '91': '#f87171', // Bright Red
    '92': '#4ade80', // Bright Green (e.g. [92mEssentials)
    '93': '#facc15', // Bright Yellow
    '94': '#60a5fa', // Bright Blue
    '95': '#c084fc', // Bright Magenta
    '96': '#22d3ee', // Bright Cyan
    '97': '#ffffff', // Bright White
  };

  // Convert raw ANSI codes and stripped Paper codes into clean styled HTML
  const parseAnsiToHtml = (raw: string): string => {
    let escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Matches both \x1b[...m and raw [...m color codes
    const ansiRegex = /(?:\x1b\[|\[)(\d+(?:;\d+)*)m/g;
    let result = '';
    let lastIndex = 0;
    let openSpans = 0;

    let match: RegExpExecArray | null;
    while ((match = ansiRegex.exec(escaped)) !== null) {
      result += escaped.substring(lastIndex, match.index);
      lastIndex = ansiRegex.lastIndex;

      const codes = match[1].split(';');
      for (const code of codes) {
        if (code === '0') {
          while (openSpans > 0) {
            result += '</span>';
            openSpans--;
          }
        } else if (code === '1') {
          result += '<span class="font-bold">';
          openSpans++;
        } else if (code === '2') {
          result += '<span class="opacity-70">';
          openSpans++;
        } else if (code === '3') {
          result += '<span class="italic">';
          openSpans++;
        } else if (code === '4') {
          result += '<span class="underline">';
          openSpans++;
        } else if (ANSI_COLORS[code]) {
          result += `<span style="color:${ANSI_COLORS[code]}">`;
          openSpans++;
        }
      }
    }

    result += escaped.substring(lastIndex);
    while (openSpans > 0) {
      result += '</span>';
      openSpans--;
    }

    // Strip any remaining control chars
    return result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  };

  const renderLogLine = (line: string, index: number) => {
    const formatted = parseAnsiToHtml(line);
    // Sanitize with DOMPurify allowing only safe styling spans
    const cleanHtml = DOMPurify.sanitize(formatted, {
      ALLOWED_TAGS: ['span'],
      ALLOWED_ATTR: ['class', 'style'],
    });
    return (
      <div
        key={index}
        className="leading-5 py-0.5 whitespace-pre-wrap break-all text-slate-300 font-mono select-text"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml – Input is pre-escaped and sanitized using DOMPurify
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    );
  };

  if (!selectedServer) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-xs">
        No active server selected.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Intelligent Crash-Analyzer mit 1-Klick-Lösung */}
      {crashAnalysis && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/70 via-amber-950/40 to-[#161b22] border-2 border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.2)] p-4 sm:p-5 transition-all animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold font-mono text-white tracking-wide">
                    {language === 'de' ? crashAnalysis.title : crashAnalysis.title_en}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {crashAnalysis.category}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  {language === 'de' ? crashAnalysis.description : crashAnalysis.description_en}
                </p>
                {crashAnalysis.detected_error && (
                  <div className="mt-2 p-2 rounded-lg bg-black/60 border border-rose-950/80 font-mono text-[11px] text-rose-300 overflow-x-auto max-h-20 select-text">
                    <code>{crashAnalysis.detected_error}</code>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              <button
                onClick={fetchCrashAnalysis}
                disabled={isAnalyzing}
                title="Erneut analysieren"
                className="p-2.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleApplyCrashFix}
                disabled={isFixing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold tracking-wide shadow-lg shadow-emerald-950/50 hover:shadow-emerald-500/25 transition-all active:scale-95 border border-emerald-400/30 disabled:opacity-50"
              >
                {isFixing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'de' ? 'Wende Lösung an...' : 'Applying Fix...'}</span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-3.5 h-3.5" />
                    <span>
                      {language === 'de' ? crashAnalysis.solution_label : crashAnalysis.solution_label_en}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspension Alert Banner */}
      {isServerSuspended && (
        <div className="rounded-2xl p-4 bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-white block">
                {language === 'de' ? 'Server administrativ suspendiert' : 'Server Administratively Suspended'}
              </span>
              <span>
                {language === 'de'
                  ? 'Alle Prozesse wurden beendet. Konsolenbefehle und Serverstarts sind gesperrt.'
                  : 'All container processes terminated. Console commands and power execution are locked.'}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
            SUSPENDED
          </span>
        </div>
      )}

      {/* Live Graph Gauges Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#161b22] rounded-xl p-4 border border-[#30363d]">
          <ResourceMeter
            label="Real-Time CPU Usage"
            value={selectedServer.stats.cpu}
            unit="%"
            icon={<Cpu className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="bg-[#161b22] rounded-xl p-4 border border-[#30363d]">
          <ResourceMeter
            label="Memory Allocation"
            value={selectedServer.stats.memory}
            max={selectedServer.stats.memoryLimit}
            unit="MB"
            icon={<HardDrive className="w-4 h-4 text-slate-400" />}
          />
        </div>
      </div>

      {/* Terminal Container */}
      <div className="rounded-xl bg-[#090d16] border border-[#30363d] overflow-hidden shadow-xl flex flex-col h-[520px]">
        {/* Terminal Header */}
        <div className="px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <Terminal className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-mono font-medium text-slate-300">
              STDIN / STDOUT Interface
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? 'Pause autoscroll' : 'Resume autoscroll'}
              className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
                autoScroll
                  ? 'bg-[#21262d] border-[#30363d] text-slate-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {autoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[10px]">
                {autoScroll ? 'Auto-Scroll' : 'Paused'}
              </span>
            </button>

            <button
              onClick={handleDownloadLogs}
              title="Download Logs"
              className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-400 hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={clearTerminal}
              title="Clear Terminal Output"
              className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Screen */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 select-text bg-[#090d16]">
          {terminalLogs.length === 0 ? (
            <div className="space-y-2.5 py-6 px-2 animate-pulse font-mono">
              <div className="h-3 w-52 bg-[#161b22] rounded" />
              <div className="h-3 w-80 bg-[#161b22]/70 rounded" />
              <div className="h-3 w-64 bg-[#161b22]/50 rounded" />
              <div className="h-3 w-96 bg-[#161b22]/40 rounded" />
              <div className="h-3 w-40 bg-[#161b22]/30 rounded" />
              <div className="text-slate-600 text-[11px] italic pt-3">
                [Connecting to real-time container daemon... Stream will appear automatically.]
              </div>
            </div>
          ) : (
            terminalLogs.map((line, idx) => renderLogLine(line, idx))
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Command Shortcuts Bar */}
        <div className="px-3 py-1.5 bg-[#161b22] border-t border-[#30363d] flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
          <span className="text-slate-500 uppercase text-[10px] mr-1">Quick:</span>
          {['status', 'save-all', 'reload', 'list', 'ping', 'help'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => handleShortcutClick(cmd)}
              disabled={isServerSuspended}
              className="px-2 py-0.5 rounded bg-[#0d1117] hover:bg-[#21262d] text-slate-400 hover:text-white border border-[#30363d] transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              /{cmd}
            </button>
          ))}
        </div>

        {/* Autocomplete Suggestions Popup */}
        {matchingSuggestions.length > 0 && (
          <div className="px-3 py-1.5 bg-[#0d1117] border-t border-emerald-500/20 flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono">
            <span className="text-emerald-400 font-semibold text-[10px] mr-1 flex items-center gap-1">
              <span>TAB</span>
              <span>•</span>
            </span>
            {matchingSuggestions.map((sug, i) => (
              <button
                key={sug}
                type="button"
                onClick={() => setInputVal(sug + ' ')}
                className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${
                  i === 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                <span>{sug}</span>
                {i === 0 && <span className="text-[10px] text-emerald-400 font-bold">⇥</span>}
              </button>
            ))}
          </div>
        )}

        {/* Command Input Box */}
        <form
          onSubmit={handleSubmit}
          className="p-3 bg-[#161b22] border-t border-[#30363d] flex items-center gap-2"
        >
          <div className="text-emerald-400 font-mono text-xs font-bold pl-1">&gt;</div>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isServerSuspended}
            placeholder={
              isServerSuspended
                ? (language === 'de' ? 'Server ist administrativ suspendiert – Befehle sind gesperrt' : 'Server is suspended – Commands locked')
                : 'Type a console command or press Up for history...'
            }
            className="flex-1 bg-transparent border-0 text-white font-mono text-xs focus:outline-none placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isServerSuspended}
            className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-200 border border-[#30363d] font-mono text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Send</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
};
