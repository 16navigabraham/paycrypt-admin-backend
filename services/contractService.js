const { ethers } = require('ethers');
const { CONTRACT_ADDRESS, CONTRACT_ABI } = require('../config/contract');

class ContractService {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.initialized = false;
  }

  initialize() {
    try {
      console.log('🔗 Initializing contract service...');
      
      if (!process.env.RPC_URL) {
        throw new Error('RPC_URL not provided in environment variables');
      }

      this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);
      this.initialized = true;
      
      console.log('✅ Contract service initialized successfully');
      console.log(`📋 Contract Address: ${CONTRACT_ADDRESS}`);
    } catch (error) {
      console.error('❌ Failed to initialize contract service:', error);
      throw error;
    }
  }

  async getContractMetrics() {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    try {
      console.log('📊 Fetching contract metrics...');
      
      const [orderCount, totalVolume, successfulOrders, failedOrders] = await Promise.all([
        this.contract.getOrderCounter(),
        this.contract.getTotalVolume(),
        this.contract.getTotalSuccessfulOrders(),
        this.contract.getTotalFailedOrders()
      ]);

      const metrics = {
        orderCount: orderCount.toString(),
        totalVolume: totalVolume.toString(),
        successfulOrders: successfulOrders.toString(),
        failedOrders: failedOrders.toString(),
        timestamp: new Date()
      };

      console.log('✅ Contract metrics fetched:', {
        orderCount: metrics.orderCount,
        totalVolume: metrics.totalVolume,
        successfulOrders: metrics.successfulOrders,
        failedOrders: metrics.failedOrders
      });

      return metrics;
    } catch (error) {
      console.error('❌ Error fetching contract metrics:', error);
      throw error;
    }
  }

  async getOrderCreatedEvents(fromBlock = 0, toBlock = 'latest') {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }

    try {
      console.log(`🔍 Fetching OrderCreated events from block ${fromBlock} to ${toBlock}...`);
      
      const filter = this.contract.filters.OrderCreated();
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
      
      console.log(`📦 Found ${events.length} OrderCreated events`);

      const orders = await Promise.all(events.map(async (event) => {
        try {
          const block = await event.getBlock();
          return {
            orderId: event.args.orderId.toString(),
            requestId: event.args.requestId,
            userWallet: event.args.user.toLowerCase(),
            tokenAddress: event.args.tokenAddress.toLowerCase(),
            amount: event.args.amount.toString(),
            txnHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: new Date(block.timestamp * 1000)
          };
        } catch (error) {
          console.error(`❌ Error processing event ${event.transactionHash}:`, error);
          return null;
        }
      }));

      // Filter out null values from failed event processing
      const validOrders = orders.filter(order => order !== null);
      console.log(`✅ Successfully processed ${validOrders.length} orders`);

      return validOrders;
    } catch (error) {
      console.error('❌ Error fetching OrderCreated events:', error);
      throw error;
    }
  }

  async getCurrentBlockNumber() {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }
    
    try {
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`📊 Current block number: ${blockNumber}`);
      return blockNumber;
    } catch (error) {
      console.error('❌ Error fetching current block number:', error);
      throw error;
    }
  }

  async getBlockTimestamp(blockNumber) {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }
    
    try {
      const block = await this.provider.getBlock(blockNumber);
      return new Date(block.timestamp * 1000);
    } catch (error) {
      console.error(`❌ Error fetching block ${blockNumber} timestamp:`, error);
      throw error;
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

// Export singleton instance
module.exports = new ContractService();