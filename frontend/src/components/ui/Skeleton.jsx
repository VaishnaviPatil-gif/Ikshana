/**
 * @file Skeleton.jsx
 * @description Loading skeleton components with shimmer animation.
 */
import React from 'react';

const SHIMMER_STYLE = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

const baseStyle = {
  background: 'linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite linear',
  borderRadius: '4px',
};

export function SkeletonText({ lines = 1, width = '100%', style = {} }) {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              height: '16px',
              width: i === lines - 1 && lines > 1 ? '70%' : width,
              ...style
            }}
          />
        ))}
      </div>
    </>
  );
}

export function SkeletonCard({ style = {} }) {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div style={{
        padding: '16px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: 'white',
        ...style
      }}>
        <div style={{ ...baseStyle, height: '120px', marginBottom: '16px', borderRadius: '4px' }} />
        <SkeletonText lines={2} />
      </div>
    </>
  );
}

export function SkeletonChart({ style = {} }) {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div style={{
        height: '250px',
        width: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        padding: '16px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: 'white',
        ...style
      }}>
        {[40, 70, 45, 90, 65, 80, 30].map((h, i) => (
          <div key={i} style={{ ...baseStyle, flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0' }} />
        ))}
      </div>
    </>
  );
}

export function SkeletonMap({ style = {} }) {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div style={{
        ...baseStyle,
        height: '400px',
        width: '100%',
        borderRadius: '8px',
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.2)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.2)' }} />
      </div>
    </>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, style = {} }) {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', ...style }}>
        <div style={{ display: 'flex', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} style={{ ...baseStyle, height: '16px', flex: 1, marginRight: i < cols - 1 ? '16px' : 0 }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ display: 'flex', padding: '16px', borderBottom: r < rows - 1 ? '1px solid #e2e8f0' : 'none' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} style={{ ...baseStyle, height: '14px', flex: 1, marginRight: c < cols - 1 ? '16px' : 0 }} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
