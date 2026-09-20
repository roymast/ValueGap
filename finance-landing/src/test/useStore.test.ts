import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import type { Asset } from '../types';

describe('useStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useStore.setState({
      theme: 'dark',
      watchlist: []
    });
  });

  it('should initialize with dark theme', () => {
    const { theme } = useStore.getState();
    expect(theme).toBe('dark');
  });

  it('should toggle theme', () => {
    useStore.getState().setTheme('light');
    expect(useStore.getState().theme).toBe('light');
  });

  it('should add asset to watchlist', () => {
    const mockAsset: Asset = {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      price: 150,
      target: 180,
      percentage: 20,
      delta: 30,
      type: 'stock',
      exchange: 'NASDAQ'
    };

    useStore.getState().toggleWatchlist(mockAsset);
    expect(useStore.getState().watchlist).toHaveLength(1);
    expect(useStore.getState().watchlist[0].ticker).toBe('AAPL');
  });

  it('should remove asset from watchlist if already exists', () => {
    const mockAsset: Asset = {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      price: 150,
      target: 180,
      percentage: 20,
      delta: 30,
      type: 'stock',
      exchange: 'NASDAQ'
    };

    useStore.getState().toggleWatchlist(mockAsset);
    expect(useStore.getState().watchlist).toHaveLength(1);
    
    // Toggle again to remove
    useStore.getState().toggleWatchlist(mockAsset);
    expect(useStore.getState().watchlist).toHaveLength(0);
  });
});
