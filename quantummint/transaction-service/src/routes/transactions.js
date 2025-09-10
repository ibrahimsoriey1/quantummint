const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Decimal = require('decimal.js');
const Transaction = require('../models/Transaction');
const Balance = require('../models/Balance');
const transactionService = require('../services/transactionService');
const logger = require('../utils/logger');
const { validateTransaction, validateTransactionQuery } = require('../middleware/validation');

const router = express.Router();

// Create a new transaction
router.post('/', validateTransaction, async (req, res) => {
  try {
    const { fromUserId, toUserId, amount, type, description, metadata } = req.body;
    
    const transactionData = {
      transactionId: uuidv4(),
      fromUserId,
      toUserId,
      amount: new Decimal(amount).toNumber(),
      type,
      description,
      metadata: metadata || {}
    };

    const transaction = await transactionService.createTransaction(transactionData);
    
    logger.info(`Transaction created: ${transaction.transactionId}`);
    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Create transaction error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get transaction by ID
router.get('/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await Transaction.findOne({ transactionId });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user transactions
router.get('/user/:userId', validateTransactionQuery, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status, type, startDate, endDate } = req.query;
    
    const query = {
      $or: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    };

    if (status) query.status = status;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get user transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update transaction status
router.patch('/:transactionId/status', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, failureReason } = req.body;

    const validStatuses = ['pending', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const updateData = { status };
    if (status === 'completed') {
      updateData.processedAt = new Date();
    }
    if (status === 'failed' && failureReason) {
      updateData.failureReason = failureReason;
    }

    const transaction = await Transaction.findOneAndUpdate(
      { transactionId },
      updateData,
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Update balances if transaction is completed
    if (status === 'completed') {
      await transactionService.updateBalancesForTransaction(transaction);
    }

    logger.info(`Transaction ${transactionId} status updated to ${status}`);
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Update transaction status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get transaction statistics
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

    const stats = await Transaction.aggregate([
      {
        $match: {
          $or: [{ fromUserId: userId }, { toUserId: userId }],
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
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
    logger.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
