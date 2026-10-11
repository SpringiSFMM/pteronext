import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { FileItem } from '../../../types';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  File,
  Plus,
  Upload,
  Trash2,
  Edit3,
  ChevronRight,
  FolderPlus,
  Download,
  FileArchive,
  Terminal,
  Settings,
  Database,
  Search,
  HardDrive,
  CornerLeftUp,
  CheckSquare,
  Square,
  AlertTriangle,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { CodeEditorModal } from './file-manager/CodeEditorModal';

// Helper to determine parent directory path
export function getParentDir(path: string): string {
  const normalized = path.replace(/\/+$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return normalized.substring(0, lastSlash);
}

// Check if a file extension is editable text
export function isEditableFileType(name: string): boolean {
  const lower = name.toLowerCase();
  const editableExtensions = [
    '.yml',
    '.yaml',
    '.json',
    '.properties',
    '.conf',
    '.cfg',
    '.ini',
    '.env',
    '.sh',
    '.bash',
    '.zsh',
    '.txt',
    '.log',
    '.sql',
    '.md',
    '.xml',
    '.html',
    '.js',
    '.ts',
    '.toml',
  ];
  return editableExtensions.some((ext) => lower.endsWith(ext));
}

export const FileManagerTab: React.FC = () => {
  const {
    selectedServer,
    files,
    loadDirectory,
    saveFileContent,
    createFile,
    createFolder,
    deleteFile,
    renameFile,
    uploadFiles,
    uploadRawFiles,
    installMinecraftVersion,
    addToast,
  } = useApp();

  const { language } = useTranslation();
  const isServerSuspended = Boolean(selectedServer?.isSuspended || selectedServer?.suspended);

  // Navigation state
  const [currentPath, setCurrentPath] = useState('/');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<{
    percent: number;
    fileName: string;
    loaded: number;
    total: number;
  } | null>(null);

  // Automatically fetch real files whenever path or selected server changes
  useEffect(() => {
    if (selectedServer?.uuid) {
      loadDirectory(currentPath);
    }
  }, [selectedServer?.uuid, currentPath, loadDirectory]);

  // Code Editor modal state
  const [activeEditorFile, setActiveEditorFile] = useState<FileItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // New File modal state
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileTypeTemplate, setNewFileTypeTemplate] = useState('yaml');

  // New Folder modal state
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);

  // Binary info modal state
  const [binaryTarget, setBinaryTarget] = useState<FileItem | null>(null);

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Clipboard copy state for path
  const [isPathCopied, setIsPathCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file byte size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get matching icon for file types
  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />;
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) {
      return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (lower.endsWith('.json')) {
      return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (lower.endsWith('.properties') || lower.endsWith('.conf') || lower.endsWith('.cfg') || lower.endsWith('.ini')) {
      return <Settings className="w-4 h-4 text-violet-400 shrink-0" />;
    }
    if (lower.endsWith('.sh') || lower.endsWith('.bash')) {
      return <Terminal className="w-4 h-4 text-fuchsia-400 shrink-0" />;
    }
    if (lower.endsWith('.sql')) {
      return <Database className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (lower.endsWith('.txt') || lower.endsWith('.log')) {
      return <FileText className="w-4 h-4 text-amber-300 shrink-0" />;
    }
    if (lower.endsWith('.tar.gz') || lower.endsWith('.zip') || lower.endsWith('.jar')) {
      return <FileArchive className="w-4 h-4 text-rose-400 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  // Generate interactive breadcrumb segments
  const breadcrumbSegments = useMemo(() => {
    const segments: { name: string; path: string }[] = [{ name: 'Root', path: '/' }];
    if (currentPath === '/') return segments;

    const parts = currentPath.split('/').filter(Boolean);
    let accum = '';
    for (const part of parts) {
      accum += `/${part}`;
      segments.push({ name: part, path: accum });
    }
    return segments;
  }, [currentPath]);

  // Current folder's direct children
  const currentItems = useMemo(() => {
    const directChildren = files.filter(
      (f) => getParentDir(f.path) === currentPath && f.path !== currentPath
    );

    // Apply name filter if user typed in search bar
    const filtered = filterQuery.trim()
      ? directChildren.filter((f) =>
          f.name.toLowerCase().includes(filterQuery.toLowerCase())
        )
      : directChildren;

    // Sort: directories first (alphabetical), then files (alphabetical)
    return filtered.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [files, currentPath, filterQuery]);

  // Handle opening or navigating to a file/folder
  const handleItemClick = (file: FileItem) => {
    if (file.is_locked || file.isLocked) {
      addToast({
        title: 'Zugriff verweigert (Locked)',
        description: `Der Pfad "${file.name}" ist durch Sicherheitsregeln (RBAC Path-Rules) gesperrt.`,
        type: 'warning',
      });
      return;
    }

    if (file.type === 'directory') {
      setCurrentPath(file.path);
      setFilterQuery('');
      setSelectedPaths(new Set());
      addToast({
        title: 'Navigated to Folder',
        description: `Entered ${file.path}`,
        type: 'info',
      });
      return;
    }

    // If it's editable or text file, open code editor
    if (file.editable !== false && (file.editable || isEditableFileType(file.name))) {
      setActiveEditorFile(file);
      setIsEditorOpen(true);
    } else {
      // Binary file
      setBinaryTarget(file);
    }
  };

  // Handle parent directory navigation
  const handleGoToParent = () => {
    if (currentPath === '/') return;
    const parent = getParentDir(currentPath);
    setCurrentPath(parent);
    setFilterQuery('');
    setSelectedPaths(new Set());
  };

  // Create new file submit
  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFileName.trim();
    if (!trimmed) return;

    let initialTemplate = '';
    if (newFileTypeTemplate === 'yaml') {
      initialTemplate = `# Configuration: ${trimmed}\nversion: 1.0\nenabled: true\nsettings:\n  debug: false\n`;
    } else if (newFileTypeTemplate === 'json') {
      initialTemplate = `{\n  "name": "${trimmed.replace(/\.[^/.]+$/, '')}",\n  "version": "1.0.0",\n  "enabled": true\n}\n`;
    } else if (newFileTypeTemplate === 'sh') {
      initialTemplate = `#!/bin/bash\n# Script: ${trimmed}\necho "Executing ${trimmed}..."\n`;
    } else if (newFileTypeTemplate === 'properties') {
      initialTemplate = `# Server properties\n# Generated ${new Date().toLocaleDateString()}\nenabled=true\nport=25565\n`;
    }

    const filePath = currentPath === '/' ? `/${trimmed}` : `${currentPath}/${trimmed}`;

    const newFileItem: FileItem = {
      name: trimmed,
      path: filePath,
      type: 'file',
      size: initialTemplate.length,
      modified: 'Just now',
      permissions: '-rw-r--r--',
      editable: true,
      content: initialTemplate,
    };

    createFile(newFileItem);
    setIsNewFileModalOpen(false);
    setNewFileName('');

    // Open immediately in Code Editor for smooth experience
    setActiveEditorFile(newFileItem);
    setIsEditorOpen(true);
  };

  // Create new folder submit
  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    const folderPath = currentPath === '/' ? `/${trimmed}` : `${currentPath}/${trimmed}`;
    createFolder(folderPath, trimmed);
    setIsNewFolderModalOpen(false);
    setNewFolderName('');
  };

  // Rename submit
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renameTarget.name) {
      setRenameTarget(null);
      return;
    }

    const newPath = currentPath === '/' ? `/${trimmed}` : `${currentPath}/${trimmed}`;
    renameFile(renameTarget.path, newPath, trimmed);
    setRenameTarget(null);
    setRenameValue('');
  };

  // Single file delete confirmation
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteFile(deleteTarget.path);
    selectedPaths.delete(deleteTarget.path);
    setSelectedPaths(new Set(selectedPaths));
    setDeleteTarget(null);
  };

  // Batch delete confirmation
  const handleConfirmBatchDelete = () => {
    selectedPaths.forEach((path) => {
      deleteFile(path);
    });
    setSelectedPaths(new Set());
    setIsBatchDeleteModalOpen(false);
  };

  // Trigger file download
  const handleDownloadFile = (file: FileItem) => {
    const content = file.content || `[Binary File Content: ${file.name}]`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({
      title: 'Download Started',
      description: `Downloading ${file.name}`,
      type: 'info',
    });
  };

  // Handle local file uploads
  const processUploadedFileList = async (fileList: FileList) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    if (uploadRawFiles) {
      setUploadProgress({
        percent: 0,
        fileName: rawFiles.length === 1 ? rawFiles[0].name : `${rawFiles.length} files`,
        loaded: 0,
        total: rawFiles.reduce((acc, f) => acc + f.size, 0),
      });

      const ok = await uploadRawFiles(currentPath, rawFiles, (percent, loaded, total) => {
        setUploadProgress({
          percent,
          fileName: rawFiles.length === 1 ? rawFiles[0].name : `${rawFiles.length} files`,
          loaded,
          total,
        });
      });

      if (ok) {
        setUploadProgress((prev) => (prev ? { ...prev, percent: 100 } : null));
        setTimeout(() => {
          setUploadProgress(null);
        }, 1200);
        await loadDirectory(currentPath);
        return;
      } else {
        setUploadProgress(null);
      }
    }

    // Fallback if raw upload failed or offline
    const newItems: FileItem[] = [];
    let pendingReads = rawFiles.length;

    rawFiles.forEach((uploaded) => {
      const filePath = currentPath === '/' ? `/${uploaded.name}` : `${currentPath}/${uploaded.name}`;
      const isText = isEditableFileType(uploaded.name) || uploaded.size < 100000;

      if (isText) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = (event.target?.result as string) || '';
          newItems.push({
            name: uploaded.name,
            path: filePath,
            type: 'file',
            size: uploaded.size,
            modified: 'Just now',
            permissions: '-rw-r--r--',
            editable: true,
            content: text,
          });
          pendingReads--;
          if (pendingReads === 0) {
            uploadFiles(newItems);
          }
        };
        reader.onerror = () => {
          pendingReads--;
          if (pendingReads === 0) uploadFiles(newItems);
        };
        reader.readAsText(uploaded);
      } else {
        newItems.push({
          name: uploaded.name,
          path: filePath,
          type: 'file',
          size: uploaded.size,
          modified: 'Just now',
          permissions: '-rw-r--r--',
          editable: false,
        });
        pendingReads--;
        if (pendingReads === 0) {
          uploadFiles(newItems);
        }
      }
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFileList(e.target.files);
      e.target.value = '';
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFileList(e.dataTransfer.files);
    }
  };

  // Selection toggle
  const toggleSelectPath = (path: string) => {
    const updated = new Set(selectedPaths);
    if (updated.has(path)) {
      updated.delete(path);
    } else {
      updated.add(path);
    }
    setSelectedPaths(updated);
  };

  const toggleSelectAll = () => {
    if (selectedPaths.size === currentItems.length && currentItems.length > 0) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(currentItems.map((item) => item.path)));
    }
  };

  // Copy current directory path
  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentPath);
    setIsPathCopied(true);
    addToast({
      title: 'Path Copied',
      description: `Copied ${currentPath} to clipboard`,
      type: 'info',
    });
    setTimeout(() => setIsPathCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Upload Progress Status Indicator */}
      {uploadProgress && (
        <div className="cyber-glass rounded-2xl p-4 border border-emerald-500/30 bg-emerald-950/20 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-white font-medium truncate max-w-[280px]">
                Uploading: <span className="text-emerald-300 font-bold">{uploadProgress.fileName}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                {formatSize(uploadProgress.loaded)} / {formatSize(uploadProgress.total)}
              </span>
              <span className="text-emerald-400 font-bold text-sm">
                {uploadProgress.percent}%
              </span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Suspension Alert Banner */}
      {isServerSuspended && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-white block">
                {language === 'de' ? 'Dateisystem gesperrt (Server suspendiert)' : 'Filesystem Locked (Server Suspended)'}
              </span>
              <span>
                {language === 'de'
                  ? 'Dieser Server ist administrativ suspendiert. Schreibvorgänge, Uploads, Löschungen und Umbenennungen sind deaktiviert.'
                  : 'This server is administratively suspended. Writing, uploading, deleting, and renaming files are locked.'}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider shrink-0">
            READ ONLY
          </span>
        </div>
      )}

      {/* Top Toolbar: Breadcrumbs & Navigation */}
      <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        {/* Interactive Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 font-mono text-xs overflow-x-auto py-1 scrollbar-none">
          <div className="flex items-center gap-1 text-slate-400 shrink-0 mr-1">
            <HardDrive className="w-3.5 h-3.5 text-zinc-300" />
          </div>

          {breadcrumbSegments.map((seg, idx) => {
            const isLast = idx === breadcrumbSegments.length - 1;
            return (
              <React.Fragment key={seg.path}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                <button
                  onClick={() => {
                    setCurrentPath(seg.path);
                    setFilterQuery('');
                    setSelectedPaths(new Set());
                  }}
                  className={`px-2 py-1 rounded-lg transition-colors truncate max-w-[160px] sm:max-w-none ${
                    isLast
                      ? 'text-white font-bold bg-slate-800/80 border border-slate-700/80 shadow-sm'
                      : 'text-zinc-300 hover:text-white hover:bg-slate-800/60 font-medium'
                  }`}
                  title={`Navigate to ${seg.path}`}
                >
                  {seg.name}
                </button>
              </React.Fragment>
            );
          })}

          <button
            onClick={handleCopyPath}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors ml-1"
            title="Copy current path"
          >
            {isPathCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Action Buttons: New File, New Folder, Upload File */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {/* New File */}
          <button
            disabled={isServerSuspended}
            onClick={() => {
              setNewFileName('');
              setIsNewFileModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-mono text-xs font-semibold hover:border-slate-600 transition-all active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-300" />
            <span>New File</span>
          </button>

          {/* New Folder */}
          <button
            disabled={isServerSuspended}
            onClick={() => {
              setNewFolderName('');
              setIsNewFolderModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-mono text-xs font-semibold hover:border-slate-600 transition-all active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>New Folder</span>
          </button>

          {/* Upload File */}
          <button
            disabled={isServerSuspended}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          {/* Hidden file input */}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Directory Filter & Batch Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        {/* Search within folder */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={`Filter ${currentItems.length} items in ${currentPath === '/' ? 'root' : currentPath.split('/').pop()}...`}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-[#0a0e18] border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)] transition-colors"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Batch Selection Banner */}
        {selectedPaths.size > 0 && (
          <div className="flex items-center gap-2 font-mono text-xs bg-slate-900 border border-white/20 px-3 py-1.5 rounded-xl shadow-md">
            <span className="text-zinc-200 font-semibold">{selectedPaths.size} selected</span>
            <div className="h-3 w-px bg-slate-700" />
            <button
              onClick={() => setIsBatchDeleteModalOpen(true)}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
            <button
              onClick={() => setSelectedPaths(new Set())}
              className="text-slate-400 hover:text-white ml-1 text-[11px]"
            >
              Deselect
            </button>
          </div>
        )}
      </div>

      {/* Files Table / List Canvas */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`cyber-glass rounded-2xl border transition-all duration-200 overflow-hidden relative ${
          isDraggingOver
            ? 'border-[var(--theme-accent,#e5a93c)] shadow-lg bg-white/[0.03]'
            : 'border-slate-800'
        }`}
      >
        {/* Drag Over Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none p-6 text-center">
            <div className="p-4 rounded-2xl bg-white/10 border border-white/20 text-white mb-3 animate-bounce">
              <Upload className="w-8 h-8" />
            </div>
            <p className="font-mono text-sm font-bold text-white">Drop files to upload</p>
            <p className="font-mono text-xs text-slate-400 mt-1">
              Files will be saved into <span className="text-white font-semibold">{currentPath}</span>
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Select All"
                  >
                    {selectedPaths.size === currentItems.length && currentItems.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-white" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Name</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4 hidden md:table-cell">Permissions</th>
                <th className="py-3 px-4 hidden sm:table-cell">Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {/* Parent Directory (..) Row */}
              {currentPath !== '/' && (
                <tr
                  onClick={handleGoToParent}
                  className="hover:bg-slate-900/60 cursor-pointer transition-colors group bg-slate-950/30"
                >
                  <td className="py-3 px-3 text-center text-slate-600">
                    <CornerLeftUp className="w-3.5 h-3.5 inline text-zinc-300 group-hover:-translate-y-0.5 transition-transform" />
                  </td>
                  <td colSpan={5} className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                      <span className="font-bold text-slate-300 group-hover:text-white transition-colors">
                        ..
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        (Go up to {getParentDir(currentPath)})
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Items List */}
              {currentItems.length > 0 ? (
                currentItems.map((file) => {
                  const isSelected = selectedPaths.has(file.path);
                  const isDir = file.type === 'directory';
                  const isLocked = Boolean(file.is_locked || file.isLocked);

                  return (
                    <tr
                      key={file.path}
                      onClick={() => handleItemClick(file)}
                      className={`cursor-pointer transition-colors group ${
                        isLocked
                          ? 'opacity-50 hover:bg-rose-950/10 cursor-not-allowed'
                          : isSelected
                          ? 'bg-white/[0.06] hover:bg-white/[0.09]'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isLocked) toggleSelectPath(file.path);
                        }}
                      >
                        <button
                          type="button"
                          disabled={isLocked}
                          className="text-slate-500 group-hover:text-slate-300 transition-colors disabled:opacity-40"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-white" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Name & Icon */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(file)}
                          <span
                            className={`font-medium transition-colors truncate max-w-[240px] sm:max-w-md ${
                              isLocked
                                ? 'text-slate-400 italic line-through'
                                : isDir
                                ? 'text-white font-semibold group-hover:text-white'
                                : 'text-slate-200 group-hover:text-white'
                            }`}
                          >
                            {file.name}
                          </span>
                          {isLocked && (
                            <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <Lock className="w-2.5 h-2.5" />
                              LOCKED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Size */}
                      <td className="py-3 px-4 text-slate-400">
                        {isDir ? '-' : formatSize(file.size)}
                      </td>

                      {/* Permissions */}
                      <td className="py-3 px-4 text-slate-500 hidden md:table-cell">
                        {file.permissions}
                      </td>

                      {/* Modified */}
                      <td className="py-3 px-4 text-slate-400 hidden sm:table-cell">
                        {file.modified}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit File Button */}
                          {!isDir && (file.editable || isEditableFileType(file.name)) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveEditorFile(file);
                                setIsEditorOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                              title="Edit in Code Editor"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Download Button */}
                          {!isDir && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadFile(file);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Rename Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget(file);
                              setRenameValue(file.name);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Rename"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(file);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Folder className="w-10 h-10 text-slate-700" />
                      <p className="font-mono text-xs text-slate-400">
                        {filterQuery
                          ? `No items matching "${filterQuery}"`
                          : 'This directory is empty'}
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => {
                            setNewFileName('');
                            setIsNewFileModalOpen(true);
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-zinc-300 font-mono text-xs transition-colors"
                        >
                          + New File
                        </button>
                        <button
                          onClick={() => {
                            setNewFolderName('');
                            setIsNewFolderModalOpen(true);
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono text-xs transition-colors"
                        >
                          + New Folder
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Editor Modal */}
      {isEditorOpen && activeEditorFile && (
        <CodeEditorModal
          file={activeEditorFile}
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setActiveEditorFile(null);
          }}
          onSave={(path, content) => {
            saveFileContent(path, content);
            // Update active file in local state as well
            setActiveEditorFile((prev) => (prev ? { ...prev, content } : null));
          }}
        />
      )}

      {/* New File Modal */}
      <Modal
        isOpen={isNewFileModalOpen}
        onClose={() => setIsNewFileModalOpen(false)}
        title="Create New File"
        subtitle={`Directory: ${currentPath}`}
        icon={<FileCode className="w-4 h-4 text-zinc-300" />}
        badge="NEW FILE"
        badgeColor="default"
      >
        <form onSubmit={handleCreateFileSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block uppercase text-slate-400 mb-1.5 font-semibold">
              File Name & Extension
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. settings.yml, app.json, script.sh"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            />
          </div>

          <div>
            <label className="block uppercase text-slate-400 mb-1.5 font-semibold">
              Starter Template
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'yaml', label: 'YAML (.yml)' },
                { id: 'json', label: 'JSON (.json)' },
                { id: 'sh', label: 'Shell (.sh)' },
                { id: 'properties', label: 'Config (.properties)' },
              ].map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setNewFileTypeTemplate(tmpl.id)}
                  className={`px-3 py-2 rounded-xl text-center border transition-all ${
                    newFileTypeTemplate === tmpl.id
                      ? 'bg-white/10 text-white border-white/30 font-semibold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewFileModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold transition-all shadow-md active:scale-95"
            >
              Create & Edit
            </button>
          </div>
        </form>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        isOpen={isNewFolderModalOpen}
        onClose={() => setIsNewFolderModalOpen(false)}
        title="Create New Directory"
        subtitle={`Directory: ${currentPath}`}
        icon={<FolderPlus className="w-4 h-4 text-amber-400" />}
        badge="DIRECTORY"
        badgeColor="amber"
      >
        <form onSubmit={handleCreateFolderSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block uppercase text-slate-400 mb-1.5 font-semibold">
              Folder Name
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. plugins, config, backups"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewFolderModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)]"
            >
              Create Folder
            </button>
          </div>
        </form>
      </Modal>

      {/* Rename Modal */}
      {renameTarget && (
        <Modal
          isOpen={Boolean(renameTarget)}
          onClose={() => setRenameTarget(null)}
          title="Rename Item"
          subtitle={`Current path: ${renameTarget.path}`}
          icon={<Edit3 className="w-4 h-4 text-purple-400" />}
          badge="RENAME"
          badgeColor="purple"
        >
          <form onSubmit={handleRenameSubmit} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block uppercase text-slate-400 mb-1.5 font-semibold">
                New Name
              </label>
              <input
                type="text"
                required
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold transition-all shadow-md active:scale-95"
              >
                Rename
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Single File Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title={`Delete ${deleteTarget.type === 'directory' ? 'Folder' : 'File'}`}
          subtitle={`Are you sure you want to permanently delete "${deleteTarget.name}"?`}
          icon={<Trash2 className="w-4 h-4 text-rose-400" />}
          badge="DESTRUCTIVE"
          badgeColor="rose"
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">This action cannot be undone.</p>
                {deleteTarget.type === 'directory' && (
                  <p className="text-slate-400 text-[11px] mt-1">
                    All nested files and subdirectories inside this folder will also be removed.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-[0_0_12px_rgba(225,29,72,0.3)]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Batch Delete Confirmation Modal */}
      {isBatchDeleteModalOpen && (
        <Modal
          isOpen={isBatchDeleteModalOpen}
          onClose={() => setIsBatchDeleteModalOpen(false)}
          title="Delete Selected Items"
          subtitle={`Deleting ${selectedPaths.size} item(s)`}
          icon={<Trash2 className="w-4 h-4 text-rose-400" />}
          badge="BATCH DELETE"
          badgeColor="rose"
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">
                  You are about to delete {selectedPaths.size} files and/or folders.
                </p>
                <p className="text-slate-400 text-[11px] mt-1">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-[0_0_12px_rgba(225,29,72,0.3)]"
              >
                Delete {selectedPaths.size} Items
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Binary / Non-text File Modal */}
      {binaryTarget && (
        <Modal
          isOpen={Boolean(binaryTarget)}
          onClose={() => setBinaryTarget(null)}
          title="Binary / Archive File"
          subtitle={binaryTarget.name}
          icon={<FileArchive className="w-4 h-4 text-slate-300" />}
          badge="BINARY FILE"
          badgeColor="default"
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Path:</span>
                <span className="text-white">{binaryTarget.path}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Size:</span>
                <span className="text-zinc-300">{formatSize(binaryTarget.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Modified:</span>
                <span className="text-slate-300">{binaryTarget.modified}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Permissions:</span>
                <span className="text-slate-300">{binaryTarget.permissions}</span>
              </div>
            </div>

            <p className="text-slate-400">
              This is a compiled binary or compressed archive. It cannot be opened in the plain-text
              code editor. You can download this file to your local computer.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBinaryTarget(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownloadFile(binaryTarget);
                  setBinaryTarget(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold transition-all shadow-md active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
