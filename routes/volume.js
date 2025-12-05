const express = require('express');
const router = express.Router();
const contractService = require('../services/contractService');
const priceService = require('../services/priceService');
const TotalVolume = require('../models/TotalVolume');

/**
 * Calculate total volume across all tokens and chains
 */
async function calculateTotalVolume() {
  try {
    console.log('💰 Calculating total volume across all chains...');
    
    // Get all tokens from all chains
    const allTokens = await contractService.getAllTokensAcrossChains();
    
    if (allTokens.length === 0) {
      throw new Error('No tokens found across any chain');
    }

    console.log(`📊 Found ${allTokens.length} tokens across all chains`);

    // Get unique token names/symbols for price fetching
    const tokenNames = allTokens
      .filter(token => token.isActive && token.totalVolume !== '0')
      .map(token => token.name);

    // Get CoinGecko IDs for all tokens
    const coinGeckoIds = tokenNames
      .map(name => {
        const symbol = priceService.getTokenSymbol(name);
        return symbol ? priceService.getCoinGeckoId(symbol) : null;
      })
      .filter(id => id !== null);

    // Fetch all prices at once
    const prices = await priceService.fetchPrices(coinGeckoIds);
    
    // Calculate volume for each token
    let totalUSD = 0;
    let totalNGN = 0;
    const tokenBreakdown = [];

    for (const token of allTokens) {
      if (!token.isActive || token.totalVolume === '0') {
        continue;
      }

      const symbol = priceService.getTokenSymbol(token.name);
      const coinGeckoId = symbol ? priceService.getCoinGeckoId(symbol) : null;
      const priceData = coinGeckoId ? prices[coinGeckoId] : null;

      if (!priceData) {
        console.warn(`⚠️  No price data for token: ${token.name} (${token.tokenAddress})`);
        continue;
      }

      // Convert volume to USD and NGN
      const converted = priceService.convertAmount(
        token.totalVolume,
        token.decimals,
        priceData
      );

      if (converted) {
        totalUSD += converted.usd;
        totalNGN += converted.ngn;

        tokenBreakdown.push({
          chainId: token.chainId,
          tokenAddress: token.tokenAddress.toLowerCase(),
          tokenName: token.name,
          tokenSymbol: symbol || 'UNKNOWN',
          totalVolume: token.totalVolume,
          volumeUSD: converted.usd,
          volumeNGN: converted.ngn,
          priceUSD: priceData.usd,
          priceNGN: priceData.ngn
        });
      }
    }

    console.log(`✅ Total volume calculated: $${totalUSD.toFixed(2)} USD / ₦${totalNGN.toFixed(2)} NGN`);

    return {
      totalVolumeUSD: totalUSD,
      totalVolumeNGN: totalNGN,
      tokenBreakdown,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ Error calculating total volume:', error);
    throw error;
  }
}

/**
 * GET /api/volume/total
 * Get current total volume in USD and NGN
 */
router.get('/total', async (req, res) => {
  try {
    if (!contractService.isInitialized()) {
      return res.status(503).json({ 
        error: 'Contract service not initialized' 
      });
    }

    const volumeData = await calculateTotalVolume();
    
    // Save to database for historical tracking
    const totalVolume = new TotalVolume(volumeData);
    await totalVolume.save();

    res.json({
      success: true,
      data: {
        totalVolumeUSD: volumeData.totalVolumeUSD.toFixed(2),
        totalVolumeNGN: volumeData.totalVolumeNGN.toFixed(2),
        tokenCount: volumeData.tokenBreakdown.length,
        tokens: volumeData.tokenBreakdown,
        timestamp: volumeData.timestamp
      }
    });
  } catch (error) {
    console.error('❌ Error fetching total volume:', error);
    res.status(500).json({ 
      error: 'Failed to fetch total volume',
      message: error.message
    });
  }
});

/**
 * GET /api/volume/chart
 * Get volume history for charts (3h, 12h, 24h intervals)
 */
router.get('/chart', async (req, res) => {
  try {
    const { interval = '24h' } = req.query;
    
    // Parse interval
    let hours;
    const match = interval.match(/^(\d+)h$/);
    if (!match) {
      return res.status(400).json({ 
        error: 'Invalid interval format. Use: 3h, 12h, or 24h' 
      });
    }
    
    hours = parseInt(match[1]);
    if (![3, 12, 24].includes(hours)) {
      return res.status(400).json({ 
        error: 'Invalid interval. Supported: 3h, 12h, 24h' 
      });
    }

    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const volumeHistory = await TotalVolume.getHistory(startTime);

    if (volumeHistory.length === 0) {
      // No historical data, calculate current
      const currentVolume = await calculateTotalVolume();
      const totalVolume = new TotalVolume(currentVolume);
      await totalVolume.save();
      
      return res.json({
        success: true,
        interval,
        dataPoints: 1,
        data: [{
          timestamp: currentVolume.timestamp,
          totalVolumeUSD: currentVolume.totalVolumeUSD.toFixed(2),
          totalVolumeNGN: currentVolume.totalVolumeNGN.toFixed(2)
        }]
      });
    }

    // Format data for chart
    const chartData = volumeHistory.map(snapshot => ({
      timestamp: snapshot.timestamp,
      totalVolumeUSD: snapshot.totalVolumeUSD.toFixed(2),
      totalVolumeNGN: snapshot.totalVolumeNGN.toFixed(2)
    }));

    // Calculate statistics
    const volumes = volumeHistory.map(s => s.totalVolumeUSD);
    const latestVolume = volumes[volumes.length - 1];
    const earliestVolume = volumes[0];
    const change = latestVolume - earliestVolume;
    const changePercent = earliestVolume > 0 
      ? ((change / earliestVolume) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      interval,
      dataPoints: chartData.length,
      statistics: {
        latestVolumeUSD: latestVolume.toFixed(2),
        earliestVolumeUSD: earliestVolume.toFixed(2),
        changeUSD: change.toFixed(2),
        changePercent: `${changePercent}%`,
        minVolumeUSD: Math.min(...volumes).toFixed(2),
        maxVolumeUSD: Math.max(...volumes).toFixed(2),
        avgVolumeUSD: (volumes.reduce((a, b) => a + b, 0) / volumes.length).toFixed(2)
      },
      data: chartData
    });
  } catch (error) {
    console.error('❌ Error fetching volume chart data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch volume chart data',
      message: error.message
    });
  }
});

/**
 * GET /api/volume/latest
 * Get latest cached volume data (fast)
 */
router.get('/latest', async (req, res) => {
  try {
    const latest = await TotalVolume.getLatest();
    
    if (!latest) {
      return res.status(404).json({ 
        error: 'No volume data available yet',
        message: 'Try calling /api/volume/total first to generate data'
      });
    }

    const ageMinutes = (Date.now() - latest.timestamp.getTime()) / (1000 * 60);

    res.json({
      success: true,
      data: {
        totalVolumeUSD: latest.totalVolumeUSD.toFixed(2),
        totalVolumeNGN: latest.totalVolumeNGN.toFixed(2),
        tokenCount: latest.tokenBreakdown.length,
        tokens: latest.tokenBreakdown,
        timestamp: latest.timestamp,
        ageMinutes: ageMinutes.toFixed(1)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching latest volume:', error);
    res.status(500).json({ 
      error: 'Failed to fetch latest volume',
      message: error.message
    });
  }
});

/**
 * GET /api/volume/by-chain
 * Get volume breakdown by blockchain
 */
router.get('/by-chain', async (req, res) => {
  try {
    const latest = await TotalVolume.getLatest();
    
    if (!latest) {
      return res.status(404).json({ 
        error: 'No volume data available yet'
      });
    }

    // Group by chain
    const byChain = {};
    for (const token of latest.tokenBreakdown) {
      if (!byChain[token.chainId]) {
        byChain[token.chainId] = {
          chainId: token.chainId,
          volumeUSD: 0,
          volumeNGN: 0,
          tokens: []
        };
      }
      
      byChain[token.chainId].volumeUSD += token.volumeUSD;
      byChain[token.chainId].volumeNGN += token.volumeNGN;
      byChain[token.chainId].tokens.push(token);
    }

    res.json({
      success: true,
      data: {
        totalVolumeUSD: latest.totalVolumeUSD.toFixed(2),
        totalVolumeNGN: latest.totalVolumeNGN.toFixed(2),
        byChain: Object.values(byChain).map(chain => ({
          ...chain,
          volumeUSD: chain.volumeUSD.toFixed(2),
          volumeNGN: chain.volumeNGN.toFixed(2),
          tokenCount: chain.tokens.length
        })),
        timestamp: latest.timestamp
      }
    });
  } catch (error) {
    console.error('❌ Error fetching volume by chain:', error);
    res.status(500).json({ 
      error: 'Failed to fetch volume by chain',
      message: error.message
    });
  }
});

module.exports = router;
