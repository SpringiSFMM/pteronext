import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, ShieldCheck, Trash2, Inbox, UserRound, UserPlus } from 'lucide-react';
import { Modal } from '../common/Modal';

export const AdminUsersView: React.FC = () => {
  const { adminUsers, adminLoading, createAdminUser, deleteAdminUser } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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

  return (
    <div className="space-y-6 view-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Accounts & Access</h1>
          <p className="page-subtitle">
            Accounts stored in the panel core database – create operators, grant root privileges
            or remove access.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New User</span>
        </button>
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

      {adminUsers.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-[#30363d] font-medium">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Two-Factor (2FA)</th>
                  <th className="py-3 px-4">Allocated Servers</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]/70">
                {adminUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#1c2128] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="w-8 h-8 rounded-lg object-cover border border-[#30363d]"
                        />
                        <div>
                          <p className="font-semibold text-white">{user.username}</p>
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
                        onClick={() => {
                          if (!window.confirm(`Delete account "${user.username}"?`)) return;
                          deleteAdminUser(user.id);
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
        title="Create Panel User"
        subtitle="Grant operational or administrative access to the platform"
        icon={<UserPlus className="w-4 h-4 text-emerald-400" />}
        badge="IAM ACCOUNT"
        badgeColor="emerald"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Username</label>
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
              <label className="field-label">Email Address</label>
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
            <label className="field-label">Initial Password</label>
            <input
              type="text"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
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
              Grant Root Administrator privileges (full system control)
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
