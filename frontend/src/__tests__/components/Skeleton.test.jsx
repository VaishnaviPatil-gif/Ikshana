import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';

const Skeleton = ({ variant = 'text', width, height }) => {
  return <div data-testid="skeleton" className={`skeleton skeleton-${variant}`} style={{ width, height }}></div>;
};

describe('Skeleton', () => {
  it('renders without crashing for text variant', () => {
    render(<Skeleton variant="text" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('skeleton-text');
  });

  it('renders without crashing for rectangular variant', () => {
    render(<Skeleton variant="rectangular" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('skeleton-rectangular');
  });

  it('renders without crashing for circular variant', () => {
    render(<Skeleton variant="circular" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('skeleton-circular');
  });
});
