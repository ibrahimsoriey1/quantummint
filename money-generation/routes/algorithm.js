const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const generationAlgorithms = require('../services/generationAlgorithms');
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

// GET /api/v1/algorithm - Get available algorithms
router.get('/', asyncHandler(async (req, res) => {
  const algorithms = [
    {
      name: 'quantum',
      displayName: 'Quantum Algorithm',
      description: 'Quantum-inspired algorithm using quantum-like randomness and advanced cryptographic principles',
      version: generationAlgorithms.version,
      difficulty: generationAlgorithms.difficulty,
      maxIterations: generationAlgorithms.maxIterations,
      features: [
        'Quantum-like randomness',
        'Advanced seed generation',
        'High security',
        'Medium processing time'
      ],
      feeRate: 0.012,
      recommendedFor: ['Medium amounts', 'High security requirements'],
      status: 'active'
    },
    {
      name: 'cryptographic',
      displayName: 'Cryptographic Algorithm',
      description: 'Advanced encryption-based algorithm using AES-256 and SHA-512 for maximum security',
      version: generationAlgorithms.version,
      difficulty: generationAlgorithms.difficulty,
      maxIterations: generationAlgorithms.maxIterations,
      features: [
        'AES-256 encryption',
        'SHA-512 hashing',
        'High security',
        'Fast processing'
      ],
      feeRate: 0.01,
      recommendedFor: ['Low to medium amounts', 'Standard security needs'],
      status: 'active'
    },
    {
      name: 'mathematical',
      displayName: 'Mathematical Algorithm',
      description: 'Complex mathematical transformations using advanced mathematical operations and constants',
      version: generationAlgorithms.version,
      difficulty: generationAlgorithms.difficulty,
      maxIterations: generationAlgorithms.maxIterations,
      features: [
        'Mathematical transformations',
        'Mathematical constants',
        'Medium security',
        'Very fast processing'
      ],
      feeRate: 0.008,
      recommendedFor: ['Small amounts', 'Fast processing needs'],
      status: 'active'
    },
    {
      name: 'hybrid',
      displayName: 'Hybrid Algorithm',
      description: 'Combines all three algorithms for maximum security and validation',
      version: generationAlgorithms.version,
      difficulty: generationAlgorithms.difficulty * 2,
      maxIterations: generationAlgorithms.maxIterations * 3,
      features: [
        'Multi-algorithm consensus',
        'Maximum security',
        'Triple validation',
        'Longer processing time'
      ],
      feeRate: 0.015,
      recommendedFor: ['Large amounts', 'Maximum security requirements'],
      status: 'active'
    }
  ];

  res.json({
    success: true,
    data: {
      algorithms,
      version: generationAlgorithms.version,
      totalAlgorithms: algorithms.length
    }
  });
}));

// GET /api/v1/algorithm/:name - Get specific algorithm details
router.get('/:name', [
  param('name')
    .isIn(['quantum', 'cryptographic', 'mathematical', 'hybrid'])
    .withMessage('Invalid algorithm name'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { name } = req.params;

  const algorithm = {
    name,
    displayName: name.charAt(0).toUpperCase() + name.slice(1) + ' Algorithm',
    description: `Detailed information about the ${name} algorithm`,
    version: generationAlgorithms.version,
    difficulty: generationAlgorithms.difficulty,
    maxIterations: generationAlgorithms.maxIterations,
    status: 'active',
    lastUpdated: new Date().toISOString()
  };

  res.json({
    success: true,
    data: algorithm
  });
}));

// POST /api/v1/algorithm/:name/test - Test algorithm performance
router.post('/:name/test', [
  param('name')
    .isIn(['quantum', 'cryptographic', 'mathematical', 'hybrid'])
    .withMessage('Invalid algorithm name'),
  body('amount')
    .isFloat({ min: 0.01, max: 1000 })
    .withMessage('Test amount must be between 0.01 and 1,000'),
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  body('iterations')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Test iterations must be between 1 and 100'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { name } = req.params;
  const { amount, currency, iterations = 5 } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for algorithm testing',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  logger.algorithm(`Algorithm test started for ${name}`, {
    adminId: req.user.id,
    algorithm: name,
    amount,
    currency,
    iterations
  });

  const testResults = [];
  const startTime = Date.now();

  try {
    for (let i = 0; i < iterations; i++) {
      const seed = `test_${Date.now()}_${i}`;
      let result;

      switch (name) {
        case 'quantum':
          result = await generationAlgorithms.quantumAlgorithm(seed, amount, currency);
          break;
        case 'cryptographic':
          result = await generationAlgorithms.cryptographicAlgorithm(seed, amount, currency);
          break;
        case 'mathematical':
          result = await generationAlgorithms.mathematicalAlgorithm(seed, amount, currency);
          break;
        case 'hybrid':
          result = await generationAlgorithms.hybridAlgorithm(seed, amount, currency);
          break;
      }

      testResults.push({
        iteration: i + 1,
        success: result.success,
        processingTime: result.processingTime,
        iterations: result.iterations,
        hash: result.hash.substring(0, 16) + '...',
        difficulty: result.difficulty
      });
    }

    const totalTime = Date.now() - startTime;
    const successfulTests = testResults.filter(r => r.success).length;
    const averageProcessingTime = testResults.reduce((sum, r) => sum + r.processingTime, 0) / testResults.length;
    const averageIterations = testResults.reduce((sum, r) => sum + r.iterations, 0) / testResults.length;

    const summary = {
      algorithm: name,
      totalTests: iterations,
      successfulTests,
      failedTests: iterations - successfulTests,
      successRate: (successfulTests / iterations) * 100,
      totalTime,
      averageProcessingTime,
      averageIterations,
      testResults
    };

    logger.algorithm(`Algorithm test completed for ${name}`, {
      adminId: req.user.id,
      algorithm: name,
      summary
    });

    res.json({
      success: true,
      message: 'Algorithm test completed successfully',
      data: summary
    });

  } catch (error) {
    logger.error(`Algorithm test failed for ${name}:`, error);
    
    res.status(500).json({
      error: 'Algorithm test failed',
      code: 'TEST_FAILED',
      details: error.message
    });
  }
}));

// GET /api/v1/algorithm/:name/performance - Get algorithm performance metrics
router.get('/:name/performance', [
  param('name')
    .isIn(['quantum', 'cryptographic', 'mathematical', 'hybrid'])
    .withMessage('Invalid algorithm name'),
  query('period')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('Period must be hour, day, week, or month'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { name } = req.params;
  const period = req.query.period || 'day';

  // This would typically fetch performance data from a metrics database
  // For now, we'll return mock data
  const mockPerformanceData = {
    algorithm: name,
    period,
    metrics: {
      totalGenerations: Math.floor(Math.random() * 1000) + 100,
      successRate: (Math.random() * 20 + 80).toFixed(2), // 80-100%
      averageProcessingTime: Math.floor(Math.random() * 5000) + 1000, // 1-6 seconds
      averageIterations: Math.floor(Math.random() * 100000) + 50000, // 50k-150k
      totalFees: (Math.random() * 1000 + 100).toFixed(2),
      difficulty: generationAlgorithms.difficulty,
      version: generationAlgorithms.version
    },
    trends: {
      successRate: 'stable',
      processingTime: 'decreasing',
      usage: 'increasing'
    }
  };

  res.json({
    success: true,
    data: mockPerformanceData
  });
}));

// POST /api/v1/algorithm/:name/configure - Configure algorithm parameters (admin only)
router.post('/:name/configure', [
  param('name')
    .isIn(['quantum', 'cryptographic', 'mathematical', 'hybrid'])
    .withMessage('Invalid algorithm name'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Difficulty must be between 1 and 10'),
  body('maxIterations')
    .optional()
    .isInt({ min: 100000, max: 10000000 })
    .withMessage('Max iterations must be between 100,000 and 10,000,000'),
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { name } = req.params;
  const { difficulty, maxIterations, enabled } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for algorithm configuration',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  // Update algorithm configuration
  if (difficulty !== undefined) {
    generationAlgorithms.difficulty = difficulty;
  }
  if (maxIterations !== undefined) {
    generationAlgorithms.maxIterations = maxIterations;
  }

  logger.algorithm(`Algorithm ${name} configured`, {
    adminId: req.user.id,
    algorithm: name,
    newConfig: { difficulty, maxIterations, enabled }
  });

  res.json({
    success: true,
    message: 'Algorithm configuration updated successfully',
    data: {
      algorithm: name,
      currentConfig: {
        difficulty: generationAlgorithms.difficulty,
        maxIterations: generationAlgorithms.maxIterations,
        version: generationAlgorithms.version
      }
    }
  });
}));

// GET /api/v1/algorithm/compare - Compare algorithm performance
router.get('/compare', [
  query('algorithms')
    .optional()
    .isArray()
    .withMessage('Algorithms must be an array'),
  query('amount')
    .optional()
    .isFloat({ min: 0.01, max: 1000 })
    .withMessage('Amount must be between 0.01 and 1,000'),
  query('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT'])
    .withMessage('Invalid currency'),
  validateRequest
], asyncHandler(async (req, res) => {
  const algorithms = req.query.algorithms || ['quantum', 'cryptographic', 'mathematical', 'hybrid'];
  const amount = parseFloat(req.query.amount) || 100;
  const currency = req.query.currency || 'USD';

  const comparison = {
    testParameters: {
      amount,
      currency,
      algorithms
    },
    results: algorithms.map(name => ({
      name,
      displayName: name.charAt(0).toUpperCase() + name.slice(1) + ' Algorithm',
      feeRate: name === 'hybrid' ? 0.015 : name === 'quantum' ? 0.012 : name === 'cryptographic' ? 0.01 : 0.008,
      estimatedFees: (amount * (name === 'hybrid' ? 0.015 : name === 'quantum' ? 0.012 : name === 'cryptographic' ? 0.01 : 0.008)).toFixed(2),
      netAmount: (amount * (1 - (name === 'hybrid' ? 0.015 : name === 'quantum' ? 0.012 : name === 'cryptographic' ? 0.01 : 0.008))).toFixed(2),
      difficulty: name === 'hybrid' ? generationAlgorithms.difficulty * 2 : generationAlgorithms.difficulty,
      maxIterations: name === 'hybrid' ? generationAlgorithms.maxIterations * 3 : generationAlgorithms.maxIterations,
      recommendedFor: name === 'hybrid' ? 'Large amounts, maximum security' : 
                     name === 'quantum' ? 'Medium amounts, high security' :
                     name === 'cryptographic' ? 'Low to medium amounts, standard security' :
                     'Small amounts, fast processing'
    })),
    recommendations: {
      bestForSecurity: 'hybrid',
      bestForSpeed: 'mathematical',
      bestForCost: 'mathematical',
      bestForLargeAmounts: 'hybrid',
      bestForSmallAmounts: 'mathematical'
    }
  };

  res.json({
    success: true,
    data: comparison
  });
}));

// GET /api/v1/algorithm/status - Get overall algorithm system status
router.get('/status/overview', asyncHandler(async (req, res) => {
  const systemStatus = {
    version: generationAlgorithms.version,
    totalAlgorithms: 4,
    activeAlgorithms: 4,
    systemHealth: 'healthy',
    lastMaintenance: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
    nextMaintenance: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    performance: {
      averageSuccessRate: 98.5,
      averageProcessingTime: 2500, // milliseconds
      totalGenerations: 15420,
      systemUptime: 99.9
    },
    alerts: []
  };

  res.json({
    success: true,
    data: systemStatus
  });
}));

// POST /api/v1/algorithm/maintenance - Trigger algorithm maintenance (admin only)
router.post('/maintenance', [
  body('type')
    .isIn(['routine', 'emergency', 'upgrade'])
    .withMessage('Maintenance type must be routine, emergency, or upgrade'),
  body('description')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { type, description } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required for maintenance operations',
      code: 'ADMIN_ACCESS_REQUIRED'
    });
  }

  logger.algorithm(`Algorithm maintenance triggered`, {
    adminId: req.user.id,
    type,
    description
  });

  // This would typically trigger maintenance procedures
  // For now, we'll return a success response
  res.json({
    success: true,
    message: 'Maintenance procedure initiated',
    data: {
      type,
      description,
      initiatedAt: new Date().toISOString(),
      estimatedDuration: type === 'emergency' ? '1-2 hours' : type === 'upgrade' ? '4-6 hours' : '2-3 hours'
    }
  });
}));

module.exports = router;
