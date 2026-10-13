/**
 * @file KeyboardShortcuts.jsx
 * @description Hook and component for keyboard shortcuts.
 */
import React, { useEffect, useState } from 'react';

export function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      
      if (isCmdOrCtrl && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handlers.onUpload?.();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handlers.onMap?.();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handlers.onThemeToggle?.();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handlers.onEscape?.();
      } else if (e.key === '?') {
        e.preventDefault();
        handlers.onHelp?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

export function ShortcutsHelpOverlay({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 22, 40, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        width: '400px',
        maxWidth: '90%',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0f2e59',
          color: 'white',
        }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Keyboard Shortcuts</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <ShortcutRow keys={['Ctrl', 'U']} label="Switch to Upload tab" />
          <ShortcutRow keys={['Ctrl', 'M']} label="Switch to Map tab" />
          <ShortcutRow keys={['Ctrl', 'D']} label="Toggle Dark Mode" />
          <ShortcutRow keys={['Esc']} label="Close open modal/drawer" />
          <ShortcutRow keys={['?']} label="Show shortcuts help" />
          <div style={{ marginTop: '16px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
            Mac users can use Cmd instead of Ctrl.
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ color: '#334155', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {keys.map((k, i) => (
          <span key={i} style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '0.8rem',
            color: '#0f2e59',
            fontWeight: 600,
            fontFamily: 'monospace',
          }}>
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
