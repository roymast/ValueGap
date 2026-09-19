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

- **HTML5**: Structured semantic layout.
- **Tailwind CSS v4 (CDN)**: Premium typography, utility layouts, and responsive grids.
- **Vanilla CSS (`styles.css`)**: Glassmorphism backdrop-filters, custom dynamic design tokens, theme overrides, scrollbar-color optimizations, and keyframe slide-over drawer animations.
- **Vanilla JavaScript**: Lightweight state management, reactive filters, svg path calculators, and interactive events.

## How to Run
python3 -m uvicorn main:app --host 0.0.0.0 --port 3000

Since ValueGap is a lightweight, zero-dependency client-side application, you can view it directly by:
1. Double-clicking the [index.html](index.html) file to open it in your browser.
2. Alternatively, running a simple HTTP dev server from the project directory:
   ```bash
   npx serve .
   ```
