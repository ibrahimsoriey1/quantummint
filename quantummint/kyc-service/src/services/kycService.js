const KycProfile = require('../models/KycProfile');
const Document = require('../models/Document');
const Verification = require('../models/Verification');
const verificationService = require('./verificationService');
const complianceService = require('./complianceService');
const logger = require('../utils/logger');

class KycService {
  async createKYCProfile(profileData) {
    try {
      // Validate required fields
      this.validateProfileData(profileData);

      // Check for existing profile by userId
      const existingProfile = await KycProfile.findOne({ userId: profileData.userId });

      if (existingProfile) {
        throw new Error('KYC profile already exists');
      }

      // Create profile
      const profile = new KycProfile(profileData);
      await profile.save();

      // Add initial verification history entry
      profile.verificationHistory.push({
        status: 'pending',
        reviewedAt: new Date(),
        notes: 'Profile created and pending verification'
      });

      await profile.save();
      logger.info(`KYC profile created: ${profile.profileId}`);
      
      return profile;
    } catch (error) {
      logger.error('Create KYC profile error:', error);
      throw error;
    }
  }

  async updateKYCProfile(userId, updateData) {
    try {
      const profile = await KycProfile.findOne({ userId });
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      // Don't allow updates to verified profiles
      if (profile.verificationStatus === 'verified') {
        throw new Error('Cannot update verified profile');
      }

      // Update profile data
      Object.assign(profile, updateData);
      profile.lastUpdated = new Date();

      // If profile was approved and now updated, reset to pending
      if (profile.verificationStatus === 'approved' && !updateData.adminOverride) {
        profile.verificationStatus = 'requires_update';
        profile.verificationHistory.push({
          status: 'requires_update',
          reviewedAt: new Date(),
          notes: 'Profile updated after approval, requires re-verification'
        });
      }

      await profile.save();
      logger.info(`KYC profile updated: ${profile.profileId}`);
      
      return profile;
    } catch (error) {
      logger.error('Update KYC profile error:', error);
      throw error;
    }
  }

  async uploadDocument(userId, documentData) {
    try {
      const profile = await KycProfile.findOne({ userId });
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      // Validate document type
      const validTypes = ['passport', 'driver_license', 'national_id', 'utility_bill', 'bank_statement'];
      if (!validTypes.includes(documentData.type)) {
        throw new Error('Invalid document type');
      }

      // Validate file format
      const validFormats = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validFormats.includes(documentData.file.mimetype)) {
        throw new Error('Invalid file format');
      }

      // Initialize documents array if it doesn't exist
      if (!profile.documents) {
        profile.documents = [];
      }

      // Add document to profile
      profile.documents.push({
        type: documentData.type,
        filename: documentData.file.filename,
        uploadedAt: new Date()
      });

      await profile.save();
      logger.info(`Document uploaded for profile: ${profile.profileId}`);
      
      return profile;
    } catch (error) {
      logger.error('Upload document error:', error);
      throw error;
    }
  }

  async verifyKYC(userId) {
    try {
      const profile = await KycProfile.findOne({ userId });
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      // Check if profile is ready for verification
      if (!profile.personalInfo || !profile.identityDocument || profile.documents.length === 0) {
        throw new Error('Profile not ready for verification');
      }

      // Perform compliance check
      const complianceResult = await complianceService.performComplianceCheck(profile);
      
      if (complianceResult.passed) {
        profile.verificationStatus = 'verified';
        profile.verificationDate = new Date();
      } else {
        profile.verificationStatus = 'rejected';
        profile.rejectionReason = complianceResult.checks?.sanctions?.reason || 'Compliance check failed';
      }

      await profile.save();
      logger.info(`KYC verification completed for profile: ${profile.profileId}`);
      
      return profile;
    } catch (error) {
      logger.error('Verify KYC error:', error);
      throw error;
    }
  }


  validatePersonalInfo(personalInfo) {
    if (!personalInfo.firstName || !personalInfo.lastName) {
      throw new Error('First name and last name are required');
    }

    if (!personalInfo.dateOfBirth) {
      throw new Error('Date of birth is required');
    }

    // Validate date format and age
    const dob = new Date(personalInfo.dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new Error('Invalid date of birth');
    }

    const age = Math.floor((new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) {
      throw new Error('User must be at least 18 years old');
    }

    return true;
  }

  async schedulePeriodicReview(userId) {
    try {
      const profile = await KycProfile.findOne({ userId });
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      // Only schedule review for high-risk profiles
      if (profile.riskLevel === 'high') {
        const reviewDate = new Date();
        reviewDate.setFullYear(reviewDate.getFullYear() + 1); // Annual review
        profile.nextReviewDate = reviewDate;
        await profile.save();
        logger.info(`Periodic review scheduled for profile: ${profile.profileId}`);
      }

      return profile;
    } catch (error) {
      logger.error('Schedule periodic review error:', error);
      throw error;
    }
  }

  async generateComplianceReport() {
    try {
      const profiles = await KycProfile.find({});
      
      const report = {
        totalProfiles: profiles.length,
        verifiedProfiles: profiles.filter(p => p.verificationStatus === 'verified').length,
        pendingProfiles: profiles.filter(p => p.verificationStatus === 'pending').length,
        rejectedProfiles: profiles.filter(p => p.verificationStatus === 'rejected').length,
        riskDistribution: {
          low: profiles.filter(p => p.riskLevel === 'low').length,
          medium: profiles.filter(p => p.riskLevel === 'medium').length,
          high: profiles.filter(p => p.riskLevel === 'high').length
        },
        generatedAt: new Date()
      };

      logger.info('Compliance report generated');
      return report;
    } catch (error) {
      logger.error('Generate compliance report error:', error);
      throw error;
    }
  }

  async submitForVerification(profileId, verificationType = 'comprehensive') {
    try {
      const profile = await KycProfile.findOne({ profileId }).populate('documents');
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      if (profile.verificationStatus === 'approved') {
        throw new Error('Profile is already approved');
      }

      // Check if required documents are uploaded
      const requiredDocuments = this.getRequiredDocuments(verificationType);
      const uploadedDocuments = profile.documents.map(doc => doc.type);
      const missingDocuments = requiredDocuments.filter(type => !uploadedDocuments.includes(type));

      if (missingDocuments.length > 0) {
        throw new Error(`Missing required documents: ${missingDocuments.join(', ')}`);
      }

      // Update profile status
      profile.verificationStatus = 'in_review';
      profile.verificationHistory.push({
        status: 'in_review',
        reviewedAt: new Date(),
        notes: `Submitted for ${verificationType} verification`
      });

      await profile.save();

      // Start verification process
      const verification = await verificationService.startVerification({
        verificationId: require('uuid').v4(),
        userId: profile.userId,
        profileId: profile.profileId,
        type: verificationType,
        method: 'comprehensive',
        provider: 'internal'
      });

      logger.info(`KYC profile submitted for verification: ${profileId}`);
      
      return {
        profile,
        verification
      };
    } catch (error) {
      logger.error('Submit for verification error:', error);
      throw error;
    }
  }

  async approveProfile(profileId, reviewData) {
    try {
      const profile = await KycProfile.findOne({ profileId });
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      profile.verificationStatus = 'approved';
      profile.verificationLevel = reviewData.verificationLevel || profile.verificationLevel;
      profile.approvedAt = new Date();
      
      profile.verificationHistory.push({
        status: 'approved',
        reviewedBy: reviewData.reviewedBy,
        reviewedAt: new Date(),
        notes: reviewData.notes || 'Profile approved'
      });

      await profile.save();
      logger.info(`KYC profile approved: ${profileId}`);
      
      return profile;
    } catch (error) {
      logger.error('Approve KYC profile error:', error);
      throw error;
    }
  }

  async rejectProfile(profileId, reviewData) {
    try {
      const profile = await KycProfile.findOne({ profileId });
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      profile.verificationStatus = 'rejected';
      profile.rejectedAt = new Date();
      
      profile.verificationHistory.push({
        status: 'rejected',
        reviewedBy: reviewData.reviewedBy,
        reviewedAt: new Date(),
        reason: reviewData.reason,
        notes: reviewData.notes || 'Profile rejected'
      });

      await profile.save();
      logger.info(`KYC profile rejected: ${profileId}`);
      
      return profile;
    } catch (error) {
      logger.error('Reject KYC profile error:', error);
      throw error;
    }
  }

  async getKYCStatus(userId) {
    try {
      const profile = await KycProfile.findOne({ userId }).populate('documents');
      if (!profile) {
        return null;
      }

      // Get latest verification
      const latestVerification = await Verification.findOne({ profileId: profile.profileId })
        .sort({ createdAt: -1 });

      return {
        profileId: profile.profileId,
        verificationStatus: profile.verificationStatus,
        verificationLevel: profile.verificationLevel,
        riskLevel: profile.riskLevel,
        documents: profile.documents.map(doc => ({
          type: doc.type,
          status: doc.verificationStatus,
          uploadedAt: doc.uploadedAt
        })),
        latestVerification: latestVerification ? {
          verificationId: latestVerification.verificationId,
          status: latestVerification.status,
          type: latestVerification.type,
          createdAt: latestVerification.createdAt,
          completedAt: latestVerification.completedAt
        } : null,
        verificationHistory: profile.verificationHistory,
        complianceFlags: profile.complianceFlags
      };
    } catch (error) {
      logger.error('Get verification status error:', error);
      throw error;
    }
  }

  async runComplianceChecks(profileId, checkTypes) {
    try {
      const profile = await KycProfile.findOne({ profileId });
      if (!profile) {
        throw new Error('KYC profile not found');
      }

      const results = [];
      
      for (const checkType of checkTypes) {
        try {
          let result;
          switch (checkType) {
            case 'sanctions_check':
              result = await complianceService.checkSanctions(profile.personalInfo);
              break;
            case 'pep_check':
              result = await complianceService.checkPEP(profile.personalInfo);
              break;
            case 'adverse_media':
              result = await complianceService.checkAdverseMedia(profile.personalInfo);
              break;
            case 'watchlist':
              result = await complianceService.checkWatchlist(profile.personalInfo);
              break;
            default:
              throw new Error(`Unknown check type: ${checkType}`);
          }

          results.push({
            type: checkType,
            status: result.status,
            details: result.details,
            score: result.score
          });

          // Update profile compliance flags
          const existingFlagIndex = profile.complianceFlags.findIndex(flag => flag.type === checkType);
          const flagData = {
            type: checkType,
            status: result.status,
            details: result.details,
            checkedAt: new Date()
          };

          if (existingFlagIndex >= 0) {
            profile.complianceFlags[existingFlagIndex] = flagData;
          } else {
            profile.complianceFlags.push(flagData);
          }

        } catch (error) {
          logger.error(`Compliance check ${checkType} failed:`, error);
          results.push({
            type: checkType,
            status: 'error',
            error: error.message
          });
        }
      }

      // Update risk level based on compliance results
      profile.riskLevel = this.calculateRiskLevel(profile.complianceFlags);
      await profile.save();

      logger.info(`Compliance checks completed for profile: ${profileId}`);
      return results;
    } catch (error) {
      logger.error('Run compliance checks error:', error);
      throw error;
    }
  }

  validateProfileData(profileData) {
    const required = ['userId', 'personalInfo', 'address', 'identityDocument'];
    const missing = required.filter(field => !profileData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate personal info
    const personalRequired = ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'phoneNumber', 'email'];
    const personalMissing = personalRequired.filter(field => !profileData.personalInfo[field]);
    
    if (personalMissing.length > 0) {
      throw new Error('Missing required personal information');
    }

    // Validate identity document
    const docRequired = ['type', 'number', 'issuingCountry', 'expiryDate'];
    const docMissing = docRequired.filter(field => !profileData.identityDocument[field]);
    
    if (docMissing.length > 0) {
      throw new Error(`Missing identity document fields: ${docMissing.join(', ')}`);
    }

    // Check if document is not expired
    if (new Date(profileData.identityDocument.expiryDate) <= new Date()) {
      throw new Error('Identity document is expired');
    }

    return true;
  }

  getRequiredDocuments(verificationType) {
    const documentRequirements = {
      basic: ['identity_front', 'selfie'],
      intermediate: ['identity_front', 'identity_back', 'selfie', 'proof_of_address'],
      advanced: ['identity_front', 'identity_back', 'selfie', 'proof_of_address', 'bank_statement'],
      comprehensive: ['identity_front', 'identity_back', 'selfie', 'proof_of_address', 'bank_statement']
    };

    return documentRequirements[verificationType] || documentRequirements.basic;
  }

  calculateRiskLevel(complianceFlags) {
    if (!complianceFlags || complianceFlags.length === 0) {
      return 'medium';
    }

    const flaggedChecks = complianceFlags.filter(flag => flag.status === 'flagged');
    
    if (flaggedChecks.length === 0) {
      return 'low';
    }

    // High risk if sanctions or PEP flagged
    const highRiskFlags = flaggedChecks.filter(flag => 
      ['sanctions_check', 'pep_check'].includes(flag.type)
    );

    if (highRiskFlags.length > 0) {
      return 'high';
    }

    // Medium risk for other flags
    return 'medium';
  }

  async getProfilesByStatus(status, options = {}) {
    try {
      const { page = 1, limit = 10 } = options;
      const skip = (page - 1) * limit;

      const profiles = await KycProfile.find({ verificationStatus: status })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('documents', 'type verificationStatus uploadedAt');

      const total = await KycProfile.countDocuments({ verificationStatus: status });

      return {
        profiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get profiles by status error:', error);
      throw error;
    }
  }

  async getKycStats(period = '30d') {
    try {
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
              level: '$verificationLevel',
              riskLevel: '$riskLevel'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      const approvalRate = await KycProfile.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            verificationStatus: { $in: ['approved', 'rejected'] }
          }
        },
        {
          $group: {
            _id: '$verificationStatus',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        period,
        statistics: stats,
        approvalRate
      };
    } catch (error) {
      logger.error('Get KYC stats error:', error);
      throw error;
    }
  }
}

module.exports = new KycService();
