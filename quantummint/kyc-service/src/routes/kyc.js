const express = require('express');
const { v4: uuidv4 } = require('uuid');
const KycProfile = require('../models/KycProfile');
const kycService = require('../services/kycService');
const logger = require('../utils/logger');
const { validateKycProfile, validateKycQuery } = require('../middleware/validation');

const router = express.Router();

// Create KYC profile
router.post('/profile', validateKycProfile, async (req, res) => {
  try {
    const { userId, personalInfo, address, identityDocument } = req.body;
    
    // Check if profile already exists
    const existingProfile = await KycProfile.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        error: 'KYC profile already exists for this user'
      });
    }

    const profileData = {
      userId,
      profileId: uuidv4(),
      personalInfo,
      address,
      identityDocument,
      verificationStatus: 'pending',
      verificationLevel: 'basic'
    };

    const profile = await kycService.createProfile(profileData);
    
    logger.info(`KYC profile created: ${profile.profileId}`);
    res.status(201).json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Create KYC profile error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get KYC profile by user ID
router.get('/profile/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await KycProfile.findOne({ userId }).populate('documents');
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'KYC profile not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Get KYC profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get KYC profile by profile ID
router.get('/profile/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const profile = await KycProfile.findOne({ profileId }).populate('documents');
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'KYC profile not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Get KYC profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update KYC profile
router.put('/profile/:profileId', validateKycProfile, async (req, res) => {
  try {
    const { profileId } = req.params;
    const updateData = req.body;

    const profile = await kycService.updateProfile(profileId, updateData);
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Update KYC profile error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Submit profile for verification
router.post('/profile/:profileId/submit', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { verificationType = 'comprehensive' } = req.body;

    const result = await kycService.submitForVerification(profileId, verificationType);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Submit for verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get verification status
router.get('/profile/:profileId/status', async (req, res) => {
  try {
    const { profileId } = req.params;
    const status = await kycService.getVerificationStatus(profileId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Approve KYC profile (admin endpoint)
router.post('/profile/:profileId/approve', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { reviewedBy, notes, verificationLevel } = req.body;

    const profile = await kycService.approveProfile(profileId, {
      reviewedBy,
      notes,
      verificationLevel
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Approve KYC profile error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Reject KYC profile (admin endpoint)
router.post('/profile/:profileId/reject', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { reviewedBy, reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const profile = await kycService.rejectProfile(profileId, {
      reviewedBy,
      reason,
      notes
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Reject KYC profile error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get KYC profiles with filtering (admin endpoint)
router.get('/profiles', validateKycQuery, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, level, riskLevel, startDate, endDate } = req.query;
    
    const query = {};
    if (status) query.verificationStatus = status;
    if (level) query.verificationLevel = level;
    if (riskLevel) query.riskLevel = riskLevel;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const profiles = await KycProfile.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('documents', 'type verificationStatus uploadedAt');

    const total = await KycProfile.countDocuments(query);

    res.json({
      success: true,
      data: {
        profiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get KYC profiles error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get KYC statistics
router.get('/stats', async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const stats = await KycProfile.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            status: '$verificationStatus',
            level: '$verificationLevel'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const riskStats = await KycProfile.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period,
        verificationStats: stats,
        riskStats
      }
    });
  } catch (error) {
    logger.error('Get KYC stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Run compliance checks
router.post('/profile/:profileId/compliance-check', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { checkTypes = ['sanctions_check', 'pep_check'] } = req.body;

    const results = await kycService.runComplianceChecks(profileId, checkTypes);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Compliance check error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
