import sqlite3
import random
import time

def mock_populate():
    DB_PATH = "database.db"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS analyst_mappings")
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
    
    rows = []
    # Mix of some known tickers to test live price fetch
    test_tickers = [
        ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("TSLA", "Tesla"),
        ("TEVA", "Teva Pharmaceutical"), ("NICE", "Nice Ltd"),
        ("SPY", "SPDR S&P 500 ETF"), ("QQQ", "Invesco QQQ")
    ]
    
    # Add 100 fake tickers just to pad the DB
    for i in range(100):
        test_tickers.append((f"TICK{i}", f"Fake Company {i}"))
        
    for ticker, name in test_tickers:
        is_index = ticker in ["SPY", "QQQ"]
        rows.append((
            ticker, ticker, name,
            "Dan Ives", "Morgan Stanley", 85, "YF / TV Consensus",
            random.uniform(5, 20), "Buy", f"Target for {name}",
            "index" if is_index else "stock", "12 Months",
            None, random.uniform(100, 500), None
        ))
        
    cursor.executemany("""
        INSERT INTO analyst_mappings 
        (ticker, yf_symbol, company_name, analyst_name, firm_name, success_rate, source, target_offset_pct, consensus, summary, asset_type, target_horizon, tv_target, yf_target, fv_target)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()
    print("Mock DB populated.")

if __name__ == "__main__":
    mock_populate()
