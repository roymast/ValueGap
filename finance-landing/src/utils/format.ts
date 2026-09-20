export const getCurrencyCode = (exchange?: string) => {
  if (exchange === "TASE") return "ILS";
  if (exchange && ['LSE', 'LSE_BULL'].includes(exchange)) return "GBP";
  if (exchange && ['XETR', 'FWB'].includes(exchange)) return "EUR";
  return "USD";
};

export const formatCurrency = (value: number | null | undefined, exchange?: string) => {
  if (value == null) return "N/A";
  const currency = getCurrencyCode(exchange);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
};

export const formatDelta = (value: number | null | undefined, isPercent: boolean | 'pct' | 'usd' | 'pts' = false) => {
  if (value == null) return "N/A";
  const sign = value > 0 ? '+' : '';
  
  const type = isPercent === true ? 'pct' : isPercent === false ? 'usd' : isPercent;
  
  let num = '';
  if (type === 'pct') num = `${value.toFixed(1)}%`;
  else if (type === 'pts') num = value.toFixed(2);
  else num = formatCurrency(value);
  
  return `${sign}${num}`;
};

export const formatDeltaWithExchange = (value: number | null | undefined, isPercent: boolean | 'pct' | 'usd' | 'pts' = false, exchange?: string) => {
  if (value == null) return "N/A";
  const sign = value > 0 ? '+' : '';
  
  const type = isPercent === true ? 'pct' : isPercent === false ? 'usd' : isPercent;
  
  let num = '';
  if (type === 'pct') num = `${value.toFixed(1)}%`;
  else if (type === 'pts') num = value.toFixed(2);
  else num = formatCurrency(value, exchange);
  
  return `${sign}${num}`;
};
