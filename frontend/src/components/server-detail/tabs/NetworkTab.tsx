import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import {
  Network,
  Plus,
  Trash2,
  Star,
  Copy,
  Check,
  Edit2,
  RefreshCw,
  Globe,
  Radio,
  Server,
  Info,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Modal } from '../../common/Modal';

interface Allocation {
  id: number;
  ip: string;
  port: number;
  alias?: string;
  notes?: string;
  is_primary?: boolean;
}

export const NetworkTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [availablePool, setAvailablePool] = useState<any[]>([]);
  const [primaryId, setPrimaryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cloudflare DNS & SRV Automation State
  const [customDomains, setCustomDomains] = useState<any[]>([]);
  const [cfConfigured, setCfConfigured] = useState(false);
  const [defaultDomain, setDefaultDomain] = useState('');
  const [newSubdomain, setNewSubdomain] = useState('');
  const [creatingDns, setCreatingDns] = useState(false);
  const [loadingDns, setLoadingDns] = useState(false);

  // Notes Modal State
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // New Allocation Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<number | 0>(0);
  const [assigning, setAssigning] = useState(false);

  const fetchNetworkData = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setLoading(true);
      const res = await api.network.get(selectedServer.uuid);
      if (res) {
        setAllocations(res.allocations || []);
        setAvailablePool(res.available_pool || []);
        setPrimaryId(res.primary_allocation_id || null);
      }
    } catch (err: any) {
      console.error('Failed to load network allocations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDnsDomains = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setLoadingDns(true);
      const res = await api.dns.list(selectedServer.uuid);
      if (res) {
        setCustomDomains(res.domains || []);
        setCfConfigured(res.cloudflare_configured || false);
        setDefaultDomain(res.default_domain || '');
      }
    } catch (e) {
      console.warn('Could not load custom domains:', e);
    } finally {
      setLoadingDns(false);
    }
  };

  useEffect(() => {
    fetchNetworkData();
    fetchDnsDomains();
  }, [selectedServer?.uuid]);

  const handleCreateDns = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer?.uuid || !newSubdomain.trim()) return;
    try {
      setCreatingDns(true);
      const res = await api.dns.create(selectedServer.uuid, {
        hostname: newSubdomain.trim(),
        base_domain: defaultDomain,
      });
      addToast({
        title: language === 'de' ? 'DNS-Records angelegt' : 'DNS Records Created',
        description: res.message || (language === 'de' ? 'A- und SRV-Record erfolgreich in Cloudflare hinterlegt!' : 'A & SRV records created in Cloudflare!'),
        type: 'success',
      });
      setNewSubdomain('');
      fetchDnsDomains();
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'DNS-Erstellung fehlgeschlagen' : 'DNS Creation Failed',
        description: err.message || 'Error creating Cloudflare records',
        type: 'error',
      });
    } finally {
      setCreatingDns(false);
    }
  };

  const handleDeleteDns = async (domainId: number, hostname: string) => {
    if (!selectedServer?.uuid) return;
    if (!window.confirm(language === 'de' ? `Soll ${hostname} und die zugehörigen Cloudflare DNS-Records wirklich gelöscht werden?` : `Delete ${hostname} and all associated Cloudflare DNS records?`)) return;
    try {
      await api.dns.delete(selectedServer.uuid, domainId);
      addToast({
        title: language === 'de' ? 'DNS gelöscht' : 'DNS Deleted',
        description: language === 'de' ? `${hostname} wurde aus Cloudflare entfernt.` : `${hostname} removed from Cloudflare.`,
        type: 'info',
      });
      fetchDnsDomains();
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Löschen fehlgeschlagen' : 'Deletion Failed',
        description: err.message || 'Error deleting DNS records',
        type: 'error',
      });
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    addToast({
      title: 'Copied',
      description: `Copied ${text} to clipboard`,
      type: 'info',
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSetPrimary = async (allocId: number) => {
    if (!selectedServer?.uuid) return;
    try {
      await api.network.setPrimary(selectedServer.uuid, allocId);
      setPrimaryId(allocId);
      addToast({
        title: 'Primary Port Updated',
        description: 'Default server connection port updated successfully.',
        type: 'success',
      });
      fetchNetworkData();
    } catch (err: any) {
      addToast({
        title: 'Action Failed',
        description: err.message || 'Could not set primary port',
        type: 'error',
      });
    }
  };

  const handleAssignAllocation = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setAssigning(true);
      await api.network.assign(selectedServer.uuid, selectedPoolId || undefined);
      addToast({
        title: 'Port Assigned',
        description: 'New network allocation successfully connected to container.',
        type: 'success',
      });
      setIsAssignModalOpen(false);
      setSelectedPoolId(0);
      fetchNetworkData();
    } catch (err: any) {
      addToast({
        title: 'Allocation Failed',
        description: err.message || 'Could not assign port',
        type: 'error',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteAllocation = async (alloc: Allocation) => {
    if (!selectedServer?.uuid) return;
    if (alloc.is_primary || alloc.id === primaryId) {
      addToast({
        title: 'Protected Allocation',
        description: 'You cannot remove the primary server port. Promote another port first.',
        type: 'warning',
      });
      return;
    }

    if (!window.confirm(`Release port ${alloc.port} back to the node allocation pool?`)) {
      return;
    }

    try {
      await api.network.delete(selectedServer.uuid, alloc.id);
      addToast({
        title: 'Port Released',
        description: `Port ${alloc.port} has been unassigned and returned to pool.`,
        type: 'info',
      });
      fetchNetworkData();
    } catch (err: any) {
      addToast({
        title: 'Deletion Failed',
        description: err.message || 'Could not release port',
        type: 'error',
      });
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedServer?.uuid || !editingAllocation) return;
    try {
      setSavingNotes(true);
      await api.network.updateNotes(selectedServer.uuid, editingAllocation.id, {
        notes: editNotes,
        alias: editAlias,
      });
      addToast({
        title: 'Saved',
        description: 'Port notes and alias updated.',
        type: 'success',
      });
      setEditingAllocation(null);
      fetchNetworkData();
    } catch (err: any) {
      addToast({
        title: 'Save Failed',
        description: err.message || 'Could not update notes',
        type: 'error',
      });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-wide font-sans">
              Port- & Netzwerk-Manager
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Dual-Stack Routing
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage primary gaming ports, secondary service endpoints (Dynmap, Voice, RCON), and allocation routing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchNetworkData}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Refresh Network Pool"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Port</span>
          </button>
        </div>
      </div>

      {/* Recommended Presets Banner */}
      <div className="cyber-glass rounded-2xl p-4 border border-slate-800/80 bg-slate-900/30 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-white font-medium">Common Secondary Port Uses: </span>
          Dynmap / BlueMap (Web-Maps), Simple Voice Chat (UDP Voice), Votifier (Server voting), RCON (Remote administration), Geyser / Floodgate (Bedrock crossplay).
        </div>
      </div>

      {/* Allocations Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allocations.map((alloc) => {
          const isPrimary = alloc.id === primaryId || alloc.is_primary;
          const displayHost = alloc.alias || alloc.ip || '0.0.0.0';
          const fullAddress = `${displayHost}:${alloc.port}`;

          return (
            <div
              key={alloc.id}
              className={`cyber-glass rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                isPrimary
                  ? 'border-emerald-500/40 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.05)]'
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    {isPrimary ? (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[11px] font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        PRIMARY
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono text-[11px]">
                        SECONDARY
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-500">
                    ID #{alloc.id}
                  </span>
                </div>

                {/* Connection Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-[#0d1117] p-2.5 rounded-xl border border-slate-800/80">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] text-slate-500 uppercase font-mono block">
                        Network Endpoint
                      </span>
                      <span className="text-sm font-bold text-white font-mono truncate block">
                        {fullAddress}
                      </span>
                    </div>

                    <button
                      onClick={() => copyToClipboard(fullAddress, `alloc-${alloc.id}`)}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Copy Address"
                    >
                      {copiedKey === `alloc-${alloc.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Notes / Tag */}
                  <div className="bg-[#0d1117]/60 p-2.5 rounded-xl border border-slate-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">
                        Usage Notes & Alias
                      </span>
                      <button
                        onClick={() => {
                          setEditingAllocation(alloc);
                          setEditNotes(alloc.notes || '');
                          setEditAlias(alloc.alias || '');
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        Edit
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 font-mono italic truncate">
                      {alloc.notes || (isPrimary ? 'Default game server listener' : 'No notes assigned')}
                    </p>
                    {alloc.alias && (
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">
                        Domain Alias: <span className="text-emerald-400">{alloc.alias}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-800/80">
                {!isPrimary ? (
                  <button
                    onClick={() => handleSetPrimary(alloc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-mono transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>Set Primary</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Default Gateway
                  </span>
                )}

                {!isPrimary && (
                  <button
                    onClick={() => handleDeleteAllocation(alloc)}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                    title="Remove Port"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Zero-Config Cloudflare DNS- & SRV-Automation Card */}
      <div className="cyber-glass rounded-2xl p-5 border border-sky-500/30 bg-gradient-to-br from-[#161b22] to-sky-950/20 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-mono">
                  {language === 'de' ? 'Zero-Config Cloudflare DNS- & SRV-Automation' : 'Zero-Config Cloudflare DNS & SRV Automation'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-semibold">
                  SRV Record Direct Play
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'de'
                  ? 'Subdomain eingeben – das Panel erstellt automatisch A- & SRV-Records, sodass Spieler ohne Portnummer direkt verbinden können.'
                  : 'Enter a subdomain – the panel provisions A & SRV records so players connect directly without awkward port numbers.'}
              </p>
            </div>
          </div>

          <button
            onClick={fetchDnsDomains}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors self-start sm:self-auto"
            title="Refresh DNS domains"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDns ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!cfConfigured && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                {language === 'de' ? 'Cloudflare-API noch nicht verknüpft' : 'Cloudflare API not configured'}
              </span>
              <span className="text-slate-300">
                {language === 'de'
                  ? 'Ein Administrator kann im Admin Dashboard unter Integrationen das Cloudflare API-Token und die Zone-ID hinterlegen.'
                  : 'An administrator can configure Cloudflare API Token and Zone ID in Admin Dashboard > Integrations.'}
              </span>
            </div>
          </div>
        )}

        {/* Create Subdomain Form */}
        <form onSubmit={handleCreateDns} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newSubdomain}
              onChange={(e) => setNewSubdomain(e.target.value)}
              placeholder={defaultDomain ? `z. B. play (wird zu play.${defaultDomain})` : 'z. B. play.deinedomain.de'}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
            />
            {defaultDomain && (
              <span className="hidden md:inline absolute right-3 top-2.5 text-[11px] font-mono text-slate-500 pointer-events-none">
                .{defaultDomain}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={creatingDns || !newSubdomain.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creatingDns ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{language === 'de' ? 'Erstelle Records...' : 'Provisioning...'}</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>{language === 'de' ? 'Subdomain anlegen' : 'Create Subdomain'}</span>
              </>
            )}
          </button>
        </form>

        {/* Existing Custom Domains List */}
        {customDomains.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              {language === 'de' ? 'Aktive Domain-Verbindungen' : 'Active Domain Mappings'} ({customDomains.length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customDomains.map((dom) => (
                <div
                  key={dom.id}
                  className="p-3.5 rounded-xl bg-[#0d1117] border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col justify-between gap-3 shadow-inner"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-white">
                          {dom.hostname}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ONLINE
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1 flex flex-wrap gap-2">
                        <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          A Record: <span className="text-sky-300">{dom.target_ip}</span>
                        </span>
                        <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          SRV Port: <span className="text-emerald-300">:{dom.target_port}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => copyToClipboard(dom.hostname, `dom-${dom.id}`)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Copy domain address"
                      >
                        {copiedKey === `dom-${dom.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteDns(dom.id, dom.hostname)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                        title="Delete DNS records"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Assign Port Modal */}
      {isAssignModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAssignModalOpen(false)}
          title="ASSIGN NEW PORT ALLOCATION"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300 font-mono">
              Allocate a supplementary port from the node's available pool or request automatic assignment.
            </p>

            {availablePool.length > 0 ? (
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-slate-400 uppercase">
                  Select Specific Port
                </label>
                <select
                  value={selectedPoolId}
                  onChange={(e) => setSelectedPoolId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value={0}>Automatic (Next available node port)</option>
                  {availablePool.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ip}:{p.port} {p.alias ? `(${p.alias})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 font-mono">
                Automatic allocation will bind the next free port on this host node.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignAllocation}
                disabled={assigning}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition-colors shadow-md disabled:opacity-50"
              >
                {assigning ? 'Allocating...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Notes Modal */}
      {editingAllocation && (
        <Modal
          isOpen={true}
          onClose={() => setEditingAllocation(null)}
          title={`EDIT PORT #${editingAllocation.port}`}
        >
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                Domain / DNS Alias
              </label>
              <input
                type="text"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                placeholder="e.g. play.myserver.com"
                className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                Usage Notes & Description
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="e.g. Dynmap Web Server / Voice Chat"
                className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAllocation(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition-colors shadow-md disabled:opacity-50"
              >
                {savingNotes ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
