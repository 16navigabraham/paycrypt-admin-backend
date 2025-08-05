const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Admin = require('../models/Admin');
const { authMiddleware } = require('../middleware/auth');
const { getSyncStatus, forceSyncAll } = require('../jobs/cronJobs');

// Configure nodemailer
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }
    
    // Find admin
    const admin = await Admin.findOne({ 
      email: email.toLowerCase(), 
      isActive: true 
    });
    
    if (!admin) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }
    
    // Check if account is locked
    if (admin.isLocked) {
      return res.status(423).json({ 
        error: 'Account is temporarily locked due to too many failed login attempts',
        lockUntil: admin.lockUntil
      });
    }
    
    // Verify password
    const isValidPassword = await admin.comparePassword(password);
    
    if (!isValidPassword) {
      // Increment failed login attempts
      await admin.incLoginAttempts();
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }
    
    // Reset login attempts on successful login
    await admin.resetLoginAttempts();
    
    // Update last login
    admin.lastLogin = new Date();
    await admin.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        adminId: admin._id, 
        email: admin.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
    
    console.log(`✅ Admin login successful: ${admin.email}`);
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        lastLogin: admin.lastLogin,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: error.message
    });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }
    
    const admin = await Admin.findOne({ 
      email: email.toLowerCase(), 
      isActive: true 
    });
    
    if (!admin) {
      // Don't reveal whether the email exists for security
      return res.json({ 
        message: 'If the email exists, a reset link has been sent' 
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    
    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpires = resetTokenExpiry;
    await admin.save();
    
    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/admin/reset-password?token=${resetToken}`;
    
    // Send reset email
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: admin.email,
      subject: 'Password Reset Request - Paycrypt Admin',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested a password reset for your Paycrypt admin account.</p>
          <p>Click the button below to reset your password (expires in 1 hour):</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            If you didn't request this, please ignore this email.<br>
            For security reasons, this link will expire in 1 hour.
          </p>
          <p style="color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log(`📧 Password reset email sent to: ${admin.email}`);
    
    res.json({ 
      message: 'If the email exists, a reset link has been sent' 
    });
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ 
      error: 'Failed to process password reset request' 
    });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token and new password are required' 
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }
    
    // Find admin with valid reset token
    const admin = await Admin.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
      isActive: true
    });
    
    if (!admin) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }
    
    // Update password and clear reset token
    admin.password = newPassword;
    admin.resetPasswordToken = null;
    admin.resetPasswordExpires = null;
    await admin.save();
    
    console.log(`✅ Password reset successful for: ${admin.email}`);
    
    res.json({ 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ 
      error: 'Failed to reset password' 
    });
  }
});

// Get admin profile (protected)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.adminId)
      .select('-password -resetPasswordToken');
    
    if (!admin) {
      return res.status(404).json({ 
        error: 'Admin not found' 
      });
    }
    
    res.json(admin);
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profile' 
    });
  }
});

// Change password (protected)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current and new passwords are required' 
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'New password must be at least 8 characters long' 
      });
    }
    
    const admin = await Admin.findById(req.admin.adminId);
    
    // Verify current password
    const isValidCurrentPassword = await admin.comparePassword(currentPassword);
    if (!isValidCurrentPassword) {
      return res.status(400).json({ 
        error: 'Current password is incorrect' 
      });
    }
    
    // Update password
    admin.password = newPassword;
    await admin.save();
    
    console.log(`✅ Password changed for: ${admin.email}`);
    
    res.json({ 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({ 
      error: 'Failed to change password' 
    });
  }
});

// Get system status (protected)
router.get('/system/status', authMiddleware, async (req, res) => {
  try {
    const syncStatus = await getSyncStatus();
    
    const systemStatus = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      database: {
        connected: true // If we reach here, DB is connected
      },
      sync: syncStatus,
      timestamp: new Date()
    };
    
    res.json(systemStatus);
  } catch (error) {
    console.error('❌ System status error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch system status' 
    });
  }
});

// Force sync all data (protected)
router.post('/system/sync', authMiddleware, async (req, res) => {
  try {
    console.log(`🔄 Force sync initiated by: ${req.admin.email}`);
    
    // Run sync in background
    forceSyncAll().catch(error => {
      console.error('❌ Force sync error:', error);
    });
    
    res.json({ 
      message: 'Sync initiated successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Force sync error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate sync' 
    });
  }
});

// Logout (protected) - mainly for logging purposes
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    console.log(`👋 Admin logout: ${req.admin.email}`);
    
    res.json({ 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed' 
    });
  }
});

module.exports = router;