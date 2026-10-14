import React from 'react';
import { AlertTriangle, X, ShieldAlert, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DnsRevocationModal: React.FC = () => {
  const { dnsRevocationAlert, dismissDnsRevocationAlert, language } = useApp();

  if (!dnsRevocationAlert) {
    return null;
  }

  const isDe = language === 'de';
  const domainName = dnsRevocationAlert.full_domain || dnsRevocationAlert.subdomain || 'Domain';
  const defaultReason = isDe
    ? 'Verstoß gegen die Nutzungsbedingungen oder unzulässiger Name.'
    : 'Terms of service violation or restricted name policy.';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0b0f19]/95 border border-rose-500/30 p-6 sm:p-7 shadow-[0_20px_60px_rgba(244,63,94,0.25)] space-y-5 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-inner shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {isDe ? 'DNS-Widerruf' : 'DNS Revoked'}
                </span>
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-sky-400" />
                  {domainName}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                {isDe
                  ? 'Subdomain von Administrator entfernt'
                  : 'Subdomain Revoked by Administrator'}
              </h3>
            </div>
          </div>

          <button
            onClick={dismissDnsRevocationAlert}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title={isDe ? 'Schließen' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Card */}
        <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20 space-y-3 relative z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-300 font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{isDe ? 'Offizielle Begründung der Moderation:' : 'Official Moderation Reason:'}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#060913] border border-slate-800 text-slate-200 font-mono text-xs leading-relaxed shadow-inner">
            "{dnsRevocationAlert.reason || defaultReason}"
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isDe
              ? 'Die A- und SRV-Records für diese Subdomain wurden unmittelbar aus Cloudflare gelöscht. Der Eintrag wurde automatisch aus deinem Server-Panel entfernt.'
              : 'The A and SRV records for this subdomain were instantly purged from Cloudflare. The mapping has been automatically deleted from your server panel.'}
          </p>
        </div>

        {/* Re-use Info Note */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-300 font-mono flex items-start gap-2.5">
          <span className="text-sky-400 font-bold shrink-0">ℹ</span>
          <span>
            {isDe
              ? 'Du kannst jederzeit eine neue, regelkonforme Subdomain im Tab "Netzwerk" konfigurieren.'
              : 'You can configure a new, policy-compliant subdomain at any time in the "Network" tab.'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1 relative z-10">
          <button
            type="button"
            onClick={dismissDnsRevocationAlert}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-mono text-xs font-bold transition-all shadow-[0_4px_16px_rgba(244,63,94,0.3)] active:scale-95"
          >
            {isDe ? 'Verstanden & Bestätigen' : 'Acknowledge & Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
};
