/**
 * @file SatelliteTasking.jsx
 * @description Displays estimated next Sentinel-1 passes over a given location.
 */
import React, { useMemo } from 'react';

export default function SatelliteTasking({ latitude, longitude, style = {} }) {
  // Simplistic prediction logic for demonstration
  const passes = useMemo(() => {
    if (!latitude || !longitude) return [];
    const now = new Date();
    // Simulate passes based on lat/lon seed
    const seed = (Math.abs(latitude) + Math.abs(longitude)) % 12;
    const passList = [];
    
    for (let i = 0; i < 4; i++) {
      const passTime = new Date(now.getTime() + (seed * 3.6e6) + (i * 12 * 24 * 3.6e6) + (i * 2.5 * 3.6e6));
      passList.push({
        id: `s1-${i}`,
        satellite: i % 2 === 0 ? 'Sentinel-1A' : 'Sentinel-1B',
        time: passTime,
        orbit: i % 2 === 0 ? 'Ascending' : 'Descending',
        swath: '250km (IW Mode)'
      });
    }
    return passList.sort((a, b) => a.time - b.time);
  }, [latitude, longitude]);

  if (!latitude || !longitude) {
    return (
      <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b' }}>
        Select a location to view satellite tasking opportunities.
      </div>
    );
  }

  const nextPass = passes[0];

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', ...style }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#0f2e59', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        Satellite Tasking Window
      </h3>
      
      {nextPass && (
        <div style={{ background: '#f0f7ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
            Next Acquisition
          </div>
          <div style={{ fontSize: '1.25rem', color: '#0f2e59', fontWeight: 700, marginBottom: '8px' }}>
            {nextPass.time.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: '#475569' }}>
            <span><strong>Platform:</strong> {nextPass.satellite}</span>
            <span><strong>Orbit:</strong> {nextPass.orbit}</span>
            <span><strong>Coverage:</strong> {nextPass.swath}</span>
          </div>
        </div>
      )}

      <h4 style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#334155' }}>Upcoming Passes (Next 14 Days)</h4>
      <div style={{ position: 'relative', paddingLeft: '16px', borderLeft: '2px solid #e2e8f0' }}>
        {passes.slice(1).map(pass => (
          <div key={pass.id} style={{ position: 'relative', paddingBottom: '16px' }}>
            <div style={{
              position: 'absolute',
              left: '-21px',
              top: '4px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#0f2e59',
              border: '2px solid white'
            }} />
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f2e59' }}>
              {pass.time.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {pass.satellite} • {pass.orbit}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
