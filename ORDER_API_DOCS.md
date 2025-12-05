# Order Management API Documentation

Complete API documentation for order management, history, and analytics across multiple chains (Base, Lisk, Celo).

**Base URL:** `https://your-api-domain.com/api`

**Last Updated:** December 5, 2025

---

## Table of Contents

1. [Order Data Model](#order-data-model)
2. [Basic Order Endpoints](#basic-order-endpoints)
3. [Order Analytics Endpoints](#order-analytics-endpoints)
4. [Time Range Formats](#time-range-formats)
5. [Multi-Chain Support](#multi-chain-support)
6. [Response Examples](#response-examples)

---

## Order Data Model

### OrderHistoryItem Schema

All order endpoints return data matching this schema:

```typescript
interface OrderHistoryItem {
  orderId: string         // On-chain order ID
  requestId: string       // Request identifier
  userWallet: string      // User's wallet address (lowercase)
  tokenAddress: string    // Token contract address (lowercase)
  amount: string          // Amount in wei (BigInt string)
  txnHash: string         // Transaction hash
  blockNumber: number     // Block number where order was created
  timestamp: string       // ISO 8601 timestamp
  chainId: number         // Chain ID (8453=Base, 1135=Lisk, 42220=Celo)
}
```

### Database Sync

- Orders are synced from blockchain every **12 hours** via cron job
- Fetches `OrderCreated` events from smart contracts
- Automatically prevents duplicate entries using unique compound indexes

---

## Basic Order Endpoints

### 1. Get All Orders (with filtering)

**Endpoint:** `GET /orders`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 50 | Results per page (max 100) |
| `range` | string | - | Time range filter (e.g., `24h`, `7d`, `30d`) |
| `user` | string | - | Filter by user wallet address |
| `token` | string | - | Filter by token address |
| `chainId` | number | - | Filter by chain ID |
| `sort` | string | `timestamp` | Sort field |
| `order` | string | `desc` | Sort order (`asc` or `desc`) |

**Example Request:**
```bash
GET /orders?chainId=8453&range=24h&limit=20&page=1
```

**Example Response:**
```json
{
  "orders": [
    {
      "orderId": "12345",
      "requestId": "req_abc123",
      "userWallet": "0x1234567890abcdef...",
      "tokenAddress": "0xabcdef1234567890...",
      "amount": "1000000000000000000",
      "txnHash": "0xfedcba0987654321...",
      "blockNumber": 15234567,
      "timestamp": "2025-12-05T10:30:00.000Z",
      "chainId": 8453
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  },
  "filters": {
    "chainId": 8453,
    "range": "24h"
  }
}
```

---

### 2. Get Single Order

**Endpoint:** `GET /orders/:orderId`

**URL Parameters:**
- `orderId` - The on-chain order ID

**Query Parameters:**
- `chainId` (optional) - Specify chain if order ID might exist on multiple chains

**Example Request:**
```bash
GET /orders/12345?chainId=8453
```

**Example Response:**
```json
{
  "orderId": "12345",
  "requestId": "req_abc123",
  "userWallet": "0x1234567890abcdef...",
  "tokenAddress": "0xabcdef1234567890...",
  "amount": "1000000000000000000",
  "txnHash": "0xfedcba0987654321...",
  "blockNumber": 15234567,
  "timestamp": "2025-12-05T10:30:00.000Z",
  "chainId": 8453
}
```

---

### 3. Get Orders by User

**Endpoint:** `GET /orders/user/:userWallet`

**URL Parameters:**
- `userWallet` - User's wallet address

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Results per page (default: 50, max: 100)
- `chainId` (optional) - Filter by specific chain

**Example Request:**
```bash
GET /orders/user/0x1234567890abcdef?chainId=8453&limit=10
```

**Example Response:**
```json
{
  "userWallet": "0x1234567890abcdef...",
  "orders": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

---

### 4. Get Orders by Token

**Endpoint:** `GET /orders/token/:tokenAddress`

**URL Parameters:**
- `tokenAddress` - Token contract address

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Results per page (default: 50, max: 100)

**Example Request:**
```bash
GET /orders/token/0xabcdef1234567890
```

---

### 5. Get Recent Orders

**Endpoint:** `GET /orders/recent/:count?`

**URL Parameters:**
- `count` (optional) - Number of recent orders to fetch (default: 10, max: 100)

**Example Request:**
```bash
GET /orders/recent/25
```

**Example Response:**
```json
{
  "orders": [...],
  "count": 25,
  "requested": 25
}
```

---

### 6. Get Legacy Order Analytics Summary

**Endpoint:** `GET /orders/analytics/summary`

**Query Parameters:**
- `range` (optional) - Time range (default: `24h`)

**Example Request:**
```bash
GET /orders/analytics/summary?range=7d
```

**Example Response:**
```json
{
  "range": "7d",
  "summary": {
    "totalOrders": 1250,
    "totalVolume": 456789.123,
    "uniqueUsers": 234,
    "uniqueTokens": 12,
    "averageAmount": 365.43
  },
  "topTokens": [...],
  "topUsers": [...],
  "volumeOverTime": [...]
}
```

---

## Order Analytics Endpoints

Advanced analytics with multi-chain support and flexible time-based filtering.

### 1. Timeline Analytics

**Endpoint:** `GET /order-analytics/timeline`

**Description:** Get order activity over time with customizable intervals.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `range` | string | `24h` | Time range (`12h`, `24h`, `day`, `month`, `year`, or custom like `7d`) |
| `interval` | string | `hour` | Data grouping (`hour`, `day`, `month`) |
| `chainId` | number | - | Filter by specific chain |
| `tokenAddress` | string | - | Filter by specific token |

**Example Request:**
```bash
GET /order-analytics/timeline?range=7d&interval=day&chainId=8453
```

**Example Response:**
```json
{
  "range": "7d",
  "interval": "day",
  "filters": {
    "chainId": 8453,
    "tokenAddress": "all"
  },
  "dataPoints": 7,
  "timeline": [
    {
      "timestamp": "2025-11-29T00:00:00.000Z",
      "orderCount": 145,
      "totalVolume": 12345.67,
      "uniqueUsers": 67,
      "uniqueTokens": 8,
      "averageAmount": 85.14
    },
    {
      "timestamp": "2025-11-30T00:00:00.000Z",
      "orderCount": 198,
      "totalVolume": 18976.32,
      "uniqueUsers": 89,
      "uniqueTokens": 10,
      "averageAmount": 95.84
    }
    // ... 5 more days
  ]
}
```

---

### 2. Token-Based Analytics

**Endpoint:** `GET /order-analytics/by-token`

**Description:** Get order statistics grouped by token with detailed breakdowns.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `range` | string | `24h` | Time range |
| `chainId` | number | - | Filter by specific chain |
| `tokenAddress` | string | - | Get stats for specific token (if omitted, returns all tokens) |

**Example Request (All Tokens):**
```bash
GET /order-analytics/by-token?range=24h&chainId=8453
```

**Example Response (All Tokens):**
```json
{
  "range": "24h",
  "chainId": 8453,
  "totalTokens": 12,
  "tokens": [
    {
      "tokenAddress": "0xabcd...",
      "chainId": 8453,
      "orderCount": 234,
      "totalVolume": 45678.90,
      "uniqueUsers": 89,
      "averageAmount": 195.20
    },
    {
      "tokenAddress": "0xefgh...",
      "chainId": 8453,
      "orderCount": 156,
      "totalVolume": 23456.78,
      "uniqueUsers": 56,
      "averageAmount": 150.36
    }
    // ... more tokens
  ]
}
```

**Example Request (Specific Token):**
```bash
GET /order-analytics/by-token?range=month&chainId=8453&tokenAddress=0xabcd...
```

**Example Response (Specific Token):**
```json
{
  "range": "month",
  "tokenAddress": "0xabcd...",
  "chainId": 8453,
  "stats": {
    "orderCount": 1234,
    "totalVolume": 567890.12,
    "uniqueUsers": 345,
    "averageAmount": 460.21,
    "minAmount": 0.5,
    "maxAmount": 50000.0
  },
  "recentOrders": [
    {
      "orderId": "98765",
      "userWallet": "0x1234...",
      "amount": 1500.0,
      "timestamp": "2025-12-05T14:23:10.000Z",
      "transactionHash": "0xabc..."
    }
    // ... up to 10 recent orders
  ]
}
```

---

### 3. Chain-Based Analytics

**Endpoint:** `GET /order-analytics/by-chain`

**Description:** Get order statistics grouped by blockchain.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `range` | string | `24h` | Time range |
| `chainId` | number | - | Get stats for specific chain (if omitted, returns all chains) |

**Example Request (All Chains):**
```bash
GET /order-analytics/by-chain?range=7d
```

**Example Response (All Chains):**
```json
{
  "range": "7d",
  "totalChains": 3,
  "chains": [
    {
      "chainId": 8453,
      "chainName": "Base",
      "orderCount": 2345,
      "totalVolume": 456789.12,
      "uniqueUsers": 567,
      "uniqueTokens": 15,
      "averageAmount": 194.76
    },
    {
      "chainId": 1135,
      "chainName": "Lisk",
      "orderCount": 1234,
      "totalVolume": 234567.89,
      "uniqueUsers": 345,
      "uniqueTokens": 12,
      "averageAmount": 190.08
    },
    {
      "chainId": 42220,
      "chainName": "Celo",
      "orderCount": 987,
      "totalVolume": 123456.78,
      "uniqueUsers": 234,
      "uniqueTokens": 10,
      "averageAmount": 125.08
    }
  ]
}
```

**Example Request (Specific Chain):**
```bash
GET /order-analytics/by-chain?range=month&chainId=8453
```

**Example Response (Specific Chain):**
```json
{
  "range": "month",
  "chainId": 8453,
  "chainName": "Base",
  "stats": {
    "orderCount": 12345,
    "totalVolume": 2345678.90,
    "uniqueUsers": 1234,
    "uniqueTokens": 18,
    "averageAmount": 190.03
  },
  "topTokens": [
    {
      "tokenAddress": "0xabcd...",
      "orderCount": 3456,
      "totalVolume": 678901.23
    }
    // ... up to 10 tokens
  ],
  "topUsers": [
    {
      "userWallet": "0x1234...",
      "orderCount": 234,
      "totalVolume": 45678.90
    }
    // ... up to 10 users
  ]
}
```

---

### 4. User Analytics

**Endpoint:** `GET /order-analytics/user/:userWallet`

**Description:** Comprehensive analytics for a specific user across all chains and tokens.

**URL Parameters:**
- `userWallet` - User's wallet address

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `range` | string | `24h` | Time range |
| `chainId` | number | - | Filter by specific chain |
| `tokenAddress` | string | - | Filter by specific token |

**Example Request:**
```bash
GET /order-analytics/user/0x1234567890abcdef?range=month&chainId=8453
```

**Example Response:**
```json
{
  "range": "month",
  "userWallet": "0x1234567890abcdef...",
  "filters": {
    "chainId": 8453,
    "tokenAddress": "all"
  },
  "stats": {
    "orderCount": 156,
    "totalVolume": 45678.90,
    "uniqueChains": 2,
    "uniqueTokens": 8,
    "averageAmount": 292.81,
    "firstOrder": "2025-11-05T08:15:30.000Z",
    "lastOrder": "2025-12-05T14:45:22.000Z"
  },
  "chainBreakdown": [
    {
      "chainId": 8453,
      "chainName": "Base",
      "orderCount": 124,
      "totalVolume": 38901.23
    },
    {
      "chainId": 1135,
      "chainName": "Lisk",
      "orderCount": 32,
      "totalVolume": 6777.67
    }
  ],
  "tokenBreakdown": [
    {
      "tokenAddress": "0xabcd...",
      "orderCount": 89,
      "totalVolume": 28901.45
    },
    {
      "tokenAddress": "0xefgh...",
      "orderCount": 45,
      "totalVolume": 12345.67
    }
    // ... more tokens
  ],
  "recentOrders": [
    {
      "orderId": "12345",
      "chainId": 8453,
      "tokenAddress": "0xabcd...",
      "amount": 500.0,
      "timestamp": "2025-12-05T14:45:22.000Z",
      "transactionHash": "0xabc..."
    }
    // ... up to 20 recent orders
  ]
}
```

---

### 5. Comprehensive Summary

**Endpoint:** `GET /order-analytics/summary`

**Description:** Get comprehensive order statistics with breakdowns by chain, token, and top users.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `range` | string | `24h` | Time range |
| `chainId` | number | - | Filter by specific chain |
| `tokenAddress` | string | - | Filter by specific token |

**Example Request:**
```bash
GET /order-analytics/summary?range=7d
```

**Example Response:**
```json
{
  "range": "7d",
  "filters": {
    "chainId": "all",
    "tokenAddress": "all"
  },
  "summary": {
    "totalOrders": 4566,
    "totalVolume": 814813.79,
    "uniqueUsers": 1146,
    "uniqueTokens": 25,
    "uniqueChains": 3,
    "averageAmount": 178.45
  },
  "chainBreakdown": [
    {
      "chainId": 8453,
      "chainName": "Base",
      "orderCount": 2345,
      "totalVolume": 456789.12,
      "percentageOfTotal": "56.06"
    },
    {
      "chainId": 1135,
      "chainName": "Lisk",
      "orderCount": 1234,
      "totalVolume": 234567.89,
      "percentageOfTotal": "28.79"
    },
    {
      "chainId": 42220,
      "chainName": "Celo",
      "orderCount": 987,
      "totalVolume": 123456.78,
      "percentageOfTotal": "15.15"
    }
  ],
  "topTokens": [
    {
      "tokenAddress": "0xabcd...",
      "orderCount": 1234,
      "totalVolume": 234567.89,
      "percentageOfTotal": "28.79"
    }
    // ... up to 10 tokens
  ],
  "topUsers": [
    {
      "userWallet": "0x1234...",
      "orderCount": 234,
      "totalVolume": 45678.90,
      "percentageOfTotal": "5.61"
    }
    // ... up to 10 users
  ]
}
```

---

## Time Range Formats

### Standard Periods

The following standard time periods are supported:

| Format | Description | Duration |
|--------|-------------|----------|
| `12h` | Last 12 hours | 12 hours |
| `24h` | Last 24 hours | 24 hours |
| `day` | Last day (same as 24h) | 24 hours |
| `month` | Last 30 days | 30 days |
| `year` | Last 365 days | 365 days |

### Custom Formats

You can also specify custom time ranges using the format: `{number}{unit}`

**Units:**
- `h` - hours
- `d` - days  
- `w` - weeks
- `m` - months (30 days)

**Examples:**
- `6h` - Last 6 hours
- `3d` - Last 3 days
- `2w` - Last 2 weeks
- `6m` - Last 6 months (180 days)

---

## Multi-Chain Support

### Supported Chains

| Chain Name | Chain ID | Contract Address |
|------------|----------|------------------|
| Base | 8453 | `0x0574A0941Ca659D01CF7370E37492bd2DF43128d` |
| Lisk | 1135 | `0x7Ca0a469164655AF07d27cf4bdA5e77F36Ab820A` |
| Celo | 42220 | `0xBC955DC38a13c2Cd8736DA1bC791514504202F9D` |

### Chain Filtering

All analytics endpoints support the `chainId` query parameter to filter results by a specific blockchain.

**Examples:**

```bash
# Get Base chain orders only
GET /orders?chainId=8453

# Get Lisk chain timeline
GET /order-analytics/timeline?chainId=1135&range=7d

# Get Celo token stats
GET /order-analytics/by-token?chainId=42220&range=month
```

### Cross-Chain Queries

Omit the `chainId` parameter to get results across all chains:

```bash
# All chains
GET /order-analytics/summary?range=7d

# Compare chain performance
GET /order-analytics/by-chain?range=month
```

---

## Response Examples

### Success Response

All successful requests return HTTP 200 with JSON data.

### Error Responses

#### 400 Bad Request
```json
{
  "error": "Invalid time range. Use: 12h, 24h, day, month, year or formats like 7d, 30d"
}
```

#### 404 Not Found
```json
{
  "error": "Order not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to fetch order analytics"
}
```

---

## Usage Examples

### Frontend Integration

#### Fetch User Order History

```typescript
async function fetchUserOrders(
  userWallet: string,
  chainId?: number,
  page: number = 1
): Promise<OrderHistoryItem[]> {
  const params = new URLSearchParams({
    limit: '50',
    page: page.toString()
  });
  
  if (chainId) {
    params.append('chainId', chainId.toString());
  }
  
  const response = await fetch(
    `/api/orders/user/${userWallet}?${params}`
  );
  
  const data = await response.json();
  return data.orders;
}
```

#### Fetch Token Analytics

```typescript
async function fetchTokenAnalytics(
  tokenAddress: string,
  chainId: number,
  range: string = '24h'
) {
  const params = new URLSearchParams({
    range,
    chainId: chainId.toString(),
    tokenAddress
  });
  
  const response = await fetch(
    `/api/order-analytics/by-token?${params}`
  );
  
  return await response.json();
}
```

#### Display Timeline Chart

```typescript
async function fetchOrderTimeline(
  range: string = '7d',
  interval: string = 'day'
) {
  const params = new URLSearchParams({ range, interval });
  
  const response = await fetch(
    `/api/order-analytics/timeline?${params}`
  );
  
  const data = await response.json();
  
  // Format for chart library
  return data.timeline.map(point => ({
    date: new Date(point.timestamp),
    orders: point.orderCount,
    volume: point.totalVolume
  }));
}
```

---

## Rate Limiting

- **Rate Limit:** 200 requests per 15 minutes (production)
- **Headers:** Rate limit info included in response headers
- **429 Response:** Returns `Too many requests, please try again later.`

---

## Data Sync Schedule

- **Contract Metrics:** Every 1 hour
- **Order History:** Every 12 hours
- **Total Volume:** Every 15 minutes

Manual sync can be triggered by administrators through the admin API.

---

## Best Practices

1. **Pagination:** Always use pagination for large datasets (specify `limit` and `page`)
2. **Chain Filtering:** Filter by `chainId` when possible to reduce response size
3. **Time Ranges:** Use appropriate time ranges - shorter ranges return faster
4. **Caching:** Consider caching analytics results on frontend (they update every 12h)
5. **Amount Conversion:** Backend stores amounts in wei (string) - convert to display units on frontend

### Amount Conversion Example

```typescript
function formatAmount(amountWei: string, decimals: number = 18): number {
  return parseFloat(amountWei) / Math.pow(10, decimals);
}

// Usage
const order: OrderHistoryItem = await fetchOrder('12345');
const displayAmount = formatAmount(order.amount); // 1.5 instead of "1500000000000000000"
```

---

## Support

For API support or to report issues, contact the development team or open an issue in the repository.

**API Version:** 2.0.0  
**Documentation Version:** 1.0.0  
**Last Updated:** December 5, 2025
