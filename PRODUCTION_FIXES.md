# Production Issues - Fixes Applied

## Issues Identified

### 1. Duplicate Key Error (SyncStatus Collection)

**Error:**
```
MongoServerError: E11000 duplicate key error collection: test.syncstatuses 
index: syncType_1 dup key: { syncType: "metrics" }
```

**Root Cause:**
- Old unique index on `syncType` field alone
- Multi-chain support requires compound index `syncType + chainId`
- Multiple chains trying to create sync status with same `syncType` violates old index

**Fix Applied:**
- ✅ Created migration script: `migrations/fix-syncstatus-index.js`
- ✅ Script removes old index and ensures correct compound index
- ✅ Automatically cleans up duplicate documents

**Action Required:**
```bash
# Stop your application first
# Then run:
node migrations/fix-syncstatus-index.js

# Restart your application after successful migration
```

---

### 2. Rate Limiting (429 Too Many Requests)

**Error:**
```
❌ Error fetching prices from API: Request failed with status code 429
```

**Root Cause:**
- Price API being called too frequently (every 15 minutes per chain)
- 1-minute cache was too short
- No rate limiting between concurrent calls

**Fixes Applied:**

✅ **Increased cache duration:**
- Changed from 1 minute to **5 minutes**
- Reduces API calls by 5x

✅ **Added aggressive caching:**
- Returns cached data immediately if still valid
- Prevents unnecessary API calls

✅ **Added rate limiting protection:**
- Minimum 10 seconds between API calls
- Automatic waiting when calls too frequent
- Prevents concurrent calls from overwhelming API

✅ **Better error handling:**
- Falls back to cached prices on API errors
- Continues operation even if price API is down

**Changes in:** `services/priceService.js`

---

## How to Deploy Fixes

### Step 1: Run Migration (One-time)

```bash
# Connect to your Render shell or run locally pointing to production DB
node migrations/fix-syncstatus-index.js
```

**Expected Output:**
```
🚀 Starting SyncStatus index migration...
✅ Connected to MongoDB
⚠️  Found old syncType_1 index (without chainId)
✅ Successfully dropped old index
✅ Compound index ensured
✅ No duplicate documents found
🎉 Migration completed successfully!
```

### Step 2: Deploy Updated Code

The following files were updated:
- ✅ `config/contract.js` - Added complete ABI with token functions
- ✅ `services/priceService.js` - Added rate limiting and caching
- ✅ `migrations/fix-syncstatus-index.js` - New migration script

**Deploy to Render:**
```bash
git add .
git commit -m "Fix: SyncStatus duplicate key error and rate limiting"
git push origin main
```

Render will automatically detect changes and redeploy.

---

## Verification After Deployment

### 1. Check Logs for Successful Migration

Look for:
```
✅ Connected to MongoDB
✅ Contract service initialized for Base (8453)
✅ Contract service initialized for Lisk (1135)
✅ Contract service initialized for Celo (42220)
```

### 2. Verify No More Errors

Should NOT see:
- ❌ `E11000 duplicate key error`
- ❌ `Request failed with status code 429`

Should see:
- ✅ `Successfully processed X orders for Base/Lisk/Celo`
- ✅ `Found X supported tokens on Base/Lisk/Celo`
- 💰 `Using cached prices (cache valid)` (most of the time)

### 3. Test API Endpoints

```bash
# Test volume endpoint
curl https://your-api.com/api/volume/total

# Test orders endpoint
curl https://your-api.com/api/orders?chainId=8453&limit=10

# Test analytics endpoint
curl https://your-api.com/api/order-analytics/summary?range=24h
```

---

## Prevention Measures

### Cache Strategy
- **Price cache:** 5 minutes (prevents rate limiting)
- **Rate limiting:** Minimum 10 seconds between API calls
- **Fallback:** Uses cached prices on API errors

### Database Indexes
- **SyncStatus:** Compound unique index on `(syncType, chainId)`
- **Orders:** Compound indexes for efficient multi-chain queries
- **ContractMetrics:** Indexed by chainId and timestamp

### Monitoring Recommendations

1. **Set up alerts for:**
   - Database duplicate key errors
   - Rate limiting errors (429)
   - Failed sync jobs

2. **Monitor metrics:**
   - API response times
   - Cache hit rates
   - Sync job success rates
   - Price API availability

---

## Rollback Plan (If Needed)

If issues persist after deployment:

### Option 1: Revert Code
```bash
git revert HEAD
git push origin main
```

### Option 2: Manual Index Fix
```javascript
// Connect to MongoDB and run:
db.syncstatuses.dropIndex("syncType_1");
db.syncstatuses.createIndex(
  { syncType: 1, chainId: 1 }, 
  { unique: true }
);
```

### Option 3: Clear Duplicates Manually
```javascript
// Delete all sync status documents and let them recreate
db.syncstatuses.deleteMany({});
```

---

## Support

If you encounter any issues:

1. Check Render logs for specific error messages
2. Review migration output
3. Verify environment variables are set correctly
4. Check MongoDB connection and indexes

**Key Environment Variables:**
```env
MONGODB_URI=mongodb+srv://...
BASE_RPC_URL=https://...
LISK_RPC_URL=https://...
CELO_RPC_URL=https://...
PRICE_API_URL=https://paycrypt-margin-price.onrender.com
```
