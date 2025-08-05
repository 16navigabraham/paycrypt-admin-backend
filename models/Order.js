const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
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
    unique: true,
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
orderSchema.statics.getRecentOrders = function(limit = 10) {
  return this.find({})
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get orders by user
orderSchema.statics.getOrdersByUser = function(userWallet, limit = 50) {
  return this.find({ userWallet: userWallet.toLowerCase() })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get orders by token
orderSchema.statics.getOrdersByToken = function(tokenAddress, limit = 50) {
  return this.find({ tokenAddress: tokenAddress.toLowerCase() })
    .sort({ timestamp: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Order', orderSchema);