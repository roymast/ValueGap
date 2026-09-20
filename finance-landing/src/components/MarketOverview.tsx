
import { Sparkline } from './Sparkline';
import { StockIcon } from './StockIcon';

export const MarketOverview = ({ assets, onSelectAsset }: { assets: any[], onSelectAsset: (asset: any) => void }) => {
  if (!assets || assets.length === 0) return null;

  const formatCurrency = (value: number | null | undefined, exchange?: string) => {
    if (value == null) return "N/A";
    let currency = "USD";
    if (exchange === "TASE") currency = "ILS";
    else if (exchange && ['LSE', 'LSE_BULL'].includes(exchange)) currency = "GBP";
    else if (exchange && ['XETR', 'FWB'].includes(exchange)) currency = "EUR";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };
  
  // Pick some major ones for the overview
  const majorTickers = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY', 'BTC-USD'];
  const overviewAssets = assets.filter(a => majorTickers.includes(a.ticker)).slice(0, 4);
  
  if (overviewAssets.length === 0) {
    // fallback to first 4
    overviewAssets.push(...assets.slice(0, 4));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {overviewAssets.map(asset => {
        const history = (asset.history_dict && asset.history_dict['1d']) || asset.history || [];
        const firstPrice = history.length > 0 ? history[0] : asset.price;
        const lastPrice = history.length > 0 ? history[history.length - 1] : asset.price;
        const delta = lastPrice - firstPrice;
        const deltaPct = firstPrice ? (delta / firstPrice) * 100 : 0;
        const isGreen = delta >= 0;

        return (
          <div key={asset.ticker} onClick={() => onSelectAsset(asset)} className="bg-card border border-border rounded-lg p-4 flex flex-col hover:border-primary/50 cursor-pointer transition-colors">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <StockIcon ticker={asset.ticker} name={asset.company_name} className="w-8 h-8" />
                <div>
                  <h3 className="font-bold text-foreground text-sm">{asset.ticker} <span className="text-[10px] text-muted-foreground font-normal ml-1">({asset.exchange || 'Unknown'})</span></h3>
                  <p className="text-muted-foreground text-[10px] truncate max-w-[80px]">{asset.company_name}</p>
                </div>
              </div>
              <Sparkline data={history} width={60} height={24} />
            </div>
            
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-lg font-mono font-bold text-foreground">{formatCurrency(lastPrice, asset.exchange)}</span>
              <span className={`text-xs font-mono font-bold ${isGreen ? 'text-success' : 'text-danger'}`}>
                {isGreen ? '+' : ''}{formatCurrency(delta, asset.exchange)} ({isGreen ? '+' : ''}{deltaPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
