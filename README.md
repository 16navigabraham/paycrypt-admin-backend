# Paycrypt Admin Backend

> **Enterprise-grade Node.js backend for multi-chain smart contract analytics and order management**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

A secure, scalable backend service that provides real-time analytics, order tracking, and administrative capabilities for Paycrypt smart contracts deployed across multiple blockchain networks.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Supported Blockchains](#-supported-blockchains)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Deployment](#-deployment)
- [Security](#-security)
- [Documentation](#-documentation)
- [License](#-license)

---

## ✨ Features

### Core Capabilities
- **🔗 Multi-Chain Support** - Seamlessly integrates with Base, Lisk, and Celo blockchains
- **📊 Real-Time Analytics** - Live contract metrics, order tracking, and volume statistics
- **🔐 Secure Authentication** - JWT-based admin access with bcrypt password hashing
- **⚡ Automated Synchronization** - Scheduled jobs for metrics updates and order history
- **💰 Volume Tracking** - Aggregated trading volume with USD/NGN conversion
- **🛡️ Production Security** - Rate limiting, Helmet.js protection, and CORS configuration
- **📈 RESTful APIs** - Comprehensive endpoints for all data access needs
- **🗄️ MongoDB Integration** - Robust data persistence with optimized indexing

### Technical Highlights
- Hot-reloadable multi-chain configuration
- Automatic RPC failover and health monitoring
- Efficient cron-based background jobs
- Comprehensive error handling and logging
- Horizontal scaling support
- Environment-based configuration

---

## 🏗️ Architecture

```
┌─────────────────┐
│  Frontend App   │
└────────┬────────┘
         │ HTTPS/REST
┌────────▼────────────────────────┐
│   Express.js API Server         │
│  ┌──────────────────────────┐   │
│  │  Routes & Middleware     │   │
│  │  - Auth (JWT)            │   │
│  │  - Rate Limiting         │   │
│  │  - CORS & Security       │   │
│  └──────────┬───────────────┘   │
│  ┌──────────▼───────────────┐   │
│  │  Business Logic          │   │
│  │  - Contract Service      │   │
│  │  - Price Service         │   │
│  │  - Cron Jobs             │   │
│  └──────────┬───────────────┘   │
└─────────────┼───────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────┐      ┌───────▼────────┐
│MongoDB │      │  Blockchain    │
│Database│      │  RPC Nodes     │
└────────┘      │  - Base        │
                │  - Lisk        │
                │  - Celo        │
                └────────────────┘
```

---

## 🔗 Supported Blockchains

The system currently supports the following EVM-compatible chains:

| Blockchain | Chain ID | Network Status | Block Explorer |
|------------|----------|----------------|----------------|
| **Base** | 8453 | Mainnet | [basescan.org](https://basescan.org) |
| **Lisk** | 1135 | Mainnet | [blockscout.lisk.com](https://blockscout.lisk.com) |
| **Celo** | 42220 | Mainnet | [celoscan.io](https://celoscan.io) |

> **Note:** Each chain requires its own RPC endpoint configuration. The system automatically enables chains based on available RPC URLs in your environment.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **MongoDB** >= 5.0 (Atlas or local instance)
- **npm** or **yarn** package manager
- RPC endpoints for desired blockchain networks

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/16navigabraham/paycrypt-admin-backend.git
   cd paycrypt-admin-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration (see [Configuration](#configuration))

4. **Initialize database**
   ```bash
   npm run setup
   ```

5. **Start the server**
   ```bash
   npm start          # Production
   npm run dev        # Development (with hot reload)
   ```

6. **Verify installation**
   ```bash
   curl http://localhost:5000/health
   ```

### Configuration

Create a `.env` file based on `.env.example`. Required variables:

```bash
# Database Connection
MONGODB_URI=your_mongodb_connection_string

# Authentication & Security
JWT_SECRET=your_secure_random_secret_minimum_32_characters
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_secure_password

# Blockchain RPC Endpoints (configure chains you want to support)
BASE_RPC_URL=your_base_rpc_url
LISK_RPC_URL=your_lisk_rpc_url
CELO_RPC_URL=your_celo_rpc_url

# Application
PORT=5000
FRONTEND_URL=your_frontend_url

# Email Service (Optional - for password reset)
SMTP_USER=your_smtp_email
SMTP_PASS=your_smtp_password
```

> ⚠️ **Security Warning:** Never commit `.env` files or expose credentials in your repository.

---

## 📡 API Documentation

### Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:5000/api
```

### Core Endpoints

#### Statistics & Analytics
| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/stats` | GET | Aggregate contract statistics across all chains | No |
| `/stats/chains` | GET | List of active blockchain configurations | No |
| `/stats/by-chain` | GET | Per-chain breakdown of statistics | No |

#### Order Management
| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/orders` | GET | Retrieve order history with pagination | No |
| `/orders/:id` | GET | Get specific order details | No |

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `chainId` - Filter by chain ID
- `status` - Filter by order status
- `startDate`, `endDate` - Date range filters

#### Volume Analytics
| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/volume/total` | GET | Total trading volume in USD/NGN | No |
| `/volume/chart` | GET | Historical volume data for charts | No |
| `/volume/latest` | GET | Latest cached volume snapshot | No |
| `/volume/by-chain` | GET | Volume breakdown by blockchain | No |

**Chart Intervals:** `3h`, `12h`, `24h`

#### Administration
| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/admin/login` | POST | Authenticate admin user | No |
| `/admin/profile` | GET | Get admin profile | Yes |
| `/admin/password-reset` | POST | Request password reset | No |

#### System Health
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health check and status |

### Authentication

Protected endpoints require a JWT token in the Authorization header:

```bash
Authorization: Bearer <your_jwt_token>
```

**Login Example:**
```bash
curl -X POST https://your-domain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your_password"}'
```

For detailed API documentation, see:
- [ORDER_API_DOCS.md](ORDER_API_DOCS.md)
- [VOLUME_API_DOCS.md](VOLUME_API_DOCS.md)
- [ENDPOINT_REFERENCE.md](ENDPOINT_REFERENCE.md)

---

## 🛠️ Development

### Project Structure

```
paycrypt-admin-backend/
├── config/              # Configuration files
│   └── contract.js      # Smart contract ABIs and addresses
├── jobs/                # Cron job definitions
│   └── cronJobs.js      # Scheduled background tasks
├── middleware/          # Express middleware
│   └── auth.js          # JWT authentication
├── migrations/          # Database migrations
├── models/              # Mongoose schemas
│   ├── Admin.js         # Admin user model
│   ├── ContractMetrics.js
│   ├── Order.js
│   ├── SyncStatus.js
│   └── TotalVolume.js
├── routes/              # API route handlers
│   ├── admin.js
│   ├── orderAnalytics.js
│   ├── orders.js
│   ├── stats.js
│   └── volume.js
├── services/            # Business logic
│   ├── contractService.js
│   └── priceService.js
├── utils/               # Utility functions
│   └── timeUtils.js
├── server.js            # Application entry point
└── package.json
```

### Available Scripts

```bash
npm start              # Start production server
npm run dev            # Start development server with auto-reload
npm run setup          # Initialize database and create admin user
npm run migrate        # Run database migrations
npm test               # Run test suite (when implemented)
```

### Adding a New Blockchain

1. Add RPC configuration to `.env`:
   ```bash
   NEW_CHAIN_RPC_URL=https://rpc.newchain.com
   ```

2. Update `config/contract.js` with chain details:
   ```javascript
   {
     name: "NewChain",
     chainId: 12345,
     rpcUrl: process.env.NEW_CHAIN_RPC_URL,
     contractAddress: "0x...",
     explorer: "https://explorer.newchain.com"
   }
   ```

3. Restart the server - the chain will be automatically enabled

### Development Best Practices

- Follow the existing code structure and naming conventions
- Write descriptive commit messages
- Test changes locally before deploying
- Update documentation for new features
- Use environment variables for all configuration
- Never hardcode sensitive information

---

## 🚢 Deployment

### Deploy to Render

1. **Fork this repository** to your GitHub account

2. **Create a new Web Service** on [Render](https://render.com)

3. **Connect your repository** and configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node

4. **Add environment variables** from your `.env` file

5. **Deploy** - Render will automatically build and start your service

### Deploy to Other Platforms

The application is compatible with any Node.js hosting platform:

- **Heroku:** See deployment docs
- **Railway:** Direct GitHub integration
- **DigitalOcean App Platform:** One-click deploy
- **AWS Elastic Beanstalk:** Upload ZIP or use CLI
- **Google Cloud Run:** Container deployment

### Environment Configuration

Ensure all required environment variables are set in your hosting platform:
- Database connection strings
- API keys and secrets
- RPC endpoints
- Frontend URLs

See [DEPLOY_TO_RENDER.md](DEPLOY_TO_RENDER.md) and [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for detailed deployment guides.

---

## 🔒 Security

### Security Features

- **🔐 Password Hashing:** bcrypt with salt rounds
- **🎫 JWT Authentication:** Secure token-based auth
- **🛡️ Helmet.js:** HTTP header security
- **⏱️ Rate Limiting:** Prevents brute-force attacks
- **🌐 CORS:** Configurable cross-origin policies
- **✅ Input Validation:** Sanitized user inputs
- **📝 Audit Logging:** Track admin actions

### Security Best Practices

1. **Never commit sensitive data** - Use `.env` files
2. **Rotate JWT secrets regularly** - Update production keys
3. **Use HTTPS in production** - Enable SSL/TLS
4. **Keep dependencies updated** - Run `npm audit` regularly
5. **Monitor access logs** - Track suspicious activity
6. **Implement IP whitelisting** - For admin endpoints
7. **Set up database backups** - Regular automated backups

### Reporting Security Issues

If you discover a security vulnerability, please email security contact instead of using the issue tracker.

---

## 📚 Documentation

Comprehensive documentation is available in the repository:

- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick command reference
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migration instructions
- **[FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md)** - Frontend integration
- **[MULTI_CHAIN_SUMMARY.md](MULTI_CHAIN_SUMMARY.md)** - Multi-chain implementation
- **[VOLUME_IMPLEMENTATION.md](VOLUME_IMPLEMENTATION.md)** - Volume tracking details
- **[MONGODB_CONNECTION_FIX.md](MONGODB_CONNECTION_FIX.md)** - Database troubleshooting
- **[PRODUCTION_FIXES.md](PRODUCTION_FIXES.md)** - Production issue solutions

---

## 🤝 Contributing

This is a proprietary project. Contributions are accepted under a Contributor License Agreement (CLA).

### Development Workflow

1. Create a feature branch
2. Make your changes with clear commits
3. Test thoroughly
4. Submit a pull request with detailed description
5. Sign CLA if requested

---

## 📝 License

**Copyright © 2024-2026 [Team Memevibe](https://github.com/Team-memevibe) & [16navigabraham](https://github.com/16navigabraham). All rights reserved.**

This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited without the express written permission of the copyright holder.

### Usage Restrictions

- ❌ No copying, modification, or distribution
- ❌ No reverse engineering or decompilation
- ❌ No commercial use without explicit license
- ❌ No public deployment without written permission
- ❌ No removal or modification of copyright notices

### Permitted Use

- ✅ Private evaluation for legitimate purposes
- ✅ Bug reporting via GitHub issues
- ✅ Contributing under Contributor License Agreement

### License Inquiries

For commercial licensing, enterprise support, or partnership opportunities:
- **Organization:** [Team Memevibe](https://github.com/Team-memevibe)
- **GitHub:** [@16navigabraham](https://github.com/16navigabraham)
- **Repository:** [paycrypt-admin-backend](https://github.com/16navigabraham/paycrypt-admin-backend)

---

## 🙏 Acknowledgments

Built with industry-leading technologies:
- [Node.js](https://nodejs.org/) - Runtime environment
- [Express.js](https://expressjs.com/) - Web framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Ethers.js](https://docs.ethers.org/) - Ethereum library
- [JWT](https://jwt.io/) - Authentication standard

---

<div align="center">

**Built for Paycrypt** • **Powered by Multi-Chain Technology** • **Secured by Design**

[Documentation](QUICK_REFERENCE.md) • [API Reference](ENDPOINT_REFERENCE.md) • [Report Issue](https://github.com/16navigabraham/paycrypt-admin-backend/issues)

</div>
