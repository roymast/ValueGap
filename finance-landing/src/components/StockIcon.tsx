import React from 'react';

// Using clearbit logo API as a reliable fallback for stock logos
// Fallbacks to standard letters if it fails
export const StockIcon: React.FC<{ ticker: string, name: string, className?: string }> = ({ ticker, name, className = "" }) => {
  const [sourceIdx, setSourceIdx] = React.useState(0);
  
  // Extract domain from name as best effort, or just use ticker
  const safeName = name || ticker || '';
  const domain = safeName.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '') + '.com';
  
  const cleanTicker = ticker.split('-')[0];

  const sources = [
    `https://assets.parqet.com/logos/symbol/${cleanTicker}?format=png`,
    `https://financialmodelingprep.com/image-stock/${cleanTicker}.png`,
    `https://logo.clearbit.com/${domain}`
  ];

  if (sourceIdx >= sources.length) {
    return (
      <div className={`flex items-center justify-center bg-secondary text-secondary-foreground font-bold rounded-full ${className}`} style={{ width: '24px', height: '24px', fontSize: '10px' }}>
        {ticker.substring(0, 2)}
      </div>
    );
  }

  return (
    <img 
      src={sources[sourceIdx]} 
      alt={ticker}
      className={`rounded-full object-contain bg-white p-[3px] ${className}`}
      style={{ width: '24px', height: '24px' }}
      onError={() => setSourceIdx(s => s + 1)}
    />
  );
};
