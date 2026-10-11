import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { COLOR_THEMES, ColorTheme } from '../../types';
import {
  Search,
  Server,
  HardDrive,
  Users,
  Package,
  Database,
  Terminal,
  Activity,
  Sliders,
  Plus,
  Palette,
  Power,
  Key,
  ExternalLink,
  FolderTree,
  Calendar,
  Settings,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    servers,
    selectServerAndNavigate,
    setActiveView,
    selectedServer,
    handlePowerAction,
    colorTheme,
    setColorTheme,
    openAccountSettings,
    setIsCreateServerOpen,
    addToast,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Command items collection
  const items = useMemo(() => {
    const list: Array<{
      id: string;
      category: string;
      title: string;
      subtitle?: string;
      icon: React.ElementType;
      badge?: string;
      action: () => void;
    }> = [];

    // 1. Quick Actions
    list.push({
      id: 'action-create-server',
      category: 'Actions',
      title: 'Create New Server',
      subtitle: 'Provision a new container on your Wings cluster',
      icon: Plus,
      badge: 'Action',
      action: () => {
        setIsCreateServerOpen(true);
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'action-api-tokens',
      category: 'Actions',
      title: 'API Client Credentials & Tokens',
      subtitle: 'Manage root and application authorization tokens',
      icon: Key,
      badge: 'Security',
      action: () => {
        openAccountSettings('api-keys');
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'action-account-settings',
      category: 'Actions',
      title: 'Account Settings & 2FA',
      subtitle: 'Configure credentials, password, and two-factor auth',
      icon: Settings,
      badge: 'Profile',
      action: () => {
        openAccountSettings('profile');
        setIsCommandPaletteOpen(false);
      },
    });

    // If server is selected, add contextual server power actions
    if (selectedServer) {
      list.push({
        id: 'action-server-restart',
        category: `Current Server: ${selectedServer.name}`,
        title: `Restart Server (${selectedServer.name})`,
        subtitle: 'Sends graceful restart command via daemon',
        icon: Power,
        badge: 'Power',
        action: () => {
          handlePowerAction(selectedServer.id, 'restart');
          setIsCommandPaletteOpen(false);
        },
      });

      list.push({
        id: 'action-server-sftp',
        category: `Current Server: ${selectedServer.name}`,
        title: 'Direct Connect via SFTP',
        subtitle: `Launch default client for ${selectedServer.sftpDetails.host}:${selectedServer.sftpDetails.port}`,
        icon: ExternalLink,
        badge: 'SFTP',
        action: () => {
          window.location.href = `sftp://${selectedServer.sftpDetails.user}@${selectedServer.sftpDetails.host}:${selectedServer.sftpDetails.port}`;
          setIsCommandPaletteOpen(false);
        },
      });
    }

    // 2. Navigation
    list.push({
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'Dashboard Overview',
      subtitle: 'Cluster resource summary and pinned notes',
      icon: Sliders,
      action: () => {
        setActiveView('dashboard');
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'nav-servers',
      category: 'Navigation',
      title: 'Server Directory',
      subtitle: 'Browse and monitor all instances',
      icon: Server,
      action: () => {
        setActiveView('servers');
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'nav-admin-dashboard',
      category: 'Navigation',
      title: 'Admin Dashboard',
      subtitle: 'Cluster infrastructure telemetry and management',
      icon: Sliders,
      action: () => {
        setActiveView('admin-dashboard');
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'nav-admin-servers',
      category: 'Navigation',
      title: 'Admin: Cluster Server Management',
      subtitle: 'Manage all instances, limits, quotas, and suspension',
      icon: Server,
      action: () => {
        setActiveView('admin-servers');
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'nav-admin-nodes',
      category: 'Navigation',
      title: 'Wings Nodes Infrastructure',
      subtitle: 'Compute daemons and container endpoints',
      icon: HardDrive,
      action: () => {
        setActiveView('admin-nodes');
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'nav-admin-databases',
      category: 'Navigation',
      title: 'Database Management',
      subtitle: 'Manage MySQL / MariaDB hosts and tenant schemas',
      icon: Database,
      action: () => {
        setActiveView('admin-databases');
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'nav-admin-eggs',
      category: 'Navigation',
      title: 'Eggs & Nests Library',
      subtitle: 'Game templates and container installer deploy scripts',
      icon: Package,
      action: () => {
        setActiveView('admin-eggs');
        setIsCommandPaletteOpen(false);
      },
    });

    list.push({
      id: 'nav-admin-users',
      category: 'Navigation',
      title: 'User Management',
      subtitle: 'Client accounts, sub-users, and role permissions',
      icon: Users,
      action: () => {
        setActiveView('admin-users');
        setIsCommandPaletteOpen(false);
      },
    });

    // 3. Servers list
    servers.forEach((srv) => {
      list.push({
        id: `server-${srv.id}`,
        category: 'Servers',
        title: srv.name,
        subtitle: `${srv.status.toUpperCase()} • ${srv.node} • ${srv.allocation}`,
        icon: Server,
        badge: `${srv.stats.memory} MB RAM`,
        action: () => {
          selectServerAndNavigate(srv);
          setIsCommandPaletteOpen(false);
        },
      });
    });

    // 4. Color Themes
    COLOR_THEMES.forEach((theme) => {
      list.push({
        id: `theme-${theme.id}`,
        category: 'Color Palettes',
        title: `Switch Theme: ${theme.name}`,
        subtitle: theme.description,
        icon: Palette,
        badge: colorTheme === theme.id ? 'Active' : theme.badge,
        action: () => {
          setColorTheme(theme.id);
          addToast({
            title: 'Theme Applied',
            description: `Switched palette to ${theme.name}.`,
            type: 'info',
          });
          setIsCommandPaletteOpen(false);
        },
      });
    });

    return list;
  }, [
    servers,
    selectedServer,
    colorTheme,
    selectServerAndNavigate,
    setActiveView,
    handlePowerAction,
    setColorTheme,
    openAccountSettings,
    setIsCreateServerOpen,
    setIsCommandPaletteOpen,
    addToast,
  ]);

  // Filter based on search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-150"
        onClick={() => setIsCommandPaletteOpen(false)}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-[#0d1117]/95 backdrop-blur-xl rounded-2xl border border-[#2b3342]/90 shadow-[0_30px_90px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden z-10 animate-in zoom-in-95 fade-in duration-150">
        {/* Ambient Top Glow Line matching Active Theme */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--theme-accent)] to-transparent opacity-80 pointer-events-none z-20" />

        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#1f2633] bg-[#090d13]/60">
          <Search className="w-4 h-4 text-slate-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, server name, or jump to view..."
            style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 border-none outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus:border-transparent focus:shadow-none font-sans"
          />
          <kbd className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-mono text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 divide-y divide-transparent"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No matching commands or servers found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;

              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#21262d] text-white' : 'text-slate-300 hover:bg-[#161b22]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-zinc-100 text-zinc-900'
                          : 'bg-[#1c2128] text-slate-400 border border-[#30363d]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.badge && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1c2128] text-slate-400 border border-[#30363d]">
                        {item.badge}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                      {item.category}
                    </span>
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-[#0d1117] border-t border-[#30363d] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-[10px] text-slate-500">PteroNext Command Center</span>
        </div>
      </div>
    </div>
  );
};
