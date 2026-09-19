import sqlite3
import os

DB_PATH = "database.db"

def init_db():
    print(f"Initializing database at {DB_PATH}...")
    
    # Remove existing db file if any to start fresh
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create Table with company_name and target_horizon columns
    cursor.execute("""
        CREATE TABLE analyst_mappings (
            ticker TEXT PRIMARY KEY,
            yf_symbol TEXT NOT NULL,
            company_name TEXT NOT NULL,
            analyst_name TEXT NOT NULL,
            firm_name TEXT NOT NULL,
            success_rate INTEGER NOT NULL,
            source TEXT NOT NULL,
            target_offset_pct REAL NOT NULL,
            consensus TEXT NOT NULL,
            summary TEXT NOT NULL,
            asset_type TEXT NOT NULL,
            target_horizon TEXT NOT NULL,
            tv_target REAL,
            yf_target REAL,
            fv_target REAL
        )
    """)
    
    import csv
    import random

    seed_data = []
    firms = ["Morgan Stanley", "Goldman Sachs", "JPMorgan", "Wells Fargo", "Bernstein Research", "Jefferies", "Guggenheim"]
    analysts = ["Dan Ives", "Toni Sacconaghi", "Mark Lipacis", "Brian Fitzgerald", "Keith Weiss", "Doug Anmuth", "Ken Sena"]

    if os.path.exists("screener_data.csv"):
        with open("screener_data.csv", "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            seen_tickers = set()
            for row in reader:
                ticker = row["ticker"]
                if ticker in seen_tickers:
                    continue
                seen_tickers.add(ticker)
                yf_symbol = row["ticker"]
                company_name = row["name"]
                
                # We assign a simulated analyst and firm
                analyst_name = random.choice(analysts)
                firm_name = random.choice(firms)
                success_rate = random.randint(60, 95)
                source = "TradingView / Yahoo / Finviz"
                
                # To maintain compatibility with main.py, we set offset_pct to 0 since we now have real targets
                # But wait, main.py uses target_offset_pct as a fallback. Let's just calculate a dummy offset based on tv_target
                tv_target = float(row["tv_target"]) if row["tv_target"] else 0.0
                price = float(row["price"]) if row["price"] else 1.0
                offset_pct = ((tv_target - price) / price * 100) if price else 0.0
                
                yf_target = float(row["yf_target"]) if row["yf_target"] else None
                fv_target = float(row["fv_target"]) if row["fv_target"] else None
                
                consensus = row["tv_consensus"] or "Hold"
                summary = f"Aggregated targets from multiple screeners for {company_name}."
                asset_type = row.get("asset_type", "stock")
                target_horizon = "12 Months"
                
                seed_data.append((
                    ticker, yf_symbol, company_name, analyst_name, firm_name, 
                    success_rate, source, offset_pct, consensus, summary, asset_type, target_horizon,
                    tv_target, yf_target, fv_target
                ))
    else:
        print("screener_data.csv not found! Please run scrape_screener_apis.py first.")
        return
        
    # Add a few mock index funds to ensure the 'index' asset_type is populated
    seed_data.extend([
        ("SPY", "SPY", "SPDR S&P 500 ETF", "John Doe", "Vanguard", 85, "TradingView", 5.0, "Buy", "S&P 500 Index fund.", "index", "12 Months", 550.0, 560.0, 545.0),
        ("QQQ", "QQQ", "Invesco QQQ Trust", "Jane Doe", "Invesco", 90, "TradingView", 8.0, "Buy", "Nasdaq 100 Index fund.", "index", "12 Months", 450.0, 460.0, 455.0),
        ("VTI", "VTI", "Vanguard Total Stock Market", "Alice Smith", "Vanguard", 95, "TradingView", 6.0, "Buy", "Total market index.", "index", "12 Months", 260.0, 270.0, 265.0),
        ("DIA", "DIA", "SPDR Dow Jones Industrial", "Bob Johnson", "State Street", 82, "TradingView", 4.0, "Buy", "Dow Jones Industrial Average.", "index", "12 Months", 400.0, 410.0, 395.0)
    ])

    cursor.executemany("""
        INSERT INTO analyst_mappings 
        (ticker, yf_symbol, company_name, analyst_name, firm_name, success_rate, source, target_offset_pct, consensus, summary, asset_type, target_horizon, tv_target, yf_target, fv_target)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, seed_data)
    
    conn.commit()
    print(f"Successfully inserted {len(seed_data)} analyst mappings.")
    
    # Verify insert
    cursor.execute("SELECT COUNT(*) FROM analyst_mappings")
    count = cursor.fetchone()[0]
    print(f"Verified row count: {count}")
    
    conn.close()

if __name__ == "__main__":
    init_db()
