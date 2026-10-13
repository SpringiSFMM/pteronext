import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Key,
  Lock,
  Mail,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  Download,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Palette,
  Globe,
  Code,
  Wand2,
  Camera,
  Upload,
  MessageSquare,
  Unlink,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { api } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { COLOR_THEMES, BACKGROUND_EFFECTS, ColorTheme, BackgroundEffect } from '../../types';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    addToast,
    accountSettingsTab,
    setAccountSettingsTab,
    colorTheme,
    globalColorTheme,
    setColorTheme,
    resetPersonalTheme,
    backgroundEffect,
    setBackgroundEffect,
    customCss,
    setCustomCss,
    language,
    setLanguage,
    currentUser,
    setCurrentUser,
  } = useApp();

  const [tempCss, setTempCss] = useState(customCss);

  useEffect(() => {
    setTempCss(customCss);
  }, [customCss]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'profile' | '2fa' | 'api-keys' | 'appearance'>(
    accountSettingsTab || 'profile'
  );

  useEffect(() => {
    if (accountSettingsTab && isOpen) {
      setActiveTab(accountSettingsTab);
    }
  }, [accountSettingsTab, isOpen]);

  const handleTabChange = (tab: 'profile' | '2fa' | 'api-keys') => {
    setActiveTab(tab);
    setAccountSettingsTab(tab);
  };

  // --- Profile Tab State ---
  const [username, setUsername] = useState('admin');
  const [email, setEmail] = useState('admin@pteronext.internal');
  const [nameFirst, setNameFirst] = useState('Panel');
  const [nameLast, setNameLast] = useState('Admin');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [discordId, setDiscordId] = useState<string>('');
  const [discordUsername, setDiscordUsername] = useState<string>('');
  const [discordVerificationStep, setDiscordVerificationStep] = useState<'idle' | 'input' | 'code_sent'>('idle');
  const [discordTagInput, setDiscordTagInput] = useState('');
  const [discordCode, setDiscordCode] = useState('');
  const [isRequestingDiscordCode, setIsRequestingDiscordCode] = useState(false);
  const [isConfirmingDiscordCode, setIsConfirmingDiscordCode] = useState(false);
  const [discordErrorMessage, setDiscordErrorMessage] = useState<string | null>(null);
  const [pendingDiscordUser, setPendingDiscordUser] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // --- 2FA Tab State ---
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [is2FASetupActive, setIs2FASetupActive] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // --- API Keys Tab State ---
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [newKeyMemo, setNewKeyMemo] = useState('');
  const [newKeyAllowedIPs, setNewKeyAllowedIPs] = useState('');
  const [newKeyExpires, setNewKeyExpires] = useState<number | undefined>(undefined);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'servers:read',
    'servers:control',
  ]);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newlyCreatedKeySecret, setNewlyCreatedKeySecret] = useState<string | null>(null);
  const [copiedRawKey, setCopiedRawKey] = useState(false);
  const [isDeletingKeyId, setIsDeletingKeyId] = useState<number | null>(null);
  const [deleteApiKeyTarget, setDeleteApiKeyTarget] = useState<{ id: number; memo?: string } | null>(null);

  // Fetch account data and keys on modal open
  useEffect(() => {
    if (isOpen) {
      loadAccountData();
      loadApiKeys();
      // Reset transient setup states
      setIs2FASetupActive(false);
      setShowBackupCodes(false);
      setBackupCodes([]);
      setVerificationCode('');
      setDisablePassword('');
      setPasswordError(null);
      setTwoFactorError(null);
      setNewlyCreatedKeySecret(null);
    }
  }, [isOpen]);

  const loadAccountData = async () => {
    try {
      const data = await api.account.get();
      if (data && data.user) {
        setUsername(data.user.username || 'admin');
        setEmail(data.user.email || '');
        setNameFirst(data.user.name_first || '');
        setNameLast(data.user.name_last || '');
        setTwoFactorEnabled(Boolean(data.user.two_factor_enabled));
        if (data.user.avatar_url) setAvatarUrl(data.user.avatar_url);
        if (data.user.discord_id) setDiscordId(data.user.discord_id);
        if (data.user.discord_username) setDiscordUsername(data.user.discord_username);
      }
    } catch (err) {
      console.warn('Failed loading account details from backend:', err);
    }
  };

  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast({
        title: language === 'de' ? 'Ungültiges Dateiformat' : 'Invalid File Type',
        description: language === 'de' ? 'Bitte wähle ein PNG, JPG oder WebP Bild.' : 'Please select a PNG, JPG, or WebP image.',
        type: 'error',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      if (b64) {
        setAvatarUrl(b64);
        setCurrentUser((prev: any) => ({ ...prev, avatar: b64 }));
        try {
          await api.account.updateProfile({ avatar_url: b64 });
          addToast({
            title: language === 'de' ? 'Profilbild aktualisiert' : 'Avatar Updated',
            description: language === 'de' ? 'Dein neues Profilbild wurde gespeichert.' : 'Profile picture saved successfully.',
            type: 'success',
          });
        } catch (err: any) {
          addToast({
            title: language === 'de' ? 'Fehler beim Speichern' : 'Save Failed',
            description: err.message || 'Failed saving avatar',
            type: 'error',
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRequestDiscordCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!discordTagInput.trim()) return;
    setIsRequestingDiscordCode(true);
    setDiscordErrorMessage(null);
    try {
      const res = await api.discord.requestCode(discordTagInput.trim(), language);
      setPendingDiscordUser(res.discord_username || discordTagInput.trim());
      setDiscordVerificationStep('code_sent');
      addToast({
        title: language === 'de' ? 'DM gesendet!' : 'DM Sent!',
        description: res.message || (language === 'de' ? 'Verifizierungs-Code per Discord-DM gesendet.' : 'Verification code sent via Discord DM.'),
        type: 'success',
      });
    } catch (err: any) {
      setDiscordErrorMessage(err.message || (language === 'de' ? 'Konnte Code nicht anfordern' : 'Failed requesting verification code'));
      addToast({
        title: language === 'de' ? 'Discord-Fehler' : 'Discord Error',
        description: err.message || (language === 'de' ? 'Konnte Code nicht anfordern' : 'Failed requesting code'),
        type: 'error',
      });
    } finally {
      setIsRequestingDiscordCode(false);
    }
  };

  const handleConfirmDiscordCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!discordCode.trim()) return;
    setIsConfirmingDiscordCode(true);
    setDiscordErrorMessage(null);
    try {
      const res = await api.discord.confirmCode(discordCode.trim());
      setDiscordId(res.discord_id);
      setDiscordUsername(res.discord_username);
      setDiscordVerificationStep('idle');
      setDiscordCode('');
      setDiscordTagInput('');
      setPendingDiscordUser('');
      addToast({
        title: language === 'de' ? 'Discord verknüpft' : 'Discord Linked',
        description: language === 'de' ? 'Dein Discord-Account wurde erfolgreich verknüpft!' : 'Your Discord account has been successfully linked!',
        type: 'success',
      });
    } catch (err: any) {
      setDiscordErrorMessage(err.message || (language === 'de' ? 'Ungültiger Code' : 'Invalid code'));
      addToast({
        title: language === 'de' ? 'Verifikation fehlgeschlagen' : 'Verification Failed',
        description: err.message || 'Code verification failed',
        type: 'error',
      });
    } finally {
      setIsConfirmingDiscordCode(false);
    }
  };

  const handleUnlinkDiscord = async () => {
    try {
      await api.discord.unlink();
      setDiscordId('');
      setDiscordUsername('');
      addToast({
        title: language === 'de' ? 'Discord getrennt' : 'Discord Disconnected',
        description: language === 'de' ? 'Dein Discord-Konto wurde getrennt.' : 'Your Discord account was disconnected.',
        type: 'info',
      });
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Fehler' : 'Error',
        description: err.message || 'Failed unlinking Discord',
        type: 'error',
      });
    }
  };

  const loadApiKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const res = await api.apiKeys.list();
      setApiKeys(res.data || []);
    } catch (err) {
      console.warn('Failed listing API keys:', err);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  // --- Profile Actions ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await api.account.updateProfile({
        name_first: nameFirst,
        name_last: nameLast,
        email,
        username,
        avatar_url: avatarUrl || undefined,
      });
      addToast({
        title: 'Profile Updated',
        description: 'Your account details have been saved successfully.',
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Update Failed',
        description: err.message || 'Failed updating profile info.',
        type: 'error',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.account.updatePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      addToast({
        title: 'Password Changed',
        description: 'Your security password has been updated.',
        type: 'success',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Incorrect current password or server error.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // --- 2FA Actions ---
  const handleStart2FASetup = async () => {
    setIs2FALoading(true);
    setTwoFactorError(null);
    try {
      const setup = await api.account.setup2FA();
      setQrCodeUrl(setup.qr_code_data_url);
      setSecretKey(setup.secret);
      setIs2FASetupActive(true);
    } catch (err: any) {
      setTwoFactorError(err.message || 'Failed generating 2FA enrollment setup.');
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleVerify2FACode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length < 6) {
      setTwoFactorError('Please enter the 6-digit TOTP code from your authenticator app.');
      return;
    }

    setIs2FALoading(true);
    setTwoFactorError(null);
    try {
      const res = await api.account.enable2FA({
        secret: secretKey,
        code: verificationCode.trim(),
      });

      setTwoFactorEnabled(true);
      setIs2FASetupActive(false);
      setBackupCodes(res.backup_codes || []);
      setShowBackupCodes(true);

      addToast({
        title: '2FA Activated',
        description: 'Two-factor authentication is now active on your account!',
        type: 'success',
      });
    } catch (err: any) {
      setTwoFactorError(err.message || 'Invalid 6-digit code. Please verify the code and try again.');
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword) {
      setTwoFactorError('Current password is required to disable 2FA.');
      return;
    }

    setIsDisabling2FA(true);
    setTwoFactorError(null);
    try {
      await api.account.disable2FA(disablePassword);
      setTwoFactorEnabled(false);
      setDisablePassword('');
      addToast({
        title: '2FA Deactivated',
        description: 'Two-factor authentication has been disabled on this account.',
        type: 'warning',
      });
    } catch (err: any) {
      setTwoFactorError(err.message || 'Incorrect password.');
    } finally {
      setIsDisabling2FA(false);
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'backup' | 'rawKey') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else if (type === 'backup') {
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
    } else if (type === 'rawKey') {
      setCopiedRawKey(true);
      setTimeout(() => setCopiedRawKey(false), 2500);
    }
  };

  const downloadBackupCodesFile = () => {
    const textContent = `PTERONEXT EMERGENCY 2FA RECOVERY CODES\nAccount: ${email}\nDate: ${new Date().toISOString()}\n\n${backupCodes.join(
      '\n'
    )}\n\n* Each backup code can only be used once.\n* Keep this file confidential in a secure password manager.`;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pteronext-backup-codes-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- API Key Actions ---
  const handleTogglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyMemo.trim()) return;

    setIsCreatingKey(true);
    try {
      const res = await api.apiKeys.create({
        description: newKeyMemo.trim(),
        memo: newKeyMemo.trim(),
        allowed_ips: newKeyAllowedIPs.trim(),
        permissions: selectedPermissions,
        expires_in_days: newKeyExpires,
      });

      setNewlyCreatedKeySecret(res.secret);
      setNewKeyMemo('');
      setNewKeyAllowedIPs('');
      await loadApiKeys();

      addToast({
        title: 'API Key Generated',
        description: 'New account API key created successfully.',
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Key Generation Failed',
        description: err.message || 'Could not create API key.',
        type: 'error',
      });
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleDeleteApiKey = (id: number, memo?: string) => {
    setDeleteApiKeyTarget({ id, memo });
  };

  const handleConfirmDeleteApiKey = async () => {
    if (!deleteApiKeyTarget) return;
    setIsDeletingKeyId(deleteApiKeyTarget.id);
    try {
      await api.apiKeys.delete(deleteApiKeyTarget.id);
      setApiKeys((prev) => prev.filter((k) => k.id !== deleteApiKeyTarget.id));
      addToast({
        title: language === 'de' ? 'API-Schlüssel widerrufen' : 'API Key Revoked',
        description:
          language === 'de'
            ? 'Der API-Schlüssel wurde dauerhaft gelöscht.'
            : 'The API key has been deleted.',
        type: 'info',
      });
      setDeleteApiKeyTarget(null);
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Widerruf fehlgeschlagen' : 'Revoke Failed',
        description: err.message || 'Failed deleting key.',
        type: 'error',
      });
    } finally {
      setIsDeletingKeyId(null);
    }
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Account Settings"
      subtitle="Security, Profile Identification & API Access"
      icon={<User className="w-4 h-4 text-zinc-300" />}
      badge="ACCOUNT"
      badgeColor="default"
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Navigation Tabs Header */}
        <div className="flex items-center gap-1.5 border-b border-slate-800 pb-3">
          {[
            { id: 'profile', label: 'Profile & Security', icon: User },
            {
              id: '2fa',
              label: 'Two-Factor Auth',
              icon: Shield,
              badge: twoFactorEnabled ? 'Active' : undefined,
            },
            {
              id: 'api-keys',
              label: 'API Keys',
              icon: Key,
              count: apiKeys.length,
            },
            {
              id: 'appearance',
              label: 'Color Theme',
              icon: Palette,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
                  isActive
                    ? 'theme-tab-active font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--theme-accent)]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PROFILE & PASSWORD */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* User Profile Card with Avatar Uploader */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  title={language === 'de' ? 'Klicken zum Ändern des Profilbilds' : 'Click to change profile picture'}
                >
                  <img
                    src={avatarUrl || currentUser?.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="%2321262d"/></svg>'}
                    alt="Profile Avatar"
                    className="w-14 h-14 rounded-2xl object-cover border border-white/10 group-hover:opacity-75 transition-opacity shadow-md"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-2xl">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleAvatarFileSelected}
                    className="hidden"
                  />
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">{username}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/10">
                      Root Administrator
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{email}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{language === 'de' ? 'Bild hochladen' : 'Upload Image'}</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrl('');
                          setCurrentUser((prev: any) => ({ ...prev, avatar: '' }));
                          api.account.updateProfile({ avatar_url: '' });
                        }}
                        className="text-[11px] font-mono text-rose-400 hover:text-rose-300 hover:underline"
                      >
                        {language === 'de' ? 'Entfernen' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right hidden sm:block text-[11px] font-mono text-slate-500">
                <p>Status: <span className="text-emerald-400">Verified</span></p>
                <p>MFA: <span className={twoFactorEnabled ? 'text-emerald-400' : 'text-amber-400'}>{twoFactorEnabled ? 'Enforced' : 'Optional'}</span></p>
              </div>
            </div>

            {/* Profile Information Form */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-mono font-semibold uppercase tracking-wider">
                <User className="w-4 h-4" />
                <span>Personal Identity Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={nameFirst}
                    onChange={(e) => setNameFirst(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={nameLast}
                    onChange={(e) => setNameLast(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {isSavingProfile && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </form>

            {/* Discord Account Linking Card */}
            <div className="p-4 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#5865F2] flex items-center justify-center text-white shadow-md">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-mono">
                      {language === 'de' ? 'Discord-Konto Verknüpfung' : 'Discord Account Link'}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {language === 'de'
                        ? 'Ermöglicht 1-Klick-Anmeldung und Community-Synchronisation'
                        : 'Enables 1-click social sign-in and community sync'}
                    </p>
                  </div>
                </div>

                {discordUsername ? (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{language === 'de' ? 'Verbunden' : 'Linked'}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono">
                    {language === 'de' ? 'Nicht verknüpft' : 'Not linked'}
                  </span>
                )}
              </div>

              {discordUsername ? (
                <div className="flex items-center justify-between pt-2 border-t border-[#5865F2]/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">@{discordUsername}</span>
                    <span className="text-[10px] font-mono text-slate-400">({discordId})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlinkDiscord}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono transition-colors flex items-center gap-1 active:scale-95"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>{language === 'de' ? 'Verbindung trennen' : 'Unlink Discord'}</span>
                  </button>
                </div>
              ) : discordVerificationStep === 'code_sent' ? (
                /* Step 2: Enter 6-digit Code sent via Bot DM */
                <div className="pt-2 border-t border-[#5865F2]/20 space-y-3">
                  <div className="p-3 rounded-xl bg-[#5865F2]/15 border border-[#5865F2]/30 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-300">
                      <MessageSquare className="w-4 h-4 text-[#5865F2] shrink-0" />
                      <span>
                        {language === 'de'
                          ? `Code per DM an @${pendingDiscordUser} gesendet!`
                          : `Verification code sent to @${pendingDiscordUser} via DM!`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                      {language === 'de'
                        ? 'Bitte prüfe jetzt deine privaten Direktnachrichten (DM) auf Discord. Unser Bot hat dir einen 6-stelligen Sicherheitscode geschickt.'
                        : 'Please check your Discord direct messages. Our bot has sent you a 6-digit security code.'}
                    </p>
                    <p className="text-[10px] text-amber-300/80 font-mono flex items-center gap-1 pt-0.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>
                        {language === 'de'
                          ? 'Wichtig: DMs von Servermitgliedern müssen in Discord erlaubt sein.'
                          : 'Important: Direct messages from server members must be allowed.'}
                      </span>
                    </p>
                  </div>

                  {discordErrorMessage && (
                    <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{discordErrorMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleConfirmDiscordCode} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-300 mb-1">
                        {language === 'de' ? '6-stelliger Discord-Code:' : '6-digit Discord code:'}
                      </label>
                      <input
                        type="text"
                        autoFocus
                        maxLength={8}
                        placeholder="••••••"
                        value={discordCode}
                        onChange={(e) => setDiscordCode(e.target.value.trim())}
                        className="w-full bg-slate-950 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-[0.5em] text-white focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRequestDiscordCode()}
                          disabled={isRequestingDiscordCode}
                          className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRequestingDiscordCode ? 'animate-spin' : ''}`} />
                          <span>{language === 'de' ? 'Neuen Code anfordern' : 'Resend Code'}</span>
                        </button>
                        <span className="text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            setDiscordVerificationStep('input');
                            setDiscordErrorMessage(null);
                          }}
                          className="text-[11px] font-mono text-slate-400 hover:text-slate-300"
                        >
                          {language === 'de' ? 'Anderer Discord-Name' : 'Change Discord Name'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDiscordVerificationStep('idle');
                            setDiscordErrorMessage(null);
                            setDiscordCode('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-mono hover:text-white"
                        >
                          {language === 'de' ? 'Abbrechen' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          disabled={isConfirmingDiscordCode || !discordCode.trim()}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                        >
                          {isConfirmingDiscordCode ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{language === 'de' ? 'Code bestätigen & verknüpfen' : 'Verify & Link'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : discordVerificationStep === 'input' ? (
                /* Step 1: Input Discord Username / Tag and send Bot DM */
                <div className="pt-2 border-t border-[#5865F2]/20 space-y-3">
                  <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                    {language === 'de'
                      ? 'Gib deinen Discord-Benutzernamen ein. Unser Bot prüft, ob du auf unserem Discord-Server bist, und sendet dir deinen 6-stelligen Bestätigungscode per DM.'
                      : 'Enter your Discord username or user ID. Our bot verifies you are on our Discord server and delivers your 6-digit confirmation code via DM.'}
                  </p>

                  {discordErrorMessage && (
                    <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{discordErrorMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleRequestDiscordCode} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Discord Name (z. B. SpringiSFM oder ID)"
                        value={discordTagInput}
                        onChange={(e) => setDiscordTagInput(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#5865F2]"
                      />
                      <button
                        type="submit"
                        disabled={isRequestingDiscordCode || !discordTagInput.trim()}
                        className="px-4 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                      >
                        {isRequestingDiscordCode ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5" />
                        )}
                        <span>{language === 'de' ? 'Code per DM senden' : 'Send Code via DM'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscordVerificationStep('idle');
                          setDiscordErrorMessage(null);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-mono hover:text-white"
                      >
                        {language === 'de' ? 'Abbrechen' : 'Cancel'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Step 0: Idle state with Connect button */
                <div className="pt-2 border-t border-[#5865F2]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400 font-mono">
                    {language === 'de'
                      ? 'Verifiziere deinen Account über unseren Discord-Bot mit automatischem DM-Code.'
                      : 'Verify your account using our Discord bot with automated DM code verification.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscordVerificationStep('input');
                      setDiscordErrorMessage(null);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{language === 'de' ? 'Discord verknüpfen' : 'Link Discord'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Change Password Form */}
            <form onSubmit={handleUpdatePassword} className="space-y-4 pt-5 border-t border-slate-800">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-mono font-semibold uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                <span>Security Password Modification</span>
              </div>

              {passwordError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                      New Password (min 8 chars)
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono font-medium text-xs border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  {isUpdatingPassword && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TWO-FACTOR AUTHENTICATION (2FA) */}
        {/* ========================================================================= */}
        {activeTab === '2fa' && (
          <div className="space-y-6">
            {twoFactorError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{twoFactorError}</span>
              </div>
            )}

            {/* Sub-State 1: Display Emergency Recovery Backup Codes (Immediately after enrollment) */}
            {showBackupCodes && backupCodes.length > 0 && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold text-sm font-mono uppercase tracking-tight">
                    Emergency Recovery Backup Codes
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  Store these 10 one-time emergency backup codes in a safe location. If you lose access
                  to your authenticator app, each code can be used once to access your account.
                </p>

                {/* Codes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-center">
                  {backupCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-lg bg-slate-950 text-zinc-200 text-xs font-bold border border-slate-800 select-all tracking-wider"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-zinc-200 font-mono text-xs border border-slate-700 transition-colors flex items-center gap-2"
                  >
                    {copiedBackup ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBackup ? 'All Codes Copied' : 'Copy All Codes'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadBackupCodesFile}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs border border-slate-700 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .txt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBackupCodes(false)}
                      className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs shadow-md transition-all active:scale-95"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-State 2: 2FA is ENABLED */}
            {twoFactorEnabled && !showBackupCodes && (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white font-mono">
                            TWO-FACTOR AUTHENTICATION ACTIVE
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                            ENFORCED
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          Account protected via RFC 6238 TOTP Authenticator Protocol
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Option to Disable 2FA with Password */}
                <form onSubmit={handleDisable2FA} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                  <div>
                    <h5 className="text-xs font-mono font-bold text-slate-300 uppercase">
                      Deactivate Two-Factor Authentication
                    </h5>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      To disable 2FA, enter your master account password for verification.
                    </p>
                  </div>

                  <div>
                    <input
                      type="password"
                      required
                      placeholder="Account master password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      className="w-full sm:w-80 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isDisabling2FA}
                    className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono text-xs border border-red-500/40 transition-colors flex items-center gap-2"
                  >
                    {isDisabling2FA && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Disable 2FA Protection</span>
                  </button>
                </form>
              </div>
            )}

            {/* Sub-State 3: 2FA is DISABLED and Setup is NOT active */}
            {!twoFactorEnabled && !is2FASetupActive && !showBackupCodes && (
              <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mx-auto flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-mono">
                    TWO-FACTOR AUTHENTICATION IS DISABLED
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                    Protect your server matrix against credential stuffing and unauthorized terminal
                    takeovers with standard Time-based One-Time Password (TOTP) authentication.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleStart2FASetup}
                    disabled={is2FALoading}
                    className="px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs shadow-lg transition-all flex items-center gap-2 mx-auto active:scale-95"
                  >
                    {is2FALoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4" />
                    )}
                    <span>Enable 2FA Authentication</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sub-State 4: 2FA Enrollment Wizard Active (QR Code + 6-digit Code input) */}
            {!twoFactorEnabled && is2FASetupActive && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-white/10 space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-zinc-200 text-xs font-mono font-bold uppercase">
                    <QrCode className="w-4 h-4" />
                    <span>Scan QR Code with Authenticator</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIs2FASetupActive(false)}
                    className="text-xs text-slate-400 hover:text-white font-mono"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                  {/* QR Code Preview */}
                  <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-lg w-fit mx-auto">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="TOTP Enrollment QR Code"
                        className="w-48 h-48 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      </div>
                    )}
                    <span className="text-[10px] text-slate-800 font-mono font-semibold mt-1">
                      PteroNext Matrix Cluster
                    </span>
                  </div>

                  {/* Manual Secret & Verification Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                        Manual Base32 Secret Key
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={secretKey}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(secretKey, 'secret')}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-zinc-300 transition-colors"
                          title="Copy Base32 Secret"
                        >
                          {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleVerify2FACode} className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-bold">
                          Enter 6-Digit Authenticator Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          autoFocus
                          required
                          placeholder="123456"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-slate-900 border border-white/20 rounded-xl px-4 py-2.5 text-lg font-mono font-bold tracking-[0.3em] text-center text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={is2FALoading || verificationCode.length < 6}
                        className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                      >
                        {is2FALoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                        <span>Verify & Activate 2FA</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: API KEYS */}
        {/* ========================================================================= */}
        {activeTab === 'api-keys' && (
          <div className="space-y-6">
            {/* Newly Created Key Alert Banner (Shown Only Once!) */}
            {newlyCreatedKeySecret && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/40 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>NEW API SECRET KEY (SHOWS ONLY ONCE)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewlyCreatedKeySecret(null)}
                    className="text-xs font-mono text-slate-400 hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newlyCreatedKeySecret}
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-xs font-mono text-amber-200 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newlyCreatedKeySecret, 'rawKey')}
                    className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {copiedRawKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedRawKey ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 font-mono">
                  Make sure to copy your API key now. You will not be able to see it again!
                </p>
              </div>
            )}

            {/* List Existing Keys */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-200 text-xs font-mono font-semibold uppercase tracking-wider">
                  <Key className="w-4 h-4" />
                  <span>Configured Account API Keys</span>
                </div>
                <button
                  type="button"
                  onClick={loadApiKeys}
                  className="text-slate-400 hover:text-white text-xs font-mono flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingKeys ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingKeys && apiKeys.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-500">
                  Loading API keys...
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs font-mono text-slate-400">
                  No API keys generated yet. Use the form below to create a key.
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((k) => (
                    <div
                      key={k.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between transition-all hover:border-slate-700"
                    >
                      <div className="space-y-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">
                            {k.memo || 'Account Key'}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-zinc-300 border border-slate-800">
                            id: {k.identifier}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                          <span>IPs: {k.allowed_ips || 'Any IP (0.0.0.0/0)'}</span>
                          <span>•</span>
                          <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteApiKey(k.id, k.memo || k.identifier)}
                        disabled={isDeletingKeyId === k.id}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Revoke API Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create New Key Form */}
            <form onSubmit={handleCreateApiKey} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-mono font-semibold uppercase tracking-wider">
                <Plus className="w-4 h-4" />
                <span>Create New API Key</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                    Description / Memo <span className="text-zinc-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GitHub Actions Deployment / CLI Token"
                    value={newKeyMemo}
                    onChange={(e) => setNewKeyMemo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                    Allowed IPs <span className="text-slate-500">(Optional CIDR)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty for unrestricted access"
                    value={newKeyAllowedIPs}
                    onChange={(e) => setNewKeyAllowedIPs(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                  />
                </div>
              </div>

              {/* Permissions Checklist */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-2">
                  Key Permissions & Scopes
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'servers:read', label: 'View Servers & Metrics' },
                    { id: 'servers:control', label: 'Power Control & Terminal' },
                    { id: 'servers:files', label: 'File Manager Read/Write' },
                    { id: 'servers:databases', label: 'Database Provisioning' },
                    { id: 'admin:full', label: 'Full Administrator Scope' },
                  ].map((perm) => {
                    const isChecked = selectedPermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer text-xs font-mono transition-all ${
                          isChecked
                            ? 'bg-white/10 border-white/30 text-white font-semibold'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePermission(perm.id)}
                          className="accent-[var(--theme-accent,#e5a93c)] rounded"
                        />
                        <span>{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Expires:</span>
                  <select
                    value={newKeyExpires ?? ''}
                    onChange={(e) =>
                      setNewKeyExpires(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
                  >
                    <option value="">Never Expires</option>
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                    <option value="90">90 Days</option>
                    <option value="365">1 Year</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isCreatingKey || !newKeyMemo.trim()}
                  className="btn btn-primary font-mono text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 px-5 py-2"
                >
                  {isCreatingKey && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Key</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- Appearance / Studio Tab --- */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            {/* 1. Language Selector */}
            <div className="p-4 rounded-xl bg-[#11141a] border border-[#30363d] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    <span>Sprache / Language</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Wähle die bevorzugte Sprache für die gesamte Benutzeroberfläche.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('de');
                    addToast({
                      title: 'Sprache geändert',
                      description: 'Die Benutzeroberfläche ist jetzt auf Deutsch eingestellt.',
                      type: 'success',
                    });
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 ${
                    language === 'de'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-[#161b22] border-[#30363d] text-slate-300 hover:text-white'
                  }`}
                >
                  <span>🇩🇪</span>
                  <span>Deutsch (DE)</span>
                  {language === 'de' && <Check className="w-3.5 h-3.5 ml-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    addToast({
                      title: 'Language Updated',
                      description: 'The user interface is now set to English.',
                      type: 'success',
                    });
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 ${
                    language === 'en'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-[#161b22] border-[#30363d] text-slate-300 hover:text-white'
                  }`}
                >
                  <span>🇬🇧</span>
                  <span>English (EN)</span>
                  {language === 'en' && <Check className="w-3.5 h-3.5 ml-1" />}
                </button>
              </div>
            </div>

            {/* 2. Color Theme Palette */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <Palette className="w-4 h-4 text-amber-400" />
                    <span>Personal Color Theme (11 Themes)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select your personal preferred color scheme. This only affects your account and does not change the global theme for other users.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await resetPersonalTheme();
                    addToast({
                      title: 'Standard wiederhergestellt',
                      description: `Folgt nun wieder dem globalen Panel-Theme (${globalColorTheme}).`,
                      type: 'info',
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-white bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] rounded-lg transition-all shrink-0 self-start sm:self-auto"
                >
                  Globales Theme nutzen ({globalColorTheme})
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                {COLOR_THEMES.map((theme) => {
                  const isSelected = colorTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setColorTheme(theme.id);
                        addToast({
                          title: 'Theme Applied',
                          description: `Switched palette to ${theme.name}.`,
                          type: 'info',
                        });
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-[var(--theme-ring)] ${
                        isSelected
                          ? 'bg-[#1c2128] border-[var(--theme-accent-border)] shadow-md ring-1 ring-[var(--theme-ring)]'
                          : 'bg-[#11141a] border-[#30363d] hover:bg-[#161b22] hover:border-[#484f58]'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/20 shadow-sm"
                        style={{ backgroundColor: theme.accent }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white">{theme.name}</h4>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0d1117] text-slate-400 border border-[#30363d]">
                            {theme.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                          {theme.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Background Motion Canvas */}
            <div className="space-y-3 pt-2 border-t border-[#30363d]/80">
              <div>
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-fuchsia-400" />
                  <span>Background Motion Canvas</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select the visual background atmosphere for the control panel.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {BACKGROUND_EFFECTS.map((bg) => {
                  const isSelected = backgroundEffect === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => {
                        setBackgroundEffect(bg.id);
                        addToast({
                          title: 'Background Updated',
                          description: `Background atmosphere switched to ${bg.name}.`,
                          type: 'info',
                        });
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'bg-[#1c2128] border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                          : 'bg-[#11141a] border-[#30363d] hover:bg-[#161b22] hover:border-[#484f58]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                            {isSelected && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
                            <span>{bg.name}</span>
                          </h4>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0d1117] text-slate-400 border border-[#30363d]">
                            {bg.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {bg.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Custom CSS Live Editor */}
            <div className="space-y-3 pt-2 border-t border-[#30363d]/80">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <span>Custom CSS Stylesheet</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Inject personal CSS rules into the panel. Saves automatically to your local storage.
                  </p>
                </div>
                {customCss && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active Stylesheet
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <textarea
                  value={tempCss}
                  onChange={(e) => setTempCss(e.target.value)}
                  placeholder={`/* Example custom styles */\n.btn-primary {\n  letter-spacing: 0.05em;\n}`}
                  rows={4}
                  className="w-full bg-[#090c12] border border-[#30363d] focus:border-indigo-500 rounded-xl p-3 text-xs text-emerald-300 font-mono placeholder-slate-600 focus:outline-none transition-colors"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">
                    {tempCss.length} characters
                  </span>

                  <div className="flex items-center gap-2">
                    {tempCss && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempCss('');
                          setCustomCss('');
                          addToast({
                            title: 'Custom CSS Cleared',
                            description: 'All custom CSS rules have been removed.',
                            type: 'info',
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-mono text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        Clear CSS
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCustomCss(tempCss);
                        addToast({
                          title: 'Custom CSS Applied',
                          description: 'Custom styling rules have been injected live.',
                          type: 'success',
                        });
                      }}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition-all shadow-md active:scale-95"
                    >
                      Save & Apply CSS
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>

    {/* Cyber-Glass Delete Confirm Modal for API Key Revocation */}
    <DeleteConfirmModal
      isOpen={!!deleteApiKeyTarget}
      onClose={() => setDeleteApiKeyTarget(null)}
      onConfirm={handleConfirmDeleteApiKey}
      title={language === 'de' ? 'API-Schlüssel widerrufen' : 'Revoke API Key'}
      itemName={deleteApiKeyTarget?.memo || `Key #${deleteApiKeyTarget?.id}`}
      description={
        language === 'de'
          ? `Möchtest du den API-Schlüssel "${deleteApiKeyTarget?.memo || deleteApiKeyTarget?.id}" wirklich dauerhaft widerrufen? Alle Anwendungen, die diesen Schlüssel verwenden, verlieren sofort ihren Zugriff.`
          : `Are you sure you want to permanently revoke API key "${deleteApiKeyTarget?.memo || deleteApiKeyTarget?.id}"? Any external services using this token will lose access immediately.`
      }
      isDeleting={isDeletingKeyId !== null}
    />
  </>
  );
};

export default UserSettingsModal;
