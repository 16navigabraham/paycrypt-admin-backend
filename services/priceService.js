const axios = require('axios');

const PRICE_API_URL = process.env.PRICE_API_URL || 'https://paycrypt-margin-price.onrender.com';

// Token address to CoinGecko ID mapping
const TOKEN_ID_MAP = {
  // Add your token addresses and their CoinGecko IDs
  // These will need to be configured based on your actual token addresses
  'usdt': 'tether',
  'usdc': 'usd-coin',
  'send': 'send-token-2',
  'cusd': 'celo-dollar',
  'celo': 'celo',
  'btc': 'bitcoin',
  'eth': 'ethereum',
  'bnb': 'binancecoin',
  'ada': 'cardano',
  'sol': 'solana',
  'matic': 'polygon',
  'link': 'chainlink'
};

class PriceService {
  constructor() {
    this.priceCache = new Map();
    this.cacheExpiry = 300000; // 5 minute cache to avoid rate limiting
    this.lastApiCall = 0;
    this.minTimeBetweenCalls = 10000; // Minimum 10 seconds between API calls
  }

  /**
   * Get token symbol from name (simple heuristic)
   */
  getTokenSymbol(tokenName) {
    const name = tokenName.toLowerCase();
    
    if (name.includes('usdt') || name.includes('tether')) return 'usdt';
    if (name.includes('usdc') || name.includes('usd coin')) return 'usdc';
    if (name.includes('send')) return 'send';
    if (name.includes('cusd') || name.includes('celo dollar')) return 'cusd';
    if (name.includes('celo') && !name.includes('dollar')) return 'celo';
    if (name.includes('bitcoin') || name.includes('btc')) return 'btc';
    if (name.includes('ethereum') || name.includes('eth')) return 'eth';
    
    return null;
  }

  /**
   * Get CoinGecko ID from token symbol
   */
  getCoinGeckoId(tokenSymbol) {
    if (!tokenSymbol) return null;
    return TOKEN_ID_MAP[tokenSymbol.toLowerCase()] || null;
  }

  /**
   * Fetch prices for multiple tokens from the price API
   */
  async fetchPrices(coinGeckoIds) {
    if (!coinGeckoIds || coinGeckoIds.length === 0) {
      return {};
    }

    const uniqueIds = [...new Set(coinGeckoIds)];
    
    // Check cache first for all IDs
    const now = Date.now();
    const allCached = uniqueIds.every(id => {
      const cached = this.priceCache.get(id);
      return cached && (now - cached.timestamp) < this.cacheExpiry;
    });
    
    if (allCached) {
      console.log('💰 Using cached prices (cache valid)');
      const cachedPrices = {};
      for (const id of uniqueIds) {
        const cached = this.priceCache.get(id);
        if (cached) {
          cachedPrices[id] = cached.prices;
        }
      }
      return cachedPrices;
    }
    
    // Rate limiting - wait if needed
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < this.minTimeBetweenCalls) {
      const waitTime = this.minTimeBetweenCalls - timeSinceLastCall;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    const ids = uniqueIds.join(',');
    
    try {
      this.lastApiCall = Date.now();
      const response = await axios.get(`${PRICE_API_URL}/api/v3/simple/price`, {
        params: {
          ids,
          vs_currencies: 'usd,ngn'
        },
        timeout: 10000
      });

      // Cache the results
      const timestamp = Date.now();
      for (const [id, prices] of Object.entries(response.data)) {
        this.priceCache.set(id, { prices, timestamp });
      }

      return response.data;
    } catch (error) {
      console.error('❌ Error fetching prices from API:', error.message);
      
      // Return cached prices if available
      const cachedPrices = {};
      for (const id of uniqueIds) {
        const cached = this.priceCache.get(id);
        if (cached) {
          cachedPrices[id] = cached.prices;
        }
      }
      
      if (Object.keys(cachedPrices).length > 0) {
        console.log('⚠️  Using cached prices due to API error');
        return cachedPrices;
      }
      
      throw error;
    }
  }

  /**
   * Get price for a single token
   */
  async getTokenPrice(tokenName) {
    const symbol = this.getTokenSymbol(tokenName);
    if (!symbol) {
      console.warn(`⚠️  Unknown token: ${tokenName}`);
      return null;
    }

    const coinGeckoId = this.getCoinGeckoId(symbol);
    if (!coinGeckoId) {
      console.warn(`⚠️  No CoinGecko ID for symbol: ${symbol}`);
      return null;
    }

    // Check cache first
    const cached = this.priceCache.get(coinGeckoId);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.prices;
    }

    // Fetch fresh price
    const prices = await this.fetchPrices([coinGeckoId]);
    return prices[coinGeckoId] || null;
  }

  /**
   * Convert token amount to USD/NGN
   */
  convertAmount(amount, decimals, priceData) {
    if (!priceData || !priceData.usd || !priceData.ngn) {
      return null;
    }

    try {
      // Convert from wei to token amount
      const tokenAmount = Number(amount) / Math.pow(10, decimals);
      
      return {
        tokenAmount,
        usd: tokenAmount * priceData.usd,
        ngn: tokenAmount * priceData.ngn
      };
    } catch (error) {
      console.error('❌ Error converting amount:', error);
      return null;
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.priceCache.clear();
  }
}

// Export singleton instance
module.exports = new PriceService();
