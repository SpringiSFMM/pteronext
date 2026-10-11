import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileItem } from '../../../../types';
import { useApp } from '../../../../context/AppContext';
import { useTranslation } from '../../../../i18n/useTranslation';
import { api } from '../../../../api/client';
import {
  FileCode,
  Save,
  Check,
  Loader2,
  X,
  Search,
  Copy,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
  History,
  Clock,
  GitCommit,
  Split,
  Lock,
} from 'lucide-react';
import { detectLanguage, highlightCode } from './syntaxHighlighter';

interface CodeEditorModalProps {
  file: FileItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (path: string, content: string) => void;
}

export const CodeEditorModal: React.FC<CodeEditorModalProps> = ({
  file,
  isOpen,
  onClose,
  onSave,
}) => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();
  const isServerSuspended = Boolean(selectedServer?.isSuspended || selectedServer?.suspended);
  const [content, setContent] = useState(file.content || '');
  const [initialContent, setInitialContent] = useState(file.content || '');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isCopied, setIsCopied] = useState(false);

  // File-Time-Machine (Mikro-Snapshots & Revisions) State
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<any>(null);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [restoringRevision, setRestoringRevision] = useState(false);

  const openTimeMachine = async () => {
    if (!selectedServer?.uuid || !file.path) return;
    setIsTimeMachineOpen(true);
    setLoadingRevisions(true);
    try {
      const res = await api.files.listRevisions(selectedServer.uuid, file.path);
      if (res?.revisions && res.revisions.length > 0) {
        setRevisions(res.revisions);
        setSelectedRevision(res.revisions[0]);
      } else {
        setRevisions([]);
        setSelectedRevision(null);
      }
    } catch (e) {
      console.warn('Failed loading revisions:', e);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleRestoreRevision = async (rev: any) => {
    if (!selectedServer?.uuid || !rev) return;
    try {
      setRestoringRevision(true);
      await api.files.restoreRevision(selectedServer.uuid, rev.id);
      setContent(rev.content);
      setInitialContent(rev.content);
      setIsTimeMachineOpen(false);
      addToast({
        title: language === 'de' ? 'Version wiederhergestellt' : 'Revision Restored',
        description: language === 'de'
          ? `Datei erfolgreich auf Revision #${rev.revision_num} zurückgesetzt.`
          : `File successfully restored to revision #${rev.revision_num}.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Wiederherstellung fehlgeschlagen' : 'Restore Failed',
        description: err.message || 'Error restoring revision',
        type: 'error',
      });
    } finally {
      setRestoringRevision(false);
    }
  };

  // In-file search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync and fetch real content from server when file opens
  useEffect(() => {
    let isCancelled = false;

    if (isOpen && selectedServer?.uuid && file.path) {
      if (typeof file.content === 'string' && file.content.length > 0) {
        setContent(file.content);
        setInitialContent(file.content);
        setIsLoadingContent(false);
      } else {
        setIsLoadingContent(true);
        api.files
          .getContent(selectedServer.uuid, file.path)
          .then((res) => {
            if (!isCancelled) {
              const text = res?.content ?? '';
              setContent(text);
              setInitialContent(text);
              setIsLoadingContent(false);
            }
          })
          .catch((err) => {
            if (!isCancelled) {
              console.warn('Could not read file from server, using fallback:', err);
              setContent(file.content || '');
              setInitialContent(file.content || '');
              setIsLoadingContent(false);
            }
          });
      }
    } else {
      setContent(file.content || '');
      setInitialContent(file.content || '');
      setIsLoadingContent(false);
    }

    setIsSaved(false);
    setIsSaving(false);
    setShowDiscardConfirm(false);
    setSearchQuery('');
    setIsSearchOpen(false);

    return () => {
      isCancelled = true;
    };
  }, [file.path, file.content, isOpen, selectedServer?.uuid]);

  const hasChanges = content !== initialContent;

  const languageInfo = useMemo(() => detectLanguage(file.name), [file.name]);

  const lines = useMemo(() => content.split('\n'), [content]);
  const totalLines = lines.length;

  const updateCursorPosition = useCallback(() => {
    if (!textareaRef.current) return;
    const { selectionStart } = textareaRef.current;
    const textBefore = content.substring(0, selectionStart);
    const linesBefore = textBefore.split('\n');
    const line = linesBefore.length;
    const col = linesBefore[linesBefore.length - 1].length + 1;
    setCursorPos({ line, col });
  }, [content]);

  // Synchronize scrolling between textarea, highlighted pre, and gutter
  const handleScroll = useCallback(() => {
    if (!textareaRef.current) return;
    const { scrollTop, scrollLeft } = textareaRef.current;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop;
    }
  }, []);

  const handleSave = useCallback(() => {
    if (isSaving) return;
    setIsSaving(true);
    setTimeout(() => {
      onSave(file.path, content);
      setInitialContent(content);
      setIsSaving(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 1800);
    }, 350);
  }, [content, file.path, isSaving, onSave]);

  const handleCloseAttempt = useCallback(() => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  // Keyboard shortcuts (Ctrl+S / Cmd+S, Ctrl+F, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((prev) => {
          const next = !prev;
          if (next) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }
          return next;
        });
      } else if (e.key === 'Escape') {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else if (isSearchOpen) {
          setIsSearchOpen(false);
        } else {
          handleCloseAttempt();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseAttempt, handleSave, isOpen, isSearchOpen, showDiscardConfirm]);

  // Handle Tab key in editor
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      // Insert 2 spaces
      const updated = val.substring(0, start) + '  ' + val.substring(end);
      setContent(updated);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateCursorPosition();
      });
    }
  };

  // Find occurrences of search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const matches: number[] = [];
    const lowerContent = content.toLowerCase();
    const query = searchQuery.toLowerCase();
    let index = lowerContent.indexOf(query);

    while (index !== -1) {
      matches.push(index);
      index = lowerContent.indexOf(query, index + query.length);
    }

    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);

    if (matches.length > 0 && textareaRef.current) {
      const matchPos = matches[0];
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(matchPos, matchPos + query.length);
      updateCursorPosition();
    }
  }, [searchQuery, content, updateCursorPosition]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0 || !textareaRef.current) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    const pos = searchMatches[nextIdx];
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pos, pos + searchQuery.length);
    updateCursorPosition();
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0 || !textareaRef.current) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    const pos = searchMatches[prevIdx];
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pos, pos + searchQuery.length);
    updateCursorPosition();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  const handleResetToInitial = () => {
    setContent(initialContent);
    setShowDiscardConfirm(false);
  };

  if (!isOpen) return null;

  const gutterWidth = Math.max(48, String(totalLines).length * 9 + 28);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className={`relative bg-[#070a12] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[88vh]'
        }`}
      >
        {/* Top Border Line */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/15 pointer-events-none z-20" />

        {/* Editor Top Bar */}
        <div className="px-4 py-3 bg-[#0a0e18] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* File Information */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300 shrink-0">
              <FileCode className="w-4 h-4" />
            </div>

            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs font-bold text-white truncate" title={file.path}>
                {file.path}
              </span>

              {hasChanges && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Modified
                </span>
              )}

              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700/80">
                {languageInfo.label}
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search Toggle */}
            <button
              onClick={() => {
                setIsSearchOpen((prev) => !prev);
                if (!isSearchOpen) {
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }
              }}
              className={`p-1.5 rounded-lg font-mono text-xs transition-colors flex items-center gap-1 ${
                isSearchOpen
                  ? 'bg-white/10 text-white border border-white/30 font-semibold'
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Find in file (Ctrl+F / ⌘F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copy All"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Revert Changes */}
            {hasChanges && (
              <button
                onClick={handleResetToInitial}
                className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-amber-400 hover:text-amber-300 transition-colors"
                title="Discard unsaved edits and reload"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* 3. File-Time-Machine (Mikro-Snapshots Button) */}
            <button
              onClick={openTimeMachine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-semibold transition-all shadow-sm active:scale-95"
              title="File-Time-Machine Revisionshistorie öffnen"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Time-Machine</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Save Button with Indicator (Disabled if suspended) */}
            <button
              onClick={handleSave}
              disabled={isSaving || isServerSuspended}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-md ${
                isServerSuspended
                  ? 'bg-rose-950/40 text-rose-400 border border-rose-900/50 cursor-not-allowed opacity-60'
                  : isSaved
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : isSaving
                  ? 'bg-zinc-700 text-white cursor-wait'
                  : hasChanges
                  ? 'bg-white hover:bg-zinc-200 text-zinc-950 shadow-md active:scale-95'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>SAVING...</span>
                </>
              ) : isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>SAVED!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>SAVE</span>
                  <span className="hidden sm:inline-block text-[10px] opacity-75 font-normal ml-0.5">
                    (⌘S)
                  </span>
                </>
              )}
            </button>

            {/* Close Button & ESC Badge */}
            <div className="flex items-center gap-1.5 ml-1">
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/[0.04] border border-white/10 rounded-md">
                ESC
              </span>
              <button
                onClick={handleCloseAttempt}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.08] transition-colors"
                title="Close editor (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* In-Editor Search Bar */}
        {isSearchOpen && (
          <div className="px-4 py-2 bg-[#090d16] border-b border-slate-800/80 flex items-center gap-2.5 text-xs font-mono">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Find in file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--theme-accent,#e5a93c)] w-48 sm:w-64"
            />
            {searchQuery && (
              <span className="text-slate-400 text-[11px]">
                {searchMatches.length > 0
                  ? `${currentMatchIndex + 1} of ${searchMatches.length}`
                  : 'No matches'}
              </span>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMatch}
                disabled={searchMatches.length === 0}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
                title="Previous match (Shift+Enter)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNextMatch}
                disabled={searchMatches.length === 0}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
                title="Next match (Enter)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 ml-auto"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Code Editor Area */}
        <div className="relative flex-1 flex overflow-hidden bg-[#06080e]">
          {/* Left Gutter: Line Numbers */}
          <div
            ref={gutterRef}
            style={{ width: `${gutterWidth}px` }}
            className="select-none py-4 px-2 bg-[#070b13] border-r border-slate-800/80 text-right font-mono text-xs overflow-hidden shrink-0"
          >
            {Array.from({ length: totalLines }).map((_, idx) => {
              const lineNum = idx + 1;
              const isCurrent = cursorPos.line === lineNum;
              return (
                <div
                  key={lineNum}
                  style={{ height: '22px', lineHeight: '22px' }}
                  className={`text-xs font-mono transition-colors ${
                    isCurrent
                      ? 'text-white font-bold bg-white/10 -mr-2 pr-2 rounded-l'
                      : 'text-slate-600'
                  }`}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>

          {/* Code Viewing & Editing Canvas */}
          <div className="relative flex-1 overflow-hidden">
            {/* Syntax-Highlighted Render Layer Underneath */}
            <pre
              ref={preRef}
              aria-hidden="true"
              className="absolute inset-0 p-4 m-0 overflow-hidden font-mono text-xs pointer-events-none select-none text-slate-200"
              style={{
                lineHeight: '22px',
                tabSize: 2,
                whiteSpace: 'pre',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              <code>{highlightCode(content, languageInfo)}</code>
            </pre>

            {/* Native Editable Transparent Textarea on Top */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                updateCursorPosition();
              }}
              onKeyDown={handleTextareaKeyDown}
              onScroll={handleScroll}
              onClick={updateCursorPosition}
              onKeyUp={updateCursorPosition}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className="absolute inset-0 p-4 m-0 bg-transparent text-transparent caret-white font-mono text-xs resize-none focus:outline-none selection:bg-white/20 selection:text-transparent overflow-auto"
              style={{
                lineHeight: '22px',
                tabSize: 2,
                whiteSpace: 'pre',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            />
          </div>
        </div>

        {/* Loading Content Overlay */}
        {isLoadingContent && (
          <div className="absolute inset-0 z-30 bg-[#06080e]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs font-mono text-slate-300">
              Fetching {file.name} from server volume...
            </span>
          </div>
        )}

        {/* Discard Changes Warning Overlay */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b0f19] border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-bold text-white">Unsaved Changes</h4>
                  <p className="font-mono text-xs text-slate-400 mt-0.5">
                    You have unsaved changes in <span className="text-white">{file.name}</span>.
                  </p>
                </div>
              </div>
              <p className="font-mono text-xs text-slate-400">
                Are you sure you want to discard your edits and close the file editor? This cannot be
                undone.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3.5 py-1.5 rounded-xl font-mono text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Keep Editing
                </button>
                <button
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors"
                >
                  Discard & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. File-Time-Machine (Mikro-Snapshots & Split-View Diff Modal) */}
        {isTimeMachineOpen && (
          <div className="absolute inset-0 bg-[#090d16]/95 backdrop-blur-md z-40 flex flex-col p-4 sm:p-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span>File-Time-Machine: {file.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                      {revisions.length} {language === 'de' ? 'Snapshots' : 'Snapshots'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {language === 'de'
                      ? 'Revisionshistorie durchsuchen, Vorher/Nachher vergleichen und Stände per 1-Klick wiederherstellen.'
                      : 'Browse micro-snapshots, inspect side-by-side diffs, and restore previous versions in 1 click.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsTimeMachineOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Time-Machine schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body: Two columns (Revisions list on left, Split-View Diff on right) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 overflow-hidden">
              {/* Left Column: Revisions Timeline List (4 cols) */}
              <div className="md:col-span-4 bg-[#0d1117] rounded-xl border border-slate-800 p-3 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono text-slate-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{language === 'de' ? 'Gespeicherte Stände' : 'Saved Snapshots'}</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Auto-Save</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pt-2 pr-1">
                  {loadingRevisions ? (
                    <div className="p-6 text-center text-xs font-mono text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>{language === 'de' ? 'Lade Revisionshistorie...' : 'Loading snapshots...'}</span>
                    </div>
                  ) : revisions.length === 0 ? (
                    <div className="p-6 text-center text-xs font-mono text-slate-500">
                      <p className="font-semibold text-slate-400 mb-1">
                        {language === 'de' ? 'Noch keine Snapshots vorhanden' : 'No snapshots recorded yet'}
                      </p>
                      <p className="text-[11px]">
                        {language === 'de'
                          ? 'Bei jedem Klick auf "Speichern" wird automatisch ein Snapshot gesichert.'
                          : 'A micro-snapshot will automatically be captured on your next file save.'}
                      </p>
                    </div>
                  ) : (
                    revisions.map((rev) => {
                      const isSelected = selectedRevision?.id === rev.id;
                      const dateStr = new Date(rev.created_at).toLocaleString();
                      return (
                        <button
                          key={rev.id}
                          onClick={() => setSelectedRevision(rev)}
                          className={`w-full text-left p-3 rounded-xl border transition-all font-mono text-xs ${
                            isSelected
                              ? 'bg-indigo-500/15 border-indigo-500/50 shadow-md text-white'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                              <GitCommit className="w-3.5 h-3.5" />
                              <span>Rev #{rev.revision_num}</span>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {(rev.size_bytes / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{dateStr}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Split-View Diff (8 cols) */}
              <div className="md:col-span-8 bg-[#0d1117] rounded-xl border border-slate-800 flex flex-col overflow-hidden">
                {selectedRevision ? (
                  <>
                    {/* Top Action Bar for Diff */}
                    <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                        <Split className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-white">
                          {language === 'de'
                            ? `Vergleich: Revision #${selectedRevision.revision_num} vs. Aktueller Stand`
                            : `Comparison: Revision #${selectedRevision.revision_num} vs. Current`}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRestoreRevision(selectedRevision)}
                        disabled={restoringRevision || isServerSuspended}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50"
                      >
                        {restoringRevision ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{language === 'de' ? 'Stelle wieder her...' : 'Restoring...'}</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>
                              {language === 'de'
                                ? `Auf Rev #${selectedRevision.revision_num} zurücksetzen`
                                : `Restore Revision #${selectedRevision.revision_num}`}
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Diff View Column Headers */}
                    <div className="grid grid-cols-2 bg-slate-950 px-3 py-1.5 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                      <div className="text-rose-400 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>
                          {language === 'de' ? `Snapshot #${selectedRevision.revision_num}` : `Snapshot #${selectedRevision.revision_num}`}
                        </span>
                      </div>
                      <div className="text-emerald-400 font-semibold flex items-center gap-1.5 pl-3 border-l border-slate-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{language === 'de' ? 'Aktueller Editor-Inhalt' : 'Current Editor Content'}</span>
                      </div>
                    </div>

                    {/* Diff Rows */}
                    <div className="flex-1 overflow-y-auto p-2 font-mono text-xs select-text bg-[#090d16] space-y-0.5">
                      {(() => {
                        const oldLines = (selectedRevision.content || '').split('\n');
                        const newLines = content.split('\n');
                        const maxL = Math.max(oldLines.length, newLines.length);
                        const rows = [];
                        for (let i = 0; i < maxL; i++) {
                          const o = oldLines[i];
                          const n = newLines[i];
                          const isDiff = o !== n;
                          rows.push(
                            <div key={i} className="grid grid-cols-2 gap-1 text-[11px] leading-5">
                              {/* Left line (Old snapshot) */}
                              <div
                                className={`px-2 py-0.5 rounded truncate ${
                                  o === undefined
                                    ? 'bg-slate-900/30 text-slate-600'
                                    : isDiff
                                    ? 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500 font-semibold'
                                    : 'text-slate-400'
                                }`}
                              >
                                <span className="text-slate-600 select-none mr-2 w-6 inline-block text-right">
                                  {i + 1}
                                </span>
                                <span>{o ?? ''}</span>
                              </div>

                              {/* Right line (Current file) */}
                              <div
                                className={`px-2 py-0.5 rounded truncate ${
                                  n === undefined
                                    ? 'bg-slate-900/30 text-slate-600'
                                    : isDiff
                                    ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500 font-semibold'
                                    : 'text-slate-400'
                                }`}
                              >
                                <span className="text-slate-600 select-none mr-2 w-6 inline-block text-right">
                                  {i + 1}
                                </span>
                                <span>{n ?? ''}</span>
                              </div>
                            </div>
                          );
                        }
                        return rows;
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs font-mono text-slate-500 p-8 text-center">
                    {language === 'de'
                      ? 'Wähle links eine Revision aus, um den Diff-Vergleich zu sehen.'
                      : 'Select a snapshot on the left to view the diff comparison.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Editor Bottom Status Bar */}
        <div className="px-4 py-2 bg-[#0a0e18] border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-zinc-200 font-semibold">
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span>
              {totalLines} {totalLines === 1 ? 'line' : 'lines'}
            </span>
            <span className="hidden sm:inline">
              {content.length.toLocaleString()} characters
            </span>
            <span className="hidden md:inline text-slate-500">
              {(content.length / 1024).toFixed(1)} KB
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span className="hidden sm:inline">Spaces: 2</span>
            <span>UTF-8</span>
            <span className="text-slate-400">
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                Ctrl/⌘+S
              </kbd>{' '}
              to save
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
