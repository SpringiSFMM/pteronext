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
import { SetupWizardView } from './components/setup/SetupWizardView';
import { LoginView } from './components/auth/LoginView';
import { ToastContainer } from './components/common/Toast';

const MainViewContent: React.FC = () => {
  const { activeView, isAuthenticated, isAuthChecking } = useApp();

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
      <div className="min-h-screen w-full bg-[#07090e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">Verifying session...</span>
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

  return (
    <AppLayout>
      <ChangelogModal />
      {activeView === 'dashboard' && <DashboardView />}
      {activeView === 'servers' && <ServerListView />}
      {activeView === 'server-detail' && <ServerDetailView />}
      {activeView === 'schedules' && <SchedulesView />}
      {activeView === 'databases' && <DatabasesView />}
      {activeView === 'activity' && <ActivityView />}
      {activeView === 'changelog' && <ChangelogView />}
      {activeView === 'admin-dashboard' && <AdminDashboardView />}
      {activeView === 'admin-servers' && <AdminServersView />}
      {activeView === 'admin-nodes' && <AdminNodesView />}
      {activeView === 'admin-users' && <AdminUsersView />}
      {activeView === 'admin-eggs' && <AdminEggsView />}
      {activeView === 'admin-databases' && <AdminDatabasesView />}
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
