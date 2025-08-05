const contractService = require('../services/contractService');
const ContractMetrics = require('../models/ContractMetrics');
const Order = require('../models/Order');
const SyncStatus = require('../models/SyncStatus');
const Admin = require('../models/Admin');

// Sync contract metrics (runs every hour)
async function syncContractMetrics() {
  console.log('📊 Starting contract metrics sync...');
  
  let syncStatus;
  try {
    // Get or create sync status
    syncStatus = await SyncStatus.getOrCreate('metrics');
    
    // Check if already running
    if (syncStatus.isRunning) {
      console.log('⚠️  Metrics sync already running, skipping...');
      return;
    }
    
    // Mark as running
    await syncStatus.markAsRunning();
    
    // Check if contract service is initialized
    if (!contractService.isInitialized()) {
      throw new Error('Contract service not initialized');
    }
    
    // Fetch current metrics from contract
    const metrics = await contractService.getContractMetrics();
    
    // Save to database
    const contractMetrics = new ContractMetrics(metrics);
    await contractMetrics.save();
    
    // Update sync status
    const currentBlock = await contractService.getCurrentBlockNumber();
    await syncStatus.updateSync(currentBlock, true);
    
    console.log('✅ Contract metrics sync completed successfully');
    console.log(`📈 Saved metrics: Orders: ${metrics.orderCount}, Volume: ${metrics.totalVolume}`);
    
  } catch (error) {
    console.error('❌ Error in contract metrics sync:', error);
    
    if (syncStatus) {
      await syncStatus.updateSync(0, false, error.message);
    }
  }
}

// Sync order history (runs every 12 hours)
async function syncOrderHistory() {
  console.log('📦 Starting order history sync...');
  
  let syncStatus;
  try {
    // Get or create sync status
    syncStatus = await SyncStatus.getOrCreate('orders');
    
    // Check if already running
    if (syncStatus.isRunning) {
      console.log('⚠️  Order sync already running, skipping...');
      return;
    }
    
    // Mark as running
    await syncStatus.markAsRunning();
    
    // Check if contract service is initialized
    if (!contractService.isInitialized()) {
      throw new Error('Contract service not initialized');
    }
    
    // Get current block number
    const currentBlock = await contractService.getCurrentBlockNumber();
    
    // Determine starting block
    let fromBlock = syncStatus.lastSyncBlock || 0;
    
    // For initial sync, start from a reasonable block (e.g., contract deployment)
    if (fromBlock === 0) {
      // You can set this to your contract deployment block
      fromBlock = Math.max(0, currentBlock - 100000); // Start from 100k blocks ago
      console.log(`🚀 Initial sync starting from block ${fromBlock}`);
    }
    
    console.log(`🔍 Syncing orders from block ${fromBlock} to ${currentBlock}`);
    
    // Fetch order events in batches to avoid RPC limits
    const batchSize = 10000;
    let processedOrders = 0;
    
    for (let start = fromBlock; start <= currentBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, currentBlock);
      
      console.log(`📦 Processing blocks ${start} to ${end}...`);
      
      try {
        const orders = await contractService.getOrderCreatedEvents(start, end);
        
        if (orders.length > 0) {
          // Save orders to database (handle duplicates)
          for (const orderData of orders) {
            try {
              await Order.findOneAndUpdate(
                { orderId: orderData.orderId },
                orderData,
                { upsert: true, new: true }
              );
              processedOrders++;
            } catch (error) {
              // Handle duplicate key errors gracefully
              if (error.code === 11000) {
                console.log(`⚠️  Order ${orderData.orderId} already exists, skipping...`);
              } else {
                console.error(`❌ Error saving order ${orderData.orderId}:`, error);
              }
            }
          }
        }
        
        // Small delay to avoid overwhelming the RPC
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing blocks ${start}-${end}:`, error);
        // Continue with next batch
      }
    }
    
    // Update sync status
    await syncStatus.updateSync(currentBlock, true);
    
    console.log('✅ Order history sync completed successfully');
    console.log(`📦 Processed ${processedOrders} orders`);
    
  } catch (error) {
    console.error('❌ Error in order history sync:', error);
    
    if (syncStatus) {
      const currentBlock = await contractService.getCurrentBlockNumber().catch(() => 0);
      await syncStatus.updateSync(currentBlock, false, error.message);
    }
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
    const [metricsStatus, ordersStatus] = await Promise.all([
      SyncStatus.findOne({ syncType: 'metrics' }),
      SyncStatus.findOne({ syncType: 'orders' })
    ]);
    
    return {
      metrics: metricsStatus || { syncType: 'metrics', lastSyncBlock: 0, isRunning: false },
      orders: ordersStatus || { syncType: 'orders', lastSyncBlock: 0, isRunning: false }
    };
  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    return null;
  }
}

// Force sync (for manual triggers)
async function forceSyncAll() {
  console.log('🔄 Force syncing all data...');
  
  try {
    await Promise.all([
      syncContractMetrics(),
      syncOrderHistory()
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
  initializeDefaultAdmin,
  getSyncStatus,
  forceSyncAll
};