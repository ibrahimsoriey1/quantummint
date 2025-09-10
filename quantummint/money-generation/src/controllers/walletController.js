const Wallet = require('../../../shared/models/Wallet');
const Transaction = require('../../../shared/models/Transaction');
const Generation = require('../models/Generation');
const logger = require('../../../shared/utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// Get wallet details
const getWallet = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    return res.status(404).json({
      success: false,
      message: 'Wallet not found'
    });
  }

  // Get recent transactions
  const recentTransactions = await Transaction.find({
    $or: [{ fromUserId: userId }, { toUserId: userId }]
  })
    .sort({ createdAt: -1 })
    .limit(5);

  // Get generation statistics
  const generationStats = await Generation.aggregate([
    { $match: { userId, status: 'completed' } },
    {
      $group: {
        _id: '$method',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        availableBalance: wallet.availableBalance,
        currency: wallet.currency,
        isActive: wallet.isActive,
        isFrozen: wallet.isFrozen,
        frozenReason: wallet.frozenReason,
        dailyLimit: wallet.dailyLimit,
        monthlyLimit: wallet.monthlyLimit,
        totalGenerated: wallet.totalGenerated,
        totalSpent: wallet.totalSpent,
        totalReceived: wallet.totalReceived,
        lastTransactionAt: wallet.lastTransactionAt,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      },
      recentTransactions,
      generationStats
    }
  });
});

// Get wallet balance
const getBalance = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    return res.status(404).json({
      success: false,
      message: 'Wallet not found'
    });
  }

  res.json({
    success: true,
    data: {
      balance: wallet.balance,
      availableBalance: wallet.availableBalance,
      currency: wallet.currency,
      lastUpdated: wallet.updatedAt
    }
  });
});

// Transfer money to another user
const transferMoney = asyncHandler(async (req, res) => {
  const { toUserId, toEmail, toUsername, amount, description } = req.body;
  const fromUserId = req.user.id;

  // Get sender's wallet
  const fromWallet = await Wallet.findOne({ userId: fromUserId });
  if (!fromWallet) {
    return res.status(404).json({
      success: false,
      message: 'Sender wallet not found'
    });
  }

  // Check if sender can transact
  const canTransact = fromWallet.canTransact(amount);
  if (!canTransact.allowed) {
    return res.status(400).json({
      success: false,
      message: canTransact.reason
    });
  }

  // Find recipient wallet
  let recipientQuery = {};
  if (toUserId) {
    recipientQuery = { userId: toUserId };
  } else if (toEmail) {
    const User = require('../../../shared/models/User');
    const recipient = await User.findOne({ email: toEmail });
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }
    recipientQuery = { userId: recipient._id };
  } else if (toUsername) {
    const User = require('../../../shared/models/User');
    const recipient = await User.findOne({ username: toUsername });
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }
    recipientQuery = { userId: recipient._id };
  }

  const toWallet = await Wallet.findOne(recipientQuery);
  if (!toWallet) {
    return res.status(404).json({
      success: false,
      message: 'Recipient wallet not found'
    });
  }

  if (!toWallet.isActive || toWallet.isFrozen) {
    return res.status(400).json({
      success: false,
      message: 'Recipient wallet is inactive or frozen'
    });
  }

  // Check if trying to transfer to self
  if (fromWallet.userId.toString() === toWallet.userId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot transfer to yourself'
    });
  }

  // Calculate fees
  const transferFee = Math.min(amount * 0.001, 5); // 0.1% fee, max 5 QMC
  const totalAmount = amount + transferFee;

  if (fromWallet.balance < totalAmount) {
    return res.status(400).json({
      success: false,
      message: 'Insufficient balance including fees'
    });
  }

  // Create transaction
  const transaction = new Transaction({
    fromUserId: fromWallet.userId,
    toUserId: toWallet.userId,
    fromWalletId: fromWallet._id,
    toWalletId: toWallet._id,
    amount,
    currency: 'QMC',
    type: 'transfer',
    description: description || `Transfer to ${toUsername || toEmail || 'user'}`,
    fees: {
      processingFee: transferFee,
      totalFee: transferFee
    },
    balances: {
      fromBalanceBefore: fromWallet.balance,
      toBalanceBefore: toWallet.balance
    },
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  // Process transfer
  transaction.markAsProcessing();
  
  // Update balances
  fromWallet.updateBalance(totalAmount, 'debit');
  toWallet.updateBalance(amount, 'credit');

  // Save all changes
  await Promise.all([
    fromWallet.save(),
    toWallet.save(),
    transaction.save()
  ]);

  // Mark transaction as completed
  transaction.markAsCompleted({
    fromBalanceAfter: fromWallet.balance,
    toBalanceAfter: toWallet.balance
  });
  await transaction.save();

  logger.info('Money transfer completed', {
    fromUserId: fromWallet.userId,
    toUserId: toWallet.userId,
    amount,
    transactionId: transaction.transactionId,
    fee: transferFee
  });

  res.json({
    success: true,
    message: 'Transfer completed successfully',
    data: {
      transaction: {
        id: transaction._id,
        transactionId: transaction.transactionId,
        amount,
        fee: transferFee,
        status: transaction.status,
        createdAt: transaction.createdAt
      },
      newBalance: fromWallet.balance
    }
  });
});

// Get wallet statistics
const getWalletStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { period = '30d' } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Get transaction statistics
  const transactionStats = await Transaction.aggregate([
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
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);

  // Get generation statistics
  const generationStats = await Generation.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$method',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
        totalEnergyUsed: { $sum: '$energyUsed' }
      }
    }
  ]);

  // Get daily activity
  const dailyActivity = await Transaction.aggregate([
    {
      $match: {
        $or: [{ fromUserId: userId }, { toUserId: userId }],
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        transactions: { $sum: 1 },
        volume: { $sum: '$amount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  res.json({
    success: true,
    data: {
      period,
      transactionStats,
      generationStats,
      dailyActivity
    }
  });
});

// Freeze/unfreeze wallet (admin only)
const toggleWalletFreeze = asyncHandler(async (req, res) => {
  const { userId, reason } = req.body;
  const adminId = req.user.id;

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    return res.status(404).json({
      success: false,
      message: 'Wallet not found'
    });
  }

  if (wallet.isFrozen) {
    wallet.unfreeze();
    logger.info('Wallet unfrozen', {
      walletId: wallet._id,
      userId,
      adminId
    });
  } else {
    wallet.freeze(reason, adminId);
    logger.info('Wallet frozen', {
      walletId: wallet._id,
      userId,
      reason,
      adminId
    });
  }

  await wallet.save();

  res.json({
    success: true,
    message: `Wallet ${wallet.isFrozen ? 'frozen' : 'unfrozen'} successfully`,
    data: {
      isFrozen: wallet.isFrozen,
      frozenReason: wallet.frozenReason
    }
  });
});

module.exports = {
  getWallet,
  getBalance,
  transferMoney,
  getWalletStats,
  toggleWalletFreeze
};
