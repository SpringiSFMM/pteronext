import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardView } from './components/dashboard/DashboardView';
import { ServerListView } from './components/servers/ServerListView';
import { ServerDetailView } from './components/server-detail/ServerDetailView';
import { SchedulesView } from './components/schedules/SchedulesView';
import { DatabasesView } from './components/databases/DatabasesView';
import { ActivityView } from './components/activity/ActivityView';
import { ChangelogView } from './components/changelog/ChangelogView';
import { ChangelogModal } from './components/changelog/ChangelogModal';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { AdminNodesView } from './components/admin/AdminNodesView';
import { AdminUsersView } from './components/admin/AdminUsersView';
import { AdminEggsView } from './components/admin/AdminEggsView';
import { AdminDatabasesView } from './components/admin/AdminDatabasesView';
import { AdminServersView } from './components/admin/AdminServersView';
import { AdminDiscordBotView } from './components/admin/AdminDiscordBotView';
import { SetupWizardView } from './components/setup/SetupWizardView';
import { LoginView } from './components/auth/LoginView';
import { ToastContainer } from './components/common/Toast';

const MainViewContent: React.FC = () => {
  const { activeView, isAuthenticated, isAuthChecking, currentUser } = useApp();
  const isRootAdmin = Boolean(currentUser?.rootAdmin || currentUser?.role === 'root_admin');

  if (activeView === 'setup') {
    return (
      <>
        <ToastContainer />
        <SetupWizardView />
      </>
    );
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen w-full bg-[#07090e] flex items-center justify-center relative overflow-hidden">
        {/* Ambient Top Theme Glow Line */}
        <div
          className="absolute inset-x-0 top-0 h-[2px] opacity-80 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--theme-accent, #6366f1), transparent)',
            boxShadow: '0 0 16px var(--theme-accent-glow, rgba(99,102,241,0.4))',
          }}
        />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="relative">
            <div
              className="w-10 h-10 border-2 rounded-full animate-spin"
              style={{
                borderColor: 'var(--theme-accent, #6366f1)',
                borderTopColor: 'transparent',
                filter: 'drop-shadow(0 0 8px var(--theme-accent-glow, rgba(99,102,241,0.5)))',
              }}
            />
            <div
              className="w-2.5 h-2.5 rounded-full absolute inset-0 m-auto animate-pulse"
              style={{ backgroundColor: 'var(--theme-accent, #6366f1)' }}
            />
          </div>
          <span className="text-xs font-mono text-slate-300 tracking-wider">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <LoginView />
      </>
    );
  }

  // If a non-admin attempted to visit an admin view, render DashboardView instead
  const effectiveView = (!isRootAdmin && activeView.startsWith('admin-')) ? 'dashboard' : activeView;

  return (
    <AppLayout>
      <ChangelogModal />
      {effectiveView === 'dashboard' && <DashboardView />}
      {effectiveView === 'servers' && <ServerListView />}
      {effectiveView === 'server-detail' && <ServerDetailView />}
      {effectiveView === 'schedules' && <SchedulesView />}
      {effectiveView === 'databases' && <DatabasesView />}
      {effectiveView === 'activity' && <ActivityView />}
      {effectiveView === 'changelog' && <ChangelogView />}
      {isRootAdmin && effectiveView === 'admin-dashboard' && <AdminDashboardView />}
      {isRootAdmin && effectiveView === 'admin-servers' && <AdminServersView />}
      {isRootAdmin && effectiveView === 'admin-nodes' && <AdminNodesView />}
      {isRootAdmin && effectiveView === 'admin-users' && <AdminUsersView />}
      {isRootAdmin && effectiveView === 'admin-eggs' && <AdminEggsView />}
      {isRootAdmin && effectiveView === 'admin-databases' && <AdminDatabasesView />}
      {isRootAdmin && effectiveView === 'admin-discord-bot' && <AdminDiscordBotView />}
    </AppLayout>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainViewContent />
    </AppProvider>
  );
}

export default App;
