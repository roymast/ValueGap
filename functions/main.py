from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import sqlite3
import yfinance as yf
import time
import asyncio
import json
import os
from typing import Dict, List, Any

app = FastAPI(
    title="ValueGap - Backend Engine",
    description="A FastAPI backend that fetches live market data using yfinance, applies simulated analyst success rates and target offsets from a local SQLite database, and screens undervalued/overvalued assets."
)

DB_PATH = "database.db"
CACHE_EXPIRY_SECONDS = 300  # 5 minutes caching to keep API extremely fast and avoid rate limits
cache_data: Dict[str, Any] = {}
cache_timestamp: float = 0.0

def get_analyst_mappings() -> List[Dict[str, Any]]:
    """Fetch analyst mapping profiles from SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT ticker, yf_symbol, company_name, analyst_name, firm_name, 
               success_rate, source, target_offset_pct, consensus, summary, asset_type, target_horizon,
               tv_target, yf_target, fv_target
        FROM analyst_mappings
    """)
    rows = cursor.fetchall()
    conn.close()
    
    mappings = []
    for r in rows:
        mappings.append({
            "ticker": r["ticker"],
            "yf_symbol": r["yf_symbol"],
            "company_name": r["company_name"],
            "analyst": r["analyst_name"],
            "firm": r["firm_name"],
            "successRate": r["success_rate"],
            "source": r["source"],
            "offset_pct": r["target_offset_pct"],
            "consensus": r["consensus"],
            "summary": r["summary"],
            "asset_type": r["asset_type"],
            "target_horizon": r["target_horizon"],
            "tv_target": r["tv_target"],
            "yf_target": r["yf_target"],
            "fv_target": r["fv_target"]
        })
    return mappings

def refresh_market_data(mappings: List[Dict[str, Any]]):
    """Fetch live prices and targets in bulk using TradingView scanner for <500ms speed."""
    global cache_data, cache_timestamp
    print("Refreshing market data cache from TradingView...")
    
    new_cache = {}
    tickers_to_fetch = [m["ticker"] for m in mappings]
    
    live_quotes = {}
    try:
        import requests
        url = "https://scanner.tradingview.com/america/scan"
        payload = {
            "filter": [
                {"left": "name", "operation": "in_range", "right": tickers_to_fetch}
            ],
            "columns": ["name", "close", "price_target", "Recommend.All"]
        }
        res = requests.post(url, json=payload, timeout=5)
        if res.status_code == 200:
            data = res.json().get("data", [])
            for item in data:
                cols = item.get("d", [])
                if len(cols) >= 4:
                    sym = cols[0]
                    price = cols[1]
                    target = cols[2]
                    rec = cols[3]
                    
                    # Convert recommendation to consensus string
                    tv_consensus = "Hold"
                    if rec is not None:
                        if rec > 0.5: tv_consensus = "Strong Buy"
                        elif rec > 0.1: tv_consensus = "Buy"
                        elif rec < -0.5: tv_consensus = "Strong Sell"
                        elif rec < -0.1: tv_consensus = "Sell"
                        
                    live_quotes[sym] = {
                        "price": price or 0.0,
                        "target": target,
                        "consensus": tv_consensus
                    }
    except Exception as e:
        print(f"Error fetching bulk TradingView quotes: {e}")

    # 3. Generate synthetic history from current price (instant, no API calls)
    for m in mappings:
        ticker = m["ticker"]
        
        price = 0.0
        target = None
        consensus = m["consensus"]
        
        # 1. Fetch live metadata from TradingView
        q = live_quotes.get(ticker)
        if q:
            price = q["price"]
            target = q["target"]
            consensus = q["consensus"]
            
        # 1.5 Fallback for target: use offset_pct if TradingView didn't return one
        # (No per-ticker yfinance calls here to keep refresh fast)
        # 2. Fallback logic: If price is 0.0, reuse old cache if it exists
        if price == 0.0 and ticker in cache_data:
            price = cache_data[ticker]["price"]
            target = cache_data[ticker]["target"]
            
        # 4. Fallback logic for Targets
        if target is None or target == 0.0:
            target = price * (1 + m["offset_pct"] / 100)

        # 5. Generate synthetic history from price (no API calls - instant)
        base = price if price > 0 else 100.0
        tgt = float(target) if target else base
        # Realistic-ish historical simulation: 52 weekly points ending at current price, predicting to target
        import math
        hist_1y = [round(base * (1 + (i - 51) * 0.003 + math.sin(i * 0.5) * 0.01), 2) for i in range(52)]
        hist_1y[-1] = round(base, 2)
        hist_5y = [round(base * (1 + (i - 259) * 0.001 + math.sin(i * 0.3) * 0.015), 2) for i in range(260)]
        hist_5y[-1] = round(base, 2)
        hist_1mo = hist_1y[-22:]
        hist_1d = [round(base * (1 + (i - 9) * 0.001 + math.sin(i) * 0.002), 2) for i in range(20)]
        hist_1d[-1] = round(base, 2)
            
        new_cache[ticker] = {
            "price": round(float(price), 2),
            "target": round(float(target), 2),
            "consensus": consensus,
            "history": hist_1y, # legacy
            "history_dict": {"1d": hist_1d, "1mo": hist_1mo, "1y": hist_1y, "5y": hist_5y}
        }
    
    cache_data = new_cache
    cache_timestamp = time.time()
    print("Market data cache refreshed successfully from TradingView.")


def get_cached_data() -> tuple:
    """Helper to retrieve cached data, or trigger a refresh if cache is expired."""
    global cache_data, cache_timestamp
    mappings = get_analyst_mappings()
    
    # Refresh cache if empty or expired
    if not cache_data or (time.time() - cache_timestamp) > CACHE_EXPIRY_SECONDS:
        try:
            refresh_market_data(mappings)
        except Exception as e:
            print(f"Failed to refresh market data cache: {e}")
            if not cache_data:
                # If we have no cache at all and refresh fails, raise error
                raise e
    return mappings, cache_data

import threading

@app.on_event("startup")
def startup_event():
    """Pre-fetch and cache market data on startup in background to ensure instant server boot."""
    def load_data():
        try:
            mappings = get_analyst_mappings()
            refresh_market_data(mappings)
        except Exception as e:
            print(f"Failed to pre-populate cache on startup: {e}")
            
    threading.Thread(target=load_data, daemon=True).start()

# Static file serving
import os
if os.path.exists("public/assets"):
    app.mount("/assets", StaticFiles(directory="public/assets"), name="assets")
@app.get("/")
def serve_index():
    """Serve index.html at root route."""
    return FileResponse("public/index.html")

@app.get("/styles.css")
def serve_styles():
    """Serve custom stylesheet."""
    return FileResponse("public/styles.css")

def mock_analysts(ticker, base_analyst, base_firm, target_horizon, target, price):
    import random
    random.seed(ticker) # Consistent randomness per ticker
    
    # Use the base analyst as the primary
    primary = {
        "name": base_analyst,
        "firm": base_firm,
        "target": target,
        "rating": "Overweight" if target > price else "Underweight",
        "days_ago": random.randint(1, 14),
        "horizon": target_horizon if target_horizon else None
    }
    
    firms = ["Goldman Sachs", "Morgan Stanley", "JPMorgan", "Bank of America", "Citigroup", "Barclays", "UBS"]
    ratings = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"]
    
    analysts_list = [primary]
    
    # Generate 2-3 more mock analysts
    num_extra = random.randint(2, 3)
    used_firms = {base_firm}
    for _ in range(num_extra):
        firm = random.choice([f for f in firms if f not in used_firms])
        used_firms.add(firm)
        
        # Mock a target around the actual target (+/- 10%)
        mock_tgt = target * (1 + random.uniform(-0.1, 0.1))
        
        # Mock a rating based on target vs price
        if mock_tgt > price * 1.15:
            rating = "Strong Buy"
        elif mock_tgt > price * 1.05:
            rating = "Buy"
        elif mock_tgt < price * 0.95:
            rating = "Sell"
        else:
            rating = "Hold"
            
        analysts_list.append({
            "name": f"Analyst @ {firm}",
            "firm": firm,
            "target": round(mock_tgt, 2),
            "rating": rating,
            "days_ago": random.randint(1, 30),
            "horizon": None # Mock analysts don't specify horizon to match user request
        })
        
    return analysts_list

# API Endpoints
@app.get("/api/stocks")
def get_screened_stocks(
    threshold: float = Query(0.0, description="Divergence threshold value (X)"),
    unit: str = Query("usd", description="Divergence unit: 'usd', 'pts', or 'pct'"),
    asset_type: str = Query(None, description="Filter asset type: 'stock' or 'index'"),
    force_refresh: bool = Query(False, description="Bypass cache and force-refresh from yfinance")
):
    """
    Screener API Endpoint.
    Calculates current price divergence vs analyst target mean and filters by threshold X.
    Returns: { 'undervalued': [...], 'overvalued': [...] }
    """
    try:
        if force_refresh:
            mappings = get_analyst_mappings()
            refresh_market_data(mappings)
            data = cache_data
        else:
            mappings, data = get_cached_data()
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to retrieve market data: {str(e)}"})

    undervalued = []
    overvalued = []

    for m in mappings:
        ticker = m["ticker"]
        
        # Filter by stock vs index type if specified
        if asset_type and m["asset_type"] != asset_type:
            continue
            
        ticker_data = data.get(ticker)
        if not ticker_data:
            continue
            
        price = ticker_data["price"]
        target = ticker_data["target"]
        history = ticker_data["history"]
        consensus = ticker_data["consensus"]
        
        # Calculate average target from all available sources
        valid_targets = []
        if m.get("tv_target") and float(m["tv_target"]) > 0: valid_targets.append(float(m["tv_target"]))
        if m.get("yf_target") and float(m["yf_target"]) > 0: valid_targets.append(float(m["yf_target"]))
        if m.get("fv_target") and float(m["fv_target"]) > 0: valid_targets.append(float(m["fv_target"]))
        
        # If yfinance live target is fetched and valid, include it too
        if target and float(target) > 0:
            valid_targets.append(float(target))
            
        # Remove duplicates by converting to set, then back to list, then average
        valid_targets = list(set(valid_targets))
        if valid_targets:
            avg_target = sum(valid_targets) / len(valid_targets)
        else:
            avg_target = None
            
        # Core math logic: calculate differences
        if avg_target is not None:
            delta = avg_target - price
            percentage = (delta / price) * 100 if price > 0 else 0.0
            gap_size = abs(percentage) if unit == "pct" else abs(delta)
        else:
            delta = None
            percentage = None
            gap_size = 0.0
            
        # Filter by threshold X
        if gap_size < threshold:
            continue
            
        generated_analysts = mock_analysts(ticker, m["analyst"], m["firm"], m["target_horizon"], avg_target if avg_target is not None else 0, price)
        
        history_dict = ticker_data.get("history_dict", {"1d": history, "1mo": history, "1y": history, "5y": history})
        
        # Structure the payload exactly as expected by our frontend
        asset_payload = {
            "ticker": ticker,
            "name": m["company_name"],
            "price": price,
            "target": avg_target,
            "tv_target": m["tv_target"],
            "yf_target": m["yf_target"] or target,
            "fv_target": m["fv_target"],
            "delta": delta,
            "percentage": percentage,
            "analysts": generated_analysts,
            "analyst": m["analyst"],
            "firm": m["firm"],
            "source": m["source"],
            "successRate": m["successRate"],
            "consensus": consensus,
            "summary": m["summary"],
            "history": history,
            "history_dict": history_dict,
            "type": m["asset_type"],
            "targetHorizon": m["target_horizon"]
        }
        
        if avg_target is not None:
            if avg_target > price:
                undervalued.append(asset_payload)
            elif price > avg_target:
                overvalued.append(asset_payload)
        else:
            if consensus in ["Buy", "Strong Buy"]:
                undervalued.append(asset_payload)
            elif consensus in ["Sell", "Strong Sell"]:
                overvalued.append(asset_payload)
            else:
                undervalued.append(asset_payload)

    return {
        "undervalued": undervalued,
        "overvalued": overvalued
    }


@app.get("/api/stocks/stream")
async def stream_screened_stocks(
    threshold: float = Query(0.0),
    unit: str = Query("usd"),
    asset_type: str = Query(None),
    force_refresh: bool = Query(False)
):
    async def event_generator():
        global cache_data, cache_timestamp
        mappings = get_analyst_mappings()
        
        # Helper to process a chunk of mappings against available cache data

        def process_chunk(chunk_mappings, data_source):
            u_list = []
            o_list = []
            for m in chunk_mappings:
                if asset_type and m["asset_type"] != asset_type: continue
                ticker = m["ticker"]
                ticker_data = data_source.get(ticker)
                if not ticker_data: continue
                
                price = ticker_data["price"]
                target = ticker_data["target"]
                history = ticker_data["history"]
                consensus = ticker_data["consensus"]
                
                valid_targets = []
                if m.get("tv_target") and float(m["tv_target"]) > 0: valid_targets.append(float(m["tv_target"]))
                if m.get("yf_target") and float(m["yf_target"]) > 0: valid_targets.append(float(m["yf_target"]))
                if m.get("fv_target") and float(m["fv_target"]) > 0: valid_targets.append(float(m["fv_target"]))
                if target and float(target) > 0: valid_targets.append(float(target))
                
                valid_targets = list(set(valid_targets))
                if valid_targets:
                    avg_target = sum(valid_targets) / len(valid_targets)
                else:
                    avg_target = None
                    
                if avg_target is not None:
                    delta = avg_target - price
                    percentage = (delta / price) * 100 if price > 0 else 0.0
                    gap_size = abs(percentage) if unit == "pct" else abs(delta)
                else:
                    delta = None
                    percentage = None
                    gap_size = 0.0
                
                if gap_size < threshold: continue
                
                generated_analysts = mock_analysts(ticker, m["analyst"], m["firm"], m["target_horizon"], avg_target if avg_target is not None else 0, price)
                
                history_dict = ticker_data.get("history_dict", {"1d": history, "1mo": history, "1y": history, "5y": history})
                asset_payload = {
                    "ticker": ticker, "name": m["company_name"], "price": price,
                    "target": avg_target, "tv_target": m["tv_target"],
                    "yf_target": m["yf_target"] or target, "fv_target": m["fv_target"],
                    "delta": delta, "percentage": percentage, "analysts": generated_analysts,
                    "analyst": m["analyst"], "firm": m["firm"], "source": m["source"], "successRate": m["successRate"],
                    "consensus": consensus, "summary": m["summary"], "history": history,
                    "history_dict": history_dict,
                    "type": m["asset_type"], "targetHorizon": m["target_horizon"] if m["target_horizon"] else None
                }
                
                if avg_target is not None:
                    if avg_target > price: u_list.append(asset_payload)
                    elif price > avg_target: o_list.append(asset_payload)
                else:
                    if consensus in ["Buy", "Strong Buy"]: u_list.append(asset_payload)
                    elif consensus in ["Sell", "Strong Sell"]: o_list.append(asset_payload)
                    else: u_list.append(asset_payload)
            return u_list, o_list

        # If cache is valid, yield everything instantly as one chunk
        if not force_refresh and cache_data and (time.time() - cache_timestamp) <= CACHE_EXPIRY_SECONDS:
            u, o = process_chunk(mappings, cache_data)
            yield f"data: {json.dumps({'undervalued': u, 'overvalued': o})}\n\n"
            yield "data: {\"done\": true}\n\n"
            return
            
        # Otherwise, fetch in bulk upfront
        try:
            # We run the optimized bulk refresh in a background thread to avoid blocking the event loop
            await asyncio.to_thread(refresh_market_data, mappings)
        except Exception as e:
            print(f"Failed to refresh bulk data in stream: {e}")

        # Stream from the populated cache in chunks of 5 to preserve visual streaming effect
        chunk_size = 5
        for i in range(0, len(mappings), chunk_size):
            chunk_mappings = mappings[i:i+chunk_size]
            u, o = process_chunk(chunk_mappings, cache_data)
            yield f"data: {json.dumps({'undervalued': u, 'overvalued': o})}\n\n"
            await asyncio.sleep(0.05) # Tiny sleep to let browser render chunk by chunk
            
        yield "data: {\"done\": true}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/stocks/history/{ticker}")
async def get_stock_history(ticker: str):
    """
    Lazily fetch real historical price data for a specific ticker from yfinance.
    Called only when the user opens the detail panel for a stock.
    Returns { '1d': [...], '1mo': [...], '1y': [...], '5y': [...] }
    """
    import math

    def fetch_history():
        try:
            t = yf.Ticker(ticker)
            
            # Fetch 5y weekly data — covers 5y and 1y views
            hist_5y_raw = t.history(period="5y", interval="1wk")
            hist_5y = [round(float(v), 2) for v in hist_5y_raw["Close"].dropna().tolist()] if not hist_5y_raw.empty else []
            hist_1y = hist_5y[-52:] if len(hist_5y) >= 52 else hist_5y
            
            # Fetch 1mo daily data
            hist_1mo_raw = t.history(period="1mo", interval="1d")
            hist_1mo = [round(float(v), 2) for v in hist_1mo_raw["Close"].dropna().tolist()] if not hist_1mo_raw.empty else []
            
            # Fetch 5d data for 1-day intraday-ish view
            hist_1d_raw = t.history(period="5d", interval="15m")
            hist_1d = [round(float(v), 2) for v in hist_1d_raw["Close"].dropna().tolist()] if not hist_1d_raw.empty else []
            
            # Fetch real analysts
            real_analysts = []
            try:
                df = t.upgrades_downgrades
                if df is not None and not df.empty:
                    df_sorted = df.sort_index(ascending=False).head(10)
                    import datetime
                    for idx, row in df_sorted.iterrows():
                        firm = row.get("Firm", "Unknown")
                        rating = row.get("ToGrade", "Hold")
                        tgt = row.get("currentPriceTarget")
                        tgt_val = float(tgt) if tgt and not math.isnan(float(tgt)) else None
                        
                        days_ago = (datetime.datetime.now() - idx.to_pydatetime()).days
                        if days_ago < 0: days_ago = 0
                        
                        real_analysts.append({
                            "name": f"Analyst @ {firm}",
                            "firm": firm,
                            "target": tgt_val,
                            "rating": rating,
                            "days_ago": days_ago,
                            "horizon": None
                        })
            except Exception as e:
                print(f"Error fetching real analysts for {ticker}: {e}")
            
            return {
                "history_dict": {"1d": hist_1d, "1mo": hist_1mo, "1y": hist_1y, "5y": hist_5y},
                "analysts": real_analysts
            }
        except Exception as e:
            print(f"Error fetching history for {ticker}: {e}")
            # Return synthetic fallback
            price = cache_data.get(ticker, {}).get("price", 100.0)
            base = price if price > 0 else 100.0
            hist_1y = [round(base * (1 + (i - 51) * 0.003 + math.sin(i * 0.5) * 0.01), 2) for i in range(52)]
            hist_1y[-1] = round(base, 2)
            hist_5y = [round(base * (1 + (i - 259) * 0.001 + math.sin(i * 0.3) * 0.015), 2) for i in range(260)]
            hist_5y[-1] = round(base, 2)
            return {
                "history_dict": {
                    "1d": [round(base * (1 + (i - 9) * 0.001 + math.sin(i) * 0.002), 2) for i in range(20)],
                    "1mo": hist_1y[-22:],
                    "1y": hist_1y,
                    "5y": hist_5y
                },
                "analysts": []
            }

    history = await asyncio.to_thread(fetch_history)
    return JSONResponse(content=history)


from firebase_functions import https_fn

from firebase_admin import initialize_app

try:
    initialize_app()
except ValueError:
    pass

@https_fn.on_request(max_instances=1, memory=1024, timeout_sec=540)
def api(req: https_fn.Request) -> https_fn.Response:
    import json
    import asyncio
    
    # Handle CORS preflight
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
        return https_fn.Response('', status=204, headers=headers)
        
    path = req.path
    headers = {'Access-Control-Allow-Origin': '*'}
    
    if path == "/api/stocks" or path == "/api/stocks/":
        try:
            threshold = float(req.args.get("threshold", 0.0))
            unit = req.args.get("unit", "usd")
            asset_type = req.args.get("asset_type")
            force = req.args.get("force_refresh", "false").lower() == "true"
            
            res = get_screened_stocks(threshold, unit, asset_type, force)
            
            # If it's a dict (which get_screened_stocks normally returns), return it
            if isinstance(res, dict):
                return https_fn.Response(json.dumps(res), mimetype="application/json", headers=headers)
            # If it returned a FastAPI JSONResponse (due to an error inside get_screened_stocks)
            elif hasattr(res, "body"):
                return https_fn.Response(res.body, status=res.status_code, mimetype="application/json", headers=headers)
            else:
                return https_fn.Response(json.dumps(res), mimetype="application/json", headers=headers)
        except Exception as e:
            return https_fn.Response(json.dumps({"error": str(e)}), status=500, mimetype="application/json", headers=headers)
            
    elif path.startswith("/api/stocks/history/"):
        ticker = path.split("/")[-1]
        try:
            fastapi_res = asyncio.run(get_stock_history(ticker))
            return https_fn.Response(fastapi_res.body, status=fastapi_res.status_code, mimetype="application/json", headers=headers)
        except Exception as e:
            return https_fn.Response(json.dumps({"error": str(e)}), status=500, mimetype="application/json", headers=headers)
            
    return https_fn.Response(json.dumps({"error": "Not Found"}), status=404, mimetype="application/json", headers=headers)


