import React, { useRef, useState, useEffect } from 'react';

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return "N/A";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

export const InteractiveChart = ({ asset, timeframe, showAxes = false }: any) => {
  const historyKey = timeframe as string;
  const history = (asset.history_dict && asset.history_dict[historyKey]) || asset.history || [];
  if (!history || history.length < 2) return null;

  const firstPrice = history[0];
  const lastPrice = history[history.length - 1];
  const isGreen = lastPrice >= firstPrice;
  const color = isGreen ? 'hsl(var(--success))' : 'hsl(var(--danger))';

  const allValues = [...history, asset.target ?? lastPrice];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const PAD_LEFT = showAxes ? 12 : 0;
  const PAD_BOTTOM = showAxes ? 12 : 0;
  const W = 100 - PAD_LEFT;
  const H = 100 - PAD_BOTTOM;

  const toX = (idx: number) => PAD_LEFT + (idx / (history.length - 1)) * W;
  const toY = (v: number) => (1 - (v - min) / range) * H;

  const pts = history.map((p: number, i: number) => `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ');
  const lx = toX(history.length - 1);
  const ly = toY(lastPrice);
  const tx = lx + (showAxes ? 8 : 15);
  const ty = toY(asset.target ?? lastPrice);

  const fillPts = [
    ...history.map((p: number, i: number) => `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`),
    `${toX(history.length-1).toFixed(1)},${H.toFixed(1)}`,
    `${toX(0).toFixed(1)},${H.toFixed(1)}`
  ].join(' ');

  const [gradId] = useState(`grad-${asset.ticker}-${timeframe}-${isGreen ? 'g' : 'r'}-${Math.random().toString(36).substring(2, 7)}`);

  const numValueTicks = 4;
  const valueTicks = Array.from({length: numValueTicks}, (_, i) => {
    const v = min + (range / (numValueTicks - 1)) * i;
    return {v, y: toY(v)};
  });

  const numTimeTicks = 5;
  const timeTicks = Array.from({length: numTimeTicks}, (_, i) => {
    const idx = Math.round((i / (numTimeTicks - 1)) * (history.length - 1));
    return { x: toX(idx), label: i === 0 ? 'Start' : i === numTimeTicks-1 ? 'Now' : '' };
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'none' | 'hover' | 'dragging' | 'locked'>('none');
  const [startIdx, setStartIdx] = useState(-1);
  const [currentIdx, setCurrentIdx] = useState(-1);

  // Global click handler to dismiss locked state
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
          <line x1={x1} y1="0" x2={x1} y2={H} stroke="hsl(var(--foreground))" strokeOpacity="0.5" strokeDasharray="2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
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
      
      const rectFill = isDrop ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)";
      const textFillClass = isDrop ? "text-danger" : "text-success";
      
      const deltaVal = val2 - val1;
      const deltaPct = (deltaVal / val1) * 100;
      const deltaStr = `${deltaVal >= 0 ? '+' : ''}${formatCurrency(deltaVal)} (${deltaVal >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%)`;
      
      iSvgElements = (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={x1} y="0" width={x2 - x1} height={H} fill={rectFill} />
          <line x1={x1} y1="0" x2={x1} y2={H} stroke="hsl(var(--foreground))" strokeOpacity="0.5" strokeDasharray="2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1={x2} y1="0" x2={x2} y2={H} stroke="hsl(var(--foreground))" strokeOpacity="0.5" strokeDasharray="2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
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

  const overallDelta = lastPrice - firstPrice;
  const overallDeltaPct = (overallDelta / firstPrice) * 100;
  const overallDeltaStr = `${overallDelta >= 0 ? '+' : ''}${formatCurrency(overallDelta)} (${overallDelta >= 0 ? '+' : ''}${overallDeltaPct.toFixed(2)}%)`;

  return (
    <div className="w-full h-full relative" style={{ touchAction: 'none' }} ref={containerRef}>
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

        <polygon points={fillPts} fill={`url(#${gradId})`} />

        {showAxes && valueTicks.map(({y}, i) => (
          <g key={i}>
            <line x1={PAD_LEFT} y1={y} x2={PAD_LEFT - 2} y2={y} stroke="currentColor" strokeWidth="0.5" opacity="0.4" className="text-muted-foreground" />
          </g>
        ))}

        {showAxes && timeTicks.map(({x}, i) => (
          <g key={i}>
            <line x1={x} y1={H} x2={x} y2={H + 2} stroke="currentColor" strokeWidth="0.5" opacity="0.4" className="text-muted-foreground" />
          </g>
        ))}

        {showAxes && (
          <>
            <line x1={PAD_LEFT} y1={0} x2={PAD_LEFT} y2={H} stroke="currentColor" strokeWidth="0.5" opacity="0.2" className="text-border" />
            <line x1={PAD_LEFT} y1={H} x2={100} y2={H} stroke="currentColor" strokeWidth="0.5" opacity="0.2" className="text-border" />
          </>
        )}

        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

        <polyline points={`${lx.toFixed(1)},${ly.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" vectorEffect="non-scaling-stroke" />

        {iSvgElements}
      </svg>

      <div className="absolute w-[6px] h-[6px] rounded-full bg-[hsl(var(--background))] border-[1.5px] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${tx}%`, top: `${ty}%`, borderColor: color }} />

      {iHtmlElements}
      
      <div className="absolute top-0 left-0 pl-1 pt-1 opacity-80 pointer-events-none">
        <span className={`text-[10px] font-bold ${overallDelta >= 0 ? 'text-success' : 'text-danger'}`} style={{ color: color }}>
          {overallDeltaStr}
        </span>
      </div>

      {showAxes && valueTicks.map(({v, y}, i) => (
        <div key={`val-${i}`} className="absolute text-[10px] text-muted-foreground opacity-80 text-right -translate-y-1/2 pr-1 pointer-events-none" style={{ right: `${100 - PAD_LEFT}%`, top: `${y}%`, width: '40px' }}>
          {v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}
        </div>
      ))}

      {showAxes && timeTicks.map(({x, label}, i) => label && (
        <div key={`time-${i}`} className="absolute text-[10px] text-muted-foreground opacity-80 text-center -translate-x-1/2 mt-1 pointer-events-none" style={{ left: `${x}%`, top: `${H}%` }}>
          {label}
        </div>
      ))}
    </div>
  );
};
