const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Migration script to fix SyncStatus duplicate key error
 * 
 * This script removes the old unique index on syncType alone
 * and ensures only the compound index (syncType + chainId) exists.
 * 
 * Run this script once with: node migrations/fix-syncstatus-index.js
 */

async function fixSyncStatusIndex(existingConnection = null) {
  let shouldCloseConnection = false;
  try {
    // Use existing connection if provided, otherwise create new one
    if (!existingConnection || mongoose.connection.readyState !== 1) {
      console.log('🔗 Connecting to MongoDB for migration...');
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      shouldCloseConnection = true;
      console.log('✅ Connected to MongoDB for migration');
    } else {
      console.log('✅ Using existing MongoDB connection for migration');
    }

    const db = mongoose.connection.db;
    const collection = db.collection('syncstatuses');

    // Get existing indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Check if old problematic index exists
    const oldIndexExists = indexes.some(
      index => index.name === 'syncType_1' && !index.key.chainId
    );

    if (oldIndexExists) {
      console.log('\n⚠️  Found old syncType_1 index (without chainId)');
      console.log('🗑️  Dropping old index...');
      
      try {
        await collection.dropIndex('syncType_1');
        console.log('✅ Successfully dropped old index');
      } catch (error) {
        if (error.code === 27 || error.message.includes('index not found')) {
          console.log('ℹ️  Index already removed or not found');
        } else {
          throw error;
        }
      }
    } else {
      console.log('\n✅ No problematic index found');
    }

    // Ensure the correct compound index exists
    console.log('\n🔧 Ensuring correct compound index exists...');
    try {
      await collection.createIndex(
        { syncType: 1, chainId: 1 },
        { unique: true, name: 'syncType_1_chainId_1' }
      );
      console.log('✅ Compound index ensured');
    } catch (error) {
      if (error.code === 85 || error.message.includes('already exists')) {
        console.log('ℹ️  Compound index already exists');
      } else {
        throw error;
      }
    }

    // Show final indexes
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Optional: Remove duplicate documents if any exist
    console.log('\n🔍 Checking for duplicate documents...');
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: { syncType: '$syncType', chainId: '$chainId' },
          count: { $sum: 1 },
          docs: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate groups`);
      
      for (const dup of duplicates) {
        console.log(`\n  Duplicate: syncType=${dup._id.syncType}, chainId=${dup._id.chainId}`);
        console.log(`  Keeping first document, removing ${dup.count - 1} duplicates...`);
        
        // Keep the first document, remove the rest
        const docsToRemove = dup.docs.slice(1);
        await collection.deleteMany({ _id: { $in: docsToRemove } });
        console.log(`  ✅ Removed ${docsToRemove.length} duplicate(s)`);
      }
    } else {
      console.log('✅ No duplicate documents found');
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  - Old index removed (if existed)');
    console.log('  - Compound index (syncType + chainId) ensured');
    console.log('  - Duplicate documents cleaned up');
    if (shouldCloseConnection) {
      console.log('\n✅ You can now restart your application');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    return false;
  } finally {
    // Only close connection if we created it
    if (shouldCloseConnection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n👋 Database connection closed');
    }
  }
  return true;
}

// Export for use in server startup
module.exports = fixSyncStatusIndex;

// Run migration if executed directly
if (require.main === module) {
  console.log('🚀 Starting SyncStatus index migration...\n');
  fixSyncStatusIndex().then(success => {
    process.exit(success ? 0 : 1);
  });
}
