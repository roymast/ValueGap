import React, { useRef, useState, useEffect, useMemo } from 'react';
import { BarChart2, TrendingUp, Activity } from 'lucide-react';

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return "N/A";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

function useChartSettings() {
  const [chartType, setChartType] = useState<'line' | 'candle'>(() => {
    return (localStorage.getItem('vg_chartType') as 'line' | 'candle') || 'candle';
  });
  const [showSMA, setShowSMA] = useState(() => localStorage.getItem('vg_showSMA') === 'true');
  const [showEMA, setShowEMA] = useState(() => localStorage.getItem('vg_showEMA') === 'true');
  const [showBB, setShowBB] = useState(() => localStorage.getItem('vg_showBB') === 'true');

  useEffect(() => localStorage.setItem('vg_chartType', chartType), [chartType]);
  useEffect(() => localStorage.setItem('vg_showSMA', String(showSMA)), [showSMA]);
  useEffect(() => localStorage.setItem('vg_showEMA', String(showEMA)), [showEMA]);
  useEffect(() => localStorage.setItem('vg_showBB', String(showBB)), [showBB]);

  return { chartType, setChartType, showSMA, setShowSMA, showEMA, setShowEMA, showBB, setShowBB };
}

export const InteractiveChart = ({ asset, timeframe, showAxes = false, hideTitle = false }: any) => {
  const historyKey = timeframe as string;
  const history = (asset.history_dict && asset.history_dict[historyKey]) || asset.history || [];
  
  const { chartType, setChartType, showSMA, setShowSMA, showEMA, setShowEMA, showBB, setShowBB } = useChartSettings();
  const [showMenu, setShowMenu] = useState(false);

  const firstPrice = history[0];
  const lastPrice = history[history.length - 1];
  const isGreen = lastPrice >= firstPrice;
  const color = isGreen ? 'hsl(var(--success))' : 'hsl(var(--danger))';

  // Synthetic OHLC generation deterministically based on prices
  const ohlc = useMemo(() => {
    return history.map((close: number, i: number) => {
      const open = i === 0 ? close * 0.995 : history[i-1];
      const volatility = close * 0.005;
      const noise = (Math.sin(i * 123.456) * 0.5 + 0.5) * volatility;
      
      const high = Math.max(open, close) + noise;
      const low = Math.min(open, close) - noise;
      return { open, high, low, close };
    });
  }, [history]);

  // Indicators calculation
  const sma20 = useMemo(() => {
    const period = 20;
    return history.map((_: any, i: number) => {
      if (i < period - 1) return null;
      let sum = 0;
      for(let j=0; j<period; j++) sum += history[i-j];
      return sum / period;
    });
  }, [history]);

  const ema20 = useMemo(() => {
    const period = 20;
    const k = 2 / (period + 1);
    let ema = history[0];
    return history.map((val: number, i: number) => {
      if (i === 0) return ema;
      ema = (val * k) + (ema * (1 - k));
      return ema;
    });
  }, [history]);

  const bollinger = useMemo(() => {
    const period = 20;
    const multiplier = 2;
    return history.map((_: any, i: number) => {
      if (i < period - 1 || sma20[i] === null) return null;
      const mean = sma20[i]!;
      let sumSq = 0;
      for(let j=0; j<period; j++) {
        sumSq += Math.pow(history[i-j] - mean, 2);
      }
      const stdev = Math.sqrt(sumSq / period);
      return { upper: mean + stdev * multiplier, lower: mean - stdev * multiplier };
    });
  }, [history, sma20]);

  // Calculate scales based only on price history and indicators, not target
  let allValues = [...history];
  if (showSMA) allValues = [...allValues, ...sma20.filter((v: number | null) => v !== null)];
  if (showEMA) allValues = [...allValues, ...ema20];
  if (showBB) {
    allValues = [
      ...allValues, 
      ...bollinger.filter((b: any) => b !== null).map((b: any) => b.upper),
      ...bollinger.filter((b: any) => b !== null).map((b: any) => b.lower)
    ];
  }
  if (chartType === 'candle') {
    allValues = [...allValues, ...ohlc.map((c: any) => c.high), ...ohlc.map((c: any) => c.low)];
  }
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const PAD_LEFT = showAxes ? 12 : 2;
  const PAD_RIGHT = showAxes ? 12 : 18;
  const PAD_TOP = showAxes ? 15 : 5;
  const PAD_BOTTOM = showAxes ? 15 : 5;
  const W = 100 - PAD_LEFT - PAD_RIGHT;
  const H = 100 - PAD_TOP - PAD_BOTTOM;

  const toX = (idx: number) => PAD_LEFT + (idx / (history.length - 1)) * W;
  const toY = (v: number) => PAD_TOP + (1 - (v - min) / range) * H;
  
  // Interaction State
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'none' | 'hover' | 'dragging' | 'locked'>('none');
  const [startIdx, setStartIdx] = useState(-1);
  const [currentIdx, setCurrentIdx] = useState(-1);

  // ... (keeping identical interaction logic from previous version)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      if (mode === 'locked' && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMode('none');
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
    };
  }, [mode]);

  const getNearestIndex = (clientX: number) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * 100;
    let closestIndex = 0;
    let minDiff = Infinity;
    for (let i = 0; i < history.length; i++) {
      const px = toX(i);
      const diff = Math.abs(px - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    return closestIndex;
  };

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (mode === 'none') {
      const idx = getNearestIndex(e.clientX);
      setStartIdx(idx);
      setCurrentIdx(idx);
      setMode('hover');
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (mode === 'locked') {
      setMode('none');
      return;
    }
    (e.target as any).setPointerCapture(e.pointerId);
    const idx = getNearestIndex(e.clientX);
    setStartIdx(idx);
    setCurrentIdx(idx);
    setMode('dragging');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const idx = getNearestIndex(e.clientX);
    if (mode === 'none' || mode === 'hover') {
      setStartIdx(idx);
      setCurrentIdx(idx);
      setMode('hover');
    } else if (mode === 'dragging') {
      setCurrentIdx(idx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (mode === 'dragging') {
      (e.target as any).releasePointerCapture(e.pointerId);
      setMode('locked');
    }
  };

  const handlePointerLeave = () => {
    if (mode === 'hover') {
      setMode('none');
    }
  };

  // Build Indicator paths
  const pts = history.map((p: number, i: number) => `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ');
  const lx = toX(history.length - 1);
  const ly = toY(lastPrice);
  const tx = lx + (showAxes ? 8 : 15);
  const ty = Math.max(PAD_TOP, Math.min(100 - PAD_BOTTOM, toY(asset.target ?? lastPrice)));

  const smaPts = sma20.map((v: number | null, i: number) => v !== null ? `${toX(i).toFixed(1)},${toY(v).toFixed(1)}` : '').filter(Boolean).join(' ');
  const emaPts = ema20.map((v: number, i: number) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const bbUpperPts = bollinger.map((b: any, i: number) => b !== null ? `${toX(i).toFixed(1)},${toY(b.upper).toFixed(1)}` : '').filter(Boolean).join(' ');
  const bbLowerPts = bollinger.map((b: any, i: number) => b !== null ? `${toX(i).toFixed(1)},${toY(b.lower).toFixed(1)}` : '').filter(Boolean).join(' ');

  const gradId = `grad-${asset.ticker}-${timeframe}-${isGreen ? 'g' : 'r'}`;

  // Interaction rendering logic...
  let iSvgElements = null;
  let iHtmlElements = null;
  
  if (mode !== 'none' && startIdx !== -1) {
    const actualStartIdx = Math.min(startIdx, currentIdx);
    const actualEndIdx = Math.max(startIdx, currentIdx);

    const x1 = toX(actualStartIdx);
    const y1 = toY(history[actualStartIdx]);
    
    if (startIdx === currentIdx) {
      iSvgElements = (
        <g style={{ pointerEvents: 'none' }}>
          <line x1={x1} y1="0" x2={x1} y2="100" stroke="hsl(var(--foreground))" strokeOpacity="0.5" strokeDasharray="2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </g>
      );
      iHtmlElements = (
        <>
          <div className="absolute w-[6px] h-[6px] rounded-full border-[1.5px] bg-background transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${x1}%`, top: `${y1}%`, borderColor: color }} />
          <div className={`absolute text-[10px] font-mono font-bold text-foreground bg-background/80 px-1 rounded pointer-events-none -translate-y-1/2 ${x1 > 50 ? '-translate-x-full ml-[-8px]' : 'ml-[8px]'}`} style={{ left: `${x1}%`, top: `${Math.max(5, y1)}%` }}>
            {formatCurrency(history[actualStartIdx])}
          </div>
        </>
      );
    } else {
      const x2 = toX(actualEndIdx);
      const y2 = toY(history[actualEndIdx]);
      
      const val1 = history[actualStartIdx];
      const val2 = history[actualEndIdx];
      const isDrop = val1 > val2;
      
      const rectFill = isDrop ? "rgba(239, 68, 68, 0.2)" : "rgba(8, 153, 129, 0.2)"; // Adjusted to TradingView green
      const textFillClass = isDrop ? "text-danger" : "text-success";
      
      const deltaVal = val2 - val1;
      const deltaPct = (deltaVal / val1) * 100;
      const deltaStr = `${deltaVal >= 0 ? '+' : ''}${formatCurrency(deltaVal)} (${deltaVal >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%)`;
      
      iSvgElements = (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={x1} y="0" width={x2 - x1} height="100" fill={rectFill} />
          <line x1={x1} y1="0" x2={x1} y2="100" stroke="hsl(var(--foreground))" strokeOpacity="0.5" strokeDasharray="2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1={x2} y1="0" x2={x2} y2="100" stroke="hsl(var(--foreground))" strokeOpacity="0.5" strokeDasharray="2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--foreground))" strokeOpacity="0.8" strokeWidth="1.5" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
        </g>
      );
      
      iHtmlElements = (
        <>
          <div className="absolute w-[6px] h-[6px] rounded-full border-[1.5px] bg-background transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${x1}%`, top: `${y1}%`, borderColor: color }} />
          <div className={`absolute text-[10px] font-mono font-bold text-foreground bg-background/80 px-1 rounded pointer-events-none -translate-y-1/2 ${x1 > 50 ? '-translate-x-full ml-[-8px]' : 'ml-[8px]'}`} style={{ left: `${x1}%`, top: `${Math.max(5, y1)}%` }}>
            {formatCurrency(val1)}
          </div>
          
          <div className="absolute w-[6px] h-[6px] rounded-full border-[1.5px] bg-background transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${x2}%`, top: `${y2}%`, borderColor: color }} />
          <div className={`absolute text-[10px] font-mono font-bold text-foreground bg-background/80 px-1 rounded pointer-events-none -translate-y-1/2 ${x2 > 50 ? '-translate-x-full ml-[-8px]' : 'ml-[8px]'}`} style={{ left: `${x2}%`, top: `${Math.max(5, y2)}%` }}>
            {formatCurrency(val2)}
          </div>
          
          <div className={`absolute font-mono font-bold text-[11px] px-2 py-0.5 rounded-full border border-border bg-background transform -translate-x-1/2 -translate-y-1/2 pointer-events-none ${textFillClass}`} style={{ left: `${x1 + (x2 - x1)/2}%`, top: `${H/2}%` }}>
            {deltaStr}
          </div>
        </>
      );
    }
  }

  // Ticks
  const numValueTicks = 4;
  const valueTicks = Array.from({length: numValueTicks}, (_, i) => {
    const v = min + (range / (numValueTicks - 1)) * i;
    return {v, y: toY(v)};
  });
  const numTimeTicks = 5;
  const timeTicks = Array.from({length: numTimeTicks}, (_, i) => {
    const idx = Math.round((i / (numTimeTicks - 1)) * (history.length - 1));
    let label = '';
    const now = new Date();
    if (timeframe === '1d') {
      const d = new Date(now.getTime() - (history.length - 1 - idx) * 30 * 60000);
      label = `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    } else if (timeframe === '1mo') {
      const d = new Date(now.getTime() - (history.length - 1 - idx) * 24 * 60 * 60000);
      label = `${d.getMonth()+1}/${d.getDate()}`;
    } else if (timeframe === '1y') {
      const d = new Date(now.getTime() - (history.length - 1 - idx) * 7 * 24 * 60 * 60000);
      label = `${d.getMonth()+1}/${d.getDate()}`;
    } else {
      label = i === 0 ? 'Start' : i === numTimeTicks-1 ? 'Now' : '';
    }
    return { x: toX(idx), label };
  });

  const overallDelta = lastPrice - firstPrice;
  const overallDeltaPct = (overallDelta / firstPrice) * 100;
  const overallDeltaStr = `${overallDelta >= 0 ? '+' : ''}${formatCurrency(overallDelta)} (${overallDelta >= 0 ? '+' : ''}${overallDeltaPct.toFixed(2)}%)`;

  const candleW = (W / (history.length || 1)) * 0.6; // 60% of available space

  if (!history || history.length < 2) return <div className="w-full h-full" />;

  return (
    <div className="w-full h-full relative group" style={{ touchAction: 'none' }} ref={containerRef}>
      
      {/* TradingView style settings overlay */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 opacity-100 transition-opacity">
        <div className="flex bg-card/80 border border-border backdrop-blur-md rounded-md p-0.5 shadow-sm">
          <button onClick={() => setChartType('line')} className={`p-1.5 rounded-sm ${chartType === 'line' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`} title="Line Chart">
            <TrendingUp size={14} />
          </button>
          <button onClick={() => setChartType('candle')} className={`p-1.5 rounded-sm ${chartType === 'candle' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'}`} title="Candlesticks">
            <BarChart2 size={14} />
          </button>
        </div>
        
        <div className="flex bg-card/80 border border-border backdrop-blur-md rounded-md p-0.5 shadow-sm ml-2">
          <button onClick={() => setShowMenu(!showMenu)} className={`p-1.5 rounded-sm flex items-center gap-1 ${showMenu || showSMA || showEMA || showBB ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} title="Indicators">
            <Activity size={14} /> <span className="text-[10px] font-bold">fx</span>
          </button>
        </div>
        
        {showMenu && (
          <div className="absolute top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-xl w-48 p-2 flex flex-col gap-2 z-20">
            <label className="flex items-center space-x-2 text-xs text-foreground cursor-pointer p-1 hover:bg-secondary rounded">
              <input type="checkbox" checked={showSMA} onChange={(e) => setShowSMA(e.target.checked)} className="accent-primary" />
              <span>SMA (20)</span>
            </label>
            <label className="flex items-center space-x-2 text-xs text-foreground cursor-pointer p-1 hover:bg-secondary rounded">
              <input type="checkbox" checked={showEMA} onChange={(e) => setShowEMA(e.target.checked)} className="accent-primary" />
              <span>EMA (20)</span>
            </label>
            <label className="flex items-center space-x-2 text-xs text-foreground cursor-pointer p-1 hover:bg-secondary rounded">
              <input type="checkbox" checked={showBB} onChange={(e) => setShowBB(e.target.checked)} className="accent-primary" />
              <span>Bollinger Bands (20, 2)</span>
            </label>
          </div>
        )}
      </div>

      <svg 
        ref={svgRef}
        className="w-full h-full overflow-visible absolute inset-0 cursor-crosshair" 
        preserveAspectRatio="none" 
        viewBox="0 0 100 100"
        onPointerEnter={handlePointerEnter}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {showAxes && valueTicks.map(({y}, i) => (
          <g key={i}>
            <line x1={PAD_LEFT} y1={y} x2={PAD_LEFT - 2} y2={y} stroke="currentColor" strokeWidth="0.5" opacity="0.4" className="text-muted-foreground" vectorEffect="non-scaling-stroke" />
            <line x1={PAD_LEFT} y1={y} x2={100} y2={y} stroke="currentColor" strokeWidth="0.5" opacity="0.1" className="text-border" vectorEffect="non-scaling-stroke" />
          </g>
        ))}

        {showAxes && timeTicks.map(({x}, i) => (
          <g key={i}>
            <line x1={x} y1={100 - PAD_BOTTOM} x2={x} y2={100 - PAD_BOTTOM + 2} stroke="currentColor" strokeWidth="0.5" opacity="0.4" className="text-muted-foreground" vectorEffect="non-scaling-stroke" />
            <line x1={x} y1={PAD_TOP} x2={x} y2={100 - PAD_BOTTOM} stroke="currentColor" strokeWidth="0.5" opacity="0.1" className="text-border" vectorEffect="non-scaling-stroke" />
          </g>
        ))}

        {/* Indicators Overlay */}
        {showBB && (
          <g opacity={0.6}>
            <polygon points={`${bbUpperPts} ${bbLowerPts.split(' ').reverse().join(' ')}`} fill="hsl(var(--primary))" opacity="0.1" />
            <polyline points={bbUpperPts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.5" />
            <polyline points={bbLowerPts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.5" />
          </g>
        )}
        
        {showSMA && <polyline points={smaPts} fill="none" stroke="#f59e0b" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
        {showEMA && <polyline points={emaPts} fill="none" stroke="#8b5cf6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}

        {/* Chart Rendering */}
        {chartType === 'line' ? (
          <>
            <polygon points={`${pts} ${toX(history.length-1).toFixed(1)},${100 - PAD_BOTTOM} ${toX(0).toFixed(1)},${100 - PAD_BOTTOM}`} fill={`url(#${gradId})`} />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        ) : (
          <g>
            {ohlc.map((c: any, i: number) => {
              const x = toX(i);
              const cyOpen = toY(c.open);
              const cyClose = toY(c.close);
              const cyHigh = toY(c.high);
              const cyLow = toY(c.low);
              
              const isCandleGreen = c.close >= c.open;
              const cColor = isCandleGreen ? 'hsl(var(--success))' : 'hsl(var(--danger))';
              
              return (
                <g key={i}>
                  {/* Wick */}
                  <line x1={x} y1={cyHigh} x2={x} y2={cyLow} stroke={cColor} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  {/* Body */}
                  <rect 
                    x={x - candleW/2} 
                    y={Math.min(cyOpen, cyClose)} 
                    width={candleW} 
                    height={Math.max(0.5, Math.abs(cyOpen - cyClose))} 
                    fill={cColor} 
                    stroke={cColor}
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>
        )}

        <polyline points={`${lx.toFixed(1)},${ly.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" vectorEffect="non-scaling-stroke" />

        {iSvgElements}
      </svg>

      <div className="absolute w-[6px] h-[6px] rounded-full bg-[hsl(var(--background))] border-[1.5px] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${tx}%`, top: `${ty}%`, borderColor: color }} />

      {iHtmlElements}
      
      {/* Title/Delta Overlay */}
      {!hideTitle && (
        <div className="absolute top-12 left-2 opacity-80 pointer-events-none flex flex-col">
          <span className="text-[12px] font-bold text-foreground opacity-75">{asset.ticker} {historyKey}</span>
          <span className={`text-[12px] font-bold ${overallDelta >= 0 ? 'text-success' : 'text-danger'}`} style={{ color: color }}>
            {overallDeltaStr}
          </span>
        </div>
      )}

      {showAxes && valueTicks.map(({v, y}, i) => (
        <div key={`val-${i}`} className="absolute text-[10px] text-muted-foreground opacity-80 text-right -translate-y-1/2 pr-1 pointer-events-none font-mono" style={{ right: `${100 - PAD_LEFT}%`, top: `${y}%`, width: '40px' }}>
          {v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}
        </div>
      ))}

      {showAxes && timeTicks.map(({x, label}, i) => label && (
        <div key={`time-${i}`} className="absolute text-[10px] text-muted-foreground opacity-80 text-center -translate-x-1/2 mt-1 pointer-events-none" style={{ left: `${x}%`, top: `${100 - PAD_BOTTOM}%` }}>
          {label}
        </div>
      ))}
    </div>
  );
};
