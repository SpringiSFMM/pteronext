import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Plus, ShieldCheck, Trash2, Inbox, UserRound, UserPlus, Search, Info, Key, Shield, Server, Check, Copy } from 'lucide-react';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';

export const AdminUsersView: React.FC = () => {
  const { adminUsers, adminLoading, createAdminUser, deleteAdminUser } = useApp();
  const { t, language } = useTranslation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<any | null>(null);
  const [inspectedUser, setInspectedUser] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return adminUsers;
    const q = searchQuery.toLowerCase().trim();
    return adminUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.uuid && u.uuid.toLowerCase().includes(q))
    );
  }, [adminUsers, searchQuery]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const ok = await createAdminUser({
      username: username.trim(),
      email: email.trim(),
      password,
      root_admin: isRootAdmin,
    });
    setIsCreating(false);
    if (ok) {
      setIsModalOpen(false);
      setUsername('');
      setEmail('');
      setPassword('');
      setIsRootAdmin(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setIsDeletingUser(true);
    try {
      await deleteAdminUser(deleteTargetUser.id);
      setDeleteTargetUser(null);
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="space-y-6 view-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('users_title')}</h1>
          <p className="page-subtitle">
            {t('users_desc')}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={language === 'de' ? 'Benutzer & E-Mails suchen...' : 'Search users & emails...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0d1117] border border-[#30363d] focus:border-indigo-500 text-white font-mono text-xs focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('users_new_user')}</span>
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {adminLoading && adminUsers.length === 0 && (
        <div className="card p-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!adminLoading && adminUsers.length === 0 && (
        <div className="card p-10 text-center">
          <div className="mx-auto w-11 h-11 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center mb-3">
            <Inbox className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">No user accounts</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            The panel core returned no accounts. Create the first user to grant panel access.
          </p>
          <button className="btn btn-primary mt-4" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>New User</span>
          </button>
        </div>
      )}

      {filteredUsers.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-[#30363d] font-medium">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Type</th>
                  <th className="py-3 px-4">Two-Factor (2FA)</th>
                  <th className="py-3 px-4">Allocated Servers</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]/70">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => setInspectedUser(user)}
                    className="hover:bg-[#1c2128] transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="w-8 h-8 rounded-lg object-cover border border-[#30363d] group-hover:border-indigo-500/50 transition-colors"
                        />
                        <div>
                          <p className="font-semibold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                            <span>{user.username}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {user.rootAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Root Admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#21262d] text-slate-300 border border-[#30363d]">
                          <UserRound className="w-3 h-3" />
                          <span>Member</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {user.isSubuser ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          <Shield className="w-3 h-3 text-indigo-400" />
                          <span>Sub-User ({user.subuserServers?.length || 1})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-slate-400">
                          <span>Standard User</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      {user.twoFactor ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Enabled</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Disabled</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                      {user.serversCount} server{user.serversCount === 1 ? '' : 's'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                      {user.createdAt}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetUser(user);
                        }}
                        title="Delete account"
                        className="p-1.5 rounded-md bg-[#21262d] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-[#30363d] hover:border-rose-500/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('users_create_title')}
        subtitle={t('users_create_subtitle')}
        icon={<UserPlus className="w-4 h-4 text-emerald-400" />}
        badge="IAM ACCOUNT"
        badgeColor="emerald"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('users_username')}</label>
              <input
                type="text"
                required
                placeholder="e.g. dev_operator"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="field-label">{t('users_email')}</label>
              <input
                type="email"
                required
                placeholder="dev@partner.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">{t('users_password')}</label>
            <input
              type="text"
              required
              minLength={8}
              placeholder={language === 'de' ? 'Mindestens 8 Zeichen' : 'Minimum 8 characters'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input font-mono"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRootAdmin}
              onChange={(e) => setIsRootAdmin(e.target.checked)}
              className="rounded bg-[#0d1117] border border-[#30363d] text-emerald-500"
            />
            <span className="text-xs text-slate-300">
              {t('users_root_admin')}
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
              {t('common_cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isCreating}>
              {isCreating ? t('users_creating') : t('users_create_button')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cyber-Glass Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetUser}
        onClose={() => setDeleteTargetUser(null)}
        onConfirm={handleConfirmDeleteUser}
        title={language === 'de' ? 'Benutzerkonto löschen' : 'Delete User Account'}
        itemName={deleteTargetUser?.username}
        description={
          language === 'de'
            ? `Möchtest du das Benutzerkonto "${deleteTargetUser?.username}" (${deleteTargetUser?.email}) wirklich dauerhaft löschen?`
            : `Are you sure you want to permanently delete user account "${deleteTargetUser?.username}" (${deleteTargetUser?.email})?`
        }
        isDeleting={isDeletingUser}
      />

      {/* User Details Inspector Modal */}
      {inspectedUser && (
        <Modal
          isOpen={true}
          onClose={() => setInspectedUser(null)}
          title={`Benutzerdetails: ${inspectedUser.username}`}
          subtitle="Vollständige Kontodetails, Rollen & Serverdelegationen"
          icon={<Info className="w-5 h-5 text-indigo-400" />}
          badge={inspectedUser.rootAdmin ? "ROOT ADMIN" : (inspectedUser.isSubuser ? "SUB-USER" : "MEMBER")}
          badgeColor={inspectedUser.rootAdmin ? "emerald" : (inspectedUser.isSubuser ? "purple" : "default")}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs font-mono">
            {/* Header profile summary */}
            <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={inspectedUser.avatar}
                  alt={inspectedUser.username}
                  className="w-12 h-12 rounded-xl object-cover border border-[#30363d]"
                />
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {inspectedUser.username}
                    {inspectedUser.rootAdmin && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Root
                      </span>
                    )}
                    {inspectedUser.isSubuser && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Sub-User
                      </span>
                    )}
                  </h4>
                  <p className="text-slate-400 text-xs mt-0.5">{inspectedUser.email}</p>
                </div>
              </div>
            </div>

            {/* Core metadata grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Account ID
                </span>
                <span className="text-white font-semibold">#{inspectedUser.id}</span>
              </div>

              <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                    UUID
                  </span>
                  <span className="text-slate-300 font-semibold truncate block max-w-[180px]">
                    {inspectedUser.uuid || '—'}
                  </span>
                </div>
                {inspectedUser.uuid && (
                  <button
                    onClick={() => handleCopy(inspectedUser.uuid, 'user-uuid')}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    {copiedKey === 'user-uuid' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  2-Faktor-Authentifizierung (2FA)
                </span>
                <span className={inspectedUser.twoFactor ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                  {inspectedUser.twoFactor ? "Aktiviert & Erzwingbar" : "Deaktiviert"}
                </span>
              </div>

              <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Registriert am
                </span>
                <span className="text-white font-semibold">{inspectedUser.createdAt || '—'}</span>
              </div>

              <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Eigene Server (Owner)
                </span>
                <span className="text-white font-semibold">
                  {inspectedUser.serversCount} {inspectedUser.serversCount === 1 ? 'Server' : 'Server'}
                </span>
              </div>

              <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Verknüpftes Discord Konto
                </span>
                <span className="text-slate-300 font-semibold">
                  {inspectedUser.discordUsername || (inspectedUser.discordId ? `ID: ${inspectedUser.discordId}` : 'Nicht verknüpft')}
                </span>
              </div>
            </div>

            {/* Sub-User Delegations */}
            <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Sub-User Serverzugriffe & Delegationen ({inspectedUser.subuserServers?.length || 0})
              </span>
              {inspectedUser.subuserServers && inspectedUser.subuserServers.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {inspectedUser.subuserServers.map((sName: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 text-xs font-mono flex items-center gap-1.5"
                    >
                      <Server className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{sName}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-xs">Dieser Benutzer ist auf keinen fremden Servern als Sub-User eingetragen.</p>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
