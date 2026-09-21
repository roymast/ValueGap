import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Search, FileText, X, Sun, Moon } from 'lucide-react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { InteractiveChart } from './components/InteractiveChart';
import { MarketOverview } from './components/MarketOverview';
import { TopMovers } from './components/TopMovers';
import { StockIcon } from './components/StockIcon';
import { Sparkline } from './components/Sparkline';
import { CardSkeleton, TableRowSkeleton, OverviewSkeleton, TopMoverSkeleton, ChartSkeleton, AnalystSkeleton, PriceTargetSkeleton } from './components/Skeletons';
import { useStore } from './store/useStore';

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
  exchange?: string;
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
  flash?: 'up' | 'down';
}

function App() {
  const [homeTopUnder, setHomeTopUnder] = useState<Asset[]>([]);
  const [homeTopOver, setHomeTopOver] = useState<Asset[]>([]);
  const [movers, setMovers] = useState<any>([]);
  const [overviewAssets, setOverviewAssets] = useState<Asset[]>([]);
  const [screenerUndervalued, setScreenerUndervalued] = useState<Asset[]>([]);
  const [screenerOvervalued, setScreenerOvervalued] = useState<Asset[]>([]);
  const [allGlobalAssets, setAllGlobalAssets] = useState<Asset[]>([]);
  const [displayLimit, setDisplayLimit] = useState(30);
  const [search, setSearch] = useState('');
  const [minGap, setMinGap] = useState<number>(0);
  const [unit, setUnit] = useState<'pct'|'usd'|'pts'>('pct');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all'|'stock'|'index'>('all');
  const [activeTab, setActiveTab] = useState<'undervalued'|'overvalued'>('undervalued');
  
  const { theme, setTheme, watchlist, toggleWatchlist: storeToggleWatchlist } = useStore();

  const [chartTimeframe, setChartTimeframe] = useState<'1d' | '1mo' | '1y' | '5y'>('1d');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showOlderAnalysts, setShowOlderAnalysts] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard`);
      if (res.ok) {
        const data = await res.json();
        
        const processAssets = (assets: any[]) => assets.map(a => ({
          ...a,
          name: a.name || a.company_name,
          history: a.history_list || a.history,
          history_dict: a.history_dict || (a.history_list ? {'1mo': a.history_list, '1d': a.history_list, '1y': a.history_list, '5y': a.history_list} : undefined),
          realHistoryFetched: !!a.history_list || !!a.history_dict
        }));

        setHomeTopUnder(processAssets(data.table_home?.undervalued || []));
        setHomeTopOver(processAssets(data.table_home?.overvalued || []));
        setMovers(data.table_movers || []);
        setOverviewAssets(processAssets(data.table_overview || []));
        console.log("Dashboard data fetched:", data);
      }
      setLoading(false);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Failed to load dashboard data");
      setLoading(false);
    }
  };

  const fetchGlobalAssets = async () => {
    try {
      console.log("Fetching global assets (screener & all)...");
      const screenerRes = await fetch(`/api/screener`);
      const processAssets = (assets: any[]) => assets.map(a => ({
        ...a,
        name: a.name || a.company_name,
        history: a.history_list || a.history,
        history_dict: a.history_dict || (a.history_list ? {'1mo': a.history_list, '1d': a.history_list, '1y': a.history_list, '5y': a.history_list} : undefined),
        realHistoryFetched: !!a.history_list || !!a.history_dict
      }));

      if (screenerRes.ok) {
        const sData = await screenerRes.json();
        setScreenerUndervalued(processAssets(sData.undervalued || []));
        setScreenerOvervalued(processAssets(sData.overvalued || []));
      } else {
        console.error("Failed to fetch screener data", screenerRes.status);
      }
      const allRes = await fetch(`/api/stocks`);
      if (allRes.ok) {
        const aData = await allRes.json();
        let allAssets: Asset[] = [];
        if (aData.table_all) allAssets = processAssets(aData.table_all);
        else if (Array.isArray(aData)) allAssets = processAssets(aData);
        else if (aData.undervalued && aData.overvalued) allAssets = [...processAssets(aData.undervalued), ...processAssets(aData.overvalued)];
        
        setAllGlobalAssets(allAssets);
        console.log("Fetched allGlobalAssets count:", allAssets.length);
      } else {
        console.error("Failed to fetch all stocks data", allRes.status);
      }
    } catch (err) {
      console.error("Global assets fetch error:", err);
    }
  };

  useEffect(() => {
    fetchDashboardData().then(fetchGlobalAssets);
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (selectedAsset) {
        setSelectedAsset(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedAsset]);

  const closeDetailPanel = () => {
    if (window.history.state?.detailPanelOpen) {
      window.history.back();
    } else {
      setSelectedAsset(null);
    }
  };

  // Open detail panel and lazily fetch real history for this ticker
  const fetchAndOpenDetail = async (asset: Asset) => {
    if (!selectedAsset) {
      window.history.pushState({ detailPanelOpen: true }, '');
    }
    setSelectedAsset(asset); // open immediately with synthetic history
    setShowOlderAnalysts(false);
    setChartTimeframe('1d');
    
    if (asset.realHistoryFetched) {
      setHistoryLoading(false);
      return;
    }

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
        setScreenerUndervalued(prev => prev.map(updateAsset));
        setScreenerOvervalued(prev => prev.map(updateAsset));
        setHomeTopUnder(prev => prev.map(updateAsset));
        setHomeTopOver(prev => prev.map(updateAsset));
      }
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };



  const getCurrencyCode = (exchange?: string) => {
    if (exchange === "TASE") return "ILS";
    if (exchange && ['LSE', 'LSE_BULL'].includes(exchange)) return "GBP";
    if (exchange && ['XETR', 'FWB'].includes(exchange)) return "EUR";
    return "USD";
  };

  const formatCurrency = (value: number | null | undefined, exchange?: string) => {
    if (value == null) return "N/A";
    if (value === 0) return "Data Unavailable";
    const currency = getCurrencyCode(exchange);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const formatDelta = (value: number | null | undefined, isPercent: boolean | 'pct' | 'usd' | 'pts' = false) => {
    if (value == null) return "N/A";
    if (value === 0 && !isPercent) return "0.00";
    const sign = value > 0 ? '+' : '';
    
    const type = isPercent === true ? 'pct' : isPercent === false ? 'usd' : isPercent;
    
    let num = '';
    if (type === 'pct') num = `${value.toFixed(1)}%`;
    else if (type === 'pts') num = value.toFixed(2);
    else num = formatCurrency(value, undefined);
    
    return `${sign}${num}`;
  };

  const formatDeltaWithExchange = (value: number | null | undefined, isPercent: boolean | 'pct' | 'usd' | 'pts' = false, exchange?: string) => {
    if (value == null) return "N/A";
    const currency = getCurrencyCode(exchange);
    if (value === 0 && (!isPercent || isPercent === 'usd')) return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(0);
    const sign = value > 0 ? '+' : '';
    
    const type = isPercent === true ? 'pct' : isPercent === false ? 'usd' : isPercent;
    
    let num = '';
    if (type === 'pct') num = `${value.toFixed(1)}%`;
    else if (type === 'pts') num = value.toFixed(2);
    else num = formatCurrency(value, exchange);
    
    return `${sign}${num}`;
  };

  const filterAssets = (assets: Asset[], applySearchAndFilters: boolean = true) => {
    return assets.filter(asset => {
      if (!applySearchAndFilters) return true;
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

  const isSearching = search.trim().length > 0;
  const baseUndervalued = (isSearching || displayLimit > screenerUndervalued.length) && allGlobalAssets.length > 0
    ? allGlobalAssets.filter(a => a.percentage > 0)
    : screenerUndervalued;
  const baseOvervalued = (isSearching || displayLimit > screenerOvervalued.length) && allGlobalAssets.length > 0
    ? allGlobalAssets.filter(a => a.percentage <= 0)
    : screenerOvervalued;

  const currentUndervalued = filterAssets(baseUndervalued, true);
  const currentOvervalued = filterAssets(baseOvervalued, true);
  
  const homeUndervalued = homeTopUnder;
  const homeOvervalued = homeTopOver;

  const toggleWatchlist = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    storeToggleWatchlist(asset);
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
    const str = `${overallDelta >= 0 ? '+' : ''}${formatCurrency(overallDelta, asset.exchange)} (${overallDelta >= 0 ? '+' : ''}${overallDeltaPct.toFixed(2)}%)`;
    return (
      <div className="flex flex-col mt-2 px-1">
        <span className="text-[12px] font-bold text-foreground opacity-75">{asset.ticker} {timeframe}</span>
        <span className={`text-[12px] font-bold ${color}`}>
          {str}
        </span>
      </div>
    );
  };
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 flex flex-col md:flex-row overflow-hidden h-screen">
      
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-20 flex-shrink-0 border-r border-border bg-card pt-6 items-center gap-8 z-40">
         <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center border border-primary/30 shadow-md">
            <TrendingUp className="text-primary-foreground w-5 h-5" />
         </div>
         <NavLink to="/" className={({isActive}) => `p-3 rounded-lg transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <TrendingUp className="w-6 h-6" />
         </NavLink>
         <NavLink to="/screener" className={({isActive}) => `p-3 rounded-lg transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <Search className="w-6 h-6" />
         </NavLink>
         <NavLink to="/watchlist" className={({isActive}) => `p-3 rounded-lg transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <FileText className="w-6 h-6" />
         </NavLink>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        <div 
          className={`flex-1 flex ${loading ? 'overflow-hidden touch-none' : 'overflow-x-auto'} hide-scrollbar relative w-full`}
        >
          {/* Skeleton loading replaces the full-screen spinner */}
        
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-danger/90 text-white px-4 py-2 rounded-lg shadow-lg">
              {error}
            </div>
          )}

          <Routes>
            <Route path="/" element={
              <div id="screen-home" className="w-full flex-shrink-0 h-full overflow-y-auto pb-24">
                <header className="px-6 py-4 border-b border-border/50 sticky top-0 bg-background/80 glass-panel z-50 flex justify-between items-center transition-all duration-300">
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                <span className="text-foreground">VALUE<span className="text-primary">GAP</span></span>
              </h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-8 h-8 rounded-md border border-border flex items-center justify-center bg-card hover:bg-secondary transition-all active:scale-95 shadow-sm" title="Toggle Theme">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-foreground" /> : <Moon className="w-4 h-4 text-foreground" />}
              </button>
            </div>
          </header>
          
          <div className="max-w-[1600px] mx-auto px-6 mt-6 space-y-6">
            
            {/* TradingView style market overview */}
            {loading ? <OverviewSkeleton /> : <MarketOverview assets={overviewAssets.length > 0 ? overviewAssets : allGlobalAssets} onSelectAsset={fetchAndOpenDetail} />}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Left Column: Top Movers */}
              <div className="xl:col-span-1">
                {loading ? (
                  <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-4">
                    <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2"></div>
                    <TopMoverSkeleton />
                    <TopMoverSkeleton />
                    <TopMoverSkeleton />
                    <TopMoverSkeleton />
                    <TopMoverSkeleton />
                  </div>
                ) : (
                  <TopMovers gainers={Array.isArray(movers) ? movers : (movers.gainers || [])} losers={Array.isArray(movers) ? [] : (movers.losers || [])} onSelectAsset={fetchAndOpenDetail} />
                )}
              </div>

              {/* Right Column: Opportunities */}
              <div className="xl:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-success" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top Undervalued Opportunities</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                      <>
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                      </>
                    ) : homeUndervalued.map((asset) => (
                      <div key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="relative bg-card border border-border p-4 rounded-lg cursor-pointer hover:border-primary/50 transition-all shadow-sm flex flex-col justify-between min-h-[220px] hover:-translate-y-1 overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div className="flex justify-between items-start relative z-10">
                          <div className="flex items-center gap-2">
                            <StockIcon ticker={asset.ticker} name={asset.name} className="w-8 h-8" />
                            <div>
                              <h3 className="font-bold text-foreground leading-none mb-1">{asset.ticker} <span className="text-[10px] text-muted-foreground font-normal ml-1">({asset.exchange || 'Unknown'})</span></h3>
                              <p className="text-[10px] text-muted-foreground truncate w-20">{asset.name}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-success text-sm">{formatDelta(asset.percentage, true)}</span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase mt-0.5 tracking-wider">Exp. Gain</span>
                          </div>
                        </div>
                        <div className="flex-1 mt-4 relative z-10">
                          {asset.realHistoryFetched ? renderChart(asset, '1d', false, true) : (
                            <ChartSkeleton />
                          )}
                          <div className="absolute inset-0 z-10 cursor-pointer"></div>
                        </div>
                        <div className="relative z-10">
                          {asset.realHistoryFetched && renderCardDeltaStr(asset, '1d')}
                        </div>
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
                    {loading ? (
                      <>
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                      </>
                    ) : homeOvervalued.map((asset) => (
                      <div key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className="relative bg-card border border-border p-4 rounded-lg cursor-pointer hover:border-primary/50 transition-all shadow-sm flex flex-col justify-between min-h-[220px] hover:-translate-y-1 overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div className="flex justify-between items-start relative z-10">
                          <div className="flex items-center gap-2">
                            <StockIcon ticker={asset.ticker} name={asset.name} className="w-8 h-8" />
                            <div>
                              <h3 className="font-bold text-foreground leading-none mb-1">{asset.ticker} <span className="text-[10px] text-muted-foreground font-normal ml-1">({asset.exchange || 'Unknown'})</span></h3>
                              <p className="text-[10px] text-muted-foreground truncate w-20">{asset.name}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-danger text-sm">{formatDelta(asset.percentage, true)}</span>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase mt-0.5 tracking-wider">Exp. Drop</span>
                          </div>
                        </div>
                        <div className="flex-1 mt-4 relative z-10">
                          {asset.realHistoryFetched ? renderChart(asset, '1d', false, true) : (
                            <ChartSkeleton />
                          )}
                          <div className="absolute inset-0 z-10 cursor-pointer"></div>
                        </div>
                        <div className="relative z-10">
                          {asset.realHistoryFetched && renderCardDeltaStr(asset, '1d')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
        } />
        
        {/* Screen 2: Screener */}
        <Route path="/screener" element={
        <div id="screen-screener" className="w-full flex-shrink-0 h-full flex flex-col pb-24 border-x border-border">
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
          
          <div className="flex-1 overflow-auto px-6 py-4 pb-32" onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 200) {
              setDisplayLimit(prev => prev + 30);
            }
          }}>
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
                  {loading ? (
                    <>
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                      <TableRowSkeleton />
                    </>
                  ) : (
                    (activeTab === 'undervalued' ? currentUndervalued : currentOvervalued).slice(0, displayLimit).map((asset) => (
                      <tr key={asset.ticker} onClick={() => fetchAndOpenDetail(asset)} className={`group cursor-pointer border-b border-border/50 transition-all hover:translate-x-1 ${asset.flash === 'up' ? 'bg-success/30 duration-300' : asset.flash === 'down' ? 'bg-danger/30 duration-300' : 'hover:bg-secondary/50 duration-1000'}`}>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-3">
                            <button onClick={(e) => toggleWatchlist(asset, e)} className="text-muted-foreground hover:text-primary transition-colors active:scale-95">
                              <span className={`text-lg ${watchlist.find(a => a.ticker === asset.ticker) ? 'text-primary' : ''}`}>
                                {watchlist.find(a => a.ticker === asset.ticker) ? '★' : '☆'}
                              </span>
                            </button>
                            <StockIcon ticker={asset.ticker} name={asset.name} className="w-7 h-7" />
                            <div>
                              <div className="font-bold text-foreground font-sans text-sm leading-tight">{asset.ticker} <span className="text-[10px] text-muted-foreground font-normal ml-1">({asset.exchange || 'Unknown'})</span></div>
                              <div className="text-[10px] text-muted-foreground font-sans line-clamp-1 max-w-[150px] leading-tight">{asset.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right text-foreground font-semibold">
                          {formatCurrency(asset.price, asset.exchange)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex justify-end pr-2">
                             <Sparkline data={(asset.history_dict && asset.history_dict['1d']) || asset.history || []} width={50} height={20} />
                          </div>
                        </td>
                        <td className={`py-2.5 px-4 text-right font-bold ${activeTab === 'undervalued' ? 'text-success' : 'text-danger'}`}>
                          {formatDeltaWithExchange(unit === 'pct' ? asset.percentage : asset.delta, unit, asset.exchange)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-muted-foreground font-semibold">
                          {formatCurrency(asset.target, asset.exchange)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
            </table>
          </div>
        </div>
        } />

        {/* Screen 3: Watchlist */}
        <Route path="/watchlist" element={
        <div id="screen-watchlist" className="w-full flex-shrink-0 h-full flex flex-col pb-24">
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
                          <h3 className="font-bold text-foreground leading-none">{asset.ticker} <span className="text-[10px] text-muted-foreground font-normal ml-1">({asset.exchange || 'Unknown'})</span></h3>
                          <p className="text-[10px] text-muted-foreground truncate w-24 mt-0.5">{asset.name}</p>
                        </div>
                      </div>
                      <button onClick={(e) => toggleWatchlist(asset, e)} className="text-primary hover:text-foreground text-xl leading-none">★</button>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <div className="font-mono font-bold text-lg text-foreground">{formatCurrency(asset.price, asset.exchange)}</div>
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
        } />
          </Routes>
      </div>

      {/* Screen 2.5: Detail Panel Overlay */}
      {selectedAsset && (
        <div className="absolute inset-0 z-50 flex justify-end bg-background/80 glass-panel backdrop-blur-md transition-all">
          <div className="w-full md:w-[700px] h-full bg-card/95 border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="flex justify-between items-start border-b border-border/50 pb-4 px-6 pt-6 gap-4">
              <div className="flex-1 min-w-0 pr-4 flex items-center gap-4">
                <StockIcon ticker={selectedAsset.ticker} name={selectedAsset.name} className="w-12 h-12" />
                <div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                    {selectedAsset.ticker} <span className="text-sm font-normal text-muted-foreground">({selectedAsset.exchange || 'Unknown'})</span>
                  </h2>
                  <div className="text-sm text-muted-foreground line-clamp-1">{selectedAsset.name}</div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end flex-shrink-0">
                <button onClick={closeDetailPanel} className="text-muted-foreground hover:text-foreground p-1 rounded-md mb-2 transition-colors"><X className="w-6 h-6"/></button>
                <div className="text-2xl font-mono font-bold text-foreground">{formatCurrency(selectedAsset.price, selectedAsset.exchange)}</div>
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
                  {historyLoading ? (
                    <ChartSkeleton />
                  ) : (
                    renderChart(selectedAsset, chartTimeframe, true, true)
                  )}
                </div>
                <div className="px-4 pb-4 pt-2">
                  {selectedAsset.realHistoryFetched && renderCardDeltaStr(selectedAsset, chartTimeframe)}
                </div>
              </div>

              {/* Gap Metrics Row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-card p-4 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Delta</div>
                  <div className={`text-lg font-mono font-bold ${selectedAsset.delta && selectedAsset.delta >= 0 ? 'text-success' : selectedAsset.delta == null ? 'text-muted-foreground' : 'text-danger'}`}>{formatDeltaWithExchange(selectedAsset.delta, false, selectedAsset.exchange)}</div>
                </div>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Exp. Gain %</div>
                  <div className={`text-lg font-mono font-bold ${selectedAsset.percentage && selectedAsset.percentage >= 0 ? 'text-success' : selectedAsset.percentage == null ? 'text-muted-foreground' : 'text-danger'}`}>{formatDelta(selectedAsset.percentage, true)}</div>
                </div>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Consensus Target</div>
                  <div className={`text-lg font-mono font-bold text-foreground`}>{formatCurrency(selectedAsset.target, selectedAsset.exchange)}</div>
                </div>
              </div>

              {/* Analyst Carousel */}
              <div>
                <div className="flex items-center justify-between mb-4 mt-8 border-b border-border pb-2">
                  <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">Analyst Ratings</h4>
                  <span className="text-xs text-muted-foreground font-semibold bg-secondary px-2 py-1 rounded">{selectedAsset.analysts?.length || 0} Analysts</span>
                </div>
                <div className="flex flex-col gap-4 pb-6">
                  <div className="flex overflow-x-auto gap-4 scrollbar-thin">
                    {historyLoading ? (
                      <AnalystSkeleton />
                    ) : selectedAsset.analysts && selectedAsset.analysts.length > 0 ? (
                      (() => {
                        const visibleAnalysts = showOlderAnalysts ? selectedAsset.analysts : selectedAsset.analysts.filter(an => an.days_ago != null && an.days_ago <= 31);
                        if (visibleAnalysts.length === 0) return <div className="text-muted-foreground text-sm italic py-2">No recent analyst data available in the last 31 days.</div>;
                        return visibleAnalysts.map((an, idx) => (
                          <div key={idx} className="flex-none w-[280px] bg-background p-5 rounded-lg border border-border hover:border-primary/50 transition-colors shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <h5 className="font-bold text-foreground text-sm">{an.firm}</h5>
                              <span className="font-mono font-bold text-foreground text-lg leading-none">{an.target != null ? formatCurrency(an.target, selectedAsset.exchange) : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`font-bold px-2 py-1 rounded text-[10px] uppercase tracking-wider ${an.rating.includes('Buy') || an.rating.includes('Overweight') ? 'bg-success/20 text-success' : an.rating.includes('Sell') || an.rating.includes('Underweight') ? 'bg-danger/20 text-danger' : 'bg-muted text-muted-foreground'}`}>
                                {an.rating}
                              </span>
                              <span className="text-muted-foreground text-[10px] font-semibold uppercase">{an.days_ago}d ago</span>
                            </div>
                          </div>
                        ));
                      })()
                    ) : (
                       <div className="text-muted-foreground text-sm italic">No detailed analyst data available.</div>
                    )}
                  </div>
                  {!showOlderAnalysts && selectedAsset.analysts && selectedAsset.analysts.some(an => an.days_ago != null && an.days_ago > 31) && (
                    <button onClick={() => setShowOlderAnalysts(true)} className="text-xs text-primary font-semibold hover:underline cursor-pointer self-start">Display previous data</button>
                  )}
                </div>
              </div>

              {/* Analyst Price Targets */}
              {historyLoading ? <PriceTargetSkeleton /> : (() => {
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
                          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap mb-1">Median: {formatCurrency(median, selectedAsset.exchange)}</span>
                          <div className="h-6 w-px bg-muted-foreground/50"></div>
                        </div>
                        <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full z-10"></div>
                      </div>

                      {/* Average */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10" style={{ left: getPos(average) }}>
                        <div className="absolute bottom-full mb-1 flex flex-col items-center">
                          <span className="text-sm font-bold text-foreground whitespace-nowrap mb-1">Average: {formatCurrency(average, selectedAsset.exchange)}</span>
                          <div className="h-4 w-px bg-foreground"></div>
                        </div>
                        <div className="w-2 h-2 bg-background border-[1.5px] border-foreground rounded-full"></div>
                      </div>

                      {/* Low */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: getPos(low) }}>
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full"></div>
                        <span className="absolute top-full mt-2 text-xs text-muted-foreground font-semibold whitespace-nowrap">Low: {formatCurrency(low, selectedAsset.exchange)}</span>
                      </div>

                      {/* High */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: getPos(high) }}>
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full"></div>
                        <span className="absolute top-full mt-2 text-xs text-muted-foreground font-semibold whitespace-nowrap">High: {formatCurrency(high, selectedAsset.exchange)}</span>
                      </div>

                      {/* Current */}
                      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-20" style={{ left: getPos(current) }}>
                        <div className="absolute top-full mt-1 flex flex-col items-center">
                          <div className="h-5 w-px bg-primary/50 mb-1"></div>
                          <span className="text-sm font-bold text-primary whitespace-nowrap bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-sm">Current: {formatCurrency(current, selectedAsset.exchange)}</span>
                        </div>
                        <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)] ring-2 ring-background"></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              <div className="mt-8 pt-6 pb-2 border-t border-border/50 text-xs text-muted-foreground/70 leading-relaxed bg-card rounded-b-lg">
                <span className="font-semibold text-muted-foreground">Please Notice:</span> The <span className="font-semibold">Consensus Target</span> is a live, mathematically aggregated average of all analysts currently covering the stock. The <span className="font-semibold">Analyst Ratings</span> list above is a historical log of when analysts formally changed their stance. Since many analysts quietly reiterate targets without issuing formal upgrades, this historical list can be months or years out of date.
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-safe md:hidden">
        <div className="flex justify-around items-center h-[60px]">
          <NavLink to="/" className={({isActive}) => `flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </NavLink>
          <NavLink to="/screener" className={({isActive}) => `flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Screener</span>
          </NavLink>
          <NavLink to="/watchlist" className={({isActive}) => `flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${loading ? 'pointer-events-none opacity-50' : ''} ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Watchlist</span>
          </NavLink>
        </div>
      </div>
      
      </div>
    </div>
  );
}

export default App;
