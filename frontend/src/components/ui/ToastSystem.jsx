/**
 * @file ToastSystem.jsx
 * @description Toast notification system for SARVAS frontend.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const TOAST_COLORS = {
  success: { bg: '#f0faf3', border: '#28a745', text: '#155724' },
  error: { bg: '#fdf0f1', border: '#dc3545', text: '#721c24' },
  warning: { bg: '#fffbf0', border: '#f0ad4e', text: '#856404' },
  info: { bg: '#eaf2fa', border: '#4a7ab5', text: '#0c5460' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => {
      const newToasts = [...prev, { id, message, type }];
      if (newToasts.length > 5) {
        return newToasts.slice(newToasts.length - 5);
      }
      return newToasts;
    });

    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 9999,
      }}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }) {
  const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - (100 / 50)));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: '300px',
      background: colors.bg,
      borderLeft: `4px solid ${colors.border}`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      borderRadius: '4px',
      overflow: 'hidden',
      animation: 'slideInRight 0.3s ease-out forwards',
    }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <span style={{ color: colors.text, fontSize: '0.875rem', fontWeight: 500 }}>
          {toast.message}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: colors.text,
            cursor: 'pointer',
            padding: 0,
            marginLeft: '12px',
            opacity: 0.7,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div style={{
        height: '3px',
        background: colors.border,
        width: `${progress}%`,
        transition: 'width 0.1s linear',
      }} />
      <style>
        {`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
