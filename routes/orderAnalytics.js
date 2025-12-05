const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { getStartTime, isValidTimeRange } = require('../utils/timeUtils');
const { CONTRACTS } = require('../config/contract');

// Helper function to build match query with filters
function buildMatchQuery(filters = {}) {
  const match = {};
  
  if (filters.range && isValidTimeRange(filters.range)) {
    const startTime = getStartTime(filters.range);
    if (startTime) {
      match.timestamp = { $gte: startTime };
    }
  }
  
  if (filters.chainId) {
    match.chainId = parseInt(filters.chainId);
  }
  
  if (filters.tokenAddress) {
    match.tokenAddress = filters.tokenAddress.toLowerCase();
  }
  
  if (filters.userWallet) {
    match.userWallet = filters.userWallet.toLowerCase();
  }
  
  return match;
}

// Helper function to convert BigInt amounts to numbers
function convertAmount(amount) {
  return parseFloat(amount) / 1e18;
}

// ==================== TIMELINE ANALYTICS ====================

// Get order timeline with customizable intervals
router.get('/timeline', async (req, res) => {
  try {
    const { range = '24h', interval = 'hour', chainId, tokenAddress } = req.query;
    
    if (!isValidTimeRange(range)) {
      return res.status(400).json({ 
        error: 'Invalid time range. Use: 12h, 24h, day, month, year or formats like 7d, 30d' 
      });
    }
    
    const match = buildMatchQuery({ range, chainId, tokenAddress });
    
    // Determine grouping based on interval
    let groupId;
    switch (interval) {
      case 'hour':
        groupId = {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
          hour: { $hour: '$timestamp' }
        };
        break;
      case 'day':
        groupId = {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' }
        };
        break;
      case 'month':
        groupId = {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' }
        };
        break;
      default:
        return res.status(400).json({ 
          error: 'Invalid interval. Use: hour, day, or month' 
        });
    }
    
    const timeline = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          orderCount: { $sum: 1 },
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
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);
    
    // Format timeline data
    const formattedTimeline = timeline.map(item => {
      let timestamp;
      if (interval === 'hour') {
        timestamp = new Date(item._id.year, item._id.month - 1, item._id.day, item._id.hour);
      } else if (interval === 'day') {
        timestamp = new Date(item._id.year, item._id.month - 1, item._id.day);
      } else {
        timestamp = new Date(item._id.year, item._id.month - 1);
      }
      
      return {
        timestamp,
        orderCount: item.orderCount,
        totalVolume: item.totalVolume,
        uniqueUsers: item.uniqueUsers.length,
        uniqueTokens: item.uniqueTokens.length,
        averageAmount: item.avgAmount
      };
    });
    
    res.json({
      range,
      interval,
      filters: { chainId: chainId || 'all', tokenAddress: tokenAddress || 'all' },
      dataPoints: formattedTimeline.length,
      timeline: formattedTimeline
    });
  } catch (error) {
    console.error('❌ Error fetching timeline analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch timeline analytics' 
    });
  }
});

// ==================== TOKEN ANALYTICS ====================

// Get orders by token with time-based analytics
router.get('/by-token', async (req, res) => {
  try {
    const { range = '24h', chainId, tokenAddress } = req.query;
    
    if (!isValidTimeRange(range)) {
      return res.status(400).json({ 
        error: 'Invalid time range. Use: 12h, 24h, day, month, year or formats like 7d, 30d' 
      });
    }
    
    const match = buildMatchQuery({ range, chainId });
    
    // If specific token requested
    if (tokenAddress) {
      match.tokenAddress = tokenAddress.toLowerCase();
      
      const [tokenStats, recentOrders] = await Promise.all([
        Order.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                token: '$tokenAddress',
                chain: '$chainId'
              },
              orderCount: { $sum: 1 },
              totalVolume: { 
                $sum: { 
                  $toDouble: { 
                    $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                  } 
                } 
              },
              uniqueUsers: { $addToSet: '$userWallet' },
              avgAmount: { 
                $avg: { 
                  $toDouble: { 
                    $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                  } 
                } 
              },
              minAmount: { 
                $min: { 
                  $toDouble: { 
                    $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                  } 
                } 
              },
              maxAmount: { 
                $max: { 
                  $toDouble: { 
                    $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                  } 
                } 
              }
            }
          }
        ]),
        Order.find(match)
          .sort({ timestamp: -1 })
          .limit(10)
          .lean()
      ]);
      
      if (tokenStats.length === 0) {
        return res.json({
          range,
          tokenAddress,
          chainId: chainId || 'all',
          stats: null,
          message: 'No orders found for this token in the specified time range'
        });
      }
      
      const stats = tokenStats[0];
      res.json({
        range,
        tokenAddress,
        chainId: stats._id.chain,
        stats: {
          orderCount: stats.orderCount,
          totalVolume: stats.totalVolume,
          uniqueUsers: stats.uniqueUsers.length,
          averageAmount: stats.avgAmount,
          minAmount: stats.minAmount,
          maxAmount: stats.maxAmount
        },
        recentOrders: recentOrders.map(order => ({
          orderId: order.orderId,
          userWallet: order.userWallet,
          amount: convertAmount(order.amount),
          timestamp: order.timestamp,
          transactionHash: order.transactionHash
        }))
      });
    } else {
      // Get stats for all tokens
      const tokenStats = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              token: '$tokenAddress',
              chain: '$chainId'
            },
            orderCount: { $sum: 1 },
            totalVolume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            },
            uniqueUsers: { $addToSet: '$userWallet' },
            avgAmount: { 
              $avg: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { totalVolume: -1 } }
      ]);
      
      res.json({
        range,
        chainId: chainId || 'all',
        totalTokens: tokenStats.length,
        tokens: tokenStats.map(token => ({
          tokenAddress: token._id.token,
          chainId: token._id.chain,
          orderCount: token.orderCount,
          totalVolume: token.totalVolume,
          uniqueUsers: token.uniqueUsers.length,
          averageAmount: token.avgAmount
        }))
      });
    }
  } catch (error) {
    console.error('❌ Error fetching token analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch token analytics' 
    });
  }
});

// ==================== CHAIN ANALYTICS ====================

// Get orders by chain with breakdown
router.get('/by-chain', async (req, res) => {
  try {
    const { range = '24h', chainId } = req.query;
    
    if (!isValidTimeRange(range)) {
      return res.status(400).json({ 
        error: 'Invalid time range. Use: 12h, 24h, day, month, year or formats like 7d, 30d' 
      });
    }
    
    const match = buildMatchQuery({ range });
    
    // If specific chain requested
    if (chainId) {
      match.chainId = parseInt(chainId);
      
      const [chainStats, tokenBreakdown, topUsers] = await Promise.all([
        Order.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$chainId',
              orderCount: { $sum: 1 },
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
        Order.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$tokenAddress',
              orderCount: { $sum: 1 },
              totalVolume: { 
                $sum: { 
                  $toDouble: { 
                    $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                  } 
                } 
              }
            }
          },
          { $sort: { totalVolume: -1 } },
          { $limit: 10 }
        ]),
        Order.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$userWallet',
              orderCount: { $sum: 1 },
              totalVolume: { 
                $sum: { 
                  $toDouble: { 
                    $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                  } 
                } 
              }
            }
          },
          { $sort: { totalVolume: -1 } },
          { $limit: 10 }
        ])
      ]);
      
      if (chainStats.length === 0) {
        return res.json({
          range,
          chainId: parseInt(chainId),
          stats: null,
          message: 'No orders found for this chain in the specified time range'
        });
      }
      
      const stats = chainStats[0];
      const chainConfig = Object.values(CONTRACTS).find(c => c.chainId === parseInt(chainId));
      
      res.json({
        range,
        chainId: parseInt(chainId),
        chainName: chainConfig?.name || 'Unknown',
        stats: {
          orderCount: stats.orderCount,
          totalVolume: stats.totalVolume,
          uniqueUsers: stats.uniqueUsers.length,
          uniqueTokens: stats.uniqueTokens.length,
          averageAmount: stats.avgAmount
        },
        topTokens: tokenBreakdown.map(token => ({
          tokenAddress: token._id,
          orderCount: token.orderCount,
          totalVolume: token.totalVolume
        })),
        topUsers: topUsers.map(user => ({
          userWallet: user._id,
          orderCount: user.orderCount,
          totalVolume: user.totalVolume
        }))
      });
    } else {
      // Get stats for all chains
      const chainStats = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$chainId',
            orderCount: { $sum: 1 },
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
        },
        { $sort: { totalVolume: -1 } }
      ]);
      
      res.json({
        range,
        totalChains: chainStats.length,
        chains: chainStats.map(chain => {
          const chainConfig = Object.values(CONTRACTS).find(c => c.chainId === chain._id);
          return {
            chainId: chain._id,
            chainName: chainConfig?.name || 'Unknown',
            orderCount: chain.orderCount,
            totalVolume: chain.totalVolume,
            uniqueUsers: chain.uniqueUsers.length,
            uniqueTokens: chain.uniqueTokens.length,
            averageAmount: chain.avgAmount
          };
        })
      });
    }
  } catch (error) {
    console.error('❌ Error fetching chain analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch chain analytics' 
    });
  }
});

// ==================== USER ANALYTICS ====================

// Get comprehensive user analytics
router.get('/user/:userWallet', async (req, res) => {
  try {
    const { userWallet } = req.params;
    const { range = '24h', chainId, tokenAddress } = req.query;
    
    if (!isValidTimeRange(range)) {
      return res.status(400).json({ 
        error: 'Invalid time range. Use: 12h, 24h, day, month, year or formats like 7d, 30d' 
      });
    }
    
    const match = buildMatchQuery({ 
      range, 
      chainId, 
      tokenAddress, 
      userWallet 
    });
    
    const [userStats, chainBreakdown, tokenBreakdown, recentOrders] = await Promise.all([
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$userWallet',
            orderCount: { $sum: 1 },
            totalVolume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            },
            uniqueChains: { $addToSet: '$chainId' },
            uniqueTokens: { $addToSet: '$tokenAddress' },
            avgAmount: { 
              $avg: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            },
            firstOrder: { $min: '$timestamp' },
            lastOrder: { $max: '$timestamp' }
          }
        }
      ]),
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$chainId',
            orderCount: { $sum: 1 },
            totalVolume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { totalVolume: -1 } }
      ]),
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$tokenAddress',
            orderCount: { $sum: 1 },
            totalVolume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { totalVolume: -1 } }
      ]),
      Order.find(match)
        .sort({ timestamp: -1 })
        .limit(20)
        .lean()
    ]);
    
    if (userStats.length === 0) {
      return res.json({
        range,
        userWallet: userWallet.toLowerCase(),
        filters: { chainId: chainId || 'all', tokenAddress: tokenAddress || 'all' },
        stats: null,
        message: 'No orders found for this user in the specified time range'
      });
    }
    
    const stats = userStats[0];
    
    res.json({
      range,
      userWallet: userWallet.toLowerCase(),
      filters: { chainId: chainId || 'all', tokenAddress: tokenAddress || 'all' },
      stats: {
        orderCount: stats.orderCount,
        totalVolume: stats.totalVolume,
        uniqueChains: stats.uniqueChains.length,
        uniqueTokens: stats.uniqueTokens.length,
        averageAmount: stats.avgAmount,
        firstOrder: stats.firstOrder,
        lastOrder: stats.lastOrder
      },
      chainBreakdown: chainBreakdown.map(chain => {
        const chainConfig = Object.values(CONTRACTS).find(c => c.chainId === chain._id);
        return {
          chainId: chain._id,
          chainName: chainConfig?.name || 'Unknown',
          orderCount: chain.orderCount,
          totalVolume: chain.totalVolume
        };
      }),
      tokenBreakdown: tokenBreakdown.map(token => ({
        tokenAddress: token._id,
        orderCount: token.orderCount,
        totalVolume: token.totalVolume
      })),
      recentOrders: recentOrders.map(order => ({
        orderId: order.orderId,
        chainId: order.chainId,
        tokenAddress: order.tokenAddress,
        amount: convertAmount(order.amount),
        timestamp: order.timestamp,
        transactionHash: order.transactionHash
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching user analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user analytics' 
    });
  }
});

// ==================== COMBINED ANALYTICS ====================

// Get comprehensive summary across all dimensions
router.get('/summary', async (req, res) => {
  try {
    const { range = '24h', chainId, tokenAddress } = req.query;
    
    if (!isValidTimeRange(range)) {
      return res.status(400).json({ 
        error: 'Invalid time range. Use: 12h, 24h, day, month, year or formats like 7d, 30d' 
      });
    }
    
    const match = buildMatchQuery({ range, chainId, tokenAddress });
    
    const [overallStats, chainStats, tokenStats, topUsers] = await Promise.all([
      Order.aggregate([
        { $match: match },
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
            uniqueChains: { $addToSet: '$chainId' },
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
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$chainId',
            orderCount: { $sum: 1 },
            totalVolume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { totalVolume: -1 } }
      ]),
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$tokenAddress',
            orderCount: { $sum: 1 },
            totalVolume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { totalVolume: -1 } },
        { $limit: 10 }
      ]),
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$userWallet',
            orderCount: { $sum: 1 },
            totalVolume: { 
              $sum: { 
                $toDouble: { 
                  $divide: [{ $toLong: "$amount" }, 1000000000000000000] 
                } 
              } 
            }
          }
        },
        { $sort: { totalVolume: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    const stats = overallStats[0] || {
      totalOrders: 0,
      totalVolume: 0,
      uniqueUsers: [],
      uniqueTokens: [],
      uniqueChains: [],
      avgAmount: 0
    };
    
    res.json({
      range,
      filters: { chainId: chainId || 'all', tokenAddress: tokenAddress || 'all' },
      summary: {
        totalOrders: stats.totalOrders,
        totalVolume: stats.totalVolume,
        uniqueUsers: stats.uniqueUsers.length,
        uniqueTokens: stats.uniqueTokens.length,
        uniqueChains: stats.uniqueChains.length,
        averageAmount: stats.avgAmount
      },
      chainBreakdown: chainStats.map(chain => {
        const chainConfig = Object.values(CONTRACTS).find(c => c.chainId === chain._id);
        return {
          chainId: chain._id,
          chainName: chainConfig?.name || 'Unknown',
          orderCount: chain.orderCount,
          totalVolume: chain.totalVolume,
          percentageOfTotal: stats.totalVolume > 0 ? (chain.totalVolume / stats.totalVolume * 100).toFixed(2) : 0
        };
      }),
      topTokens: tokenStats.map(token => ({
        tokenAddress: token._id,
        orderCount: token.orderCount,
        totalVolume: token.totalVolume,
        percentageOfTotal: stats.totalVolume > 0 ? (token.totalVolume / stats.totalVolume * 100).toFixed(2) : 0
      })),
      topUsers: topUsers.map(user => ({
        userWallet: user._id,
        orderCount: user.orderCount,
        totalVolume: user.totalVolume,
        percentageOfTotal: stats.totalVolume > 0 ? (user.totalVolume / stats.totalVolume * 100).toFixed(2) : 0
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching summary analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch summary analytics' 
    });
  }
});

module.exports = router;
