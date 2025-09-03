const express = require('express');
const { body, query, param } = require('express-validator');
const verificationController = require('../controllers/verification.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Create verification
router.post(
  '/',
  authenticate,
  [
    body('type')
      .isIn(['email', 'phone', 'identity', 'address', 'selfie', 'enhanced_due_diligence'])
      .withMessage('Invalid verification type'),
    body('tier')
      .isIn(['tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    body('documents')
      .optional()
      .isArray()
      .withMessage('Documents must be an array'),
    validateRequest
  ],
  verificationController.createVerification
);

// Get verification by ID
router.get(
  '/:id',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid verification ID'),
    validateRequest
  ],
  verificationController.getVerificationById
);

// Get user verifications
router.get(
  '/',
  authenticate,
  [
    query('type')
      .optional()
      .isIn(['email', 'phone', 'identity', 'address', 'selfie', 'enhanced_due_diligence'])
      .withMessage('Invalid verification type'),
    query('tier')
      .optional()
      .isIn(['tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    query('status')
      .optional()
      .isIn(['pending', 'in_progress', 'approved', 'rejected', 'expired'])
      .withMessage('Invalid status'),
    validateRequest
  ],
  verificationController.getUserVerifications
);

// Admin routes
// Update verification status (admin only)
router.put(
  '/:id/status',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid verification ID'),
    body('status')
      .isIn(['approved', 'rejected'])
      .withMessage('Status must be either approved or rejected'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    validateRequest
  ],
  verificationController.updateVerificationStatus
);

// Get pending verifications (admin only)
router.get(
  '/admin/pending',
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
    query('type')
      .optional()
      .isIn(['email', 'phone', 'identity', 'address', 'selfie', 'enhanced_due_diligence'])
      .withMessage('Invalid verification type'),
    query('tier')
      .optional()
      .isIn(['tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    validateRequest
  ],
  verificationController.getPendingVerifications
);

// Get user verifications by user ID (admin only)
router.get(
  '/admin/user/:userId',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('userId')
      .notEmpty()
      .withMessage('User ID is required'),
    query('type')
      .optional()
      .isIn(['email', 'phone', 'identity', 'address', 'selfie', 'enhanced_due_diligence'])
      .withMessage('Invalid verification type'),
    query('tier')
      .optional()
      .isIn(['tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    query('status')
      .optional()
      .isIn(['pending', 'in_progress', 'approved', 'rejected', 'expired'])
      .withMessage('Invalid status'),
    validateRequest
  ],
  verificationController.getUserVerificationsByUserId
);

// Get verification statistics (admin only)
router.get(
  '/admin/statistics',
  authenticate,
  authorize(['admin', 'super_admin']),
  verificationController.getVerificationStatistics
);

module.exports = router;