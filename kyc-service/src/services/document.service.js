const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Document = require('../models/document.model');
const Verification = require('../models/verification.model');
const KYC = require('../models/kyc.model');
const { uploadFile, getPresignedUrl, deleteFile } = require('../config/s3');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
require('dotenv').config();

/**
 * Upload document
 * @param {Object} data - Document data
 * @param {Object} file - File object from multer
 * @returns {Promise<Object>} - Uploaded document
 */
const uploadDocument = async (data, file) => {
  try {
    const { 
      userId, 
      type, 
      subType, 
      purpose, 
      tier, 
      issuingCountry, 
      documentNumber, 
      issuedAt, 
      expiresAt 
    } = data;
    
    // Generate unique file key
    const fileExtension = path.extname(file.originalname);
    const fileKey = `${userId}/${type}/${uuidv4()}${fileExtension}`;
    
    // Upload file to S3
    const uploadResult = await uploadFile(
      file.buffer,
      fileKey,
      file.mimetype
    );
    
    // Create document record
    const document = new Document({
      userId,
      type,
      subType: subType || null,
      purpose,
      tier,
      fileName: file.originalname,
      fileKey,
      fileUrl: uploadResult.Location,
      fileType: file.mimetype,
      fileSize: file.size,
      issuingCountry: issuingCountry || null,
      documentNumber: documentNumber || null,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });
    
    await document.save();
    
    // Check if there's an existing verification for this purpose and tier
    let verification = await Verification.findOne({
      userId,
      type: purpose,
      tier,
      status: { $in: ['pending', 'in_progress'] }
    });
    
    if (!verification) {
      // Create new verification
      verification = new Verification({
        userId,
        type: purpose,
        tier,
        documents: [document._id],
        expiresAt: calculateExpiryDate(tier)
      });
    } else {
      // Add document to existing verification
      verification.documents.push(document._id);
      verification.status = 'pending';
      verification.updatedAt = new Date();
    }
    
    await verification.save();
    
    // Update document with verification ID
    document.verificationId = verification._id;
    await document.save();
    
    // Update KYC profile
    let kycProfile = await KYC.findOne({ userId });
    
    if (!kycProfile) {
      // Create minimal KYC profile if it doesn't exist
      kycProfile = new KYC({
        userId,
        personalInfo: {
          firstName: 'Pending',
          lastName: 'Verification',
          dateOfBirth: new Date(),
          nationality: 'Unknown'
        },
        contactInfo: {
          email: 'pending@verification.com',
          phoneNumber: 'Unknown',
          address: {
            country: 'Unknown'
          }
        }
      });
    }
    
    // Add verification to KYC profile if not already present
    const existingVerification = kycProfile.verifications.find(
      v => v.type === purpose && v.tier === tier && v.status === 'pending'
    );
    
    if (!existingVerification) {
      kycProfile.verifications.push({
        type: purpose,
        tier,
        status: 'pending',
        documentId: document._id,
        expiresAt: calculateExpiryDate(tier)
      });
      
      await kycProfile.save();
    }
    
    logger.info(`Document uploaded for user: ${userId}, type: ${type}, purpose: ${purpose}`);
    
    return document;
  } catch (error) {
    logger.error(`Document upload error: ${error.message}`);
    throw error;
  }
};

/**
 * Get document by ID
 * @param {String} documentId - Document ID
 * @returns {Promise<Object>} - Document
 */
const getDocumentById = async (documentId) => {
  try {
    const document = await Document.findById(documentId);
    
    if (!document) {
      throw new ApiError(404, 'Document not found');
    }
    
    return document;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get document error: ${error.message}`);
    throw new ApiError(500, 'Failed to get document');
  }
};

/**
 * Get document URL
 * @param {String} documentId - Document ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Document URL
 */
const getDocumentUrl = async (documentId, userId) => {
  try {
    const document = await Document.findById(documentId);
    
    if (!document) {
      throw new ApiError(404, 'Document not found');
    }
    
    // Check if user owns the document or is admin
    if (document.userId !== userId && !['admin', 'super_admin'].includes(userId)) {
      throw new ApiError(403, 'You do not have permission to access this document');
    }
    
    // Generate presigned URL
    const url = getPresignedUrl(document.fileKey, 300); // 5 minutes expiry
    
    return {
      documentId: document._id,
      fileName: document.fileName,
      fileType: document.fileType,
      url
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get document URL error: ${error.message}`);
    throw new ApiError(500, 'Failed to get document URL');
  }
};

/**
 * Get user documents
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - User documents
 */
const getUserDocuments = async (userId, options = {}) => {
  try {
    const { type, purpose, tier, status } = options;
    
    // Build query
    const query = { userId };
    
    if (type) {
      query.type = type;
    }
    
    if (purpose) {
      query.purpose = purpose;
    }
    
    if (tier) {
      query.tier = tier;
    }
    
    if (status) {
      query.status = status;
    }
    
    // Get documents
    const documents = await Document.find(query).sort('-createdAt');
    
    return documents;
  } catch (error) {
    logger.error(`Get user documents error: ${error.message}`);
    throw new ApiError(500, 'Failed to get user documents');
  }
};

/**
 * Verify document
 * @param {String} documentId - Document ID
 * @param {Object} data - Verification data
 * @returns {Promise<Object>} - Verified document
 */
const verifyDocument = async (documentId, data) => {
  try {
    const { status, adminId, reason } = data;
    
    // Get document
    const document = await Document.findById(documentId);
    
    if (!document) {
      throw new ApiError(404, 'Document not found');
    }
    
    // Update document status
    document.status = status;
    document.verifiedBy = adminId;
    document.verifiedAt = new Date();
    
    if (status === 'rejected') {
      document.rejectionReason = reason || 'Document rejected';
    }
    
    await document.save();
    
    // Update verification
    if (document.verificationId) {
      const verification = await Verification.findById(document.verificationId);
      
      if (verification) {
        // Check if all documents are verified
        const allDocuments = await Document.find({ verificationId: verification._id });
        const allVerified = allDocuments.every(doc => doc.status === 'approved' || doc.status === 'rejected');
        
        if (allVerified) {
          // If all documents are approved, mark verification as approved
          const allApproved = allDocuments.every(doc => doc.status === 'approved');
          
          verification.status = allApproved ? 'approved' : 'rejected';
          verification.verifiedBy = adminId;
          verification.verifiedAt = new Date();
          
          if (!allApproved) {
            verification.rejectionReason = 'One or more documents were rejected';
          }
          
          await verification.save();
          
          // Update KYC profile
          const kycProfile = await KYC.findOne({ userId: document.userId });
          
          if (kycProfile) {
            // Find and update the verification in KYC profile
            const kycVerification = kycProfile.verifications.find(
              v => v.type === verification.type && v.tier === verification.tier
            );
            
            if (kycVerification) {
              kycVerification.status = verification.status;
              kycVerification.verifiedBy = adminId;
              kycVerification.verifiedAt = new Date();
              
              if (verification.status === 'rejected') {
                kycVerification.rejectionReason = verification.rejectionReason;
              }
            }
            
            // Check if all verifications for the tier are approved
            const tierVerifications = kycProfile.verifications.filter(v => v.tier === verification.tier);
            const allTierVerificationsApproved = tierVerifications.every(v => v.status === 'approved');
            
            // Update KYC tier if all verifications are approved
            if (allTierVerificationsApproved) {
              const tierLevels = ['none', 'tier_1', 'tier_2', 'tier_3'];
              const currentTierIndex = tierLevels.indexOf(kycProfile.currentTier);
              const newTierIndex = tierLevels.indexOf(verification.tier);
              
              // Only upgrade tier if new tier is higher
              if (newTierIndex > currentTierIndex) {
                kycProfile.currentTier = verification.tier;
                kycProfile.status = 'approved';
              }
            }
            
            await kycProfile.save();
          }
        }
      }
    }
    
    logger.info(`Document ${status} for user: ${document.userId}, ID: ${documentId}`);
    
    return document;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Verify document error: ${error.message}`);
    throw new ApiError(500, 'Failed to verify document');
  }
};

/**
 * Delete document
 * @param {String} documentId - Document ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Deletion result
 */
const deleteDocument = async (documentId, userId) => {
  try {
    // Get document
    const document = await Document.findById(documentId);
    
    if (!document) {
      throw new ApiError(404, 'Document not found');
    }
    
    // Check if user owns the document or is admin
    if (document.userId !== userId && !['admin', 'super_admin'].includes(userId)) {
      throw new ApiError(403, 'You do not have permission to delete this document');
    }
    
    // Check if document is pending
    if (document.status !== 'pending') {
      throw new ApiError(400, `Cannot delete document with status: ${document.status}`);
    }
    
    // Delete file from S3
    await deleteFile(document.fileKey);
    
    // Remove document from verification
    if (document.verificationId) {
      await Verification.updateOne(
        { _id: document.verificationId },
        { $pull: { documents: document._id } }
      );
    }
    
    // Delete document
    await document.deleteOne();
    
    logger.info(`Document deleted for user: ${document.userId}, ID: ${documentId}`);
    
    return { success: true, message: 'Document deleted successfully' };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Delete document error: ${error.message}`);
    throw new ApiError(500, 'Failed to delete document');
  }
};

/**
 * Calculate expiry date based on tier
 * @param {String} tier - KYC tier
 * @returns {Date} - Expiry date
 */
const calculateExpiryDate = (tier) => {
  const now = new Date();
  let expiryDays;
  
  switch (tier) {
    case 'tier_1':
      expiryDays = parseInt(process.env.TIER1_VERIFICATION_EXPIRY_DAYS) || 90;
      break;
    case 'tier_2':
      expiryDays = parseInt(process.env.TIER2_VERIFICATION_EXPIRY_DAYS) || 180;
      break;
    case 'tier_3':
      expiryDays = parseInt(process.env.TIER3_VERIFICATION_EXPIRY_DAYS) || 365;
      break;
    default:
      expiryDays = 90;
  }
  
  return new Date(now.setDate(now.getDate() + expiryDays));
};

module.exports = {
  uploadDocument,
  getDocumentById,
  getDocumentUrl,
  getUserDocuments,
  verifyDocument,
  deleteDocument
};