import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import {
  Compass,
  MapPin,
  Shield,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Info,
  Sliders,
  Sparkles,
  Crosshair,
} from 'lucide-react';

interface Chunk {
  x: number;
  z: number;
  status: string;
  biome: string;
  avg_height: number;
  color: string;
}

export const WorldRegionViewerTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [regionX, setRegionX] = useState(0);
  const [regionZ, setRegionZ] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);

  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [spawnPoint, setSpawnPoint] = useState({ x: 0, z: 0 });
  const [worldBorder, setWorldBorder] = useState({ center_x: 0, center_z: 0, size: 5000 });
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [hoveredChunk, setHoveredChunk] = useState<Chunk | null>(null);

  // Load Meta
  useEffect(() => {
    if (!selectedServer?.uuid) return;
    const loadMeta = async () => {
      try {
        const meta = await api.world.getMeta(selectedServer.uuid);
        if (meta) {
          setSpawnPoint(meta.spawn_point || { x: 0, z: 0 });
          setWorldBorder(meta.world_border || { center_x: 0, center_z: 0, size: 5000 });
          setAvailableRegions(meta.available_regions || []);
        }
      } catch (err) {
        console.warn('World meta load error:', err);
      }
    };
    loadMeta();
  }, [selectedServer?.uuid]);

  // Load Region Data
  const loadRegionData = async (rx: number, rz: number) => {
    if (!selectedServer?.uuid) return;
    setLoading(true);
    try {
      const res = await api.world.getRegion(selectedServer.uuid, rx, rz);
      if (res) {
        setChunks(res.chunks || []);
        if (res.spawn_point) setSpawnPoint(res.spawn_point);
        if (res.world_border) setWorldBorder(res.world_border);
      }
    } catch (err: any) {
      addToast({
        title: 'Fehler beim Laden',
        description: err.message || 'Region-Daten konnten nicht geladen werden',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegionData(regionX, regionZ);
  }, [selectedServer?.uuid, regionX, regionZ]);

  // Draw 2D Top-Down Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090d13';
    ctx.fillRect(0, 0, width, height);

    // Draw Subtle Grid
    ctx.strokeStyle = '#1e2530';
    ctx.lineWidth = 1;
    const gridSize = 32 * zoom;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const centerX = width / 2;
    const centerY = height / 2;

    // Render Chunks
    const chunkSize = 16 * zoom;
    chunks.forEach((chunk) => {
      // Chunk relative to current view
      const screenX = centerX + (chunk.x - regionX * 32 - 16) * chunkSize;
      const screenY = centerY + (chunk.z - regionZ * 32 - 16) * chunkSize;

      if (screenX >= -chunkSize && screenX <= width && screenY >= -chunkSize && screenY <= height) {
        ctx.fillStyle = chunk.color || '#5b8c32';
        ctx.fillRect(screenX, screenY, chunkSize - 1, chunkSize - 1);

        // Height shading
        if (chunk.avg_height > 70) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(screenX, screenY, chunkSize - 1, chunkSize - 1);
        } else if (chunk.avg_height < 60) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.fillRect(screenX, screenY, chunkSize - 1, chunkSize - 1);
        }
      }
    });

    // Render World Border Marker
    const borderRadius = (worldBorder.size / 2 / 16) * chunkSize;
    const borderScreenX = centerX + (worldBorder.center_x / 16 - regionX * 32) * chunkSize;
    const borderScreenY = centerY + (worldBorder.center_z / 16 - regionZ * 32) * chunkSize;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(
      borderScreenX - borderRadius,
      borderScreenY - borderRadius,
      borderRadius * 2,
      borderRadius * 2
    );
    ctx.setLineDash([]);

    // Render Spawn Point Marker (Compass Icon)
    const spawnScreenX = centerX + (spawnPoint.x / 16 - regionX * 32) * chunkSize;
    const spawnScreenY = centerY + (spawnPoint.z / 16 - regionZ * 32) * chunkSize;

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(spawnScreenX, spawnScreenY, 6 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center Crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();
  }, [chunks, zoom, regionX, regionZ, worldBorder, spawnPoint]);

  return (
    <div className="space-y-4">
      {/* Top Banner / Controls */}
      <div className="p-4 rounded-2xl bg-[#11141a] border border-[#30363d] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Minecraft Anvil 2D Region-Viewer</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                r.{regionX}.{regionZ}.mca
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Echtzeit-Extraktion von .mca Chunks, Biomen & Höhenprofilen direkt aus der Server-Welt.
            </p>
          </div>
        </div>

        {/* Region Coordinates & Zoom Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#0d1017] px-2.5 py-1.5 rounded-xl border border-[#30363d] text-xs font-mono">
            <span className="text-slate-500">Region:</span>
            <button
              onClick={() => setRegionX((x) => x - 1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300"
            >
              ◀
            </button>
            <span className="text-white font-bold">X:{regionX}</span>
            <button
              onClick={() => setRegionX((x) => x + 1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300"
            >
              ▶
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setRegionZ((z) => z - 1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300"
            >
              ◀
            </button>
            <span className="text-white font-bold">Z:{regionZ}</span>
            <button
              onClick={() => setRegionZ((z) => z + 1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300"
            >
              ▶
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#0d1017] p-1 rounded-xl border border-[#30363d]">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setRegionX(0);
                setRegionZ(0);
                setZoom(1);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
              title="Reset View"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => loadRegionData(regionX, regionZ)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Aktualisieren</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Canvas Container */}
      <div className="relative rounded-2xl bg-[#0d1017] border border-[#30363d] overflow-hidden shadow-2xl flex flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          width={800}
          height={520}
          className="w-full max-w-full h-auto cursor-crosshair block"
        />

        {/* Floating Live Markers Legend Overlay */}
        <div className="absolute top-4 left-4 p-3 rounded-xl bg-[#11141a]/90 backdrop-blur border border-[#30363d] text-xs font-mono space-y-2 pointer-events-none shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Marker</div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-white" />
            <span className="text-slate-300">
              Spawn: X: {spawnPoint.x}, Z: {spawnPoint.z}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 border border-dashed border-rose-500" />
            <span className="text-slate-300">
              World Border: {worldBorder.size} x {worldBorder.size}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
            <span className="text-slate-300">Chunks: {chunks.length} geladen</span>
          </div>
        </div>

        {/* Biome Legend Bottom Bar */}
        <div className="w-full bg-[#11141a]/95 border-t border-[#30363d] p-3 px-4 flex items-center justify-between gap-4 text-xs font-mono flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-500 text-[11px]">Biome Farbschema:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#5b8c32]" />
              <span className="text-slate-300">Plains</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2e6930]" />
              <span className="text-slate-300">Forest</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#8a8a8a]" />
              <span className="text-slate-300">Mountains</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#d8c47e]" />
              <span className="text-slate-300">Desert</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#284b7e]" />
              <span className="text-slate-300">Ocean</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Region r.{regionX}.{regionZ} · Koordinatenbereich [{(regionX * 32 * 16)} .. {((regionX + 1) * 32 * 16)}]
          </div>
        </div>
      </div>
    </div>
  );
};
