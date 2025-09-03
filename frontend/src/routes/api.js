const express = require('express');
const { authenticate } = require('../middleware/auth');
const { 
  authProxy,
  moneyGenerationProxy,
  transactionProxy,
  paymentProxy,
  kycProxy
} = require('../middleware/proxy');
const { services } = require('../config/services');

const router = express.Router();

// Public routes
router.use('/auth', authProxy);

// Protected routes
router.use('/money-generation', authenticate, moneyGenerationProxy);
router.use('/transactions', authenticate, transactionProxy);
router.use('/payments', authenticate, paymentProxy);
router.use('/kyc', authenticate, kycProxy);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    services: {
      auth: services.auth.url,
      moneyGeneration: services.moneyGeneration.url,
      transaction: services.transaction.url,
      payment: services.payment.url,
      kyc: services.kyc.url
    }
  });
});

module.exports = router;
