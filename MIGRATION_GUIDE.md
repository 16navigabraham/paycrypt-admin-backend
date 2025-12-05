# Multi-Chain Migration Guide

This guide explains the changes made to support multiple blockchain networks (Base, Lisk, and Celo) and how to migrate your existing data.

## Overview of Changes

### 1. **Contract Configuration (`config/contract.js`)**
   - Added multi-chain contract configuration with addresses for Base, Lisk, and Celo
   - Added helper functions: `getContractByChainId()`, `getContractAddress()`, `getExplorerUrl()`, `getEnabledChains()`
   - Backward compatible - still exports `CONTRACT_ADDRESS` for Base chain

### 2. **Database Models**
   - **Order Model**: Added `chainId` field (default: 8453 for Base)
   - **ContractMetrics Model**: Added `chainId` field (default: 8453 for Base)
   - **SyncStatus Model**: Added `chainId` field to track sync status per chain
   - Updated indexes to support multi-chain queries

### 3. **ContractService (`services/contractService.js`)**
   - Complete refactor to support multiple chains simultaneously
   - Methods now require `chainId` parameter
   - New methods: `getEnabledChainIds()`, `getAllChains()`, `getAllContractMetrics()`
   - Initializes connections to all chains with configured RPC URLs

### 4. **Cron Jobs (`jobs/cronJobs.js`)**
   - Refactored to sync all enabled chains in parallel
   - New functions: `syncContractMetricsForChain()`, `syncOrderHistoryForChain()`
   - Updated `getSyncStatus()` to return status for all chains

## Environment Variables

Add the following RPC URLs to your `.env` file:

```env
# Base Chain (Required - default fallback)
BASE_RPC_URL=https://mainnet.base.org
RPC_URL=https://mainnet.base.org

# Lisk Chain (Optional)
LISK_RPC_URL=https://rpc.api.lisk.com

# Celo Chain (Optional)
CELO_RPC_URL=https://forno.celo.org
```

**Note:** Only chains with configured RPC URLs will be enabled and synced.

## Database Migration

### Option 1: Fresh Start (Recommended for Testing)
If you don't have critical existing data:

1. Drop the collections and let them rebuild:
```bash
# Connect to MongoDB
mongo paycrypt-admin

# Drop collections
db.orders.drop()
db.contractmetrics.drop()
db.syncstatuses.drop()

# Exit
exit
```

2. Restart the server - it will recreate collections with new schema

### Option 2: Migrate Existing Data

If you have existing data that you want to preserve:

```javascript
// Run this in MongoDB shell or create a migration script

// Update existing Orders to include chainId (Base = 8453)
db.orders.updateMany(
  { chainId: { $exists: false } },
  { $set: { chainId: 8453 } }
)

// Update existing ContractMetrics to include chainId
db.contractmetrics.updateMany(
  { chainId: { $exists: false } },
  { $set: { chainId: 8453 } }
)

// Update existing SyncStatus to include chainId
db.syncstatuses.updateMany(
  { chainId: { $exists: false } },
  { $set: { chainId: 8453 } }
)

// Rebuild indexes
db.orders.dropIndexes()
db.orders.createIndex({ "chainId": 1, "orderId": 1 }, { unique: true })
db.orders.createIndex({ "chainId": 1, "txnHash": 1 }, { unique: true })
db.orders.createIndex({ "chainId": 1, "timestamp": -1 })

db.contractmetrics.dropIndexes()
db.contractmetrics.createIndex({ "chainId": 1, "timestamp": -1 })

db.syncstatuses.dropIndexes()
db.syncstatuses.createIndex({ "syncType": 1, "chainId": 1 }, { unique: true })
```

### Option 3: Use MongoDB Migration Script

Save this as `migrate-multichain.js` and run with `node migrate-multichain.js`:

```javascript
const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Migrate Orders
    const ordersResult = await db.collection('orders').updateMany(
      { chainId: { $exists: false } },
      { $set: { chainId: 8453 } }
    );
    console.log(`Updated ${ordersResult.modifiedCount} orders`);
    
    // Migrate ContractMetrics
    const metricsResult = await db.collection('contractmetrics').updateMany(
      { chainId: { $exists: false } },
      { $set: { chainId: 8453 } }
    );
    console.log(`Updated ${metricsResult.modifiedCount} contract metrics`);
    
    // Migrate SyncStatus
    const syncResult = await db.collection('syncstatuses').updateMany(
      { chainId: { $exists: false } },
      { $set: { chainId: 8453 } }
    );
    console.log(`Updated ${syncResult.modifiedCount} sync statuses`);
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
```

## API Changes

### Routes That May Need Updates

If you have custom routes or API endpoints, you may need to update them to support the `chainId` parameter:

**Example - Orders Route:**
```javascript
// Before
router.get('/', async (req, res) => {
  const orders = await Order.getRecentOrders(10);
  res.json(orders);
});

// After - support optional chainId filter
router.get('/', async (req, res) => {
  const { chainId } = req.query;
  const orders = await Order.getRecentOrders(10, chainId ? parseInt(chainId) : null);
  res.json(orders);
});
```

**Example - Stats Route:**
```javascript
// You may want to add an endpoint to get stats for all chains
router.get('/all-chains', async (req, res) => {
  const metrics = await contractService.getAllContractMetrics();
  res.json(metrics);
});
```

## Testing

1. **Start the server:**
```bash
npm start
```

2. **Check enabled chains:**
```javascript
// The service will log which chains are initialized
// Look for: "✅ Contract service initialized with X chain(s)"
```

3. **Verify syncing:**
```bash
# Check logs for sync activity on each chain
# Should see: "📊 Starting contract metrics sync for chainId X..."
```

4. **Query multi-chain data:**
```javascript
// Get orders from a specific chain
const baseOrders = await Order.find({ chainId: 8453 });
const liskOrders = await Order.find({ chainId: 1135 });
const celoOrders = await Order.find({ chainId: 42220 });

// Get all orders across all chains
const allOrders = await Order.find({}).sort({ timestamp: -1 });
```

## Rollback Plan

If you need to rollback:

1. Checkout the previous commit
2. If you migrated data, remove chainId fields:
```javascript
db.orders.updateMany({}, { $unset: { chainId: "" } })
db.contractmetrics.updateMany({}, { $unset: { chainId: "" } })
db.syncstatuses.updateMany({}, { $unset: { chainId: "" } })
```

## Support

For issues or questions:
1. Check the logs for initialization errors
2. Verify RPC URLs are accessible
3. Ensure MongoDB indexes are properly created
4. Check that environment variables are correctly set

## Chain-Specific Information

### Base (chainId: 8453)
- **Explorer:** https://basescan.org
- **RPC:** https://mainnet.base.org
- **Contract:** 0x0574A0941Ca659D01CF7370E37492bd2DF43128d

### Lisk (chainId: 1135)
- **Explorer:** https://blockscout.lisk.com
- **RPC:** https://rpc.api.lisk.com
- **Contract:** 0x7Ca0a469164655AF07d27cf4bdA5e77F36Ab820A

### Celo (chainId: 42220)
- **Explorer:** https://celoscan.io
- **RPC:** https://forno.celo.org
- **Contract:** 0xBC955DC38a13c2Cd8736DA1bC791514504202F9D
