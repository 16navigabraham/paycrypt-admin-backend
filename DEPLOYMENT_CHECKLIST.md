# Multi-Chain Deployment Checklist

## 📋 Pre-Deployment

### 1. Environment Variables
- [ ] `MONGODB_URI` configured
- [ ] `JWT_SECRET` set (64+ characters)
- [ ] `BASE_RPC_URL` configured
- [ ] `LISK_RPC_URL` configured (optional)
- [ ] `CELO_RPC_URL` configured (optional)
- [ ] `RPC_URL` set as Base fallback
- [ ] Admin credentials configured

### 2. Database Preparation

**For New Deployments:**
- [ ] MongoDB instance ready
- [ ] Connection string tested
- [ ] No migration needed

**For Existing Deployments:**
- [ ] Database backup created
- [ ] Migration script ready (`migrate-multichain.js`)
- [ ] Test migration on staging first

### 3. Code Verification
- [ ] Latest code pulled from repository
- [ ] Dependencies installed (`npm install`)
- [ ] No syntax errors (`npm run lint` if available)
- [ ] Contract addresses verified in `config/contract.js`

## 🚀 Deployment Steps

### Step 1: Update Environment Variables
```bash
# Add to your .env or hosting platform
BASE_RPC_URL=https://mainnet.base.org
LISK_RPC_URL=https://rpc.api.lisk.com
CELO_RPC_URL=https://forno.celo.org
```

### Step 2: Run Migration (Existing Deployments Only)
```bash
# Backup database first!
mongodump --uri="your-mongodb-uri" --out=./backup

# Run migration
node migrate-multichain.js

# Verify migration
# Check that chainId field exists in documents
```

### Step 3: Deploy Application
```bash
# Install dependencies
npm install

# Start application
npm start
```

### Step 4: Verify Deployment
- [ ] Server starts without errors
- [ ] All chains initialized (check logs)
- [ ] Health check passes: `GET /health`
- [ ] Chains endpoint works: `GET /api/stats/chains`

## ✅ Post-Deployment Verification

### 1. Check Chain Initialization
**Expected logs:**
```
🔗 Initializing multi-chain contract service...
🔗 Initializing Base (chainId: 8453)...
✅ Base initialized successfully
🔗 Initializing Lisk (chainId: 1135)...
✅ Lisk initialized successfully
🔗 Initializing Celo (chainId: 42220)...
✅ Celo initialized successfully
✅ Contract service initialized with 3 chain(s)
```

### 2. Test API Endpoints
```bash
# Test chains endpoint
curl https://your-domain.com/api/stats/chains
# Should return array of active chains

# Test stats for each chain
curl https://your-domain.com/api/stats?chainId=8453
curl https://your-domain.com/api/stats?chainId=1135
curl https://your-domain.com/api/stats?chainId=42220

# Test orders endpoint
curl https://your-domain.com/api/orders?chainId=8453
```

### 3. Verify Data Syncing
```bash
# Check sync status for each chain
# Connect to MongoDB and run:
db.syncstatuses.find().pretty()

# Should see entries like:
# { syncType: "metrics", chainId: 8453, lastSyncBlock: XXX, ... }
# { syncType: "metrics", chainId: 1135, lastSyncBlock: XXX, ... }
# { syncType: "orders", chainId: 8453, lastSyncBlock: XXX, ... }
# etc.
```

### 4. Check Database Indexes
```javascript
// Connect to MongoDB
db.orders.getIndexes()
// Should include:
// - { chainId: 1, orderId: 1 } unique
// - { chainId: 1, txnHash: 1 } unique
// - { chainId: 1, timestamp: -1 }

db.contractmetrics.getIndexes()
// Should include:
// - { chainId: 1, timestamp: -1 }

db.syncstatuses.getIndexes()
// Should include:
// - { syncType: 1, chainId: 1 } unique
```

### 5. Monitor Initial Sync
**Watch for:**
- [ ] Metrics sync starting for all chains
- [ ] Orders sync starting for all chains
- [ ] No repeated errors in logs
- [ ] Block numbers increasing

**Check logs for:**
```
📊 Starting contract metrics sync for all chains...
🔗 Syncing metrics for 3 chain(s): 8453, 1135, 42220
📊 Starting contract metrics sync for chainId 8453...
✅ Contract metrics sync completed for chainId 8453
```

## 🔍 Troubleshooting

### Chain Not Initializing
**Symptoms:**
- Missing from initialized chains list
- No data syncing for that chain

**Solutions:**
1. Check RPC URL is correct in environment
2. Verify RPC endpoint is accessible
3. Check logs for specific error messages
4. Test RPC URL manually: `curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' YOUR_RPC_URL`

### Database Migration Errors
**Symptoms:**
- Duplicate key errors
- Missing chainId fields

**Solutions:**
1. Restore from backup
2. Check migration script ran successfully
3. Manually verify indexes: `db.orders.getIndexes()`
4. Re-run migration if needed

### Sync Not Working
**Symptoms:**
- `lastSyncBlock` not increasing
- `isRunning: true` stuck
- No new data in database

**Solutions:**
1. Check cron jobs are running
2. Review error logs for specific chain
3. Verify contract addresses are correct
4. Check RPC rate limits not exceeded
5. Restart sync manually if stuck:
```javascript
// In MongoDB shell
db.syncstatuses.updateMany(
  { isRunning: true },
  { $set: { isRunning: false } }
)
```

### Performance Issues
**Symptoms:**
- Slow API responses
- High memory usage
- Sync taking too long

**Solutions:**
1. Check MongoDB indexes are created
2. Reduce batch size in sync jobs (10000 → 5000)
3. Add delays between RPC calls
4. Consider using paid RPC endpoints
5. Scale horizontally if needed

## 📊 Monitoring

### Key Metrics to Watch
- [ ] API response times
- [ ] Sync status per chain
- [ ] Error counts in sync status
- [ ] Database size
- [ ] RPC call success rates
- [ ] Memory usage

### Recommended Monitoring Tools
- **Application:** PM2, New Relic, or Datadog
- **Database:** MongoDB Atlas monitoring
- **Infrastructure:** Render dashboard, CloudWatch, etc.
- **Logs:** Papertrail, Loggly, or similar

### Alert Thresholds
- Sync status `isRunning: true` for > 1 hour
- Error count increasing rapidly
- API response time > 5 seconds
- No new orders for > 2 hours (per active chain)
- Database connection errors

## 🎯 Success Criteria

### Deployment is successful when:
- ✅ All configured chains initialize successfully
- ✅ API endpoints return data from all chains
- ✅ Sync jobs run without errors
- ✅ Database indexes created correctly
- ✅ No duplicate key errors
- ✅ Frontend can fetch multi-chain data
- ✅ Historical data queryable per chain
- ✅ New orders appear in database within 12 hours

## 📝 Rollback Plan

### If deployment fails:

1. **Restore Database** (if migration was run):
```bash
mongorestore --uri="your-mongodb-uri" ./backup
```

2. **Revert Code:**
```bash
git revert HEAD  # or git checkout previous-stable-tag
npm install
```

3. **Remove New Environment Variables:**
- Remove `LISK_RPC_URL`
- Remove `CELO_RPC_URL`
- Keep only `BASE_RPC_URL` or `RPC_URL`

4. **Restart Application:**
```bash
npm start
```

5. **Verify Single-Chain Operation:**
- Check only Base chain is active
- Confirm existing functionality works

## 🔐 Security Checklist

- [ ] Environment variables secured (not in code)
- [ ] MongoDB connection uses authentication
- [ ] API rate limiting enabled
- [ ] CORS configured correctly
- [ ] JWT secret is strong and unique
- [ ] Admin credentials are strong
- [ ] HTTPS enabled in production
- [ ] RPC endpoints use HTTPS
- [ ] Logs don't expose sensitive data

## 📞 Support Contacts

**Before deploying, ensure you have:**
- [ ] Access to hosting platform dashboard
- [ ] MongoDB admin access
- [ ] Contact for RPC endpoint provider
- [ ] Backup/restore procedures documented
- [ ] Team members notified of deployment

## 📅 Post-Deployment Follow-up

**Within 24 hours:**
- [ ] Review logs for any errors
- [ ] Confirm all chains syncing properly
- [ ] Check database growth is reasonable
- [ ] Monitor API performance
- [ ] Verify frontend integration works

**Within 1 week:**
- [ ] Review sync efficiency
- [ ] Optimize any slow queries
- [ ] Document any issues encountered
- [ ] Update runbooks if needed
- [ ] Consider cost optimization

**Within 1 month:**
- [ ] Analyze multi-chain usage patterns
- [ ] Evaluate RPC endpoint performance
- [ ] Review and optimize sync schedules
- [ ] Plan for scaling if needed

---

## ✨ Deployment Complete!

Once all checklist items are complete and verified, your multi-chain deployment is ready for production use.

**Remember:**
- Keep monitoring for the first few days
- Document any custom configurations
- Update team documentation
- Celebrate the successful deployment! 🎉
