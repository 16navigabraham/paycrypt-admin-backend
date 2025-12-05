const express = require('express');
const router = express.Router();
const contractService = require('../services/contractService');
const ContractMetrics = require('../models/ContractMetrics');
const { getStartTime, isValidTimeRange } = require('../utils/timeUtils');

// Get current stats from contract or historical data
router.get('/', async (req, res) => {
  try {
    const { range, chainId } = req.query;
    
    if (range) {
      // Return historical data
      if (!isValidTimeRange(range)) {
        return res.status(400).json({ 
          error: 'Invalid time range format. Use format like: 1h, 24h, 7d, 30d' 
        });
      }

      const startTime = getStartTime(range);
      const query = { timestamp: { $gte: startTime } };
      
      // Add chainId filter if provided
      if (chainId) {
        query.chainId = parseInt(chainId);
      }
      
      const metrics = await ContractMetrics.find(query)
        .sort({ timestamp: -1 })
        .limit(1000); // Limit to prevent huge responses

      if (metrics.length === 0) {
        return res.json({
          range,
          chainId: chainId ? parseInt(chainId) : null,
          message: 'No data available for the specified time range',
          data: [],
          count: 0
        });
      }

      // Calculate aggregates
      const aggregates = calculateAggregates(metrics);
      
      res.json({
        range,
        chainId: chainId ? parseInt(chainId) : null,
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
      
      if (chainId) {
        // Get stats for specific chain
        const currentStats = await contractService.getContractMetrics(parseInt(chainId));
        res.json(currentStats);
      } else {
        // Get stats for all chains and aggregate
        const allStats = await contractService.getAllContractMetrics();
        
        // Aggregate stats across all chains
        const aggregated = {
          orderCount: '0',
          totalVolume: '0',
          successfulOrders: '0',
          failedOrders: '0',
          chainStats: allStats
        };
        
        for (const stat of allStats) {
          aggregated.orderCount = (BigInt(aggregated.orderCount) + BigInt(stat.orderCount)).toString();
          aggregated.totalVolume = (BigInt(aggregated.totalVolume) + BigInt(stat.totalVolume)).toString();
          aggregated.successfulOrders = (BigInt(aggregated.successfulOrders) + BigInt(stat.successfulOrders)).toString();
          aggregated.failedOrders = (BigInt(aggregated.failedOrders) + BigInt(stat.failedOrders)).toString();
        }
        
        res.json(aggregated);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contract stats',
      message: error.message
    });
  }
});

// Get stats for a specific chain by chainId
router.get('/:chainId', async (req, res) => {
  try {
    const chainId = parseInt(req.params.chainId);
    
    if (!contractService.isInitialized()) {
      return res.status(503).json({ 
        error: 'Contract service not initialized' 
      });
    }
    
    // Get stats for specific chain
    const stats = await contractService.getContractMetrics(chainId);
    res.json(stats);
  } catch (error) {
    console.error(`❌ Error fetching stats for chain ${req.params.chainId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch contract stats for chain',
      message: error.message,
      chainId: req.params.chainId
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

// Get information about supported chains
router.get('/chains', async (req, res) => {
  try {
    if (!contractService.isInitialized()) {
      return res.status(503).json({ 
        error: 'Contract service not initialized' 
      });
    }
    
    const chains = contractService.getAllChains();
    res.json({
      chains,
      count: chains.length
    });
  } catch (error) {
    console.error('❌ Error fetching chains:', error);
    res.status(500).json({ 
      error: 'Failed to fetch chains information',
      message: error.message
    });
  }
});

module.exports = router;