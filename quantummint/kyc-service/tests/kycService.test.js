const kycService = require('../src/services/KycService');
const KycProfile = require('../src/models/KycProfile');
const Verification = require('../src/models/Verification');
const complianceService = require('../src/services/complianceService');

// Mock dependencies
jest.mock('../src/models/KycProfile', () => {
  // Create a mock constructor
  const MockKycProfile = jest.fn().mockImplementation((data) => {
    const mockProfile = {
      _id: 'profile-id',
      userId: data?.userId || 'user-id',
      profileId: 'profile-id',
      verificationStatus: 'pending',
      personalInfo: data?.personalInfo || {},
      address: data?.address || {},
      identityDocument: data?.identityDocument || {},
      documents: data?.documents || [],
      verificationHistory: data?.verificationHistory || [],
      complianceFlags: data?.complianceFlags || [],
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnThis(),
      ...data
    };
    mockProfile.save.mockResolvedValue(mockProfile);
    return mockProfile;
  });

  // Add static methods to the constructor
  MockKycProfile.findOne = jest.fn();
  MockKycProfile.find = jest.fn();
  MockKycProfile.findById = jest.fn();
  MockKycProfile.countDocuments = jest.fn();
  MockKycProfile.aggregate = jest.fn();
  MockKycProfile.findOneAndUpdate = jest.fn();
  MockKycProfile.create = jest.fn();

  return MockKycProfile;
});

jest.mock('../src/models/Verification', () => {
  const MockVerification = {
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn()
  };
  return MockVerification;
});

jest.mock('../src/services/complianceService', () => ({
  performComplianceCheck: jest.fn()
}));

jest.mock('multer');

describe('KYC Service', () => {
  // Create mock profile data that will be used across tests
  const createMockProfile = (overrides = {}) => {
    const mockProfile = {
      _id: 'profile-id',
      userId: 'user-id',
      profileId: 'profile-id',
      verificationStatus: 'pending',
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'Sierra Leone',
        phoneNumber: '+23212345678',
        email: 'john.doe@example.com'
      },
      address: {
        street: '123 Main St',
        city: 'Freetown',
        state: 'Western Area',
        zipCode: '00232',
        country: 'Sierra Leone'
      },
      identityDocument: {
        type: 'passport',
        number: 'A1234567',
        issuingCountry: 'Sierra Leone',
        expiryDate: '2030-12-31'
      },
      documents: [],
      verificationHistory: [],
      complianceFlags: [],
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnThis(),
      ...overrides
    };
    
    mockProfile.save.mockResolvedValue(mockProfile);
    return mockProfile;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks for KycProfile static methods
    KycProfile.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null)
    });
    KycProfile.find.mockResolvedValue([]);
    KycProfile.create.mockImplementation((data) => Promise.resolve(createMockProfile(data)));

    // Setup mocks for Verification
    Verification.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        status: 'verified',
        createdAt: new Date()
      })
    });

    // Mock compliance service
    complianceService.performComplianceCheck.mockResolvedValue({
      passed: true,
      riskScore: 'low',
      checks: {
        sanctions: { passed: true },
        pep: { passed: true },
        adverseMedia: { passed: true }
      }
    });
  });

  describe('createKYCProfile', () => {
    const profileData = {
      userId: 'user-id',
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'Sierra Leone',
        phoneNumber: '+23212345678',
        email: 'john.doe@example.com'
      },
      address: {
        street: '123 Main St',
        city: 'Freetown',
        state: 'Western Area',
        zipCode: '00232',
        country: 'Sierra Leone'
      },
      identityDocument: {
        type: 'passport',
        number: 'A1234567',
        issuingCountry: 'Sierra Leone',
        expiryDate: '2030-12-31'
      },
      riskLevel: 'low'
    };

    it('should create a new KYC profile successfully', async () => {
      // Mock to return null for existing profile
      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(null)
      });
      
      const result = await kycService.createKYCProfile(profileData);

      expect(KycProfile.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
      expect(KycProfile).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-id'
      }));
    });

    it('should throw error if profile already exists', async () => {
      // Mock to return existing profile
      const mockProfile = createMockProfile();
      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      await expect(kycService.createKYCProfile(profileData))
        .rejects.toThrow('KYC profile already exists');
    });

    it('should validate required personal information', async () => {
      const invalidData = {
        userId: 'user-id',
        personalInfo: {
          firstName: 'John',
          dateOfBirth: '1990-01-01'
          // missing lastName, nationality, phoneNumber, email
        },
        address: {
          street: '123 Main St',
          city: 'Freetown',
          state: 'Western Area',
          zipCode: '00232',
          country: 'Sierra Leone'
        },
        identityDocument: {
          type: 'passport',
          number: 'A1234567',
          issuingCountry: 'Sierra Leone',
          expiryDate: '2030-12-31'
        }
      };

      await expect(kycService.createKYCProfile(invalidData))
        .rejects.toThrow('Missing required personal information');
    });
  });

  describe('updateKYCProfile', () => {
    it('should update KYC profile successfully', async () => {
      const mockProfile = createMockProfile({
        verificationStatus: 'pending',
        personalInfo: { firstName: 'John', lastName: 'Doe' }
      });

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      const updateData = { personalInfo: { firstName: 'Jane', lastName: 'Smith' } };
      const result = await kycService.updateKYCProfile('user-id', updateData);

      expect(mockProfile.personalInfo.firstName).toBe('Jane');
      expect(mockProfile.personalInfo.lastName).toBe('Smith');
      expect(mockProfile.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent profile', async () => {
      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(null)
      });

      await expect(kycService.updateKYCProfile('user-id', {}))
        .rejects.toThrow('KYC profile not found');
    });

    it('should not allow updates to verified profiles', async () => {
      const mockProfile = createMockProfile({ verificationStatus: 'verified' });

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      await expect(kycService.updateKYCProfile('user-id', {}))
        .rejects.toThrow('Cannot update verified profile');
    });
  });

  describe('uploadDocument', () => {
    it('should upload document successfully', async () => {
      const mockProfile = createMockProfile();

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      const documentData = {
        type: 'passport',
        file: { filename: 'passport.jpg', mimetype: 'image/jpeg' }
      };

      const result = await kycService.uploadDocument('user-id', documentData);

      expect(mockProfile.documents).toHaveLength(1);
      expect(mockProfile.documents[0].type).toBe('passport');
      expect(mockProfile.save).toHaveBeenCalled();
    });

    it('should validate document type', async () => {
      const mockProfile = createMockProfile();

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      const invalidDocument = {
        type: 'invalid-type',
        file: { filename: 'test.jpg', mimetype: 'image/jpeg' }
      };

      await expect(kycService.uploadDocument('user-id', invalidDocument))
        .rejects.toThrow('Invalid document type');
    });

    it('should validate file format', async () => {
      const mockProfile = createMockProfile();

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      const invalidDocument = {
        type: 'passport',
        file: { filename: 'test.txt', mimetype: 'text/plain' }
      };

      await expect(kycService.uploadDocument('user-id', invalidDocument))
        .rejects.toThrow('Invalid file format');
    });
  });

  describe('verifyKYC', () => {
    it('should verify KYC profile successfully', async () => {
      const mockProfile = createMockProfile({
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'Sierra Leone',
          phoneNumber: '+23212345678',
          email: 'john.doe@example.com'
        },
        identityDocument: {
          type: 'passport',
          number: 'A1234567',
          issuingCountry: 'Sierra Leone',
          expiryDate: '2030-12-31'
        },
        documents: [{ type: 'passport', filename: 'passport.jpg' }]
      });

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      const result = await kycService.verifyKYC('user-id');

      expect(complianceService.performComplianceCheck).toHaveBeenCalled();
      expect(mockProfile.verificationStatus).toBe('verified');
      expect(mockProfile.save).toHaveBeenCalled();
    });

    it('should reject KYC if compliance check fails', async () => {
      const mockProfile = createMockProfile({
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'Sierra Leone',
          phoneNumber: '+23212345678',
          email: 'john.doe@example.com'
        },
        identityDocument: {
          type: 'passport',
          number: 'A1234567',
          issuingCountry: 'Sierra Leone',
          expiryDate: '2030-12-31'
        },
        documents: [{ type: 'passport', filename: 'passport.jpg' }]
      });

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });
      
      // Override compliance service for this specific test
      complianceService.performComplianceCheck.mockResolvedValueOnce({
        passed: false,
        riskScore: 'high',
        checks: {
          sanctions: { passed: false, reason: 'Found on sanctions list' }
        }
      });

      const result = await kycService.verifyKYC('user-id');

      expect(mockProfile.verificationStatus).toBe('rejected');
      expect(mockProfile.rejectionReason).toContain('sanctions list');
      expect(mockProfile.save).toHaveBeenCalled();
    });

    it('should throw error for profile not ready for verification', async () => {
      const mockProfile = createMockProfile({ documents: [] });

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      await expect(kycService.verifyKYC('user-id'))
        .rejects.toThrow('Profile not ready for verification');
    });
  });

  describe('getKYCStatus', () => {
    it('should return KYC status', async () => {
      const mockProfile = createMockProfile({
        verificationStatus: 'verified',
        riskLevel: 'low'
      });

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      const result = await kycService.getKYCStatus('user-id');

      expect(result.verificationStatus).toBe('verified');
      expect(result.riskLevel).toBe('low');
    });

    it('should return null for non-existent profile', async () => {
      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(null)
      });

      const result = await kycService.getKYCStatus('user-id');

      expect(result).toBeNull();
    });
  });

  describe('validatePersonalInfo', () => {
    it('should validate correct personal information', () => {
      const validInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US'
      };

      expect(() => kycService.validatePersonalInfo(validInfo))
        .not.toThrow();
    });

    it('should reject invalid date of birth', () => {
      const invalidInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: 'invalid-date',
        nationality: 'US'
      };

      expect(() => kycService.validatePersonalInfo(invalidInfo))
        .toThrow('Invalid date of birth');
    });

    it('should reject underage users', () => {
      const underageInfo = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 years old
        nationality: 'US'
      };

      expect(() => kycService.validatePersonalInfo(underageInfo))
        .toThrow('User must be at least 18 years old');
    });
  });

  describe('schedulePeriodicReview', () => {
    it('should schedule periodic review for high-risk profiles', async () => {
      const mockProfile = createMockProfile({ 
        riskLevel: 'high',
        nextReviewDate: null
      });

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      await kycService.schedulePeriodicReview('user-id');

      expect(mockProfile.nextReviewDate).toBeDefined();
      expect(mockProfile.save).toHaveBeenCalled();
    });

    it('should not schedule review for low-risk profiles', async () => {
      const mockProfile = createMockProfile({ 
        riskLevel: 'low',
        nextReviewDate: null
      });

      KycProfile.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockProfile)
      });

      await kycService.schedulePeriodicReview('user-id');

      expect(mockProfile.nextReviewDate).toBeNull();
      expect(mockProfile.save).not.toHaveBeenCalled();
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate compliance report', async () => {
      const mockProfiles = [
        createMockProfile({ verificationStatus: 'verified', riskLevel: 'low' }),
        createMockProfile({ verificationStatus: 'rejected', riskLevel: 'high' })
      ];

      KycProfile.find.mockResolvedValueOnce(mockProfiles);

      const report = await kycService.generateComplianceReport();

      expect(report.totalProfiles).toBe(2);
      expect(report.verifiedProfiles).toBe(1);
      expect(report.rejectedProfiles).toBe(1);
      expect(report.riskDistribution.low).toBe(1);
      expect(report.riskDistribution.high).toBe(1);
    });
  });
});