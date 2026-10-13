import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { api } from '../../api/client';
import {
  Sparkles,
  Command,
  Plus,
  Bell,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  RefreshCw,
  GitBranch,
  Layers,
  Search,
} from 'lucide-react';

export const ModernNavbar: React.FC = () => {
  const {
    currentUser,
    setIsCreateServerOpen,
    openAccountSettings,
    setActiveView,
    colorTheme,
    setColorTheme,
    selectedServer,
    activeView,
    activeServerTab,
  } = useApp();

  const { language } = useTranslation();
  const [versionInfo, setVersionInfo] = useState<{
    current_version: string;
    latest_version: string;
    update_available: boolean;
  }>({
    current_version: 'v2.8.6',
    latest_version: 'v2.8.6',
    update_available: false,
  });
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchVersion = async () => {
      try {
        const res = await api.updates.check();
        if (mounted && res) {
          setVersionInfo({
            current_version: res.current_version || 'v2.7.4',
            latest_version: res.latest_version || res.current_version || 'v2.7.4',
            update_available: Boolean(res.update_available),
          });
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchVersion();
    return () => {
      mounted = false;
    };
  }, []);

  const handleManualCheck = async () => {
    setCheckingUpdate(true);
    try {
      const res = await api.updates.check();
      if (res) {
        setVersionInfo({
          current_version: res.current_version || 'v2.7.4',
          latest_version: res.latest_version || res.current_version || 'v2.7.4',
          update_available: Boolean(res.update_available),
        });
      }
    } finally {
      setTimeout(() => setCheckingUpdate(false), 500);
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#30363d]/80 bg-[#0d1117]/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Left: Breadcrumbs / Active Context */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span
              onClick={() => setActiveView('dashboard')}
              className="hover:text-white cursor-pointer font-bold tracking-wide text-slate-300"
            >
              PteroNext
            </span>
            <span>/</span>
            {activeView === 'server-detail' && selectedServer ? (
              <>
                <span
                  onClick={() => setActiveView('servers')}
                  className="hover:text-white cursor-pointer text-slate-400 truncate max-w-[120px]"
                >
                  Servers
                </span>
                <span>/</span>
                <span className="text-white font-semibold truncate max-w-[160px] sm:max-w-[240px]">
                  {selectedServer.name}
                </span>
                <span className="hidden sm:inline-block text-[11px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                  {activeServerTab}
                </span>
              </>
            ) : (
              <span className="text-white font-medium capitalize">
                {activeView.replace('admin-', 'Admin: ').replace('-', ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Right: Version pill, Command Palette Hint, Create Button, Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Synchronized GitHub/Local Version Tag */}
          <div className="flex items-center">
            <button
              onClick={handleManualCheck}
              title={`Version: ${versionInfo.current_version} (Klicken für Update-Prüfung)`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all ${
                versionInfo.update_available
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25 animate-pulse'
                  : 'bg-[#161b22] border-[#30363d] text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              <GitBranch className={`w-3 h-3 ${checkingUpdate ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline font-semibold">{versionInfo.current_version}</span>
              {versionInfo.update_available && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[9px] font-extrabold uppercase tracking-wider">
                  Update
                </span>
              )}
            </button>
          </div>

          {/* Quick Command Palette Button (⌘K) */}
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
            }}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-xs font-mono text-slate-400 hover:text-white hover:border-[#484f58] transition-all"
            title="Command Palette öffnen"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11px]">Search...</span>
            <kbd className="px-1 py-0.5 rounded bg-black/40 text-[10px] text-slate-400 border border-white/10 font-sans">
              ⌘K
            </kbd>
          </button>

          {/* New Server Action (Root Admin Only) */}
          {(currentUser?.rootAdmin || currentUser?.role === 'root_admin') && (
            <button
              onClick={() => setIsCreateServerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium font-sans bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'de' ? 'Server erstellen' : 'New Server'}</span>
            </button>
          )}

          {/* User Avatar & Settings Trigger */}
          <button
            onClick={() => openAccountSettings('profile')}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/5 border border-transparent hover:border-[#30363d] transition-all"
            title="User Profile & Settings"
          >
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-sm border border-white/10">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
              ) : (
                <span>{currentUser?.username?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
