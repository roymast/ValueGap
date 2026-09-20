export interface Analyst {
  firm: string;
  rating: string;
  target: number;
  date?: string;
  days_ago?: number;
  horizon?: string;
}

export interface Asset {
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
}
