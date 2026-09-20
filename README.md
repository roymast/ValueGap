# ValueGap - Analyst Delta Screener Dashboard

ValueGap is a responsive, dark-mode financial dashboard that visualizes divergence between asset current trading prices and analyst consensus targets.

## Features

- **Top Control Bar**:
  - **Dynamic Search**: Instantly filters assets by Ticker or Company Name.
  - **Threshold Value (X)**: Excludes assets with target divergences below X (customized per USD, Points, or Percentage).
  - **Unit Selector**: Switch thresholds and views dynamically between Dollars ($), Points (pts), and Percentage (%).
  - **Asset Toggle**: Easily switch the dataset scope between Stocks and Indexes.
- **Dual Data Tables**:
  - **Under-Valued Assets**: Shows stocks/indexes trading below consensus targets (highlighted in emerald green theme).
  - **Over-Valued Assets**: Shows stocks/indexes trading above consensus targets (highlighted in red theme).
- **Interactivity**:
  - **Dynamic Sorting**: Click table headers to sort assets by Ticker, Delta size, or Analyst Success Rate.
  - **Details Slide-over Drawer**: Click "Details" to open a glassmorphism side panel detailing the asset.
  - **Historical Trend Chart**: Renders a custom animated vector SVG path showing the historical 10-day price trend of the asset inside the drawer.
  - **Live Divergence Calculator**: An interactive sandbox in the details drawer allowing users to input simulated prices to dynamically compute target deltas.
  - **Light/Dark Toggle**: Fully functional theme toggler that respects system preference by default.

## Technology Stack

### Frontend
- **React 18**: Component-based UI rendering.
- **Vite**: Fast, modern frontend build tool.
- **Tailwind CSS v4**: Utility-first CSS framework for rapid styling.
- **shadcn/ui**: Accessible and customizable UI components (Lucide React icons).
- **Recharts**: For rendering historical target vs price line charts.

### Backend & Infrastructure
- **Python / FastAPI**: Backend REST API serving data to the client.
- **Firebase Functions (Python 2nd Gen)**: Serverless backend endpoints (including scheduled data scraping).
- **Firestore**: NoSQL database holding dynamically updated analyst targets and mapping definitions.
- **Firebase Hosting**: High-speed CDN for the static React application (`public/` directory).
- **TradingView & Yahoo Finance**: Data sources for live market quotes, historical trends, and analyst recommendations.
