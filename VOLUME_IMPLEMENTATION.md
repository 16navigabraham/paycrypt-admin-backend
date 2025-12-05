# Volume Tracking Implementation Summary

## ✅ What Was Implemented

### 1. **Price Service** (`services/priceService.js`)
- Integrates with PayCrypt Price API
- Converts token amounts to USD and NGN
- Token symbol recognition from names
- Price caching (1-minute expiry)
- Batch price fetching for efficiency

### 2. **Contract Service Extensions** (`services/contractService.js`)
Added methods to fetch token data from smart contracts:
- `getSupportedTokens(chainId)` - Get all supported token addresses
- `getTokenDetails(chainId, tokenAddress)` - Get detailed token info including volume
- `getAllTokensWithDetails(chainId)` - Get all tokens with details for one chain
- `getAllTokensAcrossChains()` - Get all tokens across Base, Lisk, and Celo

### 3. **TotalVolume Model** (`models/TotalVolume.js`)
MongoDB schema for storing volume snapshots:
- Total volume in USD and NGN
- Token-by-token breakdown
- Chain information
- Price data
- Timestamp for historical tracking

### 4. **Volume Routes** (`routes/volume.js`)
Four new API endpoints:
- `GET /api/volume/total` - Current total volume (real-time calculation)
- `GET /api/volume/latest` - Latest cached volume (fast)
- `GET /api/volume/chart?interval=3h|12h|24h` - Time-series data for charts
- `GET /api/volume/by-chain` - Volume breakdown by blockchain

### 5. **Automatic Sync** (`jobs/cronJobs.js`)
- Added `syncTotalVolume()` function
- Runs every 15 minutes via cron
- Fetches all tokens from all chains
- Converts volumes to USD/NGN
- Stores snapshots in database

### 6. **Server Integration** (`server.js`)
- Registered volume routes
- Added volume sync to cron schedule
- Updated API description

## 📊 How It Works

```
Every 15 minutes:
┌──────────────────────────────────────────────────┐
│ 1. Fetch all supported tokens from smart        │
│    contracts on Base, Lisk, and Celo            │
└───────────────────┬──────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────┐
│ 2. Get token details (name, decimals, volume)   │
│    using contract.getTokenDetails()              │
└───────────────────┬──────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────┐
│ 3. Batch fetch prices from PayCrypt Price API   │
│    (USDT, USDC, SEND, CELO, etc.)               │
└───────────────────┬──────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────┐
│ 4. Convert each token's volume to USD & NGN     │
│    (raw amount ÷ 10^decimals × price)           │
└───────────────────┬──────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────┐
│ 5. Sum all volumes to get total                 │
│    Save snapshot to MongoDB                      │
└──────────────────────────────────────────────────┘
```

## 🎯 Frontend Usage

### Get Current Volume
```javascript
const response = await fetch('/api/volume/total');
const { data } = await response.json();

console.log(`Total Volume: $${data.totalVolumeUSD}`);
console.log(`Total Volume: ₦${data.totalVolumeNGN}`);
console.log(`Tokens tracked: ${data.tokenCount}`);
```

### Get Chart Data (24 hours)
```javascript
const response = await fetch('/api/volume/chart?interval=24h');
const { data, statistics } = await response.json();

// data = array of { timestamp, totalVolumeUSD, totalVolumeNGN }
// Use for chart visualization

console.log(`Change: ${statistics.changePercent}`);
console.log(`Avg Volume: $${statistics.avgVolumeUSD}`);
```

### React Chart Example
```jsx
import { Line } from 'react-chartjs-2';

function VolumeChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/volume/chart?interval=24h')
      .then(res => res.json())
      .then(json => setData(json.data));
  }, []);

  const chartData = {
    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [{
      label: 'Volume (USD)',
      data: data.map(d => parseFloat(d.totalVolumeUSD.replace(/,/g, '')))
    }]
  };

  return <Line data={chartData} />;
}
```

## 🔧 Configuration

### Environment Variables
```env
# Required
PRICE_API_URL=https://paycrypt-margin-price.onrender.com

# Chain RPCs (at least one required)
BASE_RPC_URL=https://mainnet.base.org
LISK_RPC_URL=https://rpc.api.lisk.com
CELO_RPC_URL=https://forno.celo.org
```

### Dependencies Added
```json
{
  "axios": "^1.6.2"
}
```

## 📝 Key Features

### ✅ Multi-Chain
- Tracks volume across Base, Lisk, and Celo
- Separate calculations per chain
- Aggregates to single total

### ✅ Multi-Token
- Supports all tokens returned by `getSupportedTokens()`
- Recognizes: USDT, USDC, SEND, cUSD, CELO, BTC, ETH, etc.
- Easy to add new tokens

### ✅ Real-Time Conversion
- Fetches live prices from PayCrypt Price API
- Converts to both USD and NGN
- 1-minute price cache for efficiency

### ✅ Historical Data
- Snapshots every 15 minutes
- Query by time interval (3h, 12h, 24h)
- Perfect for chart visualization

### ✅ Error Handling
- Graceful failure for unavailable tokens
- Falls back to cached prices on API errors
- Continues with other chains if one fails

## 📈 Data Structure

### Volume Snapshot
```javascript
{
  totalVolumeUSD: 1234567.89,
  totalVolumeNGN: 1901234567.89,
  tokenBreakdown: [
    {
      chainId: 8453,                    // Base
      tokenAddress: "0x123...",
      tokenName: "USD Coin",
      tokenSymbol: "usdc",
      totalVolume: "1000000000000000000", // Raw wei value
      volumeUSD: 500000.00,
      volumeNGN: 770000000.00,
      priceUSD: 1.00,
      priceNGN: 1540.00
    },
    // ... more tokens
  ],
  timestamp: "2024-12-05T12:00:00.000Z"
}
```

## 🚀 Deployment

### Install Dependencies
```bash
npm install
```

### Run Migration (if needed)
```bash
node migrate-multichain.js
```

### Start Server
```bash
npm start
```

### Verify
```bash
# Check volume endpoint
curl http://localhost:5000/api/volume/latest

# Should return volume data or 404 if no data yet
# If 404, trigger first sync:
curl http://localhost:5000/api/volume/total
```

## 📊 Monitoring

### Check Sync Status
```bash
# View logs
# Look for:
💰 Starting total volume sync...
✅ Total volume sync completed
💰 Total: $X USD / ₦Y NGN
```

### Database
```javascript
// Check volume snapshots
db.totalvolumes.find().sort({ timestamp: -1 }).limit(1)

// Count snapshots
db.totalvolumes.count()

// Should have 1 snapshot every 15 minutes
```

## 🎨 Frontend Integration Tips

### 1. Use `/latest` for Frequent Updates
```javascript
// Poll every minute
setInterval(() => {
  fetch('/api/volume/latest')
    .then(res => res.json())
    .then(data => updateUI(data));
}, 60000);
```

### 2. Cache on Frontend
```javascript
const cache = { data: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getVolume() {
  if (cache.data && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }
  
  const response = await fetch('/api/volume/latest');
  cache.data = await response.json();
  cache.timestamp = Date.now();
  return cache.data;
}
```

### 3. Handle Loading States
```jsx
function VolumeDisplay() {
  const [volume, setVolume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/volume/latest')
      .then(res => res.json())
      .then(data => {
        setVolume(data.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  
  return (
    <div>
      <h2>${volume.totalVolumeUSD}</h2>
      <p>₦{volume.totalVolumeNGN}</p>
    </div>
  );
}
```

## 🐛 Troubleshooting

### No volume data showing
1. Check if cron jobs are running
2. Manually trigger: `curl /api/volume/total`
3. Check logs for errors
4. Verify smart contracts are initialized

### Prices not updating
1. Test price API: `curl https://paycrypt-margin-price.onrender.com/health`
2. Check `PRICE_API_URL` in .env
3. Review logs for price fetch errors

### Chart data incomplete
1. Ensure cron has been running for full interval
2. Check database: `db.totalvolumes.count()`
3. Verify cron frequency (every 15 minutes)

## 📚 Documentation

- **Full API Docs**: [VOLUME_API_DOCS.md](VOLUME_API_DOCS.md)
- **Multi-Chain Guide**: [MULTI_CHAIN_SUMMARY.md](MULTI_CHAIN_SUMMARY.md)
- **Quick Reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

## ✨ Summary

**4 New Endpoints** for total volume tracking:
- `/api/volume/total` - Current total (real-time)
- `/api/volume/latest` - Latest cached (fast)
- `/api/volume/chart` - Time-series for graphs
- `/api/volume/by-chain` - Chain breakdown

**Automatic updates** every 15 minutes

**Multi-chain support** - Base, Lisk, Celo

**Currency conversion** - USD and NGN

Ready to use in your frontend! 🚀
