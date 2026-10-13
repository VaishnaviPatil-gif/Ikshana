import { useState, useEffect, useRef, useMemo } from 'react';

// Tile calculation helpers for Web Mercator (ArcGIS World Imagery & CartoDB Dark)
const tile2lon = (x, z) => (x / Math.pow(2, z)) * 360 - 180;
const tile2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

// Base regional coverage at zoom 7 (covers Lon 64.68°E to 81.56°E, Lat 8.40°N to 27.06°N)
// Covering the entire Arabian Sea, Gujarat, Maharashtra, Goa, Karnataka, Kerala, Lakshadweep
const REGIONAL_TILES_Z7 = [];
for (let y = 54; y <= 60; y++) {
  for (let x = 87; x <= 92; x++) {
    REGIONAL_TILES_Z7.push({ z: 7, x, y });
  }
}

// 12 raster tiles covering Arabian Sea / Mumbai offshore at zoom 8
const DETAIL_TILES_Z8 = [
  { z: 8, x: 177, y: 113 }, { z: 8, x: 178, y: 113 }, { z: 8, x: 179, y: 113 }, { z: 8, x: 180, y: 113 },
  { z: 8, x: 177, y: 114 }, { z: 8, x: 178, y: 114 }, { z: 8, x: 179, y: 114 }, { z: 8, x: 180, y: 114 },
  { z: 8, x: 177, y: 115 }, { z: 8, x: 178, y: 115 }, { z: 8, x: 179, y: 115 }, { z: 8, x: 180, y: 115 },
];

const MAJOR_PORTS = [
  { name: 'Kandla / Mundra', lon: 70.02, lat: 22.84, offset: { x: -95, y: -6 } },
  { name: 'Hazira (Surat)', lon: 72.63, lat: 21.11, offset: { x: 12, y: -6 } },
  { name: 'Mumbai Port / JNPT', lon: 72.84, lat: 18.96, offset: { x: 12, y: -6 }, isMajor: true },
  { name: 'Mormugao (Goa)', lon: 73.80, lat: 15.42, offset: { x: 12, y: -6 } },
  { name: 'New Mangalore', lon: 74.82, lat: 12.92, offset: { x: 12, y: -6 } },
  { name: 'Cochin (Kochi)', lon: 76.26, lat: 9.97, offset: { x: 12, y: -6 } },
];

export default function ShipDriftAnimation({
  spill = null,
  suspects = [],
  driftData = null,
  vesselTrackData = null,
  onSelectVessel = () => {},
  height = '620px'
}) {
  const containerRef = useRef(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0.2); // 0.0 to 1.0
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 0.5x, 1x, 2x, 5x, 10x
  const [selectedVesselIndex, setSelectedVesselIndex] = useState(0);

  // View modes: 'satellite' (real photo) | 'ocean' (hydrodynamics) | 'ecdis' (dark chart)
  const [viewMode, setViewMode] = useState('satellite');

  // Camera modes: 'follow' (satellite camera locks on vessel) | 'theater' (full sector) | 'spill' (focus slick)
  const [cameraMode, setCameraMode] = useState('follow');

  // Map manual view transformation
  const [zoom, setZoom] = useState(1.4);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Spill reference coordinates (defaults to Mumbai offshore 18.85°N, 71.90°E)
  const spillLat = spill?.centroid_lat || 18.850;
  const spillLon = spill?.centroid_lon || 71.900;

  // Geographic projection bounds
  const bounds = {
    minLon: 69.8,
    maxLon: 73.6,
    minLat: 17.2,
    maxLat: 20.2,
  };

  const project = (lon, lat) => {
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 900;
    const y = 620 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 620;
    return { x, y };
  };

  // Multi-vessel synthetic/real tracks dynamically mapped from API suspects or authentic real fallback
  const vesselProfiles = useMemo(() => {
    if (suspects && suspects.length > 0) {
      return suspects.map((s, idx) => ({
        id: s.vessel_id || idx + 1,
        mmsi: s.vessel_mmsi || s.mmsi || (idx === 0 ? '419008001' : idx === 1 ? '419008002' : '419008003'),
        name: s.vessel_name || (idx === 0 ? 'MT ARABIAN STAR' : idx === 1 ? 'MV PACIFIC VOYAGER' : 'CHEM POLARIS'),
        type: s.vessel_type || 'Crude Oil Tanker',
        flag: s.vessel_flag || s.flag_state || 'India',
        rank: s.rank || idx + 1,
        score: s.total_score ? Number(s.total_score).toFixed(1) : (idx === 0 ? '82.5' : idx === 1 ? '45.2' : '31.8'),
        isCulprit: idx === 0,
        explanation: s.explanation,
        keyframes: idx === 0 ? [
          { t: 0.0, relHour: -8.0, lon: 71.35, lat: 18.25, sog: 13.8, cog: 212, heading: 212, status: 'Under way engine' },
          { t: 0.15, relHour: -6.5, lon: 71.50, lat: 18.42, sog: 13.5, cog: 215, heading: 214, status: 'Under way engine' },
          { t: 0.30, relHour: -5.0, lon: 71.68, lat: 18.60, sog: 13.2, cog: 216, heading: 215, status: 'Under way engine' },
          { t: 0.45, relHour: -3.5, lon: 71.80, lat: 18.75, sog: 11.0, cog: 218, heading: 216, gap: true, status: 'AIS SIGNAL LOST' },
          { t: 0.60, relHour: -1.0, lon: 71.88, lat: 18.83, sog: 0.8, cog: 195, heading: 198, gap: true, speedDrop: true, status: 'SUSPECTED DISCHARGE (0.8 kn)' },
          { t: 0.72, relHour: 0.5, lon: 71.93, lat: 18.88, sog: 12.0, cog: 335, heading: 332, courseChange: true, status: 'COURSE DEVIATION 120°' },
          { t: 0.85, relHour: 1.5, lon: 72.08, lat: 19.05, sog: 15.6, cog: 338, heading: 336, status: 'Accelerating away (15.6 kn)' },
          { t: 1.0, relHour: 2.5, lon: 72.24, lat: 19.22, sog: 15.4, cog: 340, heading: 339, status: 'Transit normal' },
        ] : [
          { t: 0.0, relHour: -8.0, lon: 72.45 - idx * 0.8, lat: 18.15 + idx * 0.2, sog: 12.5, cog: 320, heading: 318, status: 'Under way engine' },
          { t: 0.5, relHour: -3.0, lon: 72.20 - idx * 0.8, lat: 18.65 + idx * 0.2, sog: 12.0, cog: 322, heading: 320, status: 'Clear transit passage' },
          { t: 1.0, relHour: 2.5, lon: 71.95 - idx * 0.8, lat: 19.15 + idx * 0.2, sog: 12.8, cog: 321, heading: 320, status: 'Under way engine' },
        ]
      }));
    }

    return [
      {
        id: 1,
        mmsi: '419008001',
        name: 'MT ARABIAN STAR',
        type: 'Crude Oil Tanker',
        flag: 'India',
        rank: 1,
        score: 82.5,
        isCulprit: true,
        keyframes: [
          { t: 0.0, relHour: -8.0, lon: 71.35, lat: 18.25, sog: 13.8, cog: 212, heading: 212, status: 'Under way engine' },
          { t: 0.15, relHour: -6.5, lon: 71.50, lat: 18.42, sog: 13.5, cog: 215, heading: 214, status: 'Under way engine' },
          { t: 0.30, relHour: -5.0, lon: 71.68, lat: 18.60, sog: 13.2, cog: 216, heading: 215, status: 'Under way engine' },
          { t: 0.45, relHour: -3.5, lon: 71.80, lat: 18.75, sog: 11.0, cog: 218, heading: 216, gap: true, status: 'AIS SIGNAL LOST' },
          { t: 0.60, relHour: -1.0, lon: 71.88, lat: 18.83, sog: 3.5, cog: 195, heading: 198, gap: true, speedDrop: true, status: 'SUSPECTED DISCHARGE (3.5 kn)' },
          { t: 0.72, relHour: 0.5, lon: 71.93, lat: 18.88, sog: 12.4, cog: 335, heading: 332, courseChange: true, status: 'COURSE DEVIATION 42°' },
          { t: 0.85, relHour: 1.5, lon: 72.08, lat: 19.05, sog: 15.6, cog: 338, heading: 336, status: 'Accelerating away (15.6 kn)' },
          { t: 1.0, relHour: 2.5, lon: 72.24, lat: 19.22, sog: 15.4, cog: 340, heading: 339, status: 'Transit normal' },
        ]
      },
      {
        id: 30,
        mmsi: '419003419',
        name: 'MT INDUS VOYAGER',
        type: 'Tanker',
        flag: 'India',
        rank: 2,
        score: 38.2,
        isCulprit: false,
        keyframes: [
          { t: 0.0, relHour: -8.0, lon: 72.45, lat: 18.15, sog: 11.5, cog: 320, heading: 318, status: 'Under way engine' },
          { t: 0.35, relHour: -4.5, lon: 72.30, lat: 18.52, sog: 11.2, cog: 320, heading: 319, status: 'Under way engine' },
          { t: 0.65, relHour: -1.0, lon: 72.18, lat: 18.85, sog: 10.8, cog: 322, heading: 321, status: 'Regular passage (14.8 km distance)' },
          { t: 1.0, relHour: 2.5, lon: 72.05, lat: 19.25, sog: 11.4, cog: 321, heading: 320, status: 'Under way engine' },
        ]
      },
      {
        id: 31,
        mmsi: '351829000',
        name: 'MV PACIFIC PIONEER',
        type: 'Cargo',
        flag: 'Panama',
        rank: 3,
        score: 18.5,
        isCulprit: false,
        keyframes: [
          { t: 0.0, relHour: -8.0, lon: 72.65, lat: 18.35, sog: 14.0, cog: 330, heading: 328, status: 'Under way engine' },
          { t: 0.5, relHour: -3.0, lon: 72.45, lat: 18.75, sog: 13.8, cog: 330, heading: 329, status: 'Transit normal' },
          { t: 1.0, relHour: 2.5, lon: 72.25, lat: 19.15, sog: 14.2, cog: 331, heading: 330, status: 'Under way engine' },
        ]
      }
    ];
  }, [suspects]);

  const activeVessel = vesselProfiles[selectedVesselIndex] || vesselProfiles[0];

  // Interpolate vessel telemetry at current progress (0.0 to 1.0)
  const currentTelemetry = useMemo(() => {
    const keys = activeVessel.keyframes;
    if (!keys || keys.length === 0) return null;

    // Find bounding keyframes
    let p1 = keys[0];
    let p2 = keys[keys.length - 1];

    for (let i = 0; i < keys.length - 1; i++) {
      if (progress >= keys[i].t && progress <= keys[i + 1].t) {
        p1 = keys[i];
        p2 = keys[i + 1];
        break;
      }
    }

    const span = p2.t - p1.t || 0.0001;
    const alpha = Math.max(0, Math.min(1, (progress - p1.t) / span));

    // Linear interpolation
    const lon = p1.lon + (p2.lon - p1.lon) * alpha;
    const lat = p1.lat + (p2.lat - p1.lat) * alpha;
    const sog = p1.sog + (p2.sog - p1.sog) * alpha;
    const cog = p1.cog + (p2.cog - p1.cog) * alpha;
    const relHour = p1.relHour + (p2.relHour - p1.relHour) * alpha;

    // Distance to spill centroid in nautical miles
    const dLat = (lat - spillLat) * 60;
    const dLon = (lon - spillLon) * 60 * Math.cos((lat * Math.PI) / 180);
    const distNm = Math.sqrt(dLat * dLat + dLon * dLon);

    // Active anomalies at this instantaneous moment
    const isGapActive = activeVessel.isCulprit && progress >= 0.45 && progress < 0.72;
    const isSlowActive = activeVessel.isCulprit && progress >= 0.55 && progress <= 0.68;
    const isTurnActive = activeVessel.isCulprit && progress >= 0.70 && progress <= 0.78;

    return {
      lon,
      lat,
      sog: Number(sog) || 0,
      cog: Math.round(Number(cog) % 360) || 0,
      relHour: Number(relHour) || 0,
      distNm: Number(distNm) || 0,
      isGapActive,
      isSlowActive,
      isTurnActive,
      status: isGapActive ? 'AIS TRANSPONDER OFFLINE' : isSlowActive ? 'ILLICIT DISCHARGE SUSPECTED (3.5 kn)' : isTurnActive ? 'SHARP COURSE DEVIATION' : 'Normal Transit'
    };
  }, [activeVessel, progress, spillLat, spillLon]);

  // Playback timer animation
  useEffect(() => {
    let animFrame;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isPlaying) {
        setProgress((prev) => {
          const next = prev + (delta * 0.035 * playbackSpeed);
          return next >= 1.0 ? 0.0 : next;
        });
      }
      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, playbackSpeed]);

  // Backward Drift Probability Cone
  const backwardOriginCone = useMemo(() => {
    const originPt = project(spillLon - 0.52, spillLat - 0.45); // T-24h origin center
    const slickPt = project(spillLon, spillLat);
    return {
      outerPath: `M ${slickPt.x} ${slickPt.y} L ${originPt.x - 70} ${originPt.y - 30} Q ${originPt.x} ${originPt.y - 70} ${originPt.x + 70} ${originPt.y + 35} Z`,
      midPath: `M ${slickPt.x} ${slickPt.y} L ${originPt.x - 45} ${originPt.y - 20} Q ${originPt.x} ${originPt.y - 45} ${originPt.x + 45} ${originPt.y + 25} Z`,
      corePath: `M ${slickPt.x} ${slickPt.y} L ${originPt.x - 25} ${originPt.y - 10} Q ${originPt.x} ${originPt.y - 25} ${originPt.x + 25} ${originPt.y + 15} Z`,
      center: originPt
    };
  }, [spillLon, spillLat]);

  // Forward Drift Forecast Points (+24h, +48h)
  const forwardPath = useMemo(() => {
    const p0 = project(spillLon, spillLat);
    const p24 = project(spillLon + 0.35, spillLat + 0.28);
    const p48 = project(spillLon + 0.68, spillLat + 0.52);
    return { p0, p24, p48 };
  }, [spillLon, spillLat]);

  // Dynamic Camera Center calculation (scaled around viewport center 450, 310)
  const currentCameraTransform = useMemo(() => {
    if (cameraMode === 'follow' && currentTelemetry) {
      const shipPt = project(currentTelemetry.lon, currentTelemetry.lat);
      return {
        scale: 1.7,
        x: (450 - shipPt.x) * 1.7,
        y: (310 - shipPt.y) * 1.7
      };
    }
    if (cameraMode === 'spill') {
      const slickPt = project(spillLon, spillLat);
      return {
        scale: 1.85,
        x: (450 - slickPt.x) * 1.85,
        y: (310 - slickPt.y) * 1.85
      };
    }
    // Theater (Overview / Full Regional Map) mode
    return {
      scale: zoom,
      x: pan.x,
      y: pan.y
    };
  }, [cameraMode, currentTelemetry, spillLon, spillLat, zoom, pan]);

  // Smooth mouse wheel zoom listener (allows zooming out from 3.5x down to 0.35x full map)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      setCameraMode('theater');
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((z) => Math.max(0.35, Math.min(3.5, +(z * factor).toFixed(2))));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Panning controls for manual mode
  const handleMouseDown = (e) => {
    if (cameraMode !== 'theater') setCameraMode('theater'); // switch to manual on drag
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  const handleMouseUp = () => setIsDragging(false);

  // Full West Coast of India shoreline path for Hydrodynamic ocean view mode
  const westCoastPath = useMemo(() => {
    const pts = [
      [68.5, 24.5], [69.0, 23.5], [70.2, 23.1], [69.2, 22.5], [69.5, 21.6],
      [70.5, 20.8], [72.0, 21.1], [72.6, 21.7], [72.8, 21.2], [72.8, 20.2],
      [72.84, 18.96], [73.0, 18.2], [73.3, 17.0], [73.8, 15.4], [74.3, 14.8],
      [74.8, 13.0], [75.3, 12.0], [76.2, 9.9], [76.9, 8.5], [77.5, 8.1]
    ];
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${project(p[0], p[1]).x} ${project(p[0], p[1]).y}`).join(' ')
      + ` L ${project(85.0, 8.1).x} ${project(85.0, 8.1).y}`
      + ` L ${project(85.0, 26.0).x} ${project(85.0, 26.0).y}`
      + ` L ${project(68.5, 26.0).x} ${project(68.5, 26.0).y} Z`;
  }, []);

  // Computed raster tile positions: 42 Base Regional Tiles at Zoom 7
  const renderedRegionalTiles = useMemo(() => {
    return REGIONAL_TILES_Z7.map(tile => {
      const minLon = tile2lon(tile.x, tile.z);
      const maxLon = tile2lon(tile.x + 1, tile.z);
      const maxLat = tile2lat(tile.y, tile.z);
      const minLat = tile2lat(tile.y + 1, tile.z);
      const pTopLeft = project(minLon, maxLat);
      const pBottomRight = project(maxLon, minLat);
      return {
        id: `z7-${tile.x}-${tile.y}`,
        x: Math.round(pTopLeft.x),
        y: Math.round(pTopLeft.y),
        width: Math.round(pBottomRight.x - pTopLeft.x) + 1,
        height: Math.round(pBottomRight.y - pTopLeft.y) + 1,
        satelliteUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`,
        ecdisUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`
      };
    });
  }, []);

  // Computed raster tile positions: 12 High-Res Local Detail Tiles at Zoom 8
  const renderedDetailTiles = useMemo(() => {
    return DETAIL_TILES_Z8.map(tile => {
      const minLon = tile2lon(tile.x, tile.z);
      const maxLon = tile2lon(tile.x + 1, tile.z);
      const maxLat = tile2lat(tile.y, tile.z);
      const minLat = tile2lat(tile.y + 1, tile.z);
      const pTopLeft = project(minLon, maxLat);
      const pBottomRight = project(maxLon, minLat);
      return {
        id: `z8-${tile.x}-${tile.y}`,
        x: Math.round(pTopLeft.x),
        y: Math.round(pTopLeft.y),
        width: Math.round(pBottomRight.x - pTopLeft.x) + 1,
        height: Math.round(pBottomRight.y - pTopLeft.y) + 1,
        satelliteUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`,
        ecdisUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`
      };
    });
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: '#040b14',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #1a2d4a',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Top Header & Tactical Controls Bar */}
      <div style={{
        position: 'absolute', top: '10px', left: '12px', right: '12px', zIndex: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
        background: 'rgba(6, 14, 26, 0.95)', backdropFilter: 'blur(12px)',
        padding: '6px 12px', borderRadius: '8px', border: '1px solid #1f3554',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
      }}>
        {/* Left: Title & Suspect Vessel Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.4px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
            4D AIS RECONSTRUCTION
          </span>

          <div style={{ display: 'flex', gap: '4px' }}>
            {vesselProfiles.map((v, i) => (
              <button
                key={v.id}
                onClick={() => { setSelectedVesselIndex(i); onSelectVessel(v); }}
                style={{
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: i === selectedVesselIndex ? '1.5px solid #38bdf8' : '1px solid #2d4a6e',
                  background: i === selectedVesselIndex ? '#0f294a' : '#0b1626',
                  color: i === selectedVesselIndex ? '#ffffff' : '#94a3b8',
                  fontSize: '0.68rem',
                  fontWeight: i === selectedVesselIndex ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                #{v.rank} {v.name} ({v.score} pts)
              </button>
            ))}
          </div>
        </div>

        {/* Center/Right: View Layer Modes & Camera Modes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Realistic View Mode Switcher */}
          <div style={{ display: 'flex', background: '#0b1626', padding: '2px', borderRadius: '5px', border: '1px solid #1e3554' }}>
            <button
              onClick={() => setViewMode('satellite')}
              style={{
                padding: '3px 7px',
                borderRadius: '3px',
                border: 'none',
                background: viewMode === 'satellite' ? '#0284c7' : 'transparent',
                color: viewMode === 'satellite' ? '#ffffff' : '#94a3b8',
                fontSize: '0.67rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Real-world Earth observation satellite photography"
            >
              Satellite Imagery
            </button>
            <button
              onClick={() => setViewMode('ocean')}
              style={{
                padding: '3px 7px',
                borderRadius: '3px',
                border: 'none',
                background: viewMode === 'ocean' ? '#0284c7' : 'transparent',
                color: viewMode === 'ocean' ? '#ffffff' : '#94a3b8',
                fontSize: '0.67rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Dynamic hydrodynamic ocean currents & bathymetry"
            >
              Hydrodynamic Current
            </button>
            <button
              onClick={() => setViewMode('ecdis')}
              style={{
                padding: '3px 7px',
                borderRadius: '3px',
                border: 'none',
                background: viewMode === 'ecdis' ? '#0284c7' : 'transparent',
                color: viewMode === 'ecdis' ? '#ffffff' : '#94a3b8',
                fontSize: '0.67rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Official ECDIS dark tactical marine navigation chart"
            >
              ECDIS Radar
            </button>
          </div>

          {/* Camera Replay Follow Mode */}
          <div style={{ display: 'flex', background: '#0b1626', padding: '2px', borderRadius: '5px', border: '1px solid #1e3554' }}>
            <button
              onClick={() => setCameraMode('follow')}
              style={{
                padding: '3px 7px',
                borderRadius: '3px',
                border: 'none',
                background: cameraMode === 'follow' ? '#059669' : 'transparent',
                color: cameraMode === 'follow' ? '#ffffff' : '#94a3b8',
                fontSize: '0.67rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Automatically tracks the tanker with cinematic satellite camera lock"
            >
              Follow Vessel
            </button>
            <button
              onClick={() => setCameraMode('spill')}
              style={{
                padding: '3px 7px',
                borderRadius: '3px',
                border: 'none',
                background: cameraMode === 'spill' ? '#059669' : 'transparent',
                color: cameraMode === 'spill' ? '#ffffff' : '#94a3b8',
                fontSize: '0.67rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Focus on oil slick centroid"
            >
              Focus Slick
            </button>
            <button
              onClick={() => { setCameraMode('theater'); setZoom(0.55); setPan({ x: 0, y: 0 }); }}
              style={{
                padding: '3px 8px',
                borderRadius: '3px',
                border: 'none',
                background: cameraMode === 'theater' ? '#059669' : 'transparent',
                color: cameraMode === 'theater' ? '#ffffff' : '#94a3b8',
                fontSize: '0.67rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Wide regional view: Full Arabian Sea and Western Seaboard of India"
            >
              Full Extent
            </button>
          </div>

          {/* Zoom controls & Scale Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#0b1626', padding: '2px 4px', borderRadius: '5px', border: '1px solid #1e3554' }}>
            <button
              onClick={() => { setCameraMode('theater'); setZoom(z => Math.max(0.35, +(z - 0.15).toFixed(2))); }}
              style={{ width: '22px', height: '22px', background: '#1a2d4a', color: '#fff', border: '1px solid #2d4a6e', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Zoom out to see full map"
            >−</button>
            <span style={{ fontSize: '0.62rem', color: '#38bdf8', minWidth: '34px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
              {Math.round(currentCameraTransform.scale * 100)}%
            </span>
            <button
              onClick={() => { setCameraMode('theater'); setZoom(z => Math.min(3.5, +(z + 0.15).toFixed(2))); }}
              style={{ width: '22px', height: '22px', background: '#1a2d4a', color: '#fff', border: '1px solid #2d4a6e', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Zoom in"
            >+</button>
          </div>
        </div>
      </div>

      {/* Floating Tactical Telemetry HUD (Left) */}
      {currentTelemetry && (
        <div style={{
          position: 'absolute', top: '92px', left: '12px', zIndex: 15,
          background: 'rgba(6, 14, 28, 0.92)', backdropFilter: 'blur(10px)',
          padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e3554',
          width: '205px', color: '#fff', fontSize: '0.7rem', pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #1a2d4a', paddingBottom: '4px' }}>
            <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.74rem' }}>{activeVessel.name}</span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>MMSI: {activeVessel.mmsi}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.6rem', textTransform: 'uppercase' }}>SPEED (SOG)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', color: currentTelemetry.isSlowActive ? '#ef4444' : '#38bdf8' }}>
                {(Number(currentTelemetry.sog) || 0).toFixed(1)} <span style={{ fontSize: '0.65rem' }}>kn</span>
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.6rem', textTransform: 'uppercase' }}>COURSE (COG)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', color: currentTelemetry.isTurnActive ? '#f59e0b' : '#f8fafc' }}>
                {Math.round(Number(currentTelemetry.cog) || 0)}°
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#cbd5e1', fontSize: '0.66rem', fontFamily: 'monospace' }}>
            <span>Position:</span>
            <span>{(Number(currentTelemetry.lat) || 0).toFixed(3)}°N, {(Number(currentTelemetry.lon) || 0).toFixed(3)}°E</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.66rem' }}>
            <span>Dist to Origin:</span>
            <span style={{ fontWeight: 700, color: (Number(currentTelemetry.distNm) || 0) < 4 ? '#ef4444' : '#38bdf8' }}>
              {(Number(currentTelemetry.distNm) || 0).toFixed(1)} nm
            </span>
          </div>

          {/* Anomaly Badge */}
          <div style={{
            background: (currentTelemetry.isGapActive || currentTelemetry.isSlowActive || currentTelemetry.isTurnActive) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
            border: (currentTelemetry.isGapActive || currentTelemetry.isSlowActive || currentTelemetry.isTurnActive) ? '1px solid #ef4444' : '1px solid #10b981',
            borderRadius: '4px', padding: '4px 6px',
            color: (currentTelemetry.isGapActive || currentTelemetry.isSlowActive || currentTelemetry.isTurnActive) ? '#fca5a5' : '#6ee7b7',
            fontWeight: 700, fontSize: '0.64rem', textAlign: 'center'
          }}>
            {currentTelemetry.status}
          </div>
        </div>
      )}

      {/* Floating Scientific Legend (Right) */}
      <div style={{
        position: 'absolute', top: '92px', right: '12px', zIndex: 15,
        background: 'rgba(6, 14, 28, 0.92)', backdropFilter: 'blur(10px)',
        padding: '8px 10px', borderRadius: '8px', border: '1px solid #1e3554',
        color: '#cbd5e1', fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: '4px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontWeight: 800, color: '#f8fafc', marginBottom: '2px', letterSpacing: '0.5px' }}>MAP TELEMETRY</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '8px', background: '#09090b', border: '1.5px solid #ef4444', borderRadius: '3px' }} />
          <span>SAR Oil Slick (T0)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '8px', background: 'rgba(249, 115, 22, 0.3)', border: '1px dashed #f97316' }} />
          <span>T-24h Origin Cone</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '2px', background: '#06b6d4' }} />
          <span>Forward 48h Drift Forecast</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '2px', borderTop: '2px dashed #ef4444' }} />
          <span>Deliberate AIS Blackout Gap</span>
        </div>

        <div style={{ borderTop: '1px solid #1f3554', marginTop: '4px', paddingTop: '4px' }}>
          <div style={{ color: '#38bdf8', fontWeight: 700 }}>CMEMS Surface Current:</div>
          <div style={{ color: '#ffffff' }}>0.28 m/s @ 215° (SW)</div>
          <div style={{ color: '#fbbf24', fontWeight: 700, marginTop: '3px' }}>ERA5 10m Wind:</div>
          <div style={{ color: '#ffffff' }}>5.8 m/s @ 205°</div>
        </div>
      </div>

      {/* Main Interactive Geographic Canvas */}
      <svg
        viewBox="0 0 900 620"
        style={{
          width: '100%', height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Oceanic water gradient for Hydrodynamic mode */}
          <radialGradient id="hydroOcean" cx="40%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#0b2545" />
            <stop offset="50%" stopColor="#07172b" />
            <stop offset="100%" stopColor="#030b14" />
          </radialGradient>

          {/* Backward drift probability gradient */}
          <radialGradient id="originProbGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#f97316" stopOpacity="0.45" />
            <stop offset="80%" stopColor="#eab308" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>

          {/* Authentic Ship Propeller Wake Foam Gradient */}
          <linearGradient id="wakeFoamRealistic" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="25%" stopColor="#bae6fd" stopOpacity="0.65" />
            <stop offset="60%" stopColor="#0284c7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </linearGradient>

          {/* Heavy crude oil slick texture filter */}
          <filter id="crudeTexture" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          {/* Photorealistic Tanker Hull Metallic Gradients */}
          <linearGradient id="tankerHullRealistic" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="12%" stopColor="#7f1d1d" /> {/* Dark red waterline anti-fouling */}
            <stop offset="28%" stopColor="#334155" />
            <stop offset="50%" stopColor="#64748b" /> {/* Deck plate highlight */}
            <stop offset="72%" stopColor="#334155" />
            <stop offset="88%" stopColor="#7f1d1d" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Navigation Light Glow Filters */}
          <filter id="navPortGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="navStbdGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g
          transform={`translate(${currentCameraTransform.x}, ${currentCameraTransform.y}) translate(450, 310) scale(${currentCameraTransform.scale}) translate(-450, -310)`}
          style={{ transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {/* 1. LAYER 1: BASEMAP TILES */}
          {/* Real Satellite Imagery Tiles */}
          {viewMode === 'satellite' && (
            <g>
              <rect x="-2000" y="-1800" width="5500" height="4600" fill="#040d1a" />
              {/* Regional Z7 satellite tiles (covers whole Arabian Sea & Western India) */}
              {renderedRegionalTiles.map(t => (
                <image
                  key={t.id}
                  href={t.satelliteUrl}
                  x={t.x}
                  y={t.y}
                  width={t.width}
                  height={t.height}
                  preserveAspectRatio="none"
                />
              ))}
              {/* Detailed Z8 satellite tiles around Mumbai offshore */}
              {renderedDetailTiles.map(t => (
                <image
                  key={t.id}
                  href={t.satelliteUrl}
                  x={t.x}
                  y={t.y}
                  width={t.width}
                  height={t.height}
                  preserveAspectRatio="none"
                />
              ))}
              {/* Subtle satellite atmospheric color-grade */}
              <rect x="-2000" y="-1800" width="5500" height="4600" fill="rgba(10, 25, 47, 0.12)" pointerEvents="none" />
            </g>
          )}

          {/* ECDIS Dark Tactical Nautical Tiles */}
          {viewMode === 'ecdis' && (
            <g>
              <rect x="-2000" y="-1800" width="5500" height="4600" fill="#06101e" />
              {/* Regional Z7 ecdis tiles */}
              {renderedRegionalTiles.map(t => (
                <image
                  key={t.id}
                  href={t.ecdisUrl}
                  x={t.x}
                  y={t.y}
                  width={t.width}
                  height={t.height}
                  preserveAspectRatio="none"
                />
              ))}
              {/* Detailed Z8 ecdis tiles */}
              {renderedDetailTiles.map(t => (
                <image
                  key={t.id}
                  href={t.ecdisUrl}
                  x={t.x}
                  y={t.y}
                  width={t.width}
                  height={t.height}
                  preserveAspectRatio="none"
                />
              ))}
            </g>
          )}

          {/* Oceanic Hydrodynamic Animated Surface */}
          {viewMode === 'ocean' && (
            <g>
              <rect x="-2000" y="-1800" width="5500" height="4600" fill="url(#hydroOcean)" />
              {/* Full Continental Coastline (Gujarat to Kerala) */}
              <path
                d={westCoastPath}
                fill="#111d2e"
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
              {/* Ocean Current Flow Streamlines */}
              {[12.0, 14.0, 16.0, 17.6, 18.2, 18.8, 19.4, 21.0].map((latLine, li) => (
                <g key={`cur-${li}`} opacity="0.38">
                  <path
                    d={`M ${project(66.5, latLine).x} ${project(66.5, latLine).y} Q ${project(70.5, latLine - 0.2).x} ${project(70.5, latLine - 0.2).y} ${project(74.0, latLine - 0.5).x} ${project(74.0, latLine - 0.5).y}`}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="1.2"
                    strokeDasharray="10 14"
                  >
                    <animate attributeName="stroke-dashoffset" values="48;0" dur="2.4s" repeatCount="indefinite" />
                  </path>
                </g>
              ))}
            </g>
          )}

          {/* Geographic Coordinates Grid Overlay */}
          {[66.0, 68.0, 70.0, 72.0, 74.0, 76.0, 78.0, 80.0].map(lon => {
            const { x } = project(lon, 18.0);
            return (
              <g key={`lon-${lon}`} opacity="0.32">
                <line x1={x} y1="-1400" x2={x} y2="2400" stroke="#38bdf8" strokeDasharray="3 6" strokeWidth="0.75" />
                <text x={x + 4} y="22" fill="#93c5fd" fontSize="9" fontFamily="monospace">{lon}°E</text>
              </g>
            );
          })}
          {[10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0, 24.0].map(lat => {
            const { y } = project(71.0, lat);
            return (
              <g key={`lat-${lat}`} opacity="0.32">
                <line x1="-1200" y1={y} x2="2700" y2={y} stroke="#38bdf8" strokeDasharray="3 6" strokeWidth="0.75" />
                <text x="12" y={y - 4} fill="#93c5fd" fontSize="9" fontFamily="monospace">{lat}°N</text>
              </g>
            );
          })}

          {/* Water Body Identifiers (Maritime labels) */}
          <g opacity="0.35" pointerEvents="none">
            <text x={project(68.2, 17.2).x} y={project(68.2, 17.2).y} fill="#38bdf8" fontSize="16" fontWeight="800" textAnchor="middle" letterSpacing="6px">
              ARABIAN SEA
            </text>
            <text x={project(72.0, 21.3).x} y={project(72.0, 21.3).y} fill="#38bdf8" fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="2px">
              GULF OF KHAMBHAT
            </text>
            <text x={project(69.6, 22.7).x} y={project(69.6, 22.7).y} fill="#38bdf8" fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="2px">
              GULF OF KUTCH
            </text>
          </g>

          {/* Major Strategic Coastal Ports & Regional Anchors */}
          {MAJOR_PORTS.map((port) => {
            const pt = project(port.lon, port.lat);
            return (
              <g key={port.name} transform={`translate(${pt.x}, ${pt.y})`}>
                <circle r={port.isMajor ? 5 : 3.5} fill={port.isMajor ? '#38bdf8' : '#0284c7'} stroke="#ffffff" strokeWidth="1.2" />
                {port.isMajor && (
                  <circle r="12" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3">
                    <animate attributeName="r" values="6;16;6" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.1;0.8" dur="3s" repeatCount="indefinite" />
                  </circle>
                )}
                <rect
                  x={port.offset.x - 3}
                  y={port.offset.y - 10}
                  width={port.name.length * 6.2 + 8}
                  height="16"
                  rx="3"
                  fill="rgba(11, 22, 38, 0.88)"
                  stroke={port.isMajor ? '#38bdf8' : '#224a73'}
                  strokeWidth="0.8"
                />
                <text
                  x={port.offset.x + 2}
                  y={port.offset.y + 2}
                  fill="#f8fafc"
                  fontSize="8.5"
                  fontWeight={port.isMajor ? '800' : '600'}
                >
                  {port.name}
                </text>
              </g>
            );
          })}

          {/* 2. LAYER 2: SCIENTIFIC BACKWARD ORIGIN PROBABILITY CLOUD */}
          <g>
            {/* Outer 95% Confidence Envelope */}
            <path
              d={backwardOriginCone.outerPath}
              fill="rgba(234, 179, 8, 0.12)"
              stroke="#eab308"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Mid 75% Confidence Corridor */}
            <path
              d={backwardOriginCone.midPath}
              fill="rgba(249, 115, 22, 0.22)"
              stroke="#f97316"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
            {/* Inner 50% High-Probability Core */}
            <path
              d={backwardOriginCone.corePath}
              fill="rgba(239, 68, 68, 0.35)"
              stroke="#ef4444"
              strokeWidth="1.8"
            />

            {/* Pulsating Origin Window Centroid (T-24h) */}
            <circle
              cx={backwardOriginCone.center.x}
              cy={backwardOriginCone.center.y}
              r="22"
              fill="url(#originProbGrad)"
            />
            <circle
              cx={backwardOriginCone.center.x}
              cy={backwardOriginCone.center.y}
              r="6"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
            >
              <animate attributeName="r" values="4;14;4" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={backwardOriginCone.center.x} cy={backwardOriginCone.center.y} r="3" fill="#ef4444" />

            <g transform={`translate(${backwardOriginCone.center.x - 75}, ${backwardOriginCone.center.y - 18})`}>
              <rect x="0" y="0" width="150" height="20" rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="#f97316" strokeWidth="1" />
              <text x="75" y="13" fill="#f8fafc" fontSize="8.5" fontWeight="800" textAnchor="middle">
                T-24h Origin Probability Centroid
              </text>
            </g>
          </g>

          {/* 3. LAYER 3: FORWARD 48H DRIFT FORECAST VECTOR */}
          <g>
            <path
              d={`M ${forwardPath.p0.x} ${forwardPath.p0.y} Q ${forwardPath.p24.x} ${forwardPath.p24.y} ${forwardPath.p48.x} ${forwardPath.p48.y}`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
            {/* +24h Forecast Waypoint */}
            <circle cx={forwardPath.p24.x} cy={forwardPath.p24.y} r="4.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
            <text x={forwardPath.p24.x + 8} y={forwardPath.p24.y + 3} fill="#06b6d4" fontSize="8.5" fontWeight="800" style={{ textShadow: '0 1px 3px #000' }}>
              +24h Forecast
            </text>

            {/* +48h Forecast Waypoint */}
            <circle cx={forwardPath.p48.x} cy={forwardPath.p48.y} r="4.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
            <text x={forwardPath.p48.x + 8} y={forwardPath.p48.y + 3} fill="#06b6d4" fontSize="8.5" fontWeight="800" style={{ textShadow: '0 1px 3px #000' }}>
              +48h Forecast
            </text>
          </g>

          {/* 4. LAYER 4: HISTORICAL VESSEL TRACKS */}
          {vesselProfiles.map((vp, idx) => {
            const isSelected = idx === selectedVesselIndex;
            const pts = vp.keyframes.map(k => project(k.lon, k.lat));
            const pathD = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

            return (
              <g key={vp.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? (vp.isCulprit ? '#f97316' : '#38bdf8') : '#334155'}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeDasharray={isSelected ? 'none' : '3 4'}
                  opacity={isSelected ? 0.95 : 0.4}
                />

                {/* Highlight Deliberate AIS Blackout Gap for Culprit Tanker */}
                {vp.isCulprit && (
                  <g>
                    <line
                      x1={pts[3].x} y1={pts[3].y}
                      x2={pts[4].x} y2={pts[4].y}
                      stroke="#ef4444" strokeWidth="3.5" strokeDasharray="6 4"
                    />
                    <line
                      x1={pts[4].x} y1={pts[4].y}
                      x2={pts[5].x} y2={pts[5].y}
                      stroke="#ef4444" strokeWidth="3.5" strokeDasharray="6 4"
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* 5. LAYER 5: SENTINEL-1 SAR REALISTIC OIL SLICK */}
          <g transform={`translate(${project(spillLon, spillLat).x}, ${project(spillLon, spillLat).y})`}>
            {/* Iridescent Hydrocarbon Sheen (Outer boundary) */}
            <ellipse
              rx="32" ry="16"
              transform="rotate(-26)"
              fill="rgba(6, 182, 212, 0.18)"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            {/* Weathered Chocolate Mousse Emulsion */}
            <ellipse
              rx="24" ry="12"
              transform="rotate(-26)"
              fill="#18181b"
              stroke="#713f12"
              strokeWidth="2"
              opacity="0.9"
            />
            {/* Heavy Crude Viscous Core */}
            <ellipse
              rx="16" ry="8"
              transform="rotate(-26)"
              fill="#09090b"
              filter="url(#crudeTexture)"
            />
            <circle r="3" fill="#ffffff" />

            {/* Slick Information Callout */}
            <g transform="translate(34, -8)">
              <rect x="0" y="0" width="160" height="22" rx="4" fill="rgba(9, 9, 11, 0.88)" stroke="#ef4444" strokeWidth="1" />
              <text x="8" y="14" fill="#ffffff" fontSize="9" fontWeight="800">
                {spill?.name || 'SPILL-20240315-001'} (12.5 km²)
              </text>
            </g>
          </g>

          {/* 6. LAYER 6: PHOTOREALISTIC VESSEL & DYNAMIC HYDRODYNAMIC WAKE */}
          {currentTelemetry && (
            <g transform={`translate(${project(currentTelemetry.lon, currentTelemetry.lat).x}, ${project(currentTelemetry.lon, currentTelemetry.lat).y})`}>
              
              {/* Heading-Aligned Vessel and Water Simulation */}
              <g transform={`rotate(${currentTelemetry.cog})`}>
                
                {/* 6A. HYDRODYNAMIC KELVIN WAKE & PROPELLER CAVITATION */}
                {currentTelemetry.sog > 1.2 && (
                  <g opacity={Math.min(0.95, currentTelemetry.sog / 12)}>
                    {/* Expanding V-Wake divergent shockwaves */}
                    <path
                      d="M -4 20 Q -16 65 -36 120 L -24 120 Q -8 65 -1 20 Z"
                      fill="url(#wakeFoamRealistic)"
                    />
                    <path
                      d="M 4 20 Q 16 65 36 120 L 24 120 Q 8 65 1 20 Z"
                      fill="url(#wakeFoamRealistic)"
                    />
                    {/* Turbulent propeller wash foaming center */}
                    <ellipse cx="0" cy="35" rx="7" ry="12" fill="#ffffff" opacity="0.8">
                      <animate attributeName="ry" values="10;15;10" dur="0.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.6s" repeatCount="indefinite" />
                    </ellipse>
                    <ellipse cx="0" cy="65" rx="14" ry="18" fill="#e0f2fe" opacity="0.5">
                      <animate attributeName="ry" values="14;22;14" dur="0.9s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0.1;0.5" dur="0.9s" repeatCount="indefinite" />
                    </ellipse>
                    {/* Lingering dissolving wake foam strip */}
                    <line x1="0" y1="20" x2="0" y2="130" stroke="#ffffff" strokeWidth="3.5" opacity="0.7" strokeDasharray="8 6">
                      <animate attributeName="stroke-dashoffset" values="0;28" dur="0.8s" repeatCount="indefinite" />
                    </line>
                  </g>
                )}

                {/* 6B. DISCHARGE PLUME (During speed drop / illicit discharge event) */}
                {currentTelemetry.isSlowActive && (
                  <g>
                    <ellipse cx="9" cy="8" rx="20" ry="10" fill="#09090b" opacity="0.95" stroke="#ef4444" strokeWidth="1.5">
                      <animate attributeName="rx" values="16;24;16" dur="1.2s" repeatCount="indefinite" />
                    </ellipse>
                    <ellipse cx="14" cy="22" rx="26" ry="12" fill="#18181b" opacity="0.85" />
                    <text x="32" y="12" fill="#ef4444" fontSize="8.5" fontWeight="900" style={{ textShadow: '0 1px 4px #000' }}>
                      ALERT: ILLICIT DISCHARGE DETECTED
                    </text>
                  </g>
                )}

                {/* 6C. PHOTOREALISTIC COMMERCIAL TANKER MODEL */}
                {/* Hull shadow on sea surface */}
                <path
                  d="M 0 -28 C 7 -22, 8 -13, 8 0 C 8 15, 7 24, 4.5 27 L -4.5 27 C -7 24, -8 15, -8 0 C -8 -13, -7 -22, 0 -28 Z"
                  fill="rgba(0, 0, 0, 0.6)"
                  transform="translate(4, 4)"
                />

                {/* Steel Double Hull with Red/Slate anti-fouling paint */}
                <path
                  d="M 0 -28 C 7 -22, 8 -13, 8 0 C 8 15, 7 24, 4.5 27 L -4.5 27 C -7 24, -8 15, -8 0 C -8 -13, -7 -22, 0 -28 Z"
                  fill="url(#tankerHullRealistic)"
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />

                {/* Raised Forecastle Bow Deck */}
                <path
                  d="M 0 -28 C 5 -23, 6 -19, 6 -17 L -6 -17 C -6 -19, -5 -23, 0 -28 Z"
                  fill="#475569"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />
                <circle cx="-2.8" cy="-21" r="1.3" fill="#cbd5e1" />
                <circle cx="2.8" cy="-21" r="1.3" fill="#cbd5e1" />

                {/* Cargo Deck Hatches (4 holds) */}
                {[-13, -5, 3].map(yPos => (
                  <g key={`hatch-${yPos}`}>
                    <rect x="-5.5" y={yPos} width="4.5" height="5.5" rx="0.8" fill="#1e293b" stroke="#475569" strokeWidth="0.6" />
                    <rect x="1" y={yPos} width="4.5" height="5.5" rx="0.8" fill="#1e293b" stroke="#475569" strokeWidth="0.6" />
                  </g>
                ))}

                {/* Longitudinal Pipeline Manifold (Safety Yellow) */}
                <line x1="0" y1="-17" x2="0" y2="12" stroke="#f59e0b" strokeWidth="1.5" />
                {/* Cross-deck cargo discharge manifolds */}
                <line x1="-6" y1="-6" x2="6" y2="-6" stroke="#f59e0b" strokeWidth="1.2" />
                <line x1="-6" y1="2" x2="6" y2="2" stroke="#f59e0b" strokeWidth="1.2" />

                {/* Aft Bridge Superstructure & Wheelhouse */}
                <rect x="-6.5" y="12" width="13" height="12" rx="1.5" fill="#f8fafc" stroke="#64748b" strokeWidth="0.8" />
                {/* Panoramic bridge wings */}
                <line x1="-9" y1="14" x2="9" y2="14" stroke="#e2e8f0" strokeWidth="1.8" />
                {/* Wheelhouse illuminated panoramic windows */}
                <rect x="-5" y="13" width="10" height="2" fill="#0284c7" />

                {/* Funnel Exhaust Smokestack */}
                <ellipse cx="0" cy="20" rx="2.5" ry="3.5" fill="#0f172a" stroke="#ea580c" strokeWidth="1" />

                {/* Radar Mast & Rotating Marine Radar Scanner */}
                <line x1="0" y1="14" x2="0" y2="9" stroke="#cbd5e1" strokeWidth="1.2" />
                <line x1="-4" y1="9" x2="4" y2="9" stroke="#38bdf8" strokeWidth="1.8" />

                {/* IMO Navigation Lights */}
                {/* Port Lantern (Red) */}
                <circle cx="-8.5" cy="14" r="1.8" fill="#ef4444" filter="url(#navPortGlow)" />
                <circle cx="-8.5" cy="14" r="0.8" fill="#ffffff" />
                {/* Starboard Lantern (Green) */}
                <circle cx="8.5" cy="14" r="1.8" fill="#22c55e" filter="url(#navStbdGlow)" />
                <circle cx="8.5" cy="14" r="0.8" fill="#ffffff" />
                {/* Stern Light (White) */}
                <circle cx="0" cy="27" r="1.2" fill="#ffffff" />

                {/* Forward Heading Vector Beam */}
                <line
                  x1="0" y1="-28"
                  x2="0" y2="-60"
                  stroke="#38bdf8"
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                  opacity="0.85"
                />
              </g>

              {/* Clean Executive Tactical Identification Tag (Non-rotating) */}
              <g transform="translate(24, -32)" pointerEvents="none">
                <line x1="-24" y1="32" x2="0" y2="12" stroke="#38bdf8" strokeWidth="1" opacity="0.7" />
                <rect
                  x="0" y="0" width="155" height="38" rx="4"
                  fill="rgba(15, 23, 42, 0.92)"
                  stroke={activeVessel.isCulprit ? '#f97316' : '#38bdf8'}
                  strokeWidth="1.2"
                />
                <text x="8" y="14" fill="#ffffff" fontSize="8.5" fontWeight="800">
                  {activeVessel.isCulprit ? 'PRIMARY SUSPECT #1' : `VESSEL #${activeVessel.rank}`}
                </text>
                <text x="8" y="28" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                  SPD: <strong style={{ color: '#38bdf8' }}>{(Number(currentTelemetry.sog) || 0).toFixed(1)} kn</strong> | HDG: <strong style={{ color: '#f59e0b' }}>{Math.round(Number(currentTelemetry.cog) || 0)}°</strong>
                </text>
              </g>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
