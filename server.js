const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

// Import routes
const statsRoutes = require('./routes/stats');
const ordersRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const volumeRoutes = require('./routes/volume');
const orderAnalyticsRoutes = require('./routes/orderAnalytics');

// Import services
const contractService = require('./services/contractService');
const { syncContractMetrics, syncOrderHistory, syncTotalVolume } = require('./jobs/cronJobs');
const runMigration = require('./migrations/fix-syncstatus-index');

const app = express();

// Trust proxy for Render deployment
if (process.env.RENDER) {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://admin.paycrypt.org',
      'https://paycrypt.org',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Rate limiting - more restrictive for production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 100, // Higher limit for production
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (before other routes)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    chain: 'Base',
    contract: '0x0574A0941Ca659D01CF7370E37492bd2DF43128d'
  });
});

// Connect to MongoDB
console.log('🔗 Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    
    // Run database migration on startup (safe to run multiple times)
    console.log('🔧 Running database migrations...');
    try {
      await runMigration();
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.warn('⚠️  Migration warning:', error.message);
      console.log('📝 Continuing with startup - migration will retry on next restart');
    }
    
    // Initialize contract service after DB connection and migration
    contractService.initialize();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/stats', statsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/volume', volumeRoutes);
app.use('/api/order-analytics', orderAnalyticsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Paycrypt Admin Backend API - Multi-Chain',
    version: '2.0.0',
    chains: ['Base', 'Lisk', 'Celo'],
    endpoints: ['/api/stats', '/api/orders', '/api/admin', '/api/volume', '/api/order-analytics', '/health']
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'CORS policy violation',
      message: 'Origin not allowed'
    });
  }
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start cron jobs only in production or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
  console.log('🕐 Setting up cron jobs...');

  // Every 30 minutes: sync contract metrics
  cron.schedule('*/30 * * * *', () => {
    console.log('⏰ Running 30-minute metrics sync...');
    syncContractMetrics().catch(error => {
      console.error('❌ Cron metrics sync error:', error);
    });
  });

  // Every 30 minutes: sync order history
  cron.schedule('*/30 * * * *', () => {
    console.log('⏰ Running 30-minute order history sync...');
    syncOrderHistory().catch(error => {
      console.error('❌ Cron order sync error:', error);
    });
  });

  // Every 3 hours: sync total volume
  cron.schedule('0 */3 * * *', () => {
    console.log('⏰ Running 3-hour total volume sync...');
    syncTotalVolume().catch(error => {
      console.error('❌ Cron volume sync error:', error);
    });
  });

  // Run initial sync after 30 seconds (only in production)
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      console.log('🚀 Running initial sync...');
      syncContractMetrics().catch(console.error);
      setTimeout(() => {
        syncOrderHistory().catch(console.error);
      }, 5000); // Stagger the syncs
      setTimeout(() => {
        syncTotalVolume().catch(console.error);
      }, 10000); // Stagger more
    }, 30000);
  }
} else {
  console.log('⚠️  Cron jobs disabled (development mode)');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⛓️  Chain: Base Mainnet`);
  console.log(`📋 Contract: 0x0574A0941Ca659D01CF7370E37492bd2DF43128d`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
});