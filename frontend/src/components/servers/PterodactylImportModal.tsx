import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Modal } from '../common/Modal';
import {
  Download,
  Server as ServerIcon,
  HardDrive,
  Cpu,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Shield,
  FileCode,
  Globe,
  Radio,
  Zap,
} from 'lucide-react';

interface DiscoveredServer {
  id: number;
  attributes: {
    id: number;
    uuid: string;
    identifier: string;
    name: string;
    description: string;
    limits: {
      memory: number;
      disk: number;
      cpu: number;
    };
    container: {
      image: string;
      startup_command: string;
    };
    relationships?: {
      allocations?: {
        data: Array<{
          attributes: {
            ip: string;
            port: number;
            is_default: boolean;
          };
        }>;
      };
    };
  };
}

export const PterodactylImportModal: React.FC = () => {
  const {
    isImportModalOpen,
    setIsImportModalOpen,
    adminNodes,
    adminUsers,
    addToast,
  } = useApp();
  const { language } = useTranslation();

  const [activeTab, setActiveTab] = useState<'api' | 'json'>('api');

  // API Tab State
  const [panelUrl, setPanelUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [connectedPlatform, setConnectedPlatform] = useState<string | null>(null);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);

  // Target Settings
  const [targetNodeId, setTargetNodeId] = useState<string>('0');
  const [targetOwnerId, setTargetOwnerId] = useState<string>(adminUsers[0]?.id || '1');
  const [overrideName, setOverrideName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // JSON Tab State
  const [jsonContent, setJsonContent] = useState('');
  const [isSubmittingJson, setIsSubmittingJson] = useState(false);

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectionError('');
    setImportSuccess(null);
    setIsConnecting(true);

    try {
      const res = await fetch('/api/admin/importer/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          panel_url: panelUrl.trim(),
          api_key: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setConnectionError(data.error || 'Verbindung zu Pterodactyl/Pelican/Hydrodactyl fehlgeschlagen.');
      } else {
        setConnectedPlatform(data.platform);
        setDiscoveredServers(data.servers || []);
        if (data.servers && data.servers.length > 0) {
          setSelectedServerId(data.servers[0].attributes.id);
          setOverrideName(data.servers[0].attributes.name);
        }
        addToast({
          title: language === 'de' ? 'Verbindung hergestellt' : 'Connected Successfully',
          description: data.message,
          type: 'success',
        });
      }
    } catch (err: any) {
      setConnectionError('Netzwerkfehler: ' + (err.message || 'Server nicht erreichbar'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedServerId) return;
    setIsImporting(true);
    setConnectionError('');
    setImportSuccess(null);

    try {
      const res = await fetch('/api/admin/importer/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          panel_url: panelUrl.trim(),
          api_key: apiKey.trim(),
          server_id: selectedServerId,
          target_node_id: Number(targetNodeId),
          target_owner_id: Number(targetOwnerId),
          override_name: overrideName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setConnectionError(data.error || 'Import fehlgeschlagen.');
      } else {
        setImportSuccess(data.message);
        addToast({
          title: language === 'de' ? 'Projekt importiert!' : 'Project Imported!',
          description: data.message,
          type: 'success',
        });
        setTimeout(() => {
          setIsImportModalOpen(false);
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setConnectionError('Fehler beim Import: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleJsonImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonContent.trim()) return;
    setIsSubmittingJson(true);
    setConnectionError('');

    try {
      const res = await fetch('/api/admin/importer/upload-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          json_content: jsonContent.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setConnectionError(data.error || 'JSON-Import fehlgeschlagen.');
      } else {
        addToast({
          title: language === 'de' ? 'JSON verarbeitet' : 'JSON Processed',
          description: data.message,
          type: 'success',
        });
        setIsImportModalOpen(false);
      }
    } catch (err: any) {
      setConnectionError('Fehler: ' + err.message);
    } finally {
      setIsSubmittingJson(false);
    }
  };

  const selectedServer = discoveredServers.find(
    (s) => s.attributes.id === selectedServerId
  );

  return (
    <Modal
      isOpen={isImportModalOpen}
      onClose={() => setIsImportModalOpen(false)}
      title={language === 'de' ? 'Pterodactyl, Pelican & Hydrodactyl Import-Assistent' : 'Pterodactyl, Pelican & Hydrodactyl Migration Suite'}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* Modal Subheader Banner */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent border border-indigo-500/20">
          <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>{language === 'de' ? 'Automatisierte 1-Klick Projekt- & Servermigration' : 'Automated 1-Click Server & Project Migration'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                v2.9 Native
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {language === 'de'
                ? 'Server, Hardware-Quotas (RAM/CPU/Disk), Docker-Images, Startup-Befehle und Variablen direkt importieren.'
                : 'Directly import servers, hardware quotas, docker images, startup commands, and environment variables.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-[#30363d] pb-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'api'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#161b22]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'de' ? 'Live API-Synchronisation' : 'Live API Sync'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'json'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#161b22]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{language === 'de' ? 'Egg / Manifest JSON Import' : 'Egg / JSON Upload'}</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {connectionError && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{connectionError}</span>
          </div>
        )}

        {/* Global Success Banner */}
        {importSuccess && (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{importSuccess}</span>
          </div>
        )}

        {/* TAB 1: LIVE API MIGRATION */}
        {activeTab === 'api' && (
          <div className="space-y-5">
            {/* Connection Credentials Form */}
            <form onSubmit={handleTestConnection} className="p-4 rounded-xl border border-[#30363d] bg-[#161b22]/70 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{language === 'de' ? '1. Verbindung zum Quell-Panel herstellen' : '1. Connect to Source Panel'}</span>
                </span>
                {connectedPlatform && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {connectedPlatform}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label text-xs">
                    {language === 'de' ? 'Quell-Panel URL (Pterodactyl, Pelican oder Hydrodactyl)' : 'Source Panel URL (Pterodactyl, Pelican or Hydrodactyl)'}
                  </label>
                  <input
                    type="url"
                    required
                    value={panelUrl}
                    onChange={(e) => setPanelUrl(e.target.value)}
                    placeholder="https://panel.example.com"
                    className="input text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="field-label text-xs">
                    {language === 'de' ? 'Application- oder Client-API-Key' : 'Application or Client API Key'}
                  </label>
                  <input
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="ptla_..., pela_... oder hyd_..."
                    className="input text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-400">
                  {language === 'de'
                    ? 'Tipp: Erstelle unter "Application API" im Quell-Panel (Pterodactyl / Pelican / Hydrodactyl) einen Key mit Leserechten auf Server.'
                    : 'Tip: Create an Application API key with read permissions on servers in Pterodactyl, Pelican or Hydrodactyl.'}
                </p>
                <button
                  type="submit"
                  disabled={isConnecting || !panelUrl || !apiKey}
                  className="btn btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>{isConnecting ? (language === 'de' ? 'Verbinde...' : 'Connecting...') : (language === 'de' ? 'Verbindung prüfen & Server laden' : 'Fetch Servers')}</span>
                </button>
              </div>
            </form>

            {/* Discovered Servers List */}
            {discoveredServers.length > 0 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ServerIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{language === 'de' ? '2. Zu importierendes Projekt auswählen' : '2. Select Project to Import'} ({discoveredServers.length} gefunden)</span>
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border border-[#30363d] rounded-xl p-2 bg-[#0d1117]">
                  {discoveredServers.map((s) => {
                    const isSelected = s.attributes.id === selectedServerId;
                    const port = s.attributes.relationships?.allocations?.data?.[0]?.attributes?.port || 'Auto';
                    return (
                      <div
                        key={s.attributes.id}
                        onClick={() => {
                          setSelectedServerId(s.attributes.id);
                          setOverrideName(s.attributes.name);
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500/60 shadow-sm'
                            : 'bg-[#161b22] border-[#30363d] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border ${isSelected ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-800/60 border-slate-700 text-slate-400'}`}>
                            <Radio className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>{s.attributes.name}</span>
                              <span className="text-[10px] font-mono text-slate-500">#{s.attributes.identifier}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Cpu className="w-3 h-3 text-slate-500" />
                                {s.attributes.limits.cpu}% CPU
                              </span>
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3 text-slate-500" />
                                {s.attributes.limits.memory} MB RAM
                              </span>
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3 text-slate-500" />
                                {s.attributes.limits.disk} MB Disk
                              </span>
                              <span>Port: {port}</span>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            Ausgewählt
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Target Configuration */}
                {selectedServer && (
                  <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/15 space-y-4">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 text-indigo-300">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{language === 'de' ? '3. Ziel-Cluster in PteroNext konfigurieren' : '3. Configure PteroNext Target'}</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="field-label text-xs">
                          {language === 'de' ? 'Instanzname in PteroNext' : 'Server Name in PteroNext'}
                        </label>
                        <input
                          type="text"
                          value={overrideName}
                          onChange={(e) => setOverrideName(e.target.value)}
                          placeholder={selectedServer.attributes.name}
                          className="input text-xs"
                        />
                      </div>

                      <div>
                        <label className="field-label text-xs">
                          {language === 'de' ? 'Ziel-Node (Cluster)' : 'Target Node'}
                        </label>
                        <select
                          value={targetNodeId}
                          onChange={(e) => setTargetNodeId(e.target.value)}
                          className="input text-xs"
                        >
                          <option value="0">Auto-Select (Best Cluster Match)</option>
                          {adminNodes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name} ({n.fqdn})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="field-label text-xs">
                          {language === 'de' ? 'Besitzer (Owner)' : 'Owner'}
                        </label>
                        <select
                          value={targetOwnerId}
                          onChange={(e) => setTargetOwnerId(e.target.value)}
                          className="input text-xs"
                        >
                          {adminUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username} ({u.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(false)}
                        className="btn btn-secondary px-3 py-1.5 text-xs"
                      >
                        {language === 'de' ? 'Abbrechen' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteImport}
                        disabled={isImporting}
                        className="btn btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30"
                      >
                        {isImporting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>{language === 'de' ? 'Migriere Server...' : 'Migrating Server...'}</span>
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            <span>{language === 'de' ? 'Server jetzt in PteroNext importieren' : 'Import Server Now'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: JSON / EGG UPLOAD */}
        {activeTab === 'json' && (
          <form onSubmit={handleJsonImport} className="space-y-4">
            <div className="p-4 rounded-xl border border-[#30363d] bg-[#161b22]/70 space-y-3">
              <label className="field-label text-xs">
                {language === 'de' ? 'Pterodactyl / Pelican / Hydrodactyl Egg JSON oder Projekt-Export einfügen:' : 'Paste Pterodactyl / Pelican / Hydrodactyl Egg or Project JSON:'}
              </label>
              <textarea
                rows={10}
                required
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                placeholder='{
  "_meta": {
    "version": "PTDL_v2"
  },
  "name": "PaperMC",
  "docker_images": {
    "Java 17": "ghcr.io/pterodactyl/yolks:java_17"
  },
  "startup": "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar"
}'
                className="input font-mono text-xs w-full resize-y"
              />
              <p className="text-[11px] text-slate-400">
                {language === 'de'
                  ? 'Unterstützt offizielle Pterodactyl Eggs, Parkervcp Eggs, Pelican Blueprints, Hydrodactyl Manifests und benutzerdefinierte Server-Templates.'
                  : 'Supports Pterodactyl Eggs, Pelican Blueprints, Hydrodactyl manifests and custom server manifests.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="btn btn-secondary px-3 py-1.5 text-xs"
              >
                {language === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmittingJson || !jsonContent.trim()}
                className="btn btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{isSubmittingJson ? 'Importiere...' : (language === 'de' ? 'JSON importieren' : 'Import JSON')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
