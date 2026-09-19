import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Search, FileText, X, Sun, Moon } from 'lucide-react';
import { InteractiveChart } from './components/InteractiveChart';
import { MarketOverview } from './components/MarketOverview';
import { TopMovers } from './components/TopMovers';
import { StockIcon } from './components/StockIcon';
import { Sparkline } from './components/Sparkline';

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
  const [theme, setTheme] = useState('dark'); // Default to dark for TradingView style
  
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
          ? { ...prev, history_dict: data.history_dict, history: data.history_dict['1d'], analysts: (data.analysts?.length && data.analysts.some((a: Analyst) => a.target != null)) ? data.analysts : prev.analysts, realHistoryFetched: true }
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

  const filterAssets = (assets: Asset[]) => {
    return assets.filter(asset => {
      const searchLower = search.toLowerCase();
      const matchesSearch = (asset.ticker && asset.ticker.toLowerCase().includes(searchLower)) ||
                            (asset.name && asset.name.toLowerCase().includes(searchLower));
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
  const allAssets = [...undervalued, ...overvalued];
  
  // Create a unique set of assets for the movers/overview based on the ticker
  const uniqueAssets = Array.from(new Map(allAssets.map(item => [item.ticker, item])).values());

  useEffect(() => {
    const allUnique = Array.from(new Map([...currentUndervalued, ...currentOvervalued].map(a => [a.ticker, a])).values());
    const majorTickers = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY', 'BTC-USD'];
    const overviewAssets = allUnique.filter(a => majorTickers.includes(a.ticker)).slice(0, 4);
    if (overviewAssets.length === 0) {
      overviewAssets.push(...allUnique.slice(0, 4));
    }
    
    const topAssets = [...currentUndervalued.slice(0, 3), ...currentOvervalued.slice(0, 3), ...overviewAssets];
    const uniqueTopAssets = Array.from(new Map(topAssets.map(a => [a.ticker, a])).values());

    uniqueTopAssets.forEach(asset => {
      if (!asset.realHistoryFetched && !fetchedHistoryRef.current.has(asset.ticker)) {
        fetchedHistoryRef.current.add(asset.ticker);
        fetch(`/api/stocks/history/${asset.ticker}`)
          .then(res => res.json())
          .then(data => {
            const updateAsset = (a: Asset) => a.ticker === asset.ticker ? { ...a, history_dict: data.history_dict, realHistoryFetched: true } : a;
            setUndervalued(prev => prev.map(updateAsset));
            setOvervalued(prev => prev.map(updateAsset));
            setSelectedAsset(prev => prev && prev.ticker === asset.ticker ? { ...prev, history_dict: data.history_dict, history: data.history_dict['1d'], analysts: (data.analysts?.length && data.analysts.some((a: Analyst) => a.target != null)) ? data.analysts : prev.analysts, realHistoryFetched: true } : prev);
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

  const renderChart = (asset: Asset, timeframe: string, showAxes = false, hideTitle = false) => {
    return <InteractiveChart asset={asset} timeframe={timeframe} showAxes={showAxes} hideTitle={hideTitle} />;
  };

  const renderCardDeltaStr = (asset: Asset, timeframe: string) => {
    const history = (asset.history_dict && asset.history_dict[timeframe as keyof typeof asset.history_dict]) || asset.history || [];
    if (!history || history.length < 2) return null;
    const overallDelta = history[history.length - 1] - history[0];
    const overallDeltaPct = (overallDelta / history[0]) * 100;
    const color = overallDelta >= 0 ? 'text-success' : 'text-danger';
    const str = `${overallDelta >= 0 ? '+' : ''}${formatCurrency(overallDelta)} (${overallDelta >= 0 ? '+' : ''}${overallDeltaPct.toFixed(2)}%)`;
    return (
      <div className="flex flex-col mt-2 px-1">
        <span className="text-[12px] font-bold text-foreground opacity-75">{asset.ticker} {timeframe}</span>
        <span className={`text-[12px] font-bold ${color}`}>
          {str}
        </span>
      </div>
    );
  };

  const handleTouchStart = () => { if (loading) return; };
  const handleTouchMove = () => { if (loading) return; };
  const handleTouchEnd = () => { if (loading) return; };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 flex flex-col md:flex-row overflow-hidden h-screen">
      
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-20 flex-shrink-0 border-r border-border bg-card pt-6 items-center gap-8 z-40">
         <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center border border-primary/30 shadow-md">
            <TrendingUp className="text-primary-foreground w-5 h-5" />
         </div>
         <a href="#screen-home" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('home'); }} className={`p-3 rounded-lg transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'home' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <TrendingUp className="w-6 h-6" />
         </a>
         <a href="#screen-screener" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('screener'); }} className={`p-3 rounded-lg transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'screener' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <Search className="w-6 h-6" />
         </a>
         <a href="#screen-watchlist" onClick={(e) => { if (loading) e.preventDefault(); else setCurrentScreen('watchlist'); }} className={`p-3 rounded-lg transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${currentScreen === 'watchlist' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <FileText className="w-6 h-6" />
         </a>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative">
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
        
        {/* Screen 1: Home/Dashboard */}
        <div id="screen-home" className="w-full flex-shrink-0 snap-start h-full overflow-y-auto pb-24">
          <header className="px-6 py-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-md z-50 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                <span className="text-foreground">VALUE<span className="text-primary">GAP</span></span>
              </h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-8 h-8 rounded-md border border-border flex items-center justify-center bg-card hover:bg-secondary transition-all" title="Toggle Theme">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-foreground" /> : <Moon className="w-4 h-4 text-foreground" />}
              </button>
            </div>
          </header>
          
          <div className="max-w-[1600px] mx-auto px-6 mt-6 space-y-6">
            
            {/* TradingView style market overview */}
            <MarketOverview assets={uniqueAssets} onSelectAsset={fetchAndOpenDetail} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Left Column: Top Movers */}
              <div className="xl:col-span-1">
                <TopMovers assets={uniqueAssets} onSelectAsset={fetchAndOpenDetail} />
              </div>

              {/* Right Column: Opportunities */}
              <div className="xl:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-success" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top Undervalued Opportunities</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentUndervalued.slice(0, 3).map((asset) => (
                      <div key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="bg-card border border-border p-4 rounded-lg cursor-pointer hover:border-primary/50 transition-colors shadow-sm flex flex-col justify-between min-h-[220px]">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <StockIcon ticker={asset.ticker} name={asset.name} className="w-8 h-8" />
                            <div>
                              <h3 className="font-bold text-foreground leading-none mb-1">{asset.ticker}</h3>
                              <p className="text-[10px] text-muted-foreground truncate w-20">{asset.name}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-success text-sm">{formatDelta(asset.percentage, true)}</span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase mt-0.5 tracking-wider">Exp. Gain</span>
                          </div>
                        </div>
                        <div className="flex-1 mt-4 relative">
                          {asset.realHistoryFetched ? renderChart(asset, '1d', false, true) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            </div>
                          )}
                          <div className="absolute inset-0 z-10 cursor-pointer"></div>
                        </div>
                        {asset.realHistoryFetched && renderCardDeltaStr(asset, '1d')}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-5 h-5 text-danger" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top Overvalued Warnings</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentOvervalued.slice(0, 3).map((asset) => (
                      <div key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="bg-card border border-border p-4 rounded-lg cursor-pointer hover:border-primary/50 transition-colors shadow-sm flex flex-col justify-between min-h-[220px]">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <StockIcon ticker={asset.ticker} name={asset.name} className="w-8 h-8" />
                            <div>
                              <h3 className="font-bold text-foreground leading-none mb-1">{asset.ticker}</h3>
                              <p className="text-[10px] text-muted-foreground truncate w-20">{asset.name}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-danger text-sm">{formatDelta(asset.percentage, true)}</span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase mt-0.5 tracking-wider">Exp. Drop</span>
                          </div>
                        </div>
                        <div className="flex-1 mt-4 relative">
                          {asset.realHistoryFetched ? renderChart(asset, '1d', false, true) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            </div>
                          )}
                          <div className="absolute inset-0 z-10 cursor-pointer"></div>
                        </div>
                        {asset.realHistoryFetched && renderCardDeltaStr(asset, '1d')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
        
        {/* Screen 2: Screener */}
        <div id="screen-screener" className="w-full flex-shrink-0 snap-start h-full flex flex-col border-x border-border">
          <div className="bg-card z-10 px-6 py-4 border-b border-border flex-shrink-0 shadow-sm">
            <h2 className="text-xl font-bold mb-4 text-foreground">Screener</h2>
            
            <div className="flex gap-3 mb-4">
               <div className="relative flex-1">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                 <input type="text" placeholder="Search Asset..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-background border border-border rounded-md py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:border-primary text-foreground" />
               </div>
               <div className="relative w-24">
                 <span className="text-[9px] font-bold text-muted-foreground absolute left-2 -top-2 bg-card px-1">MIN GAIN</span>
                 <input type="number" value={minGap} onChange={e => setMinGap(Number(e.target.value))} className="w-full bg-background border border-border rounded-md py-1.5 px-3 text-sm focus:outline-none focus:border-primary text-foreground font-mono" />
               </div>
               <div className="flex bg-background p-0.5 rounded-md border border-border items-center">
                 <button onClick={() => setUnit('pct')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${unit === 'pct' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>%</button>
                 <button onClick={() => setUnit('usd')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${unit === 'usd' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>$</button>
                 <button onClick={() => setUnit('pts')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${unit === 'pts' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>PTS</button>
               </div>
            </div>

            <div className="flex gap-4">
              {/* Asset Type Toggle */}
              <div className="flex bg-background p-0.5 rounded-md w-full max-w-xs border border-border">
                <button onClick={() => setAssetTypeFilter('all')} className={`flex-1 text-xs font-bold py-1.5 rounded transition-all ${assetTypeFilter === 'all' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>All</button>
                <button onClick={() => setAssetTypeFilter('stock')} className={`flex-1 text-xs font-bold py-1.5 rounded transition-all ${assetTypeFilter === 'stock' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Stocks</button>
                <button onClick={() => setAssetTypeFilter('index')} className={`flex-1 text-xs font-bold py-1.5 rounded transition-all ${assetTypeFilter === 'index' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Indexes</button>
              </div>

              {/* Undervalued/Overvalued Segmented Toggle */}
              <div className="flex bg-background p-0.5 rounded-md w-full max-w-[200px] border border-border">
                <button onClick={() => setActiveTab('undervalued')} className={`flex-1 flex justify-center items-center gap-1.5 text-xs font-bold py-1.5 rounded transition-all ${activeTab === 'undervalued' ? 'bg-success/20 text-success' : 'text-muted-foreground hover:text-foreground'}`}>
                  Undervalued
                </button>
                <button onClick={() => setActiveTab('overvalued')} className={`flex-1 flex justify-center items-center gap-1.5 text-xs font-bold py-1.5 rounded transition-all ${activeTab === 'overvalued' ? 'bg-danger/20 text-danger' : 'text-muted-foreground hover:text-foreground'}`}>
                  Overvalued
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto px-6 py-4 pb-32">
            <table className="w-full text-left min-w-[600px] border-separate border-spacing-0 relative">
              <thead className="sticky top-0 bg-background z-20 shadow-sm border-b border-border">
                <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="pb-2 px-4 pt-2 border-b border-border">Asset</th>
                  <th className="pb-2 px-4 pt-2 text-right border-b border-border">Price</th>
                  <th className="pb-2 px-4 pt-2 text-right border-b border-border">Trend</th>
                  <th className="pb-2 px-4 pt-2 text-right border-b border-border">Expected Gain</th>
                  <th className="pb-2 px-4 pt-2 text-right border-b border-border">Target</th>
                </tr>
              </thead>
                <tbody className="font-mono text-sm">
                  {(activeTab === 'undervalued' ? currentUndervalued : currentOvervalued).map((asset) => (
                    <tr key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="group cursor-pointer hover:bg-secondary/50 border-b border-border/50 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <button onClick={(e) => toggleWatchlist(asset, e)} className="text-muted-foreground hover:text-primary transition-colors">
                            <span className={`text-lg ${watchlist.find(a => a.ticker === asset.ticker) ? 'text-primary' : ''}`}>
                              {watchlist.find(a => a.ticker === asset.ticker) ? '★' : '☆'}
                            </span>
                          </button>
                          <StockIcon ticker={asset.ticker} name={asset.name} className="w-7 h-7" />
                          <div>
                            <div className="font-bold text-foreground font-sans text-sm leading-tight">{asset.ticker}</div>
                            <div className="text-[10px] text-muted-foreground font-sans line-clamp-1 max-w-[150px] leading-tight">{asset.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right text-foreground font-semibold">
                        {formatCurrency(asset.price)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex justify-end pr-2">
                           <Sparkline data={(asset.history_dict && asset.history_dict['1d']) || asset.history || []} width={50} height={20} />
                        </div>
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold ${activeTab === 'undervalued' ? 'text-success' : 'text-danger'}`}>
                        {formatDelta(unit === 'pct' ? asset.percentage : asset.delta, unit)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground font-semibold">
                        {formatCurrency(asset.target)}
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
        </div>

        {/* Screen 3: Watchlist */}
        <div id="screen-watchlist" className="w-full flex-shrink-0 snap-start h-full overflow-y-auto pb-24">
          <div className="sticky top-0 bg-card z-10 px-6 py-4 border-b border-border flex justify-between items-center shadow-sm">
            <h2 className="text-xl font-bold text-foreground">Watchlist</h2>
            <span className="text-xs text-muted-foreground font-semibold uppercase">{watchlist.length} Tracked</span>
          </div>
          <div className="p-6">
            {watchlist.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground bg-card rounded-xl border border-border border-dashed">
                <span className="text-4xl mb-4 block opacity-50">★</span>
                <h3 className="font-bold text-lg text-foreground">Watchlist Empty</h3>
                <p className="text-sm">Star assets in the screener to track them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {watchlist.map((asset) => (
                  <div key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="bg-card p-4 rounded-lg border border-border cursor-pointer hover:border-primary/50 transition-colors shadow-sm flex flex-col justify-between h-[150px]">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <StockIcon ticker={asset.ticker} name={asset.name} className="w-8 h-8" />
                        <div>
                          <h3 className="font-bold text-foreground leading-none">{asset.ticker}</h3>
                          <p className="text-[10px] text-muted-foreground truncate w-24 mt-0.5">{asset.name}</p>
                        </div>
                      </div>
                      <button onClick={(e) => toggleWatchlist(asset, e)} className="text-primary hover:text-foreground text-xl leading-none">★</button>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <div className="font-mono font-bold text-lg text-foreground">{formatCurrency(asset.price)}</div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Price</div>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center">
                        <Sparkline data={(asset.history_dict && asset.history_dict['1d']) || asset.history || []} width={50} height={20} />
                      </div>

                      <div className="flex flex-col items-end">
                        <div className={`font-mono font-bold text-sm ${asset.percentage >= 0 ? 'text-success' : 'text-danger'}`}>{formatDelta(asset.percentage, true)}</div>
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
          <div className="w-full md:w-[700px] h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right">
            
            <div className="flex justify-between items-start border-b border-border/50 pb-4 px-6 pt-6 gap-4">
              <div className="flex-1 min-w-0 pr-4 flex items-center gap-4">
                <StockIcon ticker={selectedAsset.ticker} name={selectedAsset.name} className="w-12 h-12" />
                <div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                    {selectedAsset.ticker}
                  </h2>
                  <div className="text-sm text-muted-foreground line-clamp-1">{selectedAsset.name}</div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end flex-shrink-0">
                <button onClick={() => setSelectedAsset(null)} className="text-muted-foreground hover:text-foreground p-1 rounded-md mb-2 transition-colors"><X className="w-6 h-6"/></button>
                <div className="text-2xl font-mono font-bold text-foreground">{formatCurrency(selectedAsset.price)}</div>
                <div className={`text-sm font-bold mt-1 ${selectedAsset.percentage >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatDelta(selectedAsset.percentage, true)} EXP. GAIN
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-24 pt-4 hide-scrollbar">
              
              {/* Multi-Timeframe Graph */}
              <div className="bg-background rounded-lg border border-border shadow-sm mb-6 flex flex-col">
                <div className="flex justify-between items-center px-4 py-2 border-b border-border">
                  <div className="flex gap-2">
                    {['1d', '1mo', '1y', '5y'].map(tf => (
                      <button 
                        key={tf} 
                        onClick={() => setChartTimeframe(tf as any)} 
                        className={`text-xs font-bold uppercase px-3 py-1 rounded transition-colors ${chartTimeframe === tf ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-72 w-full relative">
                  {historyLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50 backdrop-blur-sm rounded-b-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  )}
                  {renderChart(selectedAsset, chartTimeframe, true, true)}
                </div>
                <div className="px-4 pb-4 pt-2">
                  {selectedAsset.realHistoryFetched && renderCardDeltaStr(selectedAsset, chartTimeframe)}
                </div>
              </div>

              {/* Gap Metrics Row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-card p-4 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Delta</div>
                  <div className={`text-lg font-mono font-bold ${selectedAsset.delta && selectedAsset.delta >= 0 ? 'text-success' : selectedAsset.delta == null ? 'text-muted-foreground' : 'text-danger'}`}>{formatDelta(selectedAsset.delta, false)}</div>
                </div>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Exp. Gain %</div>
                  <div className={`text-lg font-mono font-bold ${selectedAsset.percentage && selectedAsset.percentage >= 0 ? 'text-success' : selectedAsset.percentage == null ? 'text-muted-foreground' : 'text-danger'}`}>{formatDelta(selectedAsset.percentage, true)}</div>
                </div>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Consensus Target</div>
                  <div className={`text-lg font-mono font-bold text-foreground`}>{formatCurrency(selectedAsset.target)}</div>
                </div>
              </div>

              {/* Analyst Carousel */}
              <div>
                <div className="flex items-center justify-between mb-4 mt-8 border-b border-border pb-2">
                  <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Analyst Ratings</h4>
                  <span className="text-xs text-muted-foreground font-semibold bg-secondary px-2 py-1 rounded">{selectedAsset.analysts?.length || 0} Analysts</span>
                </div>
                <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-thin">
                  {selectedAsset.analysts && selectedAsset.analysts.length > 0 ? selectedAsset.analysts.map((an, idx) => (
                    <div key={idx} className="flex-none w-[280px] bg-background p-5 rounded-lg border border-border hover:border-primary/50 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <h5 className="font-bold text-foreground text-sm">{an.firm}</h5>
                        <span className="font-mono font-bold text-foreground text-lg leading-none">{an.target != null ? `$${an.target.toFixed(2)}` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`font-bold px-2 py-1 rounded text-[10px] uppercase tracking-wider ${an.rating.includes('Buy') || an.rating.includes('Overweight') ? 'bg-success/20 text-success' : an.rating.includes('Sell') || an.rating.includes('Underweight') ? 'bg-danger/20 text-danger' : 'bg-muted text-muted-foreground'}`}>
                          {an.rating}
                        </span>
                        <span className="text-muted-foreground text-[10px] font-semibold uppercase">{an.days_ago}d ago</span>
                      </div>
                    </div>
                  )) : (
                     <div className="text-muted-foreground text-sm italic">No detailed analyst data available.</div>
                  )}
                </div>
              </div>

              {/* Analyst Price Targets */}
              {(() => {
                if (!selectedAsset.analysts || selectedAsset.analysts.length === 0) return null;
                const targets = selectedAsset.analysts.map(a => a.target).filter(t => t != null && !isNaN(t));
                if (targets.length === 0) return null;
                const low = Math.min(...targets);
                const high = Math.max(...targets);
                const average = targets.reduce((a,b) => a+b, 0) / targets.length;
                const sortedTargets = [...targets].sort((a,b) => a-b);
                const median = sortedTargets.length % 2 === 0 ? (sortedTargets[sortedTargets.length/2 - 1] + sortedTargets[sortedTargets.length/2]) / 2 : sortedTargets[Math.floor(sortedTargets.length/2)];
                const current = selectedAsset.price;

                const minVal = Math.min(low, current);
                const maxVal = Math.max(high, current);
                const range = maxVal - minVal || 1;
                const paddedMin = minVal - range * 0.1;
                const paddedMax = maxVal + range * 0.1;
                const paddedRange = paddedMax - paddedMin;

                const getPos = (val: number) => `${((val - paddedMin) / paddedRange) * 100}%`;

                return (
                  <div className="mt-8 mb-8 pt-4 px-4">
                    <h4 className="font-bold text-foreground text-sm uppercase tracking-wider mb-2 text-center">Analyst Price Targets</h4>
                    
                    {/* Container for the line with tall vertical margins to accommodate absolute labels */}
                    <div className="relative w-full h-0.5 bg-border rounded mt-20 mb-20">
                      {/* Line connecting low to high */}
                      <div className="absolute top-0 h-0.5 bg-muted-foreground/30" style={{ left: getPos(low), right: `${100 - parseFloat(getPos(high))}%` }}></div>
                      
                      {/* Median */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: getPos(median) }}>
                        <div className="absolute bottom-full mb-8 flex flex-col items-center">
                          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap mb-1">Median: ${median.toFixed(2)}</span>
                          <div className="h-6 w-px bg-muted-foreground/50"></div>
                        </div>
                        <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full z-10"></div>
                      </div>

                      {/* Average */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10" style={{ left: getPos(average) }}>
                        <div className="absolute bottom-full mb-1 flex flex-col items-center">
                          <span className="text-sm font-bold text-foreground whitespace-nowrap mb-1">Average: ${average.toFixed(2)}</span>
                          <div className="h-4 w-px bg-foreground"></div>
                        </div>
                        <div className="w-2 h-2 bg-background border-[1.5px] border-foreground rounded-full"></div>
                      </div>

                      {/* Low */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: getPos(low) }}>
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full"></div>
                        <span className="absolute top-full mt-2 text-xs text-muted-foreground font-semibold whitespace-nowrap">Low: ${low.toFixed(2)}</span>
                      </div>

                      {/* High */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: getPos(high) }}>
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full"></div>
                        <span className="absolute top-full mt-2 text-xs text-muted-foreground font-semibold whitespace-nowrap">High: ${high.toFixed(2)}</span>
                      </div>

                      {/* Current */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-20" style={{ left: getPos(current) }}>
                        <div className="absolute top-full mt-1 flex flex-col items-center">
                          <div className="h-5 w-px bg-primary/50 mb-1"></div>
                          <span className="text-sm font-bold text-primary whitespace-nowrap bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-sm">Current: ${current.toFixed(2)}</span>
                        </div>
                        <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)] ring-2 ring-background"></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-safe md:hidden">
        <div className="flex justify-around items-center h-[60px]">
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
