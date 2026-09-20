import { useState, useEffect, useRef } from 'react';
import type { Asset } from '../types';

export const useMarketData = () => {
  const [undervalued, setUndervalued] = useState<Asset[]>([]);
  const [overvalued, setOvervalued] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchedHistoryRef = useRef<Set<string>>(new Set());

  const fetchMarketData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/stocks?threshold=0${force ? '&force_refresh=true' : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setUndervalued(data.undervalued || []);
      setOvervalued(data.overvalued || []);
    } catch (err) {
      console.error('Failed to load market data:', err);
      setError('Failed to load market data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, []);

  const updateAssetHistory = (ticker: string, data: any) => {
    const updateAsset = (a: Asset) => a.ticker === ticker ? { ...a, history_dict: data.history_dict, realHistoryFetched: true } : a;
    setUndervalued(prev => prev.map(updateAsset));
    setOvervalued(prev => prev.map(updateAsset));
  };

  return {
    undervalued,
    overvalued,
    loading,
    error,
    fetchMarketData,
    updateAssetHistory,
    fetchedHistoryRef
  };
};
