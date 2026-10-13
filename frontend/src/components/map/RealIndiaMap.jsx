import { useEffect, useRef, useState } from 'react';
import { Map, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  IMPORTANT_PORTS,
  IMPORTANT_SANCTUARIES
} from './indiaMapData';
import indiaCoralSands from './indiaCoralSands.json';

// Clean free OpenStreetMap-based style
const MAP_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

// Static default framing perfectly centered on sovereign Indian coastline
const DEFAULT_CENTER = [79.2, 19.5];
const DEFAULT_ZOOM = 4.35;

export default function RealIndiaMap({
  selectedIncident,
  setSelectedIncident,
  mapLayers,
  setMapLayers,
  spillMarkers
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize MapLibre — locked / static view framing India cleanly
  useEffect(() => {
    if (!mapContainer.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const map = new Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 3.5,
      maxZoom: 9.0,
      // Static map: disable accidental scrolling/pitching/rotation while browsing
      dragPan: false,
      scrollZoom: false,
      doubleClickZoom: false,
      dragRotate: false,
      touchPitch: false,
      touchZoomRotate: false,
      keyboard: false,
      boxZoom: false
    });

    mapRef.current = map;

    map.on('load', () => {
      map.jumpTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 0,
        bearing: 0
      });

      // Authentic Marine Protected Areas, Coral Reefs & Sand Reserve Polygons (Real Data)
      try {
        map.addSource('india-coral-sands', {
          type: 'geojson',
          data: indiaCoralSands
        });

        // Translucent polygon fill
        map.addLayer({
          id: 'coral-sands-fill',
          type: 'fill',
          source: 'india-coral-sands',
          layout: {
            visibility: mapLayers.sanctuaries !== false ? 'visible' : 'none'
          },
          paint: {
            'fill-color': [
              'match',
              ['get', 'name'],
              'Sundarbans Biosphere Reserve', '#059669',
              'Gahirmatha Marine Sanctuary', '#d97706',
              'Lakshadweep Coral Sands', '#0d9488',
              '#10b981'
            ],
            'fill-opacity': 0.45
          }
        });

        // Crisp polygon boundary outline
        map.addLayer({
          id: 'coral-sands-outline',
          type: 'line',
          source: 'india-coral-sands',
          layout: {
            visibility: mapLayers.sanctuaries !== false ? 'visible' : 'none'
          },
          paint: {
            'line-color': [
              'match',
              ['get', 'name'],
              'Sundarbans Biosphere Reserve', '#047857',
              'Gahirmatha Marine Sanctuary', '#b45309',
              'Lakshadweep Coral Sands', '#0f766e',
              '#059669'
            ],
            'line-width': 1.4,
            'line-opacity': 0.85
          }
        });

        // Interactive click on real coral & sand polygons
        map.on('click', 'coral-sands-fill', (e) => {
          if (!e.features || !e.features.length) return;
          const feat = e.features[0];
          const p = feat.properties || {};
          setSelectedIncident({
            spill_name: p.name || 'Marine Protected Habitat',
            severity: p.type || 'Schedule-I Sanctuary',
            priority: 'Eco-Critical',
            affected_area_sq_km: p.area_sq_km ? `${p.area_sq_km} km²` : 'Schedule-I Core',
            coast_proximity_km: 'Protected Marine & Coral Sands',
            overlaps_coral: true,
            nearest_mpa_name: p.name,
            nearest_mpa_distance_km: '0 km (Direct Habitat)',
            centroid_lat: e.lngLat.lat,
            centroid_lon: e.lngLat.lng,
            vulnerability_details: p.notes || `Authentic GIS polygon feature from national marine reserve data. Coordinates: ${e.lngLat.lat.toFixed(3)}°N, ${e.lngLat.lng.toFixed(3)}°E.`
          });
        });

        map.on('mouseenter', 'coral-sands-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'coral-sands-fill', () => {
          map.getCanvas().style.cursor = '';
        });
      } catch (err) {
        console.warn('Coral & Sands source/layer error:', err);
      }

      // Mount Clean, Non-Colliding Markers
      renderDomMarkers(map);

      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
    };
  }, []);

  // Directional placement helper for non-overlapping labels
  const getDirectionalStyle = (dir) => {
    switch (dir) {
      case 'west':
        return 'right: calc(100% + 8px); top: 50%; transform: translateY(-50%);';
      case 'east':
        return 'left: calc(100% + 8px); top: 50%; transform: translateY(-50%);';
      case 'north':
        return 'bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);';
      case 'south':
      default:
        return 'top: calc(100% + 8px); left: 50%; transform: translateX(-50%);';
    }
  };

  // Function to create clean, clearly placed markers
  const renderDomMarkers = (map) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // A. Oil Spill Incidents (Radar Slicks)
    (spillMarkers || []).forEach(sp => {
      const el = document.createElement('div');
      el.className = 'sarvas-map-marker marker-slick';
      el.dataset.type = 'slick';
      el.dataset.id = sp.id;
      el.style.display = mapLayers.slicks ? 'block' : 'none';
      el.style.position = 'absolute';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.cursor = 'pointer';

      const isCrit = sp.priority === 'critical' || sp.coral;
      const coreColor = isCrit ? '#dc2626' : '#ea580c';
      const isSelected = selectedIncident?.centroid_lat === sp.lat && selectedIncident?.centroid_lon === sp.lon;
      if (isSelected) el.classList.add('active');

      // Non-overlapping label placement
      const labelDir = sp.labelDir || (sp.lon < 75.0 ? 'west' : (sp.lat < 12.0 ? 'east' : 'west'));
      const dirStyle = getDirectionalStyle(labelDir);

      const shortName = sp.name
        .replace(' Offshore Sector', '')
        .replace(' Deepwater Channel', '')
        .replace(' Coral Biosphere', '')
        .replace(' Deepwater Basin', '');

      el.innerHTML = `
        <div style="position: relative; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid ${coreColor}; animation: sarvasPulse 2s infinite; pointer-events: none;"></div>
          <div style="width: 10px; height: 10px; border-radius: 50%; background: ${coreColor}; border: 1.5px solid #ffffff; box-shadow: 0 0 10px ${coreColor}; z-index: 2;"></div>
          <div class="sarvas-label" style="position: absolute; ${dirStyle} background: rgba(15, 23, 42, 0.94); color: #ffffff; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 700; white-space: nowrap; border: 1px solid ${coreColor}; box-shadow: 0 3px 10px rgba(0,0,0,0.45); backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px; pointer-events: none;">
            <span>${shortName}</span>
            <span style="font-size: 7.5px; padding: 0.5px 3.5px; border-radius: 2px; background: ${coreColor}; color: #fff; font-weight: 800; text-transform: uppercase;">${sp.severity}</span>
          </div>
        </div>
      `;

      el.title = `${sp.name} — ${sp.area} km² [${sp.lat.toFixed(3)}°N, ${sp.lon.toFixed(3)}°E]`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedIncident({
          spill_name: sp.name,
          severity: sp.severity,
          priority: sp.priority,
          affected_area_sq_km: sp.area,
          coast_proximity_km: sp.coastDist,
          overlaps_coral: sp.coral === true || sp.coral === 'true',
          nearest_mpa_name: sp.coral ? 'Marine Protected Biosphere' : 'Offshore Deepwater Channel',
          nearest_mpa_distance_km: sp.mpaDist,
          centroid_lat: sp.lat,
          centroid_lon: sp.lon,
          vulnerability_details: sp.desc
        });
      });

      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([sp.lon, sp.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // B. Strategic Key Ports (Kandla, Mumbai, Kochi, Chennai, Vizag)
    IMPORTANT_PORTS.forEach(p => {
      const el = document.createElement('div');
      el.className = 'sarvas-map-marker marker-port';
      el.dataset.type = 'port';
      el.style.display = mapLayers.ports ? 'block' : 'none';
      el.style.position = 'absolute';
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.cursor = 'pointer';

      const isSelected = selectedIncident?.centroid_lat === p.lat && selectedIncident?.centroid_lon === p.lon;
      if (isSelected) el.classList.add('active');

      const dirStyle = getDirectionalStyle(p.labelDir || 'east');

      el.innerHTML = `
        <div style="position: relative; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 9px; height: 9px; border-radius: 50%; background: #1d4ed8; border: 1.5px solid #ffffff; box-shadow: 0 1px 5px rgba(29,78,216,0.5); z-index: 2;"></div>
          <div class="sarvas-label" style="position: absolute; ${dirStyle} background: rgba(15, 23, 42, 0.94); color: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; white-space: nowrap; border: 1px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.35); backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px; pointer-events: none;">
            <span>${p.shortName || p.name}</span>
            <span style="font-size: 7px; padding: 0.5px 3px; border-radius: 2px; background: #1e40af; color: #93c5fd; font-weight: 800;">PORT</span>
          </div>
        </div>
      `;

      el.title = `Port: ${p.name} (${p.state}) [${p.lat.toFixed(2)}°N, ${p.lon.toFixed(2)}°E]`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedIncident({
          spill_name: p.name,
          severity: 'Major Port',
          priority: 'Port Facility',
          affected_area_sq_km: 'Harbor Channel',
          coast_proximity_km: `${p.state} Coast`,
          overlaps_coral: false,
          nearest_mpa_name: `${p.state} Maritime Gateway`,
          nearest_mpa_distance_km: 'Direct Coastal Link',
          centroid_lat: p.lat,
          centroid_lon: p.lon,
          vulnerability_details: `Major commercial shipping and strategic port terminal in ${p.state}. Exact Coordinates: ${p.lat}°N, ${p.lon}°E.`
        });
      });

      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([p.lon, p.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // C. Schedule-I Marine Sanctuaries & Sands
    IMPORTANT_SANCTUARIES.forEach(s => {
      const el = document.createElement('div');
      el.className = 'sarvas-map-marker marker-sanctuary';
      el.dataset.type = 'sanctuary';
      el.style.display = mapLayers.sanctuaries ? 'block' : 'none';
      el.style.position = 'absolute';
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.cursor = 'pointer';

      const isSelected = selectedIncident?.centroid_lat === s.lat && selectedIncident?.centroid_lon === s.lon;
      if (isSelected) el.classList.add('active');

      const dirStyle = getDirectionalStyle(s.labelDir || 'south');

      el.innerHTML = `
        <div style="position: relative; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 9px; height: 9px; border-radius: 50%; background: #059669; border: 1.5px solid #ffffff; box-shadow: 0 1px 5px rgba(5,150,105,0.5); z-index: 2;"></div>
          <div class="sarvas-label" style="position: absolute; ${dirStyle} background: rgba(15, 23, 42, 0.94); color: #ecfdf5; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; white-space: nowrap; border: 1px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.35); backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px; pointer-events: none;">
            <span>${s.shortLabel || s.name}</span>
            <span style="font-size: 7px; padding: 0.5px 3px; border-radius: 2px; background: #065f46; color: #6ee7b7; font-weight: 800;">MPA & SANDS</span>
          </div>
        </div>
      `;

      el.title = `Sanctuary: ${s.name} [${s.lat.toFixed(2)}°N, ${s.lon.toFixed(2)}°E] — ${s.type}`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedIncident({
          spill_name: s.name,
          severity: 'Protected MPA & Sands',
          priority: 'Eco-Critical',
          affected_area_sq_km: 'Schedule-I Core',
          coast_proximity_km: 'Coastal / Intertidal',
          overlaps_coral: true,
          nearest_mpa_name: s.type,
          nearest_mpa_distance_km: '0 km (Core Biosphere)',
          centroid_lat: s.lat,
          centroid_lon: s.lon,
          vulnerability_details: `${s.type} • Status: ${s.status}. Exact Coordinates: ${s.lat}°N, ${s.lon}°E.`
        });
      });

      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([s.lon, s.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  };

  // Sync layer visibility with parent state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer('coral-sands-fill')) {
      map.setLayoutProperty('coral-sands-fill', 'visibility', mapLayers.sanctuaries !== false ? 'visible' : 'none');
    }
    if (map.getLayer('coral-sands-outline')) {
      map.setLayoutProperty('coral-sands-outline', 'visibility', mapLayers.sanctuaries !== false ? 'visible' : 'none');
    }

    markersRef.current.forEach(m => {
      const el = m.getElement();
      const type = el.dataset.type;
      if (type === 'slick') {
        el.style.display = mapLayers.slicks ? 'block' : 'none';
      } else if (type === 'port') {
        el.style.display = mapLayers.ports ? 'block' : 'none';
      } else if (type === 'sanctuary') {
        el.style.display = mapLayers.sanctuaries ? 'block' : 'none';
      }
    });
  }, [mapLayers, mapLoaded]);

  // Highlight active marker when selectedIncident changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    markersRef.current.forEach(m => {
      const el = m.getElement();
      const lngLat = m.getLngLat();
      const isMatch = selectedIncident &&
        Math.abs(lngLat.lat - (selectedIncident.centroid_lat || 0)) < 0.05 &&
        Math.abs(lngLat.lng - (selectedIncident.centroid_lon || 0)) < 0.05;

      if (isMatch) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }, [selectedIncident, mapLoaded]);

  // Re-render markers if spillMarkers update
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    renderDomMarkers(map);
  }, [spillMarkers, mapLoaded]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Clean keyframe animation and styling */}
      <style>{`
        @keyframes sarvasPulse {
          0% { transform: scale(0.6); opacity: 1; }
          70% { transform: scale(1.6); opacity: 0.12; }
          100% { transform: scale(0.6); opacity: 0; }
        }
        /* Hide MapLibre logo & attribution clutter */
        .maplibregl-ctrl-logo { display: none !important; }
        .maplibregl-ctrl-attrib { display: none !important; }

        /* Marker Root Element */
        .sarvas-map-marker {
          position: absolute !important;
          z-index: 15;
          user-select: none;
          transition: filter 0.15s ease;
        }
        .sarvas-map-marker:hover {
          z-index: 50;
          filter: brightness(1.2);
        }
        .sarvas-map-marker.active {
          z-index: 60;
        }
        .sarvas-map-marker.active .sarvas-label {
          border-color: #ffffff !important;
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.9) !important;
        }
      `}</style>

      {/* MapLibre DOM Container */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%', borderRadius: 16 }} />

      {/* Floating Zoom & Whole India Reset Controls — top-right */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 15,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: 4,
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
      }}>
        <button
          onClick={() => mapRef.current?.zoomIn()}
          style={{
            width: 28, height: 28, border: 'none', background: 'transparent',
            color: '#0f172a', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Zoom In"
        >+</button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          style={{
            width: 28, height: 28, border: 'none', background: 'transparent',
            color: '#0f172a', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Zoom Out"
        >−</button>
        <div style={{ height: 1, background: '#e2e8f0', margin: '2px 2px' }} />
        <button
          onClick={() => mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, speed: 1.2, essential: true })}
          style={{
            width: 28, height: 28, border: 'none', background: '#f1f5f9',
            color: '#0284c7', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Reset Whole India View"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </button>
      </div>

      {/* Floating "India" badge — top-left clean label */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '6px 14px',
        borderRadius: 10,
        border: '1px solid rgba(2, 132, 199, 0.3)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
      }}>
        {/* Crisp SVG Indian Tricolour Flag */}
        <svg width="18" height="12" viewBox="0 0 900 600" style={{ borderRadius: 2, flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
          <rect width="900" height="200" fill="#FF9933" />
          <rect y="200" width="900" height="200" fill="#FFFFFF" />
          <rect y="400" width="900" height="200" fill="#138808" />
          <circle cx="450" cy="300" r="70" fill="none" stroke="#000080" strokeWidth="18" />
        </svg>
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 800,
          color: '#0369a1',
          letterSpacing: '0.4px'
        }}>
          India Marine & Coral Sanctuaries
        </span>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 6px #10b981',
          display: 'inline-block',
          marginLeft: 2
        }} />
        <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700 }}>Real GIS Feed</span>
      </div>

      {/* Map source attribution — bottom right */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 12,
        zIndex: 10,
        fontSize: '0.65rem',
        color: '#64748b',
        background: 'rgba(255,255,255,0.85)',
        padding: '2px 8px',
        borderRadius: 6
      }}>
        © OpenStreetMap contributors
      </div>
    </div>
  );
}
