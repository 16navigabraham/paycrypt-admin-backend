# Frontend Integration Guide

Complete guide for integrating the Order Management API endpoints into your frontend application.

**Backend API Base URL:** `https://paycrypt-admin-backend.onrender.com/api`

**Last Updated:** December 5, 2025

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [API Client Setup](#api-client-setup)
3. [Order History Integration](#order-history-integration)
4. [Analytics Dashboard](#analytics-dashboard)
5. [Multi-Chain Support](#multi-chain-support)
6. [Real-World Examples](#real-world-examples)
7. [Error Handling](#error-handling)
8. [Performance Optimization](#performance-optimization)

---

## Quick Start

### Installation

```bash
# No additional packages required - uses native fetch API
# Optional: Install axios for better features
npm install axios
```

### Basic Configuration

```typescript
// config/api.ts
export const API_CONFIG = {
  baseURL: 'https://paycrypt-admin-backend.onrender.com/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Supported chains
export const CHAINS = {
  BASE: 8453,
  LISK: 1135,
  CELO: 42220
} as const;

export const CHAIN_NAMES = {
  [CHAINS.BASE]: 'Base',
  [CHAINS.LISK]: 'Lisk',
  [CHAINS.CELO]: 'Celo'
} as const;
```

---

## API Client Setup

### Option 1: Native Fetch (Recommended for Simple Apps)

```typescript
// utils/api.ts
import { API_CONFIG } from '@/config/api';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_CONFIG.baseURL;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...API_CONFIG.headers,
          ...options?.headers
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params 
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    
    return this.request<T>(`${endpoint}${queryString}`);
  }
}

export const apiClient = new ApiClient();
```

### Option 2: Axios (Recommended for Complex Apps)

```typescript
// utils/api.ts
import axios, { AxiosInstance } from 'axios';
import { API_CONFIG } from '@/config/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: API_CONFIG.headers
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 429) {
          console.warn('Rate limit exceeded. Please wait.');
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.client.get(endpoint, { params });
  }
}

export const apiClient = new ApiClient();
```

---

## Order History Integration

### 1. Fetching User Order History

**Use Case:** Display a user's order history with pagination

```typescript
// services/orderService.ts
import { apiClient } from '@/utils/api';
import { CHAINS } from '@/config/api';

export interface OrderHistoryItem {
  orderId: string;
  requestId: string;
  userWallet: string;
  tokenAddress: string;
  amount: string;
  txnHash: string;
  blockNumber: number;
  timestamp: string;
  chainId: number;
}

export interface OrderResponse {
  orders: OrderHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const orderService = {
  /**
   * Get orders for a specific user
   */
  async getUserOrders(
    userWallet: string,
    options?: {
      chainId?: number;
      page?: number;
      limit?: number;
    }
  ): Promise<OrderResponse> {
    const params = {
      chainId: options?.chainId,
      page: options?.page || 1,
      limit: options?.limit || 50
    };

    return apiClient.get<OrderResponse>(
      `/orders/user/${userWallet}`,
      params
    );
  },

  /**
   * Get all orders with filters
   */
  async getOrders(filters?: {
    chainId?: number;
    range?: string;
    user?: string;
    token?: string;
    page?: number;
    limit?: number;
  }): Promise<OrderResponse> {
    return apiClient.get<OrderResponse>('/orders', filters);
  },

  /**
   * Get recent orders
   */
  async getRecentOrders(count: number = 10): Promise<{ orders: OrderHistoryItem[] }> {
    return apiClient.get(`/orders/recent/${count}`);
  }
};
```

**React Component Example:**

```tsx
// components/OrderHistory.tsx
import { useState, useEffect } from 'react';
import { orderService, OrderHistoryItem } from '@/services/orderService';
import { CHAINS, CHAIN_NAMES } from '@/config/api';

interface OrderHistoryProps {
  userWallet: string;
  chainId?: number;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ 
  userWallet, 
  chainId 
}) => {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchOrders();
  }, [userWallet, chainId, page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await orderService.getUserOrders(userWallet, {
        chainId,
        page,
        limit: 20
      });
      
      setOrders(response.orders);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amountWei: string, decimals: number = 18): string => {
    const amount = parseFloat(amountWei) / Math.pow(10, decimals);
    return amount.toFixed(4);
  };

  if (loading) return <div>Loading orders...</div>;

  return (
    <div className="order-history">
      <h2>Order History</h2>
      
      {orders.length === 0 ? (
        <p>No orders found</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Chain</th>
                <th>Amount</th>
                <th>Token</th>
                <th>Date</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={`${order.chainId}-${order.orderId}`}>
                  <td>{order.orderId}</td>
                  <td>{CHAIN_NAMES[order.chainId as keyof typeof CHAIN_NAMES]}</td>
                  <td>{formatAmount(order.amount)}</td>
                  <td>{order.tokenAddress.slice(0, 8)}...</td>
                  <td>{new Date(order.timestamp).toLocaleDateString()}</td>
                  <td>
                    <a 
                      href={`https://basescan.org/tx/${order.txnHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="pagination">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};
```

---

## Analytics Dashboard

### 1. Summary Statistics

**Use Case:** Dashboard overview with key metrics

```typescript
// services/analyticsService.ts
import { apiClient } from '@/utils/api';

export interface ContractMetrics {
  orderCount: string;        // BigInt as string from contract
  totalVolume: string;       // BigInt as string (wei format)
  successfulOrders: string;
  failedOrders: string;
}

export interface VolumeData {
  success: boolean;
  data: {
    totalVolumeUSD: string;  // Formatted string with commas
    totalVolumeNGN: string;  // Formatted string with commas
    tokenCount: number;
    tokens: Array<{
      tokenAddress: string;
      symbol: string;
      decimals: number;
      totalVolume: string;   // BigInt as string
      priceUSD: number;
      priceNGN: number;
    }>;
    byChain?: Array<{
      chainId: number;
      volumeUSD: string;
      volumeNGN: string;
      tokenCount: number;
    }>;
  };
}

export interface StatsData {
  orderCount: string;
  totalVolume: string;
  successfulOrders: string;
  failedOrders: string;
}

export const analyticsService = {
  /**
   * Get contract metrics (on-chain data)
   */
  async getContractMetrics(chainId?: number): Promise<ContractMetrics> {
    const params = chainId ? { chainId } : {};
    return apiClient.get<ContractMetrics>('/stats', params);
  },

  /**
   * Get total volume data (off-chain aggregated)
   */
  async getVolume(chainId?: number): Promise<VolumeData> {
    const params = chainId ? { chainId } : {};
    return apiClient.get<VolumeData>('/volume/latest', params);
  },

  /**
   * Get volume chart data
   */
  async getVolumeChart(interval: string = '24h'): Promise<{ data: Array<{
    timestamp: string;
    totalVolumeUSD: string;
    totalVolumeNGN: string;
    tokenCount: number;
  }> }> {
    return apiClient.get('/volume/chart', { interval });
  }
};
```

**React Component Example (CORRECTED):**

```tsx
// components/DashboardStats.tsx
import { useState, useEffect } from 'react';
import { analyticsService } from '@/services/analyticsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardData {
  orderCount: string;
  successfulOrders: string;
  failedOrders: string;
  totalVolumeUSD: string;
  totalVolumeNGN: string;
}

export const DashboardStats: React.FC = () => {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both contract metrics and volume data in parallel
      const [metricsData, volumeData] = await Promise.all([
        analyticsService.getContractMetrics(),
        analyticsService.getVolume()
      ]);

      // Parse formatted strings correctly
      const volumeUSD = volumeData.data.totalVolumeUSD.replace(/,/g, '');
      const volumeNGN = volumeData.data.totalVolumeNGN.replace(/,/g, '');

      setStats({
        orderCount: metricsData.orderCount,
        successfulOrders: metricsData.successfulOrders,
        failedOrders: metricsData.failedOrders,
        totalVolumeUSD: volumeUSD,
        totalVolumeNGN: volumeNGN
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading dashboard...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!stats) return <div className="p-4">No data available</div>;

  // Convert string numbers to actual numbers
  const orderCount = parseInt(stats.orderCount, 10);
  const successfulOrders = parseInt(stats.successfulOrders, 10);
  const failedOrders = parseInt(stats.failedOrders, 10);
  const volumeUSD = parseFloat(stats.totalVolumeUSD);
  const volumeNGN = parseFloat(stats.totalVolumeNGN);

  return (
    <div className="dashboard-stats">
      <div className="stats-grid grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderCount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Successful Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successfulOrders.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedOrders.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${volumeUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">₦{volumeNGN.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
```

### 2. Chain Comparison (CORRECTED)

```typescript
// services/analyticsService.ts (continued)
export const analyticsService = {
  // ... previous methods

  /**
   * Get volume breakdown by chain
   */
  async getVolumeByChain(chainId?: number): Promise<VolumeData> {
    const params = chainId ? { chainId } : {};
    return apiClient.get<VolumeData>('/volume/latest', params);
  }
};
```

**React Component (CORRECTED):**

```tsx
// components/ChainComparison.tsx
import { useState, useEffect } from 'react';
import { analyticsService } from '@/services/analyticsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChainStats {
  chainId: number;
  chainName: string;
  volumeUSD: string;
  volumeNGN: string;
  tokenCount: number;
  percentage: number;
}

export const ChainComparison: React.FC = () => {
  const [chains, setChains] = useState<ChainStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChainData();
  }, []);

  const fetchChainData = async () => {
    try {
      setLoading(true);
      const volumeData = await analyticsService.getVolume();

      if (volumeData.data.byChain && volumeData.data.byChain.length > 0) {
        // Calculate total for percentage
        const totalVolume = volumeData.data.byChain.reduce((sum, chain) => {
          const usd = parseFloat(chain.volumeUSD.replace(/,/g, ''));
          return sum + usd;
        }, 0);

        const chainStats: ChainStats[] = volumeData.data.byChain.map(chain => ({
          chainId: chain.chainId,
          chainName: getChainName(chain.chainId),
          volumeUSD: chain.volumeUSD,
          volumeNGN: chain.volumeNGN,
          tokenCount: chain.tokenCount,
          percentage: totalVolume > 0 
            ? (parseFloat(chain.volumeUSD.replace(/,/g, '')) / totalVolume) * 100 
            : 0
        }));

        setChains(chainStats);
      }
    } catch (error) {
      console.error('Failed to fetch chain data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChainName = (chainId: number): string => {
    const names: Record<number, string> = {
      8453: 'Base',
      1135: 'Lisk',
      42220: 'Celo'
    };
    return names[chainId] || 'Unknown';
  };

  if (loading) return <div>Loading chain data...</div>;

  return (
    <div className="chain-comparison">
      <h3 className="text-2xl font-bold mb-4">Volume by Chain</h3>
      <div className="chain-grid grid gap-4 md:grid-cols-3">
        {chains.map(chain => (
          <Card key={chain.chainId}>
            <CardHeader>
              <CardTitle>{chain.chainName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Volume USD:</span>
                  <p className="text-lg font-bold">${chain.volumeUSD}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Volume NGN:</span>
                  <p className="text-lg font-bold">₦{chain.volumeNGN}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Market Share:</span>
                  <p className="text-lg font-bold">{chain.percentage.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Tokens:</span>
                  <p className="text-lg font-bold">{chain.tokenCount}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${chain.percentage}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

### 3. Timeline Chart (CORRECTED)

```tsx
// components/OrderChart.tsx
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyticsService } from '@/services/analyticsService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ChartDataPoint {
  date: string;
  volumeUSD: number;
  volumeNGN: number;
  timestamp: string;
}

export const OrderChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    fetchChartData();
  }, [timeframe]);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      const volumeChart = await analyticsService.getVolumeChart(timeframe);

      const processedData: ChartDataPoint[] = volumeChart.data.map(point => ({
        date: new Date(point.timestamp).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        volumeUSD: parseFloat(point.totalVolumeUSD.replace(/,/g, '')),
        volumeNGN: parseFloat(point.totalVolumeNGN.replace(/,/g, '')),
        timestamp: point.timestamp
      }));

      setChartData(processedData);
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading chart...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Volume Over Time</CardTitle>
            <CardDescription>Trading volume across all chains</CardDescription>
          </div>
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis 
              yAxisId="left"
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              tickFormatter={(value) => `₦${value.toFixed(0)}`}
            />
            <Tooltip 
              formatter={(value: any) => {
                if (typeof value === 'number') {
                  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
                }
                return value;
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              dataKey="volumeUSD" 
              stroke="#3B82F6" 
              name="Volume (USD)"
              dot={{ r: 4 }}
            />
            <Line 
              yAxisId="right"
              dataKey="volumeNGN" 
              stroke="#10B981" 
              name="Volume (NGN)"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
```

---

## Multi-Chain Support

### Chain Selector Component

```tsx
// components/ChainSelector.tsx
import { CHAINS, CHAIN_NAMES } from '@/config/api';

interface ChainSelectorProps {
  selectedChain: number | null;
  onChange: (chainId: number | null) => void;
}

export const ChainSelector: React.FC<ChainSelectorProps> = ({ 
  selectedChain, 
  onChange 
}) => {
  return (
    <div className="chain-selector">
      <label>Select Chain:</label>
      <select 
        value={selectedChain || ''} 
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">All Chains</option>
        <option value={CHAINS.BASE}>{CHAIN_NAMES[CHAINS.BASE]}</option>
        <option value={CHAINS.LISK}>{CHAIN_NAMES[CHAINS.LISK]}</option>
        <option value={CHAINS.CELO}>{CHAIN_NAMES[CHAINS.CELO]}</option>
      </select>
    </div>
  );
};
```

### Usage in Parent Component

```tsx
// pages/Dashboard.tsx
import { useState } from 'react';
import { ChainSelector } from '@/components/ChainSelector';
import { OrderHistory } from '@/components/OrderHistory';
import { DashboardStats } from '@/components/DashboardStats';

export const Dashboard: React.FC = () => {
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const userWallet = '0x...'; // Get from wallet connection

  return (
    <div className="dashboard">
      <h1>Order Dashboard</h1>
      
      <ChainSelector 
        selectedChain={selectedChain}
        onChange={setSelectedChain}
      />

      <DashboardStats />
      
      <OrderHistory 
        userWallet={userWallet}
        chainId={selectedChain || undefined}
      />
    </div>
  );
};
```

---

## Real-World Examples

### Complete Order Management Page

```tsx
// pages/Orders.tsx
import { useState, useEffect } from 'react';
import { orderService, OrderHistoryItem } from '@/services/orderService';
import { ChainSelector } from '@/components/ChainSelector';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    chainId: null as number | null,
    range: '24h',
    page: 1
  });

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await orderService.getOrders({
        chainId: filters.chainId || undefined,
        range: filters.range,
        page: filters.page,
        limit: 20
      });
      setOrders(response.orders);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="orders-page">
      <h1>All Orders</h1>

      {/* Filters */}
      <div className="filters">
        <ChainSelector
          selectedChain={filters.chainId}
          onChange={(chainId) => setFilters({ ...filters, chainId, page: 1 })}
        />

        <select
          value={filters.range}
          onChange={(e) => setFilters({ ...filters, range: e.target.value, page: 1 })}
        >
          <option value="12h">Last 12 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>User</th>
              <th>Amount</th>
              <th>Token</th>
              <th>Chain</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={`${order.chainId}-${order.orderId}`}>
                <td>{order.orderId}</td>
                <td>{order.userWallet.slice(0, 10)}...</td>
                <td>{(parseFloat(order.amount) / 1e18).toFixed(4)}</td>
                <td>{order.tokenAddress.slice(0, 8)}...</td>
                <td>{order.chainId}</td>
                <td>{new Date(order.timestamp).toLocaleString()}</td>
                <td>
                  <button onClick={() => window.open(`/orders/${order.orderId}`, '_blank')}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
```

---

## Error Handling

### Centralized Error Handler

```typescript
// utils/errorHandler.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleApiError = (error: any): ApiError => {
  if (error.response) {
    // API returned an error response
    return new ApiError(
      error.response.data?.error || 'API Error',
      error.response.status,
      error
    );
  } else if (error.request) {
    // Request made but no response
    return new ApiError(
      'No response from server. Please check your connection.',
      0,
      error
    );
  } else {
    // Something else happened
    return new ApiError(
      error.message || 'An unexpected error occurred',
      undefined,
      error
    );
  }
};
```

### React Error Boundary

```tsx
// components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## Performance Optimization

### 1. Caching Strategy

```typescript
// utils/cache.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + (ttl || this.defaultTTL)
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cache = new CacheManager();
```

### 2. Custom Hook with Caching

```typescript
// hooks/useOrders.ts
import { useState, useEffect } from 'react';
import { orderService, OrderHistoryItem } from '@/services/orderService';
import { cache } from '@/utils/cache';

export const useOrders = (userWallet: string, chainId?: number) => {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [userWallet, chainId]);

  const fetchOrders = async () => {
    const cacheKey = `orders-${userWallet}-${chainId || 'all'}`;
    const cached = cache.get<OrderHistoryItem[]>(cacheKey);

    if (cached) {
      setOrders(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await orderService.getUserOrders(userWallet, { chainId });
      setOrders(response.orders);
      cache.set(cacheKey, response.orders);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { orders, loading, error, refetch: fetchOrders };
};
```

### 3. Pagination Hook

```typescript
// hooks/usePagination.ts
import { useState } from 'react';

export const usePagination = (initialPage = 1, initialLimit = 20) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const nextPage = () => setPage(p => p + 1);
  const prevPage = () => setPage(p => Math.max(1, p - 1));
  const goToPage = (newPage: number) => setPage(Math.max(1, newPage));
  const reset = () => setPage(1);

  return {
    page,
    limit,
    setLimit,
    nextPage,
    prevPage,
    goToPage,
    reset
  };
};
```

---

## Best Practices

### 1. Type Safety

Always define types for API responses:

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

### 2. Loading States

```tsx
// components/LoadingState.tsx
export const LoadingState: React.FC = () => (
  <div className="loading-state">
    <div className="spinner" />
    <p>Loading...</p>
  </div>
);

// components/EmptyState.tsx
export const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="empty-state">
    <p>{message}</p>
  </div>
);
```

### 3. Environment Configuration

```typescript
// config/env.ts
export const ENV = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://paycrypt-admin-backend.onrender.com/api',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'
};
```

---

## Testing

### Example Jest Test

```typescript
// services/__tests__/orderService.test.ts
import { orderService } from '../orderService';
import { apiClient } from '@/utils/api';

jest.mock('@/utils/api');

describe('OrderService', () => {
  it('should fetch user orders', async () => {
    const mockResponse = {
      orders: [],
      pagination: { page: 1, limit: 50, total: 0, pages: 0 }
    };

    (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

    const result = await orderService.getUserOrders('0x123');
    
    expect(result).toEqual(mockResponse);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/orders/user/0x123',
      expect.any(Object)
    );
  });
});
```

---

## Summary

This guide covers the essential patterns for integrating the Order Management API into your frontend:

✅ **API Client Setup** - Both fetch and axios approaches  
✅ **Order History** - User orders with pagination  
✅ **Analytics Dashboard** - Summary stats, charts, chain comparison  
✅ **Multi-Chain Support** - Chain filtering and selection  
✅ **Error Handling** - Centralized error management  
✅ **Performance** - Caching and optimization strategies  
✅ **Best Practices** - Type safety, loading states, testing  

For more details on specific endpoints, see [ORDER_API_DOCS.md](./ORDER_API_DOCS.md).

---

## Common Frontend Issues & Fixes

### Issue 1: "N/A" Values in Dashboard

**Problem:** Total volume and orders display "N/A" instead of actual data.

**Root Cause:** API response format not being parsed correctly.

**Solution:**

```typescript
// WRONG ❌
const statsResponse = await fetch(`${API_URL}/api/stats`)
const statsData = await statsResponse.json()
// statsData is already the metrics object, not wrapped

// CORRECT ✅
const metricsData = await statsResponse.json()
// Access properties directly
const orderCount = metricsData.orderCount  // Returns string like "165"
const totalVolume = metricsData.totalVolume  // Returns BigInt string like "15814955264503323154"

// Parse string to number
const orderCountNum = parseInt(metricsData.orderCount, 10)
const totalVolumeNum = BigInt(metricsData.totalVolume)
```

### Issue 2: Volume Formatting

**Problem:** Volume shows as very large numbers or decimal issues.

**Solution:**

```typescript
// Volume from contract is in wei-like format (18 decimals for USDC-like tokens)
// Your price API returns formatted strings with commas

const volumeResponse = await fetch(`${API_URL}/api/volume/latest`)
const volumeData = await volumeResponse.json()

// volumeData.data.totalVolumeUSD is a string like "$61.45" or "61.45"
// Remove commas and parse
const volumeUSD = parseFloat(volumeData.data.totalVolumeUSD.replace(/,/g, ''))
const volumeNGN = parseFloat(volumeData.data.totalVolumeNGN.replace(/,/g, ''))

// Format for display
const displayUSD = volumeUSD.toLocaleString('en-US', { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
})
```

### Issue 3: Chart Data Not Displaying

**Problem:** Charts show empty or incorrect data points.

**Solution:**

```typescript
// WRONG ❌
const chartResponse = await fetch(`${API_URL}/api/stats/chart/7d`)
const chartData = await chartResponse.json()
const processedData = chartData.map(item => ({...}))  // chartData is array

// CORRECT ✅
const chartResponse = await fetch(`${API_URL}/api/volume/chart?interval=24h`)
const { data: chartData } = await chartResponse.json()  // Destructure data array
const processedData = chartData.map(item => ({
  date: new Date(item.timestamp).toLocaleDateString(),
  volumeUSD: parseFloat(item.totalVolumeUSD.replace(/,/g, '')),
  volumeNGN: parseFloat(item.totalVolumeNGN.replace(/,/g, ''))
}))
```

### Issue 4: Chain Breakdown Not Working

**Problem:** Chain breakdown shows as undefined or empty.

**Solution:**

```typescript
const volumeResponse = await fetch(`${API_URL}/api/volume/latest`)
const volumeData = await volumeResponse.json()

// Check if byChain exists
if (volumeData.data.byChain && Array.isArray(volumeData.data.byChain)) {
  const chainBreakdown = volumeData.data.byChain.map(chain => ({
    chainId: chain.chainId,
    chainName: getChainName(chain.chainId),
    volumeUSD: parseFloat(chain.volumeUSD.replace(/,/g, '')),
    volumeNGN: parseFloat(chain.volumeNGN.replace(/,/g, ''))
  }))
  
  setChainBreakdown(chainBreakdown)
} else {
  console.warn('Chain breakdown not available in API response')
}

const getChainName = (chainId: number) => {
  const names: Record<number, string> = {
    8453: 'Base',
    1135: 'Lisk',
    42220: 'Celo'
  }
  return names[chainId] || 'Unknown'
}
```

### Issue 5: API Response Structure Mismatch

**API Response Structure Reference:**

```typescript
// GET /api/stats
{
  orderCount: "165",                    // String
  totalVolume: "15814955264503323154",  // BigInt as string
  successfulOrders: "138",              // String
  failedOrders: "23"                    // String
}

// GET /api/volume/latest
{
  success: true,
  data: {
    totalVolumeUSD: "61.45",            // Formatted string
    totalVolumeNGN: "94,636.84",        // Formatted string with commas
    tokenCount: 2,
    tokens: [{
      tokenAddress: "0x...",
      symbol: "USDC",
      decimals: 6,
      totalVolume: "61450000",          // BigInt as string
      priceUSD: 1.0,
      priceNGN: 1536.0
    }],
    byChain: [{
      chainId: 8453,
      volumeUSD: "61.45",               // Formatted string
      volumeNGN: "94,636.84",           // Formatted string
      tokenCount: 1
    }]
  }
}

// GET /api/volume/chart?interval=24h
{
  data: [{
    timestamp: "2025-12-05T20:21:40.000Z",
    totalVolumeUSD: "61.45",
    totalVolumeNGN: "94,636.84",
    tokenCount: 2
  }]
}
```

### Best Practices for Your Dashboard

```tsx
// Complete corrected component structure
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

export const DashboardOverview = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState({
    orderCount: 0,
    successfulOrders: 0,
    failedOrders: 0,
    totalVolumeUSD: 0,
    totalVolumeNGN: 0,
    chainBreakdown: [] as any[]
  })

  const fetchAllData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch both endpoints in parallel
      const [statsRes, volumeRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/stats`),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/volume/latest`)
      ])

      if (!statsRes.ok || !volumeRes.ok) {
        throw new Error('API request failed')
      }

      const stats = await statsRes.json()
      const volumeData = await volumeRes.json()

      // Parse volume data safely
      const volumeUSD = parseFloat(volumeData.data.totalVolumeUSD.replace(/,/g, ''))
      const volumeNGN = parseFloat(volumeData.data.totalVolumeNGN.replace(/,/g, ''))

      setData({
        orderCount: parseInt(stats.orderCount, 10),
        successfulOrders: parseInt(stats.successfulOrders, 10),
        failedOrders: parseInt(stats.failedOrders, 10),
        totalVolumeUSD: volumeUSD,
        totalVolumeNGN: volumeNGN,
        chainBreakdown: volumeData.data.byChain || []
      })

      toast.success('Dashboard updated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      toast.error(`Failed to load dashboard: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchAllData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && data.orderCount === 0) {
    return <div className="p-4">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          title="Total Orders" 
          value={data.orderCount.toLocaleString()} 
        />
        <StatCard 
          title="Successful" 
          value={data.successfulOrders.toLocaleString()} 
          variant="success"
        />
        <StatCard 
          title="Failed" 
          value={data.failedOrders.toLocaleString()} 
          variant="danger"
        />
        <StatCard 
          title="Total Volume" 
          value={`$${data.totalVolumeUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          subtitle={`₦${data.totalVolumeNGN.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
        />
      </div>

      {/* Chain Breakdown */}
      {data.chainBreakdown.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {data.chainBreakdown.map(chain => (
            <ChainCard key={chain.chainId} chain={chain} />
          ))}
        </div>
      )}

      {/* Refresh Button */}
      <button 
        onClick={fetchAllData}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? 'Updating...' : 'Refresh Now'}
      </button>
    </div>
  )
}
```

---

## Summary

This guide covers the essential patterns for integrating the Order Management API into your frontend:

✅ **API Client Setup** - Both fetch and axios approaches  
✅ **Order History** - User orders with pagination  
✅ **Analytics Dashboard** - Summary stats, charts, chain comparison  
✅ **Multi-Chain Support** - Chain filtering and selection  
✅ **Error Handling** - Centralized error management  
✅ **Performance** - Caching and optimization strategies  
✅ **Best Practices** - Type safety, loading states, testing  
✅ **Common Issues** - Parsing, formatting, API response handling  

For more details on specific endpoints, see [ORDER_API_DOCS.md](./ORDER_API_DOCS.md).
