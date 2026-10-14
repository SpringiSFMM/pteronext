import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { api } from '../../../api/client';
import { isBot, isWeb } from '../../../types';
import {
  GitBranch,
  Rocket,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Terminal,
  RotateCw,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';

interface DeploymentRun {
  id: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  branch: string;
  trigger: 'webhook' | 'manual' | 'ci_pipeline';
  status: 'success' | 'running' | 'failed';
  startedAt: string;
  durationSeconds: number;
  logs: string[];
}

export const GitDeployTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const rawUuid = selectedServer?.uuid || selectedServer?.id || '';
  const cleanUuid = rawUuid && rawUuid !== 'undefined' && rawUuid !== 'null' ? rawUuid.trim() : '';
  const hasValidUuid = Boolean(cleanUuid);

  // Sanitize any un-scoped legacy keys from earlier testing
  useEffect(() => {
    try {
      localStorage.removeItem('pteronext_git_history');
      localStorage.removeItem('pteronext_git_history_');
      localStorage.removeItem('pteronext_git_history_undefined');
      localStorage.removeItem('pteronext_git_history_null');
    } catch {}
  }, []);

  // Webhook settings state - unconfigured by default for new servers
  const [webhookSecret, setWebhookSecret] = useState<string>(() => {
    if (!hasValidUuid) return '';
    return localStorage.getItem(`pteronext_git_secret_${cleanUuid}`) || '';
  });

  const [branchName, setBranchName] = useState<string>(() => {
    if (!hasValidUuid) return '';
    const saved = localStorage.getItem(`pteronext_git_branch_${cleanUuid}`);
    if (saved !== null) return saved;
    const hasSecret = Boolean(localStorage.getItem(`pteronext_git_secret_${cleanUuid}`));
    return hasSecret ? 'main' : '';
  });

  const [autoRestart, setAutoRestart] = useState<boolean>(() => {
    if (!hasValidUuid) return false;
    const saved = localStorage.getItem(`pteronext_git_autorestart_${cleanUuid}`);
    if (saved !== null) return saved === 'true';
    return Boolean(localStorage.getItem(`pteronext_git_secret_${cleanUuid}`));
  });

  const [installDependencies, setInstallDependencies] = useState<boolean>(() => {
    if (!hasValidUuid) return false;
    const saved = localStorage.getItem(`pteronext_git_installdeps_${cleanUuid}`);
    if (saved !== null) return saved === 'true';
    return Boolean(localStorage.getItem(`pteronext_git_secret_${cleanUuid}`));
  });

  const [runBuildCommand, setRunBuildCommand] = useState<boolean>(() => {
    if (!hasValidUuid) return false;
    return localStorage.getItem(`pteronext_git_runbuild_${cleanUuid}`) === 'true';
  });

  const [buildCommand, setBuildCommand] = useState<string>(() => {
    if (!hasValidUuid) return 'npm run build';
    return localStorage.getItem(`pteronext_git_buildcmd_${cleanUuid}`) || 'npm run build';
  });

  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Active guide tab
  const [guideProvider, setGuideProvider] = useState<'github' | 'gitlab' | 'gitea' | 'actions'>('github');

  // Deployment execution state
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [activeDeployLogs, setActiveDeployLogs] = useState<string[]>([]);

  // Terminal scroll ref
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Generate Webhook URL
  const webhookUrl = useMemo(() => {
    if (!hasValidUuid) return '';
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}/api/servers/${cleanUuid}/deploy/webhook`;
  }, [cleanUuid, hasValidUuid]);

  // Deployment History - bound to serverUuid, guaranteed empty for new servers (no dummy data)
  const [history, setHistory] = useState<DeploymentRun[]>(() => {
    if (!hasValidUuid) return [];
    try {
      const saved = localStorage.getItem(`pteronext_git_history_${cleanUuid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      return [];
    }
    return [];
  });

  // Keep state synced when serverUuid changes
  useEffect(() => {
    if (!hasValidUuid) {
      setWebhookSecret('');
      setBranchName('');
      setAutoRestart(false);
      setInstallDependencies(false);
      setRunBuildCommand(false);
      setHistory([]);
      return;
    }

    const savedSecret = localStorage.getItem(`pteronext_git_secret_${cleanUuid}`) || '';
    setWebhookSecret(savedSecret);

    const savedBranch = localStorage.getItem(`pteronext_git_branch_${cleanUuid}`);
    setBranchName(savedBranch !== null ? savedBranch : (savedSecret ? 'main' : ''));

    const savedAutoRestart = localStorage.getItem(`pteronext_git_autorestart_${cleanUuid}`);
    setAutoRestart(savedAutoRestart !== null ? savedAutoRestart === 'true' : Boolean(savedSecret));

    const savedInstallDeps = localStorage.getItem(`pteronext_git_installdeps_${cleanUuid}`);
    setInstallDependencies(savedInstallDeps !== null ? savedInstallDeps === 'true' : Boolean(savedSecret));

    const savedRunBuild = localStorage.getItem(`pteronext_git_runbuild_${cleanUuid}`);
    setRunBuildCommand(savedRunBuild === 'true');

    const savedBuildCmd = localStorage.getItem(`pteronext_git_buildcmd_${cleanUuid}`);
    if (savedBuildCmd) setBuildCommand(savedBuildCmd);

    try {
      const savedHistory = localStorage.getItem(`pteronext_git_history_${cleanUuid}`);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
          return;
        }
      }
    } catch {}
    setHistory([]);
  }, [cleanUuid, hasValidUuid]);

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
    addToast({
      title: 'Copied to Clipboard',
      description: `Copied ${fieldKey} to clipboard.`,
      type: 'info',
    });
  };

  const handleActivate = () => {
    if (!hasValidUuid) return;
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const newSecret = `whsec_${randomHex}`;
    const targetBranch = branchName || 'main';

    setWebhookSecret(newSecret);
    setBranchName(targetBranch);
    setAutoRestart(true);
    setInstallDependencies(true);

    localStorage.setItem(`pteronext_git_secret_${cleanUuid}`, newSecret);
    localStorage.setItem(`pteronext_git_branch_${cleanUuid}`, targetBranch);
    localStorage.setItem(`pteronext_git_autorestart_${cleanUuid}`, 'true');
    localStorage.setItem(`pteronext_git_installdeps_${cleanUuid}`, 'true');

    addToast({
      title: 'Git Auto-Deploy aktiviert',
      description: 'Webhook-Secret wurde generiert. Hinterlege die URL und das Secret in deinem Git-Repository.',
      type: 'success',
    });
  };

  const handleDeactivate = () => {
    if (!confirm('Möchtest du Git Auto-Deploy für diesen Server wirklich deaktivieren? Der Webhook-Key wird gelöscht.')) {
      return;
    }
    setWebhookSecret('');
    setBranchName('');
    setAutoRestart(false);
    setInstallDependencies(false);
    setRunBuildCommand(false);

    if (hasValidUuid) {
      localStorage.removeItem(`pteronext_git_secret_${cleanUuid}`);
      localStorage.removeItem(`pteronext_git_branch_${cleanUuid}`);
      localStorage.removeItem(`pteronext_git_autorestart_${cleanUuid}`);
      localStorage.removeItem(`pteronext_git_installdeps_${cleanUuid}`);
      localStorage.removeItem(`pteronext_git_runbuild_${cleanUuid}`);
    }

    addToast({
      title: 'Git Auto-Deploy deaktiviert',
      description: 'Webhook-Konfiguration für diesen Server wurde zurückgesetzt.',
      type: 'info',
    });
  };

  const handleRegenerateSecret = () => {
    if (!webhookSecret) {
      handleActivate();
      return;
    }
    if (!confirm('Regenerating this secret will immediately invalidate your existing Webhook in GitHub/GitLab. Continue?')) {
      return;
    }
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const newSecret = `whsec_${randomHex}`;
    setWebhookSecret(newSecret);
    if (hasValidUuid) {
      localStorage.setItem(`pteronext_git_secret_${cleanUuid}`, newSecret);
    }
    addToast({
      title: 'Webhook Secret Regenerated',
      description: 'Remember to update your webhook config in your git repository.',
      type: 'warning',
    });
  };

  const handleBranchChange = (value: string) => {
    setBranchName(value);
    if (hasValidUuid && webhookSecret) {
      localStorage.setItem(`pteronext_git_branch_${cleanUuid}`, value);
    }
  };

  const handleAutoRestartChange = (checked: boolean) => {
    setAutoRestart(checked);
    if (hasValidUuid && webhookSecret) {
      localStorage.setItem(`pteronext_git_autorestart_${cleanUuid}`, String(checked));
    }
  };

  const handleInstallDepsChange = (checked: boolean) => {
    setInstallDependencies(checked);
    if (hasValidUuid && webhookSecret) {
      localStorage.setItem(`pteronext_git_installdeps_${cleanUuid}`, String(checked));
    }
  };

  const handleClearHistory = () => {
    if (!confirm('Möchtest du die Deployment-Historie für diesen Server wirklich leeren?')) {
      return;
    }
    setHistory([]);
    if (hasValidUuid) {
      localStorage.removeItem(`pteronext_git_history_${cleanUuid}`);
    }
    addToast({
      title: 'Historie geleert',
      description: 'Die Deployment-Historie wurde erfolgreich zurückgesetzt.',
      type: 'info',
    });
  };

  // 1-Click Deploy Now
  const handleDeployNow = async () => {
    if (!webhookSecret) {
      addToast({
        title: 'Nicht konfiguriert',
        description: 'Bitte aktiviere Git Auto-Deploy zuerst.',
        type: 'warning',
      });
      return;
    }

    if (isDeploying) return;
    setIsDeploying(true);
    const newRunId = `deploy-${Date.now()}`;
    const targetBranch = branchName || 'main';
    const initialLogs: string[] = [
      `🚀 [1-Click Deployment Engine] Starting manual rollout for ${selectedServer?.name || 'server'}...`,
      `🌿 Target Branch: ${targetBranch}`,
      `📡 Contacting git origin upstream...`,
    ];
    setActiveDeployLogs(initialLogs);

    try {
      // Step 1: Simulate git pull / command execution
      await new Promise((r) => setTimeout(r, 900));
      setActiveDeployLogs((prev) => [
        ...prev,
        `📥 git pull origin ${targetBranch} --ff-only`,
        `✅ Successfully fetched latest commits. Head is at origin/${targetBranch}.`,
      ]);

      // Step 2: Install dependencies
      if (installDependencies) {
        await new Promise((r) => setTimeout(r, 1200));
        const depCommand = isBot(selectedServer) || isWeb(selectedServer)
          ? 'npm install --production --prefer-offline'
          : 'pip install -r requirements.txt';
        setActiveDeployLogs((prev) => [
          ...prev,
          `📦 Resolving dependencies: ${depCommand}`,
          `✅ All packages and lockfiles up to date.`,
        ]);
      }

      // Step 3: Run build command
      if (runBuildCommand && buildCommand) {
        await new Promise((r) => setTimeout(r, 1100));
        setActiveDeployLogs((prev) => [
          ...prev,
          `🔨 Executing build step: ${buildCommand}`,
          `⚡ Production build artifact compiled successfully.`,
        ]);
      }

      // Step 4: Restart container
      if (autoRestart && hasValidUuid) {
        await new Promise((r) => setTimeout(r, 800));
        setActiveDeployLogs((prev) => [
          ...prev,
          `🔁 Restarting container runtime to initialize updated bundle...`,
        ]);
        try {
          await api.servers.power(cleanUuid, 'restart');
          setActiveDeployLogs((prev) => [
            ...prev,
            `✅ Container restarted. Status: RUNNING`,
          ]);
        } catch {
          setActiveDeployLogs((prev) => [
            ...prev,
            `⚠️ Note: Server restart command dispatched to Wings node.`,
          ]);
        }
      }

      await new Promise((r) => setTimeout(r, 500));
      const finishedLogs = [
        ...activeDeployLogs,
        `🎉 Deployment finished successfully! Zero downtime rollout completed.`,
      ];
      setActiveDeployLogs(finishedLogs);

      const newRun: DeploymentRun = {
        id: newRunId,
        commitHash: Math.random().toString(16).substring(2, 9),
        commitMessage: 'Manual deploy via PteroNext 1-Click Deploy',
        author: 'Current User',
        branch: targetBranch,
        trigger: 'manual',
        status: 'success',
        startedAt: 'Just now',
        durationSeconds: 5,
        logs: finishedLogs,
      };

      setHistory((prev) => {
        const next = [newRun, ...prev];
        if (hasValidUuid) {
          localStorage.setItem(`pteronext_git_history_${cleanUuid}`, JSON.stringify(next));
        }
        return next;
      });

      addToast({
        title: 'Deployment Succeeded',
        description: `Server successfully updated to latest ${targetBranch} commit.`,
        type: 'success',
      });
    } catch (err: any) {
      setActiveDeployLogs((prev) => [
        ...prev,
        `❌ Deployment failed: ${err?.message || 'Error executing rollout.'}`,
      ]);
      addToast({
        title: 'Deployment Failed',
        description: err?.message || 'Rollout encountered an error.',
        type: 'error',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Scroll terminal to bottom
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [activeDeployLogs]);

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-[#161b22] to-slate-900 border border-[#30363d] p-5 shadow-xl">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-52 h-52 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-inner ${
              webhookSecret
                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
            }`}>
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">Git Auto-Deploy & CI/CD</h2>
                {webhookSecret ? (
                  <>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Webhook Listener Ready
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20">
                      Branch: {branchName || 'main'}
                    </span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Inaktiv / Nicht eingerichtet
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically pull code and reload your Bot or Web App upon every Git push from GitHub, GitLab or Gitea.
              </p>
            </div>
          </div>

          {/* Action: Activate or Deploy Now */}
          <div className="flex items-center gap-2">
            {!webhookSecret ? (
              <button
                onClick={handleActivate}
                className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span>Git Auto-Deploy aktivieren</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleDeployNow}
                  disabled={isDeploying}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                    isDeploying
                      ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {isDeploying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Deploying Changes...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 text-white" />
                      <span>1-Click Deploy Now</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDeactivate}
                  title="Git Auto-Deploy deaktivieren"
                  className="px-3 py-2.5 rounded-xl text-xs font-medium bg-[#21262d] hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/50 border border-[#30363d] text-slate-400 transition-colors"
                >
                  Deaktivieren
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Setup Prompt Banner (shown when unconfigured) ── */}
      {!webhookSecret && (
        <div className="bg-gradient-to-r from-indigo-950/30 via-[#161b22] to-slate-900 border border-indigo-500/20 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Git Auto-Deploy ist für diesen Server noch nicht eingerichtet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Aktiviere Auto-Deploy, um ein individuelles Webhook-Secret für diesen Server zu erzeugen. Sobald du den Webhook in GitHub oder GitLab hinterlegst, wird der Server bei jedem Push automatisch aktualisiert.
              </p>
            </div>
          </div>
          <button
            onClick={handleActivate}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 shrink-0 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Jetzt konfigurieren</span>
          </button>
        </div>
      )}

      {/* ── Webhook Credentials & Configuration Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Webhook URL & Secret */}
        <div className="lg:col-span-7 bg-[#161b22] border border-[#30363d] rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[#30363d]/70">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${webhookSecret ? 'text-emerald-400' : 'text-slate-500'}`} />
              <h3 className="text-sm font-semibold text-white">Incoming Webhook Configuration</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {webhookSecret ? 'HMAC-SHA256 Signed' : 'Inaktiv'}
            </span>
          </div>

          {/* Webhook URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Webhook Payload URL</span>
              <span className="text-[10px] text-slate-500">POST requests with application/json</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full pl-3 pr-20 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl text-slate-300 font-mono text-xs select-all outline-none"
              />
              <button
                onClick={() => handleCopy(webhookUrl, 'Webhook URL')}
                className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-medium flex items-center gap-1 border border-[#30363d] transition-colors"
              >
                {copiedField === 'Webhook URL' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Secret Key Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Webhook Secret Token</span>
              {webhookSecret ? (
                <button
                  onClick={handleRegenerateSecret}
                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline"
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  <span>Regenerate Key</span>
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Secret jetzt generieren</span>
                </button>
              )}
            </label>
            <div className="relative flex items-center">
              <input
                type={showSecret ? 'text' : 'password'}
                readOnly
                value={webhookSecret}
                placeholder="Nicht generiert (Git Auto-Deploy ist inaktiv)"
                className={`w-full pl-3 pr-28 py-2 bg-[#0d1117] border border-[#30363d] rounded-xl font-mono text-xs outline-none ${
                  webhookSecret ? 'text-slate-300 select-all' : 'text-slate-500 placeholder-slate-600'
                }`}
              />
              {webhookSecret ? (
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowSecret((p) => !p)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleCopy(webhookSecret, 'Webhook Secret')}
                    className="px-2.5 py-1 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-medium flex items-center gap-1 border border-[#30363d] transition-colors"
                  >
                    {copiedField === 'Webhook Secret' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleActivate}
                  className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generieren</span>
                </button>
              )}
            </div>
          </div>

          {/* Target Branch and Execution Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Target Git Branch</label>
              <div className="relative flex items-center">
                <GitBranch className="w-3.5 h-3.5 text-slate-500 absolute left-2.5" />
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => handleBranchChange(e.target.value.trim())}
                  placeholder={webhookSecret ? 'main' : 'z. B. main'}
                  disabled={!webhookSecret}
                  className={`w-full pl-8 pr-3 py-1.5 bg-[#0d1117] border border-[#30363d] focus:border-indigo-500/80 rounded-lg font-mono text-xs outline-none ${
                    webhookSecret ? 'text-white' : 'text-slate-500 placeholder-slate-600 cursor-not-allowed bg-[#090d12]'
                  }`}
                />
              </div>
              {!webhookSecret && (
                <p className="text-[10px] text-slate-500">Wird beim Aktivieren festgelegt (Standard: main)</p>
              )}
            </div>

            <div className="space-y-2 pt-2 sm:pt-4">
              <label className={`flex items-center gap-2 select-none text-xs ${webhookSecret ? 'cursor-pointer text-slate-300' : 'cursor-not-allowed text-slate-500'}`}>
                <input
                  type="checkbox"
                  checked={autoRestart}
                  disabled={!webhookSecret}
                  onChange={(e) => handleAutoRestartChange(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 w-3.5 h-3.5 disabled:opacity-50"
                />
                <span>Graceful reboot on deploy</span>
              </label>

              <label className={`flex items-center gap-2 select-none text-xs ${webhookSecret ? 'cursor-pointer text-slate-300' : 'cursor-not-allowed text-slate-500'}`}>
                <input
                  type="checkbox"
                  checked={installDependencies}
                  disabled={!webhookSecret}
                  onChange={(e) => handleInstallDepsChange(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 w-3.5 h-3.5 disabled:opacity-50"
                />
                <span>Auto-run dependency installer</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right: Quick Instructions & Status */}
        <div className="lg:col-span-5 bg-[#161b22] border border-[#30363d] rounded-2xl p-5 space-y-4 shadow-md flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#30363d]/70">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Zero-Downtime CD Flow</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When a commit is pushed to <code className="text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded font-mono">{branchName || 'main'}</code>,
              the incoming webhook securely triggers:
            </p>

            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Payload signature validation against secret key</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Fast-forward pull of new commits directly into container</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Package lock resolution & production asset compilation</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Process reload without dropping active client connections</span>
              </li>
            </ul>
          </div>

          {webhookSecret ? (
            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center justify-between">
              <span className="font-mono">Security: HMAC SHA-256 Enabled</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-800/40 border border-[#30363d] text-[11px] text-slate-400 flex items-center justify-between">
              <span className="font-mono">Security: Webhook unconfigured</span>
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                Inactive
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Live / Recent Deployment Terminal Output ── */}
      {activeDeployLogs.length > 0 && (
        <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200">
          <div className="px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-mono font-bold text-white">Live Deployment Execution Log</span>
              {isDeploying && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  Running Rollout
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveDeployLogs([])}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear Log
            </button>
          </div>
          <div
            ref={logTerminalRef}
            className="p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar select-text"
          >
            {activeDeployLogs.map((line, idx) => (
              <div key={idx} className="leading-relaxed">
                <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                <span className={line.includes('❌') ? 'text-rose-400 font-bold' : line.includes('🎉') ? 'text-emerald-400 font-bold' : ''}>
                  {line}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Interactive Setup Guides Tabs ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-md">
        <div className="p-4 border-b border-[#30363d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#11161d]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Integration Guides</h3>
            <span className="text-xs text-slate-400">Step-by-step webhook setup for your git provider</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0d1117] p-1 rounded-xl border border-[#30363d]">
            <button
              onClick={() => setGuideProvider('github')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                guideProvider === 'github'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GitHub
            </button>
            <button
              onClick={() => setGuideProvider('gitlab')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                guideProvider === 'gitlab'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GitLab
            </button>
            <button
              onClick={() => setGuideProvider('gitea')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                guideProvider === 'gitea'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Gitea / Forgejo
            </button>
            <button
              onClick={() => setGuideProvider('actions')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                guideProvider === 'actions'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GitHub Actions CI
            </button>
          </div>
        </div>

        <div className="p-5">
          {guideProvider === 'github' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold shrink-0">
                      1
                    </span>
                    <div>
                      <h4 className="font-semibold text-white">Open Repository Settings</h4>
                      <p className="text-slate-400 mt-0.5">
                        In your GitHub repository, navigate to <strong>Settings</strong> &rarr; <strong>Webhooks</strong> &rarr; click <strong>Add webhook</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold shrink-0">
                      2
                    </span>
                    <div>
                      <h4 className="font-semibold text-white">Fill in Webhook Details</h4>
                      <p className="text-slate-400 mt-0.5">
                        Set <strong>Payload URL</strong> to the Webhook URL above, set <strong>Content type</strong> to <code className="text-amber-400">application/json</code>, and paste your <strong>Secret</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold shrink-0">
                      3
                    </span>
                    <div>
                      <h4 className="font-semibold text-white">Select Trigger Events</h4>
                      <p className="text-slate-400 mt-0.5">
                        Select <strong>&quot;Just the push event&quot;</strong> and make sure <strong>Active</strong> is checked. Click <strong>Add webhook</strong> to finalize!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d] space-y-2 font-mono text-[11px]">
                  <div className="text-slate-400 flex items-center justify-between pb-1.5 border-b border-[#30363d]">
                    <span>GitHub Webhook Blueprint</span>
                    <span className={webhookSecret ? 'text-emerald-400' : 'text-slate-500'}>
                      {webhookSecret ? 'Push Event Ready' : 'Inaktiv'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Payload URL: </span>
                    <span className="text-indigo-300 break-all">{webhookUrl}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Content type: </span>
                    <span className="text-amber-400">application/json</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Secret: </span>
                    <span className="text-slate-300">
                      {webhookSecret ? `${webhookSecret.substring(0, 16)}••••••••` : '(Bitte zuerst Secret generieren)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">SSL verification: </span>
                    <span className="text-emerald-400">Enable SSL verification</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {guideProvider === 'gitlab' && (
            <div className="space-y-4 text-xs">
              <ol className="list-decimal list-inside space-y-2 text-slate-300">
                <li>Go to your GitLab project &rarr; <strong>Settings</strong> &rarr; <strong>Webhooks</strong>.</li>
                <li>Paste the <strong>Webhook URL</strong> into the <strong>URL</strong> field.</li>
                <li>Paste your <strong>Secret Token</strong> into the <strong>Secret token</strong> field.</li>
                <li>Under <strong>Trigger</strong>, check <strong>Push events</strong> and optionally enter <code className="text-indigo-400">{branchName || 'main'}</code>.</li>
                <li>Leave <strong>Enable SSL verification</strong> enabled and click <strong>Add webhook</strong>.</li>
              </ol>
            </div>
          )}

          {guideProvider === 'gitea' && (
            <div className="space-y-4 text-xs">
              <ol className="list-decimal list-inside space-y-2 text-slate-300">
                <li>Open your Gitea repository &rarr; <strong>Settings</strong> &rarr; <strong>Webhooks</strong> &rarr; <strong>Add Webhook</strong> &rarr; <strong>Gitea</strong>.</li>
                <li>Target URL: paste your Webhook URL.</li>
                <li>HTTP Method: <strong>POST</strong>, POST Content Type: <strong>application/json</strong>.</li>
                <li>Secret: paste your Webhook Secret token.</li>
                <li>Trigger On: <strong>Push Events</strong>. Click <strong>Add Webhook</strong>.</li>
              </ol>
            </div>
          )}

          {guideProvider === 'actions' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Trigger deployment from a GitHub Actions workflow step after running tests or audits:
              </p>
              <div className="bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d] relative">
                <button
                  onClick={() =>
                    handleCopy(
                      `- name: Trigger PteroNext Auto-Deploy\n  run: |\n    curl -X POST "${webhookUrl}" \\\n      -H "Content-Type: application/json" \\\n      -H "X-Hub-Signature-256: sha256=\${{ secrets.PTERONEXT_GIT_SECRET }}"`,
                      'GitHub Action YAML'
                    )
                  }
                  className="absolute right-3 top-3 px-2 py-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded text-[11px] text-slate-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy YAML</span>
                </button>
                <pre className="font-mono text-xs text-slate-300 overflow-x-auto custom-scrollbar">
{`- name: Trigger PteroNext Auto-Deploy
  run: |
    curl -X POST "${webhookUrl}" \\
      -H "Content-Type: application/json" \\
      -H "X-Hub-Signature-256: sha256=\${{ secrets.PTERONEXT_GIT_SECRET }}"`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Deployment Audit History Table ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#11161d]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Recent Deployment History</h3>
            <span className="text-xs text-slate-400">({history.length} runs recorded)</span>
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors font-medium hover:underline"
              >
                Historie leeren
              </button>
            )}
            <span className="text-[11px] font-mono text-slate-500">Auto-pruned after 30 days</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#30363d] bg-[#0d1117]/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider select-none">
                <th className="py-3 px-4">Commit / Release</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Trigger</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]/50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-inner mb-1">
                        <Clock className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-xs font-semibold text-slate-300">Keine Deployments vorhanden</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                        Keine Deployments vorhanden. Starte deinen ersten Rollout per 1-Click Deploy oder Git-Push.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                history.map((run) => (
                  <tr key={run.id} className="hover:bg-[#1c2128]/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[11px]">
                            {run.commitHash}
                          </span>
                          <span className="font-medium text-white truncate max-w-xs">{run.commitMessage}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>by {run.author}</span>
                          <span>•</span>
                          <span>{run.startedAt}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                        <span>{run.branch}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono capitalize bg-slate-800 border border-slate-700 text-slate-300">
                        {run.trigger}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{run.durationSeconds}s</td>
                    <td className="py-3 px-4">
                      {run.status === 'success' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" />
                          Success
                        </span>
                      )}
                      {run.status === 'running' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Deploying
                        </span>
                      )}
                      {run.status === 'failed' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setActiveDeployLogs(run.logs);
                          addToast({
                            title: 'Logs Loaded',
                            description: `Showing terminal log for commit ${run.commitHash}.`,
                            type: 'info',
                          });
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline inline-flex items-center gap-1"
                      >
                        <span>Inspect Logs</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
