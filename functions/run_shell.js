const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
db.collection("market_data").get().then(snapshot => {
    let all_assets = [];
    snapshot.forEach(doc => {
        if (doc.id !== "top_dashboard" && doc.id !== "last_scrape_status") {
            let data = doc.data();
            let price = data.price;
            let target = data.target;
            let pct = 0;
            if (target !== null && target !== undefined && price !== null && price !== undefined && price > 0) {
                pct = ((target - price) / price) * 100;
            }
            data.percentage = pct;
            all_assets.push(data);
        }
    });
    
    let u_list = all_assets.filter(a => a.percentage > 0).sort((a,b) => Math.abs(b.percentage) - Math.abs(a.percentage));
    let o_list = all_assets.filter(a => a.percentage < 0).sort((a,b) => Math.abs(b.percentage) - Math.abs(a.percentage));
    
    const getTopMix = (lst) => {
        const stocks = lst.filter(a => a.type === "stock");
        const indexes = lst.filter(a => a.type === "index");
        return [...stocks.slice(0,40), ...indexes.slice(0,20)];
    };
    
    db.collection("market_data").doc("top_dashboard").set({
        undervalued: getTopMix(u_list),
        overvalued: getTopMix(o_list)
    }).then(() => {
        console.log("SEEDED SUCCESSFULLY!");
        process.exit(0);
    }).catch(e => {
        console.error("WRITE ERROR:", e);
        process.exit(1);
    });
}).catch(e => {
    console.error("READ ERROR:", e);
    process.exit(1);
});
