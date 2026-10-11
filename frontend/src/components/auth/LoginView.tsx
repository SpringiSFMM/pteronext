import React, { useState, useEffect } from 'react';
import {
  Server,
  Lock,
  User,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Globe,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';

export const LoginView: React.FC = () => {
  const { login, addToast } = useApp();
  const { language, setLanguage } = useTranslation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // 2FA state
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse OAuth parameters from URL on load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const discordTag = params.get('discord_tag');

    if (err) {
      if (err === 'discord_not_linked') {
        setErrorMessage(
          language === 'de'
            ? `Dieser Discord-Account (@${discordTag || 'Benutzer'}) ist noch mit keinem Panel-Konto verknüpft. Bitte melde dich zuerst an und verknüpfe deinen Account in den Einstellungen.`
            : `This Discord account (@${discordTag || 'user'}) is not yet linked to any panel account. Please sign in with username/password first and link your Discord account in settings.`
        );
      } else if (err === 'discord_disabled') {
        setErrorMessage(
          language === 'de'
            ? 'Discord-Login ist im Admin-Dashboard noch nicht aktiviert oder konfiguriert.'
            : 'Discord login is not yet configured or enabled in the admin dashboard.'
        );
      } else if (err === 'discord_cancelled') {
        setErrorMessage(
          language === 'de'
            ? 'Discord-Authentifizierung wurde abgebrochen.'
            : 'Discord authentication was cancelled.'
        );
      } else {
        setErrorMessage(
          language === 'de'
            ? `Discord-Fehler: ${err}`
            : `Discord authentication error: ${err}`
        );
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [language]);

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage(
        language === 'de'
          ? 'Bitte gib deinen Benutzernamen und dein Passwort ein.'
          : 'Please enter both your username and password.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await login(username.trim(), password);
      if (res.twoFactorRequired) {
        setIs2FARequired(true);
        setErrorMessage(null);
        addToast({
          title: language === 'de' ? '2FA erforderlich' : '2FA Required',
          description:
            language === 'de'
              ? 'Bitte gib deinen Zwei-Faktor-Authentifizierungscode ein.'
              : 'Please enter your two-factor authentication code.',
          type: 'info',
        });
      } else if (!res.success) {
        setErrorMessage(
          res.error ||
            (language === 'de'
              ? 'Ungültiger Benutzername oder falsches Passwort.'
              : 'Invalid username or password.')
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          (language === 'de'
            ? 'Anmeldeanfrage fehlgeschlagen. Bitte prüfe die Backend-Verbindung.'
            : 'Login request failed. Please check backend connection.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) {
      setErrorMessage(
        language === 'de'
          ? 'Bitte gib deinen 6-stelligen 2FA-Code oder Wiederherstellungsschlüssel ein.'
          : 'Please enter your 6-digit 2FA code or recovery key.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await login(username.trim(), password, totpCode.trim());
      if (!res.success) {
        setErrorMessage(
          res.error ||
            (language === 'de'
              ? 'Ungültiger 2FA-Code. Bitte prüfe die Uhrzeit deines Authentifikators.'
              : 'Invalid two-factor code. Please check your authenticator clock.')
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          (language === 'de' ? '2FA-Code konnte nicht verifiziert werden.' : 'Could not verify 2FA code.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setUsername('SpringiSFM');
    setPassword('admin123456');
    setErrorMessage(null);
  };

  const handleDiscordLogin = () => {
    setIsLoading(true);
    window.location.href = '/api/auth/discord/login';
  };

  return (
    <div className="min-h-screen w-full bg-[#07090e] text-slate-200 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-emerald-500/30">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-emerald-500/10 via-zinc-800/20 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1f293d_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Language Switcher Bar */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs font-mono">
        <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
        <button
          onClick={() => setLanguage('de')}
          className={`px-2 py-0.5 rounded-lg transition-colors ${
            language === 'de'
              ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          DE
        </button>
        <button
          onClick={() => setLanguage('en')}
          className={`px-2 py-0.5 rounded-lg transition-colors ${
            language === 'en'
              ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          EN
        </button>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#10141d]/90 backdrop-blur-2xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-inner mb-1 p-2">
            {is2FARequired ? (
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            ) : (
              <img src="/logo.png" alt="PteroNext Logo" className="w-10 h-10 object-contain" />
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PTERONEXT 2.0
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white font-mono">
            {is2FARequired
              ? (language === 'de' ? 'Zwei-Faktor-Authentifizierung' : 'Two-Factor Authentication')
              : (language === 'de' ? 'Control Panel Anmeldung' : 'Control Panel Login')}
          </h1>
          <p className="text-xs text-slate-400">
            {is2FARequired
              ? (language === 'de'
                  ? 'Gib den 6-stelligen TOTP-Code deiner Authenticator-App ein.'
                  : 'Enter the 6-digit TOTP code from your mobile authenticator app.')
              : (language === 'de'
                  ? 'Melde dich an, um Gameserver, Wings-Cluster und Dateien zu verwalten.'
                  : 'Sign in to manage your game servers, wings clusters, and files.')}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 font-mono animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {!is2FARequired ? (
          /* Step 1: Username & Password */
          <form onSubmit={handleSubmitCredentials} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-slate-300 font-medium">
                {language === 'de' ? 'Benutzername oder E-Mail' : 'Username or Email'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-[#090c12] border border-zinc-800 focus:border-emerald-500/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 font-mono focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-slate-300 font-medium">
                {language === 'de' ? 'Passwort' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#090c12] border border-zinc-800 focus:border-emerald-500/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 font-mono focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-[#090c12] border-zinc-700 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                />
                <span>{language === 'de' ? 'Sitzung merken' : 'Remember session'}</span>
              </label>

              <button
                type="button"
                onClick={handleFillDemo}
                className="text-[11px] font-mono text-emerald-400/80 hover:text-emerald-300 transition-colors flex items-center gap-1"
                title="Fill default root admin login for fast login"
              >
                <Sparkles className="w-3 h-3" />
                <span>{language === 'de' ? 'Admin ausfüllen' : 'Fill Default Admin'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-2.5 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 mt-2"
            >
              <span>{isLoading ? (language === 'de' ? 'Anmeldung...' : 'Signing in...') : (language === 'de' ? 'Im Panel anmelden' : 'Sign In to Panel')}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono">
                <span className="bg-[#11141a] px-2 text-slate-500">
                  {language === 'de' ? 'oder via OAuth' : 'or via OAuth'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDiscordLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{language === 'de' ? 'Mit Discord anmelden' : 'Sign in with Discord'}</span>
            </button>
          </form>
        ) : (
          /* Step 2: 2FA TOTP Code */
          <form onSubmit={handleSubmit2FA} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase text-slate-300 font-medium text-center">
                {useBackupCode
                  ? (language === 'de' ? '8-stelliger Wiederherstellungscode' : '8-Character Recovery Code')
                  : (language === 'de' ? '6-stelliger Authenticator-Code' : '6-Digit TOTP Authenticator Code')}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={useBackupCode ? 10 : 8}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\s+/g, ''))}
                  placeholder={useBackupCode ? 'a1b2c3d4' : '123456'}
                  className="w-full bg-[#090c12] border border-emerald-500/40 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-center text-lg tracking-widest text-emerald-400 font-mono placeholder-slate-700 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setTotpCode('');
                  setErrorMessage(null);
                }}
                className="text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
              >
                {useBackupCode
                  ? (language === 'de' ? '6-stelligen Authenticator-Code nutzen' : 'Use 6-digit Authenticator app')
                  : (language === 'de' ? 'Notfall-Backup-Code nutzen' : 'Use emergency backup code')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIs2FARequired(false);
                  setTotpCode('');
                  setErrorMessage(null);
                }}
                className="text-[11px] text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>{language === 'de' ? 'Zurück' : 'Back'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !totpCode.trim()}
              className="w-full btn btn-primary py-2.5 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <span>{isLoading ? (language === 'de' ? 'Verifiziere...' : 'Verifying...') : (language === 'de' ? 'Verifizieren & Weiter' : 'Verify & Continue')}</span>
              {!isLoading && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-zinc-800/60">
          <p className="text-[11px] text-slate-500 font-mono">
            Protected by PteroNext Secure Token Exchange &bull; TLS / AES-256
          </p>
        </div>
      </div>
    </div>
  );
};
