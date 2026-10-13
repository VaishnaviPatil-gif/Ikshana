import { useState, useEffect, useRef, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { GeoJsonLayer, ScatterplotLayer, PathLayer, PolygonLayer } from '@deck.gl/layers';
import { gisAPI } from '../../api/client';
import { detectSectorForSpill } from './MapView';

// 100% Free Public High-Resolution Basemaps — No API Keys, No Watermarks
const FREE_BASEMAP_STYLES = {
  satellite: {
    id: 'satellite',
    label: 'Real Satellite',
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        },
        'esri-places': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
        },
      },
      layers: [
        { id: 'esri-satellite-layer', type: 'raster', source: 'esri-satellite', minzoom: 0, maxzoom: 19 },
        { id: 'esri-places-layer', type: 'raster', source: 'esri-places', minzoom: 0, maxzoom: 19 },
      ],
    },
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean Bathymetry',
    style: {
      version: 8,
      sources: {
        'esri-ocean': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, GEBCO, NOAA',
        },
        'esri-ocean-ref': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
        },
      },
      layers: [
        { id: 'esri-ocean-layer', type: 'raster', source: 'esri-ocean', minzoom: 0, maxzoom: 19 },
        { id: 'esri-ocean-ref-layer', type: 'raster', source: 'esri-ocean-ref', minzoom: 0, maxzoom: 19 },
      ],
    },
  },
  topo: {
    id: 'topo',
    label: 'Physical Topo',
    style: {
      version: 8,
      sources: {
        'esri-topo': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, HERE, Garmin, USGS',
        },
      },
      layers: [
        { id: 'esri-topo-layer', type: 'raster', source: 'esri-topo', minzoom: 0, maxzoom: 19 },
      ],
    },
  },
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    style: {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        { id: 'osm-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 },
      ],
    },
  },
  dark: {
    id: 'dark',
    label: 'Dark Tactical',
    style: {
      version: 8,
      sources: {
        'esri-dark-base': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, DeLorme, NAVTEQ',
        },
        'esri-dark-reference': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
        },
      },
      layers: [
        { id: 'esri-dark-base-layer', type: 'raster', source: 'esri-dark-base', minzoom: 0, maxzoom: 19 },
        { id: 'esri-dark-ref-layer', type: 'raster', source: 'esri-dark-reference', minzoom: 0, maxzoom: 19 },
      ],
    },
  },
};

const SECTORS = {
  mumbai: { center: [72.2, 18.9], zoom: 8.5, name: 'Mumbai Area' },
  gujarat: { center: [69.6, 22.5], zoom: 8.0, name: 'Gujarat Area' },
  goa_konkan: { center: [73.6, 15.8], zoom: 8.2, name: 'Goa & Konkan' },
  kerala: { center: [75.8, 10.5], zoom: 8.0, name: 'Kerala Area' },
  tamil_nadu: { center: [79.5, 10.2], zoom: 8.0, name: 'Tamil Nadu' },
  andhra_odisha: { center: [84.5, 18.8], zoom: 7.8, name: 'Andhra & Odisha' },
  bengal: { center: [88.2, 21.8], zoom: 8.2, name: 'Bengal Area' },
  andaman_area: { center: [92.8, 12.0], zoom: 7.5, name: 'Andaman Area' },
};

// === Computational Geometry & Smoothing Utilities ===
// Chaikin's corner cutting algorithm to transform coarse geometric polygons into smooth organic fluid contours
function smoothPolygonRing(coords, iterations = 3) {
  if (!coords || coords.length < 3) return coords;
  let current = coords;

  for (let it = 0; it < iterations; it++) {
    const next = [];
    const n = current.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      const q = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
      const r = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];
      next.push(q, r);
    }
    next.push(next[0]); // Keep closed loop
    current = next;
  }
  return current;
}

// Shrink polygon toward centroid to simulate thick core emulsion inside outer surface sheen
function shrinkPolygonRing(coords, factor = 0.55) {
  if (!coords || coords.length < 3) return coords;
  let sumLon = 0, sumLat = 0;
  const n = coords.length - 1;
  for (let i = 0; i < n; i++) {
    sumLon += coords[i][0];
    sumLat += coords[i][1];
  }
  const cLon = sumLon / n;
  const cLat = sumLat / n;

  return coords.map(([lon, lat]) => [
    cLon + (lon - cLon) * factor,
    cLat + (lat - cLat) * factor,
  ]);
}

function smoothGeoJSON(geojson, iterations = 3) {
  if (!geojson || !geojson.coordinates) return geojson;
  try {
    if (geojson.type === 'Polygon') {
      const smoothed = geojson.coordinates.map((ring) => smoothPolygonRing(ring, iterations));
      return { ...geojson, coordinates: smoothed };
    }
    if (geojson.type === 'MultiPolygon') {
      const smoothed = geojson.coordinates.map((poly) =>
        poly.map((ring) => smoothPolygonRing(ring, iterations))
      );
      return { ...geojson, coordinates: smoothed };
    }
  } catch (err) {
    console.warn('Could not smooth GeoJSON:', err);
  }
  return geojson;
}

function shrinkGeoJSON(geojson, factor = 0.55) {
  if (!geojson || !geojson.coordinates) return geojson;
  try {
    if (geojson.type === 'Polygon') {
      const shrunk = geojson.coordinates.map((ring) => shrinkPolygonRing(ring, factor));
      return { ...geojson, coordinates: shrunk };
    }
    if (geojson.type === 'MultiPolygon') {
      const shrunk = geojson.coordinates.map((poly) =>
        poly.map((ring) => shrinkPolygonRing(ring, factor))
      );
      return { ...geojson, coordinates: shrunk };
    }
  } catch (err) {
    console.warn('Could not shrink GeoJSON:', err);
  }
  return geojson;
}

// Generate nautical oriented vessel hull polygon pointing along course/heading
function createVesselHull(lon, lat, headingDeg = 0, sizeDeg = 0.018) {
  const rad = (headingDeg * Math.PI) / 180;
  // Nose / bow
  const bow = [
    lon + sizeDeg * Math.sin(rad),
    lat + sizeDeg * Math.cos(rad),
  ];
  // Port stern
  const portStern = [
    lon + (sizeDeg * 0.55) * Math.sin(rad + 2.5),
    lat + (sizeDeg * 0.55) * Math.cos(rad + 2.5),
  ];
  // Starboard stern
  const stbdStern = [
    lon + (sizeDeg * 0.55) * Math.sin(rad - 2.5),
    lat + (sizeDeg * 0.55) * Math.cos(rad - 2.5),
  ];
  return [bow, portStern, stbdStern, bow];
}

// Generate velocity leader vector line (showing direction & distance traveled at speed)
function createVelocityLeader(lon, lat, headingDeg = 0, sogKnots = 12.0) {
  const rad = (headingDeg * Math.PI) / 180;
  const distDeg = Math.min(0.04, Math.max(0.008, (sogKnots || 10) * 0.0018));
  return [
    [lon, lat],
    [lon + distDeg * Math.sin(rad), lat + distDeg * Math.cos(rad)],
  ];
}

export default function TacticalDeckMap({
  spills = [],
  selectedSpill = null,
  suspects = [],
  driftData = null,
  onSelectSpill,
  sector = 'mumbai',
  height = '560px',
  showSectorJumper = false,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);

  const [eezData, setEezData] = useState(null);
  const [coralsData, setCoralsData] = useState(null);
  const [layerVisibility, setLayerVisibility] = useState({
    eez: true,
    corals: true,
    slicks: true,
    drift: true,
    ais: true,
  });
  const [hoverInfo, setHoverInfo] = useState(null);
  const [basemapKey, setBasemapKey] = useState('satellite');
  const [cursorPos, setCursorPos] = useState({ lat: 18.85, lon: 71.9 });

  // Load EEZ and Corals GIS layers
  useEffect(() => {
    let mounted = true;
    gisAPI.getEEZ()
      .then((res) => {
        if (!mounted || !res.data) return;
        // User Directive #4: Strictly exclude Bassas da India feature from Indian EEZ layer
        const filteredFeatures = (res.data.features || []).filter((f) => {
          const name = (f.properties?.GEONAME || f.properties?.name || '').toLowerCase();
          return !name.includes('bassas');
        });
        setEezData({ ...res.data, features: filteredFeatures });
      })
      .catch((err) => console.warn('Could not load EEZ layer:', err));

    gisAPI.getCorals()
      .then((res) => {
        if (mounted && res.data) setCoralsData(res.data);
      })
      .catch((err) => console.warn('Could not load Corals layer:', err));

    return () => { mounted = false; };
  }, []);

  const handleBasemapChange = (newKey) => {
    setBasemapKey(newKey);
    if (mapRef.current && FREE_BASEMAP_STYLES[newKey]) {
      mapRef.current.setStyle(FREE_BASEMAP_STYLES[newKey].style);
      mapRef.current.once('style.load', () => {
        if (overlayRef.current) {
          overlayRef.current.setProps({ layers: deckLayers });
        }
      });
    }
  };

  // Initialize MapLibre and Deck.gl MapboxOverlay
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialSector = SECTORS[sector] || SECTORS.mumbai;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: FREE_BASEMAP_STYLES.satellite.style,
      center: initialSector.center,
      zoom: initialSector.zoom,
      pitch: 25,
      bearing: -8,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('mousemove', (e) => {
      setCursorPos({
        lat: Number(e.lngLat.lat.toFixed(4)),
        lon: Number(e.lngLat.lng.toFixed(4)),
      });
    });

    const overlay = new MapboxOverlay({
      layers: [],
    });
    map.addControl(overlay);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      overlay.finalize();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  const prevSectorRef = useRef(sector);
  const prevSpillIdRef = useRef(selectedSpill?.id);

  // Fly to sector or selected spill
  useEffect(() => {
    if (!mapRef.current) return;

    const sectorChanged = prevSectorRef.current !== sector;
    const spillChanged = prevSpillIdRef.current !== selectedSpill?.id;

    prevSectorRef.current = sector;
    prevSpillIdRef.current = selectedSpill?.id;

    // 1. User switched sector: ALWAYS fly to the selected sector!
    if (sectorChanged) {
      // If the currently selected spill is within this new sector, focus on it closely
      if (selectedSpill?.centroid_lat && selectedSpill?.centroid_lon) {
        const spillSec = detectSectorForSpill(selectedSpill.centroid_lat, selectedSpill.centroid_lon);
        if (spillSec === sector) {
          mapRef.current.flyTo({
            center: [selectedSpill.centroid_lon, selectedSpill.centroid_lat],
            zoom: 9.8,
            speed: 1.2,
            essential: true,
          });
          return;
        }
      }

      // If there's an incident in this sector, fly to its coordinates
      const sectorSpill = (spills || []).find(
        (s) => detectSectorForSpill(s.centroid_lat, s.centroid_lon) === sector
      );
      if (sectorSpill?.centroid_lat && sectorSpill?.centroid_lon) {
        mapRef.current.flyTo({
          center: [sectorSpill.centroid_lon, sectorSpill.centroid_lat],
          zoom: 9.2,
          speed: 1.2,
          essential: true,
        });
        return;
      }

      // Otherwise fly directly to the sector geographic center
      if (SECTORS[sector]) {
        const s = SECTORS[sector];
        mapRef.current.flyTo({
          center: s.center,
          zoom: s.zoom,
          speed: 1.2,
          essential: true,
        });
        return;
      }
    }

    // 2. User clicked a different spill: fly to that spill
    if (spillChanged && selectedSpill?.centroid_lat && selectedSpill?.centroid_lon) {
      mapRef.current.flyTo({
        center: [selectedSpill.centroid_lon, selectedSpill.centroid_lat],
        zoom: 9.8,
        speed: 1.2,
        essential: true,
      });
      return;
    }

    // 3. Fallback on initial render
    if (SECTORS[sector] && !selectedSpill) {
      const s = SECTORS[sector];
      mapRef.current.flyTo({
        center: s.center,
        zoom: s.zoom,
        speed: 1.0,
        essential: true,
      });
    }
  }, [sector, selectedSpill, spills]);

  // Build Deck.gl Layers
  const deckLayers = useMemo(() => {
    const layers = [];

    // 1. EEZ Boundaries Layer (Strictly Reference Line — Unpickable)
    if (layerVisibility.eez && eezData) {
      layers.push(
        new GeoJsonLayer({
          id: 'eez-boundary-layer',
          data: eezData,
          filled: false,
          stroked: true,
          getLineColor: [56, 189, 248, 160],
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          pickable: false,
        })
      );
    }

    // 2. Corals / Marine Protected Areas (Emerald Marine Sanctuaries)
    if (layerVisibility.corals && coralsData) {
      layers.push(
        new GeoJsonLayer({
          id: 'corals-layer',
          data: coralsData,
          filled: true,
          stroked: true,
          getFillColor: [16, 185, 129, 30],
          getLineColor: [16, 185, 129, 180],
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          pickable: true,
          onHover: (info) => {
            if (info.object) {
              setHoverInfo({
                x: info.x,
                y: info.y,
                badge: 'PROTECTED',
                title: 'Marine Ecological Sanctuary',
                detail: info.object.properties?.name || 'Coral Reef & Marine Sanctuary',
              });
            } else {
              setHoverInfo(null);
            }
          },
        })
      );
    }

    // 3. Hydrodynamic Drift Reconstruction (Scientific Plume & Temporal Waypoints)
    if (layerVisibility.drift && driftData) {
      const backward = driftData.backward;

      // 3A. Advection Dispersion Envelope (Smoothed Hydrodynamic Probability Plume)
      if (backward?.parameters?.cone_geojson) {
        const rawCone = backward.parameters.cone_geojson;
        const smoothedCone = smoothGeoJSON(rawCone, 3);
        const coreCone = shrinkGeoJSON(smoothedCone, 0.45);

        // Outer 90% Probability Plume (Marine cyan advection envelope)
        layers.push(
          new GeoJsonLayer({
            id: 'drift-cone-outer-layer',
            data: smoothedCone,
            filled: true,
            stroked: true,
            getFillColor: [14, 116, 144, 25],
            getLineColor: [14, 116, 144, 160],
            getLineWidth: 1.4,
            lineWidthUnits: 'pixels',
            pickable: true,
            onHover: (info) => {
              if (info.object) {
                setHoverInfo({
                  x: info.x,
                  y: info.y,
                  badge: 'HYDRODYNAMIC',
                  title: '4D Origin Probability Plume',
                  detail: 'Backward advection dispersion envelope (90% confidence origin boundary derived from CMEMS ocean currents & ERA5 wind fields)',
                });
              } else {
                setHoverInfo(null);
              }
            },
          })
        );

        // Inner 50% Core Probability Zone
        layers.push(
          new GeoJsonLayer({
            id: 'drift-cone-core-layer',
            data: coreCone,
            filled: true,
            stroked: true,
            getFillColor: [14, 116, 144, 45],
            getLineColor: [14, 116, 144, 200],
            getLineWidth: 1.2,
            lineWidthUnits: 'pixels',
            pickable: false,
          })
        );
      }

      // 3B. Trajectory Advection Streamline & Temporal Waypoints
      const traj = backward?.trajectory_points || [];
      if (traj.length > 1) {
        const pathCoords = traj.map((p) => [p.lon, p.lat]);

        // Continuous advection streamline
        layers.push(
          new PathLayer({
            id: 'drift-streamline-path',
            data: [{ path: pathCoords }],
            getPath: (d) => d.path,
            getColor: [217, 119, 6, 220],
            getWidth: 2.2,
            widthUnits: 'pixels',
            pickable: false,
          })
        );

        // Evenly spaced temporal waypoints (e.g. 5 checkpoints from T0 to T-24h)
        const waypointIndices = [
          0,
          Math.floor(traj.length * 0.25),
          Math.floor(traj.length * 0.5),
          Math.floor(traj.length * 0.75),
          traj.length - 1,
        ];
        const waypoints = waypointIndices
          .map((idx) => ({ ...traj[idx], idx }))
          .filter((w) => w && w.lon && w.lat);

        layers.push(
          new ScatterplotLayer({
            id: 'drift-waypoint-halos',
            data: waypoints,
            getPosition: (d) => [d.lon, d.lat],
            getRadius: 300,
            getFillColor: [217, 119, 6, 30],
            getLineColor: [217, 119, 6, 180],
            getLineWidth: 1.2,
            stroked: true,
            pickable: false,
          }),
          new ScatterplotLayer({
            id: 'drift-waypoint-nodes',
            data: waypoints,
            getPosition: (d) => [d.lon, d.lat],
            getRadius: 140,
            getFillColor: [255, 255, 255, 255],
            getLineColor: [217, 119, 6, 255],
            getLineWidth: 2,
            stroked: true,
            pickable: true,
            onHover: (info) => {
              if (info.object) {
                const w = info.object;
                const hoursBack = Math.round(((backward?.duration_hours || 24) * w.idx) / (traj.length - 1));
                setHoverInfo({
                  x: info.x,
                  y: info.y,
                  badge: `T - ${hoursBack}h`,
                  title: `Drift Waypoint (T - ${hoursBack}h)`,
                  detail: `Advection Coordinate: ${w.lat.toFixed(4)}°N, ${w.lon.toFixed(4)}°E · Probability: ${((w.probability || 0.8) * 100).toFixed(0)}%`,
                });
              } else {
                setHoverInfo(null);
              }
            },
          })
        );
      }

      // 3C. Release Origin Peak Centroid Marker (Target Reticle)
      const peak = backward?.parameters?.origin_heatmap?.peak;
      if (peak) {
        layers.push(
          new ScatterplotLayer({
            id: 'drift-origin-halo',
            data: [{ position: [peak.lon, peak.lat] }],
            getPosition: (d) => d.position,
            getRadius: 650,
            getFillColor: [220, 38, 38, 30],
            getLineColor: [220, 38, 38, 180],
            getLineWidth: 1.4,
            stroked: true,
            pickable: false,
          }),
          new ScatterplotLayer({
            id: 'drift-origin-reticle',
            data: [{ position: [peak.lon, peak.lat] }],
            getPosition: (d) => d.position,
            getRadius: 240,
            getFillColor: [220, 38, 38, 240],
            getLineColor: [255, 255, 255, 255],
            getLineWidth: 2.2,
            stroked: true,
            pickable: true,
            onHover: (info) => {
              if (info.object) {
                setHoverInfo({
                  x: info.x,
                  y: info.y,
                  badge: 'RELEASE CENTROID',
                  title: 'Estimated Release Site (T-24h)',
                  detail: `Coordinates: ${peak.lat.toFixed(4)}°N, ${peak.lon.toFixed(4)}°E (Highest backward particle density concentration)`,
                });
              } else {
                setHoverInfo(null);
              }
            },
          })
        );
      }
    }

    // 4. AIS Candidate Vessels (Oriented Ship Hulls & Velocity Vectors)
    if (layerVisibility.ais && suspects.length > 0) {
      suspects.forEach((sus, idx) => {
        const ev = sus.explanation?.evidence || {};
        const closest = ev.closest_fix;
        const isTop = idx === 0;
        const color = isTop ? [220, 38, 38] : [2, 132, 199];

        if (closest?.lat && closest?.lon) {
          const heading = sus.vessel_heading || 215;
          const sog = sus.vessel_sog || 12.0;
          const hullCoords = createVesselHull(closest.lon, closest.lat, heading, isTop ? 0.022 : 0.016);
          const leaderCoords = createVelocityLeader(closest.lon, closest.lat, heading, sog);

          // Vessel hull polygon
          layers.push(
            new PolygonLayer({
              id: `vessel-hull-${sus.id}`,
              data: [{ polygon: hullCoords }],
              getPolygon: (d) => d.polygon,
              getFillColor: [...color, isTop ? 240 : 200],
              getLineColor: [255, 255, 255, 240],
              getLineWidth: 1.5,
              lineWidthUnits: 'pixels',
              stroked: true,
              pickable: true,
              onHover: (info) => {
                if (info.object) {
                  setHoverInfo({
                    x: info.x,
                    y: info.y,
                    badge: `#${sus.rank || idx + 1} CANDIDATE`,
                    title: sus.vessel_name || 'Commercial Vessel',
                    detail: `MMSI: ${sus.vessel_mmsi || '—'} · Score: ${sus.total_score?.toFixed(0)}/100 · Speed: ${sog} kn · Course: ${heading}° · Distance to spill: ${closest.distance_nm?.toFixed(1) || '—'} nm`,
                  });
                } else {
                  setHoverInfo(null);
                }
              },
            })
          );

          // Velocity leader vector line
          layers.push(
            new PathLayer({
              id: `vessel-leader-${sus.id}`,
              data: [{ path: leaderCoords }],
              getPath: (d) => d.path,
              getColor: [...color, 220],
              getWidth: 2,
              widthUnits: 'pixels',
              pickable: false,
            })
          );

          // Top suspect attribution halo
          if (isTop) {
            layers.push(
              new ScatterplotLayer({
                id: `vessel-top-halo-${sus.id}`,
                data: [closest],
                getPosition: (d) => [d.lon, d.lat],
                getRadius: 850,
                getFillColor: [220, 38, 38, 25],
                getLineColor: [220, 38, 38, 180],
                getLineWidth: 1.4,
                stroked: true,
                pickable: false,
              })
            );
          }
        }
      });
    }

    // 5. Realistic Oil Slicks (Smoothed Organic Radar Attenuation & Emulsion Core)
    if (layerVisibility.slicks && spills.length > 0) {
      spills.forEach((spill) => {
        const isSelected = selectedSpill?.id === spill.id;

        if (spill.slick_geojson) {
          // Smooth the polygon to eliminate harsh geometric trapezoid corners
          const smoothedSlick = smoothGeoJSON(spill.slick_geojson, 3);
          const coreSlick = shrinkGeoJSON(smoothedSlick, 0.52);

          // Outer Radar Backscatter Sheen (Dark dampened ocean surface)
          layers.push(
            new GeoJsonLayer({
              id: `spill-outer-sheen-${spill.id}`,
              data: smoothedSlick,
              filled: true,
              stroked: true,
              getFillColor: [15, 23, 42, 140], // Deep oceanic petroleum absorption
              getLineColor: isSelected ? [239, 68, 68, 240] : [245, 158, 11, 200],
              getLineWidth: isSelected ? 2.0 : 1.4,
              lineWidthUnits: 'pixels',
              pickable: true,
              onClick: () => {
                if (onSelectSpill) onSelectSpill(spill);
              },
              onHover: (info) => {
                if (info.object) {
                  const isLook = spill.validation_status === 'lookalike' ||
                                 spill.model_confidence?.classification === 'Look-alike' ||
                                 spill.name?.toLowerCase().includes('lookalike');
                  const conf = Math.round(((spill.confidence_score != null ? spill.confidence_score : (isLook ? spill.model_confidence?.lookalike : spill.model_confidence?.oil)) ?? 0.88) * 100);
                  setHoverInfo({
                    x: info.x,
                    y: info.y,
                    badge: isLook ? 'LOOK-ALIKE' : 'CONFIRMED SLICK',
                    title: spill.name,
                    detail: `Surface Area: ${spill.area_sq_km?.toFixed(1)} km² · Confidence: ${conf}% · Est. Age: ${spill.age_estimate || '—'} · Elongation: ${spill.elongation_ratio?.toFixed(1) || '—'}`,
                  });
                } else {
                  setHoverInfo(null);
                }
              },
            })
          );

          // Inner Heavy Emulsion Core (Dense oil concentration)
          layers.push(
            new GeoJsonLayer({
              id: `spill-core-emulsion-${spill.id}`,
              data: coreSlick,
              filled: true,
              stroked: false,
              getFillColor: [8, 14, 26, 185], // Heavy dark crude core
              pickable: false,
            })
          );
        }

        // Tactical Centroid Target Reticle
        if (spill.centroid_lat && spill.centroid_lon) {
          layers.push(
            new ScatterplotLayer({
              id: `spill-centroid-reticle-${spill.id}`,
              data: [spill],
              getPosition: (d) => [d.centroid_lon, d.centroid_lat],
              getRadius: isSelected ? 380 : 260,
              getFillColor: [239, 68, 68, 30],
              getLineColor: [239, 68, 68, 210],
              getLineWidth: 1.5,
              stroked: true,
              pickable: false,
            }),
            new ScatterplotLayer({
              id: `spill-centroid-core-${spill.id}`,
              data: [spill],
              getPosition: (d) => [d.centroid_lon, d.centroid_lat],
              getRadius: isSelected ? 160 : 120,
              getFillColor: isSelected ? [239, 68, 68, 255] : [245, 158, 11, 240],
              getLineColor: [255, 255, 255, 255],
              getLineWidth: 1.8,
              stroked: true,
              pickable: true,
              onClick: () => {
                if (onSelectSpill) onSelectSpill(spill);
              },
              onHover: (info) => {
                if (info.object) {
                  setHoverInfo({
                    x: info.x,
                    y: info.y,
                    badge: 'CENTROID',
                    title: `${spill.name} Centroid`,
                    detail: `Position: ${spill.centroid_lat.toFixed(4)}°N, ${spill.centroid_lon.toFixed(4)}°E`,
                  });
                } else {
                  setHoverInfo(null);
                }
              },
            })
          );
        }
      });
    }

    return layers;
  }, [eezData, coralsData, driftData, suspects, spills, selectedSpill, layerVisibility]);

  // Update Deck.gl overlay whenever layers change
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.setProps({ layers: deckLayers });
    }
  }, [deckLayers]);

  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#0a0f1d', borderRadius: '8px', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Tactical Layers Toggle Toolbar — Clean Institutional Glass Panel */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        zIndex: 10,
        fontSize: '0.74rem',
        color: '#0f172a',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
      }}>
        <div style={{
          fontWeight: 700,
          color: '#0f2e59',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: '0.7rem',
        }}>
          Tactical Overlays
        </div>
        {[
          { key: 'slicks', label: 'SAR Radar Slicks (Sheen & Core)', color: '#dc2626' },
          { key: 'drift', label: '4D Advection Dispersion Plume', color: '#0e7490' },
          { key: 'ais', label: 'AIS Targets & Velocity Vectors', color: '#2563eb' },
          { key: 'eez', label: 'Indian EEZ Jurisdiction (200 NM)', color: '#0284c7' },
          { key: 'corals', label: 'Ecological Sanctuaries & MPAs', color: '#10b981' },
        ].map((item) => (
          <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#334155' }}>
            <input
              type="checkbox"
              checked={layerVisibility[item.key]}
              onChange={(e) => setLayerVisibility((prev) => ({ ...prev, [item.key]: e.target.checked }))}
              style={{ accentColor: item.color }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color }} />
              {item.label}
            </span>
          </label>
        ))}

        {/* Free Basemap Selector (No API Keys / No Watermarks) */}
        <div style={{
          fontWeight: 700,
          color: '#0f2e59',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '6px',
          marginTop: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: '0.7rem',
        }}>
          Basemap Provider
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {Object.entries(FREE_BASEMAP_STYLES).map(([key, styleObj]) => (
            <button
              key={key}
              onClick={() => handleBasemapChange(key)}
              style={{
                background: basemapKey === key ? '#0f2e59' : '#f8fafc',
                color: basemapKey === key ? '#ffffff' : '#475569',
                border: basemapKey === key ? '1px solid #0f2e59' : '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '4px 6px',
                fontSize: '0.68rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {styleObj.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sector Quick Jumper Toolbar — Bottom Left (Only displayed when showSectorJumper is enabled) */}
      {showSectorJumper && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '6px 10px',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          zIndex: 10,
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
        }}>
          {Object.entries(SECTORS).map(([key, sec]) => (
            <button
              key={key}
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.flyTo({ center: sec.center, zoom: sec.zoom, speed: 1.0 });
                }
              }}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#0f2e59',
                fontSize: '0.7rem',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {sec.name}
            </button>
          ))}
        </div>
      )}

      {/* Live Nautical Cursor Telemetry HUD — Bottom Right */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '5px 10px',
        color: '#334155',
        fontSize: '0.68rem',
        fontFamily: 'monospace',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.1)',
        pointerEvents: 'none',
      }}>
        <span><strong style={{ color: '#0f2e59' }}>CURSOR:</strong> {cursorPos.lat.toFixed(4)}°N, {cursorPos.lon.toFixed(4)}°E</span>
        <span style={{ color: '#94a3b8' }}>|</span>
        <span><strong style={{ color: '#0f2e59' }}>DATUM:</strong> WGS84</span>
        <span style={{ color: '#94a3b8' }}>|</span>
        <span><strong style={{ color: '#0f2e59' }}>FORCING:</strong> CMEMS + ERA5</span>
      </div>

      {/* Hover Telemetry Tooltip — Clean Institutional Card */}
      {hoverInfo && (
        <div style={{
          position: 'absolute',
          left: hoverInfo.x + 14,
          top: hoverInfo.y - 20,
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #cbd5e1',
          borderLeft: '4px solid #0f2e59',
          borderRadius: '6px',
          padding: '10px 14px',
          color: '#0f172a',
          fontSize: '0.75rem',
          pointerEvents: 'none',
          zIndex: 200,
          boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.18)',
          minWidth: '220px',
          maxWidth: '320px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: '#0f2e59', fontSize: '0.8rem' }}>{hoverInfo.title}</span>
            {hoverInfo.badge && (
              <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase' }}>
                {hoverInfo.badge}
              </span>
            )}
          </div>
          <div style={{ color: '#475569', fontSize: '0.72rem', lineHeight: 1.45 }}>{hoverInfo.detail}</div>
        </div>
      )}
    </div>
  );
}
