const express = require('express');
const router = express.Router();
const contractService = require('../services/contractService');
const ContractMetrics = require('../models/ContractMetrics');
const { getStartTime, isValidTimeRange } = require('../utils/timeUtils');

// Get current stats from contract or historical data
router.get('/', async (req, res) => {
  try {
    const { range } = req.query;
    
    if (range) {
      // Return historical data
      if (!isValidTimeRange(range)) {
        return res.status(400).json({ 
          error: 'Invalid time range format. Use format like: 1h, 24h, 7d, 30d' 
        });
      }

      const startTime = getStartTime(range);
      const metrics = await ContractMetrics.find({
        timestamp: { $gte: startTime }
      })
      .sort({ timestamp: -1 })
      .limit(1000); // Limit to prevent huge responses

      if (metrics.length === 0) {
        return res.json({
          range,
          message: 'No data available for the specified time range',
          data: [],
          count: 0
        });
      }

      // Calculate aggregates
      const aggregates = calculateAggregates(metrics);
      
      res.json({
        range,
        aggregates,
        data: metrics,
        count: metrics.length
      });
    } else {
      // Return current stats from contract
      if (!contractService.isInitialized()) {
        return res.status(503).json({ 
          error: 'Contract service not initialized' 
        });
      }
      
      const currentStats = await contractService.getContractMetrics();
      res.json(currentStats);
    }
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contract stats',
      message: error.message
    });
  }
});

// Get latest stored metrics
router.get('/latest', async (req, res) => {
  try {
    const latestMetrics = await ContractMetrics.findOne({})
      .sort({ timestamp: -1 });
    
    if (!latestMetrics) {
      return res.status(404).json({ 
        error: 'No metrics data available' 
      });
    }
    
    res.json(latestMetrics);
  } catch (error) {
    console.error('❌ Error fetching latest stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch latest stats' 
    });
  }
});

// Get historical chart data
router.get('/chart/:period', async (req, res) => {
  try {
    const { period } = req.params;
    
    if (!isValidTimeRange(period)) {
      return res.status(400).json({ 
        error: 'Invalid time period. Use format like: 1h, 24h, 7d, 30d' 
      });
    }

    const startTime = getStartTime(period);
    const metrics = await ContractMetrics.find({
      timestamp: { $gte: startTime }
    }).sort({ timestamp: 1 });

    const chartData = metrics.map(metric => ({
      timestamp: metric.timestamp,
      orderCount: parseInt(metric.orderCount),
      totalVolume: metric.totalVolume,
      successfulOrders: parseInt(metric.successfulOrders),
      failedOrders: parseInt(metric.failedOrders),
      successRate: calculateSuccessRate(metric.successfulOrders, metric.failedOrders)
    }));

    res.json({
      period,
      data: chartData,
      count: chartData.length
    });
  } catch (error) {
    console.error('❌ Error fetching chart data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch chart data' 
    });
  }
});

// Get summary statistics
router.get('/summary', async (req, res) => {
  try {
    const { range = '24h' } = req.query;
    
    if (!isValidTimeRange(range)) {
      return res.status(400).json({ 
        error: 'Invalid time range format' 
      });
    }

    const startTime = getStartTime(range);
    
    // Get metrics for the period
    const metrics = await ContractMetrics.find({
      timestamp: { $gte: startTime }
    }).sort({ timestamp: 1 });

    if (metrics.length === 0) {
      return res.json({
        range,
        message: 'No data available for the specified time range',
        summary: null
      });
    }

    const latest = metrics[metrics.length - 1];
    const earliest = metrics[0];

    const summary = {
      period: range,
      current: {
        orderCount: parseInt(latest.orderCount),
        totalVolume: latest.totalVolume,
        successfulOrders: parseInt(latest.successfulOrders),
        failedOrders: parseInt(latest.failedOrders),
        successRate: calculateSuccessRate(latest.successfulOrders, latest.failedOrders)
      },
      change: {
        orderCount: parseInt(latest.orderCount) - parseInt(earliest.orderCount),
        successfulOrders: parseInt(latest.successfulOrders) - parseInt(earliest.successfulOrders),
        failedOrders: parseInt(latest.failedOrders) - parseInt(earliest.failedOrders),
        volumeChange: (BigInt(latest.totalVolume) - BigInt(earliest.totalVolume)).toString()
      },
      timeRange: {
        start: earliest.timestamp,
        end: latest.timestamp,
        dataPoints: metrics.length
      }
    };

    res.json(summary);
  } catch (error) {
    console.error('❌ Error fetching summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch summary statistics' 
    });
  }
});

// Helper functions
function calculateAggregates(metrics) {
  if (metrics.length === 0) return null;

  const latest = metrics[0]; // First item is most recent due to sort
  const oldest = metrics[metrics.length - 1];

  return {
    current: {
      orderCount: parseInt(latest.orderCount),
      totalVolume: latest.totalVolume,
      successfulOrders: parseInt(latest.successfulOrders),
      failedOrders: parseInt(latest.failedOrders),
      successRate: calculateSuccessRate(latest.successfulOrders, latest.failedOrders)
    },
    change: {
      orderCount: parseInt(latest.orderCount) - parseInt(oldest.orderCount),
      totalVolume: (BigInt(latest.totalVolume) - BigInt(oldest.totalVolume)).toString(),
      successfulOrders: parseInt(latest.successfulOrders) - parseInt(oldest.successfulOrders),
      failedOrders: parseInt(latest.failedOrders) - parseInt(oldest.failedOrders)
    },
    period: {
      start: oldest.timestamp,
      end: latest.timestamp,
      dataPoints: metrics.length,
      averageOrdersPerHour: calculateAverageOrdersPerHour(metrics)
    }
  };
}

function calculateSuccessRate(successful, failed) {
  const successfulNum = parseInt(successful);
  const failedNum = parseInt(failed);
  const total = successfulNum + failedNum;
  return total > 0 ? Number((successfulNum / total * 100).toFixed(2)) : 0;
}

function calculateAverageOrdersPerHour(metrics) {
  if (metrics.length < 2) return 0;
  
  const latest = metrics[0];
  const oldest = metrics[metrics.length - 1];
  const timeDiffHours = (latest.timestamp - oldest.timestamp) / (1000 * 60 * 60);
  const orderDiff = parseInt(latest.orderCount) - parseInt(oldest.orderCount);
  
  return timeDiffHours > 0 ? Number((orderDiff / timeDiffHours).toFixed(2)) : 0;
}

module.exports = router;