const express = require('express');
const { query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Generation = require('../models/Generation');
const Wallet = require('../models/Wallet');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

// GET /api/v1/stats/overview - Get system overview statistics
router.get('/overview', [
  query('period')
    .optional()
    .isIn(['hour', 'day', 'week', 'month', 'year'])
    .withMessage('Period must be hour, day, week, month, or year'),
  validateRequest
], asyncHandler(async (req, res) => {
  const period = req.query.period || 'day';
  const now = new Date();
  let startDate;

  switch (period) {
    case 'hour':
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  try {
    const [generationStats, walletStats, userStats] = await Promise.all([
      Generation.getSystemStats(period),
      Wallet.getWalletStats(),
      getActiveUserStats(startDate)
    ]);

    const overview = {
      period,
      startDate,
      endDate: now,
      generation: {
        total: generationStats.reduce((sum, stat) => sum + stat.count, 0),
        completed: generationStats.filter(stat => stat._id.status === 'completed').reduce((sum, stat) => sum + stat.count, 0),
        failed: generationStats.filter(stat => stat._id.status === 'failed').reduce((sum, stat) => sum + stat.count, 0),
        pending: generationStats.filter(stat => stat._id.status === 'pending').reduce((sum, stat) => sum + stat.count, 0),
        totalAmount: generationStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0),
        totalGenerated: generationStats.reduce((sum, stat) => sum + (stat.totalGenerated || 0), 0)
      },
      wallets: {
        total: walletStats.reduce((sum, stat) => sum + stat.count, 0),
        active: walletStats.find(stat => stat._id === 'active')?.count || 0,
        suspended: walletStats.find(stat => stat._id === 'suspended')?.count || 0,
        frozen: walletStats.find(stat => stat._id === 'frozen')?.count || 0,
        totalBalance: walletStats.reduce((sum, stat) => sum + (stat.totalBalance || 0), 0)
      },
      users: userStats,
      system: {
        uptime: process.uptime(),
        version: process.env.GENERATION_ALGORITHM_VERSION || 'v1.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    logger.error('Error getting overview statistics:', error);
    throw error;
  }
}));

// GET /api/v1/stats/generation - Get generation statistics
router.get('/generation', [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('groupBy')
    .optional()
    .isIn(['hour', 'day', 'week', 'month', 'algorithm', 'currency', 'status'])
    .withMessage('Group by must be hour, day, week, month, algorithm, currency, or status'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const end = endDate ? new Date(endDate) : new Date();

  try {
    let aggregationPipeline = [
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      }
    ];

    // Add grouping based on groupBy parameter
    switch (groupBy) {
      case 'hour':
        aggregationPipeline.push({
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
              hour: { $hour: '$createdAt' }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalGenerated: { $sum: '$result.generatedAmount' || 0 },
            totalFees: { $sum: '$result.fees' || 0 }
          }
        });
        break;
      case 'day':
        aggregationPipeline.push({
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalGenerated: { $sum: '$result.generatedAmount' || 0 },
            totalFees: { $sum: '$result.fees' || 0 }
          }
        });
        break;
      case 'week':
        aggregationPipeline.push({
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              week: { $week: '$createdAt' }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalGenerated: { $sum: '$result.generatedAmount' || 0 },
            totalFees: { $sum: '$result.fees' || 0 }
          }
        });
        break;
      case 'month':
        aggregationPipeline.push({
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalGenerated: { $sum: '$result.generatedAmount' || 0 },
            totalFees: { $sum: '$result.fees' || 0 }
          }
        });
        break;
      case 'algorithm':
        aggregationPipeline.push({
          $group: {
            _id: '$algorithm',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalGenerated: { $sum: '$result.generatedAmount' || 0 },
            totalFees: { $sum: '$result.fees' || 0 },
            averageProcessingTime: { $avg: '$result.processingTime' || 0 }
          }
        });
        break;
      case 'currency':
        aggregationPipeline.push({
          $group: {
            _id: '$currency',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalGenerated: { $sum: '$result.generatedAmount' || 0 },
            totalFees: { $sum: '$result.fees' || 0 }
          }
        });
        break;
      case 'status':
        aggregationPipeline.push({
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalGenerated: { $sum: '$result.generatedAmount' || 0 },
            totalFees: { $sum: '$result.fees' || 0 }
          }
        });
        break;
    }

    // Sort by date if grouping by time
    if (['hour', 'day', 'week', 'month'].includes(groupBy)) {
      aggregationPipeline.push({
        $sort: { '_id': 1 }
      });
    }

    const stats = await Generation.aggregate(aggregationPipeline);

    res.json({
      success: true,
      data: {
        period: { start, end },
        groupBy,
        stats,
        summary: {
          totalGenerations: stats.reduce((sum, stat) => sum + stat.count, 0),
          totalAmount: stats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0),
          totalGenerated: stats.reduce((sum, stat) => sum + (stat.totalGenerated || 0), 0),
          totalFees: stats.reduce((sum, stat) => sum + (stat.totalFees || 0), 0)
        }
      }
    });

  } catch (error) {
    logger.error('Error getting generation statistics:', error);
    throw error;
  }
}));

// GET /api/v1/stats/wallet - Get wallet statistics
router.get('/wallet', [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    const walletStats = await Wallet.aggregate([
      {
        $match: {
          'metadata.createdAt': { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBalance: { $sum: '$totalBalance' },
          totalGenerated: { $sum: '$usage.totalGenerated' },
          totalWithdrawn: { $sum: '$usage.totalWithdrawn' },
          totalFees: { $sum: '$usage.totalFees' }
        }
      }
    ]);

    const balanceStats = await Wallet.aggregate([
      {
        $match: {
          'metadata.createdAt': { $gte: start, $lte: end }
        }
      },
      {
        $unwind: '$balances'
      },
      {
        $group: {
          _id: '$balances.currency',
          totalBalance: { $sum: '$balances.amount' },
          totalLocked: { $sum: '$balances.locked' },
          walletCount: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period: { start, end },
        walletStats,
        balanceStats,
        summary: {
          totalWallets: walletStats.reduce((sum, stat) => sum + stat.count, 0),
          totalBalance: walletStats.reduce((sum, stat) => sum + (stat.totalBalance || 0), 0),
          totalGenerated: walletStats.reduce((sum, stat) => sum + (stat.totalGenerated || 0), 0),
          totalWithdrawn: walletStats.reduce((sum, stat) => sum + (stat.totalWithdrawn || 0), 0),
          totalFees: walletStats.reduce((sum, stat) => sum + (stat.totalFees || 0), 0)
        }
      }
    });

  } catch (error) {
    logger.error('Error getting wallet statistics:', error);
    throw error;
  }
}));

// GET /api/v1/stats/user/:userId - Get user-specific statistics
router.get('/user/:userId', [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'year'])
    .withMessage('Period must be day, week, month, or year'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const period = req.query.period || 'month';

  try {
    const [generationStats, wallet] = await Promise.all([
      Generation.getUserStats(userId, period),
      Wallet.getUserWallet(userId)
    ]);

    const userStats = {
      userId,
      period,
      generation: generationStats[0] || { totalAmount: 0, totalFees: 0, totalNetAmount: 0, count: 0 },
      wallet: wallet ? {
        status: wallet.status,
        totalBalance: wallet.totalBalance,
        totalLocked: wallet.totalLocked,
        availableBalance: wallet.availableBalance,
        usage: wallet.usage
      } : null
    };

    res.json({
      success: true,
      data: userStats
    });

  } catch (error) {
    logger.error('Error getting user statistics:', error);
    throw error;
  }
}));

// GET /api/v1/stats/performance - Get system performance metrics
router.get('/performance', [
  query('period')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('Period must be hour, day, week, or month'),
  validateRequest
], asyncHandler(async (req, res) => {
  const period = req.query.period || 'day';

  try {
    // This would typically fetch performance metrics from monitoring systems
    // For now, we'll return mock data
    const performanceMetrics = {
      period,
      timestamp: new Date().toISOString(),
      system: {
        cpu: {
          usage: Math.random() * 30 + 20, // 20-50%
          load: Math.random() * 2 + 0.5, // 0.5-2.5
          cores: 8
        },
        memory: {
          usage: Math.random() * 40 + 30, // 30-70%
          total: 16384, // 16GB
          available: Math.floor(Math.random() * 8000 + 4000) // 4-12GB
        },
        disk: {
          usage: Math.random() * 20 + 10, // 10-30%
          total: 1000000, // 1TB
          available: Math.floor(Math.random() * 800000 + 600000) // 600GB-1.4TB
        }
      },
      database: {
        connections: Math.floor(Math.random() * 50 + 100), // 100-150
        queryTime: Math.random() * 100 + 50, // 50-150ms
        activeQueries: Math.floor(Math.random() * 20 + 5) // 5-25
      },
      redis: {
        memory: Math.random() * 200 + 100, // 100-300MB
        connections: Math.floor(Math.random() * 10 + 5), // 5-15
        hitRate: Math.random() * 20 + 80 // 80-100%
      },
      rabbitmq: {
        queues: 8,
        messages: Math.floor(Math.random() * 1000 + 100), // 100-1100
        consumers: Math.floor(Math.random() * 10 + 5) // 5-15
      },
      algorithms: {
        quantum: {
          successRate: Math.random() * 10 + 90, // 90-100%
          averageTime: Math.random() * 2000 + 1000, // 1-3 seconds
          totalRuns: Math.floor(Math.random() * 500 + 1000) // 1000-1500
        },
        cryptographic: {
          successRate: Math.random() * 10 + 90,
          averageTime: Math.random() * 1500 + 500, // 0.5-2 seconds
          totalRuns: Math.floor(Math.random() * 800 + 1200) // 1200-2000
        },
        mathematical: {
          successRate: Math.random() * 10 + 90,
          averageTime: Math.random() * 1000 + 200, // 0.2-1.2 seconds
          totalRuns: Math.floor(Math.random() * 1200 + 1500) // 1500-2700
        },
        hybrid: {
          successRate: Math.random() * 10 + 90,
          averageTime: Math.random() * 5000 + 3000, // 3-8 seconds
          totalRuns: Math.floor(Math.random() * 200 + 300) // 300-500
        }
      }
    };

    res.json({
      success: true,
      data: performanceMetrics
    });

  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    throw error;
  }
}));

// GET /api/v1/stats/export - Export statistics data (admin only)
router.get('/export', [
  query('format')
    .isIn(['json', 'csv', 'xlsx'])
    .withMessage('Export format must be json, csv, or xlsx'),
  query('startDate')
    .isISO8601()
    .withMessage('Start date is required and must be a valid ISO 8601 date'),
  query('endDate')
    .isISO8601()
    .withMessage('End date is required and must be a valid ISO 8601 date'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { format, startDate, endDate } = req.query;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for data export',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get comprehensive data for export
    const exportData = await getExportData(start, end);

    logger.info(`Statistics export requested by admin ${req.user.id}`, {
      adminId: req.user.id,
      format,
      startDate: start,
      endDate: end,
      recordCount: exportData.length
    });

    // For now, return JSON format
    // In production, this would generate and return the requested format
    res.json({
      success: true,
      message: 'Export data prepared successfully',
      data: {
        format,
        startDate: start,
        endDate: end,
        recordCount: exportData.length,
        exportData
      }
    });

  } catch (error) {
    logger.error('Error exporting statistics:', error);
    throw error;
  }
}));

// Helper functions
async function getActiveUserStats(startDate) {
  try {
    const stats = await Generation.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$userId',
          generationCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: null,
          activeUsers: { $sum: 1 },
          totalGenerations: { $sum: '$generationCount' },
          averageGenerationsPerUser: { $avg: '$generationCount' }
        }
      }
    ]);

    return stats[0] || { activeUsers: 0, totalGenerations: 0, averageGenerationsPerUser: 0 };
  } catch (error) {
    logger.error('Error getting active user stats:', error);
    return { activeUsers: 0, totalGenerations: 0, averageGenerationsPerUser: 0 };
  }
}

async function getExportData(startDate, endDate) {
  try {
    const data = await Generation.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'wallets',
          localField: 'walletId',
          foreignField: '_id',
          as: 'wallet'
        }
      },
      {
        $project: {
          generationId: '$_id',
          userId: 1,
          username: { $arrayElemAt: ['$user.username', 0] },
          email: { $arrayElemAt: ['$user.email', 0] },
          algorithm: 1,
          amount: 1,
          currency: 1,
          status: 1,
          createdAt: 1,
          completedAt: '$result.timestamp',
          generatedAmount: '$result.generatedAmount',
          fees: '$result.fees',
          netAmount: '$result.netAmount',
          processingTime: '$result.processingTime',
          iterations: '$result.iterations',
          difficulty: '$result.difficulty'
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    return data;
  } catch (error) {
    logger.error('Error getting export data:', error);
    return [];
  }
}

module.exports = router;
