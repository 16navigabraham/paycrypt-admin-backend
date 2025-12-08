const contractService = require('../services/contractService');
const priceService = require('../services/priceService');
const ContractMetrics = require('../models/ContractMetrics');
const Order = require('../models/Order');
const SyncStatus = require('../models/SyncStatus');
const Admin = require('../models/Admin');
const TotalVolume = require('../models/TotalVolume');

// Sync contract metrics for a specific chain
async function syncContractMetricsForChain(chainId) {
  console.log(`📊 Starting contract metrics sync for chainId ${chainId}...`);
  
  let syncStatus;
  try {
    // Get or create sync status
    syncStatus = await SyncStatus.getOrCreate('metrics', chainId);
    
    // Check if already running
    if (syncStatus.isRunning) {
      console.log(`⚠️  Metrics sync for chainId ${chainId} already running, skipping...`);
      return;
    }
    
    // Mark as running
    await syncStatus.markAsRunning();
    
    // Check if contract service is initialized
    if (!contractService.isInitialized()) {
      throw new Error('Contract service not initialized');
    }
    
    // Fetch current metrics from contract
    const metrics = await contractService.getContractMetrics(chainId);
    
    // Save to database
    const contractMetrics = new ContractMetrics(metrics);
    await contractMetrics.save();
    
    // Update sync status
    const currentBlock = await contractService.getCurrentBlockNumber(chainId);
    await syncStatus.updateSync(currentBlock, true);
    
    console.log(`✅ Contract metrics sync completed for chainId ${chainId}`);
    console.log(`📈 Saved metrics: Orders: ${metrics.orderCount}, Volume: ${metrics.totalVolume}`);
    
  } catch (error) {
    console.error(`❌ Error in contract metrics sync for chainId ${chainId}:`, error);
    
    if (syncStatus) {
      await syncStatus.updateSync(0, false, error.message);
    }
  }
}

// Sync contract metrics for all chains (runs every hour)
async function syncContractMetrics() {
  console.log('📊 Starting contract metrics sync for all chains...');
  
  try {
    // Check if contract service is initialized
    if (!contractService.isInitialized()) {
      throw new Error('Contract service not initialized');
    }
    
    const chainIds = contractService.getEnabledChainIds();
    console.log(`🔗 Syncing metrics for ${chainIds.length} chain(s): ${chainIds.join(', ')}`);
    
    // Sync chains sequentially to avoid RPC rate limiting
    for (const chainId of chainIds) {
      await syncContractMetricsForChain(chainId);
    }
    
    console.log('✅ All chain metrics sync completed');
    
  } catch (error) {
    console.error('❌ Error in contract metrics sync:', error);
  }
}

// Sync order history for a specific chain
async function syncOrderHistoryForChain(chainId) {
  console.log(`📦 Starting order history sync for chainId ${chainId}...`);
  
  let syncStatus;
  try {
    // Get or create sync status
    syncStatus = await SyncStatus.getOrCreate('orders', chainId);
    
    // Check if already running
    if (syncStatus.isRunning) {
      console.log(`⚠️  Order sync for chainId ${chainId} already running, skipping...`);
      return;
    }
    
    // Mark as running
    await syncStatus.markAsRunning();
    
    // Check if contract service is initialized
    if (!contractService.isInitialized()) {
      throw new Error('Contract service not initialized');
    }
    
    // Get current block number
    const currentBlock = await contractService.getCurrentBlockNumber(chainId);
    
    // Determine starting block
    let fromBlock = syncStatus.lastSyncBlock || 0;
    
    // For initial sync, start from a reasonable block (e.g., contract deployment)
    if (fromBlock === 0) {
      // You can set this to your contract deployment block
      fromBlock = Math.max(0, currentBlock - 100000); // Start from 100k blocks ago
      console.log(`🚀 Initial sync for chainId ${chainId} starting from block ${fromBlock}`);
    }
    
    console.log(`🔍 Syncing orders for chainId ${chainId} from block ${fromBlock} to ${currentBlock}`);
    
    // Fetch order events in smaller batches to avoid missing events on slower RPC providers (especially Celo)
    // Using smaller batches ensures we get complete event logs even on rate-limited chains
    const batchSize = 5000; // Reduced batch size for better reliability on Celo
    let processedOrders = 0;
    
    for (let start = fromBlock; start <= currentBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, currentBlock);
      
      console.log(`📦 Processing blocks ${start} to ${end} for chainId ${chainId}...`);
      
      try {
        const orders = await contractService.getOrderCreatedEvents(chainId, start, end);
        
        console.log(`✅ Batch [${start}-${end}]: Retrieved ${orders.length} orders from blockchain`);
        
        if (orders.length > 0) {
          // Save orders to database (handle duplicates)
          let savedCount = 0;
          let duplicateCount = 0;
          
          for (const orderData of orders) {
            try {
              await Order.findOneAndUpdate(
                { chainId: orderData.chainId, orderId: orderData.orderId },
                orderData,
                { upsert: true, new: true }
              );
              processedOrders++;
              savedCount++;
            } catch (error) {
              // Handle duplicate key errors gracefully
              if (error.code === 11000) {
                console.log(`⚠️  Order ${orderData.orderId} on chainId ${chainId} already exists, skipping...`);
                duplicateCount++;
              } else {
                console.error(`❌ Error saving order ${orderData.orderId} on chainId ${chainId}:`, error);
              }
            }
          }
          
          console.log(`📝 Batch [${start}-${end}]: Saved ${savedCount} new orders, ${duplicateCount} duplicates skipped`);
        } else {
          console.log(`📝 Batch [${start}-${end}]: No new orders found`);
        }
        
        // Slightly longer delay for Celo due to slower RPC
        const delayMs = chainId === 42220 ? 200 : 100;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
      } catch (error) {
        console.error(`❌ Error processing blocks ${start}-${end} for chainId ${chainId}:`, error);
        // Continue with next batch
      }
    }
    
    // Update sync status
    await syncStatus.updateSync(currentBlock, true);
    
    console.log(`✅ Order history sync completed for chainId ${chainId}`);
    console.log(`📦 Processed ${processedOrders} orders`);
    
  } catch (error) {
    console.error(`❌ Error in order history sync for chainId ${chainId}:`, error);
    
    if (syncStatus) {
      const currentBlock = await contractService.getCurrentBlockNumber(chainId).catch(() => 0);
      await syncStatus.updateSync(currentBlock, false, error.message);
    }
  }
}

// Sync order history for all chains (runs every 12 hours)
async function syncOrderHistory() {
  console.log('📦 Starting order history sync for all chains...');
  
  try {
    // Check if contract service is initialized
    if (!contractService.isInitialized()) {
      throw new Error('Contract service not initialized');
    }
    
    const chainIds = contractService.getEnabledChainIds();
    console.log(`🔗 Syncing orders for ${chainIds.length} chain(s): ${chainIds.join(', ')}`);
    
    // Sync chains sequentially to avoid RPC rate limiting
    for (const chainId of chainIds) {
      await syncOrderHistoryForChain(chainId);
    }
    
    console.log('✅ All chain order history sync completed');
    
  } catch (error) {
    console.error('❌ Error in order history sync:', error);
  }
}

// Initialize default admin (runs once at startup)
async function initializeDefaultAdmin() {
  try {
    console.log('👤 Initializing admin user...');
    await Admin.createDefaultAdmin();
  } catch (error) {
    console.error('❌ Error initializing default admin:', error);
  }
}

// Get sync status for all jobs
async function getSyncStatus() {
  try {
    const metricsStatuses = await SyncStatus.find({ syncType: 'metrics' });
    const ordersStatuses = await SyncStatus.find({ syncType: 'orders' });
    
    return {
      metrics: metricsStatuses.length > 0 ? metricsStatuses : [{ syncType: 'metrics', chainId: 8453, lastSyncBlock: 0, isRunning: false }],
      orders: ordersStatuses.length > 0 ? ordersStatuses : [{ syncType: 'orders', chainId: 8453, lastSyncBlock: 0, isRunning: false }]
    };
  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    return null;
  }
}

// Sync total volume across all chains and tokens (runs every 15 minutes)
async function syncTotalVolume() {
  console.log('💰 Starting total volume sync...');
  
  try {
    if (!contractService.isInitialized()) {
      throw new Error('Contract service not initialized');
    }

    // Get all tokens from all chains
    const allTokens = await contractService.getAllTokensAcrossChains();
    
    if (allTokens.length === 0) {
      console.log('⚠️  No tokens found across any chain');
      return;
    }

    console.log(`📊 Found ${allTokens.length} tokens across all chains`);

    // Get unique token names for price fetching
    const tokenNames = allTokens
      .filter(token => token.isActive && token.totalVolume !== '0')
      .map(token => token.name);

    // Get CoinGecko IDs for all tokens
    const coinGeckoIds = tokenNames
      .map(name => {
        const symbol = priceService.getTokenSymbol(name);
        return symbol ? priceService.getCoinGeckoId(symbol) : null;
      })
      .filter(id => id !== null);

    if (coinGeckoIds.length === 0) {
      console.log('⚠️  No recognized tokens found for price fetching');
      return;
    }

    // Fetch all prices at once
    const prices = await priceService.fetchPrices(coinGeckoIds);
    
    // Calculate volume for each token
    let totalUSD = 0;
    let totalNGN = 0;
    const tokenBreakdown = [];

    for (const token of allTokens) {
      if (!token.isActive || token.totalVolume === '0') {
        continue;
      }

      const symbol = priceService.getTokenSymbol(token.name);
      const coinGeckoId = symbol ? priceService.getCoinGeckoId(symbol) : null;
      const priceData = coinGeckoId ? prices[coinGeckoId] : null;

      if (!priceData) {
        continue;
      }

      // Convert volume to USD and NGN
      const converted = priceService.convertAmount(
        token.totalVolume,
        token.decimals,
        priceData
      );

      if (converted) {
        totalUSD += converted.usd;
        totalNGN += converted.ngn;

        tokenBreakdown.push({
          chainId: token.chainId,
          tokenAddress: token.tokenAddress.toLowerCase(),
          tokenName: token.name,
          tokenSymbol: symbol || 'UNKNOWN',
          totalVolume: token.totalVolume,
          volumeUSD: converted.usd,
          volumeNGN: converted.ngn,
          priceUSD: priceData.usd,
          priceNGN: priceData.ngn
        });
      }
    }

    // Save snapshot to database
    const volumeSnapshot = new TotalVolume({
      totalVolumeUSD: totalUSD,
      totalVolumeNGN: totalNGN,
      tokenBreakdown,
      timestamp: new Date()
    });

    await volumeSnapshot.save();

    console.log('✅ Total volume sync completed');
    console.log(`💰 Total: $${totalUSD.toFixed(2)} USD / ₦${totalNGN.toFixed(2)} NGN`);
    console.log(`📊 Tokens processed: ${tokenBreakdown.length}`);
    
  } catch (error) {
    console.error('❌ Error in total volume sync:', error);
  }
}

// Force sync (for manual triggers)
async function forceSyncAll() {
  console.log('🔄 Force syncing all data...');
  
  try {
    await Promise.all([
      syncContractMetrics(),
      syncOrderHistory(),
      syncTotalVolume()
    ]);
    console.log('✅ Force sync completed');
  } catch (error) {
    console.error('❌ Error in force sync:', error);
    throw error;
  }
}

module.exports = {
  syncContractMetrics,
  syncOrderHistory,
  syncTotalVolume,
  initializeDefaultAdmin,
  getSyncStatus,
  forceSyncAll
};