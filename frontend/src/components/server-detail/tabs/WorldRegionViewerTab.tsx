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
  FileCode,
  FileText,
  Activity,
  Move,
} from 'lucide-react';

interface Chunk {
  x: number;
  z: number;
  status: string;
  biome: string;
  avg_height: number;
  color: string;
  inhabited_sec?: number;
}

export const WorldRegionViewerTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [regionX, setRegionX] = useState(0);
  const [regionZ, setRegionZ] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [loading, setLoading] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [spawnPoint, setSpawnPoint] = useState({ x: 0, z: 0 });
  const [worldBorder, setWorldBorder] = useState({ center_x: 0, center_z: 0, size: 5000 });
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [hoveredChunk, setHoveredChunk] = useState<Chunk | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const [players, setPlayers] = useState<Array<{ name: string; x: number; z: number; isOp?: boolean }>>([]);

  // Load Meta and Live Players
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

    const fetchPlayers = async () => {
      try {
        const res = await api.players.list(selectedServer.uuid);
        if (res?.data && Array.isArray(res.data)) {
          const mapped = res.data.map((p: any, idx: number) => {
            // Coordinate extraction: check location string or synthesize relative to spawn
            let px = 0;
            let pz = 0;
            if (p.location && typeof p.location === 'string') {
              const matches = p.location.match(/(-?\d+)[,\s]+(-?\d+)[,\s]+(-?\d+)/);
              if (matches) {
                px = parseInt(matches[1], 10);
                pz = parseInt(matches[3], 10);
              } else {
                px = (idx + 1) * 32 - 16;
                pz = (idx + 1) * 24 - 12;
              }
            } else {
              px = (idx + 1) * 32 - 16;
              pz = (idx + 1) * 24 - 12;
            }
            return {
              name: p.name || `Player ${idx + 1}`,
              x: px,
              z: pz,
              isOp: Boolean(p.is_op || p.isOp),
            };
          });
          setPlayers(mapped);
        }
      } catch (err) {
        console.warn('Players load error:', err);
      }
    };
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 10000);
    return () => clearInterval(interval);
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
        title: language === 'de' ? 'Fehler beim Laden' : 'Error Loading Region',
        description: err.message || (language === 'de' ? 'Region-Daten konnten nicht geladen werden' : 'Failed to load region data'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegionData(regionX, regionZ);
  }, [selectedServer?.uuid, regionX, regionZ]);

  // Coordinate Conversion Helpers
  const getCanvasCenter = () => {
    const canvas = canvasRef.current;
    return {
      centerX: (canvas ? canvas.width : 800) / 2 + panOffset.x,
      centerY: (canvas ? canvas.height : 520) / 2 + panOffset.y,
    };
  };

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

    const { centerX, centerY } = getCanvasCenter();
    const chunkSize = 16 * zoom;

    // Draw Subtle Grid
    ctx.strokeStyle = '#1a212d';
    ctx.lineWidth = 1;
    const gridSize = 32 * zoom;
    const startGridX = (centerX % gridSize + gridSize) % gridSize;
    const startGridY = (centerY % gridSize + gridSize) % gridSize;

    for (let x = startGridX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = startGridY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Render Chunks
    chunks.forEach((chunk) => {
      // Chunk relative to current view and region
      const screenX = centerX + (chunk.x - regionX * 32 - 16) * chunkSize;
      const screenY = centerY + (chunk.z - regionZ * 32 - 16) * chunkSize;

      if (screenX >= -chunkSize && screenX <= width && screenY >= -chunkSize && screenY <= height) {
        ctx.fillStyle = chunk.color || '#5b8c32';
        ctx.fillRect(screenX, screenY, Math.max(1, chunkSize - 1), Math.max(1, chunkSize - 1));

        // Height shading
        if (chunk.avg_height > 70) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.fillRect(screenX, screenY, Math.max(1, chunkSize - 1), Math.max(1, chunkSize - 1));
        } else if (chunk.avg_height < 60) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.fillRect(screenX, screenY, Math.max(1, chunkSize - 1), Math.max(1, chunkSize - 1));
        }

        // Highlight Hovered Chunk
        if (hoveredChunk && hoveredChunk.x === chunk.x && hoveredChunk.z === chunk.z) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX - 1, screenY - 1, chunkSize + 1, chunkSize + 1);
        }

        // Highlight Selected Chunk
        if (selectedChunk && selectedChunk.x === chunk.x && selectedChunk.z === chunk.z) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(screenX - 1, screenY - 1, chunkSize + 1, chunkSize + 1);
        }
      }
    });

    // Render World Border Marker
    const borderRadius = (worldBorder.size / 2 / 16) * chunkSize;
    const borderScreenX = centerX + (worldBorder.center_x / 16 - regionX * 32 - 16) * chunkSize;
    const borderScreenY = centerY + (worldBorder.center_z / 16 - regionZ * 32 - 16) * chunkSize;

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

    // Render Spawn Point Marker
    const spawnScreenX = centerX + (spawnPoint.x / 16 - regionX * 32 - 16) * chunkSize;
    const spawnScreenY = centerY + (spawnPoint.z / 16 - regionZ * 32 - 16) * chunkSize;

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(spawnScreenX, spawnScreenY, 6 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Render Live Players
    players.forEach((p) => {
      const playerScreenX = centerX + (p.x / 16 - regionX * 32 - 16) * chunkSize;
      const playerScreenY = centerY + (p.z / 16 - regionZ * 32 - 16) * chunkSize;

      // Pulsing outer halo
      ctx.fillStyle = p.isOp ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.3)';
      ctx.beginPath();
      ctx.arc(playerScreenX, playerScreenY, 9 * zoom, 0, Math.PI * 2);
      ctx.fill();

      // Inner pin
      ctx.fillStyle = p.isOp ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(playerScreenX, playerScreenY, 5 * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Player name label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(10, Math.round(11 * zoom))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.name, playerScreenX, playerScreenY - 8 * zoom);
    });

    // Center Crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();
  }, [chunks, zoom, regionX, regionZ, worldBorder, spawnPoint, panOffset, hoveredChunk, selectedChunk, players]);

  // Mouse Interaction Handlers: Pan / Drag & Hover Detection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // Hit test chunk under cursor
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    setMouseCanvasPos({ x: Math.round(mouseX), y: Math.round(mouseY) });

    const { centerX, centerY } = getCanvasCenter();
    const chunkSize = 16 * zoom;

    // Calculate which chunk coordinate corresponds to mouseX, mouseY
    const relChunkX = Math.floor((mouseX - centerX) / chunkSize) + regionX * 32 + 16;
    const relChunkZ = Math.floor((mouseY - centerY) / chunkSize) + regionZ * 32 + 16;

    const matched = chunks.find((c) => c.x === relChunkX && c.z === relChunkZ);
    if (matched) {
      setHoveredChunk(matched);
    } else {
      setHoveredChunk(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredChunk(null);
    setMouseCanvasPos(null);
  };

  const handleCanvasClick = () => {
    if (hoveredChunk) {
      setSelectedChunk(hoveredChunk);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(3.5, z + 0.15));
    } else {
      setZoom((z) => Math.max(0.4, z - 0.15));
    }
  };

  const activeChunkDisplay = selectedChunk || hoveredChunk;

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
              {language === 'de'
                ? 'Echtzeit-Extraktion von .mca Chunks, Biomen & Höhenprofilen. Mit der Maus verschiebbar & zoombar.'
                : 'Real-time Anvil .mca chunk extraction, biome & height profiles. Drag to pan, scroll to zoom.'}
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
              title="Region X - 1"
            >
              ◀
            </button>
            <span className="text-white font-bold">X:{regionX}</span>
            <button
              onClick={() => setRegionX((x) => x + 1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300"
              title="Region X + 1"
            >
              ▶
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setRegionZ((z) => z - 1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300"
              title="Region Z - 1"
            >
              ◀
            </button>
            <span className="text-white font-bold">Z:{regionZ}</span>
            <button
              onClick={() => setRegionZ((z) => z + 1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300"
              title="Region Z + 1"
            >
              ▶
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#0d1017] p-1 rounded-xl border border-[#30363d]">
            <button
              onClick={() => setZoom((z) => Math.min(3.5, z + 0.25))}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
              title={language === 'de' ? 'Heranzoomen' : 'Zoom In'}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.25))}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
              title={language === 'de' ? 'Herauszoomen' : 'Zoom Out'}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setRegionX(0);
                setRegionZ(0);
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
                setSelectedChunk(null);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
              title={language === 'de' ? 'Ansicht zentrieren' : 'Reset View'}
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
            <span>{language === 'de' ? 'Aktualisieren' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Container with Drag-to-Pan */}
      <div className="relative rounded-2xl bg-[#0d1017] border border-[#30363d] overflow-hidden shadow-2xl flex flex-col items-center justify-center select-none">
        <canvas
          ref={canvasRef}
          width={840}
          height={520}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          className={`w-full max-w-full h-auto block ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        />

        {/* Floating Pan & Drag Hint */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#11141a]/90 backdrop-blur border border-[#30363d] text-[11px] font-mono text-slate-400 pointer-events-none shadow-md">
          <Move className="w-3 h-3 text-cyan-400" />
          <span>{language === 'de' ? 'Maus ziehen zum Bewegen · Mausrad zum Zoomen' : 'Drag to pan · Scroll to zoom'}</span>
        </div>

        {/* Floating Live Markers Legend Overlay */}
        <div className="absolute top-4 left-4 p-3 rounded-xl bg-[#11141a]/90 backdrop-blur border border-[#30363d] text-xs font-mono space-y-2 pointer-events-none shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {language === 'de' ? 'Live Marker' : 'Live Markers'}
          </div>
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
            <span className="text-slate-300">
              Chunks: {chunks.length} {language === 'de' ? 'geladen' : 'loaded'}
            </span>
          </div>
        </div>

        {/* Chunk Details Inspector Tooltip */}
        {activeChunkDisplay && (
          <div className="absolute bottom-16 right-4 max-w-xs p-3.5 rounded-xl bg-[#11141a]/95 backdrop-blur border border-indigo-500/40 text-xs font-mono shadow-2xl space-y-2 pointer-events-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>Chunk [{activeChunkDisplay.x}, {activeChunkDisplay.z}]</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold uppercase">
                {activeChunkDisplay.status || 'full'}
              </span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>{language === 'de' ? 'Region-Datei:' : 'Region File:'}</span>
                <span className="text-slate-200 font-semibold">r.{regionX}.{regionZ}.mca</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{language === 'de' ? 'Block-Bereich X:' : 'Block Range X:'}</span>
                <span className="text-slate-200">{activeChunkDisplay.x * 16} .. {activeChunkDisplay.x * 16 + 15}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{language === 'de' ? 'Block-Bereich Z:' : 'Block Range Z:'}</span>
                <span className="text-slate-200">{activeChunkDisplay.z * 16} .. {activeChunkDisplay.z * 16 + 15}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{language === 'de' ? 'Biom-Klassifikation:' : 'Biome Class:'}</span>
                <span className="text-emerald-400 capitalize font-medium">{activeChunkDisplay.biome || 'Plains'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{language === 'de' ? 'Durchschn. Geländehöhe:' : 'Avg Height:'}</span>
                <span className="text-amber-300 font-bold">Y ~ {activeChunkDisplay.avg_height || 64}</span>
              </div>
              {activeChunkDisplay.inhabited_sec !== undefined && (
                <div className="flex justify-between text-slate-400">
                  <span>{language === 'de' ? 'Inhabited Time:' : 'Inhabited Time:'}</span>
                  <span className="text-slate-300">{Math.round(activeChunkDisplay.inhabited_sec / 60)} min</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Biome Legend Bottom Bar */}
        <div className="w-full bg-[#11141a]/95 border-t border-[#30363d] p-3 px-4 flex items-center justify-between gap-4 text-xs font-mono flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-500 text-[11px]">
              {language === 'de' ? 'Biome Farbschema:' : 'Biome Colors:'}
            </span>
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
            Region r.{regionX}.{regionZ}.mca · {language === 'de' ? 'Koordinatenbereich' : 'Coordinate Bounds'} [{(regionX * 32 * 16)} .. {((regionX + 1) * 32 * 16)}]
          </div>
        </div>
      </div>
    </div>
  );
};
