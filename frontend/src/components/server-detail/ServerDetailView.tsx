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
  const { activeServerTab, selectedServer } = useApp();

  if (!selectedServer) {
    return (
      <div className="py-20 text-center font-sans text-slate-400">
        No server selected. Please select a server from the fleet.
      </div>
    );
  }

  const serverKey = selectedServer.uuid || selectedServer.id;

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <ServerDetailHeader />

      {/* Active Tab View */}
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
    </div>
  );
};
