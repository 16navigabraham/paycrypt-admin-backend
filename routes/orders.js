const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { getStartTime, isValidTimeRange } = require('../utils/timeUtils');

// IMPORTANT: Specific routes MUST come before parameterized routes like /:orderId
// Otherwise Express will match /:orderId first and treat 'user', 'token', 'analytics', 'recent' as order IDs

// Get orders with optional filtering
router.get('/', async (req, res) => {
  try {
    const { 
      range, 
      user, 
      token,
      chainId,
      page = 1, 
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query
    let query = {};
    
    // Add chainId filter
    if (chainId) {
      query.chainId = parseInt(chainId);
    }
    
    // Add time range filter
    if (range) {
      if (!isValidTimeRange(range)) {
        return res.status(400).json({ 
          error: 'Invalid time range format. Use format like: 1h, 24h, 7d, 30d' 
        });
      }
      
      const startTime = getStartTime(range);
      query.timestamp = { $gte: startTime };
    }
    
    // Add user filter
    if (user) {
      query.userWallet = user.toLowerCase();
    }
    
    // Add token filter
    if (token) {
      query.tokenAddress = token.toLowerCase();
    }
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;
    
    // Sort options
    const sortOptions = {};
    const validSortFields = ['timestamp', 'blockNumber', 'amount', 'userWallet'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
    sortOptions[sortField] = sortDirection;
    
    // Execute queries
    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean for better performance
      Order.countDocuments(query)
    ]);
    
    // Debug: Log first order to verify chainId is present
    if (orders.length > 0) {
      console.log('📦 Sample order from DB:', {
        orderId: orders[0].orderId,
        chainId: orders[0].chainId,
        hasChainId: 'chainId' in orders[0]
      });
    }
    
    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      },
      filters: {
        chainId: chainId ? parseInt(chainId) : null,
        range: range || null,
        user: user || null,
        token: token || null
      },
      sort: {
        field: sortField,
        order: sortOrder
      }
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

// Get orders by user wallet (MUST be before /:orderId)
router.get('/user/:userWallet', async (req, res) => {
  try {
    const { userWallet } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [orders, total] = await Promise.all([
      Order.getOrdersByUser(userWallet.toLowerCase())
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments({ userWallet: userWallet.toLowerCase() })
    ]);
    
    res.json({
      userWallet: userWallet.toLowerCase(),
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user orders' 
    });
  }
});

// Get orders by token (MUST be before /:orderId)
router.get('/token/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [orders, total] = await Promise.all([
      Order.getOrdersByToken(tokenAddress.toLowerCase())
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments({ tokenAddress: tokenAddress.toLowerCase() })
    ]);
    
    res.json({
      tokenAddress: tokenAddress.toLowerCase(),
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching token orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch token orders' 
    });
  }
});

// Get orders analytics (MUST be before /:orderId)
router.get('/analytics/summary', async (req, res) => {
  try {
    const { range = '24h' } = req.query;
    
    if (!isValidTimeRange(range)) {
      return res.status(400).json({ 
        error: 'Invalid time range format' 
      });
    }
    
    const startTime = getStartTime(range);
    
    const [orderStats, topTokens, topUsers, volumeByTime] = await Promise.all([
      // Basic order statistics
      Order.aggregate([
        { $match: { timestamp: { $gte: startTime } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalVolume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            },
            uniqueUsers: { $addToSet: '$userWallet' },
            uniqueTokens: { $addToSet: '$tokenAddress' },
            avgAmount: { 
              $avg: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        }
      ]),
      
      // Top tokens by volume
      Order.aggregate([
        { $match: { timestamp: { $gte: startTime } } },
        {
          $group: {
            _id: '$tokenAddress',
            count: { $sum: 1 },
            volume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { volume: -1 } },
        { $limit: 10 }
      ]),
      
      // Top users by volume
      Order.aggregate([
        { $match: { timestamp: { $gte: startTime } } },
        {
          $group: {
            _id: '$userWallet',
            count: { $sum: 1 },
            volume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { volume: -1 } },
        { $limit: 10 }
      ]),
      
      // Volume over time
      Order.aggregate([
        { $match: { timestamp: { $gte: startTime } } },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
              hour: { $hour: '$timestamp' }
            },
            orders: { $sum: 1 },
            volume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ])
    ]);
    
    const stats = orderStats[0] || { 
      totalOrders: 0, 
      totalVolume: 0, 
      uniqueUsers: [], 
      uniqueTokens: [],
      avgAmount: 0
    };
    
    res.json({
      range,
      summary: {
        totalOrders: stats.totalOrders,
        totalVolume: stats.totalVolume,
        uniqueUsers: stats.uniqueUsers.length,
        uniqueTokens: stats.uniqueTokens.length,
        averageAmount: stats.avgAmount || 0
      },
      topTokens: topTokens.map(token => ({
        address: token._id,
        orders: token.count,
        volume: token.volume
      })),
      topUsers: topUsers.map(user => ({
        address: user._id,
        orders: user.count,
        volume: user.volume
      })),
      volumeOverTime: volumeByTime.map(item => ({
        timestamp: new Date(item._id.year, item._id.month - 1, item._id.day, item._id.hour),
        orders: item.orders,
        volume: item.volume
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching order analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch order analytics' 
    });
  }
});

// Get recent orders (MUST be before /:orderId)
router.get('/recent/:count?', async (req, res) => {
  try {
    const count = Math.min(100, Math.max(1, parseInt(req.params.count) || 10));
    
    const orders = await Order.getRecentOrders(count);
    
    res.json({
      orders,
      count: orders.length,
      requested: count
    });
  } catch (error) {
    console.error('❌ Error fetching recent orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recent orders' 
    });
  }
});

// Get order by ID (MUST be LAST - catches any remaining paths)
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).json({ 
        error: 'Order not found',
        orderId
      });
    }
    
    res.json(order);
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({ 
      error: 'Failed to fetch order' 
    });
  }
});

module.exports = router;