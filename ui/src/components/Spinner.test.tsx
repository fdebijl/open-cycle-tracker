// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('exposes a polite status role for screen readers', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders 20 dots by default', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelectorAll('rect')).toHaveLength(20);
  });

  it('respects a custom dotCount', () => {
    const { container } = render(<Spinner dotCount={8} />);
    expect(container.querySelectorAll('rect')).toHaveLength(8);
  });

  it('renders the label when provided', () => {
    render(<Spinner label="Loading…" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('staggers the per-dot animation delay', () => {
    const { container } = render(<Spinner dotCount={20} />);
    const rects = container.querySelectorAll('rect');
    // Legacy stagger: begin = -(0.75 - (0.75/dotCount) * dot). Last dot > 0s.
    expect((rects[0] as SVGRectElement).style.animationDelay).toBe('-1.71s');
    expect(parseFloat((rects[19] as SVGRectElement).style.animationDelay)).toBeCloseTo(0);
  });
});
