const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  try {
    console.log('🚀 Starting multi-chain migration...\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/paycrypt-admin');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Migrate Orders
    console.log('📦 Migrating Orders collection...');
    const ordersResult = await db.collection('orders').updateMany(
      { chainId: { $exists: false } },
      { $set: { chainId: 8453 } }
    );
    console.log(`   Updated ${ordersResult.modifiedCount} orders (matched ${ordersResult.matchedCount})`);
    
    // Migrate ContractMetrics
    console.log('📊 Migrating ContractMetrics collection...');
    const metricsResult = await db.collection('contractmetrics').updateMany(
      { chainId: { $exists: false } },
      { $set: { chainId: 8453 } }
    );
    console.log(`   Updated ${metricsResult.modifiedCount} contract metrics (matched ${metricsResult.matchedCount})`);
    
    // Migrate SyncStatus
    console.log('🔄 Migrating SyncStatus collection...');
    const syncResult = await db.collection('syncstatuses').updateMany(
      { chainId: { $exists: false } },
      { $set: { chainId: 8453 } }
    );
    console.log(`   Updated ${syncResult.modifiedCount} sync statuses (matched ${syncResult.matchedCount})`);
    
    // Update indexes
    console.log('\n🔍 Updating indexes...');
    
    // Orders indexes
    console.log('   Updating Orders indexes...');
    await db.collection('orders').dropIndexes().catch(() => {});
    await db.collection('orders').createIndex({ chainId: 1, orderId: 1 }, { unique: true });
    await db.collection('orders').createIndex({ chainId: 1, txnHash: 1 }, { unique: true });
    await db.collection('orders').createIndex({ chainId: 1, timestamp: -1 });
    await db.collection('orders').createIndex({ orderId: 1 });
    await db.collection('orders').createIndex({ requestId: 1 });
    await db.collection('orders').createIndex({ userWallet: 1, timestamp: -1 });
    await db.collection('orders').createIndex({ tokenAddress: 1, timestamp: -1 });
    console.log('   ✓ Orders indexes updated');
    
    // ContractMetrics indexes
    console.log('   Updating ContractMetrics indexes...');
    await db.collection('contractmetrics').dropIndexes().catch(() => {});
    await db.collection('contractmetrics').createIndex({ timestamp: -1 });
    await db.collection('contractmetrics').createIndex({ timestamp: 1, orderCount: 1 });
    await db.collection('contractmetrics').createIndex({ chainId: 1, timestamp: -1 });
    await db.collection('contractmetrics').createIndex({ chainId: 1, timestamp: 1 });
    console.log('   ✓ ContractMetrics indexes updated');
    
    // SyncStatus indexes
    console.log('   Updating SyncStatus indexes...');
    await db.collection('syncstatuses').dropIndexes().catch(() => {});
    await db.collection('syncstatuses').createIndex({ syncType: 1, chainId: 1 }, { unique: true });
    await db.collection('syncstatuses').createIndex({ lastSyncTimestamp: -1 });
    await db.collection('syncstatuses').createIndex({ chainId: 1 });
    console.log('   ✓ SyncStatus indexes updated');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Orders updated: ${ordersResult.modifiedCount}`);
    console.log(`   - Contract metrics updated: ${metricsResult.modifiedCount}`);
    console.log(`   - Sync statuses updated: ${syncResult.modifiedCount}`);
    console.log(`   - All collections now support multi-chain (chainId: 8453 = Base)`);
    console.log('\n🎉 Your database is now ready for multi-chain support!');
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
console.log('═══════════════════════════════════════════════════════════');
console.log('  PayCrypt Admin Backend - Multi-Chain Migration Script');
console.log('═══════════════════════════════════════════════════════════\n');

migrate();
