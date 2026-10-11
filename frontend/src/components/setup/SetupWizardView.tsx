import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  Shield,
  Server,
  HardDrive,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Globe,
  Lock,
  User,
  Database,
  Bot,
  Cloud,
  Check,
  AlertCircle,
  Key,
} from 'lucide-react';

interface SetupWizardProps {
  onComplete?: () => void;
}

export const SetupWizardView: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { addToast, setActiveView, refreshServers, refreshAdminData } = useApp();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Step 1: Database Host & Credentials
  const [dbType, setDbType] = useState<'sqlite' | 'postgres' | 'mariadb'>('sqlite');
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPort, setDbPort] = useState(3306);
  const [dbUser, setDbUser] = useState('pteronext');
  const [dbPassword, setDbPassword] = useState('');
  const [dbName, setDbName] = useState('pteronext');

  // Step 2: Discord Bot Integration
  const [discordBotToken, setDiscordBotToken] = useState('');
  const [discordClientId, setDiscordClientId] = useState('');
  const [discordGuildId, setDiscordGuildId] = useState('');

  // Step 3: Cloudflare DNS Automation
  const [cfApiToken, setCfApiToken] = useState('');
  const [cfZoneId, setCfZoneId] = useState('');
  const [cfBaseDomain, setCfBaseDomain] = useState('');

  // Step 4: Initial Root Admin Account (Springi_SFM)
  const [adminUsername, setAdminUsername] = useState('Springi_SFM');
  const [adminEmail, setAdminEmail] = useState('admin@springisfm.de');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [adminFirst, setAdminFirst] = useState('Springi');
  const [adminLast, setAdminLast] = useState('SFM');

  // Step 5: Node / General
  const [nodeName, setNodeName] = useState('Primary Node 01');
  const [nodeFqdn, setNodeFqdn] = useState('127.0.0.1');
  const [nodePort, setNodePort] = useState(8080);
  const [nodeSftp, setNodeSftp] = useState(2022);

  const steps = [
    { num: 1, label: 'Database', icon: Database, desc: 'SQLite / Postgres / MariaDB' },
    { num: 2, label: 'Discord Bot', icon: Bot, desc: 'OAuth & Verification' },
    { num: 3, label: 'Cloudflare', icon: Cloud, desc: 'DNS & SSL Automation' },
    { num: 4, label: 'Root Admin', icon: User, desc: 'Springi_SFM Account' },
    { num: 5, label: 'Finalize & Lock', icon: Lock, desc: 'Lockfile & Protection' },
  ];

  const handleNext = () => {
    if (currentStep === 4) {
      if (!adminUsername.trim() || !adminEmail.trim()) {
        addToast({
          title: 'Fehlende Angaben',
          description: 'Benutzername und E-Mail-Adresse sind erforderlich.',
          type: 'error',
        });
        return;
      }
      if (!adminPassword || adminPassword.length < 8) {
        addToast({
          title: 'Passwort zu kurz',
          description: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
          type: 'warning',
        });
        return;
      }
      if (adminPassword !== adminPasswordConfirm) {
        addToast({
          title: 'Passwort-Abweichung',
          description: 'Die beiden Passwörter stimmen nicht überein.',
          type: 'error',
        });
        return;
      }
    }

    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.system.completeSetup({
        db_type: dbType,
        db_host: dbHost.trim(),
        db_port: Number(dbPort),
        db_user: dbUser.trim(),
        db_password: dbPassword,
        db_name: dbName.trim(),

        discord_bot_token: discordBotToken.trim(),
        discord_client_id: discordClientId.trim(),
        discord_guild_id: discordGuildId.trim(),

        cloudflare_api_token: cfApiToken.trim(),
        cloudflare_zone_id: cfZoneId.trim(),
        cloudflare_base_domain: cfBaseDomain.trim(),

        admin_username: adminUsername.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        admin_first: adminFirst.trim(),
        admin_last: adminLast.trim(),

        node_name: nodeName.trim(),
        node_fqdn: nodeFqdn.trim(),
        node_port: Number(nodePort),
        node_sftp: Number(nodeSftp),
      });

      if (res?.token) {
        api.auth.setToken(res.token);
      }

      setIsFinished(true);
      addToast({
        title: '🎉 Setup abgeschlossen!',
        description: 'PteroNext konfiguriert & .setup_locked Datei erfolgreich gesetzt.',
        type: 'success',
      });

      await refreshAdminData();
      await refreshServers();

      setTimeout(() => {
        if (onComplete) onComplete();
        else setActiveView('dashboard');
      }, 2000);
    } catch (err: any) {
      addToast({
        title: 'Setup fehlgeschlagen',
        description: err?.message || 'Fehler beim Abschließen der Konfiguration.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-6 px-4">
      <div className="w-full max-w-3xl bg-[#11141a] rounded-3xl border border-[#30363d] shadow-2xl p-6 sm:p-10 space-y-8 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-indigo-300 text-xs font-mono font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PteroNext First-Run Initialisierung</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            System & Cluster Setup Wizard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            Führe die Ersteinrichtung von Datenbank, Discord, Cloudflare und dem Root-Admin-Konto durch.
          </p>
        </div>

        {/* Step Progress Tracker */}
        <div className="grid grid-cols-5 gap-2 border-b border-[#30363d]/80 pb-6">
          {steps.map((s) => {
            const Icon = s.icon;
            const isDone = currentStep > s.num || isFinished;
            const isCurrent = currentStep === s.num && !isFinished;
            return (
              <div key={s.num} className="flex flex-col items-center text-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                      : isCurrent
                      ? 'bg-indigo-600 border border-indigo-500 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/30'
                      : 'bg-[#161b22] border border-[#30363d] text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <div className="hidden sm:block">
                  <span className={`text-xs font-bold block ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 truncate block">{s.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step Forms */}
        <div className="space-y-6">
          {/* STEP 1: Database Host & Credentials */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                <Database className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Schritt 1: Datenbank-Verbindung</h3>
                  <p className="text-xs text-slate-400">Wähle deinen Datenbank-Treiber und hinterlege die Zugangsdaten.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(['sqlite', 'postgres', 'mariadb'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDbType(type)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      dbType === type
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                        : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <span className="uppercase text-xs font-mono">{type}</span>
                  </button>
                ))}
              </div>

              {dbType === 'sqlite' ? (
                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] text-xs font-mono text-slate-300 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Integrierte SQLite Engine (WAL-Modus) aktiv</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Kein externer Datenbankserver notwendig. Die Datei <code>pteronext.db</code> wird automatisch mit Zero-Config verwaltet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Host</label>
                    <input
                      type="text"
                      value={dbHost}
                      onChange={(e) => setDbHost(e.target.value)}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Port</label>
                    <input
                      type="number"
                      value={dbPort}
                      onChange={(e) => setDbPort(Number(e.target.value))}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Benutzer</label>
                    <input
                      type="text"
                      value={dbUser}
                      onChange={(e) => setDbUser(e.target.value)}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Passwort</label>
                    <input
                      type="password"
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Discord Bot Integration */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                <Bot className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Schritt 2: Discord Bot & Verifikation</h3>
                  <p className="text-xs text-slate-400">Optional: Ermöglicht Login via Discord & automatische DM-Codes.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Discord Bot Token</label>
                <input
                  type="password"
                  placeholder="MTAy..."
                  value={discordBotToken}
                  onChange={(e) => setDiscordBotToken(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Application / Client ID</label>
                  <input
                    type="text"
                    placeholder="1234567890..."
                    value={discordClientId}
                    onChange={(e) => setDiscordClientId(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Verification Server (Guild ID)</label>
                  <input
                    type="text"
                    placeholder="9876543210..."
                    value={discordGuildId}
                    onChange={(e) => setDiscordGuildId(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Cloudflare API Token & Zone ID */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                <Cloud className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Schritt 3: Cloudflare DNS Automation</h3>
                  <p className="text-xs text-slate-400">Automatische Erstellung von Subdomains (z.B. srv1.meinedomain.de) für Minecraft-Server.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Cloudflare API Token</label>
                <input
                  type="password"
                  placeholder="CLOUDFLARE_API_TOKEN..."
                  value={cfApiToken}
                  onChange={(e) => setCfApiToken(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Zone ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 023e105f4ecef8ad9ca31a8372d0c353"
                    value={cfZoneId}
                    onChange={(e) => setCfZoneId(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Basis-Domain</label>
                  <input
                    type="text"
                    placeholder="springisfm.de"
                    value={cfBaseDomain}
                    onChange={(e) => setCfBaseDomain(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Initial Root Admin Account (Springi_SFM) */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                <Shield className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Schritt 4: Initialer Root-Admin Account</h3>
                  <p className="text-xs text-slate-400">Lege deinen Hauptzugang mit uneingeschränkten Superadmin-Rechten an.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Benutzername</label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Passwort</label>
                  <input
                    type="password"
                    placeholder="Mindestens 8 Zeichen"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Passwort wiederholen</label>
                  <input
                    type="password"
                    value={adminPasswordConfirm}
                    onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Finalize & Lock */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                <Lock className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Schritt 5: Lockfile & Abschluss</h3>
                  <p className="text-xs text-slate-400">Prüfung der Konfiguration vor der endgültigen Sperrung des Setups.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Root-Admin:</span>
                  <span className="text-white font-bold">{adminUsername} ({adminEmail})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Datenbank:</span>
                  <span className="text-white uppercase font-bold">{dbType}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Discord Bot:</span>
                  <span className={discordBotToken ? 'text-emerald-400' : 'text-slate-500'}>
                    {discordBotToken ? 'Konfiguriert' : 'Deaktiviert'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Cloudflare DNS:</span>
                  <span className={cfApiToken ? 'text-emerald-400' : 'text-slate-500'}>
                    {cfApiToken ? 'Konfiguriert' : 'Deaktiviert'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Sicherheits-Lockfile:</span>
                  <span className="text-amber-400 font-bold">.setup_locked (dauerhafte Sperre)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Nach Bestätigung wird <code>/setup</code> dauerhaft gesperrt und kann nicht erneut aufgerufen werden.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#30363d]/80 pt-6">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 1 || isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Zurück</span>
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
            >
              <span>Weiter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting || isFinished}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Initialisiere Cluster...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Setup abschließen & sperren</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
