import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Server as ServerIcon,
  Activity,
  Sliders,
  HardDrive,
  Users,
  Package,
  Terminal,
  Settings,
  LogOut,
  Key,
  ChevronUp,
  ChevronDown,
  X,
  FolderTree,
  Calendar,
  ArrowLeft,
  Database,
  Archive,
  Webhook,
  Sparkles,
  Network,
  Zap,
  ShieldAlert,
  History,
  Radio,
  PanelLeftClose,
  PanelLeftOpen,
  Gauge,
  Compass,
} from 'lucide-react';
import { ServerDetailTab } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { useTranslation } from '../../i18n/useTranslation';

/** Global navigation sections */
const GLOBAL_SECTIONS = [
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: '⌘1' },
      { id: 'servers', label: 'Servers', icon: ServerIcon, hint: '' },
      { id: 'activity', label: 'Activity / Audit', icon: Activity, hint: '' },
      { id: 'changelog', label: 'Changelog & Updates', icon: Sparkles, hint: 'v2.6' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'admin-dashboard', label: 'Admin Dashboard', icon: Sliders, hint: '/admin' },
      { id: 'admin-servers', label: 'Servers', icon: ServerIcon, hint: '' },
      { id: 'admin-nodes', label: 'Nodes', icon: HardDrive, hint: '' },
      { id: 'admin-users', label: 'Users', icon: Users, hint: '' },
      { id: 'admin-eggs', label: 'Eggs & Nests', icon: Package, hint: '' },
      { id: 'admin-databases', label: 'Databases', icon: Database, hint: '' },
    ],
  },
] as const;

/** Server workspace categories with collapsible groups */
interface ServerTabCategory {
  id: string;
  label: string;
  tabs: { id: ServerDetailTab; label: string; icon: React.ElementType }[];
}

const SERVER_CATEGORIES: ServerTabCategory[] = [
  {
    id: 'core',
    label: 'Operations & Core',
    tabs: [
      { id: 'console', label: 'Console', icon: Terminal },
      { id: 'diagnostics', label: 'Performance & Radar', icon: Gauge },
      { id: 'files', label: 'File Manager', icon: FolderTree },
      { id: 'backups', label: 'Backups', icon: Archive },
    ],
  },
  {
    id: 'community',
    label: 'Community & Network',
    tabs: [
      { id: 'players', label: 'Players & Community', icon: Radio },
      { id: 'network', label: 'Ports & Network', icon: Network },
      { id: 'webhooks', label: 'Webhooks & Alerts', icon: Webhook },
    ],
  },
  {
    id: 'services',
    label: 'Services & Extensions',
    tabs: [
      { id: 'world-map', label: '2D World & Chunks', icon: Compass },
      { id: 'plugin-store', label: 'Plugins & Mods', icon: Package },
      { id: 'game-config', label: 'Game Config', icon: Sliders },
      { id: 'sidecars', label: 'Redis & DB Sidecars', icon: Zap },
      { id: 'databases', label: 'Databases', icon: Database },
      { id: 'schedules', label: 'Schedules', icon: Calendar },
    ],
  },
  {
    id: 'security',
    label: 'Security & Team',
    tabs: [
      { id: 'security', label: 'Security & Scanner', icon: ShieldAlert },
      { id: 'users', label: 'Users & RBAC', icon: Users },
      { id: 'audit', label: 'Server Audit Logs', icon: History },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    activeServerTab,
    servers,
    selectedServer,
    selectServerAndNavigate,
    navigateBackFromServer,
    previousGlobalView,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    openAccountSettings,
    currentUser,
    adminNodes,
    addToast,
    logout,
  } = useApp();

  const { t, language, setLanguage } = useTranslation();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Accordion collapsed state
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const getCategoryLabel = (id: string, defaultLabel: string) => {
    switch (id) {
      case 'core': return t('cat_operations_core');
      case 'community': return t('cat_community_network');
      case 'services': return t('cat_services_extensions');
      case 'security': return t('cat_security_team');
      case 'platform': return t('cat_platform');
      case 'admin': return t('cat_administration');
      default: return defaultLabel;
    }
  };

  const getTabLabel = (id: string, defaultLabel: string) => {
    switch (id) {
      case 'console': return t('tab_console');
      case 'diagnostics': return t('tab_diagnostics');
      case 'files': return t('tab_files');
      case 'backups': return t('tab_backups');
      case 'players': return t('tab_players');
      case 'network': return t('tab_network');
      case 'webhooks': return t('tab_webhooks');
      case 'plugin-store': return t('tab_plugins');
      case 'game-config': return t('tab_game_config');
      case 'sidecars': return t('tab_sidecars');
      case 'world-map': return t('tab_world_map');
      case 'databases': return t('tab_databases');
      case 'schedules': return t('tab_schedules');
      case 'security': return t('tab_security');
      case 'users': return t('tab_users');
      case 'audit': return t('tab_audit');
      case 'settings': return t('tab_settings');
      default: return defaultLabel;
    }
  };

  const getGlobalItemLabel = (id: string, defaultLabel: string) => {
    switch (id) {
      case 'dashboard': return t('nav_dashboard');
      case 'servers': return t('nav_workloads');
      case 'activity': return t('nav_activity');
      case 'changelog': return t('nav_changelog');
      case 'admin-dashboard': return t('admin_dashboard');
      case 'admin-servers': return t('admin_servers');
      case 'admin-nodes': return t('admin_nodes');
      case 'admin-users': return t('admin_users');
      case 'admin-eggs': return t('admin_eggs');
      case 'admin-databases': return t('admin_databases');
      default: return defaultLabel;
    }
  };

  const isServerMode = activeView === 'server-detail' && !!selectedServer;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
    addToast({
      title: 'Logged Out',
      description: 'You have been safely signed out.',
      type: 'info',
    });
  };

  const handleOpenAccountSettings = () => {
    setIsUserMenuOpen(false);
    openAccountSettings('profile');
  };

  const handleOpenApiTokens = () => {
    setIsUserMenuOpen(false);
    openAccountSettings('api-keys');
  };

  const handleNavClick = (view: any) => {
    setActiveView(view);
    if (isMobileDrawerOpen) {
      setIsMobileDrawerOpen(false);
    }
  };

  const backButtonLabel = (() => {
    switch (previousGlobalView) {
      case 'dashboard':
        return 'Dashboard';
      case 'servers':
        return 'Servers';
      case 'activity':
        return 'Activity';
      default:
        return 'Back';
    }
  })();

  const navButtonClass = (isActive: boolean) =>
    isSidebarCollapsed
      ? `nav-item w-full flex items-center justify-center p-2.5 rounded-xl text-xs font-medium transition-all group relative ${
          isActive ? 'nav-item-active text-white bg-white/10 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
        }`
      : `nav-item w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
          isActive ? 'nav-item-active text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
        }`;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#e6edf3]">
      {/* ── Context Header ── */}
      {isServerMode ? (
        isSidebarCollapsed ? (
          <div className="py-3 px-2 border-b border-[#30363d] bg-[#11161d] flex flex-col items-center gap-2">
            <button
              onClick={toggleSidebarCollapse}
              title={t('sidebar_expand')}
              className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4 text-amber-400" />
            </button>
            <button
              onClick={() => {
                navigateBackFromServer();
                if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
              }}
              title={`Back to ${backButtonLabel}`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="relative mt-1" title={`${selectedServer!.name} (${selectedServer!.status})`}>
              <div className="w-8 h-8 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center font-bold text-white text-xs">
                {selectedServer!.name.slice(0, 2).toUpperCase()}
              </div>
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0d1117] ${
                  selectedServer!.status === 'running' ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
            </div>
          </div>
        ) : (
          <div className="h-auto min-h-14 py-2.5 px-3 border-b border-[#30363d] bg-[#11161d]">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  navigateBackFromServer();
                  if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 -mx-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors group"
                aria-label="Leave server workspace"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to {backButtonLabel}</span>
              </button>
              <button
                onClick={toggleSidebarCollapse}
                title={t('sidebar_collapse')}
                className="hidden lg:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#21262d] transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2 px-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white truncate">
                  {selectedServer!.name}
                </span>
                <StatusBadge status={selectedServer!.status} size="sm" showLabel={false} />
              </div>
              <p className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">
                {selectedServer!.node} · {selectedServer!.egg}
              </p>
            </div>
          </div>
        )
      ) : (
        isSidebarCollapsed ? (
          <div className="h-14 flex flex-col items-center justify-center border-b border-[#30363d] px-2">
            <button
              onClick={toggleSidebarCollapse}
              title={t('sidebar_expand')}
              className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        ) : (
          <div className="h-14 flex items-center justify-between px-4 border-b border-[#30363d]">
            <div
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center p-1 group-hover:border-[#484f58] transition-colors overflow-hidden">
                <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm tracking-tight text-white font-sans">
                    Server Matrix
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono leading-none mt-0.5">
                  Control Panel v2.6
                </p>
              </div>
            </div>

            {/* Collapse toggle button */}
            <button
              onClick={toggleSidebarCollapse}
              title={t('sidebar_collapse')}
              className="hidden lg:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#21262d] transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#21262d] transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )
      )}

      {/* ── Navigation body with Collapsible Categories & Smooth Accordions ── */}
      <div className={`flex-1 overflow-y-auto ${isSidebarCollapsed ? 'px-2 py-3 space-y-2' : 'px-3 py-4 space-y-4'}`}>
        {isServerMode ? (
          /* Server Workspace: Grouped with expandable accordions */
          <div className="space-y-3">
            {SERVER_CATEGORIES.map((category) => {
              const isCollapsed = collapsedCategories[category.id] ?? false;
              const hasActiveTab = category.tabs.some((t) => t.id === activeServerTab);

              if (isSidebarCollapsed) {
                return (
                  <div key={category.id} className="space-y-1">
                    <div className="my-1.5 border-t border-[#30363d]/50" />
                    {category.tabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeServerTab === tab.id;
                      const label = getTabLabel(tab.id, tab.label);
                      return (
                        <div key={tab.id} className="relative group">
                          <button
                            onClick={() => {
                              selectServerAndNavigate(selectedServer!, tab.id);
                              if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
                            }}
                            aria-current={isActive ? 'page' : undefined}
                            className={navButtonClass(isActive)}
                            title={label}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive ? 'text-[var(--theme-accent)]' : 'text-slate-400 group-hover:text-white'
                              }`}
                            />
                            {isActive && (
                              <span
                                className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full"
                                style={{
                                  backgroundColor: 'var(--theme-accent)',
                                  boxShadow: '0 0 6px var(--theme-accent-glow)',
                                }}
                              />
                            )}
                          </button>
                          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white text-xs font-mono rounded-lg shadow-2xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50">
                            {label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={category.id} className="space-y-1">
                  {/* Category Header Button */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors select-none group"
                  >
                    <span className="flex items-center gap-1.5">
                      {getCategoryLabel(category.id, category.label)}
                      {hasActiveTab && isCollapsed && (
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{
                            backgroundColor: 'var(--theme-accent)',
                            boxShadow: '0 0 6px var(--theme-accent-glow)',
                          }}
                        />
                      )}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out ${
                        isCollapsed ? '-rotate-90 text-slate-600' : 'rotate-0 text-slate-400'
                      }`}
                    />
                  </button>

                  {/* Smooth Animated Category Accordion */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                      isCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <nav className="space-y-0.5 py-0.5">
                        {category.tabs.map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeServerTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => {
                                selectServerAndNavigate(selectedServer!, tab.id);
                                if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
                              }}
                              aria-current={isActive ? 'page' : undefined}
                              className={navButtonClass(isActive)}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon
                                  className={`w-4 h-4 shrink-0 ${
                                    isActive ? 'text-[var(--theme-accent)]' : 'text-slate-400'
                                  }`}
                                />
                                <span className="truncate">{getTabLabel(tab.id, tab.label)}</span>
                              </div>
                              {isActive && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: 'var(--theme-accent)',
                                    boxShadow: '0 0 6px var(--theme-accent-glow)',
                                  }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  </div>
                </div>
              );
            })}

            {!isSidebarCollapsed && (
              <div className="pt-2 border-t border-[#30363d]/80">
                <button
                  onClick={() => handleNavClick('servers')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] transition-colors"
                >
                  <ServerIcon className="w-4 h-4 text-slate-400" />
                  <span>{t('nav_all_servers')}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Global navigation – grouped & smooth collapsible accordions */
          <div className="space-y-3">
            {GLOBAL_SECTIONS.map((section) => {
              const isCollapsed = collapsedCategories[section.id] ?? false;

              if (isSidebarCollapsed) {
                return (
                  <div key={section.id} className="space-y-1">
                    <div className="my-1.5 border-t border-[#30363d]/50" />
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      const label = getGlobalItemLabel(item.id, item.label);
                      return (
                        <div key={item.id} className="relative group">
                          <button
                            onClick={() => handleNavClick(item.id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={navButtonClass(isActive)}
                            title={label}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive ? 'text-[var(--theme-accent)]' : 'text-slate-400 group-hover:text-white'
                              }`}
                            />
                            {isActive && (
                              <span
                                className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full"
                                style={{
                                  backgroundColor: 'var(--theme-accent)',
                                  boxShadow: '0 0 6px var(--theme-accent-glow)',
                                }}
                              />
                            )}
                          </button>
                          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white text-xs font-mono rounded-lg shadow-2xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50">
                            {label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={section.id} className="space-y-1">
                  <button
                    onClick={() => toggleCategory(section.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors select-none group"
                  >
                    <span>{getCategoryLabel(section.id, section.label)}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out ${
                        isCollapsed ? '-rotate-90 text-slate-600' : 'rotate-0 text-slate-400'
                      }`}
                    />
                  </button>

                  {/* Smooth Animated Global Category Accordion */}
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                      isCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <nav className="space-y-0.5 py-0.5">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeView === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleNavClick(item.id)}
                              aria-current={isActive ? 'page' : undefined}
                              className={navButtonClass(isActive)}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon
                                  className={`w-4 h-4 shrink-0 ${
                                    isActive ? 'text-[var(--theme-accent)]' : 'text-slate-400'
                                  }`}
                                />
                                <span className="truncate">{getGlobalItemLabel(item.id, item.label)}</span>
                              </div>
                              {item.hint && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {item.hint}
                                </span>
                              )}
                              {isActive && !item.hint && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: 'var(--theme-accent)',
                                    boxShadow: '0 0 6px var(--theme-accent-glow)',
                                  }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer / User Menu & Quick Language Selector ── */}
      <div className={`${isSidebarCollapsed ? 'p-2' : 'p-3'} border-t border-[#30363d] relative`} ref={userMenuRef}>
        {!isSidebarCollapsed && (
          <div className="flex items-center justify-between px-2.5 py-1 mb-2 bg-[#161b22]/70 rounded-lg border border-[#30363d]/60 text-[11px]">
            <span className="text-slate-400 font-medium">Sprache:</span>
            <div className="flex items-center gap-1 bg-[#0d1117] p-0.5 rounded-md border border-[#30363d]/80">
              <button
                onClick={() => setLanguage('de')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                  language === 'de'
                    ? 'bg-[var(--theme-accent)] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇩🇪 DE
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                  language === 'en'
                    ? 'bg-[var(--theme-accent)] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-1.5' : 'justify-between p-2'} rounded-lg hover:bg-white/[0.04] transition-colors`}
          title={currentUser?.username || 'User Profile'}
        >
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-2.5'} min-w-0`}>
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden border border-white/10 shadow-sm">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.username || 'User Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                currentUser?.username?.[0]?.toUpperCase() || 'A'
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 text-left">
                <span className="text-xs font-medium text-white truncate block">
                  {currentUser?.username || 'Administrator'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block capitalize">
                  {currentUser?.role?.replace('_', ' ') || 'Root Admin'}
                </span>
              </div>
            )}
          </div>
          {!isSidebarCollapsed && (
            <ChevronUp
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                isUserMenuOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>

        {/* Dropdown Menu */}
        {isUserMenuOpen && (
          <div className={`absolute ${isSidebarCollapsed ? 'left-full bottom-2 ml-2 w-48' : 'bottom-full left-3 right-3 mb-2'} p-1.5 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl space-y-0.5 z-50 animate-in fade-in zoom-in-95 duration-100`}>
            <button
              onClick={handleOpenAccountSettings}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors text-left"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('settings_title')}</span>
            </button>
            <button
              onClick={handleOpenApiTokens}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors text-left"
            >
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('settings_tab_api_keys')}</span>
            </button>
            <div className="pt-1 mt-1 border-t border-[#30363d]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('nav_logout')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar with smooth collapse animation */}
      <aside
        className={`hidden lg:flex lg:flex-col ${
          isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        } lg:fixed lg:inset-y-0 lg:z-30 border-r border-[#30363d] transition-[width] duration-300 ease-in-out`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

