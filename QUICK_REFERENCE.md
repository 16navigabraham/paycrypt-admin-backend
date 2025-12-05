# Multi-Chain Quick Reference

## 🔗 Supported Chains

| Chain | Chain ID | Contract Address |
|-------|----------|------------------|
| Base  | 8453     | `0x0574A0941Ca659D01CF7370E37492bd2DF43128d` |
| Lisk  | 1135     | `0x7Ca0a469164655AF07d27cf4bdA5e77F36Ab820A` |
| Celo  | 42220    | `0xBC955DC38a13c2Cd8736DA1bC791514504202F9D` |

## 🚀 Quick Setup

### 1. Configure Chains
```bash
# .env file
BASE_RPC_URL=https://mainnet.base.org
LISK_RPC_URL=https://rpc.api.lisk.com
CELO_RPC_URL=https://forno.celo.org
```

### 2. Migrate Database (if updating existing deployment)
```bash
node migrate-multichain.js
```

### 3. Start Server
```bash
npm start
```

## 📡 API Endpoints

### Stats
```bash
# All chains
GET /api/stats

# Specific chain
GET /api/stats?chainId=8453

# Historical data
GET /api/stats?range=24h&chainId=8453

# List active chains
GET /api/stats/chains
```

### Orders
```bash
# All chains
GET /api/orders

# Specific chain
GET /api/orders?chainId=8453

# Filter by user and chain
GET /api/orders?user=0x123...&chainId=1135

# Filter by token and chain
GET /api/orders?token=0xabc...&chainId=42220
```

## 💻 Code Examples

### Using Contract Service
```javascript
const contractService = require('./services/contractService');

// Get metrics for specific chain
const baseMetrics = await contractService.getContractMetrics(8453);
const liskMetrics = await contractService.getContractMetrics(1135);

// Get metrics for all chains
const allMetrics = await contractService.getAllContractMetrics();

// Get orders from specific chain
const baseOrders = await contractService.getOrderCreatedEvents(8453, 0, 'latest');

// Get enabled chains
const chainIds = contractService.getEnabledChainIds(); // [8453, 1135, 42220]
const chains = contractService.getAllChains();
```

### Querying Database
```javascript
const Order = require('./models/Order');

// Get orders from specific chain
const baseOrders = await Order.find({ chainId: 8453 });

// Get orders across all chains
const allOrders = await Order.find({}).sort({ timestamp: -1 });

// Get recent orders by chain
const recentBase = await Order.getRecentOrders(10, 8453);
const recentLisk = await Order.getRecentOrders(10, 1135);

// Get user orders on specific chain
const userOrders = await Order.getOrdersByUser('0x123...', 50, 8453);
```

### Sync Status
```javascript
const SyncStatus = require('./models/SyncStatus');

// Get sync status for specific chain
const baseSyncMetrics = await SyncStatus.getOrCreate('metrics', 8453);
const liskSyncOrders = await SyncStatus.getOrCreate('orders', 1135);

// Get all sync statuses
const allMetricsSync = await SyncStatus.find({ syncType: 'metrics' });
const allOrdersSync = await SyncStatus.find({ syncType: 'orders' });
```

## 🔧 Configuration Functions

```javascript
const { 
  CONTRACTS,
  getContractByChainId,
  getContractAddress,
  getExplorerUrl,
  getEnabledChains 
} = require('./config/contract');

// Get contract info
const baseConfig = getContractByChainId(8453);
// { chainId: 8453, name: 'Base', address: '0x...', explorer: 'https://basescan.org', rpcUrl: '...' }

// Get contract address
const liskAddress = getContractAddress(1135); // '0x7Ca0a469164655AF07d27cf4bdA5e77F36Ab820A'

// Get explorer URL
const celoExplorer = getExplorerUrl(42220); // 'https://celoscan.io'

// Get all enabled chains
const enabledChains = getEnabledChains();
// [{ key: 'base', chainId: 8453, ... }, { key: 'lisk', chainId: 1135, ... }]
```

## 🗄️ Database Schema

### Order Document
```javascript
{
  orderId: "123",
  chainId: 8453,  // Base chain
  requestId: "0xabc...",
  userWallet: "0x123...",
  tokenAddress: "0xdef...",
  amount: "1000000000000000000",
  txnHash: "0x456...",
  blockNumber: 12345678,
  timestamp: ISODate("2024-12-05T10:30:00.000Z")
}
```

### ContractMetrics Document
```javascript
{
  chainId: 8453,
  orderCount: "100",
  totalVolume: "50000000000000000000",
  successfulOrders: "95",
  failedOrders: "5",
  timestamp: ISODate("2024-12-05T11:00:00.000Z")
}
```

### SyncStatus Document
```javascript
{
  syncType: "orders",
  chainId: 8453,
  lastSyncBlock: 12345678,
  lastSyncTimestamp: ISODate("2024-12-05T11:00:00.000Z"),
  isRunning: false,
  lastError: null,
  successCount: 50,
  errorCount: 2
}
```

## 🎨 Frontend Integration Examples

### React Component
```jsx
function ChainSelector() {
  const [chains, setChains] = useState([]);
  const [selectedChain, setSelectedChain] = useState(null);

  useEffect(() => {
    fetch('/api/stats/chains')
      .then(res => res.json())
      .then(data => setChains(data.chains));
  }, []);

  return (
    <select onChange={e => setSelectedChain(e.target.value)}>
      <option value="">All Chains</option>
      {chains.map(chain => (
        <option key={chain.chainId} value={chain.chainId}>
          {chain.name} (Chain {chain.chainId})
        </option>
      ))}
    </select>
  );
}
```

### Fetch Orders by Chain
```javascript
async function fetchOrders(chainId = null) {
  const url = chainId 
    ? `/api/orders?chainId=${chainId}`
    : '/api/orders';
  
  const response = await fetch(url);
  const data = await response.json();
  return data.orders;
}
```

### Fetch Stats by Chain
```javascript
async function fetchStats(chainId = null, range = null) {
  const params = new URLSearchParams();
  if (chainId) params.append('chainId', chainId);
  if (range) params.append('range', range);
  
  const url = `/api/stats?${params}`;
  const response = await fetch(url);
  return await response.json();
}
```

## 🧪 Testing

### Test Chain Initialization
```bash
# Start server and check logs
npm start

# Should see:
# 🔗 Initializing multi-chain contract service...
# 🔗 Initializing Base (chainId: 8453)...
# ✅ Base initialized successfully
# 🔗 Initializing Lisk (chainId: 1135)...
# ✅ Lisk initialized successfully
# ...
```

### Test API Endpoints
```bash
# Get all chains
curl http://localhost:5000/api/stats/chains

# Get Base stats
curl http://localhost:5000/api/stats?chainId=8453

# Get Lisk orders
curl http://localhost:5000/api/orders?chainId=1135
```

### Test Database Queries
```bash
# Connect to MongoDB
mongo paycrypt-admin

# Check orders by chain
db.orders.countDocuments({ chainId: 8453 })  # Base orders
db.orders.countDocuments({ chainId: 1135 })  # Lisk orders

# Check metrics by chain
db.contractmetrics.find({ chainId: 8453 }).limit(1)

# Check sync status
db.syncstatuses.find()
```

## ⚠️ Common Issues

### Chain not initializing?
- Verify RPC URL in `.env`
- Check network connectivity
- Review server logs for errors

### No data for a chain?
- Check sync status: `db.syncstatuses.find({ chainId: YOUR_CHAIN_ID })`
- Verify contract address is correct
- Check RPC endpoint is responding

### Duplicate key errors?
- Run migration script: `node migrate-multichain.js`
- Ensure indexes are correct
- Check `chainId` is included in queries

## 📚 Related Files

- `config/contract.js` - Chain configurations
- `services/contractService.js` - Multi-chain service
- `jobs/cronJobs.js` - Sync logic
- `models/Order.js` - Order schema
- `models/ContractMetrics.js` - Metrics schema
- `models/SyncStatus.js` - Sync tracking
- `MIGRATION_GUIDE.md` - Detailed migration instructions
- `MULTI_CHAIN_SUMMARY.md` - Complete implementation summary
