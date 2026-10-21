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
          'Global Nebula Theme Designer (Admin-only): 8 Presets, dynamic accent colors, glow levels, custom wallpaper, branding, and global CSS injection',
          'Server Groups & Personal Folders (User-Scoped): Drag & Drop, collapsible folders, and strict isolation per user account (no global leakage)',
          'Direct Folder Upload & Recursive Drop: Upload entire directory trees with preserved structure directly into the File Manager',
          'Schedule Conditions (Conditional Execution): Smart triggers on 0 players (idle protection), CPU threshold, or server lifecycle status',
          'Server Branches & Staging Sandboxes: 1-click cloning of servers into isolated staging environments for risk-free updates and testing',
          'Granular Subuser Permissions & Visual Glob Rules: Detailed file permissions (Upload, Delete, Archive) and visual path guardrails',
        ]
      : [
          'Global Nebula Theme Designer (Admin-only): 8 Presets, dynamische Akzentfarben, Glow-Levels, Custom Wallpaper, Branding und globale CSS-Injection',
          'Server-Gruppen & persönliche Ordner (User-Scoped): Drag & Drop, einklappbare Ordner und strikte Isolation pro Benutzerkonto (keine globale Vermischung)',
          'Direkter Ordner-Upload & Rekursiver Drop: Ganze Verzeichnisbäume mit erhaltener Struktur direkt in den Dateimanager hochladen',
          'Schedule Conditions (Bedingte Ausführung): Smart Trigger bei 0 Spielern (Idle-Schutz), CPU-Schwellenwert oder Server-Status',
          'Server-Branches & Staging-Sandboxes: 1-Klick Klonen von Servern in isolierte Testumgebungen für risikofreie Updates und Tests',
          'Granulare Subuser-Rechte & Visual Glob Rules: Detaillierte Dateirechte (Upload, Delete, Archive) und visuelle Pfad-Guardrails',
        ];

  const securityItems: string[] =
    (latestRelease.security && latestRelease.security.length > 0)
      ? latestRelease.security
      : language === 'en'
      ? [
          'Strict personal folder isolation: Complete separation of user folders prevents unauthorized cross-account visibility or leakage',
          'Visual Glob Guardrails: Path-based access rules enforce strict boundaries for subuser file operations and prevent traversal',
          'Automated masking of sensitive tokens, passwords, and webhooks in live logs',
        ]
      : [
          'Strikte Isolation für persönliche Server-Ordner: Vollständige Trennung persönlicher Ordner verhindert unautorisierte Einsichtnahme zwischen Konten',
          'Visual Glob Guardrails: Pfadbasierte Zugriffsregeln blockieren unbefugte Dateimanipulationen und Directory Traversal durch Subuser',
          'Automatische Zensur (Masking) sensibler Tokens, Passwörter und Webhooks in Live-Logs',
        ];

  const improvementItems: string[] =
    (latestRelease.improvements && latestRelease.improvements.length > 0)
      ? latestRelease.improvements
      : language === 'en'
      ? [
          'Bugfix: Resolved global folder visibility (folders are now strictly bound to the authenticated user account)',
          'Optimized recursive upload handler in File Manager for large directory hierarchies with preserved structure',
          'Resource-efficient schedule condition evaluation minimizing unnecessary background executions',
        ]
      : [
          'Bugfix: Behebung der globalen Ordnersichtbarkeit (Ordner sind jetzt strikt an das jeweilige Benutzerkonto gebunden)',
          'Optimierter rekursiver Upload-Handler im Dateimanager für große Verzeichnisstrukturen mit erhaltener Hierarchie',
          'Ressourceneffiziente Prüfung von Schedule-Bedingungen zur Minimierung unnötiger Hintergrund-Ausführungen',
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
                    {latestRelease.version || changelogData.current_version || 'v2.9.0'}
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
                  {latestRelease.title || (language === 'de' ? 'Global Nebula Theme Designer, Server-Ordner & Staging-Sandboxes' : 'Global Nebula Theme Designer, Server Folders & Staging Sandboxes')}
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
              ? 'Willkommen bei Version v2.6.0! PteroNext wurde mit dem neuen Global Nebula Theme Designer, benutzerbezogenen Server-Ordnern mit strikter Isolation, direktem Verzeichnis-Upload und Staging-Sandboxes erweitert.'
              : 'Welcome to version v2.6.0! PteroNext has been equipped with the new Global Nebula Theme Designer, user-scoped server folders with strict isolation, direct folder upload, and staging sandboxes.'}
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
