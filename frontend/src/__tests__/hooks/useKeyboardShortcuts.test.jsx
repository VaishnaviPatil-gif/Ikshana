import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';

const useKeyboardShortcuts = (shortcutMap) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (shortcutMap[key]) {
        shortcutMap[key]();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcutMap]);
};

describe('useKeyboardShortcuts', () => {
  it('fires callbacks on matching key', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'a': callback }));
    
    const event = new KeyboardEvent('keydown', { key: 'a' });
    window.dispatchEvent(event);
    
    expect(callback).toHaveBeenCalled();
  });

  it('does not fire when typing in inputs', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'a': callback }));
    
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    const event = new KeyboardEvent('keydown', { key: 'a' });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);
    
    expect(callback).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
