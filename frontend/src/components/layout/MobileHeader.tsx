import React from 'react';
import { useApp } from '../../context/AppContext';
import { Menu, Search, ArrowLeft } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

export const MobileHeader: React.FC = () => {
  const {
    setIsMobileDrawerOpen,
    activeView,
    selectedServer,
    navigateBackFromServer,
    searchQuery,
    setSearchQuery,
  } = useApp();

  const isServerMode = activeView === 'server-detail' && !!selectedServer;

  const getPageTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Dashboard';
      case 'servers':
        return 'Servers';
      case 'server-detail':
        return selectedServer?.name || 'Server';
      case 'schedules':
        return 'Schedules';
      case 'databases':
        return 'Databases';
      case 'activity':
        return 'Activity';
      case 'admin-dashboard':
        return 'Admin';
      case 'admin-servers':
        return 'Server Management';
      case 'admin-nodes':
        return 'Nodes';
      case 'admin-databases':
        return 'Databases';
      case 'admin-users':
        return 'Users';
      case 'admin-eggs':
        return 'Eggs & Nests';
      case 'admin-discord-bot':
        return 'Discord Bot';
      case 'admin-status-pages':
        return 'Uptime Pages';
      default:
        return 'Server Matrix';
    }
  };

  return (
    <header className="lg:hidden sticky top-0 z-20 w-full bg-[#0d1117]/95 backdrop-blur border-b border-[#30363d] px-3 py-2.5 flex items-center justify-between gap-2">
      {/* Left: contextual navigation + page title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {isServerMode ? (
          <>
            {/* Back out of the server workspace */}
            <button
              onClick={() => navigateBackFromServer()}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-[#161b22] border border-[#30363d] active:scale-95 transition-all"
              aria-label="Back to previous view"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm text-white truncate">
                {getPageTitle()}
              </span>
              {selectedServer && (
                <StatusBadge status={selectedServer.status} size="sm" showLabel={false} />
              )}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#161b22] border border-[#30363d]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4 text-slate-300" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm text-white truncate">
                {getPageTitle()}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Quick Search input */}
      <div className="relative shrink-0">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-28 sm:w-48 bg-[#161b22] border border-[#30363d] rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder-slate-500 font-sans focus:outline-none focus:border-zinc-500 transition-all"
        />
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
      </div>
    </header>
  );
};
