const { ethers } = require('ethers');
const { CONTRACT_ABI, CONTRACTS, getEnabledChains, getContractByChainId } = require('../config/contract');

class ContractService {
  constructor() {
    this.chains = new Map(); // Map of chainId -> { provider, contract, config }
    this.initialized = false;
    this.lastRpcCall = 0;
    this.minTimeBetweenRpcCalls = 1000; // 1 second between RPC calls to prevent rate limiting
  }

  initialize() {
    try {
      console.log('🔗 Initializing multi-chain contract service...');
      
      const enabledChains = getEnabledChains();
      
      if (enabledChains.length === 0) {
        throw new Error('No RPC URLs configured. Please set at least one of: BASE_RPC_URL, LISK_RPC_URL, CELO_RPC_URL');
      }

      // Initialize each enabled chain
      for (const chain of enabledChains) {
        try {
          console.log(`🔗 Initializing ${chain.name} (chainId: ${chain.chainId})...`);
          
          const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
          const contract = new ethers.Contract(chain.address, CONTRACT_ABI, provider);
          
          this.chains.set(chain.chainId, {
            provider,
            contract,
            config: chain
          });
          
          console.log(`✅ ${chain.name} initialized successfully`);
          console.log(`   Contract: ${chain.address}`);
          console.log(`   Explorer: ${chain.explorer}`);
        } catch (error) {
          console.error(`❌ Failed to initialize ${chain.name}:`, error.message);
          // Continue with other chains
        }
      }

      if (this.chains.size === 0) {
        throw new Error('Failed to initialize any blockchain connections');
      }

      this.initialized = true;
      console.log(`✅ Contract service initialized with ${this.chains.size} chain(s)`);
    } catch (error) {
      console.error('❌ Failed to initialize contract service:', error);
      throw error;
    }
  }

  getChain(chainId) {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not initialized or not supported`);
    }
    return chain;
  }

  getEnabledChainIds() {
    return Array.from(this.chains.keys());
  }

  getAllChains() {
    return Array.from(this.chains.entries()).map(([chainId, chain]) => ({
      chainId,
      name: chain.config.name,
      address: chain.config.address,
      explorer: chain.config.explorer
    }));
  }

  /**
   * Apply rate limiting to prevent RPC call throttling
   */
  async applyRpcRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastRpcCall;
    
    if (timeSinceLastCall < this.minTimeBetweenRpcCalls) {
      const waitTime = this.minTimeBetweenRpcCalls - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRpcCall = Date.now();
  }

  async getContractMetrics(chainId) {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    const { contract, config } = this.getChain(chainId);

    try {
      console.log(`📊 Fetching contract metrics for ${config.name} (chainId: ${chainId})...`);
      
      // Apply rate limiting before making RPC calls
      await this.applyRpcRateLimit();
      
      const [orderCount, totalVolume, successfulOrders, failedOrders] = await Promise.all([
        contract.getOrderCounter(),
        contract.getTotalVolume(),
        contract.getTotalSuccessfulOrders(),
        contract.getTotalFailedOrders()
      ]);

      const metrics = {
        chainId,
        orderCount: orderCount.toString(),
        totalVolume: totalVolume.toString(),
        successfulOrders: successfulOrders.toString(),
        failedOrders: failedOrders.toString(),
        timestamp: new Date()
      };

      console.log(`✅ Contract metrics fetched for ${config.name}:`, {
        orderCount: metrics.orderCount,
        totalVolume: metrics.totalVolume,
        successfulOrders: metrics.successfulOrders,
        failedOrders: metrics.failedOrders
      });

      return metrics;
    } catch (error) {
      console.error(`❌ Error fetching contract metrics for ${config.name}:`, error);
      throw error;
    }
  }

  async getAllContractMetrics() {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    const allMetrics = [];
    const chainIds = this.getEnabledChainIds();

    for (const chainId of chainIds) {
      try {
        const metrics = await this.getContractMetrics(chainId);
        allMetrics.push(metrics);
      } catch (error) {
        console.error(`Failed to fetch metrics for chain ${chainId}:`, error.message);
        // Continue with other chains
      }
    }

    return allMetrics;
  }

  async getOrderCreatedEvents(chainId, fromBlock = 0, toBlock = 'latest') {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    const { contract, provider, config } = this.getChain(chainId);

    try {
      console.log(`🔍 Fetching OrderCreated events for ${config.name} from block ${fromBlock} to ${toBlock}...`);
      
      // Apply rate limiting before making RPC calls
      await this.applyRpcRateLimit();
      
      const filter = contract.filters.OrderCreated();
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      
      console.log(`📦 Found ${events.length} OrderCreated events for ${config.name}`);

      const orders = [];
      for (const event of events) {
        try {
          await this.applyRpcRateLimit(); // Rate limit between each block fetch
          const block = await event.getBlock();
          orders.push({
            chainId,
            orderId: event.args.orderId.toString(),
            requestId: event.args.requestId,
            userWallet: event.args.user.toLowerCase(),
            tokenAddress: event.args.tokenAddress.toLowerCase(),
            amount: event.args.amount.toString(),
            txnHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: new Date(block.timestamp * 1000)
          });
        } catch (error) {
          console.error(`❌ Error processing event ${event.transactionHash}:`, error);
          // Continue with next event
        }
      }

      console.log(`✅ Successfully processed ${orders.length} orders for ${config.name}`);

      return orders;
    } catch (error) {
      console.error(`❌ Error fetching OrderCreated events for ${config.name}:`, error);
      throw error;
    }
  }

  async getCurrentBlockNumber(chainId) {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    const { provider, config } = this.getChain(chainId);
    
    try {
      // Apply rate limiting before making RPC calls
      await this.applyRpcRateLimit();
      
      const blockNumber = await provider.getBlockNumber();
      console.log(`📊 Current block number for ${config.name}: ${blockNumber}`);
      return blockNumber;
    } catch (error) {
      console.error(`❌ Error fetching current block number for ${config.name}:`, error);
      throw error;
    }
  }

  async getBlockTimestamp(chainId, blockNumber) {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    const { provider, config } = this.getChain(chainId);
    
    try {
      const block = await provider.getBlock(blockNumber);
      return new Date(block.timestamp * 1000);
    } catch (error) {
      console.error(`❌ Error fetching block ${blockNumber} timestamp for ${config.name}:`, error);
      throw error;
    }
  }

  async getSupportedTokens(chainId) {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    const { contract, config } = this.getChain(chainId);

    try {
      console.log(`🪙 Fetching supported tokens for ${config.name}...`);
      
      // Apply rate limiting before making RPC calls
      await this.applyRpcRateLimit();
      
      const tokenAddresses = await contract.getSupportedTokens();
      console.log(`✅ Found ${tokenAddresses.length} supported tokens on ${config.name}`);
      return tokenAddresses;
    } catch (error) {
      console.error(`❌ Error fetching supported tokens for ${config.name}:`, error);
      throw error;
    }
  }

  async getTokenDetails(chainId, tokenAddress) {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    const { contract, config } = this.getChain(chainId);

    try {
      // Apply rate limiting before making RPC calls
      await this.applyRpcRateLimit();
      
      const details = await contract.getTokenDetails(tokenAddress);
      
      return {
        tokenAddress: details.tokenAddress,
        orderLimit: details.orderLimit.toString(),
        totalVolume: details.totalVolume.toString(),
        successfulOrders: details.successfulOrders.toString(),
        failedOrders: details.failedOrders.toString(),
        name: details.name,
        decimals: details.decimals,
        isActive: details.isActive
      };
    } catch (error) {
      console.error(`❌ Error fetching token details for ${tokenAddress} on ${config.name}:`, error);
      throw error;
    }
  }

  async getAllTokensWithDetails(chainId) {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    try {
      const tokenAddresses = await this.getSupportedTokens(chainId);
      const tokensWithDetails = [];

      for (const tokenAddress of tokenAddresses) {
        try {
          const details = await this.getTokenDetails(chainId, tokenAddress);
          tokensWithDetails.push({
            chainId,
            ...details
          });
        } catch (error) {
          console.error(`⚠️  Failed to get details for token ${tokenAddress}:`, error.message);
          // Continue with other tokens
        }
      }

      return tokensWithDetails;
    } catch (error) {
      console.error(`❌ Error fetching all tokens with details:`, error);
      throw error;
    }
  }

  async getAllTokensAcrossChains() {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    const chainIds = this.getEnabledChainIds();
    const allTokens = [];

    for (const chainId of chainIds) {
      try {
        const tokens = await this.getAllTokensWithDetails(chainId);
        allTokens.push(...tokens);
      } catch (error) {
        console.error(`Failed to fetch tokens for chain ${chainId}:`, error.message);
        // Continue with other chains
      }
    }

    return allTokens;
  }

  isInitialized() {
    return this.initialized;
  }
}

// Export singleton instance
module.exports = new ContractService();