# Total Volume API Documentation

## Overview

The Total Volume API provides real-time and historical data about the total trading volume across all supported tokens on all chains (Base, Lisk, and Celo), converted to USD and NGN currencies.

## Features

- ✅ **Multi-Chain Support**: Aggregates volume from Base, Lisk, and Celo
- ✅ **Multi-Token Support**: Tracks all supported tokens on each chain
- ✅ **Real-Time Conversion**: Converts to USD and NGN using live prices
- ✅ **Historical Data**: Time-series data for charts (3h, 12h, 24h intervals)
- ✅ **Breakdown by Chain**: View volume distribution across blockchains
- ✅ **Token Details**: See volume contribution from each token
- ✅ **Automatic Updates**: Syncs every 15 minutes via cron job

## API Endpoints

### 1. Get Current Total Volume

**Endpoint:** `GET /api/volume/total`

**Description:** Fetches the current total volume across all tokens and chains, with live price conversion.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVolumeUSD": "1,234,567.89",
    "totalVolumeNGN": "1,901,234,567.89",
    "tokenCount": 8,
    "tokens": [
      {
        "chainId": 8453,
        "tokenAddress": "0x123...",
        "tokenName": "USD Coin",
        "tokenSymbol": "usdc",
        "totalVolume": "1000000000000000000",
        "volumeUSD": 500000.00,
        "volumeNGN": 770000000.00,
        "priceUSD": 1.00,
        "priceNGN": 1540.00
      }
      // ... more tokens
    ],
    "timestamp": "2024-12-05T12:00:00.000Z"
  }
}
```

**Use Case:** Display current total volume on dashboard

---

### 2. Get Latest Cached Volume

**Endpoint:** `GET /api/volume/latest`

**Description:** Returns the most recent cached volume data (fast response, no blockchain calls).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVolumeUSD": "1,234,567.89",
    "totalVolumeNGN": "1,901,234,567.89",
    "tokenCount": 8,
    "tokens": [...],
    "timestamp": "2024-12-05T11:45:00.000Z",
    "ageMinutes": "12.3"
  }
}
```

**Use Case:** Fast retrieval for frequent updates without blockchain calls

---

### 3. Get Volume Chart Data

**Endpoint:** `GET /api/volume/chart`

**Query Parameters:**
- `interval` (required): Time interval - `3h`, `12h`, or `24h`

**Example Request:**
```bash
GET /api/volume/chart?interval=24h
```

**Response:**
```json
{
  "success": true,
  "interval": "24h",
  "dataPoints": 96,
  "statistics": {
    "latestVolumeUSD": "1,234,567.89",
    "earliestVolumeUSD": "1,200,000.00",
    "changeUSD": "34,567.89",
    "changePercent": "2.88%",
    "minVolumeUSD": "1,180,000.00",
    "maxVolumeUSD": "1,250,000.00",
    "avgVolumeUSD": "1,215,000.00"
  },
  "data": [
    {
      "timestamp": "2024-12-04T12:00:00.000Z",
      "totalVolumeUSD": "1,200,000.00",
      "totalVolumeNGN": "1,848,000,000.00"
    },
    {
      "timestamp": "2024-12-04T12:15:00.000Z",
      "totalVolumeUSD": "1,205,000.00",
      "totalVolumeNGN": "1,855,700,000.00"
    }
    // ... more data points
  ]
}
```

**Use Case:** Feed data to frontend charts for volume trends

**Supported Intervals:**
- `3h` - Last 3 hours (data points every 15 minutes = ~12 points)
- `12h` - Last 12 hours (data points every 15 minutes = ~48 points)
- `24h` - Last 24 hours (data points every 15 minutes = ~96 points)

---

### 4. Get Volume by Chain

**Endpoint:** `GET /api/volume/by-chain`

**Description:** Breaks down total volume by blockchain (Base, Lisk, Celo).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVolumeUSD": "1,234,567.89",
    "totalVolumeNGN": "1,901,234,567.89",
    "byChain": [
      {
        "chainId": 8453,
        "volumeUSD": "800,000.00",
        "volumeNGN": "1,232,000,000.00",
        "tokenCount": 5,
        "tokens": [...]
      },
      {
        "chainId": 1135,
        "volumeUSD": "300,000.00",
        "volumeNGN": "462,000,000.00",
        "tokenCount": 2,
        "tokens": [...]
      },
      {
        "chainId": 42220,
        "volumeUSD": "134,567.89",
        "volumeNGN": "207,234,567.89",
        "tokenCount": 1,
        "tokens": [...]
      }
    ],
    "timestamp": "2024-12-05T12:00:00.000Z"
  }
}
```

**Use Case:** Display volume distribution across different blockchains

---

## Data Flow

```
┌─────────────────┐
│  Smart Contract │ (Base, Lisk, Celo)
│  getTokenDetails│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Contract Service│
│ Get token volumes│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Price Service  │
│ Convert to USD/NGN │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MongoDB Store  │
│ TotalVolume Model │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Volume API     │
│ Serve to Frontend │
└─────────────────┘
```

## Automatic Updates

The volume data is automatically updated every **15 minutes** by a cron job:

```javascript
// Runs every 15 minutes
cron.schedule('*/15 * * * *', syncTotalVolume);
```

This ensures:
- Fresh data without manual intervention
- Historical data for time-series analysis
- Efficient blockchain RPC usage

## Supported Tokens

The system automatically tracks all tokens returned by the smart contract's `getSupportedTokens()` function. Token prices are fetched from the PayCrypt Price API.

**Currently Supported Tokens:**
- USDT (Tether)
- USDC (USD Coin)
- SEND Token
- cUSD (Celo Dollar)
- CELO
- BTC
- ETH
- BNB
- ADA
- SOL
- MATIC
- LINK

## Price Conversion

Prices are fetched from: `https://paycrypt-margin-price.onrender.com`

**Features:**
- Cached prices (1-minute expiry)
- Automatic fallback to cache on API errors
- Batch price fetching for efficiency
- Support for NGN (with +20 NGN margin) and USD

## Frontend Integration Examples

### React - Display Total Volume

```jsx
import { useState, useEffect } from 'react';

function TotalVolume() {
  const [volume, setVolume] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVolume() {
      try {
        const response = await fetch('/api/volume/latest');
        const data = await response.json();
        setVolume(data.data);
      } catch (error) {
        console.error('Error fetching volume:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchVolume();
    // Refresh every 5 minutes
    const interval = setInterval(fetchVolume, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Total Trading Volume</h2>
      <p>${volume.totalVolumeUSD} USD</p>
      <p>₦{volume.totalVolumeNGN} NGN</p>
      <small>Updated {volume.ageMinutes} minutes ago</small>
    </div>
  );
}
```

### React - Volume Chart

```jsx
import { Line } from 'react-chartjs-2';
import { useState, useEffect } from 'react';

function VolumeChart({ interval = '24h' }) {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    async function fetchChartData() {
      const response = await fetch(`/api/volume/chart?interval=${interval}`);
      const data = await response.json();
      
      setChartData({
        labels: data.data.map(d => new Date(d.timestamp).toLocaleTimeString()),
        datasets: [
          {
            label: 'Volume (USD)',
            data: data.data.map(d => parseFloat(d.totalVolumeUSD.replace(/,/g, ''))),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }
        ]
      });
    }

    fetchChartData();
  }, [interval]);

  if (!chartData) return <div>Loading chart...</div>;

  return <Line data={chartData} />;
}
```

### JavaScript - Simple Fetch

```javascript
// Get current volume
async function getCurrentVolume() {
  const response = await fetch('/api/volume/total');
  const data = await response.json();
  return data.data;
}

// Get 24h chart data
async function get24hChart() {
  const response = await fetch('/api/volume/chart?interval=24h');
  const data = await response.json();
  return data.data;
}

// Usage
const volume = await getCurrentVolume();
console.log(`Total Volume: $${volume.totalVolumeUSD}`);

const chartData = await get24hChart();
console.log(`${chartData.length} data points for chart`);
```

## Error Handling

### Common Errors

**1. No Volume Data Available**
```json
{
  "error": "No volume data available yet",
  "message": "Try calling /api/volume/total first to generate data"
}
```
**Solution:** Call `/api/volume/total` to trigger initial calculation

**2. Invalid Interval**
```json
{
  "error": "Invalid interval format. Use: 3h, 12h, or 24h"
}
```
**Solution:** Use supported interval formats

**3. Price API Unavailable**
```json
{
  "error": "Failed to fetch total volume",
  "message": "Error fetching prices from API"
}
```
**Solution:** Cached prices will be used if available; retry after a few minutes

## Performance Considerations

### Caching Strategy

1. **Database Cache**: Volume snapshots stored every 15 minutes
2. **Price Cache**: Token prices cached for 1 minute
3. **Use `/latest` endpoint**: For fast reads without blockchain calls

### Best Practices

1. **Use appropriate endpoints:**
   - `/latest` - For frequent polling (every minute)
   - `/total` - For manual refresh or first load
   - `/chart` - For time-series visualization

2. **Cache on frontend:**
   ```javascript
   // Cache for 5 minutes on frontend
   const CACHE_DURATION = 5 * 60 * 1000;
   ```

3. **Handle loading states:**
   ```javascript
   if (loading) return <Spinner />;
   if (error) return <ErrorMessage />;
   return <VolumeDisplay data={volume} />;
   ```

## Monitoring

### Key Metrics

- Volume sync frequency: Every 15 minutes
- Price cache expiry: 1 minute
- Supported tokens: Dynamic (from smart contract)
- Data retention: Unlimited (historical data)

### Logs to Monitor

```bash
# Successful sync
💰 Starting total volume sync...
✅ Total volume sync completed
💰 Total: $1,234,567.89 USD / ₦1,901,234,567.89 NGN

# Errors
❌ Error in total volume sync: <error message>
⚠️  No price data for token: <token name>
```

## Testing

### Manual Testing

```bash
# Test current volume
curl http://localhost:5000/api/volume/total

# Test latest cached
curl http://localhost:5000/api/volume/latest

# Test 24h chart
curl http://localhost:5000/api/volume/chart?interval=24h

# Test by-chain breakdown
curl http://localhost:5000/api/volume/by-chain
```

### Integration Testing

```javascript
describe('Volume API', () => {
  it('should return total volume', async () => {
    const response = await fetch('/api/volume/total');
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.totalVolumeUSD).toBeDefined();
    expect(data.data.totalVolumeNGN).toBeDefined();
  });
});
```

## Troubleshooting

### Issue: No volume data

**Symptoms:** API returns 404 or empty data

**Solutions:**
1. Check if cron jobs are running
2. Manually call `/api/volume/total` to trigger sync
3. Verify smart contracts are initialized
4. Check logs for sync errors

### Issue: Prices not updating

**Symptoms:** Volume values don't change or seem stale

**Solutions:**
1. Verify `PRICE_API_URL` in environment variables
2. Check price API is responding: `curl https://paycrypt-margin-price.onrender.com/health`
3. Check price cache expiry settings
4. Review logs for price fetch errors

### Issue: Chart data incomplete

**Symptoms:** Fewer data points than expected

**Solutions:**
1. Ensure cron job has been running for the full interval period
2. Check database for volume snapshots: `db.totalvolumes.count()`
3. Verify cron job frequency (should be every 15 minutes)

## Database Schema

```javascript
{
  _id: ObjectId,
  totalVolumeUSD: Number,      // Total volume in USD
  totalVolumeNGN: Number,      // Total volume in NGN
  tokenBreakdown: [            // Array of token contributions
    {
      chainId: Number,         // 8453, 1135, 42220
      tokenAddress: String,    // Contract address
      tokenName: String,       // e.g., "USD Coin"
      tokenSymbol: String,     // e.g., "usdc"
      totalVolume: String,     // Raw blockchain value
      volumeUSD: Number,       // Converted USD value
      volumeNGN: Number,       // Converted NGN value
      priceUSD: Number,        // Token price in USD
      priceNGN: Number         // Token price in NGN
    }
  ],
  timestamp: Date,             // When snapshot was taken
  createdAt: Date,
  updatedAt: Date
}
```

## Support

For issues or questions about the Volume API:
1. Check this documentation
2. Review server logs
3. Test price API connectivity
4. Verify smart contract calls are working
5. Contact the development team

---

**Version:** 2.0.0  
**Last Updated:** December 5, 2024
