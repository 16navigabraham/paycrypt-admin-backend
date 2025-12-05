# Volume Tracking Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
# Installs axios for price API calls
```

### 2. Configure Environment

Add the Price API URL to your `.env`:

```env
PRICE_API_URL=https://paycrypt-margin-price.onrender.com
```

### 3. Deploy & Test

```bash
# Start server
npm start

# Test volume endpoint (after server starts)
curl http://localhost:5000/api/volume/total
```

## How It Works

### Architecture

```
┌──────────────┐
│ Smart        │  getSupportedTokens()
│ Contracts    │  getTokenDetails(address)
│ (3 chains)   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Contract     │  Fetch token volumes
│ Service      │  from Base, Lisk, Celo
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Price        │  Convert volumes to
│ Service      │  USD and NGN
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ MongoDB      │  Store snapshots
│ TotalVolume  │  every 15 minutes
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Volume API   │  Serve to frontend
│ Endpoints    │  with chart data
└──────────────┘
```

### Automatic Syncing

Volume data automatically syncs **every 15 minutes**:

```javascript
// In server.js - runs automatically
cron.schedule('*/15 * * * *', syncTotalVolume);
```

## API Usage Examples

### 1. Get Current Total Volume

```bash
curl http://localhost:5000/api/volume/total
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVolumeUSD": "1,234,567.89",
    "totalVolumeNGN": "1,901,234,567.89",
    "tokenCount": 8,
    "tokens": [...]
  }
}
```

### 2. Get Chart Data for 24 Hours

```bash
curl "http://localhost:5000/api/volume/chart?interval=24h"
```

**Response:**
```json
{
  "success": true,
  "interval": "24h",
  "statistics": {
    "latestVolumeUSD": "1,234,567.89",
    "changePercent": "2.88%"
  },
  "data": [
    {
      "timestamp": "2024-12-04T12:00:00.000Z",
      "totalVolumeUSD": "1,200,000.00",
      "totalVolumeNGN": "1,848,000,000.00"
    }
    // ... more data points
  ]
}
```

### 3. Get Latest Cached Data (Fast)

```bash
curl http://localhost:5000/api/volume/latest
```

### 4. Get Volume by Chain

```bash
curl http://localhost:5000/api/volume/by-chain
```

## Frontend Integration

### React Component Example

```jsx
import { useState, useEffect } from 'react';

function VolumeDisplay() {
  const [volume, setVolume] = useState(null);

  useEffect(() => {
    async function fetchVolume() {
      const res = await fetch('/api/volume/latest');
      const data = await res.json();
      setVolume(data.data);
    }
    
    fetchVolume();
    const interval = setInterval(fetchVolume, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  if (!volume) return <div>Loading...</div>;

  return (
    <div className="volume-card">
      <h2>Total Trading Volume</h2>
      <div className="volume-usd">
        ${volume.totalVolumeUSD}
      </div>
      <div className="volume-ngn">
        ₦{volume.totalVolumeNGN}
      </div>
      <small>Across {volume.tokenCount} tokens</small>
    </div>
  );
}
```

### Chart Integration (with Chart.js)

```jsx
import { Line } from 'react-chartjs-2';
import { useState, useEffect } from 'react';

function VolumeChart() {
  const [chartData, setChartData] = useState(null);
  const [interval, setInterval] = useState('24h');

  useEffect(() => {
    async function fetchData() {
      const res = await fetch(`/api/volume/chart?interval=${interval}`);
      const data = await res.json();
      
      setChartData({
        labels: data.data.map(d => 
          new Date(d.timestamp).toLocaleString()
        ),
        datasets: [{
          label: 'Volume (USD)',
          data: data.data.map(d => 
            parseFloat(d.totalVolumeUSD.replace(/,/g, ''))
          ),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
        }]
      });
    }

    fetchData();
  }, [interval]);

  return (
    <div>
      <select onChange={e => setInterval(e.target.value)}>
        <option value="3h">Last 3 Hours</option>
        <option value="12h">Last 12 Hours</option>
        <option value="24h">Last 24 Hours</option>
      </select>
      {chartData && <Line data={chartData} />}
    </div>
  );
}
```

## Token Mapping

The system automatically recognizes these tokens:

| Token Name | Symbol | CoinGecko ID |
|------------|--------|--------------|
| USDT / Tether | usdt | tether |
| USDC / USD Coin | usdc | usd-coin |
| SEND Token | send | send-token-2 |
| Celo Dollar / cUSD | cusd | celo-dollar |
| Celo | celo | celo |
| Bitcoin | btc | bitcoin |
| Ethereum | eth | ethereum |

### Adding New Tokens

To support new tokens, update `services/priceService.js`:

```javascript
const TOKEN_ID_MAP = {
  // Add your new token
  'your-token-symbol': 'coingecko-id',
  // Example:
  'dai': 'dai',
  'wbtc': 'wrapped-bitcoin'
};
```

Then update the `getTokenSymbol` function to recognize the token name.

## Monitoring

### Check Sync Status

```bash
# Check logs for volume sync
tail -f logs/app.log | grep "volume sync"

# Expected output every 15 minutes:
💰 Starting total volume sync...
📊 Found 8 tokens across all chains
✅ Total volume sync completed
💰 Total: $1,234,567.89 USD / ₦1,901,234,567.89 NGN
```

### Database Queries

```javascript
// Connect to MongoDB
mongo paycrypt-admin

// Check volume snapshots
db.totalvolumes.find().sort({timestamp:-1}).limit(5).pretty()

// Count snapshots
db.totalvolumes.countDocuments()

// Check latest
db.totalvolumes.findOne({}, {}, {sort: {timestamp: -1}})
```

## Troubleshooting

### Issue: No volume data

**Check:**
1. Server logs for sync errors
2. Smart contract connections: `db.syncstatuses.find()`
3. Price API is accessible: `curl https://paycrypt-margin-price.onrender.com/health`

**Solution:**
```bash
# Manually trigger sync
curl -X POST http://localhost:5000/api/admin/force-sync
# Or restart server to trigger initial sync
```

### Issue: Prices showing as 0 or null

**Check:**
1. Token names are recognized in `priceService.js`
2. Price API is responding
3. Check price cache: See server logs for price fetch errors

**Solution:**
```javascript
// Check if token is mapped
const symbol = priceService.getTokenSymbol('USD Coin');
console.log(symbol); // Should return 'usdc'

const id = priceService.getCoinGeckoId('usdc');
console.log(id); // Should return 'usd-coin'
```

### Issue: Chart shows no data

**Check:**
1. Cron job is running (check server logs)
2. Enough time has passed for data points
3. Database has volume snapshots

**Solution:**
```bash
# Check if cron is enabled
# In .env, ensure:
NODE_ENV=production
# OR
ENABLE_CRON=true

# Check database
mongo paycrypt-admin
db.totalvolumes.countDocuments()
```

## Performance Tips

### 1. Use `/latest` for frequent polling

```javascript
// ✅ Good - uses cached data
setInterval(() => fetchLatestVolume(), 60000);

// ❌ Avoid - recalculates every time
setInterval(() => fetchTotalVolume(), 60000);
```

### 2. Cache on frontend

```javascript
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
let cachedVolume = null;
let cacheExpiry = 0;

async function getVolume() {
  if (cachedVolume && Date.now() < cacheExpiry) {
    return cachedVolume;
  }
  
  const response = await fetch('/api/volume/latest');
  cachedVolume = await response.json();
  cacheExpiry = Date.now() + CACHE_TIME;
  
  return cachedVolume;
}
```

### 3. Use appropriate intervals

```javascript
// For real-time dashboard
interval = '3h';  // ~12 data points

// For daily overview
interval = '12h'; // ~48 data points

// For trend analysis
interval = '24h'; // ~96 data points
```

## Testing

### Manual Test Script

```bash
#!/bin/bash

echo "Testing Volume API endpoints..."

echo "\n1. Testing /api/volume/total"
curl -s http://localhost:5000/api/volume/total | jq '.success'

echo "\n2. Testing /api/volume/latest"
curl -s http://localhost:5000/api/volume/latest | jq '.success'

echo "\n3. Testing /api/volume/chart?interval=3h"
curl -s "http://localhost:5000/api/volume/chart?interval=3h" | jq '.dataPoints'

echo "\n4. Testing /api/volume/by-chain"
curl -s http://localhost:5000/api/volume/by-chain | jq '.data.byChain | length'

echo "\nAll tests completed!"
```

### Integration Test

```javascript
const request = require('supertest');
const app = require('./server');

describe('Volume API', () => {
  test('GET /api/volume/latest returns volume data', async () => {
    const response = await request(app)
      .get('/api/volume/latest')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.totalVolumeUSD).toBeDefined();
  });

  test('GET /api/volume/chart with valid interval', async () => {
    const response = await request(app)
      .get('/api/volume/chart?interval=24h')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
  });
});
```

## Production Checklist

- [ ] `PRICE_API_URL` configured in environment
- [ ] All chain RPC URLs configured
- [ ] Cron jobs enabled (`NODE_ENV=production` or `ENABLE_CRON=true`)
- [ ] MongoDB connection working
- [ ] Smart contracts initialized on all chains
- [ ] Price API accessible from server
- [ ] Test all 4 volume endpoints
- [ ] Verify cron job runs every 15 minutes
- [ ] Check database is storing snapshots
- [ ] Monitor logs for errors

## Next Steps

1. **Deploy to Production**
   ```bash
   git add .
   git commit -m "Add volume tracking feature"
   git push origin main
   ```

2. **Verify Deployment**
   ```bash
   curl https://your-domain.com/api/volume/latest
   ```

3. **Integrate in Frontend**
   - Add volume display cards
   - Create chart components
   - Setup auto-refresh

4. **Monitor**
   - Watch cron job logs
   - Check database growth
   - Monitor API response times

## Documentation

For more details, see:
- [VOLUME_API_DOCS.md](VOLUME_API_DOCS.md) - Complete API documentation
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Developer quick reference
- [README.md](README.md) - Project overview

---

**Need Help?**
- Check server logs: `tail -f logs/app.log`
- Test price API: `curl https://paycrypt-margin-price.onrender.com/health`
- Verify tokens: Review `services/priceService.js`
- Contact development team for support
