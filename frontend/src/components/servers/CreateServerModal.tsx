import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Modal } from '../common/Modal';
import {
  Server,
  HardDrive,
  Users,
  Package,
  Cpu,
  Database,
  Plus,
  Zap,
  Check,
} from 'lucide-react';

export const CreateServerModal: React.FC = () => {
  const {
    isCreateServerOpen,
    setIsCreateServerOpen,
    adminNodes,
    adminUsers,
    adminNests,
    adminEggs,
    createServer,
    addToast,
  } = useApp();
  const { language } = useTranslation();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [nodeId, setNodeId] = useState<string>('');
  const [nestId, setNestId] = useState<string>('');
  const [eggId, setEggId] = useState<string>('');
  const [memoryMB, setMemoryMB] = useState(2048);
  const [swapMB, setSwapMB] = useState(0);
  const [diskMB, setDiskMB] = useState(10240);
  const [cpuPercent, setCpuPercent] = useState(100);
  const [port, setPort] = useState<number | undefined>(undefined);

  // Auto-select first node, user, nest, egg when modal opens
  useEffect(() => {
    if (isCreateServerOpen) {
      setStep(1);
      setName('');
      setDescription('');
      if (adminUsers.length > 0) setOwnerId(adminUsers[0].id);
      setNodeId('auto');
      if (adminNests.length > 0) {
        setNestId(adminNests[0].id);
        const eggsForNest = adminEggs.filter((e) => e.nestId === adminNests[0].id);
        if (eggsForNest.length > 0) setEggId(eggsForNest[0].id);
      }
    }
  }, [isCreateServerOpen, adminUsers, adminNodes, adminNests, adminEggs]);

  // When nest changes, update available eggs
  const availableEggs = adminEggs.filter((e) => e.nestId === nestId);
  useEffect(() => {
    if (availableEggs.length > 0 && !availableEggs.some((e) => e.id === eggId)) {
      setEggId(availableEggs[0].id);
    }
  }, [nestId, availableEggs, eggId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({
        title: language === 'de' ? 'Servername erforderlich' : 'Server Name Required',
        description: language === 'de' ? 'Bitte gib einen Servernamen ein.' : 'Please enter a server name.',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await createServer({
        name: name.trim(),
        description: description.trim(),
        node_id: nodeId === 'auto' ? 0 : Number(nodeId),
        egg_id: eggId ? Number(eggId) : undefined,
        nest_id: nestId ? Number(nestId) : undefined,
        memory: Number(memoryMB),
        swap: Number(swapMB),
        disk: Number(diskMB),
        cpu: Number(cpuPercent),
        port: port || undefined,
      });

      if (success) {
        setIsCreateServerOpen(false);
        setName('');
        setDescription('');
        setStep(1);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isCreateServerOpen}
      onClose={() => setIsCreateServerOpen(false)}
      title={language === 'de' ? 'Gameserver erstellen' : 'Create Game Server'}
      subtitle={
        language === 'de'
          ? 'Stelle eine neue Container-Instanz auf deinem Wings-Cluster bereit'
          : 'Deploy a new container instance on your Wings compute cluster'
      }
      icon={<Server className="w-4 h-4 text-zinc-200" />}
      badge="DEPLOY WIZARD"
      badgeColor="default"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2 border-b border-[#212836] pb-3 text-xs font-mono">
          {[
            { num: 1, label: language === 'de' ? 'Allgemein & Eigentümer' : 'General & Owner' },
            { num: 2, label: language === 'de' ? 'Node & Template' : 'Node & Template' },
            { num: 3, label: language === 'de' ? 'Ressourcen-Limits' : 'Resource Limits' },
          ].map((item) => (
            <button
              key={item.num}
              type="button"
              onClick={() => setStep(item.num)}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all ${
                step === item.num
                  ? 'theme-accent-bg font-bold shadow-sm'
                  : step > item.num
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                step === item.num
                  ? 'bg-black/20 text-current font-bold'
                  : step > item.num
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-white/10 text-slate-400'
              }`}>
                {step > item.num ? '✓' : item.num}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Step 1: General & Owner */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                {language === 'de' ? 'Servername *' : 'Server Name *'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={language === 'de' ? 'z. B. Vanilla Survival 1.20' : 'e.g. Vanilla Survival 1.20'}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                {language === 'de' ? 'Server-Beschreibung (Optional)' : 'Server Description (Optional)'}
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === 'de' ? 'Haupt-Community Survival-Welt...' : 'Primary community survival world...'}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                {language === 'de' ? 'Server-Eigentümer (Account)' : 'Server Owner (Account)'}
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              >
                {adminUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Node & Template */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  {language === 'de' ? 'Compute Node (Wings) *' : 'Compute Node (Wings) *'}
                </label>
                <select
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                >
                  <option value="auto" className="text-emerald-400 font-medium">
                    {language === 'de' ? '⚡ Auto (Bester Node — Multi-Node Balancing)' : '⚡ Auto (Multi-Node Load Balancing — Best Node)'}
                  </option>
                  {adminNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.fqdn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  {language === 'de' ? 'Spezifischer Port (Optional)' : 'Specific Port (Optional)'}
                </label>
                <input
                  type="number"
                  placeholder={language === 'de' ? 'Nächsten freien Port automatisch zuweisen' : 'Auto-assign next free port'}
                  value={port || ''}
                  onChange={(e) => setPort(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  {language === 'de' ? 'Spiel-Kategorie (Nest)' : 'Game Nest'}
                </label>
                <select
                  value={nestId}
                  onChange={(e) => setNestId(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                >
                  {adminNests.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  {language === 'de' ? 'Egg-Vorlage (Template)' : 'Egg Template'}
                </label>
                <select
                  value={eggId}
                  onChange={(e) => setEggId(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                >
                  {availableEggs.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Resource Limits */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  {language === 'de' ? 'Arbeitsspeicher (MB)' : 'Memory Limit (MB)'}
                </label>
                <input
                  type="number"
                  value={memoryMB}
                  onChange={(e) => setMemoryMB(parseInt(e.target.value) || 1024)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  {(memoryMB / 1024).toFixed(1)} GB RAM
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  {language === 'de' ? 'Swap-Speicher (MB)' : 'Swap Space (MB)'}
                </label>
                <input
                  type="number"
                  value={swapMB}
                  onChange={(e) => setSwapMB(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  {swapMB === 0 ? (language === 'de' ? '0 (Kein Swap)' : '0 (No Swap)') : `${(swapMB / 1024).toFixed(1)} GB Swap`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  {language === 'de' ? 'Festplattenspeicher (MB)' : 'Disk Storage (MB)'}
                </label>
                <input
                  type="number"
                  value={diskMB}
                  onChange={(e) => setDiskMB(parseInt(e.target.value) || 5120)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  {(diskMB / 1024).toFixed(1)} GB Storage
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  {language === 'de' ? 'CPU-Limit (%)' : 'CPU Limit (%)'}
                </label>
                <input
                  type="number"
                  value={cpuPercent}
                  onChange={(e) => setCpuPercent(parseInt(e.target.value) || 100)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  {cpuPercent}% CPU Core
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#0d1117] rounded-xl border border-[#30363d] text-xs font-mono space-y-1">
              <span className="text-slate-400 block font-semibold">{language === 'de' ? 'Zusammenfassung' : 'Summary Preview'}</span>
              <p className="text-slate-300">
                {language === 'de' ? 'Bereitstellung von ' : 'Deploying '}
                <span className="text-white font-bold">{name || (language === 'de' ? 'Server' : 'Server')}</span>
                {language === 'de' ? ' auf Node ' : ' to Node '}
                <span className="text-white">#{nodeId}</span>
                {language === 'de' ? ' mit ' : ' with '}
                <span className="text-white font-bold">{(memoryMB / 1024).toFixed(1)} GB RAM</span>
                {swapMB > 0 && <span> + <span className="text-emerald-400 font-bold">{(swapMB / 1024).toFixed(1)} GB Swap</span></span>}.
              </p>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-[#30363d]">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              {language === 'de' ? 'Zurück' : 'Back'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreateServerOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="btn btn-primary px-4 py-2 rounded-xl text-xs font-semibold"
            >
              {language === 'de' ? 'Weiterer Schritt' : 'Next Step'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="btn btn-primary px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-50"
            >
              {isSubmitting
                ? (language === 'de' ? 'Wird bereitgestellt...' : 'Deploying...')
                : (language === 'de' ? 'Container bereitstellen' : 'Deploy Container')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
};
