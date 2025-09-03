const verificationService = require('../services/verification.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Create verification
 * @route POST /api/verifications
 */
exports.createVerification = async (req, res, next) => {
  try {
    const { type, tier, documents } = req.body;
    const userId = req.user.id;
    
    const verification = await verificationService.createVerification({
      userId,
      type,
      tier,
      documents
    });
    
    res.status(201).json({
      success: true,
      message: 'Verification created successfully',
      data: verification
    });
  } catch (error) {
    logger.error(`Create verification error: ${error.message}`);
    next(error);
  }
};

/**
 * Get verification by ID
 * @route GET /api/verifications/:id
 */
exports.getVerificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const verification = await verificationService.getVerificationById(id);
    
    // Check if user owns the verification or is admin
    if (verification.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to view this verification'));
    }
    
    res.status(200).json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error(`Get verification error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user verifications
 * @route GET /api/verifications
 */
exports.getUserVerifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, tier, status } = req.query;
    
    const verifications = await verificationService.getUserVerifications(userId, {
      type,
      tier,
      status
    });
    
    res.status(200).json({
      success: true,
      data: verifications
    });
  } catch (error) {
    logger.error(`Get user verifications error: ${error.message}`);
    next(error);
  }
};

/**
 * Update verification status (admin only)
 * @route PUT /api/verifications/:id/status
 */
exports.updateVerificationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user.id;
    
    const verification = await verificationService.updateVerificationStatus(id, {
      status,
      adminId,
      reason
    });
    
    res.status(200).json({
      success: true,
      message: `Verification ${status} successfully`,
      data: verification
    });
  } catch (error) {
    logger.error(`Update verification status error: ${error.message}`);
    next(error);
  }
};

/**
 * Get pending verifications (admin only)
 * @route GET /api/verifications/admin/pending
 */
exports.getPendingVerifications = async (req, res, next) => {
  try {
    const { page, limit, type, tier, sort } = req.query;
    
    const result = await verificationService.getPendingVerifications({
      page,
      limit,
      type,
      tier,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.verifications,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get pending verifications error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user verifications by user ID (admin only)
 * @route GET /api/verifications/admin/user/:userId
 */
exports.getUserVerificationsByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { type, tier, status } = req.query;
    
    const verifications = await verificationService.getUserVerifications(userId, {
      type,
      tier,
      status
    });
    
    res.status(200).json({
      success: true,
      data: verifications
    });
  } catch (error) {
    logger.error(`Get user verifications by user ID error: ${error.message}`);
    next(error);
  }
};

/**
 * Get verification statistics (admin only)
 * @route GET /api/verifications/admin/statistics
 */
exports.getVerificationStatistics = async (req, res, next) => {
  try {
    const statistics = await verificationService.getVerificationStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`Get verification statistics error: ${error.message}`);
    next(error);
  }
};