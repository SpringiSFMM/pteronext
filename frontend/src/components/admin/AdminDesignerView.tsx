import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  Palette,
  Sparkles,
  Sliders,
  Check,
  Copy,
  Download,
  Upload,
  Eye,
  RefreshCw,
  Layers,
  Image as ImageIcon,
  Code,
  Zap,
  Globe,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { NebulaThemeConfig } from '../../types';

interface PresetTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  glow: 'none' | 'subtle' | 'high' | 'neon';
  surface: 'obsidian' | 'midnight' | 'charcoal' | 'pitch_black';
  radius: number;
  bg: 'ambient' | 'matrix' | 'oled' | 'clean';
  badge: string;
}

const PRESET_THEMES: PresetTheme[] = [
  {
    id: 'nebula',
    name: 'Nebula Deep Space',
    primary: '#8b5cf6',
    secondary: '#3b82f6',
    glow: 'high',
    surface: 'midnight',
    radius: 14,
    bg: 'ambient',
    badge: 'Popular',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    primary: '#06b6d4',
    secondary: '#f43f5e',
    glow: 'neon',
    surface: 'obsidian',
    radius: 10,
    bg: 'matrix',
    badge: 'High Contrast',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Zinc',
    primary: '#f4f4f5',
    secondary: '#71717a',
    glow: 'subtle',
    surface: 'obsidian',
    radius: 12,
    bg: 'clean',
    badge: 'Linear Style',
  },
  {
    id: 'emerald',
    name: 'Emerald Horizon',
    primary: '#10b981',
    secondary: '#059669',
    glow: 'high',
    surface: 'obsidian',
    radius: 12,
    bg: 'ambient',
    badge: 'Clean Forest',
  },
  {
    id: 'sapphire',
    name: 'Royal Sapphire',
    primary: '#065cfe',
    secondary: '#25a9ff',
    glow: 'high',
    surface: 'midnight',
    radius: 14,
    bg: 'ambient',
    badge: 'Enterprise',
  },
  {
    id: 'amber',
    name: 'Amber Solar Flame',
    primary: '#f59e0b',
    secondary: '#d97706',
    glow: 'high',
    surface: 'obsidian',
    radius: 12,
    bg: 'ambient',
    badge: 'Warm Solar',
  },
  {
    id: 'matrix',
    name: 'Matrix Phosphor',
    primary: '#22c55e',
    secondary: '#15803d',
    glow: 'neon',
    surface: 'pitch_black',
    radius: 6,
    bg: 'matrix',
    badge: 'CRT Terminal',
  },
  {
    id: 'crimson',
    name: 'Crimson Redline',
    primary: '#ef4444',
    secondary: '#991b1b',
    glow: 'high',
    surface: 'obsidian',
    radius: 10,
    bg: 'ambient',
    badge: 'Bold Action',
  },
];

const DEFAULT_CONFIG: NebulaThemeConfig = {
  primaryAccent: '#6366f1',
  secondaryAccent: '#a855f7',
  accentGlow: 'high',
  surfaceTone: 'obsidian',
  borderRadius: 14,
  backgroundStyle: 'ambient',
  backgroundImageUrl: '',
  backgroundOpacity: 0.25,
  panelLogoUrl: '',
  panelFaviconUrl: '',
  panelTitle: 'PteroNext',
  customCss: '',
  iconStyle: 'rounded',
};

export const AdminDesignerView: React.FC = () => {
  const { addToast } = useApp();
  const { language } = useTranslation();
  const isDe = language === 'de';

  const [activeTab, setActiveTab] = useState<'presets' | 'colors' | 'atmosphere' | 'branding' | 'css'>('presets');
  const [config, setConfig] = useState<NebulaThemeConfig>(() => {
    try {
      const saved = localStorage.getItem('pteronext_global_theme_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CONFIG;
  });

  const [isSaved, setIsSaved] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  // Apply theme to document variables in real time for instant live preview
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-accent', config.primaryAccent);
    
    // Dynamic glow
    const glowColor =
      config.accentGlow === 'none'
        ? 'transparent'
        : config.accentGlow === 'subtle'
        ? `${config.primaryAccent}40`
        : config.accentGlow === 'neon'
        ? `${config.primaryAccent}cc`
        : `${config.primaryAccent}80`;

    root.style.setProperty('--theme-accent-glow', glowColor);
    root.style.setProperty('--theme-secondary', config.secondaryAccent);
    root.style.setProperty('--theme-radius', `${config.borderRadius}px`);

    // Injected custom CSS
    let styleTag = document.getElementById('pteronext-global-custom-css') as HTMLStyleElement | null;
    if (config.customCss?.trim()) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'pteronext-global-custom-css';
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = config.customCss;
    } else if (styleTag) {
      styleTag.remove();
    }
  }, [config]);

  const handleApplyPreset = (preset: PresetTheme) => {
    setConfig((prev) => ({
      ...prev,
      primaryAccent: preset.primary,
      secondaryAccent: preset.secondary,
      accentGlow: preset.glow,
      surfaceTone: preset.surface,
      borderRadius: preset.radius,
      backgroundStyle: preset.bg,
    }));
    addToast({
      title: isDe ? 'Preset geladen' : 'Preset Loaded',
      description: `${preset.name} ${isDe ? 'wurde in die Vorschau übernommen.' : 'applied to live preview.'}`,
      type: 'info',
    });
  };

  const handleSaveGlobal = () => {
    try {
      localStorage.setItem('pteronext_global_theme_config', JSON.stringify(config));
      localStorage.setItem('pteronext_theme_accent', config.primaryAccent);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);

      addToast({
        title: isDe ? 'Theme global gespeichert' : 'Theme Saved Globally',
        description: isDe
          ? 'Das Design wurde als Standard für das gesamte Panel angewendet.'
          : 'Theme configurations set as global defaults for all users.',
        type: 'success',
      });
    } catch {
      addToast({
        title: 'Error',
        description: 'Failed to persist theme settings.',
        type: 'error',
      });
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    addToast({
      title: isDe ? 'Standard wiederhergestellt' : 'Restored Defaults',
      description: isDe ? 'Alle Werte wurden zurückgesetzt.' : 'Theme values reset to default.',
      type: 'info',
    });
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(config, null, 2);
    navigator.clipboard?.writeText(jsonStr);
    setCopiedExport(true);
    addToast({
      title: isDe ? 'Theme exportiert' : 'Theme Exported',
      description: isDe ? 'JSON-Konfiguration in Zwischenablage kopiert.' : 'JSON copied to clipboard.',
      type: 'success',
    });
    setTimeout(() => setCopiedExport(false), 2000);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importText);
      if (parsed && typeof parsed === 'object') {
        setConfig((prev) => ({ ...prev, ...parsed }));
        setImportModalOpen(false);
        setImportText('');
        addToast({
          title: isDe ? 'Theme erfolgreich importiert' : 'Theme Successfully Imported',
          description: isDe ? 'Neue Einstellungen wurden angewendet.' : 'Imported theme settings applied.',
          type: 'success',
        });
      }
    } catch {
      addToast({
        title: isDe ? 'Ungültiges JSON' : 'Invalid JSON',
        description: isDe ? 'Bitte überprüfe den eingegebenen Code.' : 'Please check your JSON format.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 view-enter max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-slate-800 relative overflow-hidden shadow-xl bg-gradient-to-r from-[#161b22]/95 via-[#1c2230]/80 to-[#161b22]/95">
        <div
          className="absolute top-0 right-0 w-80 h-40 rounded-full blur-3xl pointer-events-none opacity-40 transition-all duration-500"
          style={{ backgroundColor: config.primaryAccent }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-64 h-32 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-500"
          style={{ backgroundColor: config.secondaryAccent }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 shadow-lg transition-all duration-300"
              style={{
                backgroundColor: `${config.primaryAccent}15`,
                borderColor: `${config.primaryAccent}40`,
                color: config.primaryAccent,
                boxShadow: `0 0 20px ${config.primaryAccent}30`,
              }}
            >
              <Palette className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  ADMIN ONLY
                </span>
                <span className="text-[11px] font-mono text-slate-400 bg-[#0d1117] px-2.5 py-0.5 rounded-full border border-slate-800">
                  Nebula Engine
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-sans">
                {isDe ? 'Nebula Theme & Panel Designer' : 'Nebula Theme & Panel Designer'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                {isDe
                  ? 'Verwalte das globale Panel-Design wie im Nebula-Designer: Farben, Akzent-Glow, Eckenrundungen, Wallpaper und Custom CSS zentral für alle Benutzer.'
                  : 'Customize the global panel interface: theme accents, glow effects, borders, background atmosphere, and custom CSS for all users.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono transition-colors flex items-center gap-1.5"
              title="Auf Standard zurücksetzen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isDe ? 'Reset' : 'Reset'}</span>
            </button>

            <button
              onClick={handleExport}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono transition-colors flex items-center gap-1.5"
              title="JSON-Konfiguration exportieren"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{copiedExport ? (isDe ? 'Kopiert!' : 'Copied!') : 'Export'}</span>
            </button>

            <button
              onClick={() => setImportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>

            <button
              onClick={handleSaveGlobal}
              className="px-4 py-2 rounded-xl text-white text-xs font-mono font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer"
              style={{
                backgroundColor: config.primaryAccent,
                boxShadow: `0 0 20px ${config.primaryAccent}50`,
              }}
            >
              {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{isSaved ? (isDe ? 'Gespeichert!' : 'Saved!') : isDe ? 'Global Speichern' : 'Save Globally'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#161b22] border border-slate-800 rounded-xl overflow-x-auto">
        {[
          { id: 'presets', label: isDe ? '1-Klick Presets' : '1-Click Presets', icon: Sparkles },
          { id: 'colors', label: isDe ? 'Farben & Akzente' : 'Colors & Glow', icon: Palette },
          { id: 'atmosphere', label: isDe ? 'Hintergrund & Formen' : 'Atmosphere & Radius', icon: Sliders },
          { id: 'branding', label: isDe ? 'Logo & Branding' : 'Branding & Logo', icon: Globe },
          { id: 'css', label: isDe ? 'Custom CSS Code' : 'Custom CSS Code', icon: Code },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-800 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: isActive ? config.primaryAccent : undefined }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Control Panel + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* TAB 1: 1-Click Presets */}
          {activeTab === 'presets' && (
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  {isDe ? 'Inspirierte Theme Presets' : 'Pre-Engineered Presets'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isDe
                    ? 'Wähle ein vorkonfiguriertes Farb- und Glow-Design mit 1 Klick aus.'
                    : 'Apply ready-to-use color schemes and glow atmospheres instantly.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {PRESET_THEMES.map((preset) => {
                  const isCurrent =
                    config.primaryAccent.toLowerCase() === preset.primary.toLowerCase() &&
                    config.secondaryAccent.toLowerCase() === preset.secondary.toLowerCase();

                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 relative group flex flex-col justify-between gap-3 ${
                        isCurrent
                          ? 'bg-slate-800/80 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/50'
                          : 'bg-[#161b22] hover:bg-slate-800/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-white text-xs font-mono flex items-center gap-1.5">
                          {preset.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                          {preset.badge}
                        </span>
                      </div>

                      <div className="flex items-center justify-between w-full pt-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: preset.secondary }}
                          />
                          <span className="text-[10px] font-mono text-slate-400 ml-1">
                            {preset.radius}px • {preset.glow}
                          </span>
                        </div>

                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Aktiv</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Colors & Accents */}
          {activeTab === 'colors' && (
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  {isDe ? 'Farbpalette & Akzent-Glow' : 'Color Palette & Glow'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isDe
                    ? 'Stelle die primäre und sekundäre Akzentfarbe des gesamten Interfaces ein.'
                    : 'Fine-tune primary and secondary UI colors.'}
                </p>
              </div>

              {/* Primary Color Picker */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-300 font-bold flex items-center justify-between">
                  <span>{isDe ? 'Primäre Akzentfarbe (Buttons, Highlights, Rahmen)' : 'Primary Accent Color'}</span>
                  <span className="font-mono text-slate-400">{config.primaryAccent}</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.primaryAccent}
                    onChange={(e) => setConfig({ ...config, primaryAccent: e.target.value })}
                    className="w-12 h-10 rounded-xl bg-[#0d1117] border border-slate-700 cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={config.primaryAccent}
                    onChange={(e) => setConfig({ ...config, primaryAccent: e.target.value })}
                    className="w-36 h-10 bg-[#0d1117] border border-slate-700 rounded-xl px-3 font-mono text-xs text-white uppercase focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['#6366f1', '#065cfe', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f4f4f5'].map((hex) => (
                      <button
                        key={hex}
                        onClick={() => setConfig({ ...config, primaryAccent: hex })}
                        className="w-6 h-6 rounded-lg border border-white/20 transition-transform hover:scale-110"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Secondary Color Picker */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-mono text-slate-300 font-bold flex items-center justify-between">
                  <span>{isDe ? 'Sekundäre Farbe (Gradienten & Begleitglanz)' : 'Secondary Accent Color'}</span>
                  <span className="font-mono text-slate-400">{config.secondaryAccent}</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.secondaryAccent}
                    onChange={(e) => setConfig({ ...config, secondaryAccent: e.target.value })}
                    className="w-12 h-10 rounded-xl bg-[#0d1117] border border-slate-700 cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={config.secondaryAccent}
                    onChange={(e) => setConfig({ ...config, secondaryAccent: e.target.value })}
                    className="w-36 h-10 bg-[#0d1117] border border-slate-700 rounded-xl px-3 font-mono text-xs text-white uppercase focus:outline-none"
                  />
                </div>
              </div>

              {/* Glow Intensity */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-mono text-slate-300 font-bold block">
                  {isDe ? 'Ambient Glow Intensität' : 'Ambient Glow Intensity'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['none', 'subtle', 'high', 'neon'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setConfig({ ...config, accentGlow: level })}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono capitalize transition-all ${
                        config.accentGlow === level
                          ? 'bg-slate-800 text-white border-indigo-500 font-bold shadow-md'
                          : 'bg-[#0d1117] text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Atmosphere & Radius */}
          {activeTab === 'atmosphere' && (
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  {isDe ? 'Formen, Ecken & Hintergrund-Effekt' : 'Border Radius & Wallpaper'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isDe
                    ? 'Passe Eckenrundungen der Karten und Buttons an sowie dynamische Hintergründe.'
                    : 'Adjust border radius curves and custom wallpapers.'}
                </p>
              </div>

              {/* Border Radius Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-300">{isDe ? 'Eckenrundung (Border-Radius)' : 'Border Radius'}</span>
                  <span className="text-indigo-400 font-bold">{config.borderRadius}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="24"
                  step="2"
                  value={config.borderRadius}
                  onChange={(e) => setConfig({ ...config, borderRadius: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Sharp (2px)</span>
                  <span>Balanced (10px)</span>
                  <span>Modern (14px)</span>
                  <span>Ultra-Pill (24px)</span>
                </div>
              </div>

              {/* Background Style */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-mono text-slate-300 font-bold block">
                  {isDe ? 'Hintergrund-Atmosphäre' : 'Background Atmosphere'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'ambient', label: 'Dynamic Glow', desc: 'Fließende Farbnebel' },
                    { id: 'matrix', label: 'Cyber Grid', desc: 'Perspektiven-Raster' },
                    { id: 'oled', label: 'Pure OLED', desc: '#000000 Schwarz' },
                    { id: 'clean', label: 'Classic Dark', desc: 'Neutrales Dunkel' },
                    { id: 'custom_image', label: 'Custom Wallpaper', desc: 'Eigenes Bild URL' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setConfig({ ...config, backgroundStyle: bg.id as any })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        config.backgroundStyle === bg.id
                          ? 'bg-slate-800 text-white border-indigo-500 font-bold shadow-md'
                          : 'bg-[#0d1117] text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-mono block text-white">{bg.label}</span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{bg.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Image URL if selected */}
              {config.backgroundStyle === 'custom_image' && (
                <div className="space-y-3 pt-2 p-4 rounded-xl bg-[#0d1117] border border-slate-800">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300 block">
                      {isDe ? 'Wallpaper Bild-URL (HTTPS)' : 'Wallpaper Image URL'}
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/wallpaper.jpg"
                      value={config.backgroundImageUrl || ''}
                      onChange={(e) => setConfig({ ...config, backgroundImageUrl: e.target.value })}
                      className="w-full bg-[#161b22] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-slate-400">
                      <span>Deckkraft (Opacity)</span>
                      <span>{Math.round((config.backgroundOpacity || 0.25) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1.0"
                      step="0.05"
                      value={config.backgroundOpacity || 0.25}
                      onChange={(e) => setConfig({ ...config, backgroundOpacity: Number(e.target.value) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Branding & Logo */}
          {activeTab === 'branding' && (
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  {isDe ? 'Custom Logo & Seitentitel' : 'Logo & Panel Title'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isDe
                    ? 'Verpasse deinem Panel ein individuelles Branding mit eigenem Logo und Titel.'
                    : 'Personalize panel branding and headers.'}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">
                    {isDe ? 'Panel Brand Titel' : 'Panel Title'}
                  </label>
                  <input
                    type="text"
                    placeholder="PteroNext Cloud"
                    value={config.panelTitle || ''}
                    onChange={(e) => setConfig({ ...config, panelTitle: e.target.value })}
                    className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">
                    {isDe ? 'Custom Logo URL (PNG / SVG)' : 'Custom Logo URL (PNG / SVG)'}
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={config.panelLogoUrl || ''}
                    onChange={(e) => setConfig({ ...config, panelLogoUrl: e.target.value })}
                    className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">
                    {isDe ? 'Custom Favicon URL' : 'Custom Favicon URL'}
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/favicon.ico"
                    value={config.panelFaviconUrl || ''}
                    onChange={(e) => setConfig({ ...config, panelFaviconUrl: e.target.value })}
                    className="w-full bg-[#0d1117] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Custom CSS */}
          {activeTab === 'css' && (
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    {isDe ? 'Globales Custom CSS' : 'Global Custom CSS'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isDe
                      ? 'Wird live in den Header injiziert und gilt für alle Panel-Nutzer.'
                      : 'Directly injected into document head for all users.'}
                  </p>
                </div>
                <Code className="w-4 h-4 text-indigo-400" />
              </div>

              <textarea
                rows={10}
                placeholder="/* Füge hier benutzerdefiniertes CSS ein */&#10;.glass-panel {&#10;  border-color: rgba(255, 255, 255, 0.15);&#10;}"
                value={config.customCss || ''}
                onChange={(e) => setConfig({ ...config, customCss: e.target.value })}
                className="w-full bg-[#0d1117] border border-slate-700 rounded-xl p-3 font-mono text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
              />
            </div>
          )}
        </div>

        {/* Right Column: Live Interactive Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-24">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" style={{ color: config.primaryAccent }} />
              <span>{isDe ? 'Live-Vorschau der UI-Elemente' : 'Live UI Component Preview'}</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Echtzeit
            </span>
          </div>

          {/* Preview Canvas */}
          <div
            className="p-5 rounded-2xl border bg-[#0d1117] space-y-4 shadow-2xl relative overflow-hidden transition-all duration-300"
            style={{
              borderRadius: `${config.borderRadius}px`,
              borderColor: `${config.primaryAccent}40`,
              boxShadow: `0 10px 30px ${config.primaryAccent}15`,
            }}
          >
            {/* Ambient Corner Glow */}
            <div
              className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-2xl pointer-events-none opacity-30"
              style={{ backgroundColor: config.primaryAccent }}
            />

            {/* Preview Card Header */}
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
              <div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide border inline-block mb-1"
                  style={{
                    backgroundColor: `${config.primaryAccent}15`,
                    color: config.primaryAccent,
                    borderColor: `${config.primaryAccent}30`,
                  }}
                >
                  MINECRAFT PAPER
                </span>
                <h4 className="text-sm font-bold text-white font-sans">
                  {config.panelTitle || 'PteroNext'} Survival Node
                </h4>
                <p className="text-[11px] text-slate-400 font-mono">127.0.0.1:25565</p>
              </div>

              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>

            {/* Telemetry Progress Bar with Active Accent */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Memory Allocation</span>
                <span className="text-white font-bold">4.2 GB / 8.0 GB</span>
              </div>
              <div className="w-full bg-[#161b22] h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: '52%',
                    backgroundColor: config.primaryAccent,
                    boxShadow: `0 0 10px ${config.primaryAccent}`,
                  }}
                />
              </div>
            </div>

            {/* Interactive Buttons with configured border-radius */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                className="flex-1 py-2 px-3 text-xs font-mono font-bold text-white transition-all shadow-md active:scale-95"
                style={{
                  backgroundColor: config.primaryAccent,
                  borderRadius: `${Math.max(4, config.borderRadius - 2)}px`,
                  boxShadow: `0 0 14px ${config.primaryAccent}40`,
                }}
              >
                Primary Button
              </button>
              <button
                type="button"
                className="py-2 px-3 text-xs font-mono font-medium text-slate-300 bg-slate-800 hover:text-white border border-slate-700 transition-colors"
                style={{
                  borderRadius: `${Math.max(4, config.borderRadius - 2)}px`,
                }}
              >
                Secondary
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>{isDe ? 'Theme Konfiguration importieren' : 'Import Theme JSON'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isDe
                ? 'Füge hier die exportierte JSON-Theme-Konfiguration ein:'
                : 'Paste your exported theme JSON configuration below:'}
            </p>
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <textarea
                rows={6}
                required
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{ "primaryAccent": "#8b5cf6", "accentGlow": "high", ... }'
                className="w-full bg-[#0d1117] border border-slate-700 rounded-xl p-3 font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-mono"
                >
                  {isDe ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold"
                >
                  {isDe ? 'Importieren' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
