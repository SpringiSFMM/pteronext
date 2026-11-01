import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  Plus,
  ShieldCheck,
  Trash2,
  Inbox,
  UserRound,
  UserPlus,
  Search,
  Info,
  Shield,
  Server,
  Check,
  Copy,
  FlaskConical,
  Sparkles,
  Sliders,
  CheckSquare,
  Square,
  Globe,
  MessageSquare,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';

const BETA_FEATURES = [
  {
    key: 'ai_diagnostics',
    name: 'AI Server Diagnostics & Crash Analysis',
    name_de: 'KI Server-Diagnose & Crash-Analyse',
    desc: 'Neural log triage and autonomous crash investigation',
    desc_de: 'Neuronale Fehleranalyse und automatisierte Crashlog-Prüfung',
    badge: 'AI Core',
  },
  {
    key: 'telemetry_v2',
    name: 'Real-Time Telemetry & Daemon Heartbeat V2',
    name_de: 'Echtzeit-Telemetrie & Daemon Heartbeat V2',
    desc: 'Sub-millisecond socket metrics and dynamic scaling signals',
    desc_de: 'Sub-Millisekunden Socket-Metriken und dynamische Daemon-Signale',
    badge: 'Daemon',
  },
  {
    key: 'discord_bot_mgmt',
    name: 'Discord Bot Panel Management & Deep Config',
    name_de: 'Discord Bot Panel-Verwaltung & Konfiguration',
    desc: 'Live command overrides, channel mappings and guild toggles',
    desc_de: 'Live-Befehlssteuerung, Channel-Mappings und Guild-Toggles',
    badge: 'Discord',
  },
  {
    key: 'marketplace_beta',
    name: 'Egg Marketplace Preview & 1-Click Staging',
    name_de: 'Egg Marketplace Beta & 1-Klick Staging',
    desc: 'Access curated egg directory and test template staging',
    desc_de: 'Kuratierter Vorlagen-Store mit 1-Klick Template-Staging',
    badge: 'Eggs',
  },
  {
    key: 'drevix_pools',
    name: 'Dynamic Resource Pools & Adaptive Slicing',
    name_de: 'Dynamische Ressourcen-Pools & Adaptive Skalierung',
    desc: 'Cluster resource pooling and live server capacity slicing',
    desc_de: 'Geteilte CPU/RAM-Cluster-Pools und dynamisches Server-Slicing',
    badge: 'Drevix',
  },
  {
    key: 'custom_domains',
    name: 'Custom Domains & DNS-Relay Gateway',
    name_de: 'Eigene Domains & DNS-Relay Gateway',
    desc: 'Automated reverse proxy ingress and custom domain routing',
    desc_de: 'Automatisierte Reverse-Proxy-Zuweisung und Domain-Routing',
    badge: 'Network',
  },
  {
    key: 'file_editor_v2',
    name: 'Cyber-Glass Multi-Tab File Editor',
    name_de: 'Cyber-Glass Multi-Tab Datei-Editor',
    desc: 'Multi-tab editor with diff inspector and syntax trees',
    desc_de: 'Multi-Tab Editor mit Diff-Vorschau und Syntax-Bäumen',
    badge: 'Files',
  },
  {
    key: 'backup_remote_s3',
    name: 'S3 Multi-Cloud Remote Backups',
    name_de: 'S3 Multi-Cloud Remote Backups',
    desc: 'Off-site geo-redundant S3/Wasabi snapshot replication',
    desc_de: 'Standort-unabhängige, georedundante S3/Wasabi Replikation',
    badge: 'Storage',
  },
];

const KNOWN_DISCORD_GUILDS = [
  { id: '1560710184085618871', name: 'PteroNext Official Main Server' },
  { id: '1565666894873104424', name: 'Survival Vanilla Second Server' },
];

export const AdminUsersView: React.FC = () => {
  const { adminUsers, adminLoading, servers, createAdminUser, updateAdminUser, deleteAdminUser } = useApp();
  const { t, language } = useTranslation();
  const isDe = language === 'de';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<any | null>(null);
  const [inspectedUser, setInspectedUser] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Create User Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Member' | 'Beta Tester' | 'Administrator'>('Member');
  const [isCreating, setIsCreating] = useState(false);

  // Inspector / Beta Management State
  const [activeTab, setActiveTab] = useState<'overview' | 'beta'>('overview');
  const [editRoleName, setEditRoleName] = useState<'Member' | 'Beta Tester' | 'Administrator'>('Member');
  const [editIsBeta, setEditIsBeta] = useState(false);
  const [editBetaFeatures, setEditBetaFeatures] = useState<string[]>([]);
  const [serverScopeMode, setServerScopeMode] = useState<'all' | 'custom'>('all');
  const [editServerScope, setEditServerScope] = useState<string[]>([]);
  const [discordScopeMode, setDiscordScopeMode] = useState<'all' | 'custom'>('all');
  const [editDiscordScope, setEditDiscordScope] = useState<string[]>([]);
  const [isSavingBeta, setIsSavingBeta] = useState(false);

  // Sync edit state whenever a user is opened in inspector
  useEffect(() => {
    if (inspectedUser) {
      const isRoot = !!inspectedUser.rootAdmin;
      const isBeta = !!(inspectedUser.isBetaTester || inspectedUser.roleName === 'Beta Tester');

      let determinedRole: 'Member' | 'Beta Tester' | 'Administrator' = 'Member';
      if (isRoot || inspectedUser.roleName === 'Administrator') {
        determinedRole = 'Administrator';
      } else if (isBeta || inspectedUser.roleName === 'Beta Tester') {
        determinedRole = 'Beta Tester';
      }

      setEditRoleName(determinedRole);
      setEditIsBeta(isBeta);

      const features = inspectedUser.betaFeatures || [];
      setEditBetaFeatures(Array.isArray(features) ? features : []);

      const serversList = inspectedUser.betaServerScope || [];
      const hasSpecificServers = serversList.length > 0 && !serversList.includes('*');
      setServerScopeMode(hasSpecificServers ? 'custom' : 'all');
      setEditServerScope(hasSpecificServers ? serversList : []);

      const discordList = inspectedUser.betaDiscordScope || [];
      const hasSpecificDiscord = discordList.length > 0 && !discordList.includes('*');
      setDiscordScopeMode(hasSpecificDiscord ? 'custom' : 'all');
      setEditDiscordScope(hasSpecificDiscord ? discordList : []);
    }
  }, [inspectedUser]);

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

    const isRoot = newUserRole === 'Administrator';
    const isBeta = newUserRole === 'Beta Tester';

    const ok = await createAdminUser({
      username: username.trim(),
      email: email.trim(),
      password,
      root_admin: isRoot,
      role_name: newUserRole,
      is_beta_tester: isBeta,
      beta_features: isBeta ? BETA_FEATURES.map((f) => f.key) : [],
      beta_server_scope: ['*'],
      beta_discord_scope: ['*'],
    });

    setIsCreating(false);
    if (ok) {
      setIsModalOpen(false);
      setUsername('');
      setEmail('');
      setPassword('');
      setNewUserRole('Member');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setIsDeletingUser(true);
    try {
      await deleteAdminUser(deleteTargetUser.id);
      setDeleteTargetUser(null);
      if (inspectedUser?.id === deleteTargetUser.id) {
        setInspectedUser(null);
      }
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleToggleBetaFeature = (key: string) => {
    setEditBetaFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllFeatures = () => {
    setEditBetaFeatures(BETA_FEATURES.map((f) => f.key));
  };

  const handleDeselectAllFeatures = () => {
    setEditBetaFeatures([]);
  };

  const handleToggleServerScope = (uuid: string) => {
    setEditServerScope((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid]
    );
  };

  const handleToggleDiscordScope = (guildId: string) => {
    setEditDiscordScope((prev) =>
      prev.includes(guildId) ? prev.filter((id) => id !== guildId) : [...prev, guildId]
    );
  };

  const handleSaveBetaPermissions = async () => {
    if (!inspectedUser) return;
    setIsSavingBeta(true);

    try {
      const isRoot = editRoleName === 'Administrator';
      const isBeta = editRoleName === 'Beta Tester' || editIsBeta;
      const finalServerScope = serverScopeMode === 'all' ? ['*'] : editServerScope;
      const finalDiscordScope = discordScopeMode === 'all' ? ['*'] : editDiscordScope;

      const ok = await updateAdminUser(inspectedUser.id, {
        role_name: editRoleName,
        root_admin: isRoot,
        is_beta_tester: isBeta,
        beta_features: editBetaFeatures,
        beta_server_scope: finalServerScope,
        beta_discord_scope: finalDiscordScope,
      });

      if (ok) {
        setInspectedUser((prev: any) => ({
          ...prev,
          rootAdmin: isRoot,
          roleName: editRoleName,
          isBetaTester: isBeta,
          betaFeatures: editBetaFeatures,
          betaServerScope: finalServerScope,
          betaDiscordScope: finalDiscordScope,
        }));
      }
    } finally {
      setIsSavingBeta(false);
    }
  };

  return (
    <div className="space-y-6 view-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('users_title')}</h1>
          <p className="page-subtitle">{t('users_desc')}</p>
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
            <span>{t('users_new_user')}</span>
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
                {filteredUsers.map((user) => {
                  const isBeta = !!(user.isBetaTester || user.roleName === 'Beta Tester');
                  return (
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{t('users_role_admin')}</span>
                          </span>
                        ) : isBeta ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <FlaskConical className="w-3 h-3 text-cyan-400" />
                            <span>{t('users_role_beta')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#21262d] text-slate-300 border border-[#30363d]">
                            <UserRound className="w-3 h-3 text-slate-400" />
                            <span>{t('users_role_member')}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {user.isSubuser ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            <Shield className="w-3 h-3 text-indigo-400" />
                            <span>Sub-User ({user.subuserServers?.length || 1})</span>
                          </span>
                        ) : isBeta ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>
                              {user.betaFeatures?.length
                                ? `${user.betaFeatures.length} Beta Features`
                                : t('users_account_type_beta')}
                            </span>
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectedUser(user);
                              setActiveTab('beta');
                            }}
                            title={language === 'de' ? 'Rollen & Beta-Rechte verwalten' : 'Manage Roles & Beta Access'}
                            className="p-1.5 rounded-md bg-[#21262d] hover:bg-cyan-500/15 text-slate-400 hover:text-cyan-300 border border-[#30363d] hover:border-cyan-500/30 transition-colors"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
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

          {/* Role Selection */}
          <div className="space-y-2 pt-2 border-t border-[#30363d]">
            <label className="field-label">{t('users_role_select_title')}</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setNewUserRole('Member')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  newUserRole === 'Member'
                    ? 'bg-slate-800/80 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                    : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <UserRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('users_role_member')}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Standard Access</p>
              </button>

              <button
                type="button"
                onClick={() => setNewUserRole('Beta Tester')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  newUserRole === 'Beta Tester'
                    ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                    : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-cyan-300">
                  <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('users_role_beta')}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Preview Access</p>
              </button>

              <button
                type="button"
                onClick={() => setNewUserRole('Administrator')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  newUserRole === 'Administrator'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('users_role_admin')}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Full System IAM</p>
              </button>
            </div>
          </div>

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

      {/* Delete Confirmation Modal */}
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

      {/* User Details & Beta Tester Inspector Modal */}
      {inspectedUser && (
        <Modal
          isOpen={true}
          onClose={() => setInspectedUser(null)}
          title={`${isDe ? 'Benutzer' : 'User'}: ${inspectedUser.username}`}
          subtitle={
            isDe
              ? 'Verwalte Benutzerdetails, Rollen & granulare Beta-Tester Zugriffsrechte'
              : 'Manage user details, roles, and granular beta tester access'
          }
          icon={<Info className="w-5 h-5 text-indigo-400" />}
          badge={
            inspectedUser.rootAdmin
              ? 'ROOT ADMIN'
              : inspectedUser.isBetaTester || inspectedUser.roleName === 'Beta Tester'
              ? 'BETA TESTER'
              : inspectedUser.isSubuser
              ? 'SUB-USER'
              : 'MEMBER'
          }
          badgeColor={
            inspectedUser.rootAdmin
              ? 'emerald'
              : inspectedUser.isBetaTester || inspectedUser.roleName === 'Beta Tester'
              ? 'purple'
              : inspectedUser.isSubuser
              ? 'purple'
              : 'default'
          }
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
                    {(inspectedUser.isBetaTester || inspectedUser.roleName === 'Beta Tester') && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <FlaskConical className="w-3 h-3" />
                        <span>Beta Tester</span>
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

            {/* Tab Navigation */}
            <div className="flex border-b border-[#30363d]">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
                  activeTab === 'overview'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>{t('users_tab_overview')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('beta')}
                className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
                  activeTab === 'beta'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-cyan-400'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('users_tab_beta')}</span>
                {(inspectedUser.isBetaTester || inspectedUser.roleName === 'Beta Tester') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-3">
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
                      {isDe ? '2-Faktor-Authentifizierung (2FA)' : 'Two-Factor Authentication (2FA)'}
                    </span>
                    <span className={inspectedUser.twoFactor ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                      {inspectedUser.twoFactor
                        ? isDe
                          ? 'Aktiviert & Erzwingbar'
                          : 'Enabled & Enforced'
                        : isDe
                        ? 'Deaktiviert'
                        : 'Disabled'}
                    </span>
                  </div>

                  <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                      {isDe ? 'Registriert am' : 'Registered On'}
                    </span>
                    <span className="text-white font-semibold">{inspectedUser.createdAt || '—'}</span>
                  </div>

                  <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                      {isDe ? 'Eigene Server (Owner)' : 'Owned Servers (Owner)'}
                    </span>
                    <span className="text-white font-semibold">
                      {inspectedUser.serversCount} {inspectedUser.serversCount === 1 ? 'Server' : 'Servers'}
                    </span>
                  </div>

                  <div className="p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                      {isDe ? 'Verknüpftes Discord-Konto' : 'Linked Discord Account'}
                    </span>
                    <span className="text-slate-300 font-semibold">
                      {inspectedUser.discordUsername ||
                        (inspectedUser.discordId
                          ? `ID: ${inspectedUser.discordId}`
                          : isDe
                          ? 'Nicht verknüpft'
                          : 'Not linked')}
                    </span>
                  </div>
                </div>

                {/* Sub-User Delegations */}
                <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                    {isDe ? 'Sub-User Serverzugriffe & Delegationen' : 'Sub-User Server Delegations'} (
                    {inspectedUser.subuserServers?.length || 0})
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
                    <p className="text-slate-500 text-xs">
                      {isDe
                        ? 'Dieser Benutzer ist auf keinen fremden Servern als Sub-User eingetragen.'
                        : 'This user is not enrolled as a sub-user on any other servers.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ROLES & BETA TESTER PERMISSIONS */}
            {activeTab === 'beta' && (
              <div className="space-y-4">
                {/* Primary Role Selector */}
                <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-3">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-slate-300 block">
                    {t('users_role_select_title')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditRoleName('Member');
                        setEditIsBeta(false);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editRoleName === 'Member' && !editIsBeta
                          ? 'bg-slate-800 border-indigo-500 shadow-md shadow-indigo-500/10'
                          : 'bg-[#161b22] border-[#30363d] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-white">
                        <UserRound className="w-4 h-4 text-slate-400" />
                        <span>{t('users_role_member')}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {language === 'de' ? 'Normale Servernutzung ohne Vorabfunktionen' : 'Standard server management'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditRoleName('Beta Tester');
                        setEditIsBeta(true);
                        if (editBetaFeatures.length === 0) {
                          setEditBetaFeatures(BETA_FEATURES.map((f) => f.key));
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editRoleName === 'Beta Tester' || editIsBeta
                          ? 'bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/20'
                          : 'bg-[#161b22] border-[#30363d] hover:border-cyan-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-cyan-300">
                        <FlaskConical className="w-4 h-4 text-cyan-400" />
                        <span>{t('users_role_beta')}</span>
                      </div>
                      <p className="text-[10px] text-cyan-200/80 mt-1">
                        {language === 'de' ? 'Granulare Vorab-Features & Scopes freischalten' : 'Granular preview gates & scopes'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditRoleName('Administrator');
                        setEditIsBeta(false);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        editRoleName === 'Administrator'
                          ? 'bg-emerald-500/15 border-emerald-400 shadow-md shadow-emerald-500/20'
                          : 'bg-[#161b22] border-[#30363d] hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-emerald-300">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>{t('users_role_admin')}</span>
                      </div>
                      <p className="text-[10px] text-emerald-200/80 mt-1">
                        {language === 'de' ? 'Voller Root-Zugriff über den gesamten Cluster' : 'Full root cluster administration'}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Master Beta Switch */}
                <div className="p-4 rounded-xl bg-[#0d1117] border border-cyan-500/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-xs">{t('users_beta_status')}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t('users_beta_status_desc')}</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsBeta}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setEditIsBeta(next);
                        if (next && editRoleName === 'Member') {
                          setEditRoleName('Beta Tester');
                          if (editBetaFeatures.length === 0) {
                            setEditBetaFeatures(BETA_FEATURES.map((f) => f.key));
                          }
                        } else if (!next && editRoleName === 'Beta Tester') {
                          setEditRoleName('Member');
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#21262d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                {/* Granular Feature Checkboxes */}
                {editIsBeta && (
                  <>
                    <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h5 className="font-bold text-white text-xs flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-cyan-400" />
                            <span>{t('users_beta_features_title')}</span>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300">
                              {editBetaFeatures.length} / {BETA_FEATURES.length}
                            </span>
                          </h5>
                          <p className="text-[11px] text-slate-400 mt-0.5">{t('users_beta_features_desc')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleSelectAllFeatures}
                            className="text-[10px] px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white transition-colors"
                          >
                            {t('users_beta_select_all')}
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllFeatures}
                            className="text-[10px] px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {t('users_beta_deselect_all')}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        {BETA_FEATURES.map((feat) => {
                          const isChecked = editBetaFeatures.includes(feat.key);
                          const title = language === 'de' ? feat.name_de : feat.name;
                          const desc = language === 'de' ? feat.desc_de : feat.desc;

                          return (
                            <div
                              key={feat.key}
                              onClick={() => handleToggleBetaFeature(feat.key)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                                isChecked
                                  ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                                  : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:border-slate-600'
                              }`}
                            >
                              <div className="mt-0.5">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="font-semibold text-xs truncate">{title}</p>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#21262d] text-slate-400 font-mono">
                                    {feat.badge}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">
                                  {desc}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Panel Server Scope */}
                    <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-3">
                      <div>
                        <h5 className="font-bold text-white text-xs flex items-center gap-2">
                          <Server className="w-4 h-4 text-indigo-400" />
                          <span>{t('users_beta_server_scope_title')}</span>
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">{t('users_beta_server_scope_desc')}</p>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="serverScope"
                            checked={serverScopeMode === 'all'}
                            onChange={() => setServerScopeMode('all')}
                            className="text-cyan-500 bg-[#0d1117] border-[#30363d]"
                          />
                          <span className={serverScopeMode === 'all' ? 'text-white font-medium' : 'text-slate-400'}>
                            {t('users_beta_server_scope_all')}
                          </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="serverScope"
                            checked={serverScopeMode === 'custom'}
                            onChange={() => setServerScopeMode('custom')}
                            className="text-cyan-500 bg-[#0d1117] border-[#30363d]"
                          />
                          <span className={serverScopeMode === 'custom' ? 'text-white font-medium' : 'text-slate-400'}>
                            {t('users_beta_server_scope_custom')}
                          </span>
                        </label>
                      </div>

                      {serverScopeMode === 'custom' && (
                        <div className="space-y-2 pt-2 border-t border-[#30363d]">
                          <span className="text-[10px] text-slate-500 block uppercase">
                            {language === 'de' ? 'Freigegebene Server auswählen:' : 'Select authorized servers:'}
                          </span>
                          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                            {servers && servers.length > 0 ? (
                              servers.map((srv) => {
                                const isSelected = editServerScope.includes(srv.uuid);
                                return (
                                  <div
                                    key={srv.uuid}
                                    onClick={() => handleToggleServerScope(srv.uuid)}
                                    className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                                        : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <Server className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                      <span className="font-semibold truncate">{srv.name}</span>
                                      <span className="text-[10px] text-slate-500 font-mono">({srv.uuid.slice(0, 8)})</span>
                                    </div>
                                    {isSelected ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    ) : (
                                      <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-slate-500 text-[11px]">
                                {isDe ? 'Keine Server im Cluster gefunden.' : 'No servers found in cluster.'}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Discord Server Scope */}
                    <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-3">
                      <div>
                        <h5 className="font-bold text-white text-xs flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-purple-400" />
                          <span>{t('users_beta_discord_scope_title')}</span>
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">{t('users_beta_discord_scope_desc')}</p>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="discordScope"
                            checked={discordScopeMode === 'all'}
                            onChange={() => setDiscordScopeMode('all')}
                            className="text-cyan-500 bg-[#0d1117] border-[#30363d]"
                          />
                          <span className={discordScopeMode === 'all' ? 'text-white font-medium' : 'text-slate-400'}>
                            {t('users_beta_discord_scope_all')}
                          </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="discordScope"
                            checked={discordScopeMode === 'custom'}
                            onChange={() => setDiscordScopeMode('custom')}
                            className="text-cyan-500 bg-[#0d1117] border-[#30363d]"
                          />
                          <span className={discordScopeMode === 'custom' ? 'text-white font-medium' : 'text-slate-400'}>
                            {t('users_beta_discord_scope_custom')}
                          </span>
                        </label>
                      </div>

                      {discordScopeMode === 'custom' && (
                        <div className="space-y-2 pt-2 border-t border-[#30363d]">
                          <span className="text-[10px] text-slate-500 block uppercase">
                            {language === 'de' ? 'Freigegebene Discord Server:' : 'Select authorized Discord guilds:'}
                          </span>
                          <div className="space-y-1.5">
                            {KNOWN_DISCORD_GUILDS.map((guild) => {
                              const isSelected = editDiscordScope.includes(guild.id);
                              return (
                                <div
                                  key={guild.id}
                                  onClick={() => handleToggleDiscordScope(guild.id)}
                                  className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-purple-500/15 border-purple-500/40 text-white'
                                      : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    <span className="font-semibold">{guild.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">({guild.id})</span>
                                  </div>
                                  {isSelected ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Save Button for Tab 2 */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
                  <button
                    type="button"
                    onClick={() => setInspectedUser(null)}
                    className="btn btn-ghost"
                  >
                    {t('common_cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBetaPermissions}
                    disabled={isSavingBeta}
                    className="btn btn-primary flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingBeta ? t('users_beta_saving') : t('users_beta_save')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Close footer for overview tab */}
            {activeTab === 'overview' && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('beta')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-medium"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>{language === 'de' ? 'Rollen & Beta-Rechte bearbeiten →' : 'Edit Roles & Beta Access →'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                >
                  {isDe ? 'Schließen' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
