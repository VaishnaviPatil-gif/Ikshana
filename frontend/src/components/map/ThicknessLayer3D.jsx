/**
 * @file ThicknessLayer3D.jsx
 * @description Deck.gl ColumnLayer for 3D oil thickness visualization.
 */
import React, { useState } from 'react';
import { ColumnLayer } from '@deck.gl/layers';

export function getThicknessLayer(spillId, polygon, options = {}) {
  const { visible = true, exaggeration = 10, elevationScale = 50 } = options;
  if (!visible || !polygon || polygon.length < 3) return null;

  // Generate a mock grid of points within the polygon bounding box
  // For demo, we just create a simple grid and calculate distance from center
  const lons = polygon.map(p => p[0]);
  const lats = polygon.map(p => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const maxDist = Math.sqrt(Math.pow(maxLon - centerLon, 2) + Math.pow(maxLat - centerLat, 2));

  const data = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; i <= steps; j++) {
      if (j > steps) break;
      const lon = minLon + (maxLon - minLon) * (i / steps);
      const lat = minLat + (maxLat - minLat) * (j / steps);
      
      // Simple distance to center for Gaussian-like thickness
      const dist = Math.sqrt(Math.pow(lon - centerLon, 2) + Math.pow(lat - centerLat, 2));
      const normalizedDist = dist / (maxDist || 1);
      
      if (normalizedDist > 1) continue; // Roughly clip to a circle within bounding box
      
      const thickness = Math.max(0, 1 - Math.pow(normalizedDist, 2)); // 0 to 1

      // Color mapping: 0 = yellow, 0.5 = orange, 1 = red/brown
      const r = Math.floor(255 - (thickness * 100));
      const g = Math.floor(255 - (thickness * 200));
      const b = Math.floor(100 - (thickness * 100));

      data.push({
        position: [lon, lat],
        thickness: thickness * exaggeration,
        color: [r, Math.max(0, g), Math.max(0, b), 200]
      });
    }
  }

  return new ColumnLayer({
    id: `thickness-layer-${spillId}`,
    data,
    diskResolution: 6,
    radius: 100, // meters
    extruded: true,
    pickable: true,
    elevationScale,
    getPosition: d => d.position,
    getFillColor: d => d.color,
    getElevation: d => d.thickness,
  });
}

export function ThicknessControlPanel({ visible, setVisible, exaggeration, setExaggeration }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      background: 'white',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      width: '260px',
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem', color: '#0f2e59' }}>3D Thickness Model</h4>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={visible} 
            onChange={e => setVisible(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ fontSize: '0.75rem', color: '#475569' }}>Enable</span>
        </label>
      </div>
      
      <div style={{ opacity: visible ? 1 : 0.5, pointerEvents: visible ? 'auto' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Exaggeration</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f2e59' }}>{exaggeration}x</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="50" 
          value={exaggeration}
          onChange={e => setExaggeration(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#1a4a8a' }}
        />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.7rem', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '12px', background: 'rgb(255, 255, 100)', borderRadius: '2px' }} /> Sheen
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '12px', background: 'rgb(205, 155, 50)', borderRadius: '2px' }} /> Medium
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '12px', background: 'rgb(155, 55, 0)', borderRadius: '2px' }} /> Thick
          </div>
        </div>
      </div>
    </div>
  );
}
