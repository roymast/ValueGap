import { useState } from 'react';
import { Sparkline } from './Sparkline';
import { StockIcon } from './StockIcon';

export const TopMovers = ({ gainers = [], losers = [], onSelectAsset }: { gainers: any[], losers: any[], onSelectAsset: (a: any) => void }) => {
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');
  
  if (gainers.length === 0 && losers.length === 0) return null;

  const formatCurrency = (value: number | null | undefined, exchange?: string) => {
    if (value == null) return "N/A";
    let currency = "USD";
    if (exchange === "TASE") currency = "ILS";
    else if (exchange && ['LSE', 'LSE_BULL'].includes(exchange)) currency = "GBP";
    else if (exchange && ['XETR', 'FWB'].includes(exchange)) currency = "EUR";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  // Map the pre-calculated arrays
  const mapAssets = (list: any[]) => list.map(a => {
    const history = (a.history_dict && a.history_dict['1d']) || a.history || a.history_list || [];
    const firstPrice = history.length > 1 ? history[history.length - 2] : (history[0] || a.price); // match backend daily change logic
    const lastPrice = history.length > 0 ? history[history.length - 1] : a.price;
    const pct = firstPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
    return { ...a, pct, lastPrice, history };
  });

  const mappedGainers = mapAssets(gainers);
  const mappedLosers = mapAssets(losers);
  
  const displayList = tab === 'gainers' ? mappedGainers : mappedLosers;

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col h-full shadow-sm">
      <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
        <h2 className="text-lg font-bold text-foreground">Top Movers</h2>
        <div className="flex space-x-4 text-sm font-bold">
          <button onClick={() => setTab('gainers')} className={`pb-1 border-b-2 ${tab === 'gainers' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>Gainers</button>
          <button onClick={() => setTab('losers')} className={`pb-1 border-b-2 ${tab === 'losers' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>Losers</button>
        </div>
      </div>
      
      <div className="flex flex-col space-y-1">
        <div className="flex text-[10px] uppercase font-bold text-muted-foreground px-2 mb-1 tracking-wider">
          <div className="w-1/2">Symbol</div>
          <div className="w-1/4 text-right">Price</div>
          <div className="w-1/4 text-right">% Change</div>
        </div>
        {displayList.map(asset => {
          const isGreen = asset.pct >= 0;
          return (
            <div key={asset.ticker} onClick={() => onSelectAsset(asset)} className="flex items-center px-2 py-2.5 hover:bg-secondary/50 rounded-md cursor-pointer transition-colors border border-transparent hover:border-border">
              <div className="w-1/2 flex items-center gap-3">
                <StockIcon ticker={asset.ticker} name={asset.company_name} className="w-8 h-8" />
                <div className="flex flex-col">
                  <span className="font-bold text-foreground text-sm leading-tight">{asset.ticker} <span className="text-[10px] text-muted-foreground font-normal ml-1">({asset.exchange || 'Unknown'})</span></span>
                  <span className="text-[10px] text-muted-foreground truncate w-24 leading-tight">{asset.company_name}</span>
                </div>
              </div>
              <div className="w-1/4 text-right font-mono text-sm text-foreground">{formatCurrency(asset.lastPrice, asset.exchange)}</div>
              <div className={`w-1/4 text-right font-mono font-bold text-sm flex justify-end items-center gap-2 ${isGreen ? 'text-success' : 'text-danger'}`}>
                <div className="hidden sm:block">
                  <Sparkline data={asset.history} width={30} height={14} />
                </div>
                <span>{isGreen ? '+' : ''}{asset.pct.toFixed(2)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
