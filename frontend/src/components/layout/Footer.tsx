import React from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Sparkles, GitBranch, Heart, ExternalLink, ShieldCheck, HeartHandshake } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setActiveView } = useApp();
  const { language } = useTranslation();

  return (
    <footer className="w-full border-t border-[#30363d]/70 bg-gradient-to-b from-[#0d1117]/90 to-[#07090e] backdrop-blur-md py-6 px-4 sm:px-6 lg:px-8 mt-auto shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
        {/* Left: Branding, Author & Pterodactyl upstream credits */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-2 sm:gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">{language === 'de' ? 'Entwickelt von' : 'Developed by'}</span>
            <span className="font-bold text-white tracking-wide bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              Springi_SFM
            </span>
          </div>

          <span className="hidden sm:inline text-slate-700">|</span>

          {/* Upstream Open Source Credit */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <HeartHandshake className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{language === 'de' ? 'Basierend auf & Credits an' : 'Based upon & credits to'}</span>
            <a
              href="https://pterodactyl.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors flex items-center gap-0.5"
              title="Official Pterodactyl Project Website"
            >
              <span>Pterodactyl</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </a>
            <span className="text-slate-600">(</span>
            <a
              href="https://github.com/pterodactyl/panel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
              title="Pterodactyl GitHub Repository"
            >
              GitHub
            </a>
            <span className="text-slate-600">)</span>
          </div>
        </div>

        {/* Right: Version badges, Changelog link & Status */}
        <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end">
          {/* Release Version badge */}
          <button
            onClick={() => setActiveView('changelog')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--theme-accent-glow)] text-white border border-[var(--theme-accent)] hover:scale-105 active:scale-95 transition-all font-bold shadow-sm"
            title="System Changelog ansehen"
          >
            <Sparkles className="w-3 h-3 text-[var(--theme-accent)]" />
            <span>v2.8.5 Release</span>
          </button>

          <button
            onClick={() => setActiveView('changelog')}
            className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Changelogs
          </button>

          <a
            href="https://github.com/SpringiSFMM/pteronext"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            title="PteroNext Source Repository"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>PteroNext GitHub</span>
          </a>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Systems Online</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
