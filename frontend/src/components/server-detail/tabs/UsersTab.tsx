import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { SubUser } from '../../../types';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Lock,
  Mail,
  Check,
  Plus,
  FileCode,
  Terminal,
  FolderLock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Hammer,
  Headphones,
  LifeBuoy,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal';

interface PathRule {
  pattern: string;
  action: 'ALLOW' | 'DENY';
}

interface CommandRule {
  type: 'whitelist' | 'blacklist';
  commands: string[];
}

export const UsersTab: React.FC = () => {
  const { users, addUser, deleteUser, addToast } = useApp();
  const { language } = useTranslation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetSubUser, setDeleteTargetSubUser] = useState<SubUser | null>(null);
  const [isDeletingSubUser, setIsDeletingSubUser] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Moderator' | 'Builder' | 'Support' | 'Operator' | 'Custom'>('Moderator');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'console.view',
    'file.read',
  ]);

  // Path Rules & Command Rules State for modal
  const [pathRules, setPathRules] = useState<PathRule[]>([
    { pattern: '/world/**', action: 'ALLOW' },
    { pattern: '**/server.properties', action: 'DENY' },
  ]);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleAction, setNewRuleAction] = useState<'ALLOW' | 'DENY'>('ALLOW');

  const [commandRuleMode, setCommandRuleMode] = useState<'whitelist' | 'blacklist'>('whitelist');
  const [commandTokens, setCommandTokens] = useState<string>('say, kick, tp, time');

  const availablePermissions = [
    { id: 'console.view', label: 'View Live Console' },
    { id: 'console.send', label: 'Send Console Commands' },
    { id: 'file.read', label: 'Browse File Tree' },
    { id: 'file.write', label: 'Edit & Save Configurations' },
    { id: 'file.delete', label: 'Delete Files & Directories' },
    { id: 'power.start', label: 'Start Server Container' },
    { id: 'power.restart', label: 'Restart Server Container' },
    { id: 'power.stop', label: 'Stop & Terminate Container' },
    { id: 'backup.create', label: 'Create Instant Backups' },
    { id: 'database.create', label: 'Provision Databases' },
  ];

  // Preset role helpers
  const applyPreset = (presetName: 'Moderator' | 'Builder' | 'Support') => {
    setRole(presetName);
    if (presetName === 'Moderator') {
      setSelectedPermissions(['console.view', 'console.send', 'file.read']);
      setPathRules([
        { pattern: '/logs/**', action: 'ALLOW' },
        { pattern: '**/server.properties', action: 'DENY' },
      ]);
      setCommandRuleMode('whitelist');
      setCommandTokens('say, kick, ban, unban, mute, warn');
    } else if (presetName === 'Builder') {
      setSelectedPermissions(['file.read', 'file.write']);
      setPathRules([
        { pattern: '/world/**', action: 'ALLOW' },
        { pattern: '/schematics/**', action: 'ALLOW' },
        { pattern: '**/server.properties', action: 'DENY' },
      ]);
      setCommandRuleMode('whitelist');
      setCommandTokens('gamemode, tp, time, weather');
    } else if (presetName === 'Support') {
      setSelectedPermissions(['console.view', 'file.read']);
      setPathRules([
        { pattern: '/logs/**', action: 'ALLOW' },
        { pattern: '/crash-reports/**', action: 'ALLOW' },
        { pattern: '**/*', action: 'DENY' },
      ]);
      setCommandRuleMode('whitelist');
      setCommandTokens('list, status, help');
    }
  };

  const handleTogglePerm = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleAddPathRule = () => {
    if (!newRulePattern.trim()) return;
    setPathRules((prev) => [...prev, { pattern: newRulePattern.trim(), action: newRuleAction }]);
    setNewRulePattern('');
  };

  const handleRemovePathRule = (index: number) => {
    setPathRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const username = email.split('@')[0];
    addUser({
      email,
      username,
      avatar: `https://minotar.net/helm/${username}/40.png`,
      role: role as any,
      permissions: selectedPermissions,
      twoFactor: true,
    });

    addToast({
      title: 'Sub-User Configured',
      description: `Assigned role ${role} with ${pathRules.length} path guardrails.`,
      type: 'success',
    });

    setIsModalOpen(false);
    setEmail('');
  };

  const handleConfirmDeleteSubUser = async () => {
    if (!deleteTargetSubUser) return;
    setIsDeletingSubUser(true);
    try {
      await deleteUser(deleteTargetSubUser.id);
      addToast({
        title: language === 'de' ? 'Benutzerzugriff widerrufen' : 'Access Revoked',
        description:
          language === 'de'
            ? `Zugriff für ${deleteTargetSubUser.username} wurde entfernt.`
            : `Access revoked for ${deleteTargetSubUser.username}.`,
        type: 'info',
      });
      setDeleteTargetSubUser(null);
    } finally {
      setIsDeletingSubUser(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-wide font-sans">
              Granulares RBAC & Benutzerrechte
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              Zero-Trust Daemon Security
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Assign role templates (Moderator, Builder, Support), visual path guardrails, and console command whitelists.
          </p>
        </div>

        <button
          onClick={() => {
            applyPreset('Moderator');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Sub-User</span>
        </button>
      </div>

      {/* Preset Templates Quick Card */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
            One-Click Role Presets
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => {
              applyPreset('Moderator');
              setIsModalOpen(true);
            }}
            className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/80 hover:border-indigo-500/50 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Moderator</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Preset
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Console viewing, kick/ban commands whitelisted, config files denied.
            </p>
          </div>

          <div
            onClick={() => {
              applyPreset('Builder');
              setIsModalOpen(true);
            }}
            className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/80 hover:border-emerald-500/50 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                <Hammer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Builder / Architect</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Preset
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Access limited strictly to <code className="text-emerald-400">/world/**</code> and schematics.
            </p>
          </div>

          <div
            onClick={() => {
              applyPreset('Support');
              setIsModalOpen(true);
            }}
            className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800/80 hover:border-sky-500/50 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-sky-400" />
                <span>Support / Triage</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Preset
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Read-only logs and crash reports inspection. Server power disabled.
            </p>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/40.png';
                    }}
                    className="w-10 h-10 rounded-xl object-cover border border-white/10"
                  />
                  {user.twoFactor && (
                    <span
                      title="2FA Enforced"
                      className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950"
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white font-mono">
                      {user.username}
                    </h4>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                        user.role === 'Admin'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : user.role === 'Moderator'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                          : user.role === 'Builder'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-[11px] font-mono text-slate-500">
                  Joined: {user.addedAt}
                </span>
                {user.role !== 'Admin' && (
                  <button
                    onClick={() => setDeleteTargetSubUser(user)}
                    title={language === 'de' ? 'Benutzerzugriff widerrufen' : 'Revoke User Access'}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Granular Permissions Chips */}
            <div className="pt-2.5 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
              <span className="text-slate-500">Permissions:</span>
              {user.permissions.map((perm, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Invite User Modal with Path-Rules and Command-Rules */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title="INVITE TEAM SUB-USER & CONFIGURE RBAC"
        >
          <form onSubmit={handleInviteUser} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            {/* Presets Bar */}
            <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
                Quick Apply Preset
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {(['Moderator', 'Builder', 'Support'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors ${
                      role === p
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. teammate@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Permissions Matrix */}
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                Catalog Permissions (RBAC)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 bg-[#0d1117] rounded-xl border border-slate-800 font-mono text-xs">
                {availablePermissions.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.id);
                  return (
                    <div
                      key={perm.id}
                      onClick={() => handleTogglePerm(perm.id)}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-900 cursor-pointer text-slate-300"
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-[11px] truncate">{perm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visuelle Path-Regeln */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono uppercase text-slate-300">
                  📁 Visuelle Pfad-Regeln (ALLOW / DENY Glob)
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Host daemon enforced</span>
              </div>

              <div className="space-y-1.5">
                {pathRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#0d1117] border border-slate-800 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rule.action === 'ALLOW'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {rule.action}
                      </span>
                      <span className="text-white">{rule.pattern}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePathRule(idx)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Rule Line */}
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={newRuleAction}
                  onChange={(e) => setNewRuleAction(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono"
                >
                  <option value="ALLOW">ALLOW</option>
                  <option value="DENY">DENY</option>
                </select>

                <input
                  type="text"
                  placeholder="e.g. /world/** or **/server.properties"
                  value={newRulePattern}
                  onChange={(e) => setNewRulePattern(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />

                <button
                  type="button"
                  onClick={handleAddPathRule}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Command-Rules */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono uppercase text-slate-300">
                  ⌨️ Command-Rules (Console Gateway)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCommandRuleMode('whitelist')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      commandRuleMode === 'whitelist'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-500'
                    }`}
                  >
                    Whitelist
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommandRuleMode('blacklist')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      commandRuleMode === 'blacklist'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'text-slate-500'
                    }`}
                  >
                    Blacklist
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Comma-separated commands, e.g. say, kick, tp, time"
                value={commandTokens}
                onChange={(e) => setCommandTokens(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500 font-mono">
                Only matched commands will be forwarded to the server container daemon.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs shadow-md active:scale-95"
              >
                Save & Dispatch Invite
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cyber-Glass Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetSubUser}
        onClose={() => setDeleteTargetSubUser(null)}
        onConfirm={handleConfirmDeleteSubUser}
        title={language === 'de' ? 'Benutzerzugriff widerrufen' : 'Revoke Sub-User Access'}
        itemName={deleteTargetSubUser?.username}
        description={
          language === 'de'
            ? `Möchtest du den Zugriff für Sub-User "${deleteTargetSubUser?.username}" (${deleteTargetSubUser?.email}) auf diesen Server wirklich widerrufen?`
            : `Are you sure you want to permanently revoke server access for sub-user "${deleteTargetSubUser?.username}" (${deleteTargetSubUser?.email})?`
        }
        isDeleting={isDeletingSubUser}
      />
    </div>
  );
};
