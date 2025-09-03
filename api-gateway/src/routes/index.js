const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { 
  authProxy, 
  moneyGenerationProxy, 
  transactionProxy, 
  paymentProxy, 
  kycProxy 
} = require('../middleware/proxy');

const router = express.Router();

// Public routes (no authentication required)
// Auth routes
router.post('/auth/register', authProxy);
router.post('/auth/login', authProxy);
router.get('/auth/verify-email/:token', authProxy);
router.post('/auth/forgot-password', authProxy);
router.post('/auth/reset-password/:token', authProxy);
router.post('/auth/refresh-token', authProxy);

// Payment provider routes
router.get('/providers/active', paymentProxy);
router.get('/providers/:code', paymentProxy);
router.get('/providers/:code/fee-structure', paymentProxy);
router.post('/providers/:code/calculate-fee', paymentProxy);

// Webhook routes
router.post('/webhooks/stripe', paymentProxy);
router.post('/webhooks/orange-money', paymentProxy);
router.post('/webhooks/afrimoney', paymentProxy);

// Protected routes (authentication required)
// Auth routes
router.use('/auth/logout', authenticate, authProxy);
router.use('/auth/logout-all', authenticate, authProxy);

// User routes
router.use('/users', authenticate, authProxy);

// 2FA routes
router.use('/2fa', authenticate, authProxy);

// Money generation routes
router.use('/generation', authenticate, moneyGenerationProxy);
router.use('/wallets', authenticate, moneyGenerationProxy);

// Transaction routes
router.use('/transactions', authenticate, transactionProxy);
router.use('/balances', authenticate, transactionProxy);

// Payment routes
router.use('/payments', authenticate, paymentProxy);

// KYC routes
router.use('/kyc', authenticate, kycProxy);
router.use('/documents', authenticate, kycProxy);
router.use('/verifications', authenticate, kycProxy);

// Admin routes
router.use('/admin', authenticate, (req, res, next) => {
  // Check if user is admin
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource'
    });
  }
  
  next();
});

// Admin routes for each service
router.use('/admin/users', authProxy);
router.use('/admin/generation', moneyGenerationProxy);
router.use('/admin/wallets', moneyGenerationProxy);
router.use('/admin/transactions', transactionProxy);
router.use('/admin/balances', transactionProxy);
router.use('/admin/payments', paymentProxy);
router.use('/admin/providers', paymentProxy);
router.use('/admin/webhooks', paymentProxy);
router.use('/admin/kyc', kycProxy);
router.use('/admin/documents', kycProxy);
router.use('/admin/verifications', kycProxy);

module.exports = router;