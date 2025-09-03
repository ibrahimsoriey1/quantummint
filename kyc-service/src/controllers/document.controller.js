const documentService = require('../services/document.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Upload document
 * @route POST /api/documents/upload
 */
exports.uploadDocument = async (req, res, next) => {
  try {
    const { 
      type, 
      subType, 
      purpose, 
      tier, 
      issuingCountry, 
      documentNumber, 
      issuedAt, 
      expiresAt 
    } = req.body;
    
    const userId = req.user.id;
    const file = req.file;
    
    if (!file) {
      return next(new ApiError(400, 'Document file is required'));
    }
    
    const document = await documentService.uploadDocument(
      {
        userId,
        type,
        subType,
        purpose,
        tier,
        issuingCountry,
        documentNumber,
        issuedAt,
        expiresAt
      },
      file
    );
    
    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: document
    });
  } catch (error) {
    logger.error(`Upload document error: ${error.message}`);
    next(error);
  }
};

/**
 * Get document by ID
 * @route GET /api/documents/:id
 */
exports.getDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const document = await documentService.getDocumentById(id);
    
    // Check if user owns the document or is admin
    if (document.userId !== userId && !['admin', 'super_admin'].includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to view this document'));
    }
    
    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error(`Get document error: ${error.message}`);
    next(error);
  }
};

/**
 * Get document URL
 * @route GET /api/documents/:id/url
 */
exports.getDocumentUrl = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await documentService.getDocumentUrl(id, userId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Get document URL error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user documents
 * @route GET /api/documents
 */
exports.getUserDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, purpose, tier, status } = req.query;
    
    const documents = await documentService.getUserDocuments(userId, {
      type,
      purpose,
      tier,
      status
    });
    
    res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    logger.error(`Get user documents error: ${error.message}`);
    next(error);
  }
};

/**
 * Verify document (admin only)
 * @route POST /api/documents/:id/verify
 */
exports.verifyDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user.id;
    
    const document = await documentService.verifyDocument(id, {
      status,
      adminId,
      reason
    });
    
    res.status(200).json({
      success: true,
      message: `Document ${status} successfully`,
      data: document
    });
  } catch (error) {
    logger.error(`Verify document error: ${error.message}`);
    next(error);
  }
};

/**
 * Delete document
 * @route DELETE /api/documents/:id
 */
exports.deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await documentService.deleteDocument(id, userId);
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    logger.error(`Delete document error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user documents by user ID (admin only)
 * @route GET /api/documents/admin/user/:userId
 */
exports.getUserDocumentsByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { type, purpose, tier, status } = req.query;
    
    const documents = await documentService.getUserDocuments(userId, {
      type,
      purpose,
      tier,
      status
    });
    
    res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    logger.error(`Get user documents by user ID error: ${error.message}`);
    next(error);
  }
};