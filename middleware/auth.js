const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '') 
      : null;
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find admin in database
    const admin = await Admin.findById(decoded.adminId).select('-password');
    
    if (!admin) {
      return res.status(401).json({ 
        error: 'Admin not found.',
        code: 'ADMIN_NOT_FOUND'
      });
    }
    
    if (!admin.isActive) {
      return res.status(401).json({ 
        error: 'Admin account is deactivated.',
        code: 'ADMIN_DEACTIVATED'
      });
    }
    
    if (admin.isLocked) {
      return res.status(401).json({ 
        error: 'Admin account is temporarily locked.',
        code: 'ADMIN_LOCKED'
      });
    }
    
    // Add admin info to request
    req.admin = {
      adminId: admin._id,
      email: admin.email,
      isActive: admin.isActive,
      lastLogin: admin.lastLogin
    };
    
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(500).json({ 
      error: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
};

// Optional auth middleware - doesn't fail if no token
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '') 
      : null;
    
    if (!token) {
      req.admin = null;
      return next();
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId).select('-password');
    
    if (admin && admin.isActive && !admin.isLocked) {
      req.admin = {
        adminId: admin._id,
        email: admin.email,
        isActive: admin.isActive,
        lastLogin: admin.lastLogin
      };
    } else {
      req.admin = null;
    }
    
    next();
  } catch (error) {
    // On error, just set admin to null and continue
    req.admin = null;
    next();
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};