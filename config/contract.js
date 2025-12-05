// Multi-chain contract configuration
const CONTRACTS = {
  base: {
    chainId: 8453,
    name: 'Base',
    address: '0x0574A0941Ca659D01CF7370E37492bd2DF43128d',
    explorer: 'https://basescan.org',
    rpcUrl: process.env.BASE_RPC_URL || process.env.RPC_URL
  },
  lisk: {
    chainId: 1135,
    name: 'Lisk',
    address: '0x7Ca0a469164655AF07d27cf4bdA5e77F36Ab820A',
    explorer: 'https://blockscout.lisk.com',
    rpcUrl: process.env.LISK_RPC_URL
  },
  celo: {
    chainId: 42220,
    name: 'Celo',
    address: '0xBC955DC38a13c2Cd8736DA1bC791514504202F9D',
    explorer: 'https://celoscan.io',
    rpcUrl: process.env.CELO_RPC_URL
  }
};

// Default to Base for backward compatibility
const CONTRACT_ADDRESS = CONTRACTS.base.address;

// Helper function to get contract config by chain ID
function getContractByChainId(chainId) {
  const chain = Object.values(CONTRACTS).find(c => c.chainId === chainId);
  return chain || CONTRACTS.base;
}

// Helper function to get contract address by chain ID
function getContractAddress(chainId) {
  return getContractByChainId(chainId).address;
}

// Helper function to get explorer URL by chain ID
function getExplorerUrl(chainId) {
  return getContractByChainId(chainId).explorer;
}

// Helper function to get all enabled chains
function getEnabledChains() {
  return Object.entries(CONTRACTS)
    .filter(([key, config]) => config.rpcUrl)
    .map(([key, config]) => ({ key, ...config }));
}

const CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "devWallet_", "type": "address"},
      {"internalType": "address", "name": "initialOwner_", "type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "BlacklistedUser",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExceedsOrderLimit",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientAllowance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidOrderId",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAuthorized",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OrderAlreadyProcessed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OrderNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TokenAlreadySupported",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnsupportedToken",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroAmount",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "orderId", "type": "uint256"},
      {"indexed": true, "internalType": "bytes32", "name": "requestId", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "address", "name": "tokenAddress", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "OrderCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "orderId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "address", "name": "tokenAddress", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "OrderSuccessful",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "orderId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "address", "name": "tokenAddress", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "OrderFailed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "tokenAddress", "type": "address"},
      {"indexed": false, "internalType": "string", "name": "name", "type": "string"},
      {"indexed": false, "internalType": "uint8", "name": "decimals", "type": "uint8"}
    ],
    "name": "TokenAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "tokenAddress", "type": "address"},
      {"indexed": false, "internalType": "bool", "name": "status", "type": "bool"}
    ],
    "name": "TokenStatusUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "getOrderCounter",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalVolume",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalSuccessfulOrders",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalFailedOrders",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "requestId", "type": "bytes32"},
      {"internalType": "address", "name": "tokenAddress", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "createOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "orderId", "type": "uint256"}],
    "name": "getOrder",
    "outputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "orderId", "type": "uint256"},
          {"internalType": "bytes32", "name": "requestId", "type": "bytes32"},
          {"internalType": "address", "name": "user", "type": "address"},
          {"internalType": "address", "name": "tokenAddress", "type": "address"},
          {"internalType": "uint256", "name": "amount", "type": "uint256"},
          {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
          {"internalType": "uint256", "name": "processedTimestamp", "type": "uint256"},
          {"internalType": "enum Paycrypt.OrderStatus", "name": "status", "type": "uint8"}
        ],
        "internalType": "struct Paycrypt.Order",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSupportedTokens",
    "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "tokenAddress", "type": "address"}],
    "name": "getTokenDetails",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "tokenAddress", "type": "address"},
          {"internalType": "uint256", "name": "orderLimit", "type": "uint256"},
          {"internalType": "uint256", "name": "totalVolume", "type": "uint256"},
          {"internalType": "uint256", "name": "successfulOrders", "type": "uint256"},
          {"internalType": "uint256", "name": "failedOrders", "type": "uint256"},
          {"internalType": "string", "name": "name", "type": "string"},
          {"internalType": "uint8", "name": "decimals", "type": "uint8"},
          {"internalType": "bool", "name": "isActive", "type": "bool"}
        ],
        "internalType": "struct Paycrypt.SupportedToken",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "tokenAddress", "type": "address"}],
    "name": "isTokenSupported",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getUserOrders",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "tokenAddress", "type": "address"}
    ],
    "name": "checkBalance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "tokenAddress", "type": "address"}
    ],
    "name": "checkAllowance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "version",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "pure",
    "type": "function"
  }
];

module.exports = {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  CONTRACTS,
  getContractByChainId,
  getContractAddress,
  getExplorerUrl,
  getEnabledChains
};