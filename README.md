# Paycrypt Admin Backend

**Secure Node.js backend for Paycrypt smart contract analytics on Base Chain.**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## 🚀 Features

- **Base Chain Integration** - Real-time contract metrics & order tracking
- **Admin Authentication** - JWT-based login with password reset
- **Automated Sync** - Hourly metrics & 12-hour order history sync
- **RESTful APIs** - Stats, orders, and admin management endpoints
- **Production Ready** - Security, rate limiting, error handling

## ⚡ Quick Deploy

### 1. Environment Variables
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/paycrypt
JWT_SECRET=your-64-character-random-secret-key
RPC_URL=https://mainnet.base.org
FRONTEND_URL=https://admin.paycrypt.org
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
ADMIN_EMAIL=admin@paycrypt.com
ADMIN_PASSWORD=SecurePassword123!
```

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
| `GET /api/orders` | Order history with filters |
| `POST /api/admin/login` | Admin authentication |
| `GET /health` | Health check |

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
