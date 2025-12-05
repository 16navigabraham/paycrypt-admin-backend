const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    index: true
  },
  chainId: {
    type: Number,
    required: true,
    default: 8453, // Default to Base chain
    index: true
  },
  requestId: {
    type: String,
    required: true,
    index: true
  },
  userWallet: {
    type: String,
    required: true,
    index: true,
    lowercase: true
  },
  tokenAddress: {
    type: String,
    required: true,
    index: true,
    lowercase: true
  },
  amount: {
    type: String,
    required: true
  },
  txnHash: {
    type: String,
    required: true,
    index: true,
    lowercase: true
  },
  blockNumber: {
    type: Number,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
orderSchema.index({ userWallet: 1, timestamp: -1 });
orderSchema.index({ tokenAddress: 1, timestamp: -1 });
orderSchema.index({ timestamp: -1, blockNumber: -1 });
orderSchema.index({ timestamp: -1, userWallet: 1 });
orderSchema.index({ chainId: 1, timestamp: -1 });
orderSchema.index({ chainId: 1, orderId: 1 }, { unique: true }); // Unique per chain
orderSchema.index({ chainId: 1, txnHash: 1 }, { unique: true }); // Unique per chain

// Add virtual for formatted amount (assuming 18 decimals for most tokens)
orderSchema.virtual('formattedAmount').get(function() {
  try {
    const amount = this.amount;
    // Simple formatting - divide by 10^18 for display
    const bigAmount = BigInt(amount);
    const divisor = BigInt('1000000000000000000'); // 10^18
    const result = Number(bigAmount / divisor);
    return result;
  } catch (error) {
    return this.amount;
  }
});

// Ensure virtual fields are serialized
orderSchema.set('toJSON', { virtuals: true });

// Static method to get recent orders
orderSchema.statics.getRecentOrders = function(limit = 10, chainId = null) {
  const query = chainId ? { chainId } : {};
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get orders by user
orderSchema.statics.getOrdersByUser = function(userWallet, limit = 50, chainId = null) {
  const query = { userWallet: userWallet.toLowerCase() };
  if (chainId) query.chainId = chainId;
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get orders by token
orderSchema.statics.getOrdersByToken = function(tokenAddress, limit = 50, chainId = null) {
  const query = { tokenAddress: tokenAddress.toLowerCase() };
  if (chainId) query.chainId = chainId;
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get orders by chain
orderSchema.statics.getOrdersByChain = function(chainId, limit = 50) {
  return this.find({ chainId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Order', orderSchema);