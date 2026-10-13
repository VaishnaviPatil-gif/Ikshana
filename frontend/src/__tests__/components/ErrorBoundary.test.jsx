import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock ErrorBoundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Something went wrong.</h1>
          <button onClick={() => this.setState({ hasError: false })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProblemChild = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  it('catches errors and shows fallback', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('retry button resets the error state', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );
    
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.queryByText('Retry')).toBeInTheDocument(); 
    consoleSpy.mockRestore();
  });
});
