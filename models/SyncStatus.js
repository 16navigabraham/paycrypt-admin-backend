const mongoose = require('mongoose');

const syncStatusSchema = new mongoose.Schema({
  syncType: {
    type: String,
    required: true,
    enum: ['metrics', 'orders'],
    unique: true
  },
  lastSyncBlock: {
    type: Number,
    default: 0
  },
  lastSyncTimestamp: {
    type: Date,
    default: Date.now
  },
  isRunning: {
    type: Boolean,
    default: false
  },
  lastError: {
    type: String,
    default: null
  },
  successCount: {
    type: Number,
    default: 0
  },
  errorCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
syncStatusSchema.index({ syncType: 1 });
syncStatusSchema.index({ lastSyncTimestamp: -1 });

// Static method to get or create sync status
syncStatusSchema.statics.getOrCreate = async function(syncType) {
  try {
    let syncStatus = await this.findOne({ syncType });
    if (!syncStatus) {
      syncStatus = new this({ syncType });
      await syncStatus.save();
      console.log(`📊 Created new sync status for: ${syncType}`);
    }
    return syncStatus;
  } catch (error) {
    console.error(`❌ Error getting/creating sync status for ${syncType}:`, error);
    throw error;
  }
};

// Method to update sync status
syncStatusSchema.methods.updateSync = async function(block, success = true, error = null) {
  try {
    this.lastSyncBlock = Math.max(this.lastSyncBlock, block);
    this.lastSyncTimestamp = new Date();
    this.isRunning = false;
    this.lastError = error;
    
    if (success) {
      this.successCount += 1;
    } else {
      this.errorCount += 1;
    }
    
    await this.save();
    console.log(`✅ Updated sync status for ${this.syncType}: block ${block}`);
  } catch (err) {
    console.error(`❌ Error updating sync status for ${this.syncType}:`, err);
    throw err;
  }
};

// Method to mark sync as running
syncStatusSchema.methods.markAsRunning = async function() {
  this.isRunning = true;
  await this.save();
};

module.exports = mongoose.model('SyncStatus', syncStatusSchema);