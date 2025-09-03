const KYC = require('../models/kyc.model');
const Verification = require('../models/verification.model');
const Document = require('../models/document.model');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
require('dotenv').config();

/**
 * Create or update KYC profile
 * @param {Object} data - KYC data
 * @returns {Promise<Object>} - Created or updated KYC profile
 */
const createOrUpdateKycProfile = async (data) => {
  try {
    const { 
      userId, 
      personalInfo, 
      contactInfo
    } = data;
    
    // Check if KYC profile exists
    let kycProfile = await KYC.findOne({ userId });
    
    if (kycProfile) {
      // Update existing profile
      if (personalInfo) {
        kycProfile.personalInfo = {
          ...kycProfile.personalInfo,
          ...personalInfo
        };
      }
      
      if (contactInfo) {
        kycProfile.contactInfo = {
          ...kycProfile.contactInfo,
          ...contactInfo
        };
        
        // Update address if provided
        if (contactInfo.address) {
          kycProfile.contactInfo.address = {
            ...kycProfile.contactInfo.address,
            ...contactInfo.address
          };
        }
      }
      
      kycProfile.updatedAt = new Date();
      await kycProfile.save();
      
      logger.info(`KYC profile updated for user: ${userId}`);
    } else {
      // Create new profile
      kycProfile = new KYC({
        userId,
        personalInfo,
        contactInfo
      });
      
      await kycProfile.save();
      
      logger.info(`KYC profile created for user: ${userId}`);
    }
    
    return kycProfile;
  } catch (error) {
    logger.error(`KYC profile creation/update error: ${error.message}`);
    throw error;
  }
};

/**
 * Get KYC profile by user ID
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - KYC profile
 */
const getKycProfileByUserId = async (userId) => {
  try {
    const kycProfile = await KYC.findOne({ userId });
    
    if (!kycProfile) {
      throw new ApiError(404, 'KYC profile not found');
    }
    
    return kycProfile;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Get KYC profile error: ${error.message}`);
    throw new ApiError(500, 'Failed to get KYC profile');
  }
};

/**
 * Verify KYC level
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Verification result
 */
const verifyKycLevel = async (userId) => {
  try {
    // Get KYC profile
    const kycProfile = await KYC.findOne({ userId });
    
    if (!kycProfile) {
      return {
        success: false,
        kycLevel: 'none',
        message: 'KYC profile not found'
      };
    }
    
    // Check if KYC is approved
    if (kycProfile.status !== 'approved') {
      return {
        success: false,
        kycLevel: 'none',
        message: `KYC status is ${kycProfile.status}`
      };
    }
    
    return {
      success: true,
      kycLevel: kycProfile.currentTier,
      message: 'KYC verification successful'
    };
  } catch (error) {
    logger.error(`Verify KYC level error: ${error.message}`);
    throw new ApiError(500, 'Failed to verify KYC level');
  }
};

/**
 * Update KYC tier
 * @param {String} userId - User ID
 * @param {String} tier - KYC tier
 * @param {String} adminId - Admin ID
 * @returns {Promise<Object>} - Updated KYC profile
 */
const updateKycTier = async (userId, tier, adminId) => {
  try {
    // Get KYC profile
    const kycProfile = await KYC.findOne({ userId });
    
    if (!kycProfile) {
      throw new ApiError(404, 'KYC profile not found');
    }
    
    // Update tier
    kycProfile.currentTier = tier;
    kycProfile.status = 'approved';
    kycProfile.updatedAt = new Date();
    
    // Add verification entry
    const tierVerification = {
      type: 'identity',
      tier,
      status: 'approved',
      verifiedBy: adminId,
      verifiedAt: new Date(),
      expiresAt: calculateExpiryDate(tier)
    };
    
    kycProfile.verifications.push(tierVerification);
    
    await kycProfile.save();
    
    logger.info(`KYC tier updated to ${tier} for user: ${userId}`);
    
    return kycProfile;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Update KYC tier error: ${error.message}`);
    throw new ApiError(500, 'Failed to update KYC tier');
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

/**
 * Check KYC status
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - KYC status
 */
const checkKycStatus = async (userId) => {
  try {
    // Get KYC profile
    const kycProfile = await KYC.findOne({ userId });
    
    if (!kycProfile) {
      return {
        status: 'not_started',
        currentTier: 'none',
        message: 'KYC process not started'
      };
    }
    
    // Check for expired verifications
    const now = new Date();
    let hasExpiredVerifications = false;
    
    for (const verification of kycProfile.verifications) {
      if (verification.status === 'approved' && verification.expiresAt && verification.expiresAt < now) {
        verification.status = 'expired';
        hasExpiredVerifications = true;
      }
    }
    
    if (hasExpiredVerifications) {
      await kycProfile.save();
    }
    
    // Get pending verifications
    const pendingVerifications = kycProfile.verifications.filter(v => v.status === 'pending');
    
    // Get approved verifications
    const approvedVerifications = kycProfile.verifications.filter(v => v.status === 'approved');
    
    // Get rejected verifications
    const rejectedVerifications = kycProfile.verifications.filter(v => v.status === 'rejected');
    
    return {
      status: kycProfile.status,
      currentTier: kycProfile.currentTier,
      pendingVerifications: pendingVerifications.length,
      approvedVerifications: approvedVerifications.length,
      rejectedVerifications: rejectedVerifications.length,
      message: `KYC status: ${kycProfile.status}, tier: ${kycProfile.currentTier}`
    };
  } catch (error) {
    logger.error(`Check KYC status error: ${error.message}`);
    throw new ApiError(500, 'Failed to check KYC status');
  }
};

/**
 * Get all KYC profiles
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - KYC profiles with pagination
 */
const getAllKycProfiles = async (options = {}) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      tier,
      search,
      sort = '-createdAt' 
    } = options;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (tier) {
      query.currentTier = tier;
    }
    
    if (search) {
      query.$or = [
        { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
        { 'contactInfo.email': { $regex: search, $options: 'i' } },
        { 'contactInfo.phoneNumber': { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const kycProfiles = await KYC.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await KYC.countDocuments(query);
    
    return {
      kycProfiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Get all KYC profiles error: ${error.message}`);
    throw new ApiError(500, 'Failed to get KYC profiles');
  }
};

/**
 * Get KYC statistics
 * @returns {Promise<Object>} - KYC statistics
 */
const getKycStatistics = async () => {
  try {
    // Get total KYC profiles
    const totalProfiles = await KYC.countDocuments();
    
    // Get profiles by status
    const pendingProfiles = await KYC.countDocuments({ status: 'pending' });
    const approvedProfiles = await KYC.countDocuments({ status: 'approved' });
    const rejectedProfiles = await KYC.countDocuments({ status: 'rejected' });
    const expiredProfiles = await KYC.countDocuments({ status: 'expired' });
    
    // Get profiles by tier
    const tier1Profiles = await KYC.countDocuments({ currentTier: 'tier_1' });
    const tier2Profiles = await KYC.countDocuments({ currentTier: 'tier_2' });
    const tier3Profiles = await KYC.countDocuments({ currentTier: 'tier_3' });
    const noTierProfiles = await KYC.countDocuments({ currentTier: 'none' });
    
    // Get recent activity
    const recentActivity = await KYC.find()
      .sort('-updatedAt')
      .limit(10)
      .select('userId status currentTier updatedAt');
    
    return {
      totalProfiles,
      byStatus: {
        pending: pendingProfiles,
        approved: approvedProfiles,
        rejected: rejectedProfiles,
        expired: expiredProfiles
      },
      byTier: {
        none: noTierProfiles,
        tier_1: tier1Profiles,
        tier_2: tier2Profiles,
        tier_3: tier3Profiles
      },
      recentActivity
    };
  } catch (error) {
    logger.error(`Get KYC statistics error: ${error.message}`);
    throw new ApiError(500, 'Failed to get KYC statistics');
  }
};

module.exports = {
  createOrUpdateKycProfile,
  getKycProfileByUserId,
  verifyKycLevel,
  updateKycTier,
  checkKycStatus,
  getAllKycProfiles,
  getKycStatistics
};