import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, CornerDownLeft, X, Terminal } from 'lucide-react';

interface CommandInputProps {
  onSendCommand: (command: string) => void;
  disabled?: boolean;
  serverUuid?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const STORAGE_PREFIX = 'ptero_cmd_history_';
const MAX_HISTORY = 60;

export const CommandInput: React.FC<CommandInputProps> = ({
  onSendCommand,
  disabled = false,
  serverUuid = 'default',
  placeholder = 'Type a command (e.g. help, list, say hello)...',
  className = '',
  autoFocus = false,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${serverUuid}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const draftRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync history to localStorage
  const saveHistory = (newHistory: string[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${serverUuid}`, JSON.stringify(newHistory));
    } catch (err) {
      console.warn('Failed to save command history to localStorage:', err);
    }
  };

  const handleSend = () => {
    const trimmed = inputVal.trim();
    if (!trimmed || disabled) return;

    onSendCommand(trimmed);

    // Update history (prevent duplicate consecutive entries)
    const filtered = history.filter((cmd) => cmd !== trimmed);
    const updated = [...filtered, trimmed].slice(-MAX_HISTORY);
    saveHistory(updated);

    setInputVal('');
    setHistoryIndex(-1);
    draftRef.current = '';

    // Keep focus on input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
      return;
    }

    if (e.key === 'ArrowUp') {
      if (history.length === 0) return;
      e.preventDefault();

      if (historyIndex === -1) {
        // Save current draft
        draftRef.current = inputVal;
        const targetIdx = history.length - 1;
        setHistoryIndex(targetIdx);
        setInputVal(history[targetIdx]);
      } else if (historyIndex > 0) {
        const targetIdx = historyIndex - 1;
        setHistoryIndex(targetIdx);
        setInputVal(history[targetIdx]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (history.length === 0 || historyIndex === -1) return;
      e.preventDefault();

      if (historyIndex < history.length - 1) {
        const targetIdx = historyIndex + 1;
        setHistoryIndex(targetIdx);
        setInputVal(history[targetIdx]);
      } else {
        // Return to user's saved draft
        setHistoryIndex(-1);
        setInputVal(draftRef.current);
      }
      return;
    }

    if (e.key === 'Escape') {
      if (inputVal) {
        e.preventDefault();
        setInputVal('');
        setHistoryIndex(-1);
      }
    }
  };

  return (
    <div
      className={`relative flex items-center gap-2 p-1.5 sm:p-2 rounded-xl bg-slate-950/90 border border-slate-800 focus-within:border-[var(--theme-accent)]/50 focus-within:ring-1 focus-within:ring-[var(--theme-ring)] transition-all ${className}`}
    >
      {/* Terminal prompt glyph */}
      <div className="flex items-center gap-1.5 pl-2 select-none text-zinc-400">
        <Terminal className="w-4 h-4 text-zinc-500 hidden sm:block" />
        <span className="font-mono text-sm font-bold text-zinc-300 leading-none">&gt;</span>
      </div>

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={inputVal}
        onChange={(e) => {
          setInputVal(e.target.value);
          if (historyIndex !== -1) {
            setHistoryIndex(-1); // Reset history index when user edits
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full bg-transparent text-slate-100 font-mono text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed selection:bg-white/20 selection:text-white"
      />

      {/* Clear input button */}
      {inputVal && (
        <button
          type="button"
          onClick={() => {
            setInputVal('');
            setHistoryIndex(-1);
            inputRef.current?.focus();
          }}
          className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition-colors"
          title="Clear input (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Send Command Button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !inputVal.trim()}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all duration-150 ${
          inputVal.trim() && !disabled
            ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20 active:scale-95 shadow-sm'
            : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
        }`}
        title="Send Command (Enter)"
      >
        <span className="hidden sm:inline">Execute</span>
        <CornerDownLeft className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
