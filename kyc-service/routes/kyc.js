const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticateToken, requireKYCLevel, kycRateLimiter } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();
const { emitKycUpdate } = require('../utils/realtime');

// Apply rate limiting to all KYC endpoints
router.use(kycRateLimiter);

// Create KYC application
router.post('/',
  authenticateToken,
  [
    body('personalInfo.firstName').isString().notEmpty().max(50),
    body('personalInfo.lastName').isString().notEmpty().max(50),
    body('personalInfo.dateOfBirth').isISO8601(),
    body('personalInfo.nationality').isString().notEmpty().max(50),
    body('personalInfo.gender').isIn(['male', 'female', 'other']),
    body('contactInfo.email').isEmail(),
    body('contactInfo.phone').isString().notEmpty().max(20),
    body('contactInfo.address.street').isString().notEmpty().max(100),
    body('contactInfo.address.city').isString().notEmpty().max(50),
    body('contactInfo.address.state').isString().notEmpty().max(50),
    body('contactInfo.address.country').isString().notEmpty().max(50),
    body('contactInfo.address.postalCode').isString().notEmpty().max(20),
    body('identityInfo.documentType').isIn(['passport', 'national_id', 'drivers_license']),
    body('identityInfo.documentNumber').isString().notEmpty().max(50),
    body('identityInfo.issuingCountry').isString().notEmpty().max(50),
    body('identityInfo.expiryDate').isISO8601(),
    body('employmentInfo.employmentStatus').isIn(['employed', 'self_employed', 'unemployed', 'student', 'retired']),
    body('employmentInfo.employerName').optional().isString().max(100),
    body('employmentInfo.jobTitle').optional().isString().max(100),
    body('employmentInfo.annualIncome').optional().isFloat({ min: 0 }),
    body('sourceOfFunds').isArray({ min: 1 }),
    body('sourceOfFunds.*').isIn(['salary', 'business', 'investment', 'inheritance', 'gift', 'other']),
    body('purposeOfAccount').isString().notEmpty().max(200),
    body('riskLevel').optional().isIn(['low', 'medium', 'high']),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const kycData = req.body;

    // Create KYC application
    const kyc = await createKYCApplication(kycData, req.user.id);
    emitKycUpdate({ kycId: kyc.kycId, userId: req.user.id, status: kyc.status });

    logger.kyc('KYC application created successfully', {
      kycId: kyc.kycId,
      userId: req.user.id,
      status: kyc.status,
      level: kyc.level
    });

    res.status(201).json({
      success: true,
      data: kyc,
      message: 'KYC application created successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Get KYC application by ID
router.get('/:kycId',
  authenticateToken,
  [
    param('kycId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { kycId } = req.params;

    // Get KYC application
    const kyc = await getKYCApplicationById(kycId, req.user.id);

    res.json({
      success: true,
      data: kyc,
      timestamp: new Date().toISOString()
    });
  })
);

// Get user's KYC applications
router.get('/user/applications',
  authenticateToken,
  [
    query('status').optional().isIn(['pending', 'submitted', 'under_review', 'approved', 'rejected', 'on_hold']),
    query('level').optional().isInt({ min: 1, max: 5 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      status,
      level,
      startDate,
      endDate,
      limit = 20,
      offset = 0
    } = req.query;

    // Get user's KYC applications
    const applications = await getUserKYCApplications(req.user.id, {
      status,
      level,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: applications,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: applications.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

// Update KYC application
router.put('/:kycId',
  authenticateToken,
  [
    param('kycId').isString().notEmpty(),
    body('personalInfo').optional().isObject(),
    body('contactInfo').optional().isObject(),
    body('identityInfo').optional().isObject(),
    body('employmentInfo').optional().isObject(),
    body('sourceOfFunds').optional().isArray(),
    body('purposeOfAccount').optional().isString().max(200),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { kycId } = req.params;
    const updateData = req.body;

    // Update KYC application
    const kyc = await updateKYCApplication(kycId, updateData, req.user.id);
    emitKycUpdate({ kycId, userId: req.user.id, status: kyc.status });

    logger.kyc('KYC application updated successfully', {
      kycId,
      userId: req.user.id,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: kyc,
      message: 'KYC application updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Submit KYC application for review
router.post('/:kycId/submit',
  authenticateToken,
  [
    param('kycId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { kycId } = req.params;

    // Submit KYC application
    const result = await submitKYCApplication(kycId, req.user.id);
    emitKycUpdate({ kycId, userId: req.user.id, status: result.status });

    logger.kyc('KYC application submitted for review', {
      kycId,
      userId: req.user.id,
      status: result.status,
      submittedAt: result.submittedAt
    });

    res.json({
      success: true,
      data: result,
      message: 'KYC application submitted successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Get KYC status
router.get('/:kycId/status',
  authenticateToken,
  [
    param('kycId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { kycId } = req.params;

    // Get KYC status
    const status = await getKYCStatus(kycId, req.user.id);
    emitKycUpdate({ kycId, userId: req.user.id, status: status.status });

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  })
);

// Get KYC verification history
router.get('/:kycId/verification-history',
  authenticateToken,
  [
    param('kycId').isString().notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { kycId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Get verification history
    const history = await getKYCVerificationHistory(kycId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: history,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: history.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

// Cancel KYC application
router.post('/:kycId/cancel',
  authenticateToken,
  [
    param('kycId').isString().notEmpty(),
    body('reason').isString().notEmpty().max(500)
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { kycId } = req.params;
    const { reason } = req.body;

    // Cancel KYC application
    const result = await cancelKYCApplication(kycId, reason, req.user.id);
    emitKycUpdate({ kycId, userId: req.user.id, status: result.status });

    logger.kyc('KYC application cancelled', {
      kycId,
      userId: req.user.id,
      reason
    });

    res.json({
      success: true,
      data: result,
      message: 'KYC application cancelled successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Get KYC statistics for user
router.get('/user/stats',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Get user's KYC statistics
    const stats = await getUserKYCStatistics(req.user.id);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  })
);

// Helper functions
async function createKYCApplication(kycData, userId) {
  // This would implement KYC application creation logic
  // For now, return mock data
  return {
    kycId: `kyc_${Date.now()}`,
    userId,
    status: 'draft',
    level: 1,
    personalInfo: kycData.personalInfo,
    contactInfo: kycData.contactInfo,
    identityInfo: kycData.identityInfo,
    employmentInfo: kycData.employmentInfo,
    sourceOfFunds: kycData.sourceOfFunds,
    purposeOfAccount: kycData.purposeOfAccount,
    riskLevel: kycData.riskLevel || 'low',
    metadata: kycData.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function getKYCApplicationById(kycId, userId) {
  // This would query the database for KYC application
  // For now, return mock data
  return {
    kycId,
    userId,
    status: 'submitted',
    level: 1,
    personalInfo: {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      nationality: 'US',
      gender: 'male'
    },
    contactInfo: {
      email: 'john.doe@example.com',
      phone: '+1234567890',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'US',
        postalCode: '10001'
      }
    },
    identityInfo: {
      documentType: 'passport',
      documentNumber: 'US123456789',
      issuingCountry: 'US',
      expiryDate: '2030-01-01'
    },
    employmentInfo: {
      employmentStatus: 'employed',
      employerName: 'Tech Corp',
      jobTitle: 'Software Engineer',
      annualIncome: 80000
    },
    sourceOfFunds: ['salary'],
    purposeOfAccount: 'Personal banking and investments',
    riskLevel: 'low',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function getUserKYCApplications(userId, filters) {
  // This would query the database for user's KYC applications
  // For now, return mock data
  return [
    {
      kycId: 'kyc_1',
      userId,
      status: 'approved',
      level: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

async function updateKYCApplication(kycId, updateData, userId) {
  // This would implement KYC application update logic
  // For now, return mock data
  return {
    kycId,
    userId,
    status: 'draft',
    level: 1,
    ...updateData,
    updatedAt: new Date().toISOString()
  };
}

async function submitKYCApplication(kycId, userId) {
  // This would implement KYC application submission logic
  // For now, return mock data
  return {
    kycId,
    userId,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    estimatedReviewTime: '3-5 business days'
  };
}

async function getKYCStatus(kycId, userId) {
  // This would query the database for KYC status
  // For now, return mock data
  return {
    kycId,
    userId,
    status: 'under_review',
    level: 1,
    currentStep: 'document_verification',
    progress: 60,
    estimatedCompletion: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

async function getKYCVerificationHistory(kycId, filters) {
  // This would query the database for verification history
  // For now, return mock data
  return [
    {
      verificationId: 'ver_1',
      kycId,
      type: 'document_verification',
      status: 'completed',
      result: 'approved',
      verifiedAt: new Date().toISOString(),
      notes: 'Document verified successfully'
    }
  ];
}

async function cancelKYCApplication(kycId, reason, userId) {
  // This would implement KYC application cancellation logic
  // For now, return mock data
  return {
    kycId,
    userId,
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    reason
  };
}

async function getUserKYCStatistics(userId) {
  // This would aggregate KYC statistics for the user
  // For now, return mock data
  return {
    totalApplications: 3,
    approvedApplications: 2,
    pendingApplications: 1,
    currentLevel: 2,
    maxLevel: 5,
    lastApplicationDate: new Date().toISOString(),
    averageProcessingTime: '4.2 days'
  };
}

module.exports = router;

