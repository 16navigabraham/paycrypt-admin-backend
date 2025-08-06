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

// Import services
const contractService = require('./services/contractService');
const { syncContractMetrics, syncOrderHistory, initializeDefaultAdmin } = require('./jobs/cronJobs');

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

// CORS configuration - FIXED for admin.paycrypt.org
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🌐 CORS Request from origin:', origin);
    
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      console.log('✅ Allowing request with no origin');
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'https://admin.paycrypt.org',
      'https://paycrypt.org',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ CORS allowed for origin:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS blocked for origin:', origin);
      console.log('❌ Allowed origins:', allowedOrigins);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Additional CORS headers (backup layer)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://admin.paycrypt.org',
    'https://paycrypt.org',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS preflight for:', req.path, 'from:', origin);
    return res.status(204).end();
  }
  
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 300 : 100, // Increased for production
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/';
  }
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
    contract: '0x0574A0941Ca659D01CF7370E37492bd2DF43128d',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Paycrypt Admin Backend API - Base Chain',
    version: '1.0.0',
    chain: 'Base Mainnet',
    contract: '0x0574A0941Ca659D01CF7370E37492bd2DF43128d',
    endpoints: ['/api/stats', '/api/orders', '/api/admin', '/health'],
    cors: {
      allowedOrigins: [
        'https://admin.paycrypt.org',
        'https://paycrypt.org'
      ]
    }
  });
});

// Connect to MongoDB with better error handling
console.log('🔗 Connecting to MongoDB...');
console.log('🔗 MongoDB URI configured:', !!process.env.MONGODB_URI);

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Initialize default admin
    initializeDefaultAdmin().catch(console.error);
    
    // Initialize contract service after DB connection
    try {
      contractService.initialize();
      console.log('✅ Contract service initialized');
    } catch (error) {
      console.error('❌ Contract service initialization failed:', error.message);
      // Don't exit - service can still work without contract initially
    }
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('❌ Make sure MONGODB_URI is set correctly');
    process.exit(1);
  });

// MongoDB connection event handlers
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Routes
app.use('/api/stats', statsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // CORS error
  if (err.message.includes('CORS') || err.message.includes('Origin')) {
    return res.status(403).json({ 
      error: 'CORS policy violation',
      message: `Origin not allowed: ${req.headers.origin}`,
      allowedOrigins: [
        'https://admin.paycrypt.org',
        'https://paycrypt.org'
      ]
    });
  }
  
  // Rate limit error
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB:', error);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB:', error);
  }
  
  process.exit(0);
});

// Start cron jobs only in production or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
  console.log('🕐 Setting up cron jobs...');

  // Every hour: sync contract metrics
  cron.schedule('0 * * * *', () => {
    console.log('⏰ Running hourly metrics sync...');
    syncContractMetrics().catch(error => {
      console.error('❌ Cron metrics sync error:', error);
    });
  });

  // Every 12 hours: sync order history
  cron.schedule('0 */12 * * *', () => {
    console.log('⏰ Running 12-hour order history sync...');
    syncOrderHistory().catch(error => {
      console.error('❌ Cron order sync error:', error);
    });
  });

  // Run initial sync after 1 minute (only in production)
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      console.log('🚀 Running initial sync...');
      syncContractMetrics()
        .then(() => {
          console.log('✅ Initial metrics sync completed');
          // Stagger order sync
          setTimeout(() => {
            syncOrderHistory()
              .then(() => console.log('✅ Initial order sync completed'))
              .catch(error => console.error('❌ Initial order sync failed:', error));
          }, 10000);
        })
        .catch(error => console.error('❌ Initial metrics sync failed:', error));
    }, 60000); // 1 minute delay
  }
} else {
  console.log('⚠️  Cron jobs disabled (development mode)');
}

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⛓️  Chain: Base Mainnet`);
  console.log(`📋 Contract: 0x0574A0941Ca659D01CF7370E37492bd2DF43128d`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS allowed for: https://admin.paycrypt.org`);
  console.log(`🔗 MongoDB: ${process.env.MONGODB_URI ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`📧 Email: ${process.env.SMTP_USER ? 'Configured' : 'NOT CONFIGURED'}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Keep server alive
server.keepAliveTimeout = 120000; // 2 minutes
server.headersTimeout = 120000; // 2 minutes