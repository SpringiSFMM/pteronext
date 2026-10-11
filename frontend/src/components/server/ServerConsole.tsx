import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ServerStatus, PowerAction } from '../../types';
import { ConsoleLogEntry } from './types';
import { AnsiRenderer } from './AnsiRenderer';
import { CommandInput } from './CommandInput';
import { QuickShortcuts } from './QuickShortcuts';
import { PowerButtons } from './PowerButtons';
import { stripAnsi } from './ansi';
import {
  Terminal,
  Pause,
  Play,
  ArrowDown,
  Trash2,
  Copy,
  Check,
  Search,
  Maximize2,
  Minimize2,
  Clock,
  Hash,
} from 'lucide-react';

interface ServerConsoleProps {
  logs: ConsoleLogEntry[];
  serverStatus: ServerStatus;
  serverName?: string;
  serverUuid?: string;
  isPaused: boolean;
  pausedNewCount: number;
  onTogglePause: () => void;
  onResetPausedCount: () => void;
  onSendCommand: (cmd: string) => void;
  onPowerAction: (action: PowerAction) => void;
  onClearLogs: () => void;
  className?: string;
}

export const ServerConsole: React.FC<ServerConsoleProps> = ({
  logs,
  serverStatus,
  serverName = 'Server Console',
  serverUuid = 'default',
  isPaused,
  pausedNewCount,
  onTogglePause,
  onResetPausedCount,
  onSendCommand,
  onPowerAction,
  onClearLogs,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);

  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Auto-scroll handler
  useEffect(() => {
    if (!containerRef.current) return;
    if (!isPaused && !isUserScrolledUpRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  // Detect user scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

    // If user scrolled up more than 60px from bottom, mark scrolled up
    if (distanceToBottom > 60) {
      isUserScrolledUpRef.current = true;
    } else {
      isUserScrolledUpRef.current = false;
      if (pausedNewCount > 0) {
        onResetPausedCount();
      }
    }
  }, [pausedNewCount, onResetPausedCount]);

  // Jump to bottom action
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    isUserScrolledUpRef.current = false;
    onResetPausedCount();
    if (isPaused) {
      onTogglePause(); // Resume auto-scroll when clicking jump to bottom
    }
  }, [isPaused, onResetPausedCount, onTogglePause]);

  // Copy logs to clipboard
  const handleCopyLogs = useCallback(() => {
    const textToCopy = logs
      .map((l) => (showTimestamps ? `[${l.formattedTime}] ${stripAnsi(l.raw)}` : stripAnsi(l.raw)))
      .join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [logs, showTimestamps]);

  // Filtered logs for search
  const displayedLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const qLower = searchQuery.toLowerCase();
    return logs.filter((l) => stripAnsi(l.raw).toLowerCase().includes(qLower));
  }, [logs, searchQuery]);

  return (
    <div
      className={`flex flex-col rounded-2xl bg-[#090d16] border border-slate-800 shadow-2xl overflow-hidden transition-all duration-200 ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-xl' : 'h-[620px]'
      } ${className}`}
    >
      {/* 1. Terminal Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#0d131f] border-b border-slate-800/80 shrink-0">
        {/* Left: Terminal Title & Server Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-zinc-300">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>{serverName}</span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                    serverStatus === 'running'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : serverStatus === 'starting'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {serverStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Quick Power Action Buttons */}
        <div className="flex items-center">
          <PowerButtons
            status={serverStatus}
            onAction={onPowerAction}
          />
        </div>

        {/* Right: Console Controls (Pause, Copy, Clear, Search, Fullscreen) */}
        <div className="flex items-center gap-1 sm:gap-1.5 text-xs">
          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showSearch || searchQuery
                ? 'bg-white/15 text-white border-white/20'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="Search Console Logs"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Timestamps Toggle */}
          <button
            type="button"
            onClick={() => setShowTimestamps(!showTimestamps)}
            className={`p-1.5 rounded-lg border transition-colors hidden sm:flex items-center gap-1 ${
              showTimestamps
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-slate-900/60 text-slate-500 border-slate-800'
            }`}
            title="Toggle Timestamps"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          {/* Line Numbers Toggle */}
          <button
            type="button"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={`p-1.5 rounded-lg border transition-colors hidden sm:flex items-center gap-1 ${
              showLineNumbers
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-slate-900/60 text-slate-500 border-slate-800'
            }`}
            title="Toggle Line Numbers"
          >
            <Hash className="w-3.5 h-3.5" />
          </button>

          {/* Auto-Scroll / Pause Toggle */}
          <button
            type="button"
            onClick={onTogglePause}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-medium transition-colors ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-900/80 text-emerald-400 hover:text-emerald-300 border-slate-800'
            }`}
            title={isPaused ? 'Resume auto-scrolling' : 'Pause auto-scrolling'}
          >
            {isPaused ? (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Paused {pausedNewCount > 0 && `(+${pausedNewCount})`}</span>
              </>
            ) : (
              <>
                <Pause className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">Auto-Scroll</span>
              </>
            )}
          </button>

          {/* Copy Logs */}
          <button
            type="button"
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Copy all logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear Logs */}
          <button
            type="button"
            onClick={onClearLogs}
            className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
            title="Clear terminal view"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Optional Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800/80 animate-in fade-in">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search terminal logs..."
            className="w-full bg-transparent text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <span className="text-[11px] font-mono text-zinc-400 shrink-0">
              {displayedLogs.length} matching lines
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setShowSearch(false);
            }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Close
          </button>
        </div>
      )}

      {/* 3. Terminal Log Output Container */}
      <div className="relative flex-1 min-h-0 bg-[#080b11]">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-y-auto px-3 sm:px-4 py-3 font-mono text-xs leading-relaxed select-text space-y-0.5"
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          }}
        >
          {displayedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs py-12">
              <Terminal className="w-8 h-8 mb-2 opacity-40 text-zinc-500" />
              <span>No terminal logs available.</span>
              <span className="text-[11px] text-slate-600 mt-1">
                Start server to begin streaming stdout / stderr.
              </span>
            </div>
          ) : (
            displayedLogs.map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-baseline gap-2 hover:bg-slate-800/20 px-1 py-0.5 rounded transition-colors"
              >
                {/* Optional Line Number */}
                {showLineNumbers && (
                  <span className="text-[11px] text-slate-600 select-none shrink-0 w-8 text-right font-mono">
                    {index + 1}
                  </span>
                )}

                {/* Optional Timestamp */}
                {showTimestamps && (
                  <span className="text-[11px] text-slate-500 select-none shrink-0 font-mono">
                    [{entry.formattedTime}]
                  </span>
                )}

                {/* ANSI Parsed Line */}
                <div className="flex-1 break-words whitespace-pre-wrap selection:bg-white/20">
                  <AnsiRenderer raw={entry.raw} searchQuery={searchQuery} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Floating "Scroll to Bottom" Alert Button when user scrolled up or paused */}
        {(isPaused || pausedNewCount > 0) && (
          <div className="absolute bottom-4 right-4 z-20 animate-bounce">
            <button
              type="button"
              onClick={scrollToBottom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-semibold shadow-xl border border-white/20 backdrop-blur-md transition-all active:scale-95"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Jump to Bottom</span>
              {pausedNewCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 text-[10px]">
                  +{pausedNewCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 4. Bottom Controls: Quick Shortcuts & Command Bar */}
      <div className="p-2 sm:p-3 bg-[#0d131f] border-t border-slate-800/80 shrink-0 space-y-2">
        {/* Mobile Quick Shortcut Chips */}
        <QuickShortcuts
          onExecute={onSendCommand}
          serverUuid={serverUuid}
        />

        {/* Command Input Bar */}
        <CommandInput
          onSendCommand={onSendCommand}
          serverUuid={serverUuid}
          disabled={serverStatus === 'offline'}
          placeholder={
            serverStatus === 'offline'
              ? 'Server is offline. Start server to execute commands.'
              : 'Type a server command (e.g. help, list, say hello)...'
          }
        />
      </div>
    </div>
  );
};
