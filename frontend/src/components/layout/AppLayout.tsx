import React from 'react';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { ModernNavbar } from './ModernNavbar';
import { Footer } from './Footer';
import { ToastContainer } from '../common/Toast';
import { UserSettingsModal } from '../settings/UserSettingsModal';
import { CommandPalette } from '../common/CommandPalette';
import { CreateServerModal } from '../servers/CreateServerModal';
import { PterodactylImportModal } from '../servers/PterodactylImportModal';
import { DnsRevocationModal } from '../common/DnsRevocationModal';
import { useApp } from '../../context/AppContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { isAccountSettingsOpen, setIsAccountSettingsOpen, isSidebarCollapsed } = useApp();

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] relative selection:bg-slate-700 selection:text-white">
      {/* Toast Notifications */}
      <ToastContainer />

      {/* Global DNS Revocation Popup Modal */}
      <DnsRevocationModal />

      {/* Global Command Palette (CMD+K / Ctrl+K) */}
      <CommandPalette />

      {/* Global Create Server Modal */}
      <CreateServerModal />

      {/* Global Pterodactyl & Pelican Import Modal */}
      <PterodactylImportModal />

      {/* Desktop & Mobile Persistent Sidebar */}
      <Sidebar />

      {/* Main Content Area with Sticky / Bottom Footer */}
      <div className={`${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'} flex flex-col min-h-screen transition-[padding] duration-300 ease-in-out`}>
        {/* Mobile Header Bar */}
        <MobileHeader />

        {/* Modern Top Navbar for Desktop */}
        <div className="hidden lg:block">
          <ModernNavbar />
        </div>

        {/* Dynamic Main View */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>

        {/* Global Footer */}
        <Footer />
      </div>

      {/* Full-featured Account Settings, API Tokens & 2FA Modal */}
      <UserSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={() => setIsAccountSettingsOpen(false)}
      />
    </div>
  );
};
