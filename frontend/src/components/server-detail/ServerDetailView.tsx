import React from 'react';
import { useApp } from '../../context/AppContext';
import { ServerDetailHeader } from './ServerDetailHeader';
import { ConsoleTab } from './tabs/ConsoleTab';
import { FileManagerTab } from './tabs/FileManagerTab';
import { PlayersTab } from './tabs/PlayersTab';
import { NetworkTab } from './tabs/NetworkTab';
import { SidecarsTab } from './tabs/SidecarsTab';
import { SecurityTab } from './tabs/SecurityTab';
import { ServerAuditTab } from './tabs/ServerAuditTab';
import { SchedulesTab } from './tabs/SchedulesTab';
import { DatabasesTab } from './tabs/DatabasesTab';
import { UsersTab } from './tabs/UsersTab';
import { SettingsTab } from './tabs/SettingsTab';
import { GameConfigTab } from './tabs/GameConfigTab';
import { PluginStoreTab } from './tabs/PluginStoreTab';
import { BackupsTab } from './tabs/BackupsTab';
import { WebhooksTab } from './tabs/WebhooksTab';
import { DiagnosticsTab } from './tabs/DiagnosticsTab';

export const ServerDetailView: React.FC = () => {
  const { activeServerTab, selectedServer, canAccessServerTab } = useApp();

  if (!selectedServer) {
    return (
      <div className="py-20 text-center font-sans text-slate-400">
        No server selected. Please select a server from the fleet.
      </div>
    );
  }

  const isTabAllowed = canAccessServerTab(activeServerTab);
  const serverKey = selectedServer.uuid || selectedServer.id;

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <ServerDetailHeader />

      {/* Permission Gate */}
      {!isTabAllowed ? (
        <div className="card p-12 text-center max-w-lg mx-auto my-8 border border-rose-500/20 bg-[#161b22]">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-white mb-2">Access Restricted</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your delegated role does not have permission to view or manage this module. Please contact the server administrator for access.
          </p>
        </div>
      ) : (
        /* Active Tab View */
        <div className="animate-in fade-in duration-150">
          {activeServerTab === 'console' && <ConsoleTab key={`console-${serverKey}`} />}
          {activeServerTab === 'files' && <FileManagerTab key={`files-${serverKey}`} />}
          {activeServerTab === 'players' && <PlayersTab key={`players-${serverKey}`} />}
          {activeServerTab === 'network' && <NetworkTab key={`network-${serverKey}`} />}
          {activeServerTab === 'sidecars' && <SidecarsTab key={`sidecars-${serverKey}`} />}
          {activeServerTab === 'security' && <SecurityTab key={`security-${serverKey}`} />}
          {activeServerTab === 'backups' && <BackupsTab key={`backups-${serverKey}`} />}
          {activeServerTab === 'game-config' && <GameConfigTab key={`game-config-${serverKey}`} />}
          {activeServerTab === 'plugin-store' && <PluginStoreTab key={`plugin-store-${serverKey}`} />}
          {activeServerTab === 'schedules' && <SchedulesTab key={`schedules-${serverKey}`} />}
          {activeServerTab === 'databases' && <DatabasesTab key={`databases-${serverKey}`} />}
          {activeServerTab === 'users' && <UsersTab key={`users-${serverKey}`} />}
          {activeServerTab === 'audit' && <ServerAuditTab key={`audit-${serverKey}`} />}
          {activeServerTab === 'webhooks' && <WebhooksTab key={`webhooks-${serverKey}`} />}
          {activeServerTab === 'diagnostics' && <DiagnosticsTab key={`diagnostics-${serverKey}`} />}
          {activeServerTab === 'settings' && <SettingsTab key={`settings-${serverKey}`} />}
        </div>
      )}
    </div>
  );
};
