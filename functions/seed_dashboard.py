import firebase_admin
from firebase_admin import firestore
firebase_admin.initialize_app()
db = firestore.client()

docs = db.collection("market_data").stream()
all_assets = []
for doc in docs:
    if doc.id == "top_dashboard" or doc.id == "last_scrape_status":
        continue
    data = doc.to_dict()
    price = data.get("price")
    avg_target = data.get("target")
    
    if avg_target is not None and price is not None:
        delta = avg_target - price
        percentage = (delta / price) * 100 if price > 0 else 0.0
    else:
        percentage = 0.0
        
    data["percentage"] = percentage
    all_assets.append(data)

u_list = [a for a in all_assets if a.get("percentage", 0) > 0]
o_list = [a for a in all_assets if a.get("percentage", 0) < 0]

u_list.sort(key=lambda x: abs(x["percentage"]), reverse=True)
o_list.sort(key=lambda x: abs(x["percentage"]), reverse=True)

def get_top_mix(lst):
    stocks = [x for x in lst if x.get("type") == "stock"]
    indexes = [x for x in lst if x.get("type") == "index"]
    return stocks[:40] + indexes[:20]

top_dashboard = {
    "undervalued": get_top_mix(u_list),
    "overvalued": get_top_mix(o_list)
}

db.collection("market_data").document("top_dashboard").set(top_dashboard)
print("Dashboard seeded!")
