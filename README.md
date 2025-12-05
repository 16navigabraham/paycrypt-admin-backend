# Paycrypt Admin Backend

**Secure Node.js backend for Paycrypt smart contract analytics across multiple blockchains.**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## 🚀 Features

- **Multi-Chain Support** - Base, Lisk, and Celo blockchain integration
- **Real-time Analytics** - Contract metrics & order tracking across all chains
- **Admin Authentication** - JWT-based login with password reset
- **Automated Sync** - Hourly metrics & 12-hour order history sync for all chains
- **RESTful APIs** - Stats, orders, and admin management endpoints
- **Production Ready** - Security, rate limiting, error handling

## 🔗 Supported Blockchains

| Chain | Chain ID | Contract Address | Explorer |
|-------|----------|------------------|----------|
| **Base** | 8453 | `0x0574A0941Ca659D01CF7370E37492bd2DF43128d` | [basescan.org](https://basescan.org) |
| **Lisk** | 1135 | `0x7Ca0a469164655AF07d27cf4bdA5e77F36Ab820A` | [blockscout.lisk.com](https://blockscout.lisk.com) |
| **Celo** | 42220 | `0xBC955DC38a13c2Cd8736DA1bC791514504202F9D` | [celoscan.io](https://celoscan.io) |

## ⚡ Quick Deploy

### 1. Environment Variables
```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/paycrypt

# Authentication
JWT_SECRET=your-64-character-random-secret-key
ADMIN_EMAIL=admin@paycrypt.com
ADMIN_PASSWORD=SecurePassword123!

# Multi-Chain RPC URLs (configure the chains you want to support)
BASE_RPC_URL=https://mainnet.base.org
RPC_URL=https://mainnet.base.org  # Fallback to Base
LISK_RPC_URL=https://rpc.api.lisk.com
CELO_RPC_URL=https://forno.celo.org

# Frontend
FRONTEND_URL=https://admin.paycrypt.org

# Email (optional)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

> **Note:** Only configure RPC URLs for the chains you want to monitor. The system will automatically enable and sync only the chains with configured RPC endpoints.

### 2. Deploy to Render
1. Fork this repository
2. Connect to [Render](https://render.com)
3. Add environment variables
4. Deploy automatically

### 3. Verify Deployment
```bash
curl https://your-app.onrender.com/health
```

## 📡 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Contract statistics |
| `GET /api/stats/chains` | List active chains |
| `GET /api/orders` | Order history with filters |
| `GET /api/volume/total` | Total volume in USD/NGN |
| `GET /api/volume/chart?interval=24h` | Volume chart data (3h/12h/24h) |
| `GET /api/volume/latest` | Latest cached volume |
| `GET /api/volume/by-chain` | Volume breakdown by chain |
| `POST /api/admin/login` | Admin authentication |
| `GET /health` | Health check |

### Volume Endpoints

**NEW**: Get aggregated trading volume across all tokens and chains:
- Converted to USD and NGN using live prices
- Historical data for charts (3h, 12h, 24h intervals)
- Automatic updates every 15 minutes
- See [VOLUME_API_DOCS.md](VOLUME_API_DOCS.md) for details

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Initialize database
node setup.js

# Start development server
npm run dev
```

## 📝 License

**Copyright © 2024 [16navigabraham](https://github.com/16navigabraham). All rights reserved.**

This software is proprietary and confidential. Unauthorized copying, distribution, or use of this software, via any medium, is strictly prohibited without the express written permission of the copyright holder.

### Restrictions
- ❌ No copying, modification, or distribution
- ❌ No reverse engineering or decompilation  
- ❌ No commercial use without license
- ❌ No public deployment without permission

### Permissions
- ✅ Private use for evaluation purposes only
- ✅ Issue reporting and contributions (with CLA)

For licensing inquiries, contact: [16navigabraham](https://github.com/16navigabraham)

---

**Built for Paycrypt** • **Powered by Base Chain** • **Secured by Design**
