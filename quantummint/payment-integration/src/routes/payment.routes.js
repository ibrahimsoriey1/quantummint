const express = require('express');
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

// Public webhook routes
router.post('/webhook/:provider', paymentController.handleWebhook);

// Protected routes
router.use(authMiddleware.verifyToken);

// Payment provider routes
router.get('/providers', paymentController.getProviders);

// Cash out routes
router.post('/cash-out', paymentController.processCashOut);
router.get('/cash-out/:cashOutId', paymentController.getCashOutStatus);
router.get('/cash-out', paymentController.getCashOutHistory);

module.exports = router;