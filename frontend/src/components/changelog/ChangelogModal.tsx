import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';
import {
  Sparkles,
  X,
  Check,
  ArrowRight,
  Shield,
  Zap,
  Layers,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const ChangelogModal: React.FC = () => {
  const { language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [changelogData, setChangelogData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'features' | 'security' | 'improvements'>('features');

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const res = await api.changelog.get(language);
        if (res && res.current_version) {
          setChangelogData(res);
          const lastSeen = localStorage.getItem('pteronext_last_seen_version');
          if (lastSeen !== res.current_version) {
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error('Could not check changelog:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChangelog();
  }, [language]);

  const handleClose = () => {
    if (changelogData?.current_version) {
      localStorage.setItem('pteronext_last_seen_version', changelogData.current_version);
    }
    setIsOpen(false);
  };

  if (!isOpen || !changelogData) return null;

  const latestRelease = changelogData.releases?.[0] || {};

  const featureItems: string[] =
    (latestRelease.features && latestRelease.features.length > 0)
      ? latestRelease.features
      : (latestRelease.highlights && latestRelease.highlights.length > 0)
      ? latestRelease.highlights
      : language === 'en'
      ? [
          'Port & Network Manager with 1-Click Primary Switching & Pool Allocation',
          'Player & Community Dashboard with Live Avatars, Chat Relay & Ban Management',
          'Integrated Redis, SQLite & PostgreSQL Sidecars with Auto-Credential Injection',
          'Built-in Web Database Viewer for rapid table inspection in browser',
          'Security Scanner & Bytecode Backdoor Detection for .jar files',
          'Multi-User Co-Pilot Presence & 1-Click Incident Freeze / Safe Mode',
          'Granular Zero-Trust RBAC with visual path and command rules',
        ]
      : [
          'Port- & Netzwerk-Manager mit 1-Klick Primary Switching & Pool Allokation',
          'Player- & Community-Dashboard mit Live-Avatar, Chat-Relay & Ban-Verwaltung',
          'Integrierte Redis-, SQLite- & PostgreSQL-Sidecars mit Auto-Credential-Injection',
          'Integrierter Web-DB-Viewer für schnelle Tabellen-Inspektion im Browser',
          'Sicherheits-Scan & Bytecode Backdoor Detection für .jar Dateien',
          'Multi-User Co-Pilot Presence & 1-Klick Incident Freeze / Safe Mode',
          'Granulares Zero-Trust RBAC mit visuellen Path- & Command-Rules',
        ];

  const securityItems: string[] =
    (latestRelease.security && latestRelease.security.length > 0)
      ? latestRelease.security
      : language === 'en'
      ? [
          'Automated masking of sensitive tokens, passwords, and webhooks in live logs',
          'Host-level sanitization and canonical path checking via filepath.Clean against traversal',
          'Zero-Trust RBAC prioritizing DENY rules before ALLOW rules',
        ]
      : [
          'Automatische Zensur (Masking) sensibler Tokens, Passwörter und Webhooks in Live-Logs',
          'Host-Level Sanitization und kanonische Pfadprüfung via filepath.Clean gegen Directory Traversal',
          'Zero-Trust RBAC mit Vorrang von DENY-Regeln vor ALLOW-Regeln',
        ];

  const improvementItems: string[] =
    (latestRelease.improvements && latestRelease.improvements.length > 0)
      ? latestRelease.improvements
      : language === 'en'
      ? [
          'Multi-Node load balancing based on actual RAM and CPU utilization',
          'Discord & Slack first webhooks with interactive action buttons',
          'Modernized glassmorphism interface with smooth animations and micro-interactions',
        ]
      : [
          'Multi-Node Load Balancing basierend auf tatsächlicher RAM- und CPU-Auslastung',
          'Discord- & Slack-First Webhooks mit interaktiven Action-Buttons',
          'Modernisiertes Glasmorphismus-Design mit flüssigen Animationen und Micro-Interaktionen',
        ];

  const currentList =
    activeTab === 'features'
      ? featureItems
      : activeTab === 'security'
      ? securityItems
      : improvementItems;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0d1117] border border-indigo-500/30 rounded-2xl shadow-[0_0_60px_rgba(99,102,241,0.25)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Gradient Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-400" />

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Top Title & Close Button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {latestRelease.version || changelogData.current_version || 'v2.8.8'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {latestRelease.date || (language === 'de' ? 'Oktober 2026' : 'October 2026')}
                  </span>
                  {latestRelease.tag && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {latestRelease.tag}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight mt-1">
                  {latestRelease.title || (language === 'de' ? 'Enterprise Security, Sidecars & Co-Pilot' : 'Enterprise Security, Sidecars & Co-Pilot')}
                </h3>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            {language === 'de'
              ? 'Willkommen beim neuen Update! PteroNext wurde mit mächtigen Sicherheits-, Community- und Sidecar-Werkzeugen erweitert, um Serververwaltung noch schneller, sicherer und intuitiver zu machen.'
              : 'Welcome to the latest update! PteroNext has been equipped with powerful security, community, and sidecar management tools to make server operations faster, safer, and more intuitive.'}
          </p>

          {/* Navigation Category Tabs */}
          <div className="flex items-center gap-2 pt-1 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('features')}
              className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-mono font-semibold transition-all border-b-2 -mb-px ${
                activeTab === 'features'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Features ({featureItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-mono font-semibold transition-all border-b-2 -mb-px ${
                activeTab === 'security'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{language === 'de' ? 'Sicherheit' : 'Security'} ({securityItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('improvements')}
              className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-mono font-semibold transition-all border-b-2 -mb-px ${
                activeTab === 'improvements'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Performance ({improvementItems.length})</span>
            </button>
          </div>

          {/* Items List */}
          <div className="space-y-2 bg-[#05070a] p-4 rounded-xl border border-slate-800/80 max-h-60 overflow-y-auto">
            {currentList.map((item: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-[#0d1117] border border-slate-800/60 text-xs text-slate-200"
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    activeTab === 'security'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : activeTab === 'improvements'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-indigo-500/20 text-indigo-400'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <span className="text-[11px] text-slate-500 font-mono">
              PteroNext Cloud Architecture
            </span>

            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono transition-all shadow-md active:scale-95"
            >
              <span>{language === 'de' ? 'Verstanden & Loslegen' : 'Got it, let’s go!'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
