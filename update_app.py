import re

with open("finance-landing/src/App.tsx", "r") as f:
    content = f.read()

# Add new state variables
state_injection = """  const [undervalued, setUndervalued] = useState<Asset[]>([]);
  const [overvalued, setOvervalued] = useState<Asset[]>([]);
  const [screenerUndervalued, setScreenerUndervalued] = useState<Asset[]>([]);
  const [screenerOvervalued, setScreenerOvervalued] = useState<Asset[]>([]);
  const [displayLimit, setDisplayLimit] = useState(30);"""

content = re.sub(
    r'  const \[undervalued, setUndervalued\] = useState<Asset\[\]>\(\[\]\);\n  const \[overvalued, setOvervalued\] = useState<Asset\[\]>\(\[\]\);',
    state_injection,
    content
)

# Update fetchMarketData
old_fetch = """  const fetchMarketData = async (force = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const dashUrl = `/api/stocks/dashboard`;
      const dashRes = await fetch(dashUrl);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setUndervalued(dashData.undervalued || []);
        setOvervalued(dashData.overvalued || []);
        setLoading(false);
      }

      const eventSource = new EventSource(`/api/stocks/stream?threshold=0${force ? '&force_refresh=true' : ''}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.done) {
          eventSource.close();
        } else {
          setUndervalued(prev => mergeAndFlash(prev, data.undervalued || []));
          setOvervalued(prev => mergeAndFlash(prev, data.overvalued || []));
        }
      };
      
      eventSource.onerror = (err) => {
        console.error('Stream error:', err);
        eventSource.close();
      };
    } catch (err) {
      console.error('Failed to load market data:', err);
      setError('Failed to load market data. Please refresh.');
      setLoading(false);
    }
  };"""

new_fetch = """  const fetchMarketData = async (force = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const dashUrl = `/api/stocks/dashboard`;
      const dashRes = await fetch(dashUrl);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setUndervalued(dashData.undervalued || []);
        setOvervalued(dashData.overvalued || []);
      }

      const fullUrl = `/api/stocks?threshold=0${force ? '&force_refresh=true' : ''}`;
      const fullRes = await fetch(fullUrl);
      if (fullRes.ok) {
        const fullData = await fullRes.json();
        setScreenerUndervalued(fullData.undervalued || []);
        setScreenerOvervalued(fullData.overvalued || []);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to load market data:', err);
      setError('Failed to load market data. Please refresh.');
      setLoading(false);
    }
  };"""

content = content.replace(old_fetch, new_fetch)

# Update currentUndervalued/currentOvervalued to use screener variables
content = content.replace(
    "const currentUndervalued = filterAssets(undervalued, true);",
    "const currentUndervalued = filterAssets(screenerUndervalued, true);"
)
content = content.replace(
    "const currentOvervalued = filterAssets(overvalued, true);",
    "const currentOvervalued = filterAssets(screenerOvervalued, true);"
)

# Update rendering of currentUndervalued and currentOvervalued to slice up to displayLimit
content = content.replace(
    "currentUndervalued.map((asset, i)",
    "currentUndervalued.slice(0, displayLimit).map((asset, i)"
)
content = content.replace(
    "currentOvervalued.map((asset, i)",
    "currentOvervalued.slice(0, displayLimit).map((asset, i)"
)

# Add load more event handler
content = content.replace(
    "</div>\n        </div>\n        } />\n\n        {/* Screen 2: Screener */}",
    "</div>\n        </div>\n        } />\n\n        {/* Screen 2: Screener */}"
)

# Find the scroll container in screener and add onScroll
old_screener = """        <Route path="/screener" element={
        <div id="screen-screener" className="w-full flex-shrink-0 h-full flex flex-col pb-24 border-x border-border">"""

new_screener = """        <Route path="/screener" element={
        <div id="screen-screener" className="w-full flex-shrink-0 h-full flex flex-col pb-24 border-x border-border" onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          if (target.scrollHeight - target.scrollTop <= target.clientHeight + 200) {
            setDisplayLimit(prev => prev + 30);
          }
        }} style={{ overflowY: 'auto' }}>"""

content = content.replace(old_screener, new_screener)

with open("finance-landing/src/App.tsx", "w") as f:
    f.write(content)
print("Updated App.tsx")
