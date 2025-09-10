const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Payment = require('../models/Payment');
const paymentService = require('../services/paymentService');
const logger = require('../utils/logger');
const { validatePayment, validatePaymentQuery } = require('../middleware/validation');

const router = express.Router();

// Create a new payment
router.post('/', validatePayment, async (req, res) => {
  try {
    const { userId, amount, currency, provider, type, paymentMethod, description, metadata } = req.body;
    
    const paymentData = {
      paymentId: uuidv4(),
      userId,
      amount,
      currency,
      provider,
      type,
      paymentMethod,
      description,
      metadata: metadata || {}
    };

    const payment = await paymentService.createPayment(paymentData);
    
    logger.info(`Payment created: ${payment.paymentId}`);
    res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Create payment error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get payment by ID
router.get('/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findOne({ paymentId });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user payments
router.get('/user/:userId', validatePaymentQuery, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status, provider, type, startDate, endDate } = req.query;
    
    const query = { userId };

    if (status) query.status = status;
    if (provider) query.provider = provider;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Process payment
router.post('/:paymentId/process', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentMethodDetails } = req.body;

    const result = await paymentService.processPayment(paymentId, paymentMethodDetails);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Process payment error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel payment
router.post('/:paymentId/cancel', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    const payment = await paymentService.cancelPayment(paymentId, reason);
    
    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Cancel payment error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Refund payment
router.post('/:paymentId/refund', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const refund = await paymentService.refundPayment(paymentId, amount, reason);
    
    res.json({
      success: true,
      data: refund
    });
  } catch (error) {
    logger.error('Refund payment error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get payment statistics
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = '30d' } = req.query;

    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const stats = await Payment.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate },
          status: { $in: ['completed', 'processing'] }
        }
      },
      {
        $group: {
          _id: {
            provider: '$provider',
            type: '$type'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalFees: { $sum: '$fees.amount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period,
        statistics: stats
      }
    });
  } catch (error) {
    logger.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
