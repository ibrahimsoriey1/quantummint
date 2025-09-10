const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Document = require('../models/Document');
const documentService = require('../services/documentService');
const logger = require('../utils/logger');
const { validateDocumentUpload } = require('../middleware/validation');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['jpg', 'jpeg', 'png', 'pdf'];
  const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

// Upload document
router.post('/upload', upload.single('document'), validateDocumentUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { userId, profileId, type, category } = req.body;
    
    const documentData = {
      documentId: uuidv4(),
      userId,
      profileId,
      type,
      category,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date()
    };

    const document = await documentService.processDocument(documentData);
    
    logger.info(`Document uploaded: ${document.documentId}`);
    res.status(201).json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error('Document upload error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get document by ID
router.get('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findOne({ documentId });
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error('Get document error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get documents by profile ID
router.get('/profile/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { type, category, status } = req.query;
    
    const query = { profileId };
    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.verificationStatus = status;

    const documents = await Document.find(query).sort({ uploadedAt: -1 });
    
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    logger.error('Get profile documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get documents by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, category, status } = req.query;
    
    const query = { userId };
    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.verificationStatus = status;

    const documents = await Document.find(query).sort({ uploadedAt: -1 });
    
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    logger.error('Get user documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Download document file
router.get('/:documentId/download', async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findOne({ documentId });
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const filePath = path.resolve(document.filePath);
    res.download(filePath, document.originalName);
  } catch (error) {
    logger.error('Document download error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Verify document
router.post('/:documentId/verify', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { method = 'automated' } = req.body;

    const result = await documentService.verifyDocument(documentId, method);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Document verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update document status (admin endpoint)
router.patch('/:documentId/status', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { status, notes, rejectionReason } = req.body;

    const validStatuses = ['pending', 'verified', 'rejected', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const updateData = { 
      verificationStatus: status,
      lastUpdated: new Date()
    };
    
    if (notes) updateData.notes = notes;
    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const document = await Document.findOneAndUpdate(
      { documentId },
      updateData,
      { new: true }
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    logger.info(`Document ${documentId} status updated to ${status}`);
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error('Update document status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete document
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const result = await documentService.deleteDocument(documentId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Delete document error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get document verification results
router.get('/:documentId/verification-results', async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findOne({ documentId });
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: {
        documentId: document.documentId,
        verificationStatus: document.verificationStatus,
        verificationResults: document.verificationResults,
        extractedData: document.extractedData,
        metadata: document.metadata
      }
    });
  } catch (error) {
    logger.error('Get verification results error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Bulk upload documents
router.post('/bulk-upload', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const { userId, profileId } = req.body;
    const results = [];

    for (const file of req.files) {
      try {
        const documentData = {
          documentId: uuidv4(),
          userId,
          profileId,
          type: 'other', // Will be determined by processing
          category: 'identity', // Default category
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date()
        };

        const document = await documentService.processDocument(documentData);
        results.push({
          success: true,
          document
        });
      } catch (error) {
        results.push({
          success: false,
          filename: file.originalname,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Bulk document upload error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
