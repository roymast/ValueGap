import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Search, FileText, X, Calculator, Award, Sun, Moon } from 'lucide-react';
import { InteractiveChart } from './components/InteractiveChart';

interface Analyst {
  firm: string;
  rating: string;
  target: number;
  date?: string;
  days_ago?: number;
  horizon?: string;
}

interface Asset {
  ticker: string;
  name: string;
  price: number;
  target: number;
  delta: number;
  percentage: number;
  type: string;
  analysts?: Analyst[];
  history?: number[];
  history_dict?: {
    '1d': number[];
    '1mo': number[];
    '1y': number[];
    '5y': number[];
  };
  realHistoryFetched?: boolean;
  successRate?: number;
}

function App() {
  const [undervalued, setUndervalued] = useState<Asset[]>([]);
  const [overvalued, setOvervalued] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [minGap, setMinGap] = useState<number>(0);
  const [unit, setUnit] = useState<'pct'|'usd'|'pts'>('pct');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all'|'stock'|'index'>('all');
  const [activeTab, setActiveTab] = useState<'undervalued'|'overvalued'>('undervalued');
  const [theme, setTheme] = useState('light');
  // wsConnected removed
  const [watchlist, setWatchlist] = useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem('finance_watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('finance_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const [currentScreen, setCurrentScreen] = useState<'home' | 'screener' | 'watchlist'>('home');
  const [chartTimeframe, setChartTimeframe] = useState<'1d' | '1mo' | '1y' | '5y'>('1d');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [investAmount, setInvestAmount] = useState<string>('1000');
  const [historyLoading, setHistoryLoading] = useState(false);
  const fetchedHistoryRef = useRef<Set<string>>(new Set());

  const selectedAssetRef = useRef(selectedAsset);
  selectedAssetRef.current = selectedAsset;
  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;

  useEffect(() => {
    window.history.pushState({ appState: 'home' }, '');
    const handlePopState = () => {
      if (selectedAssetRef.current) {
        setSelectedAsset(null);
        window.history.pushState({ appState: 'home' }, '');
      } else if (currentScreenRef.current !== 'home') {
        setCurrentScreen('home');
        document.getElementById('screen-home')?.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState({ appState: 'home' }, '');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.add('dark');
  }, [theme]);

  // Lock body scroll when detail panel is open
  useEffect(() => {
    if (selectedAsset) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedAsset]);

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

  // Open detail panel and lazily fetch real history for this ticker
  const fetchAndOpenDetail = async (asset: Asset) => {
    setSelectedAsset(asset); // open immediately with synthetic history
    setChartTimeframe('1d');
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/stocks/history/${asset.ticker}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAsset(prev => prev && prev.ticker === asset.ticker
          ? { ...prev, history_dict: data.history_dict, history: data.history_dict['1d'], analysts: data.analysts?.length ? data.analysts : prev.analysts, realHistoryFetched: true }
          : prev
        );
        const updateAsset = (a: Asset) => a.ticker === asset.ticker ? { ...a, history_dict: data.history_dict, realHistoryFetched: true } : a;
        setUndervalued(prev => prev.map(updateAsset));
        setOvervalued(prev => prev.map(updateAsset));
      }
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "N/A";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatDelta = (value: number | null | undefined, isPercent: boolean | 'pct' | 'usd' | 'pts' = false) => {
    if (value == null) return "N/A";
    const sign = value > 0 ? '+' : '';
    
    const type = isPercent === true ? 'pct' : isPercent === false ? 'usd' : isPercent;
    
    let num = '';
    if (type === 'pct') num = `${value.toFixed(1)}%`;
    else if (type === 'pts') num = value.toFixed(2);
    else num = formatCurrency(value);
    
    return `${sign}${num}`;
  };

  const getCalcFutureValue = () => {
    if (!selectedAsset || !investAmount || selectedAsset.percentage == null) return '$0.00';
    const amount = parseFloat(investAmount);
    if (isNaN(amount)) return '$0.00';
    const future = amount * (1 + (selectedAsset.percentage / 100));
    return formatCurrency(future);
  };

  const filterAssets = (assets: Asset[]) => {
    return assets.filter(asset => {
      const matchesSearch = asset.ticker.toLowerCase().includes(search.toLowerCase()) ||
                            asset.name.toLowerCase().includes(search.toLowerCase());
      const matchesGap = unit === 'pct' ? Math.abs(asset.percentage) >= minGap : Math.abs(asset.delta) >= minGap;
      const matchesType = assetTypeFilter === 'all' || asset.type === assetTypeFilter;
      return matchesSearch && matchesGap && matchesType;
    }).sort((a, b) => {
      if (unit === 'pct') return Math.abs(b.percentage) - Math.abs(a.percentage);
      return Math.abs(b.delta) - Math.abs(a.delta);
    });
  };

  const currentUndervalued = filterAssets(undervalued);
  const currentOvervalued = filterAssets(overvalued);

  useEffect(() => {
    const topAssets = [...currentUndervalued.slice(0, 3), ...currentOvervalued.slice(0, 3)];
    topAssets.forEach(asset => {
      if (!asset.realHistoryFetched && !fetchedHistoryRef.current.has(asset.ticker)) {
        fetchedHistoryRef.current.add(asset.ticker);
        fetch(`/api/stocks/history/${asset.ticker}`)
          .then(res => res.json())
          .then(data => {
            const updateAsset = (a: Asset) => a.ticker === asset.ticker ? { ...a, history_dict: data.history_dict, realHistoryFetched: true } : a;
            setUndervalued(prev => prev.map(updateAsset));
            setOvervalued(prev => prev.map(updateAsset));
            setSelectedAsset(prev => prev && prev.ticker === asset.ticker ? { ...prev, history_dict: data.history_dict, history: data.history_dict['1d'], analysts: data.analysts?.length ? data.analysts : prev.analysts, realHistoryFetched: true } : prev);
          })
          .catch(e => {
            console.error(e);
            fetchedHistoryRef.current.delete(asset.ticker);
          });
      }
    });
  }, [currentUndervalued, currentOvervalued]);

  const toggleWatchlist = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (watchlist.find(a => a.ticker === asset.ticker)) {
      setWatchlist(watchlist.filter(a => a.ticker !== asset.ticker));
    } else {
      setWatchlist([...watchlist, asset]);
    }
  };

  const renderChart = (asset: Asset, timeframe: string, showAxes = false) => {
    return <InteractiveChart asset={asset} timeframe={timeframe} showAxes={showAxes} />;
  };

  const handleTouchStart = () => {
    if (loading) return;
  };

  const handleTouchMove = () => {
    if (loading) return;
  };

  const handleTouchEnd = () => {
    if (loading) return;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 flex flex-col md:flex-row overflow-hidden h-screen">
      
      {/* Desktop Sidebar — takes space in flow (not absolute), so content is never hidden */}
      <div className="hidden md:flex flex-col w-20 flex-shrink-0 border-r border-border bg-card pt-6 items-center gap-8 z-40">
         <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
            <TrendingUp className="text-primary w-5 h-5" />
         </div>
         <a href="#screen-home" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('home'); }} className={`p-3 rounded-xl transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'home' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
            <TrendingUp className="w-6 h-6" />
         </a>
         <a href="#screen-screener" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('screener'); }} className={`p-3 rounded-xl transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'screener' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
            <Search className="w-6 h-6" />
         </a>
         <a href="#screen-watchlist" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('watchlist'); }} className={`p-3 rounded-xl transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'watchlist' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
            <FileText className="w-6 h-6" />
         </a>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 3-Screen Container (Swipeable on Mobile) */}
        <div 
          className={`flex-1 flex ${loading ? 'overflow-hidden touch-none' : 'overflow-x-auto'} snap-x snap-mandatory hide-scrollbar relative scroll-smooth`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onScroll={(e) => {
            const target = e.currentTarget;
            const scrollLeft = target.scrollLeft;
            const width = target.clientWidth;
            const index = Math.round(scrollLeft / width);
            if (index === 0 && currentScreen !== 'home') setCurrentScreen('home');
            else if (index === 1 && currentScreen !== 'screener') setCurrentScreen('screener');
            else if (index === 2 && currentScreen !== 'watchlist') setCurrentScreen('watchlist');
          }}
        >
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}
        
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-danger/90 text-white px-4 py-2 rounded-lg shadow-lg">
              {error}
            </div>
          )}
        
        {/* Screen 1: Top Opportunities */}
        <div id="screen-home" className="w-full flex-shrink-0 snap-start h-full overflow-y-auto pb-24">
          <header className="px-6 py-8 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-md z-10">
            <div className="flex justify-between items-center max-w-[1600px] mx-auto">
              <div>
                <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">ValueGap</span>
                </h1>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">Live Delta Intelligence</p>
                <p className="text-xs text-muted-foreground/70 mt-2 max-w-md">Expected gain represents the predicted return if the asset reaches the analyst consensus target price. These are predictions and not guaranteed returns.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-card hover:bg-muted transition-all" title="Toggle Theme">
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-foreground" /> : <Moon className="w-4 h-4 text-foreground" />}
                </button>
              </div>
            </div>
          </header>
          
          <div className="max-w-[1600px] mx-auto px-6 mt-8 space-y-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-6 h-6 text-success" />
                <h2 className="text-xl font-bold font-display uppercase tracking-widest">Top Undervalued</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {currentUndervalued.slice(0, 3).map((asset) => (
                  <div key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="glass-panel p-6 rounded-2xl border border-border bg-card/40 hover:border-success/50 cursor-pointer transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{asset.ticker}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{asset.name}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-bold text-success bg-success/10 px-2 py-1 rounded">{formatDelta(asset.percentage, true)}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase mt-1 tracking-wider">Exp. Gain</span>
                      </div>
                    </div>
                    <div className="h-16 mb-4 w-[80%] pr-[20%] relative">
                      {asset.realHistoryFetched ? renderChart(asset, '1d') : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-pulse flex space-x-1">
                            <div className="h-2 w-2 bg-primary/40 rounded-full"></div>
                            <div className="h-2 w-2 bg-primary/60 rounded-full"></div>
                            <div className="h-2 w-2 bg-primary rounded-full"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-6">
                <TrendingDown className="w-6 h-6 text-danger" />
                <h2 className="text-xl font-bold font-display uppercase tracking-widest">Top Overvalued</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {currentOvervalued.slice(0, 3).map((asset) => (
                  <div key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="glass-panel p-6 rounded-2xl border border-border bg-card/40 hover:border-danger/50 cursor-pointer transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{asset.ticker}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{asset.name}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-bold text-danger bg-danger/10 px-2 py-1 rounded">{formatDelta(asset.percentage, true)}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase mt-1 tracking-wider">Exp. Gain</span>
                      </div>
                    </div>
                    <div className="h-16 mb-4 w-[80%] pr-[20%] relative">
                      {asset.realHistoryFetched ? renderChart(asset, '1d') : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-pulse flex space-x-1">
                            <div className="h-2 w-2 bg-primary/40 rounded-full"></div>
                            <div className="h-2 w-2 bg-primary/60 rounded-full"></div>
                            <div className="h-2 w-2 bg-primary rounded-full"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Screen 2: Screener */}
        <div id="screen-screener" className="w-full flex-shrink-0 snap-start h-full flex flex-col border-x border-border/30">
          <div className="bg-background/80 backdrop-blur-md z-10 px-6 py-6 border-b border-border/50 flex-shrink-0">
            <h2 className="text-2xl font-black mb-4 uppercase tracking-wider">Screener</h2>
            
            <div className="flex gap-4 mb-4">
               <div className="relative flex-1">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                 <input type="text" placeholder="Search Asset..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-background border border-border rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-primary text-foreground" />
               </div>
               <div className="relative w-24">
                 <span className="text-[10px] font-bold text-muted-foreground absolute left-3 -top-2 bg-background px-1">MIN GAIN</span>
                 <input type="number" value={minGap} onChange={e => setMinGap(Number(e.target.value))} className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary text-foreground font-mono" />
               </div>
               <div className="flex bg-muted p-1 rounded-lg border border-border/50 shadow-inner h-[38px] items-center">
                 <button onClick={() => setUnit('pct')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${unit === 'pct' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>%</button>
                 <button onClick={() => setUnit('usd')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${unit === 'usd' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>$</button>
                 <button onClick={() => setUnit('pts')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${unit === 'pts' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>PTS</button>
               </div>
            </div>

            {/* Asset Type Toggle */}
            <div className="flex bg-muted p-1 rounded-xl w-full max-w-sm mb-4 border border-border/50 shadow-inner">
              <button onClick={() => setAssetTypeFilter('all')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${assetTypeFilter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>All Assets</button>
              <button onClick={() => setAssetTypeFilter('stock')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${assetTypeFilter === 'stock' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Stocks Only</button>
              <button onClick={() => setAssetTypeFilter('index')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${assetTypeFilter === 'index' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Indexes</button>
            </div>

            {/* Undervalued/Overvalued Segmented Toggle */}
            <div className="flex bg-muted p-1 rounded-xl w-full border border-border/50 shadow-inner">
              <button onClick={() => setActiveTab('undervalued')} className={`flex-1 flex justify-center items-center gap-2 text-xs font-bold py-2 rounded-lg transition-all ${activeTab === 'undervalued' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <span className={`h-2 w-2 rounded-full ${activeTab === 'undervalued' ? 'bg-success' : 'bg-muted-foreground/30'}`}></span> Undervalued
              </button>
              <button onClick={() => setActiveTab('overvalued')} className={`flex-1 flex justify-center items-center gap-2 text-xs font-bold py-2 rounded-lg transition-all ${activeTab === 'overvalued' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <span className={`h-2 w-2 rounded-full ${activeTab === 'overvalued' ? 'bg-danger' : 'bg-muted-foreground/30'}`}></span> Overvalued
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto px-6 py-4 pb-32">
            <table className="w-full text-left min-w-[600px] border-separate border-spacing-y-2 relative">
              <thead className="sticky top-0 bg-background z-20 shadow-sm before:content-[''] before:absolute before:-top-4 before:left-0 before:right-0 before:h-4 before:bg-background">
                <tr className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-background">
                  <th className="pb-3 px-4 pt-2">Asset</th>
                  <th className="pb-3 px-4 pt-2 text-right">Expected Gain</th>
                  <th className="pb-3 px-4 pt-2 text-right hidden md:table-cell">Success %</th>
                  <th className="pb-3 px-4 pt-2 text-right">Price</th>
                  <th className="pb-3 px-4 pt-2 text-right">Target</th>
                </tr>
              </thead>
                <tbody className="font-mono text-sm">
                  {(activeTab === 'undervalued' ? currentUndervalued : currentOvervalued).map((asset) => (
                    <tr key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="group cursor-pointer">
                      <td className="py-3 px-4 bg-card border-y border-l border-border rounded-l-xl group-hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3">
                          <button onClick={(e) => toggleWatchlist(asset, e)} className="text-muted-foreground hover:text-primary">
                            <span className={`text-lg ${watchlist.find(a => a.ticker === asset.ticker) ? 'text-primary' : ''}`}>
                              {watchlist.find(a => a.ticker === asset.ticker) ? '★' : '☆'}
                            </span>
                          </button>
                          <div>
                            <div className="font-bold text-foreground font-sans">{asset.ticker}</div>
                            <div className="text-xs text-muted-foreground font-sans line-clamp-1 max-w-[120px]">{asset.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`py-3 px-4 bg-card border-y border-border text-right group-hover:bg-muted transition-colors font-bold ${activeTab === 'undervalued' ? 'text-success' : 'text-danger'}`}>
                        {formatDelta(unit === 'pct' ? asset.percentage : asset.delta, unit)}
                      </td>
                      <td className="py-3 px-4 bg-card border-y border-border text-right hidden md:table-cell group-hover:bg-muted transition-colors font-semibold text-muted-foreground">{asset.successRate || 0}%</td>
                      <td className="py-3 px-4 bg-card border-y border-border text-right group-hover:bg-muted transition-colors font-semibold">{formatCurrency(asset.price)}</td>
                      <td className="py-3 px-4 bg-card border-y border-r border-border rounded-r-xl text-right group-hover:bg-muted transition-colors font-semibold text-muted-foreground">{formatCurrency(asset.target)}</td>
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
        </div>

        {/* Screen 3: Watchlist */}
        <div id="screen-watchlist" className="w-full flex-shrink-0 snap-start h-full overflow-y-auto pb-24">
          <div className="sticky top-0 bg-background/80 backdrop-blur-md z-10 px-6 py-6 border-b border-border/50">
            <h2 className="text-2xl font-black mb-1 uppercase tracking-wider">Watchlist</h2>
            <p className="text-sm text-muted-foreground font-semibold uppercase">{watchlist.length} Assets Tracked</p>
          </div>
          <div className="p-6">
            {watchlist.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <span className="text-4xl mb-4 block">★</span>
                <h3 className="font-bold text-lg text-foreground">Watchlist Empty</h3>
                <p className="text-sm">Tap the star icon on screener assets to add them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map((asset) => (
                  <div key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="glass-panel p-6 rounded-2xl border border-border bg-card/40 cursor-pointer hover:border-primary/50 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{asset.ticker}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{asset.name}</p>
                      </div>
                      <button onClick={(e) => toggleWatchlist(asset, e)} className="text-primary hover:text-foreground text-xl">★</button>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="font-mono font-bold text-xl">{formatCurrency(asset.price)}</div>
                      <div className="flex flex-col items-end">
                        <div className={`font-mono font-bold ${asset.percentage >= 0 ? 'text-success' : 'text-danger'}`}>{formatDelta(asset.percentage, true)}</div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase mt-1 tracking-wider">Exp. Gain</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Screen 2.5: Detail Panel Overlay */}
      {selectedAsset && (
        <div className="absolute inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm transition-all">
          <div className="w-full md:w-[600px] h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="flex justify-between items-start mb-0 border-b border-border/50 pb-4 px-6 pt-6 gap-4">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-3xl font-black text-foreground tracking-tight flex flex-col sm:flex-row sm:items-center gap-2 break-words">
                  <span className="line-clamp-2">{selectedAsset.name.toUpperCase()}</span> <span className="text-muted-foreground text-xl font-normal whitespace-nowrap">{selectedAsset.ticker}</span>
                </h2>
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-1">{selectedAsset.type === 'stock' ? 'Stock' : 'Index'}</div>
              </div>
              <div className="text-right flex flex-col items-end flex-shrink-0">
                <button onClick={() => setSelectedAsset(null)} className="text-muted-foreground hover:text-foreground bg-muted p-2 rounded-full mb-2"><X className="w-5 h-5"/></button>
                <div className="text-2xl font-mono font-bold text-foreground">{formatCurrency(selectedAsset.price)}</div>
                <div className={`text-sm font-bold mt-1 ${selectedAsset.percentage >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatDelta(selectedAsset.percentage, true)} EXP. GAIN
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-6 pt-6 hide-scrollbar">
              
              {/* Multi-Timeframe Graph */}
              <div className="glass-panel p-5 rounded-xl border border-border bg-card/50">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Historical Trend & Prediction</h4>
                  <div className="flex gap-2">
                    {['1d', '1mo', '1y', '5y'].map(tf => (
                      <button 
                        key={tf} 
                        onClick={() => setChartTimeframe(tf as any)} 
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded transition-colors ${chartTimeframe === tf ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-52 w-full relative pl-14 pr-6 pt-2 pb-8">
                  {historyLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-card/60 rounded">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  )}
                  {renderChart(selectedAsset, chartTimeframe, true)}
                </div>
              </div>

              {/* Gap Metrics Row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="glass-panel p-4 rounded-xl border border-border bg-card/50">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Delta</div>
                  <div className={`text-lg font-mono font-bold ${selectedAsset.delta && selectedAsset.delta >= 0 ? 'text-success' : selectedAsset.delta == null ? 'text-muted-foreground' : 'text-danger'}`}>{formatDelta(selectedAsset.delta, false)}</div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-border bg-card/50">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Exp. Gain %</div>
                  <div className={`text-lg font-mono font-bold ${selectedAsset.percentage && selectedAsset.percentage >= 0 ? 'text-success' : selectedAsset.percentage == null ? 'text-muted-foreground' : 'text-danger'}`}>{formatDelta(selectedAsset.percentage, true)}</div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-border bg-card/50">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Consensus</div>
                  <div className={`text-lg font-mono font-bold text-foreground`}>{formatCurrency(selectedAsset.target)}</div>
                </div>
              </div>

              {/* Investment Calculator */}
              <div className="glass-panel p-6 rounded-2xl bg-card border-border border mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="w-5 h-5 text-primary" />
                  <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Projected Return</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 relative z-10">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Investment</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                      <input 
                        type="number" 
                        value={investAmount} 
                        onChange={(e) => setInvestAmount(e.target.value)}
                        className="w-full bg-background/50 border border-border rounded-lg py-2.5 pl-7 pr-3 text-sm font-mono font-bold focus:outline-none focus:border-primary text-foreground transition-all"
                        placeholder="1000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Value</label>
                    <div className="w-full h-[42px] bg-background border border-border rounded-lg py-2 px-3 text-sm font-mono font-bold text-foreground flex items-center justify-between shadow-inner overflow-hidden">
                      <span className="truncate">{getCalcFutureValue()}</span>
                    </div>
                    <div className={`mt-1.5 text-xs font-bold text-right ${selectedAsset.percentage && selectedAsset.percentage >= 0 ? 'text-success' : 'text-danger'}`}>
                      Projected Gain: {formatDelta(selectedAsset.percentage, true)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Analyst Carousel */}
              <div>
                <div className="flex items-center justify-between mb-4 mt-8">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Analyst Attribution ({selectedAsset.analysts?.length || 0})</h4>
                  </div>
                </div>
                {/* Analyst Carousel - bigger, easier to scroll */}
                <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory" style={{scrollbarWidth:'thin', scrollbarColor:'var(--color-border) transparent'}}>
                  {selectedAsset.analysts && selectedAsset.analysts.length > 0 ? selectedAsset.analysts.map((an, idx) => (
                    <div key={idx} className="flex-none w-[300px] glass-panel p-6 rounded-2xl bg-card border-border border snap-start hover:border-primary/50 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <h5 className="font-bold text-foreground text-base tracking-tight">{an.firm}</h5>
                        <span className="font-mono font-bold text-foreground text-xl">{an.target != null ? `$${an.target.toFixed(2)}` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`font-bold px-3 py-1 rounded-lg text-xs uppercase tracking-wide ${an.rating.includes('Buy') || an.rating.includes('Overweight') ? 'bg-success/10 text-success border border-success/20' : an.rating.includes('Sell') || an.rating.includes('Underweight') ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                          {an.rating}
                        </span>
                        <span className="text-muted-foreground text-sm font-semibold uppercase">{an.days_ago}d ago</span>
                      </div>
                      {an.horizon && (
                        <div className="mt-4 pt-4 border-t border-border/50 flex justify-between text-sm font-semibold">
                          <span className="text-muted-foreground uppercase">Horizon</span>
                          <span className="text-foreground">{an.horizon}</span>
                        </div>
                      )}
                    </div>
                  )) : (
                     <div className="text-muted-foreground text-sm italic">No detailed analyst data available.</div>
                  )}
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-safe md:hidden">
        <div className="flex justify-around items-center h-16">
          <a href="#screen-home" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('home'); }} className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'home' ? 'text-primary' : 'text-muted-foreground'}`}>
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </a>
          <a href="#screen-screener" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('screener'); }} className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'screener' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Screener</span>
          </a>
          <a href="#screen-watchlist" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('watchlist'); }} className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'watchlist' ? 'text-primary' : 'text-muted-foreground'}`}>
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Watchlist</span>
          </a>
        </div>
      </div>
      
      </div>
    </div>
  );
}

export default App;
