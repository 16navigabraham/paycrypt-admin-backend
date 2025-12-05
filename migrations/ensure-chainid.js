const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Migration to ensure all orders have a chainId field
 * 
 * This migration adds chainId = 8453 (Base) to any orders missing it
 * Run with: node migrations/ensure-chainid.js
 */

async function ensureChainId() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');

    console.log('\n🔍 Checking for orders without chainId...');
    
    // Find orders without chainId or with null chainId
    const ordersWithoutChainId = await ordersCollection.find({
      $or: [
        { chainId: { $exists: false } },
        { chainId: null }
      ]
    }).toArray();

    console.log(`📊 Found ${ordersWithoutChainId.length} orders without chainId`);

    if (ordersWithoutChainId.length === 0) {
      console.log('✅ All orders already have chainId field');
      return true;
    }

    // Update orders without chainId to default to Base chain (8453)
    console.log('\n🔧 Setting chainId = 8453 (Base) for orders without chainId...');
    
    const result = await ordersCollection.updateMany(
      {
        $or: [
          { chainId: { $exists: false } },
          { chainId: null }
        ]
      },
      {
        $set: { chainId: 8453 }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} orders with default chainId`);

    // Verify the update
    const remaining = await ordersCollection.countDocuments({
      $or: [
        { chainId: { $exists: false } },
        { chainId: null }
      ]
    });

    if (remaining === 0) {
      console.log('✅ All orders now have chainId');
    } else {
      console.warn(`⚠️  ${remaining} orders still missing chainId`);
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`  - Orders updated: ${result.modifiedCount}`);
    console.log(`  - Default chainId: 8453 (Base)`);

    return true;

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    return false;
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Export for use in server startup
module.exports = ensureChainId;

// Run migration if executed directly
if (require.main === module) {
  console.log('🚀 Starting chainId migration...\n');
  ensureChainId().then(success => {
    process.exit(success ? 0 : 1);
  });
}
