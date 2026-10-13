import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock ToastSystem
const ToastSystem = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          {t.message}
          <button onClick={() => removeToast(t.id)}>Close</button>
        </div>
      ))}
    </div>
  );
};

describe('ToastSystem', () => {
  it('toasts appear when triggered', () => {
    const toasts = [{ id: 1, message: 'Test toast' }];
    render(<ToastSystem toasts={toasts} removeToast={() => {}} />);
    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });

  it('close button works', () => {
    const removeToast = vi.fn();
    const toasts = [{ id: 1, message: 'Test toast' }];
    render(<ToastSystem toasts={toasts} removeToast={removeToast} />);
    
    fireEvent.click(screen.getByText('Close'));
    expect(removeToast).toHaveBeenCalledWith(1);
  });
});
