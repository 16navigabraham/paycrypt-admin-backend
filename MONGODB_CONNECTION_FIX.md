# MongoDB Connection & Rate Limiting Fixes

## Issues Identified

### 1. MongoDB Connection Timing
**Problem:** Cron jobs were attempting to run before MongoDB connection was fully established and stabilized.

**Symptoms:**
```
MongoNotConnectedError: Client must be connected before running operations
```

**Root Cause:** 
- Cron jobs started immediately on server startup
- Initial sync ran after only 30 seconds
- MongoDB connection pooling needs time to establish and stabilize
- No connection state checks before running database operations

### 2. API Rate Limiting
**Problem:** Both primary price API and CoinGecko fallback were being rate-limited.

**Symptoms:**
```
Request failed with status code 429 (Too Many Requests)
All price APIs failed and no cache available
```

**Root Cause:**
- 10-second rate limiting was too aggressive for production loads
- 5-minute cache expiry too short
- No separate rate limiting for CoinGecko fallback
- Multiple cron jobs hitting APIs simultaneously

## Solutions Implemented

### 1. MongoDB Connection State Checks

**Added Helper Function:**
```javascript
const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};
```

**Cron Job Protection:**
- Every cron job now checks `isMongoConnected()` before running
- Skips sync operations if MongoDB is not connected
- Logs warnings instead of crashing

**Benefits:**
- ✅ Prevents "Client must be connected" errors
- ✅ Graceful handling of temporary disconnections
- ✅ Clear logging of skipped operations

### 2. Increased Initial Sync Delay

**Changed from 30 seconds to 2 minutes:**
```javascript
setTimeout(() => {
  if (!isMongoConnected()) {
    console.warn('⚠️  Skipping initial sync - MongoDB not connected yet');
    return;
  }
  // ... run syncs
}, 120000); // 2 minutes
```

**Why 2 minutes?**
- Allows MongoDB connection pooling to fully establish (maxPoolSize: 10)
- Gives time for database indexes to load
- Ensures migration completes successfully
- Provides buffer for Render's container startup

### 3. Enhanced Rate Limiting

**Primary API Rate Limiting:**
- Increased from 10 seconds to **60 seconds** between calls
- Increased cache expiry from 5 minutes to **10 minutes**

**CoinGecko Fallback Protection:**
- Added separate rate limiting: **2 minutes** between CoinGecko calls
- Prevents immediate fallback spam
- Reduces likelihood of hitting CoinGecko's rate limits

```javascript
this.cacheExpiry = 600000; // 10 minute cache
this.minTimeBetweenCalls = 60000; // 60 seconds between primary API calls
this.coinGeckoMinDelay = 120000; // 2 minutes between CoinGecko calls
```

**Cache Strategy:**
```
1. Try cached prices (10-minute validity)
2. If cache expired, wait 60s since last call, then try primary API
3. If primary fails, try cache (even if expired)
4. If no cache, wait 2 minutes since last CoinGecko call, then try CoinGecko
5. If CoinGecko succeeds, cache results
6. If all fail, use stale cache as last resort
7. Only throw error if no cache exists at all
```

### 4. Staggered Sync Operations

**Initial Sync Timing:**
```javascript
syncContractMetrics();           // T+0s
setTimeout(syncOrderHistory, 5000);   // T+5s
setTimeout(syncTotalVolume, 10000);   // T+10s
```

**Benefits:**
- Prevents simultaneous API calls
- Spreads database load
- Reduces chance of rate limiting
- Better error isolation

## Configuration Summary

| Setting | Old Value | New Value | Reason |
|---------|-----------|-----------|--------|
| Cache Expiry | 5 minutes | 10 minutes | Reduce API calls |
| Primary API Rate Limit | 10 seconds | 60 seconds | Avoid 429 errors |
| CoinGecko Rate Limit | None | 2 minutes | Avoid CoinGecko 429 |
| Initial Sync Delay | 30 seconds | 2 minutes | MongoDB stability |
| Connection Checks | None | Before each sync | Prevent crashes |

## Expected Behavior

### Startup Sequence
```
1. Server starts
2. MongoDB connects (with pooling)
3. Migration runs
4. Contract service initializes
5. Cron jobs schedule (but don't run yet)
6. Server listens on port
7. [2 minutes pass]
8. isMongoConnected() check passes
9. Initial sync begins (staggered)
```

### During Operation
```
Every 30 minutes:
- Check MongoDB connection
- If connected: sync metrics
- Wait 60s minimum between API calls
- Use 10-minute cache when possible

Every 3 hours:
- Check MongoDB connection
- If connected: sync volume
- Fallback to CoinGecko only if needed (2-min delay)
- Use stale cache if all APIs fail
```

## Monitoring

### Successful Operation
Look for these log messages:
```
✅ MongoDB connected successfully
✅ Database migrations completed
⏰ Running 30-minute metrics sync...
💰 Using cached prices (cache valid)
✅ Contract metrics fetched for Base
```

### Warning Signs (Non-Critical)
```
⚠️  Skipping metrics sync - MongoDB not connected
⚠️  Using cached prices due to API error
⏳ Rate limiting: waiting 45s before API call
```

### Critical Errors (Should Not Occur)
```
❌ MongoNotConnectedError: Client must be connected
❌ All price APIs failed and no cache available
```

## Deployment Instructions

1. **Commit and push changes:**
```bash
git add server.js services/priceService.js MONGODB_CONNECTION_FIX.md
git commit -m "Fix: MongoDB connection timing and aggressive rate limiting"
git push origin main
```

2. **Monitor Render logs after deployment:**
   - Wait for "MongoDB connected successfully"
   - Wait 2 minutes for initial sync
   - Check for successful metrics/order syncs
   - Verify no 429 or connection errors

3. **If issues persist:**
   - Check MongoDB connection string
   - Verify environment variables (MONGODB_URI, PRICE_API_URL)
   - Consider increasing rate limits further if still hitting 429
   - Check Render free tier limitations

## Trade-offs

### Slower Data Updates
- **Before:** 5-minute cache, 10s rate limit → More API calls, fresher data
- **After:** 10-minute cache, 60s rate limit → Fewer API calls, slightly stale data
- **Justification:** Reliability > Freshness; 10-minute old prices acceptable for volume tracking

### Delayed Startup
- **Before:** 30-second initial sync
- **After:** 2-minute initial sync
- **Justification:** Prevents crashes, ensures stable connection, one-time delay

### Reduced API Usage
- **Before:** Frequent API calls, risking rate limits
- **After:** Conservative rate limiting, better reliability
- **Justification:** Free-tier APIs have strict limits; cache-first approach more sustainable

## Future Improvements

1. **Implement exponential backoff** for API retries
2. **Add health check endpoint** that includes MongoDB connection state
3. **Store price history** in database to reduce API dependency
4. **Add Prometheus metrics** for monitoring API call rates and cache hit rates
5. **Consider paid API tier** if higher refresh rates needed
6. **Add circuit breaker pattern** for failing APIs

## Testing

### Local Testing
```bash
# Set environment variables
export MONGODB_URI="your_mongo_uri"
export NODE_ENV="production"
export ENABLE_CRON="true"

# Start server
npm start

# Watch for:
# - Connection success after 2 minutes
# - No MongoNotConnectedError
# - Successful API calls with rate limiting logs
```

### Production Testing
1. Deploy to Render
2. Monitor logs for 5 minutes
3. Verify no errors after 2-minute mark
4. Check `/api/stats` endpoint responds
5. Verify `/api/volume/chart` returns data (may use cached prices)

## Contact

If issues persist after these fixes:
1. Share full Render logs (last 500 lines)
2. Check MongoDB Atlas connection limits
3. Verify Render free tier isn't hitting resource limits
4. Consider upgrading to paid Render tier for better stability
