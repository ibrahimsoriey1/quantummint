const express = require('express');
const { query, param } = require('express-validator');
const webhookController = require('../controllers/webhook.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Provider webhooks (public)
router.post('/stripe', express.raw({ type: 'application/json' }), webhookController.handleStripeWebhook);
router.post('/orange-money', webhookController.handleOrangeMoneyWebhook);
router.post('/afrimoney', webhookController.handleAfriMoneyWebhook);

// Admin routes
// Get webhook by ID (admin only)
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid webhook ID'),
    validateRequest
  ],
  webhookController.getWebhookById
);

// Get all webhooks (admin only)
router.get(
  '/',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('provider')
      .optional()
      .isIn(['stripe', 'orange_money', 'afrimoney'])
      .withMessage('Invalid provider'),
    query('status')
      .optional()
      .isIn(['received', 'processing', 'processed', 'failed'])
      .withMessage('Invalid status'),
    validateRequest
  ],
  webhookController.getWebhooks
);

// Retry webhook (admin only)
router.post(
  '/:id/retry',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid webhook ID'),
    validateRequest
  ],
  webhookController.retryWebhook
);

// Delete webhook (admin only)
router.delete(
  '/:id',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid webhook ID'),
    validateRequest
  ],
  webhookController.deleteWebhook
);

// Get webhook statistics (admin only)
router.get(
  '/statistics',
  authenticate,
  authorize(['admin', 'super_admin']),
  webhookController.getWebhookStatistics
);

module.exports = router;