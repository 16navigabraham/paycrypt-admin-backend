const mongoose = require('mongoose');

const contractMetricsSchema = new mongoose.Schema({
  orderCount: {
    type: String,
    required: true
  },
  totalVolume: {
    type: String,
    required: true
  },
  successfulOrders: {
    type: String,
    required: true
  },
  failedOrders: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient time-based queries
contractMetricsSchema.index({ timestamp: -1 });

// Compound index for range queries
contractMetricsSchema.index({ timestamp: 1, orderCount: 1 });

// Add virtual for success rate
contractMetricsSchema.virtual('successRate').get(function() {
  const successful = parseInt(this.successfulOrders);
  const failed = parseInt(this.failedOrders);
  const total = successful + failed;
  return total > 0 ? (successful / total * 100).toFixed(2) : 0;
});

// Ensure virtual fields are serialized
contractMetricsSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('ContractMetrics', contractMetricsSchema);