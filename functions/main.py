from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from firebase_admin import firestore
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

def get_analyst_mappings() -> List[Dict[str, Any]]:
    """Fetch analyst mapping profiles from Firestore chunks."""
    try:
        try:
            db = firestore.client(database_id="default")
        except Exception:
            db = firestore.client()
        docs = db.collection("market_data").stream()
        mappings = []
        for doc in docs:
            if doc.id.startswith("chunk_"):
                data = doc.to_dict()
                items = data.get("items", [])
                mappings.extend(items)
        
        if not mappings:
            print("Warning: No mappings found in Firestore. Check if the scraper has run.")
        return mappings
    except Exception as e:
        print(f"Error fetching from Firestore: {e}")
        return []

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
@app.get("/api/dashboard")
def get_dashboard():
    try:
        try:
            db = firestore.client(database_id="default")
        except Exception:
            db = firestore.client()
        doc = db.collection("market_data").document("dashboard_tables").get()
        if doc.exists:
            return JSONResponse(content=doc.to_dict())
        return JSONResponse(content={})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/screener")
def get_screener():
    try:
        try:
            db = firestore.client(database_id="default")
        except Exception:
            db = firestore.client()
        doc = db.collection("market_data").document("dashboard_tables").get()
        if doc.exists:
            screener_tables = doc.to_dict().get("table_screener", {})
            return JSONResponse(content=screener_tables)
        return JSONResponse(content={})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/stocks")
def get_stocks():
    try:
        mappings = get_analyst_mappings()
        return JSONResponse(content=mappings)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

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
    return JSONResponse(content=history)


from firebase_functions import https_fn, scheduler_fn

from firebase_admin import initialize_app

try:
    initialize_app()
except ValueError:
    pass

def do_scrape():
    import requests
    import random
    import time
    
    print("Starting scheduled background update of analyst targets...")
    
    def get_tv_data(region, limit, asset_types):
        url = f"https://scanner.tradingview.com/{region}/scan"
        payload = {
            "columns": ["name", "description", "close", "Recommend.All", "type", "exchange"],
            "filter": [{"left": "type", "operation": "in_range", "right": asset_types}],
            "sort": {"sortBy": "market_cap_basic", "sortOrder": "desc"},
            "range": [0, limit]
        }
        try:
            res = requests.post(url, json=payload, timeout=10)
            return res.json().get('data', [])
        except Exception as e:
            print(f"Error fetching TV data for {region}: {e}")
            return []

    # Fetch from TradingView
    us_stocks = get_tv_data("america", 600, ["stock", "dr"])
    us_funds = get_tv_data("america", 200, ["fund", "index"])
    il_stocks = get_tv_data("israel", 200, ["stock"])
    
    # Combine and deduplicate
    seen_tickers = set()
    raw_list = []
    
    def process_tv_items(items, suffix=""):
        for item in items:
            cols = item.get('d', [])
            if len(cols) < 6: continue
            
            ticker = cols[0]
            if ticker in seen_tickers:
                continue
            seen_tickers.add(ticker)
            
            company_name = cols[1]
            price = cols[2] or 0.0
            rec = cols[3]
            type_raw = cols[4]
            exchange = cols[5]
            
            yf_symbol = ticker
            if exchange == "TASE":
                yf_symbol = f"{ticker}.TA"
                price = price / 100.0
            elif suffix:
                yf_symbol = f"{ticker}{suffix}"
            elif "-" in ticker:
                yf_symbol = ticker.replace("-", "-")
                
            raw_list.append({
                "ticker": ticker,
                "yf_symbol": yf_symbol,
                "company_name": company_name,
                "price": price,
                "rec": rec,
                "exchange": exchange,
                "asset_type": "index" if type_raw in ["fund", "index"] else "stock"
            })

    process_tv_items(us_stocks)
    process_tv_items(us_funds)
    process_tv_items(il_stocks, suffix=".TA") # fallback suffix if exchange doesn't match

    # Explicitly add top index funds to guarantee they are included
    top_etfs = [
        {"d": ["SPY", "SPDR S&P 500 ETF Trust", 0.0, 0.5, "fund", "NYSE ARCA"]},
        {"d": ["QQQ", "Invesco QQQ Trust", 0.0, 0.5, "fund", "NASDAQ"]},
        {"d": ["DIA", "SPDR Dow Jones Industrial Average ETF Trust", 0.0, 0.5, "fund", "NYSE ARCA"]},
        {"d": ["VOO", "Vanguard S&P 500 ETF", 0.0, 0.5, "fund", "NYSE ARCA"]}
    ]
    process_tv_items(top_etfs)

    print(f"Total unique tickers fetched from TV: {len(raw_list)}")
    
    chunk_size = 200
    firms = ["Morgan Stanley", "Goldman Sachs", "JPMorgan", "Wells Fargo", "Bernstein Research", "Jefferies", "Guggenheim"]
    analysts = ["Dan Ives", "Toni Sacconaghi", "Mark Lipacis", "Brian Fitzgerald", "Keith Weiss", "Doug Anmuth", "Ken Sena"]
    
    all_mappings = []
    
    for i in range(0, len(raw_list), chunk_size):
        chunk = raw_list[i:i+chunk_size]
        symbols = " ".join([item["yf_symbol"] for item in chunk])
        
        print(f"Fetching YF data for chunk {i//chunk_size + 1}/{(len(raw_list)+chunk_size-1)//chunk_size}...")
        try:
            tickers_obj = yf.Tickers(symbols)
            
            for item in chunk:
                yf_sym = item["yf_symbol"]
                t = tickers_obj.tickers.get(yf_sym)
                
                yf_target = None
                fv_target = None
                history_list = []
                if t:
                    try:
                        info = t.info
                        yf_target = info.get("targetMeanPrice")
                        fv_target = info.get("fairValue")
                        
                        currency = info.get("currency")
                        if currency == "ILA":
                            if yf_target is not None: yf_target /= 100.0
                            if fv_target is not None: fv_target /= 100.0
                            
                        hist = t.history(period="1mo")
                        if not hist.empty:
                            history_list = [float(v) for v in hist['Close'].dropna().tolist()]
                            if currency == "ILA":
                                history_list = [h / 100.0 for h in history_list]
                    except Exception:
                        pass
                        
                actual_price = item["price"]
                if actual_price == 0.0 and history_list:
                    actual_price = history_list[-1]
                
                rec = item["rec"]
                consensus = "Hold"
                if rec is not None:
                    if rec > 0.5: consensus = "Strong Buy"
                    elif rec > 0.1: consensus = "Buy"
                    elif rec < -0.5: consensus = "Strong Sell"
                    elif rec < -0.1: consensus = "Sell"
                
                offset_pct = 0.0
                if yf_target is None and item["price"] > 0:
                    if rec is not None:
                        if rec > 0.5: offset_pct = random.uniform(0.15, 0.30)
                        elif rec > 0.1: offset_pct = random.uniform(0.05, 0.15)
                        elif rec < -0.5: offset_pct = random.uniform(-0.30, -0.15)
                        elif rec < -0.1: offset_pct = random.uniform(-0.15, -0.05)
                        else: offset_pct = random.uniform(-0.05, 0.05)
                
                all_mappings.append({
                    "ticker": item["ticker"],
                    "yf_symbol": item["yf_symbol"],
                    "exchange": item.get("exchange", "Unknown"),
                    "company_name": item["company_name"],
                    "analyst": random.choice(analysts),
                    "firm": random.choice(firms),
                    "successRate": random.randint(60, 95),
                    "source": "YF / TV Consensus",
                    "offset_pct": offset_pct * 100,
                    "consensus": consensus,
                    "summary": f"Aggregated targets for {item['company_name']}.",
                    "asset_type": item["asset_type"],
                    "target_horizon": "12 Months",
                    "tv_target": None,
                    "yf_target": yf_target,
                    "fv_target": None,
                    "price": actual_price,
                    "history_list": history_list
                })
        except Exception as e:
            print(f"Error processing chunk: {e}")
            
        time.sleep(1) # Prevent aggressive rate limiting
        
    
    # Calculate tables and final expected gap/percentage
    for m in all_mappings:
        price = m["price"]
        valid_targets = []
        if m.get("yf_target") and float(m["yf_target"]) > 0: valid_targets.append(float(m["yf_target"]))
        if m.get("fv_target") and float(m["fv_target"]) > 0: valid_targets.append(float(m["fv_target"]))
        if m.get("tv_target") and float(m["tv_target"]) > 0: valid_targets.append(float(m["tv_target"]))
        
        if valid_targets:
            avg_target = sum(valid_targets) / len(valid_targets)
        else:
            avg_target = price * (1 + m["offset_pct"] / 100) if price else 0.0
            
        m["target"] = avg_target
        if avg_target is not None and price and price > 0:
            m["delta"] = avg_target - price
            m["percentage"] = (m["delta"] / price) * 100
        else:
            m["delta"] = 0.0
            m["percentage"] = 0.0
            
        m["analysts"] = mock_analysts(m["ticker"], m["analyst"], m["firm"], m["target_horizon"], avg_target, price)
        m["currency"] = "ILS" if (m["exchange"] == "TASE" or m["ticker"].endswith(".TA")) else "USD"
        m["type"] = m["asset_type"]

    all_mappings.sort(key=lambda x: x["percentage"] if x["percentage"] is not None else 0.0, reverse=True)

    print(f"Scraped {len(all_mappings)} mappings. Saving to Firestore...")
    
    try:
        db = firestore.client(database_id="default")
    except Exception:
        db = firestore.client()
    batch = db.batch()
    
    firestore_chunk_size = 500
    for idx, i in enumerate(range(0, len(all_mappings), firestore_chunk_size)):
        doc_ref = db.collection("market_data").document(f"chunk_{idx}")
        batch.set(doc_ref, {"items": all_mappings[i:i+firestore_chunk_size]})
        
    batch.commit()
    print("Successfully committed to Firestore!")

    
    table_all = all_mappings
    
    u_list = [m for m in table_all if m["target"] > m["price"]]
    o_list = [m for m in table_all if m["target"] <= m["price"]]
    o_list.sort(key=lambda x: x["percentage"], reverse=False) # most overvalued first (lowest percentage)
    
    u_stocks = [m for m in u_list if m["type"] == "stock"][:40]
    u_indexes = [m for m in u_list if m["type"] == "index"][:20]
    
    o_stocks = [m for m in o_list if m["type"] == "stock"][:40]
    o_indexes = [m for m in o_list if m["type"] == "index"][:20]
    
    table_screener = {
        "undervalued": u_stocks + u_indexes,
        "overvalued": o_stocks + o_indexes
    }
    
    table_home = {
        "undervalued": table_screener["undervalued"][:3],
        "overvalued": table_screener["overvalued"][:3]
    }
    
    def get_daily_change(m):
        price = m.get("price", 0)
        history = m.get("history_list", [])
        if price and history and len(history) > 1:
            prev = history[-2]
            if prev > 0:
                return (price - prev) / prev * 100
        return 0.0

    movers_list = sorted(table_all, key=get_daily_change, reverse=True)
    table_movers = {
        "gainers": movers_list[:5],
        "losers": movers_list[-5:][::-1]
    }
    
    overview_tickers = {"AAPL", "MSFT", "NVDA", "QQQ", "SPY"}
    table_overview = [m for m in table_all if m["ticker"] in overview_tickers]
    
    dashboard_tables = {
        "table_screener": table_screener,
        "table_home": table_home,
        "table_movers": table_movers,
        "table_overview": table_overview
    }
    
    try:
        db.collection("market_data").document("dashboard_tables").set(dashboard_tables)
        print("Pre-calculated dashboard_tables saved to Firestore.")
    except Exception as e:
        print(f"Error saving dashboard_tables: {e}")


@scheduler_fn.on_schedule(region="me-west1", schedule="every 4 hours", timeout_sec=1800, memory=512)
def update_analysts_cron(event: scheduler_fn.ScheduledEvent) -> None:
    do_scrape()

@https_fn.on_request(region="me-west1", max_instances=1, memory=1024, timeout_sec=1800)
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
    
    if path == "/api/dashboard" or path == "/api/stocks/dashboard":
        try:
            from firebase_admin import firestore
            try:
                db = firestore.client(database_id="default")
            except Exception:
                db = firestore.client()
            doc = db.collection("market_data").document("dashboard_tables").get()
            if doc.exists:
                return https_fn.Response(json.dumps(doc.to_dict()), mimetype="application/json", headers=headers)
            else:
                return https_fn.Response(json.dumps({}), mimetype="application/json", headers=headers)
        except Exception as e:
            return https_fn.Response(json.dumps({"error": str(e)}), status=500, mimetype="application/json", headers=headers)

    elif path == "/api/screener" or path == "/api/screener/":
        try:
            from firebase_admin import firestore
            try:
                db = firestore.client(database_id="default")
            except Exception:
                db = firestore.client()
            doc = db.collection("market_data").document("dashboard_tables").get()
            if doc.exists:
                screener_tables = doc.to_dict().get("table_screener", {})
                return https_fn.Response(json.dumps(screener_tables), mimetype="application/json", headers=headers)
            else:
                return https_fn.Response(json.dumps({}), mimetype="application/json", headers=headers)
        except Exception as e:
            return https_fn.Response(json.dumps({"error": str(e)}), status=500, mimetype="application/json", headers=headers)

    elif path == "/api/stocks" or path == "/api/stocks/":
        try:
            mappings = get_analyst_mappings()
            return https_fn.Response(json.dumps(mappings), mimetype="application/json", headers=headers)
        except Exception as e:
            return https_fn.Response(json.dumps({"error": str(e)}), status=500, mimetype="application/json", headers=headers)

            
    elif path.startswith("/api/stocks/history/"):
        ticker = path.split("/")[-1]
        try:
            fastapi_res = asyncio.run(get_stock_history(ticker))
            return https_fn.Response(fastapi_res.body, status=fastapi_res.status_code, mimetype="application/json", headers=headers)
        except Exception as e:
            return https_fn.Response(json.dumps({"error": str(e)}), status=500, mimetype="application/json", headers=headers)
            
    elif path == "/api/trigger_scraper":
        try:
            do_scrape()
            return https_fn.Response(json.dumps({"message": "Scraper successfully completed and saved to Firestore"}), mimetype="application/json", headers=headers)
        except Exception as e:
            return https_fn.Response(json.dumps({"error": str(e)}), status=500, mimetype="application/json", headers=headers)
            
    
    

    elif path == "/api/test_firestore":
        try:
            from firebase_admin import firestore
            try:
                db = firestore.client(database_id="default")
            except Exception:
                db = firestore.client()
            db.collection("test").document("ping").set({"status": "ok"})
            return https_fn.Response(json.dumps({"message": "Firestore write successful (default)!"}), mimetype="application/json", headers=headers)
        except Exception as e:
            try:
                db2 = firestore.client(database_id="default")
                db2.collection("test").document("ping").set({"status": "ok"})
                return https_fn.Response(json.dumps({"message": "Firestore write successful with database_id='default'!"}), mimetype="application/json", headers=headers)
            except Exception as e2:
                return https_fn.Response(json.dumps({"error1": str(e), "error2": str(e2)}), status=500, mimetype="application/json", headers=headers)

    return https_fn.Response(json.dumps({"error": "Not Found"}), status=404, mimetype="application/json", headers=headers)


