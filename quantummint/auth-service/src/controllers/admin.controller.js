const User = require('../models/user.model');
const KYCVerification = require('../models/kyc-verification.model');
const { publishEvent } = require('../utils/event.util');
const logger = require('../utils/logger.util');

/**
 * Get all users (admin only)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search
    } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Search by username, email, or name
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get users with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash -salt -twoFactorSecret -recoveryCodes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    // Get KYC status for each user
    const userIds = users.map(user => user._id);
    const kycStatuses = await KYCVerification.find({
      userId: { $in: userIds }
    }).sort({ createdAt: -1 });
    
    // Create a map of userId to KYC status
    const kycStatusMap = {};
    kycStatuses.forEach(kyc => {
      if (!kycStatusMap[kyc.userId.toString()]) {
        kycStatusMap[kyc.userId.toString()] = kyc.verificationStatus;
      }
    });
    
    // Format response
    const formattedUsers = users.map(user => ({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      role: user.role,
      kycStatus: kycStatusMap[user._id.toString()] || 'not_submitted',
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));
    
    return res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          totalItems: total,
          totalPages: Math.ceil(total / parseInt(limit)),
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error(`Admin get all users error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving users'
      }
    });
  }
};

/**
 * Get user details (admin only)
 */
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user
    const user = await User.findById(userId).select('-passwordHash -salt -twoFactorSecret -recoveryCodes');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Get KYC status
    const kycStatus = await KYCVerification.findOne({ userId }).sort({ createdAt: -1 }).select('verificationStatus');
    
    // Get user's wallets (this would be a call to the transaction service in a real implementation)
    // For now, we'll mock this data
    const wallets = []; // This would be populated from the transaction service
    
    return res.status(200).json({
      success: true,
      data: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        status: user.status,
        role: user.role,
        kycStatus: kycStatus ? kycStatus.verificationStatus : 'not_submitted',
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        wallets
      }
    });
  } catch (error) {
    logger.error(`Admin get user details error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving user details'
      }
    });
  }
};

/**
 * Update user status (admin only)
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    
    // Validate status
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Invalid status value'
        }
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }
    
    // Update user status
    const previousStatus = user.status;
    user.status = status;
    await user.save();
    
    // Publish user status updated event
    await publishEvent('user.status_updated', {
      userId: user._id.toString(),
      previousStatus,
      newStatus: status,
      reason,
      updatedBy: req.user.userId
    });
    
    logger.info(`User status updated by admin: ${userId} (${previousStatus} -> ${status})`);
    
    return res.status(200).json({
      success: true,
      message: 'User status updated successfully'
    });
  } catch (error) {
    logger.error(`Admin update user status error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating user status'
      }
    });
  }
};

/**
 * Review KYC submission (admin only)
 */
exports.reviewKYC = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, notes, rejectionReason } = req.body;
    
    // Validate status
    const validStatuses = ['verified', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Invalid status value'
        }
      });
    }
    
    // Find KYC verification
    const kycVerification = await KYCVerification.findById(verificationId);
    
    if (!kycVerification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'VERIFICATION_NOT_FOUND',
          message: 'KYC verification not found'
        }
      });
    }
    
    if (kycVerification.verificationStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_REVIEWED',
          message: `KYC verification is already ${kycVerification.verificationStatus}`
        }
      });
    }
    
    // Update KYC verification
    kycVerification.verificationStatus = status;
    kycVerification.verificationNotes = notes;
    kycVerification.verifiedBy = req.user.userId;
    kycVerification.verifiedAt = new Date();
    
    if (status === 'rejected') {
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REJECTION_REASON',
            message: 'Rejection reason is required when rejecting KYC'
          }
        });
      }
      
      kycVerification.rejectionReason = rejectionReason;
    }
    
    await kycVerification.save();
    
    // Update user's ID verification status if KYC is verified
    if (status === 'verified') {
      await User.findByIdAndUpdate(kycVerification.userId, {
        'idVerification.verificationStatus': 'verified',
        'idVerification.verificationDate': new Date(),
        'idVerification.verifiedBy': req.user.userId
      });
    }
    
    // Publish KYC reviewed event
    await publishEvent('kyc.reviewed', {
      userId: kycVerification.userId.toString(),
      verificationId: kycVerification._id.toString(),
      status,
      reviewedBy: req.user.userId
    });
    
    logger.info(`KYC reviewed by admin: ${verificationId} (${status})`);
    
    return res.status(200).json({
      success: true,
      message: 'KYC verification status updated successfully'
    });
  } catch (error) {
    logger.error(`Admin review KYC error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while reviewing KYC verification'
      }
    });
  }
};

/**
 * Get system statistics (admin only)
 */
exports.getStatistics = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'yearly':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }
    
    // Get user statistics
    const [
      totalUsers,
      activeUsers,
      newUsers,
      kycVerifiedUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ 'idVerification.verificationStatus': 'verified' })
    ]);
    
    // Note: In a real implementation, we would make API calls to other services
    // to get transaction, generation, and cash-out statistics
    // For now, we'll return mock data for these
    
    return res.status(200).json({
      success: true,
      data: {
        userStats: {
          totalUsers,
          activeUsers,
          newUsers,
          kycVerifiedUsers
        },
        transactionStats: {
          totalTransactions: 0, // Mock data
          totalVolume: 0, // Mock data
          averageTransactionValue: 0 // Mock data
        },
        generationStats: {
          totalGenerated: 0, // Mock data
          totalGenerationRequests: 0, // Mock data
          successfulGenerations: 0, // Mock data
          failedGenerations: 0 // Mock data
        },
        cashOutStats: {
          totalCashOuts: 0, // Mock data
          totalCashOutVolume: 0, // Mock data
          successfulCashOuts: 0, // Mock data
          failedCashOuts: 0, // Mock data
          providerBreakdown: [] // Mock data
        }
      }
    });
  } catch (error) {
    logger.error(`Admin get statistics error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving system statistics'
      }
    });
  }
};