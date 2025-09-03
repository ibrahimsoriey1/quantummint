const express = require('express');
const { body, query, param } = require('express-validator');
const documentController = require('../controllers/document.controller');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { uploadSingleFile } = require('../middleware/fileUpload');

const router = express.Router();

// Upload document
router.post(
  '/upload',
  authenticate,
  uploadSingleFile('document'),
  [
    body('type')
      .isIn(['id_card', 'passport', 'driving_license', 'utility_bill', 'bank_statement', 'selfie', 'proof_of_address', 'other'])
      .withMessage('Invalid document type'),
    body('purpose')
      .isIn(['identity', 'address', 'selfie', 'enhanced_due_diligence'])
      .withMessage('Invalid document purpose'),
    body('tier')
      .isIn(['tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    body('issuingCountry')
      .optional()
      .isString()
      .withMessage('Issuing country must be a string'),
    body('documentNumber')
      .optional()
      .isString()
      .withMessage('Document number must be a string'),
    body('issuedAt')
      .optional()
      .isISO8601()
      .withMessage('Issued date must be a valid date'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Expiry date must be a valid date'),
    validateRequest
  ],
  documentController.uploadDocument
);

// Get document by ID
router.get(
  '/:id',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid document ID'),
    validateRequest
  ],
  documentController.getDocumentById
);

// Get document URL
router.get(
  '/:id/url',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid document ID'),
    validateRequest
  ],
  documentController.getDocumentUrl
);

// Get user documents
router.get(
  '/',
  authenticate,
  [
    query('type')
      .optional()
      .isIn(['id_card', 'passport', 'driving_license', 'utility_bill', 'bank_statement', 'selfie', 'proof_of_address', 'other'])
      .withMessage('Invalid document type'),
    query('purpose')
      .optional()
      .isIn(['identity', 'address', 'selfie', 'enhanced_due_diligence'])
      .withMessage('Invalid document purpose'),
    query('tier')
      .optional()
      .isIn(['tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'expired'])
      .withMessage('Invalid status'),
    validateRequest
  ],
  documentController.getUserDocuments
);

// Delete document
router.delete(
  '/:id',
  authenticate,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid document ID'),
    validateRequest
  ],
  documentController.deleteDocument
);

// Admin routes
// Verify document (admin only)
router.post(
  '/:id/verify',
  authenticate,
  authorize(['admin', 'super_admin']),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid document ID'),
    body('status')
      .isIn(['approved', 'rejected'])
      .withMessage('Status must be either approved or rejected'),
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string'),
    validateRequest
  ],
  documentController.verifyDocument
);

// Get user documents by user ID (admin only)
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
      .isIn(['id_card', 'passport', 'driving_license', 'utility_bill', 'bank_statement', 'selfie', 'proof_of_address', 'other'])
      .withMessage('Invalid document type'),
    query('purpose')
      .optional()
      .isIn(['identity', 'address', 'selfie', 'enhanced_due_diligence'])
      .withMessage('Invalid document purpose'),
    query('tier')
      .optional()
      .isIn(['tier_1', 'tier_2', 'tier_3'])
      .withMessage('Invalid tier'),
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'expired'])
      .withMessage('Invalid status'),
    validateRequest
  ],
  documentController.getUserDocumentsByUserId
);

module.exports = router;