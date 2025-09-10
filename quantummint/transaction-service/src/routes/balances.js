const express = require('express');
const Balance = require('../models/Balance');
const balanceService = require('../services/balanceService');
const logger = require('../utils/logger');

const router = express.Router();

// Get user balance
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { currency } = req.query;

    const balance = await balanceService.getUserBalance(userId, currency);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Initialize user balance
router.post('/:userId/initialize', async (req, res) => {
  try {
    const { userId } = req.params;
    const { currency = 'QMC' } = req.body;

    const balance = await balanceService.initializeUserBalance(userId, currency);
    
    res.status(201).json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error('Initialize balance error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Lock funds
router.post('/:userId/lock', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, currency = 'QMC', reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const result = await balanceService.lockFunds(userId, amount, currency, reason);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Lock funds error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Unlock funds
router.post('/:userId/unlock', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, currency = 'QMC', reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const result = await balanceService.unlockFunds(userId, amount, currency, reason);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Unlock funds error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Add funds to balance
router.post('/:userId/add', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, currency = 'QMC', transactionId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const result = await balanceService.addFunds(userId, amount, currency, transactionId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Add funds error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Deduct funds from balance
router.post('/:userId/deduct', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, currency = 'QMC', transactionId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const result = await balanceService.deductFunds(userId, amount, currency, transactionId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Deduct funds error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get balance history
router.get('/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, currency } = req.query;

    // This would typically come from a balance history table
    // For now, we'll return transaction history that affects balance
    const Transaction = require('../models/Transaction');
    
    const query = {
      $or: [
        { fromUserId: userId },
        { toUserId: userId }
      ],
      status: 'completed'
    };

    if (currency) query.currency = currency;

    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('transactionId amount currency type createdAt processedAt');

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: {
        history: transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get balance history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
