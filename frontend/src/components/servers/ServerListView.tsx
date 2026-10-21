import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ServerCard } from './ServerCard';
import { ServerCardSkeleton, ServerTableRowSkeleton } from './ServerCardSkeleton';
import { Server, ServerStatus, PowerAction, ServerGroup } from '../../types';
import {
  Server as ServerIcon,
  Search,
  Filter,
  Plus,
  Download,
  LayoutGrid,
  List as ListIcon,
  Globe,
  Copy,
  Check,
  Terminal,
  CheckSquare,
  Square as SquareIcon,
  Play,
  RotateCw,
  Square,
  X,
  Layers,
  Loader2,
  UserCheck,
  Users,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { useTranslation } from '../../i18n/useTranslation';

export const ServerListView: React.FC = () => {
  const {
    servers,
    isLoadingServers,
    searchQuery,
    setSearchQuery,
    selectServerAndNavigate,
    addToast,
    setIsCreateServerOpen,
    setIsImportModalOpen,
    bulkPowerAction,
    pendingPowerActions,
    currentUser,
  } = useApp();

  const { language } = useTranslation();
  const isDe = language === 'de';

  // Helper to determine ownership
  const isMyServer = (server: Server) => {
    if (!currentUser) return true;
    if (server.ownerId && currentUser.id) {
      return server.ownerId === currentUser.id;
    }
    const username = currentUser.username?.toLowerCase();
    const email = currentUser.email?.toLowerCase();
    const owner = server.owner?.toLowerCase();
    const ownerEmail = server.ownerEmail?.toLowerCase();

    // If server has no owner set, treat as own for non-admin clients
    if (!owner && !ownerEmail) return true;
    return (owner && owner === username) || Boolean(ownerEmail && email && ownerEmail === email);
  };

  const myServersCount = servers.filter(isMyServer).length;
  const otherServersCount = servers.filter((s) => !isMyServer(s)).length;

  // Ownership filter: 'mine' | 'others' | 'all'
  const [ownershipFilter, setOwnershipFilter] = useState<'mine' | 'others' | 'all'>('mine');
  const [statusFilter, setStatusFilter] = useState<ServerStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Multi-Server Bulk Actions State
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionRunning, setBulkActionRunning] = useState<PowerAction | null>(null);

  // Server Groups & Folders State (User-Scoped)
  const getGroupsStorageKey = (userId?: number | string | null) => {
    return userId ? `pteronext_server_groups_${userId}` : 'pteronext_server_groups_guest';
  };

  const loadGroupsForUser = (userId?: number | string | null): ServerGroup[] => {
    try {
      const key = getGroupsStorageKey(userId);
      let saved = localStorage.getItem(key);

      // Fallback & migration from legacy non-scoped storage key
      if (!saved && userId) {
        const legacy = localStorage.getItem('pteronext_server_groups');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            // Only adopt legacy groups that either have no user_id or match the current user
            const matched = parsed
              .filter((g: any) => g && (!g.userId || String(g.userId) === String(userId)))
              .map((g: any) => ({ ...g, userId }));
            if (matched.length > 0) {
              localStorage.setItem(key, JSON.stringify(matched));
              return matched;
            }
          }
        }
      }

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Strictly enforce owner / user_id check inside each group object so groups from other users are not shown
          return parsed
            .filter((g: any) => {
              if (!g || typeof g !== 'object') return false;
              if (userId) {
                return !g.userId || String(g.userId) === String(userId);
              }
              return !g.userId;
            })
            .map((g: any) => ({
              ...g,
              userId: g.userId ?? (userId || undefined),
            }));
        }
      }
    } catch (err) {
      console.error('Failed to load server groups:', err);
    }
    return [];
  };

  const [serverGroups, setServerGroups] = useState<ServerGroup[]>(() => {
    return loadGroupsForUser(currentUser?.id);
  });

  // Reload the user's specific groups whenever the logged-in user changes or mounts
  useEffect(() => {
    setServerGroups(loadGroupsForUser(currentUser?.id));
  }, [currentUser?.id]);

  const saveGroups = (newGroups: ServerGroup[]) => {
    const currentUserId = currentUser?.id;
    const key = getGroupsStorageKey(currentUserId);
    const scopedGroups = newGroups.map((g) => ({
      ...g,
      userId: g.userId ?? (currentUserId || undefined),
    }));
    setServerGroups(scopedGroups);
    try {
      localStorage.setItem(key, JSON.stringify(scopedGroups));
    } catch (err) {
      console.error('Failed to save server groups:', err);
    }
  };

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupColorInput, setGroupColorInput] = useState('#6366f1');
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  const handleCreateOrUpdateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameInput.trim()) return;

    if (editingGroup) {
      saveGroups(
        serverGroups.map((g) =>
          g.id === editingGroup.id
            ? { ...g, name: groupNameInput.trim(), color: groupColorInput, userId: g.userId ?? currentUser?.id }
            : g
        )
      );
      addToast({
        title: isDe ? 'Gruppe aktualisiert' : 'Group Updated',
        description: groupNameInput.trim(),
        type: 'success',
      });
    } else {
      const newGroup: ServerGroup = {
        id: `group-${Date.now()}`,
        name: groupNameInput.trim(),
        color: groupColorInput,
        collapsed: false,
        serverIds: [],
        userId: currentUser?.id,
      };
      saveGroups([...serverGroups, newGroup]);
      addToast({
        title: isDe ? 'Neuer Ordner angelegt' : 'Folder Created',
        description: groupNameInput.trim(),
        type: 'success',
      });
    }

    setIsGroupModalOpen(false);
    setEditingGroup(null);
    setGroupNameInput('');
  };

  const handleDeleteGroup = (groupId: string) => {
    saveGroups(serverGroups.filter((g) => g.id !== groupId));
    addToast({
      title: isDe ? 'Ordner gelöscht' : 'Folder Deleted',
      description: isDe ? 'Instanzen bleiben erhalten' : 'Instances kept',
      type: 'info',
    });
  };

  const handleToggleGroupCollapse = (groupId: string) => {
    saveGroups(
      serverGroups.map((g) =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      )
    );
  };

  const handleMoveServerToGroup = (serverId: string, targetGroupId: string | null) => {
    const updated = serverGroups.map((g) => {
      const filtered = g.serverIds.filter((id) => id !== serverId);
      if (targetGroupId && g.id === targetGroupId) {
        return { ...g, serverIds: [...filtered, serverId] };
      }
      return { ...g, serverIds: filtered };
    });
    saveGroups(updated);
    addToast({
      title: isDe ? 'Ordner aktualisiert' : 'Folder Updated',
      description: targetGroupId ? 'Server in Ordner verschoben' : 'Aus Ordner entfernt',
      type: 'success',
    });
  };

  const getGroupNameForServer = (serverId: string) => {
    const g = serverGroups.find((grp) => {
      if (!grp.serverIds.includes(serverId)) return false;
      if (currentUser?.id && grp.userId && String(grp.userId) !== String(currentUser.id)) {
        return false;
      }
      return true;
    });
    return g ? { name: g.name, color: g.color } : null;
  };

  const filteredServers = servers.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.egg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.allocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (server.owner && server.owner.toLowerCase().includes(searchQuery.toLowerCase())) ||
      server.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ? true : server.status === statusFilter;

    const matchesCategory =
      categoryFilter === 'all' ? true : server.category === categoryFilter;

    const isMine = isMyServer(server);
    const matchesOwnership =
      ownershipFilter === 'all'
        ? true
        : ownershipFilter === 'mine'
        ? isMine
        : !isMine;

    return matchesSearch && matchesStatus && matchesCategory && matchesOwnership;
  });

  const categories = ['all', 'Gaming', 'Database', 'Applications'];

  const handleCopyIp = (e: React.MouseEvent, allocation: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(allocation);
    setCopiedId(id);
    addToast({
      title: 'Allocation Copied',
      description: `Copied ${allocation} to clipboard`,
      type: 'info',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelectServer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredServers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredServers.map((s) => s.id));
    }
  };

  const executeBulk = async (action: PowerAction) => {
    if (selectedIds.length === 0 || bulkActionRunning) return;
    try {
      setBulkActionRunning(action);
      await bulkPowerAction(selectedIds, action);
    } finally {
      setBulkActionRunning(null);
    }
  };

  return (
    <div className="space-y-6 relative pb-16">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span>
                {ownershipFilter === 'mine'
                  ? (isDe ? 'Meine Server' : 'My Servers')
                  : ownershipFilter === 'others'
                  ? (isDe ? 'Server von anderen' : 'Shared Servers')
                  : (isDe ? 'Alle Server' : 'All Server Instances')}
              </span>
              <span className="text-xs font-mono text-slate-400 bg-[#161b22] px-2.5 py-0.5 rounded-full border border-[#30363d]">
                {filteredServers.length}
              </span>
            </h1>
            {isBulkMode && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold animate-pulse">
                Bulk Mode Active
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {isLoadingServers
              ? 'Loading active instances from cluster...'
              : ownershipFilter === 'mine'
              ? (isDe ? 'Verwalte deine zugewiesenen Server & Workloads' : 'Manage your dedicated servers and workloads')
              : ownershipFilter === 'others'
              ? (isDe ? 'Server und Instanzen, die von anderen Nutzern freigegeben wurden' : 'Instances shared with you by other project owners')
              : (isDe ? 'Vollständige Übersicht aller zugewiesenen und freigegebenen Server' : 'Complete overview of all instances across the cluster')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Multi Server Bulk Access Toggle */}
          <button
            onClick={() => {
              setIsBulkMode((prev) => !prev);
              if (isBulkMode) setSelectedIds([]);
            }}
            className={`btn px-3 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all ${
              isBulkMode
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                : 'btn-secondary text-slate-300 hover:text-white border-[#30363d]'
            }`}
            title="Toggle Multi-Server Selection"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isBulkMode ? 'Exit Bulk' : 'Bulk Actions'}</span>
          </button>

          {/* View mode toggle */}
          <div className="hidden sm:flex items-center bg-[#161b22] border border-[#30363d] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#21262d] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#21262d] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => {
              setEditingGroup(null);
              setGroupNameInput('');
              setGroupColorInput('#6366f1');
              setIsGroupModalOpen(true);
            }}
            className="btn btn-secondary px-3.5 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
            title="Create a folder to organize your servers"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            <span>{isDe ? 'Neuer Ordner' : 'New Folder'}</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn btn-secondary px-3.5 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Import Project</span>
          </button>

          <button
            onClick={() => setIsCreateServerOpen(true)}
            className="btn btn-primary px-3.5 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy Instance</span>
          </button>
        </div>
      </div>

      {/* Ownership Segmented Filter: Eigene Server vs Server von anderen vs Alle */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[#161b22] border border-[#30363d] rounded-2xl">
        <div className="flex items-center gap-1.5 p-1 bg-[#0d1117] border border-[#30363d]/80 rounded-xl">
          <button
            type="button"
            onClick={() => setOwnershipFilter('mine')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              ownershipFilter === 'mine'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isDe ? 'Eigene Server' : 'My Servers'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              ownershipFilter === 'mine' ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {myServersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOwnershipFilter('others')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              ownershipFilter === 'others'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>{isDe ? 'Server von anderen' : 'Shared with Me'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              ownershipFilter === 'others' ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {otherServersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOwnershipFilter('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              ownershipFilter === 'all'
                ? 'bg-slate-700 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ServerIcon className="w-3.5 h-3.5 text-slate-300" />
            <span>{isDe ? 'Alle Server' : 'All Servers'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              ownershipFilter === 'all' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {servers.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono px-2">
          {ownershipFilter === 'mine' && (isDe ? 'Zeigt nur Server, deren Eigentümer du bist' : 'Showing servers owned by your account')}
          {ownershipFilter === 'others' && (isDe ? 'Zeigt geteilte Server und Gast-Instanzen' : 'Showing shared or guest instances')}
          {ownershipFilter === 'all' && (isDe ? 'Gesamte Flottenübersicht' : 'Complete fleet overview')}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#161b22] rounded-xl p-4 border border-[#30363d] space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by server name, egg, IP port, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-[#21262d] text-white border border-[#30363d]'
                    : 'bg-[#0d1117] text-slate-400 hover:text-white border border-[#30363d]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filters & Bulk Select All */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pt-2 border-t border-[#30363d]/80">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 font-mono">
              <Filter className="w-3 h-3 text-slate-400" /> Status:
            </span>

            {[
              { id: 'all', label: 'All' },
              { id: 'running', label: 'Running' },
              { id: 'starting', label: 'Starting' },
              { id: 'stopped', label: 'Stopped' },
              { id: 'offline', label: 'Offline' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id as any)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
                  statusFilter === item.id
                    ? 'bg-[#21262d] text-white font-medium border border-[#30363d]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {isBulkMode && filteredServers.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="text-xs font-mono text-indigo-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors whitespace-nowrap ml-auto"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>
                {selectedIds.length === filteredServers.length
                  ? 'Deselect All'
                  : `Select All (${filteredServers.length})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Server Listing: Folders & Groups / Flat Listing */}
      {viewMode === 'grid' ? (
        <div className="space-y-6">
          {isLoadingServers ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ServerCardSkeleton count={6} />
            </div>
          ) : serverGroups.length > 0 ? (
            <>
              {/* Groups Sections */}
              {serverGroups.map((group) => {
                const groupServers = filteredServers.filter((s) => group.serverIds.includes(s.id));
                const isOver = dragOverGroupId === group.id;

                return (
                  <div
                    key={group.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverGroupId === group.id) setDragOverGroupId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverGroupId(null);
                      const droppedId = e.dataTransfer.getData('text/plain');
                      if (droppedId) handleMoveServerToGroup(droppedId, group.id);
                    }}
                    className={`rounded-2xl border transition-all ${
                      isOver
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                        : 'border-[#30363d]/80 bg-[#161b22]/40'
                    } p-4 space-y-3.5`}
                  >
                    {/* Folder Header */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div
                        onClick={() => handleToggleGroupCollapse(group.id)}
                        className="flex items-center gap-2.5 cursor-pointer select-none group/hdr"
                      >
                        <button
                          type="button"
                          className="p-1 text-slate-400 group-hover/hdr:text-white transition-colors"
                        >
                          {group.collapsed ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <div
                          className="p-1.5 rounded-lg border flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${group.color || '#6366f1'}15`,
                            borderColor: `${group.color || '#6366f1'}40`,
                            color: group.color || '#818cf8',
                          }}
                        >
                          {group.collapsed ? (
                            <Folder className="w-4 h-4" />
                          ) : (
                            <FolderOpen className="w-4 h-4" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-white group-hover/hdr:text-indigo-300 transition-colors">
                          {group.name}
                        </h3>
                        <span className="text-xs font-mono text-slate-400 bg-[#0d1117] px-2 py-0.5 rounded-full border border-[#30363d]">
                          {groupServers.length} {groupServers.length === 1 ? 'Server' : 'Server'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroup(group);
                            setGroupNameInput(group.name);
                            setGroupColorInput(group.color || '#6366f1');
                            setIsGroupModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
                          title={isDe ? 'Ordner bearbeiten' : 'Edit Folder'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title={isDe ? 'Ordner entfernen' : 'Delete Folder'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Folder Content */}
                    {!group.collapsed && (
                      <>
                        {groupServers.length === 0 ? (
                          <div className="py-6 border border-dashed border-[#30363d] rounded-xl text-center text-xs text-slate-500 font-mono">
                            {isDe
                              ? 'Ziehe Instanzen per Drag & Drop hierher'
                              : 'Drag & Drop instances here to add them to this folder'}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupServers.map((server) => {
                              const gInfo = getGroupNameForServer(server.id);
                              return (
                                <ServerCard
                                  key={server.id}
                                  server={server}
                                  isBulkMode={isBulkMode}
                                  isSelected={selectedIds.includes(server.id)}
                                  onToggleSelect={() => toggleSelectServer(server.id)}
                                  groupName={gInfo?.name}
                                  groupColor={gInfo?.color}
                                  availableGroups={serverGroups}
                                  onMoveToGroup={handleMoveServerToGroup}
                                />
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Ungrouped Section */}
              {(() => {
                const ungroupedServers = filteredServers.filter(
                  (s) => !serverGroups.some((g) => g.serverIds.includes(s.id))
                );
                if (ungroupedServers.length === 0) return null;

                return (
                  <div className="rounded-2xl border border-[#30363d]/60 bg-[#161b22]/20 p-4 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-slate-500" />
                      <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                        {isDe ? 'Ohne Ordner (Nicht zugewiesen)' : 'Ungrouped Instances'}
                      </h3>
                      <span className="text-xs font-mono text-slate-400 bg-[#0d1117] px-2 py-0.5 rounded-full border border-[#30363d]">
                        {ungroupedServers.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ungroupedServers.map((server) => (
                        <ServerCard
                          key={server.id}
                          server={server}
                          isBulkMode={isBulkMode}
                          isSelected={selectedIds.includes(server.id)}
                          onToggleSelect={() => toggleSelectServer(server.id)}
                          availableGroups={serverGroups}
                          onMoveToGroup={handleMoveServerToGroup}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            /* Flat Grid View when no folders exist */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  isBulkMode={isBulkMode}
                  isSelected={selectedIds.includes(server.id)}
                  onToggleSelect={() => toggleSelectServer(server.id)}
                  availableGroups={serverGroups}
                  onMoveToGroup={handleMoveServerToGroup}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-[#161b22] rounded-xl border border-[#30363d] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#161b22] text-slate-400 border-b border-[#30363d] font-medium">
                <tr>
                  {isBulkMode && <th className="py-3 px-4 w-10">Select</th>}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Instance / Egg</th>
                  <th className="py-3 px-4">Ordner</th>
                  <th className="py-3 px-4">Node & Allocation</th>
                  <th className="py-3 px-4">CPU Usage</th>
                  <th className="py-3 px-4">Memory</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]/70">
                {isLoadingServers ? (
                  <ServerTableRowSkeleton rows={5} />
                ) : (
                  filteredServers.map((server) => {
                    const isSelected = selectedIds.includes(server.id);
                    const pendingAction = pendingPowerActions[server.id];
                    const gInfo = getGroupNameForServer(server.id);

                    return (
                      <tr
                        key={server.id}
                        onClick={() => {
                          if (isBulkMode) {
                            toggleSelectServer(server.id);
                          } else {
                            selectServerAndNavigate(server, 'console');
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-500/10 hover:bg-indigo-500/15'
                            : 'hover:bg-[#1c2128]'
                        }`}
                      >
                        {isBulkMode && (
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div
                              onClick={() => toggleSelectServer(server.id)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'border-[#30363d] bg-[#0d1117] hover:border-slate-500'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </td>
                        )}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={server.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-white truncate max-w-[200px]">
                            {server.name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{server.egg}</p>
                        </td>
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          {gInfo ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md border"
                              style={{
                                backgroundColor: `${gInfo.color || '#6366f1'}15`,
                                borderColor: `${gInfo.color || '#6366f1'}40`,
                                color: gInfo.color || '#818cf8',
                              }}
                            >
                              <Folder className="w-2.5 h-2.5" />
                              <span>{gInfo.name}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => handleCopyIp(e, server.allocation, server.id)}
                              className="flex items-center gap-1 text-[11px] font-mono text-slate-300 bg-[#0d1117] hover:bg-[#21262d] px-2 py-0.5 rounded border border-[#30363d] transition-colors"
                            >
                              <Globe className="w-3 h-3 text-slate-400" />
                              <span>{server.allocation}</span>
                              {copiedId === server.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-500" />
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{server.node}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-slate-200">
                            {server.stats.cpu}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="text-slate-300">
                            {(server.stats.memory / 1024).toFixed(1)} /{' '}
                            {(server.stats.memoryLimit / 1024).toFixed(0)} GB
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectServerAndNavigate(server, 'console');
                            }}
                            className="p-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] transition-colors"
                          >
                            <Terminal className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingServers && filteredServers.length === 0 && (
        <div className="py-16 text-center bg-[#161b22] rounded-xl border border-[#30363d]">
          <ServerIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">
            {ownershipFilter === 'others'
              ? isDe
                ? 'Keine Server von anderen Benutzern freigegeben'
                : 'No servers from other users found'
              : isDe
              ? 'Keine Server gefunden'
              : 'No servers found'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {ownershipFilter === 'others'
              ? isDe
                ? 'Aktuell wurden dir keine Server von anderen Benutzern freigegeben.'
                : 'No shared servers or instances from other users are currently available.'
              : isDe
              ? 'Keine Server entsprechen deinen aktuellen Filtern.'
              : 'No servers matched your current filter query.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setCategoryFilter('all');
              setOwnershipFilter('all');
            }}
            className="mt-4 px-3.5 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-xs text-slate-300 border border-[#30363d] transition-colors"
          >
            {isDe ? 'Filter zurücksetzen' : 'Reset Filters'}
          </button>
        </div>
      )}

      {/* Floating Multi-Server Bulk Action Bar */}
      {isBulkMode && selectedIds.length > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-[#161b22]/95 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-3 shadow-2xl flex items-center gap-3 max-w-2xl w-full justify-between">
            <div className="flex items-center gap-2.5 pl-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
              <span className="text-xs font-semibold text-white font-mono">
                {selectedIds.length} server(s) selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => executeBulk('start')}
                disabled={Boolean(bulkActionRunning)}
                className="btn px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {bulkActionRunning === 'start' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Start</span>
              </button>

              <button
                onClick={() => executeBulk('restart')}
                disabled={Boolean(bulkActionRunning)}
                className="btn px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {bulkActionRunning === 'restart' ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5" />
                )}
                <span>Restart</span>
              </button>

              <button
                onClick={() => executeBulk('stop')}
                disabled={Boolean(bulkActionRunning)}
                className="btn px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {bulkActionRunning === 'stop' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Stop</span>
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-400 hover:text-white transition-colors ml-1"
                title="Deselect All"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Server Group Create/Edit Modal */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => {
          setIsGroupModalOpen(false);
          setEditingGroup(null);
        }}
        title={
          editingGroup
            ? isDe
              ? 'Ordner bearbeiten'
              : 'Edit Folder'
            : isDe
            ? 'Neuen Server-Ordner erstellen'
            : 'Create Server Folder'
        }
      >
        <form onSubmit={handleCreateOrUpdateGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-bold">
              {isDe ? 'Ordnername' : 'Folder Name'}
            </label>
            <input
              type="text"
              required
              placeholder={isDe ? 'z. B. Production Minecraft, Bots, Staging...' : 'e.g. Production, Bots, Staging...'}
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-2 font-bold">
              {isDe ? 'Farbe' : 'Color Accent'}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { hex: '#6366f1', name: 'Indigo' },
                { hex: '#8b5cf6', name: 'Purple' },
                { hex: '#06b6d4', name: 'Cyan' },
                { hex: '#10b981', name: 'Emerald' },
                { hex: '#f59e0b', name: 'Amber' },
                { hex: '#f43f5e', name: 'Rose' },
                { hex: '#64748b', name: 'Slate' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setGroupColorInput(c.hex)}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                    groupColorInput === c.hex ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {groupColorInput === c.hex && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              onClick={() => {
                setIsGroupModalOpen(false);
                setEditingGroup(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
            >
              {isDe ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn btn-primary px-4 py-2 text-xs font-semibold"
            >
              {editingGroup
                ? isDe
                  ? 'Speichern'
                  : 'Save Changes'
                : isDe
                ? 'Ordner anlegen'
                : 'Create Folder'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
