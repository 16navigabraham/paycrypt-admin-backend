const mongoose = require('mongoose');

const contractMetricsSchema = new mongoose.Schema({
  chainId: {
    type: Number,
    required: true,
    default: 8453, // Default to Base chain
    index: true
  },
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

// Multi-chain indexes
contractMetricsSchema.index({ chainId: 1, timestamp: -1 });
contractMetricsSchema.index({ chainId: 1, timestamp: 1 });

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