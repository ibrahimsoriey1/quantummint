const express = require('express');
const { query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireModerator } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Transaction = require('../models/Transaction');
const Balance = require('../models/Balance');

const router = express.Router();

// Get system overview statistics
router.get('/overview',
  authenticateToken,
  requireModerator,
  asyncHandler(async (req, res) => {
    // Get system overview statistics
    const overviewStats = await getSystemOverviewStats();

    res.json({
      success: true,
      data: overviewStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Get transaction statistics
router.get('/transactions',
  authenticateToken,
  [
    query('period').optional().isIn(['hour', 'day', 'week', 'month', 'year']),
    query('groupBy').optional().isIn(['status', 'type', 'currency', 'hour', 'day', 'week', 'month']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed']),
    query('type').optional().isIn(['transfer', 'withdrawal', 'deposit', 'generation', 'fee', 'refund', 'exchange']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      period = 'day', 
      groupBy = 'day', 
      startDate, 
      endDate, 
      status, 
      type, 
      currency 
    } = req.query;
    
    // Get transaction statistics
    const transactionStats = await getTransactionStatistics({
      period,
      groupBy,
      startDate,
      endDate,
      status,
      type,
      currency
    });

    res.json({
      success: true,
      data: transactionStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Get balance statistics
router.get('/balance',
  authenticateToken,
  requireModerator,
  [
    query('period').optional().isIn(['hour', 'day', 'week', 'month', 'year']),
    query('groupBy').optional().isIn(['currency', 'status', 'hour', 'day', 'week', 'month']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      period = 'day', 
      groupBy = 'day', 
      startDate, 
      endDate, 
      currency 
    } = req.query;
    
    // Get balance statistics
    const balanceStats = await getBalanceStatistics({
      period,
      groupBy,
      startDate,
      endDate,
      currency
    });

    res.json({
      success: true,
      data: balanceStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Get user-specific statistics
router.get('/user/:userId',
  authenticateToken,
  [
    param('userId').isString().notEmpty(),
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('type').optional().isIn(['transactions', 'balance', 'fees', 'compliance'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { period = 'month', type = 'transactions' } = req.query;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.role !== 'moderator' && req.user.id !== userId) {
      return res.status(403).json({
        error: 'Access denied to this user\'s statistics',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Get user-specific statistics
    const userStats = await getUserStatistics(userId, period, type);

    res.json({
      success: true,
      data: userStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Get performance metrics
router.get('/performance',
  authenticateToken,
  requireModerator,
  [
    query('period').optional().isIn(['hour', 'day', 'week', 'month']),
    query('metric').optional().isIn(['response_time', 'throughput', 'error_rate', 'availability'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { period = 'hour', metric = 'response_time' } = req.query;
    
    // Get performance metrics
    const performanceMetrics = await getPerformanceMetrics(period, metric);

    res.json({
      success: true,
      data: performanceMetrics,
      timestamp: new Date().toISOString()
    });
  })
);

// Get revenue and fee statistics
router.get('/revenue',
  authenticateToken,
  requireModerator,
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('groupBy').optional().isIn(['currency', 'transaction_type', 'day', 'week', 'month']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      period = 'month', 
      groupBy = 'day', 
      startDate, 
      endDate 
    } = req.query;
    
    // Get revenue and fee statistics
    const revenueStats = await getRevenueStatistics({
      period,
      groupBy,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: revenueStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Get compliance statistics
router.get('/compliance',
  authenticateToken,
  requireModerator,
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('type').optional().isIn(['kyc', 'aml', 'sanctions', 'pep', 'pattern']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      period = 'month', 
      type, 
      startDate, 
      endDate 
    } = req.query;
    
    // Get compliance statistics
    const complianceStats = await getComplianceStatistics({
      period,
      type,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: complianceStats,
      timestamp: new Date().toISOString()
    });
  })
);

// Admin: Export statistics data
router.get('/export',
  authenticateToken,
  requireAdmin,
  [
    query('format').optional().isIn(['csv', 'json', 'xlsx']),
    query('type').isIn(['transactions', 'balance', 'revenue', 'compliance', 'performance']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('period').optional().isIn(['hour', 'day', 'week', 'month', 'year'])
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      format = 'csv', 
      type, 
      startDate, 
      endDate, 
      period = 'month' 
    } = req.query;
    
    // Export statistics data
    const exportData = await exportStatisticsData({ 
      format, 
      type, 
      startDate, 
      endDate, 
      period 
    });

    // Set appropriate headers for file download
    res.setHeader('Content-Type', getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="${type}_stats_${Date.now()}.${format}"`);
    
    res.send(exportData);
  })
);

// Helper functions
async function getSystemOverviewStats() {
  try {
    // Get basic counts
    const totalTransactions = await Transaction.countDocuments();
    const pendingTransactions = await Transaction.countDocuments({ status: 'pending' });
    const completedTransactions = await Transaction.countDocuments({ status: 'completed' });
    const failedTransactions = await Transaction.countDocuments({ status: 'failed' });
    
    // Get total balances
    const totalBalances = await Balance.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalUSD: { $sum: '$balances.USD.total' },
          totalEUR: { $sum: '$balances.EUR.total' },
          totalGBP: { $sum: '$balances.GBP.total' }
        }
      }
    ]);

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTransactions = await Transaction.countDocuments({ createdAt: { $gte: today } });
    const todayVolume = await Transaction.aggregate([
      { $match: { createdAt: { $gte: today }, status: 'completed' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ]);

    return {
      overview: {
        totalTransactions,
        pendingTransactions,
        completedTransactions,
        failedTransactions,
        successRate: totalTransactions > 0 ? ((completedTransactions / totalTransactions) * 100).toFixed(2) : 0
      },
      balances: {
        totalUSD: totalBalances[0]?.totalUSD || 0,
        totalEUR: totalBalances[0]?.totalEUR || 0,
        totalGBP: totalBalances[0]?.totalGBP || 0
      },
      today: {
        transactions: todayTransactions,
        volume: todayVolume[0]?.totalAmount || 0
      },
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting system overview stats:', error);
    throw error;
  }
}

async function getTransactionStatistics(options) {
  try {
    const { period, groupBy, startDate, endDate, status, type, currency } = options;
    
    // Build date range
    let dateRange = {};
    if (startDate && endDate) {
      dateRange = { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    } else {
      const startDate = new Date();
      switch (period) {
        case 'hour':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }
      dateRange = { createdAt: { $gte: startDate } };
    }

    // Build match criteria
    const matchCriteria = { ...dateRange };
    if (status) matchCriteria.status = status;
    if (type) matchCriteria.type = type;
    if (currency) matchCriteria.currency = currency;

    // Build group criteria
    let groupCriteria = {};
    switch (groupBy) {
      case 'status':
        groupCriteria = { _id: '$status' };
        break;
      case 'type':
        groupCriteria = { _id: '$type' };
        break;
      case 'currency':
        groupCriteria = { _id: '$currency' };
        break;
      case 'hour':
        groupCriteria = { 
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' }
          }
        };
        break;
      case 'day':
        groupCriteria = { 
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          }
        };
        break;
      case 'week':
        groupCriteria = { 
          _id: { 
            year: { $year: '$createdAt' },
            week: { $week: '$createdAt' }
          }
        };
        break;
      case 'month':
        groupCriteria = { 
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          }
        };
        break;
      default:
        groupCriteria = { _id: null };
    }

    const stats = await Transaction.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          ...groupCriteria,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalFees: { $sum: '$feeAmount' },
          avgAmount: { $avg: '$amount' },
          avgProcessingTime: { $avg: '$processingTime' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return {
      period,
      groupBy,
      filters: { status, type, currency },
      dateRange: { startDate, endDate },
      statistics: stats,
      summary: {
        totalCount: stats.reduce((sum, stat) => sum + stat.count, 0),
        totalAmount: stats.reduce((sum, stat) => sum + stat.totalAmount, 0),
        totalFees: stats.reduce((sum, stat) => sum + stat.totalFees, 0),
        averageAmount: stats.reduce((sum, stat) => sum + stat.avgAmount, 0) / stats.length || 0,
        averageProcessingTime: stats.reduce((sum, stat) => sum + stat.avgProcessingTime, 0) / stats.length || 0
      }
    };
  } catch (error) {
    logger.error('Error getting transaction statistics:', error);
    throw error;
  }
}

async function getBalanceStatistics(options) {
  try {
    const { period, groupBy, startDate, endDate, currency } = options;
    
    // This would implement balance statistics aggregation
    // For now, return mock data
    return {
      period,
      groupBy,
      filters: { currency },
      dateRange: { startDate, endDate },
      statistics: [],
      summary: {
        totalBalances: 0,
        averageBalance: 0,
        totalUsers: 0
      }
    };
  } catch (error) {
    logger.error('Error getting balance statistics:', error);
    throw error;
  }
}

async function getUserStatistics(userId, period, type) {
  try {
    // This would implement user-specific statistics
    // For now, return mock data
    return {
      userId,
      period,
      type,
      statistics: {},
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting user statistics:', error);
    throw error;
  }
}

async function getPerformanceMetrics(period, metric) {
  try {
    // This would implement performance metrics collection
    // For now, return mock data
    return {
      period,
      metric,
      data: [],
      summary: {
        average: 0,
        min: 0,
        max: 0
      }
    };
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    throw error;
  }
}

async function getRevenueStatistics(options) {
  try {
    const { period, groupBy, startDate, endDate } = options;
    
    // This would implement revenue statistics aggregation
    // For now, return mock data
    return {
      period,
      groupBy,
      dateRange: { startDate, endDate },
      statistics: [],
      summary: {
        totalRevenue: 0,
        totalFees: 0,
        averageTransactionValue: 0
      }
    };
  } catch (error) {
    logger.error('Error getting revenue statistics:', error);
    throw error;
  }
}

async function getComplianceStatistics(options) {
  try {
    const { period, type, startDate, endDate } = options;
    
    // This would implement compliance statistics aggregation
    // For now, return mock data
    return {
      period,
      type,
      dateRange: { startDate, endDate },
      statistics: [],
      summary: {
        totalChecks: 0,
        approved: 0,
        rejected: 0,
        flagged: 0
      }
    };
  } catch (error) {
    logger.error('Error getting compliance statistics:', error);
    throw error;
  }
}

async function exportStatisticsData(options) {
  try {
    const { format, type, startDate, endDate, period } = options;
    
    // This would export statistics data in the specified format
    // For now, return mock CSV data
    let csvData = '';
    
    switch (type) {
      case 'transactions':
        csvData = 'Date,Count,Amount,Fees,ProcessingTime\n';
        break;
      case 'balance':
        csvData = 'Date,Currency,Total,Available,Locked\n';
        break;
      case 'revenue':
        csvData = 'Date,Revenue,Fees,TransactionCount\n';
        break;
      case 'compliance':
        csvData = 'Date,Checks,Approved,Rejected,Flagged\n';
        break;
      case 'performance':
        csvData = 'Date,ResponseTime,Throughput,ErrorRate\n';
        break;
    }
    
    return csvData;
  } catch (error) {
    logger.error('Error exporting statistics data:', error);
    throw error;
  }
}

function getContentType(format) {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'text/plain';
  }
}

module.exports = router;
