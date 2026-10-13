/**
 * @file DossierDownload.jsx
 * @description Button component to download evidence dossier PDF.
 */
import React, { useState } from 'react';

export default function DossierDownload({ spillId, style = {} }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!spillId) return;
    setLoading(true);
    try {
      // Simulate API call to /api/reports/dossier/{spillId}
      // In a real app this uses the API client with responseType: 'blob'
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
      
      // Mock blob download
      const mockBlob = new Blob(['Mock PDF Content'], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(mockBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SARVAS_Dossier_${spillId}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed', error);
      alert('Failed to download dossier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#f8fafc',
        color: '#0f2e59',
        border: '1px solid #cbd5e1',
        borderRadius: '4px',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        ...style
      }}
      onMouseOver={e => {
        if (!loading) e.currentTarget.style.backgroundColor = '#f1f5f9';
      }}
      onMouseOut={e => {
        if (!loading) e.currentTarget.style.backgroundColor = '#f8fafc';
      }}
    >
      {loading ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {loading ? 'Generating...' : 'Download Evidence'}
    </button>
  );
}
