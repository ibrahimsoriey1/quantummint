const Joi = require('joi');
const logger = require('../utils/logger');

const kycProfileSchema = Joi.object({
  userId: Joi.string().required(),
  personalInfo: Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    middleName: Joi.string().min(2).max(50).optional(),
    dateOfBirth: Joi.date().max('now').required(),
    nationality: Joi.string().length(2).required(),
    gender: Joi.string().valid('male', 'female', 'other').required(),
    phoneNumber: Joi.string().min(10).max(20).required(),
    email: Joi.string().email().required()
  }).required(),
  address: Joi.object({
    street: Joi.string().min(5).max(200).required(),
    city: Joi.string().min(2).max(100).required(),
    state: Joi.string().min(2).max(100).required(),
    postalCode: Joi.string().min(3).max(20).required(),
    country: Joi.string().length(2).required()
  }).required(),
  identityDocument: Joi.object({
    type: Joi.string().valid('passport', 'national_id', 'drivers_license').required(),
    number: Joi.string().min(5).max(50).required(),
    issuingCountry: Joi.string().length(2).required(),
    expiryDate: Joi.date().min('now').required()
  }).required()
});

const kycQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('pending', 'in_review', 'approved', 'rejected', 'requires_update').optional(),
  level: Joi.string().valid('basic', 'intermediate', 'advanced').optional(),
  riskLevel: Joi.string().valid('low', 'medium', 'high').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional()
});

const documentUploadSchema = Joi.object({
  userId: Joi.string().required(),
  profileId: Joi.string().required(),
  type: Joi.string().valid('identity_front', 'identity_back', 'proof_of_address', 'selfie', 'bank_statement', 'utility_bill', 'other').required(),
  category: Joi.string().valid('identity', 'address', 'financial', 'biometric').required()
});

const verificationRequestSchema = Joi.object({
  userId: Joi.string().required(),
  profileId: Joi.string().required(),
  type: Joi.string().valid('identity', 'address', 'phone', 'email', 'biometric', 'comprehensive').required(),
  method: Joi.string().valid('document_upload', 'live_verification', 'third_party_api', 'manual_review').required(),
  provider: Joi.string().valid('internal', 'jumio', 'onfido', 'trulioo', 'manual').optional(),
  metadata: Joi.object().optional()
});

const validateKycProfile = (req, res, next) => {
  const { error, value } = kycProfileSchema.validate(req.body);
  
  if (error) {
    logger.error('KYC profile validation error:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.body = value;
  next();
};

const validateKycQuery = (req, res, next) => {
  const { error, value } = kycQuerySchema.validate(req.query);
  
  if (error) {
    logger.error('KYC query validation error:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Query validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.query = value;
  next();
};

const validateDocumentUpload = (req, res, next) => {
  const { error, value } = documentUploadSchema.validate(req.body);
  
  if (error) {
    logger.error('Document upload validation error:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.body = value;
  next();
};

const validateVerificationRequest = (req, res, next) => {
  const { error, value } = verificationRequestSchema.validate(req.body);
  
  if (error) {
    logger.error('Verification request validation error:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.body = value;
  next();
};

module.exports = {
  validateKycProfile,
  validateKycQuery,
  validateDocumentUpload,
  validateVerificationRequest
};
