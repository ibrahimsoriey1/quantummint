const kycService = require('../services/kyc.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Create or update KYC profile
 * @route POST /api/kyc/profile
 */
exports.createOrUpdateKycProfile = async (req, res, next) => {
  try {
    const { personalInfo, contactInfo } = req.body;
    const userId = req.user.id;
    
    const kycProfile = await kycService.createOrUpdateKycProfile({
      userId,
      personalInfo,
      contactInfo
    });
    
    res.status(200).json({
      success: true,
      message: 'KYC profile updated successfully',
      data: kycProfile
    });
  } catch (error) {
    logger.error(`Create/update KYC profile error: ${error.message}`);
    next(error);
  }
};

/**
 * Get KYC profile
 * @route GET /api/kyc/profile
 */
exports.getKycProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const kycProfile = await kycService.getKycProfileByUserId(userId);
    
    res.status(200).json({
      success: true,
      data: kycProfile
    });
  } catch (error) {
    logger.error(`Get KYC profile error: ${error.message}`);
    next(error);
  }
};

/**
 * Verify KYC level
 * @route GET /api/kyc/verify/:userId
 */
exports.verifyKycLevel = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const result = await kycService.verifyKycLevel(userId);
    
    res.status(200).json({
      success: result.success,
      kycLevel: result.kycLevel,
      message: result.message
    });
  } catch (error) {
    logger.error(`Verify KYC level error: ${error.message}`);
    next(error);
  }
};

/**
 * Update KYC tier (admin only)
 * @route PUT /api/kyc/tier/:userId
 */
exports.updateKycTier = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { tier } = req.body;
    const adminId = req.user.id;
    
    const kycProfile = await kycService.updateKycTier(userId, tier, adminId);
    
    res.status(200).json({
      success: true,
      message: `KYC tier updated to ${tier} successfully`,
      data: kycProfile
    });
  } catch (error) {
    logger.error(`Update KYC tier error: ${error.message}`);
    next(error);
  }
};

/**
 * Check KYC status
 * @route GET /api/kyc/status
 */
exports.checkKycStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const status = await kycService.checkKycStatus(userId);
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`Check KYC status error: ${error.message}`);
    next(error);
  }
};

/**
 * Get KYC profile by user ID (admin only)
 * @route GET /api/kyc/admin/profile/:userId
 */
exports.getKycProfileByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const kycProfile = await kycService.getKycProfileByUserId(userId);
    
    res.status(200).json({
      success: true,
      data: kycProfile
    });
  } catch (error) {
    logger.error(`Get KYC profile by user ID error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all KYC profiles (admin only)
 * @route GET /api/kyc/admin/profiles
 */
exports.getAllKycProfiles = async (req, res, next) => {
  try {
    const { page, limit, status, tier, search, sort } = req.query;
    
    const result = await kycService.getAllKycProfiles({
      page,
      limit,
      status,
      tier,
      search,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.kycProfiles,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get all KYC profiles error: ${error.message}`);
    next(error);
  }
};

/**
 * Get KYC statistics (admin only)
 * @route GET /api/kyc/admin/statistics
 */
exports.getKycStatistics = async (req, res, next) => {
  try {
    const statistics = await kycService.getKycStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`Get KYC statistics error: ${error.message}`);
    next(error);
  }
};