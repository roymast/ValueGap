import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/stocks', () => {
    return HttpResponse.json({
      undervalued: [
        { ticker: 'AAPL', name: 'Apple Inc.', price: 150, target: 180, percentage: 20, delta: 30, type: 'stock', exchange: 'NASDAQ' }
      ],
      overvalued: [
        { ticker: 'TSLA', name: 'Tesla Inc.', price: 250, target: 200, percentage: -20, delta: -50, type: 'stock', exchange: 'NASDAQ' }
      ]
    });
  }),
];
