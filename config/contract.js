const CONTRACT_ADDRESS = "0x0574A0941Ca659D01CF7370E37492bd2DF43128d";

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
    "inputs": [{"internalType": "bytes32", "name": "requestId", "type": "bytes32"}, {"internalType": "address", "name": "tokenAddress", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
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
  }
];

module.exports = {
  CONTRACT_ADDRESS,
  CONTRACT_ABI
};