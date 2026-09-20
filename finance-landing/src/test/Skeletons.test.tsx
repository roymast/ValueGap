import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CardSkeleton } from '../components/Skeletons';

describe('Skeletons', () => {
  it('renders CardSkeleton correctly', () => {
    const { container } = render(<CardSkeleton />);
    
    // Check if it renders a div with animate-pulse class
    const pulseElement = container.querySelector('.animate-pulse');
    expect(pulseElement).toBeInTheDocument();
  });
});
