const mongoose = require('mongoose');

const totalVolumeSchema = new mongoose.Schema({
  totalVolumeUSD: {
    type: Number,
    required: true
  },
  totalVolumeNGN: {
    type: Number,
    required: true
  },
  tokenBreakdown: [{
    chainId: Number,
    tokenAddress: String,
    tokenName: String,
    tokenSymbol: String,
    totalVolume: String, // Raw blockchain value
    volumeUSD: Number,
    volumeNGN: Number,
    priceUSD: Number,
    priceNGN: Number
  }],
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient time-based queries
totalVolumeSchema.index({ timestamp: -1 });
totalVolumeSchema.index({ timestamp: 1 });

// Static method to get latest volume
totalVolumeSchema.statics.getLatest = function() {
  return this.findOne({}).sort({ timestamp: -1 });
};

// Static method to get volume history
totalVolumeSchema.statics.getHistory = function(startTime, endTime = new Date()) {
  return this.find({
    timestamp: { $gte: startTime, $lte: endTime }
  }).sort({ timestamp: 1 });
};

module.exports = mongoose.model('TotalVolume', totalVolumeSchema);
