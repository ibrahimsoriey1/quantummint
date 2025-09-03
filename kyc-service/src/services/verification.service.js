const Verification = require('../models/verification.model');
const Document = require('../models/document.model');
const KYC = require('../models/kyc.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
require('dotenv').config();

/**
 * Create verification
 * @param {Object} data - Verification data
 * @returns {Promise<Object>} - Created verification
 */
const createVerification = async (data) => {
  try {
    const { userId, type, tier, documents = [] } = data;
    
    // Check if verification already exists
    const existingVerification = await Verification.findOne({
      userId,
      type,
      tier,
      status: { $in: ['pending', 'in_progress'] }
    });
    
    if (existingVerification) {
      throw new ApiError(409, `Verification for ${type} at ${tier} level already exists`);
    }
    
    // Create verification
    const verification = new Verification({
      userId,
      type,
      tier,
      documents,
      expiresAt: calculateExpiryDate(tier)
    });
    
    await verification.save();
    
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
    
    // Add verification to KYC profile
    kycProfile.verifications.push({
      type,
      tier,
      status: 'pending',
      expiresAt: calculateExpiryDate(tier)
    });
    
    await kycProfile.save();
    
    logger.info(`Verification created for user: ${userId}, type: ${type}, tier: ${tier}`);
    
    return verification;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Create verification error: ${error.message}`);
    throw new ApiError(500, 'Failed to create verification');
  }
};

/**
 * Get verification by ID
 * @param {String} verificationId - Verification ID
 * @returns {Promise<Object>} - Verification
 */
const getVerificationById = async (verificationId) => {
  try {
    const verification = await Verification.findById(verificationId).populate('documents');
    
    if (!verification) {
      throw new ApiError(404, 'Verification not found');
    }
    
    return verification;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get verification error: ${error.message}`);
    throw new ApiError(500, 'Failed to get verification');
  }
};

/**
 * Get user verifications
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - User verifications
 */
const getUserVerifications = async (userId, options = {}) => {
  try {
    const { type, tier, status } = options;
    
    // Build query
    const query = { userId };
    
    if (type) {
      query.type = type;
    }
    
    if (tier) {
      query.tier = tier;
    }
    
    if (status) {
      query.status = status;
    }
    
    // Get verifications
    const verifications = await Verification.find(query)
      .populate('documents')
      .sort('-createdAt');
    
    return verifications;
  } catch (error) {
    logger.error(`Get user verifications error: ${error.message}`);
    throw new ApiError(500, 'Failed to get user verifications');
  }
};

/**
 * Update verification status
 * @param {String} verificationId - Verification ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} - Updated verification
 */
const updateVerificationStatus = async (verificationId, data) => {
  try {
    const { status, adminId, reason } = data;
    
    // Get verification
    const verification = await Verification.findById(verificationId);
    
    if (!verification) {
      throw new ApiError(404, 'Verification not found');
    }
    
    // Update verification
    verification.status = status;
    verification.verifiedBy = adminId;
    verification.verifiedAt = new Date();
    
    if (status === 'rejected') {
      verification.rejectionReason = reason || 'Verification rejected';
    }
    
    await verification.save();
    
    // Update documents
    if (status === 'approved' || status === 'rejected') {
      await Document.updateMany(
        { verificationId },
        { 
          status, 
          verifiedBy: adminId, 
          verifiedAt: new Date(),
          rejectionReason: status === 'rejected' ? (reason || 'Verification rejected') : null
        }
      );
    }
    
    // Update KYC profile
    const kycProfile = await KYC.findOne({ userId: verification.userId });
    
    if (kycProfile) {
      // Find and update the verification in KYC profile
      const kycVerification = kycProfile.verifications.find(
        v => v.type === verification.type && v.tier === verification.tier
      );
      
      if (kycVerification) {
        kycVerification.status = status;
        kycVerification.verifiedBy = adminId;
        kycVerification.verifiedAt = new Date();
        
        if (status === 'rejected') {
          kycVerification.rejectionReason = reason || 'Verification rejected';
        }
      }
      
      // Check if all verifications for the tier are approved
      if (status === 'approved') {
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
      }
      
      await kycProfile.save();
    }
    
    logger.info(`Verification ${status} for user: ${verification.userId}, ID: ${verificationId}`);
    
    return verification;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Update verification status error: ${error.message}`);
    throw new ApiError(500, 'Failed to update verification status');
  }
};

/**
 * Get pending verifications
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Pending verifications with pagination
 */
const getPendingVerifications = async (options = {}) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      tier,
      sort = '-createdAt' 
    } = options;
    
    // Build query
    const query = { status: 'pending' };
    
    if (type) {
      query.type = type;
    }
    
    if (tier) {
      query.tier = tier;
    }
    
    // Execute query with pagination
    const verifications = await Verification.find(query)
      .populate('documents')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Verification.countDocuments(query);
    
    return {
      verifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Get pending verifications error: ${error.message}`);
    throw new ApiError(500, 'Failed to get pending verifications');
  }
};

/**
 * Get verification statistics
 * @returns {Promise<Object>} - Verification statistics
 */
const getVerificationStatistics = async () => {
  try {
    // Get total verifications
    const totalVerifications = await Verification.countDocuments();
    
    // Get verifications by status
    const pendingVerifications = await Verification.countDocuments({ status: 'pending' });
    const inProgressVerifications = await Verification.countDocuments({ status: 'in_progress' });
    const approvedVerifications = await Verification.countDocuments({ status: 'approved' });
    const rejectedVerifications = await Verification.countDocuments({ status: 'rejected' });
    const expiredVerifications = await Verification.countDocuments({ status: 'expired' });
    
    // Get verifications by type
    const identityVerifications = await Verification.countDocuments({ type: 'identity' });
    const addressVerifications = await Verification.countDocuments({ type: 'address' });
    const selfieVerifications = await Verification.countDocuments({ type: 'selfie' });
    const enhancedVerifications = await Verification.countDocuments({ type: 'enhanced_due_diligence' });
    
    // Get verifications by tier
    const tier1Verifications = await Verification.countDocuments({ tier: 'tier_1' });
    const tier2Verifications = await Verification.countDocuments({ tier: 'tier_2' });
    const tier3Verifications = await Verification.countDocuments({ tier: 'tier_3' });
    
    return {
      totalVerifications,
      byStatus: {
        pending: pendingVerifications,
        in_progress: inProgressVerifications,
        approved: approvedVerifications,
        rejected: rejectedVerifications,
        expired: expiredVerifications
      },
      byType: {
        identity: identityVerifications,
        address: addressVerifications,
        selfie: selfieVerifications,
        enhanced_due_diligence: enhancedVerifications
      },
      byTier: {
        tier_1: tier1Verifications,
        tier_2: tier2Verifications,
        tier_3: tier3Verifications
      }
    };
  } catch (error) {
    logger.error(`Get verification statistics error: ${error.message}`);
    throw new ApiError(500, 'Failed to get verification statistics');
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
  createVerification,
  getVerificationById,
  getUserVerifications,
  updateVerificationStatus,
  getPendingVerifications,
  getVerificationStatistics
};