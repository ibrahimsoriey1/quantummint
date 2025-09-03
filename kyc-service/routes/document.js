const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const multer = require('multer');
const { authenticateToken, documentRateLimiter } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: parseInt(process.env.MAX_FILES) || 5
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
    }
  }
});

// Apply rate limiting to all document endpoints
router.use(documentRateLimiter);

// Upload document
router.post('/upload',
  authenticateToken,
  upload.single('document'),
  [
    body('kycId').isString().notEmpty(),
    body('documentType').isIn(['identity_document', 'proof_of_address', 'proof_of_income', 'selfie', 'other']),
    body('description').optional().isString().max(500),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Document file is required',
        code: 'DOCUMENT_FILE_REQUIRED'
      });
    }

    const documentData = {
      kycId: req.body.kycId,
      documentType: req.body.documentType,
      description: req.body.description,
      metadata: req.body.metadata || {},
      file: req.file
    };

    // Upload document
    const document = await uploadDocument(documentData, req.user.id);

    logger.document('Document uploaded successfully', {
      documentId: document.documentId,
      kycId: document.kycId,
      userId: req.user.id,
      documentType: document.documentType,
      fileSize: document.fileSize
    });

    res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Upload multiple documents
router.post('/upload/batch',
  authenticateToken,
  upload.array('documents', 10),
  [
    body('kycId').isString().notEmpty(),
    body('documents').isArray({ min: 1, max: 10 }),
    body('documents.*.documentType').isIn(['identity_document', 'proof_of_address', 'proof_of_income', 'selfie', 'other']),
    body('documents.*.description').optional().isString().max(500),
    body('documents.*.metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'Document files are required',
        code: 'DOCUMENT_FILES_REQUIRED'
      });
    }

    const batchData = {
      kycId: req.body.kycId,
      documents: req.body.documents,
      files: req.files
    };

    // Upload multiple documents
    const documents = await uploadMultipleDocuments(batchData, req.user.id);

    logger.document('Multiple documents uploaded successfully', {
      kycId: batchData.kycId,
      userId: req.user.id,
      documentCount: documents.length
    });

    res.status(201).json({
      success: true,
      data: documents,
      message: `${documents.length} documents uploaded successfully`,
      timestamp: new Date().toISOString()
    });
  })
);

// Get document by ID
router.get('/:documentId',
  authenticateToken,
  [
    param('documentId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentId } = req.params;

    // Get document details
    const document = await getDocumentById(documentId, req.user.id);

    res.json({
      success: true,
      data: document,
      timestamp: new Date().toISOString()
    });
  })
);

// Get documents by KYC ID
router.get('/kyc/:kycId',
  authenticateToken,
  [
    param('kycId').isString().notEmpty(),
    query('documentType').optional().isIn(['identity_document', 'proof_of_address', 'proof_of_income', 'selfie', 'other']),
    query('status').optional().isIn(['pending', 'processing', 'verified', 'rejected']),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { kycId } = req.params;
    const {
      documentType,
      status,
      limit = 20,
      offset = 0
    } = req.query;

    // Get documents for KYC application
    const documents = await getDocumentsByKYCId(kycId, {
      documentType,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: documents,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: documents.length
      },
      timestamp: new Date().toISOString()
    });
  })
);

// Download document
router.get('/:documentId/download',
  authenticateToken,
  [
    param('documentId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentId } = req.params;

    // Get document for download
    const document = await getDocumentForDownload(documentId, req.user.id);

    // Set response headers
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Length', document.fileSize);

    // Send file buffer
    res.send(document.fileBuffer);
  })
);

// Update document metadata
router.put('/:documentId',
  authenticateToken,
  [
    param('documentId').isString().notEmpty(),
    body('description').optional().isString().max(500),
    body('metadata').optional().isObject()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentId } = req.params;
    const updateData = req.body;

    // Update document
    const document = await updateDocument(documentId, updateData, req.user.id);

    logger.document('Document updated successfully', {
      documentId,
      userId: req.user.id,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: document,
      message: 'Document updated successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Delete document
router.delete('/:documentId',
  authenticateToken,
  [
    param('documentId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentId } = req.params;

    // Delete document
    await deleteDocument(documentId, req.user.id);

    logger.document('Document deleted successfully', {
      documentId,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Document deleted successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// Get document verification status
router.get('/:documentId/verification-status',
  authenticateToken,
  [
    param('documentId').isString().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentId } = req.params;

    // Get document verification status
    const status = await getDocumentVerificationStatus(documentId, req.user.id);

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  })
);

// Get document statistics
router.get('/stats/overview',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Get document statistics for user
    const stats = await getDocumentStatistics(req.user.id);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  })
);

// Helper functions
async function uploadDocument(documentData, userId) {
  // This would implement document upload logic
  // For now, return mock data
  return {
    documentId: `doc_${Date.now()}`,
    kycId: documentData.kycId,
    userId,
    documentType: documentData.documentType,
    filename: documentData.file.originalname,
    mimeType: documentData.file.mimetype,
    fileSize: documentData.file.size,
    status: 'pending',
    description: documentData.description,
    metadata: documentData.metadata,
    uploadedAt: new Date().toISOString(),
    verificationStatus: 'pending'
  };
}

async function uploadMultipleDocuments(batchData, userId) {
  // This would implement multiple document upload logic
  // For now, return mock data
  return batchData.files.map((file, index) => ({
    documentId: `doc_${Date.now()}_${index}`,
    kycId: batchData.kycId,
    userId,
    documentType: batchData.documents[index].documentType,
    filename: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    status: 'pending',
    description: batchData.documents[index].description,
    metadata: batchData.documents[index].metadata || {},
    uploadedAt: new Date().toISOString(),
    verificationStatus: 'pending'
  }));
}

async function getDocumentById(documentId, userId) {
  // This would query the database for document details
  // For now, return mock data
  return {
    documentId,
    kycId: 'kyc_1',
    userId,
    documentType: 'identity_document',
    filename: 'passport.pdf',
    mimeType: 'application/pdf',
    fileSize: 2048576,
    status: 'verified',
    description: 'Passport document',
    metadata: {},
    uploadedAt: new Date().toISOString(),
    verificationStatus: 'verified',
    verifiedAt: new Date().toISOString()
  };
}

async function getDocumentsByKYCId(kycId, filters) {
  // This would query the database for documents by KYC ID
  // For now, return mock data
  return [
    {
      documentId: 'doc_1',
      kycId,
      documentType: 'identity_document',
      filename: 'passport.pdf',
      status: 'verified',
      verificationStatus: 'verified',
      uploadedAt: new Date().toISOString()
    }
  ];
}

async function getDocumentForDownload(documentId, userId) {
  // This would retrieve document file for download
  // For now, return mock data
  return {
    filename: 'passport.pdf',
    mimeType: 'application/pdf',
    fileSize: 2048576,
    fileBuffer: Buffer.from('Mock PDF content')
  };
}

async function updateDocument(documentId, updateData, userId) {
  // This would implement document update logic
  // For now, return mock data
  return {
    documentId,
    userId,
    ...updateData,
    updatedAt: new Date().toISOString()
  };
}

async function deleteDocument(documentId, userId) {
  // This would implement document deletion logic
  // For now, return success
  return true;
}

async function getDocumentVerificationStatus(documentId, userId) {
  // This would query the database for document verification status
  // For now, return mock data
  return {
    documentId,
    status: 'verified',
    verificationStatus: 'verified',
    verifiedAt: new Date().toISOString(),
    verificationNotes: 'Document verified successfully',
    verificationScore: 95.5
  };
}

async function getDocumentStatistics(userId) {
  // This would aggregate document statistics for the user
  // For now, return mock data
  return {
    totalDocuments: 15,
    verifiedDocuments: 12,
    pendingDocuments: 2,
    rejectedDocuments: 1,
    totalFileSize: '45.2 MB',
    averageVerificationTime: '2.1 days',
    byType: {
      identity_document: { count: 5, verified: 5 },
      proof_of_address: { count: 4, verified: 3 },
      proof_of_income: { count: 3, verified: 2 },
      selfie: { count: 2, verified: 1 },
      other: { count: 1, verified: 1 }
    }
  };
}

module.exports = router;

