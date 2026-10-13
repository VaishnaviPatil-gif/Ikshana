/**
 * @file TimeLapseControls.jsx
 * @description Playback controls for spill evolution animation.
 */
import React, { useState, useEffect, useRef } from 'react';

export default function TimeLapseControls({ durationHours = 48, onTimeChange, style = {} }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 0 to durationHours
  const [speed, setSpeed] = useState(1); // 1x, 2x, 5x, 10x
  
  const requestRef = useRef();
  const previousTimeRef = useRef();

  const animate = time => {
    if (previousTimeRef.current != undefined) {
      const deltaTime = time - previousTimeRef.current;
      // Advance time based on real time passed and speed multiplier
      // If speed is 1x, let's say 1 real second = 1 simulation hour
      setCurrentTime(prevTime => {
        const next = prevTime + (deltaTime / 1000) * speed;
        if (next >= durationHours) {
          setIsPlaying(false);
          return durationHours;
        }
        return next;
      });
    }
    previousTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      if (currentTime >= durationHours) setCurrentTime(0); // loop
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, speed, durationHours]); // currentTime removed to avoid resetting ref loop

  useEffect(() => {
    onTimeChange?.(currentTime);
  }, [currentTime, onTimeChange]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleScrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    setCurrentTime(percentage * durationHours);
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '600px',
      maxWidth: '90%',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      zIndex: 1000,
      ...style
    }}>
      {/* Top row: Play controls and Time display */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button 
          onClick={togglePlay}
          style={{
            background: '#0f2e59',
            color: 'white',
            border: 'none',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>

        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f2e59', fontVariantNumeric: 'tabular-nums' }}>
          T + {currentTime.toFixed(1)} hrs
        </div>

        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '4px' }}>
          {[1, 2, 5, 10].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                background: speed === s ? '#ffffff' : 'transparent',
                border: 'none',
                padding: '4px 8px',
                fontSize: '0.75rem',
                fontWeight: speed === s ? 700 : 500,
                color: speed === s ? '#0f2e59' : '#64748b',
                borderRadius: '2px',
                cursor: 'pointer',
                boxShadow: speed === s ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: Scrubber */}
      <div 
        onClick={handleScrub}
        style={{ height: '24px', display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
      >
        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${(currentTime / durationHours) * 100}%`, height: '100%', background: '#1a4a8a', transition: isPlaying ? 'none' : 'width 0.1s' }} />
        </div>
        <div style={{
          position: 'absolute',
          left: `${(currentTime / durationHours) * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '14px',
          height: '14px',
          background: '#0f2e59',
          border: '2px solid white',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>
  );
}
