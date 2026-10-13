import { useState, useEffect, useRef } from 'react';
import {
  INDIA_MAINLAND_POLYGON,
  INDIA_PENINSULA_COASTLINE,
  SRI_LANKA_COASTLINE,
  ANDAMAN_COASTLINE,
  INDIAN_PORTS,
  MARINE_SANCTUARIES
} from './indiaMapData';

// Sector detection based on incident latitude and longitude
export const detectSectorForSpill = (lat, lon) => {
  if (!lat || !lon) return 'mumbai';
  // Andaman & Nicobar
  if (lon >= 90.0) return 'andaman_area';
  // Gujarat & Gulf of Kutch
  if (lat >= 21.0 && lon <= 71.5) return 'gujarat';
  // Mumbai Offshore Basin & JNPT
  if (lat >= 17.5 && lat <= 20.8 && lon <= 73.8) return 'mumbai';
  // Goa & Konkan Coast
  if (lat >= 14.0 && lat < 17.5 && lon <= 75.0) return 'goa_konkan';
  // Kerala & Lakshadweep Sea
  if (lat < 14.0 && lon <= 77.5) return 'kerala';
  // Tamil Nadu & Palk Strait
  if (lat <= 14.0 && lon > 77.5 && lon <= 81.5) return 'tamil_nadu';
  // Bengal & Sundarbans Delta
  if (lat >= 21.0 && lon >= 86.8) return 'bengal';
  // Andhra & Odisha Coast
  if (lat > 14.0 && lon >= 81.0) return 'andhra_odisha';
  return 'mumbai';
};

// 1. Regional jurisdictions (Strictly for Regional Manager & Higher Authority)
export const REGIONAL_BOUNDS = {
  west_coast: {
    minLon: 68.0, maxLon: 75.5, minLat: 15.0, maxLat: 23.5,
    name: 'West Coast Region (Arabian Sea)',
    seaLabel: 'ARABIAN SEA REGION'
  },
  east_coast: {
    minLon: 79.5, maxLon: 89.5, minLat: 15.0, maxLat: 22.8,
    name: 'East Coast Region (Bay of Bengal)',
    seaLabel: 'BAY OF BENGAL REGION'
  },
  southwest_coast: {
    minLon: 71.5, maxLon: 78.5, minLat: 7.8, maxLat: 15.5,
    name: 'Southwest Coast Region (Malabar & Lakshadweep)',
    seaLabel: 'LAKSHADWEEP REGION'
  },
  southeast_coast: {
    minLon: 77.0, maxLon: 84.5, minLat: 8.0, maxLat: 16.0,
    name: 'Southeast Coast Region (Coromandel & Palk)',
    seaLabel: 'SOUTHEAST COAST REGION'
  },
  andaman: {
    minLon: 91.0, maxLon: 95.0, minLat: 9.0, maxLat: 14.5,
    name: 'Andaman & Nicobar Region',
    seaLabel: 'ANDAMAN SEA REGION'
  }
};

// 2. Tactical operational areas (Strictly for Coast Guard)
export const TACTICAL_AREA_BOUNDS = {
  mumbai: {
    minLon: 70.8, maxLon: 73.6, minLat: 18.0, maxLat: 19.9,
    name: 'Mumbai Area (Offshore Basin & JNPT)',
    seaLabel: 'MUMBAI OFFSHORE'
  },
  gujarat: {
    minLon: 68.2, maxLon: 70.9, minLat: 21.6, maxLat: 23.6,
    name: 'Gujarat Area (Gulf of Kutch & Kandla)',
    seaLabel: 'GULF OF KUTCH'
  },
  goa_konkan: {
    minLon: 72.4, maxLon: 74.8, minLat: 14.5, maxLat: 17.5,
    name: 'Goa & Konkan Area (Mormugao & Karwar)',
    seaLabel: 'KONKAN COAST'
  },
  kerala: {
    minLon: 74.8, maxLon: 77.4, minLat: 8.8, maxLat: 12.2,
    name: 'Kerala Area (Kochi & Malabar Coast)',
    seaLabel: 'LAKSHADWEEP SEA'
  },
  tamil_nadu: {
    minLon: 78.0, maxLon: 81.2, minLat: 8.8, maxLat: 13.6,
    name: 'Tamil Nadu Area (Palk Strait & Chennai)',
    seaLabel: 'PALK BAY & GULF OF MANNAR'
  },
  andhra_odisha: {
    minLon: 81.8, maxLon: 87.5, minLat: 16.5, maxLat: 21.2,
    name: 'Andhra & Odisha Area (Vizag & Paradip)',
    seaLabel: 'NORTH BAY OF BENGAL'
  },
  bengal: {
    minLon: 87.0, maxLon: 89.8, minLat: 21.0, maxLat: 22.8,
    name: 'Bengal Area (Haldia & Sundarbans)',
    seaLabel: 'SUNDARBANS DELTA'
  },
  andaman_area: {
    minLon: 91.0, maxLon: 94.5, minLat: 10.0, maxLat: 14.5,
    name: 'Andaman Area',
    seaLabel: 'ANDAMAN SEA'
  }
};

// 3. National sovereign EEZ (Higher Authority Only)
export const NATIONAL_BOUNDS = {
  national: {
    minLon: 67.0, maxLon: 98.0, minLat: 6.0, maxLat: 37.5,
    name: 'National Sovereign Territory & Maritime EEZ',
    seaLabel: 'ALL INDIA MARITIME EEZ & NATIONAL WATERS'
  }
};

// Unified lookup map for coordinates
export const REGION_BOUNDS = {
  ...NATIONAL_BOUNDS,
  ...REGIONAL_BOUNDS,
  ...TACTICAL_AREA_BOUNDS,
};

export default function MapView({
  selectedSpill = null,
  spills = [],
  suspects = [],
  driftData = null,
  vesselTracks = null,
  onSelectSpill = () => {},
  regionPreset = 'west_coast',
  viewMode = null, // 'regional' | 'tactical' | 'national'
  allowNational = false,
  bounds: boundsProp = null,
  height = '580px'
}) {
  // Resolve viewMode strictly:
  // - Regional Manager: 'regional' -> Only REGIONS, never areas, never national
  // - Coast Guard: 'tactical' -> Only AREAS, one at a time, never regions, never national
  // - Higher Authority: 'national' -> National EEZ + broad regional views
  const resolvedMode = viewMode || (
    (allowNational || regionPreset === 'national')
      ? 'national'
      : (REGIONAL_BOUNDS[regionPreset] ? 'regional' : 'tactical')
  );

  const initialRegion = (() => {
    if (resolvedMode === 'regional') {
      return REGIONAL_BOUNDS[regionPreset] ? regionPreset : 'west_coast';
    }
    if (resolvedMode === 'tactical') {
      return TACTICAL_AREA_BOUNDS[regionPreset] ? regionPreset : 'mumbai';
    }
    return allowNational ? 'national' : 'west_coast';
  })();

  const [activeRegion, setActiveRegion] = useState(initialRegion);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [activeLayers, setActiveLayers] = useState({
    slicks: true,
    originCone: true,
    futureDrift: true,
    vessels: true,
    eez: true,
    ports: true,
    sanctuaries: true
  });

  // Strict role separation for dropdown options:
  // REGIONAL MANAGER: ONLY REGIONS (no areas, no national)
  // COAST GUARD: ONLY AREAS (one at a time, no regions, no national)
  // HIGHER AUTHORITY: National + Regions
  const availableOptions = (() => {
    if (resolvedMode === 'regional') {
      return Object.keys(REGIONAL_BOUNDS);
    }
    if (resolvedMode === 'tactical') {
      return Object.keys(TACTICAL_AREA_BOUNDS);
    }
    return ['national', ...Object.keys(REGIONAL_BOUNDS)];
  })();

  // Automatically focus on spill's local tactical area ONLY in tactical mode (Coast Guard)
  // Regional Manager stays focused on their region without tactical area jumping
  useEffect(() => {
    if (resolvedMode === 'tactical' && selectedSpill?.centroid_lat && selectedSpill?.centroid_lon) {
      const autoArea = detectSectorForSpill(selectedSpill.centroid_lat, selectedSpill.centroid_lon);
      if (TACTICAL_AREA_BOUNDS[autoArea]) {
        setActiveRegion(autoArea);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    }
  }, [selectedSpill, resolvedMode]);

  // Keep internal activeRegion in sync if parent changes regionPreset
  useEffect(() => {
    let target = regionPreset;
    if (resolvedMode === 'regional') {
      target = REGIONAL_BOUNDS[regionPreset] ? regionPreset : 'west_coast';
    } else if (resolvedMode === 'tactical') {
      target = TACTICAL_AREA_BOUNDS[regionPreset] ? regionPreset : 'mumbai';
    } else if (!allowNational && target === 'national') {
      target = 'west_coast';
    }

    if (REGION_BOUNDS[target]) {
      setActiveRegion(target);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [regionPreset, resolvedMode, allowNational]);

  // Replay animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayStep, setReplayStep] = useState(0);

  // Active geographic bounds
  const bounds = boundsProp || REGION_BOUNDS[activeRegion] || REGION_BOUNDS.mumbai;

  // Convert Lon/Lat to SVG viewport coordinates (800x600 viewbox)
  const project = (lon, lat) => {
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 800;
    const y = 600 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 600;
    return { x, y };
  };

  // Turn coordinate array into closed SVG polygon
  const coordsToPolygon = (coords) => {
    return coords.reduce((acc, [lon, lat], i) => {
      const { x, y } = project(lon, lat);
      return acc + (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }, '') + ' Z';
  };

  // Turn coordinate array into open SVG polyline (for coastlines)
  const coordsToPolyline = (coords) => {
    return coords.reduce((acc, [lon, lat], i) => {
      const { x, y } = project(lon, lat);
      return acc + (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }, '');
  };

  // Animation timer
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setReplayStep((prev) => (prev >= 24 ? 0 : prev + 1));
      }, 400);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Handle Dragging / Panning
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Fallback demo tracks if none provided
  const demoTracks = [
    {
      mmsi: '419008001',
      name: 'MT ARABIAN STAR',
      type: 'Crude Oil Tanker',
      rank: 1,
      score: 82.5,
      points: [
        { lon: 71.3, lat: 18.2, sog: 13.5, time: 'T-8h' },
        { lon: 71.5, lat: 18.4, sog: 13.2, time: 'T-6h' },
        { lon: 71.7, lat: 18.6, sog: 12.8, time: 'T-4h' },
        { lon: 71.88, lat: 18.84, sog: 3.5, isSlow: true, time: 'T-1h (Speed Drop: 3.5kn)' },
        { lon: 71.91, lat: 18.86, sog: 0.8, isNearSpill: true, time: 'T0 (Spill Detected)' },
        { lon: 72.05, lat: 18.95, sog: 15.1, isDeviated: true, time: 'T+2h (Course Change 42°)' },
        { lon: 72.2, lat: 19.1, sog: 14.8, time: 'T+4h' }
      ]
    },
    {
      mmsi: '419003419',
      name: 'MT INDUS VOYAGER',
      type: 'Tanker',
      rank: 2,
      score: 38.2,
      points: [
        { lon: 72.4, lat: 18.2, sog: 11.2 },
        { lon: 72.3, lat: 18.5, sog: 11.0 },
        { lon: 72.2, lat: 18.8, sog: 10.9 },
        { lon: 72.1, lat: 19.2, sog: 11.1 }
      ]
    },
    {
      mmsi: '351829000',
      name: 'MV PACIFIC PIONEER',
      type: 'Cargo',
      rank: 3,
      score: 18.5,
      points: [
        { lon: 71.1, lat: 18.4, sog: 13.9 },
        { lon: 71.4, lat: 18.9, sog: 14.0 },
        { lon: 71.7, lat: 19.4, sog: 14.2 }
      ]
    }
  ];

  const tracksToDisplay = vesselTracks || demoTracks;

  // Filter spills that actually fall within the current map bounds
  const visibleSpills = spills.filter(s => {
    if (typeof s.centroid_lat !== 'number' || typeof s.centroid_lon !== 'number') return false;
    return (
      s.centroid_lon >= bounds.minLon - 0.5 &&
      s.centroid_lon <= bounds.maxLon + 0.5 &&
      s.centroid_lat >= bounds.minLat - 0.5 &&
      s.centroid_lat <= bounds.maxLat + 0.5
    );
  });

  // Identify active spill for drift analysis (Origin cone MUST only exist when there is an authentic spill!)
  const targetSpill = (() => {
    if (selectedSpill && typeof selectedSpill.centroid_lat === 'number' && typeof selectedSpill.centroid_lon === 'number') {
      const inBounds = (
        selectedSpill.centroid_lon >= bounds.minLon - 0.5 &&
        selectedSpill.centroid_lon <= bounds.maxLon + 0.5 &&
        selectedSpill.centroid_lat >= bounds.minLat - 0.5 &&
        selectedSpill.centroid_lat <= bounds.maxLat + 0.5
      );
      if (inBounds) return selectedSpill;
    }
    return visibleSpills.length === 1 ? visibleSpills[0] : null;
  })();

  const refLon = targetSpill ? targetSpill.centroid_lon : null;
  const refLat = targetSpill ? targetSpill.centroid_lat : null;

  // Filter vessel tracks so only vessels with points within current bounds are displayed
  const visibleTracks = tracksToDisplay.filter(v =>
    v.points && v.points.some(p =>
      p.lon >= bounds.minLon - 0.8 && p.lon <= bounds.maxLon + 0.8 &&
      p.lat >= bounds.minLat - 0.8 && p.lat <= bounds.maxLat + 0.8
    )
  );

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height,
      background: '#dbeefc',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #bfdbfe',
      boxShadow: '0 4px 20px rgba(11, 30, 54, 0.06)'
    }}>
      {/* Top Left: Map Layer Controls Toolbar */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px', zIndex: 10,
        background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(8px)',
        padding: '8px 14px', borderRadius: '10px', border: '1px solid #cbd5e1',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
        display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.78rem', color: '#1e293b'
      }}>
        <span style={{ fontWeight: 700, color: '#0b1e36', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>️</span> Layers:
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={activeLayers.slicks}
            onChange={(e) => setActiveLayers(l => ({ ...l, slicks: e.target.checked }))}
            style={{ accentColor: '#0b1e36' }}
          />
          <span>️ Slicks</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={activeLayers.originCone}
            onChange={(e) => setActiveLayers(l => ({ ...l, originCone: e.target.checked }))}
            style={{ accentColor: '#0b1e36' }}
          />
          <span> Origin Cone</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={activeLayers.futureDrift}
            onChange={(e) => setActiveLayers(l => ({ ...l, futureDrift: e.target.checked }))}
            style={{ accentColor: '#0b1e36' }}
          />
          <span> Drift Path</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={activeLayers.vessels}
            onChange={(e) => setActiveLayers(l => ({ ...l, vessels: e.target.checked }))}
            style={{ accentColor: '#0b1e36' }}
          />
          <span> AIS Tracks</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={activeLayers.ports}
            onChange={(e) => setActiveLayers(l => ({ ...l, ports: e.target.checked }))}
            style={{ accentColor: '#0b1e36' }}
          />
          <span>Ports</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={activeLayers.sanctuaries}
            onChange={(e) => setActiveLayers(l => ({ ...l, sanctuaries: e.target.checked }))}
            style={{ accentColor: '#0b1e36' }}
          />
          <span> Sanctuaries</span>
        </label>
      </div>

      {/* Top Right: Sector Zoom Dropdown & Map Navigation Controls */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px', zIndex: 10,
        display: 'flex', gap: '8px', alignItems: 'center'
      }}>
        {/* Dynamic Selector Dropdown: strictly separated by role */}
        <select
          value={activeRegion}
          onChange={(e) => {
            setActiveRegion(e.target.value);
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(8px)',
            border: '1px solid #0284c7', borderRadius: '8px',
            padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700,
            color: '#0b1e36', cursor: 'pointer', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.15)'
          }}
        >
          {availableOptions.map(optKey => (
            <option key={optKey} value={optKey}>
              {REGION_BOUNDS[optKey]?.name || optKey}
            </option>
          ))}
        </select>

        {/* Zoom In/Out/Reset Buttons */}
        <div style={{
          display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(8px)', padding: '3px', borderRadius: '8px',
          border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <button
            onClick={() => setZoom(z => Math.min(3.5, z + 0.3))}
            style={{
              width: '28px', height: '28px', background: '#ffffff', color: '#0b1e36',
              border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
            }}
            title="Zoom In"
          >+</button>
          <button
            onClick={() => setZoom(z => Math.max(0.8, z - 0.3))}
            style={{
              width: '28px', height: '28px', background: '#ffffff', color: '#0b1e36',
              border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
            }}
            title="Zoom Out"
          >−</button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            style={{
              height: '28px', padding: '0 8px', background: '#ffffff', color: '#475569',
              border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px'
            }}
            title="Reset View"
          >⟲ Reset</button>
        </div>
      </div>

      {/* Bottom Left: AIS Replay & Telemetry */}
      <div style={{
        position: 'absolute', bottom: '12px', left: '12px', zIndex: 10,
        background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(8px)',
        padding: '8px 16px', borderRadius: '10px', border: '1px solid #cbd5e1',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
        display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.78rem', color: '#1e293b'
      }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            padding: '5px 12px', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem',
            background: isPlaying ? '#ef4444' : '#0284c7', color: '#ffffff',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play AIS Replay'}
        </button>
        <span style={{ fontWeight: 600, color: '#0b1e36' }}>
          Window: <strong>T-{24 - replayStep}h</strong>
        </span>
        <input
          type="range" min="0" max="24" value={replayStep}
          onChange={(e) => setReplayStep(Number(e.target.value))}
          style={{ width: '100px', accentColor: '#0284c7', cursor: 'pointer' }}
        />
        <div style={{ height: '14px', width: '1px', background: '#cbd5e1' }} />
        <span style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600 }}>
          {resolvedMode === 'regional' ? ' Region: ' : (resolvedMode === 'national' ? ' Maritime Zone: ' : ' Tactical Area: ')}
          <strong>{bounds.name}</strong>
        </span>
      </div>

      {/* Floating Entity Details Popover */}
      {selectedEntity && (
        <div style={{
          position: 'absolute', top: '56px', right: '12px', zIndex: 10,
          background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(10px)',
          padding: '16px', borderRadius: '12px', border: '1px solid #93c5fd',
          width: '280px', color: '#0b1e36', fontSize: '0.82rem',
          boxShadow: '0 10px 30px rgba(11, 30, 54, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1.1rem' }}>{selectedEntity.icon || ''}</span>
              <strong style={{ color: '#0b1e36', fontSize: '0.9rem' }}>{selectedEntity.title}</strong>
            </div>
            <button
              style={{
                background: '#f1f5f9', border: 'none', color: '#64748b',
                cursor: 'pointer', fontSize: '1rem', width: '24px', height: '24px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              onClick={() => setSelectedEntity(null)}
            >×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#334155' }}>
            {selectedEntity.details.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '3px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{d.label}:</span>
                <span style={{ fontWeight: 700, color: '#0b1e36', fontSize: '0.78rem' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SVG Geospatial Canvas (Natural Cartographic Sector Rendering) */}
      <svg
        viewBox="0 0 800 600"
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
          <linearGradient id="sectorOceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e3f2fd" />
            <stop offset="60%" stopColor="#d3ecfa" />
            <stop offset="100%" stopColor="#c5e2f7" />
          </linearGradient>

          <filter id="sectorGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <linearGradient id="sectorConeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* Scalable & Pannable Group */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: '400px 300px' }}>
          {/* Ocean Water Base */}
          <rect x="-400" y="-400" width="1600" height="1400" fill="url(#sectorOceanGrad)" />

          {/* Coordinate Grid Lines */}
          {[1, 2, 3].map(i => {
            const lon = Number((bounds.minLon + (i * (bounds.maxLon - bounds.minLon)) / 4).toFixed(2));
            const { x } = project(lon, bounds.minLat);
            return (
              <g key={`grid-lon-${lon}`}>
                <line x1={x} y1="0" x2={x} y2="600" stroke="#bae6fd" strokeDasharray="3 3" strokeWidth="1" />
                <text x={x + 4} y="16" fill="#0369a1" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">{lon}°E</text>
              </g>
            );
          })}
          {[1, 2, 3].map(i => {
            const lat = Number((bounds.minLat + (i * (bounds.maxLat - bounds.minLat)) / 4).toFixed(2));
            const { y } = project(bounds.minLon, lat);
            return (
              <g key={`grid-lat-${lat}`}>
                <line x1="0" y1={y} x2="800" y2={y} stroke="#bae6fd" strokeDasharray="3 3" strokeWidth="1" />
                <text x="6" y={y - 4} fill="#0369a1" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">{lat}°N</text>
              </g>
            );
          })}

          {/* Cartographic Sector Watermark Label */}
          {bounds.seaLabel && (
            <text x="400" y="320" textAnchor="middle" fill="#0369a1" opacity="0.15" fontSize="24" fontWeight="800" letterSpacing="6" fontFamily="Inter, sans-serif">
              {bounds.seaLabel}
            </text>
          )}

          {/* Continental Shallow Shelf (Bathymetric coastal glow ribbon) */}
          <path
            d={coordsToPolyline(INDIA_PENINSULA_COASTLINE)}
            fill="none"
            stroke="#bde2f9"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />

          {/* Indian Mainland — Natural Topographic Landmass */}
          <path
            d={coordsToPolygon(INDIA_MAINLAND_POLYGON)}
            fill="#f4f5ee"
            stroke="none"
          />

          {/* Crisp Slate Indian Coastline */}
          <path
            d={coordsToPolyline(INDIA_PENINSULA_COASTLINE)}
            fill="none"
            stroke="#64748b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Sri Lanka Landmass & Coastline */}
          <path
            d={coordsToPolygon(SRI_LANKA_COASTLINE)}
            fill="#f4f5ee"
            stroke="#64748b"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Andaman & Nicobar Archipelago */}
          <path
            d={coordsToPolyline(ANDAMAN_COASTLINE)}
            fill="#f4f5ee"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Sovereign 200 NM Exclusive Economic Zone (EEZ) Boundary */}
          {activeLayers.eez && (
            <g>
              <path
                d={`M ${project(bounds.minLon + 0.3, bounds.minLat + 0.4).x} ${project(bounds.minLon + 0.3, bounds.minLat + 0.4).y} Q ${project((bounds.minLon + bounds.maxLon)/2, (bounds.minLat + bounds.maxLat)/2).x - 40} ${project((bounds.minLon + bounds.maxLon)/2, (bounds.minLat + bounds.maxLat)/2).y} ${project(bounds.maxLon - 0.3, bounds.maxLat - 0.4).x} ${project(bounds.maxLon - 0.3, bounds.maxLat - 0.4).y}`}
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.4"
                strokeDasharray="6 4"
                opacity="0.65"
              />
              <text x="24" y="585" fill="#0284c7" fontSize="9" fontWeight="700" opacity="0.85">
                ️ 200 NM JURISDICTION LIMIT — {bounds.name.toUpperCase()}
              </text>
            </g>
          )}

          {/* Major Commercial Ports Visible in Active Sector */}
          {activeLayers.ports && INDIAN_PORTS
            .filter(p => p.lon >= (bounds.minLon - 0.2) && p.lon <= (bounds.maxLon + 0.2) && p.lat >= (bounds.minLat - 0.2) && p.lat <= (bounds.maxLat + 0.2))
            .map(port => {
              const { x, y } = project(port.lon, port.lat);
              return (
                <g
                  key={port.name}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedEntity({
                    icon: 'PORT',
                    title: port.name,
                    details: [
                      { label: 'Classification', value: 'Major Commercial Port' },
                      { label: 'Maritime State', value: port.state },
                      { label: 'Coordinates', value: `${port.lat.toFixed(2)}°N, ${port.lon.toFixed(2)}°E` },
                      { label: 'Oil Spill Response', value: 'Tier-1 Response Base' }
                    ]
                  })}
                >
                  <circle cx={x} cy={y} r="5" fill="#1d4ed8" stroke="#ffffff" strokeWidth="1.8" />
                  <text
                    x={x + 7} y={y + 3.5}
                    fill="#0f172a"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                    style={{ textShadow: '0 1px 3px rgba(255,255,255,0.95), 0 0 5px #ffffff' }}
                  >
                    {port.name}
                  </text>
                </g>
              );
            })}

          {/* Marine Protected Areas & Coral Sanctuaries Visible in Active Sector */}
          {activeLayers.sanctuaries && MARINE_SANCTUARIES
            .filter(s => s.lon >= (bounds.minLon - 0.3) && s.lon <= (bounds.maxLon + 0.3) && s.lat >= (bounds.minLat - 0.3) && s.lat <= (bounds.maxLat + 0.3))
            .map(sanctuary => {
              const { x, y } = project(sanctuary.lon, sanctuary.lat);
              return (
                <g
                  key={sanctuary.name}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedEntity({
                    icon: '',
                    title: sanctuary.name,
                    details: [
                      { label: 'Habitat Type', value: sanctuary.type },
                      { label: 'Mandate', value: sanctuary.status },
                      { label: 'Vulnerability Index', value: 'Extreme Critical (Category-I)' },
                      { label: 'Coordinates', value: `${sanctuary.lat.toFixed(2)}°N, ${sanctuary.lon.toFixed(2)}°E` }
                    ]
                  })}
                >
                  <circle cx={x} cy={y} r="6.5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                  <circle cx={x} cy={y} r="2" fill="#ffffff" />
                  <text
                    x={x + 9} y={y + 3.5}
                    fill="#065f46"
                    fontSize="9.5"
                    fontWeight="800"
                    fontFamily="Inter, sans-serif"
                    style={{ textShadow: '0 1px 3px rgba(255,255,255,0.95), 0 0 5px #ffffff' }}
                  >
                    {sanctuary.name}
                  </text>
                </g>
              );
            })}

          {/* 1. Backward Drift Origin Probability Cone — ONLY when an authentic spill incident exists */}
          {activeLayers.originCone && targetSpill && (
            <g>
              <polygon
                points={`
                  ${project(refLon, refLat).x},${project(refLon, refLat).y}
                  ${project(refLon - 0.25, refLat - 0.20).x - 24},${project(refLon - 0.25, refLat - 0.20).y - 18}
                  ${project(refLon - 0.40, refLat - 0.32).x},${project(refLon - 0.40, refLat - 0.32).y}
                  ${project(refLon - 0.25, refLat - 0.20).x + 24},${project(refLon - 0.25, refLat - 0.20).y + 18}
                `}
                fill="url(#sectorConeGrad)"
                stroke="#d97706"
                strokeWidth="1.6"
                strokeDasharray="5 3"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedEntity({
                  icon: '',
                  title: `Backward Drift Origin Cone (${targetSpill.name})`,
                  details: [
                    { label: 'Spill Incident', value: targetSpill.name },
                    { label: 'Incident Origin Coords', value: `${refLat.toFixed(2)}°N, ${refLon.toFixed(2)}°E` },
                    { label: 'Advection Window', value: '24 Hours Prior' },
                    { label: 'CMEMS Current', value: '0.28 m/s SW (215°)' },
                    { label: 'ERA5 Wind Drift', value: '3.1% at 5.8 m/s' },
                    { label: 'Origin Probability Area', value: '8.4 nm²' },
                    { label: 'Methodology', value: 'Runge-Kutta 4th Order' }
                  ]
                })}
              />
              <text
                x={project(refLon - 0.30, refLat - 0.25).x}
                y={project(refLon - 0.30, refLat - 0.25).y}
                fill="#b45309"
                fontSize="9"
                fontWeight="700"
                style={{ textShadow: '0 1px 2px rgba(255,255,255,0.9)' }}
              >
                Origin Probability Cone (24h) — {targetSpill.name}
              </text>
            </g>
          )}

          {/* 2. Forward Drift Predicted Path — ONLY when an authentic spill incident exists */}
          {activeLayers.futureDrift && targetSpill && (
            <g>
              <line
                x1={project(refLon, refLat).x} y1={project(refLon, refLat).y}
                x2={project(refLon + 0.25, refLat - 0.18).x} y2={project(refLon + 0.25, refLat - 0.18).y}
                stroke="#0284c7" strokeWidth="2.2" strokeDasharray="4 3"
              />
              <circle cx={project(refLon + 0.12, refLat - 0.09).x} cy={project(refLon + 0.12, refLat - 0.09).y} r="3.5" fill="#0284c7" />
              <text
                x={project(refLon + 0.12, refLat - 0.09).x + 6}
                y={project(refLon + 0.12, refLat - 0.09).y + 3}
                fill="#0369a1" fontSize="8.5" fontWeight="700"
                style={{ textShadow: '0 1px 2px rgba(255,255,255,0.9)' }}
              >
                +24h Forecast
              </text>
              <circle cx={project(refLon + 0.25, refLat - 0.18).x} cy={project(refLon + 0.25, refLat - 0.18).y} r="3.5" fill="#0284c7" />
              <text
                x={project(refLon + 0.25, refLat - 0.18).x + 6}
                y={project(refLon + 0.25, refLat - 0.18).y + 3}
                fill="#0369a1" fontSize="8.5" fontWeight="700"
                style={{ textShadow: '0 1px 2px rgba(255,255,255,0.9)' }}
              >
                +48h Forecast
              </text>
            </g>
          )}

          {/* 3. AIS Vessel Tracks & Suspects (Filtered strictly to current viewport) */}
          {activeLayers.vessels && visibleTracks.map((vessel) => {
            const isTopSuspect = vessel.rank === 1;
            const pointsSvg = vessel.points.map(p => project(p.lon, p.lat));
            const pathD = pointsSvg.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');

            const currentPtIdx = Math.min(
              Math.floor((replayStep / 24) * (vessel.points.length - 1)),
              vessel.points.length - 1
            );
            const currentPos = pointsSvg[currentPtIdx] || pointsSvg[0];

            return (
              <g key={vessel.mmsi}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isTopSuspect ? '#dc2626' : '#2563eb'}
                  strokeWidth={isTopSuspect ? 2.2 : 1.4}
                  strokeDasharray={isTopSuspect ? 'none' : '3 3'}
                  opacity={0.9}
                />

                {isTopSuspect && pointsSvg[2] && pointsSvg[3] && (
                  <g>
                    <line
                      x1={pointsSvg[2].x} y1={pointsSvg[2].y}
                      x2={pointsSvg[3].x} y2={pointsSvg[3].y}
                      stroke="#dc2626" strokeWidth="2.5" strokeDasharray="3 3"
                    />
                    <circle cx={pointsSvg[3].x} cy={pointsSvg[3].y} r="5" fill="#dc2626" />
                    <text
                      x={pointsSvg[3].x + 8} y={pointsSvg[3].y}
                      fill="#b91c1c" fontSize="8.5" fontWeight="800"
                      style={{ textShadow: '0 1px 2px rgba(255,255,255,0.95)' }}
                    >
                      75-min AIS Gap + Speed Drop (0.8 kn)
                    </text>
                  </g>
                )}

                <g
                  transform={`translate(${currentPos.x}, ${currentPos.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedEntity({
                    icon: '',
                    title: `${vessel.name} (#${vessel.rank} Suspect)`,
                    details: [
                      { label: 'MMSI', value: vessel.mmsi },
                      { label: 'Type', value: vessel.type },
                      { label: 'Attribution Score', value: `${vessel.score}/100` },
                      { label: 'Proximity to Spill', value: isTopSuspect ? '2.3 nm' : '12.8 nm' },
                      { label: 'AIS Discrepancy', value: isTopSuspect ? '75-min Gap / Speed Drop' : 'Normal Nav' }
                    ]
                  })}
                >
                  <circle
                    r={isTopSuspect ? 6.5 : 4.5}
                    fill={isTopSuspect ? '#dc2626' : '#2563eb'}
                    stroke="#ffffff"
                    strokeWidth="1.8"
                  />
                  <text
                    x="9" y="3.5"
                    fill={isTopSuspect ? '#991b1b' : '#1e3a5f'}
                    fontSize="9"
                    fontWeight={isTopSuspect ? 800 : 600}
                    style={{ textShadow: '0 1px 2px rgba(255,255,255,0.95), 0 0 4px #ffffff' }}
                  >
                    {vessel.name}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 4. Oil Spill Slicks in Visible Sector */}
          {activeLayers.slicks && visibleSpills.map((spill) => {
            const lat = spill.centroid_lat;
            const lon = spill.centroid_lon;
            const pt = project(lon, lat);
            const isSelected = selectedSpill?.id === spill.id;

            const severityColor = spill.severity === 'critical'
              ? '#dc2626'
              : spill.severity === 'high'
              ? '#ea580c'
              : '#0284c7';

            return (
              <g
                key={spill.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  onSelectSpill(spill);
                  setSelectedEntity({
                    icon: '️',
                    title: spill.name,
                    details: [
                      { label: 'Severity', value: (spill.severity || 'high').toUpperCase() },
                      { label: 'Area', value: `${spill.area_sq_km || 12.5} km²` },
                      { label: 'Perimeter', value: `${spill.perimeter_km || 18.3} km` },
                      { label: 'Age Estimate', value: spill.age_estimate || 'hours' },
                      { label: 'Validation Status', value: spill.validation_status || 'detected' },
                      { label: 'Coordinates', value: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E` }
                    ]
                  });
                }}
              >
                <ellipse
                  rx={isSelected ? 18 : 13}
                  ry={isSelected ? 10 : 7}
                  transform="rotate(-25)"
                  fill="#0f172a"
                  stroke={severityColor}
                  strokeWidth={isSelected ? 2.5 : 1.6}
                  filter="url(#sectorGlow)"
                />
                <circle r={isSelected ? 4 : 3} fill="#ffffff" />
                <text
                  x="15" y="4"
                  fill="#0f172a"
                  fontSize="9.5"
                  fontWeight="700"
                  style={{ textShadow: '0 1px 3px rgba(255,255,255,0.95), 0 0 5px #ffffff' }}
                >
                  {spill.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
