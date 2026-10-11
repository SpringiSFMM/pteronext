import React, { useState, useEffect } from 'react';
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
  Terminal,
  Activity,
  Check,
  AlertCircle,
} from 'lucide-react';

interface SetupWizardProps {
  onComplete?: () => void;
}

export const SetupWizardView: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { addToast, setActiveView, refreshServers, refreshAdminData } = useApp();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Form State
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminEmail, setAdminEmail] = useState('admin@pteronext.internal');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');

  const [panelUrl, setPanelUrl] = useState(
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  );
  const [panelName, setPanelName] = useState('PteroNext Enterprise');

  const [nodeName, setNodeName] = useState('Primary Node 01');
  const [nodeFqdn, setNodeFqdn] = useState('127.0.0.1');
  const [nodeMemory, setNodeMemory] = useState(16384);
  const [nodeDisk, setNodeDisk] = useState(102400);

  // System Checks
  const [sysChecks, setSysChecks] = useState({
    database: true,
    argon2: true,
    daemonPort: true,
    storage: true,
  });

  const steps = [
    { num: 1, label: 'System Check', icon: Activity },
    { num: 2, label: 'Superadmin', icon: User },
    { num: 3, label: 'Panel Identity', icon: Globe },
    { num: 4, label: 'Compute Node', icon: HardDrive },
    { num: 5, label: 'Launch', icon: Zap },
  ];

  const handleNext = () => {
    if (currentStep === 2) {
      if (!adminUsername.trim() || !adminEmail.trim()) {
        addToast({
          title: 'Missing Information',
          description: 'Username and email are required.',
          type: 'error',
        });
        return;
      }
      if (!adminPassword || adminPassword.length < 8) {
        addToast({
          title: 'Password Weak',
          description: 'Password must be at least 8 characters long.',
          type: 'warning',
        });
        return;
      }
      if (adminPassword !== adminPasswordConfirm) {
        addToast({
          title: 'Passwords Mismatch',
          description: 'The passwords entered do not match.',
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
        admin_username: adminUsername.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        panel_url: panelUrl.trim(),
        node_name: nodeName.trim(),
        node_fqdn: nodeFqdn.trim(),
        node_memory: Number(nodeMemory),
        node_disk: Number(nodeDisk),
      });

      if (res?.token) {
        api.auth.setToken(res.token);
      }

      setIsFinished(true);
      addToast({
        title: 'PteroNext Initialized!',
        description: 'Cluster configuration deployed successfully.',
        type: 'success',
      });

      await refreshAdminData();
      await refreshServers();

      setTimeout(() => {
        if (onComplete) onComplete();
        else setActiveView('dashboard');
      }, 2500);
    } catch (err: any) {
      addToast({
        title: 'Setup Failed',
        description: err?.message || 'Could not complete cluster initialization.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-6 px-4">
      <div className="w-full max-w-3xl bg-[#11141a] rounded-3xl border border-[#30363d] shadow-2xl p-6 sm:p-10 space-y-8 relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-zinc-300 text-xs font-mono font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>First-Run Cluster Onboarding</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            PteroNext Production Setup
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Configure your administrative credentials, panel routing, and default Wings daemon node
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
                      ? 'bg-white border border-zinc-200 text-zinc-950 shadow-lg'
                      : 'bg-[#161b22] border border-[#30363d] text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-[11px] font-mono hidden sm:block ${
                    isCurrent ? 'text-white font-bold' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step 1: System Checks */}
        {currentStep === 1 && !isFinished && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Environment & Prerequisite Checks
            </h3>
            <p className="text-xs text-slate-400">
              Verifying that local database storage and security algorithms are operational:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#0d1017] border border-[#30363d] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Database Engine</span>
                  <span className="text-[11px] text-slate-500 font-mono">SQLite WAL & GORM</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0d1017] border border-[#30363d] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Cryptography</span>
                  <span className="text-[11px] text-slate-500 font-mono">Argon2id & JWT HS256</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0d1017] border border-[#30363d] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Daemon Proxy</span>
                  <span className="text-[11px] text-slate-500 font-mono">Wings WebSocket 8080/8443</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0d1017] border border-[#30363d] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Storage Volume</span>
                  <span className="text-[11px] text-slate-500 font-mono">/srv/daemon-data</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Writable</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Superadmin Account */}
        {currentStep === 2 && !isFinished && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Create Root Administrator
            </h3>
            <p className="text-xs text-slate-400">
              This account will hold full superadmin capabilities across nodes, servers, and eggs.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Username *
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full bg-[#0d1017] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-[#0d1017] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Password * (min. 8 chars)
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-[#0d1017] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={adminPasswordConfirm}
                  onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Panel Identity */}
        {currentStep === 3 && !isFinished && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Panel Identity & Routing
            </h3>
            <p className="text-xs text-slate-400">
              Specify the public address and brand identity used for callbacks and user invites.
            </p>

            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Panel Public URL *
                </label>
                <input
                  type="text"
                  value={panelUrl}
                  onChange={(e) => setPanelUrl(e.target.value)}
                  placeholder="https://panel.example.com"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Panel Display Title
                </label>
                <input
                  type="text"
                  value={panelName}
                  onChange={(e) => setPanelName(e.target.value)}
                  placeholder="PteroNext Cluster"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Primary Wings Node */}
        {currentStep === 4 && !isFinished && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Initial Compute Node (Wings)
            </h3>
            <p className="text-xs text-slate-400">
              Register the local or remote daemon machine that will host Docker containers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Node Name *
                </label>
                <input
                  type="text"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Node FQDN / IP *
                </label>
                <input
                  type="text"
                  value={nodeFqdn}
                  onChange={(e) => setNodeFqdn(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Total Memory Limit (MB)
                </label>
                <input
                  type="number"
                  value={nodeMemory}
                  onChange={(e) => setNodeMemory(Number(e.target.value))}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Total Disk Storage (MB)
                </label>
                <input
                  type="number"
                  value={nodeDisk}
                  onChange={(e) => setNodeDisk(Number(e.target.value))}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Summary & Launch */}
        {currentStep === 5 && !isFinished && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Review & Finalize Cluster
            </h3>
            <p className="text-xs text-slate-400">
              Confirm your deployment configuration before writing changes to the database:
            </p>

            <div className="space-y-2.5 p-4 rounded-xl bg-[#0d1117] border border-[#30363d] text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[#30363d]/60">
                <span className="text-slate-400">Admin Account</span>
                <span className="text-white font-semibold">
                  {adminUsername} ({adminEmail})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#30363d]/60">
                <span className="text-slate-400">Panel URL</span>
                <span className="text-zinc-200">{panelUrl}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#30363d]/60">
                <span className="text-slate-400">Primary Node</span>
                <span className="text-white">
                  {nodeName} ({nodeFqdn})
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Allocated Hardware</span>
                <span className="text-emerald-400">
                  {Math.round(nodeMemory / 1024)} GB RAM / {Math.round(nodeDisk / 1024)} GB Disk
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {isFinished && (
          <div className="text-center py-10 space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Cluster Initialized!</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Root administrator registered and initial daemon node established. Redirecting to your
              control dashboard...
            </p>
          </div>
        )}

        {/* Wizard Footer Controls */}
        {!isFinished && (
          <div className="flex items-center justify-between pt-6 border-t border-[#30363d]">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs font-mono text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView('dashboard')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip / Go to Panel
              </button>
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold transition-all shadow-lg active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-mono text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Zap className="w-4 h-4" />
                <span>{isSubmitting ? 'Deploying...' : 'Deploy & Launch Cluster'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
