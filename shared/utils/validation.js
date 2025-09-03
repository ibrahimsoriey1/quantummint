const Joi = require('joi');

// Common validation schemas
const commonSchemas = {
  id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).required(),
  amount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'QMT').required(),
  walletAddress: Joi.string().pattern(/^QM[A-Z0-9]+$/).required(),
  date: Joi.date().iso().required(),
  boolean: Joi.boolean().required(),
  string: Joi.string().required(),
  number: Joi.number().required()
};

// User validation schemas
const userSchemas = {
  register: Joi.object({
    username: commonSchemas.username,
    email: commonSchemas.email,
    password: commonSchemas.password,
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: commonSchemas.phone.optional(),
    dateOfBirth: commonSchemas.date.optional(),
    profilePicture: Joi.string().uri().optional()
  }),

  login: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: commonSchemas.phone.optional(),
    dateOfBirth: commonSchemas.date.optional(),
    profilePicture: Joi.string().uri().optional(),
    preferences: Joi.object({
      notifications: Joi.object({
        email: commonSchemas.boolean.optional(),
        sms: commonSchemas.boolean.optional(),
        push: commonSchemas.boolean.optional()
      }).optional(),
      language: Joi.string().valid('en', 'fr', 'es', 'de').optional(),
      timezone: Joi.string().optional()
    }).optional()
  }),

  changePassword: Joi.object({
    currentPassword: commonSchemas.password,
    newPassword: commonSchemas.password
  }),

  enable2FA: Joi.object({
    secret: Joi.string().required(),
    token: Joi.string().length(6).pattern(/^\d+$/).required()
  }),

  verify2FA: Joi.object({
    token: Joi.string().length(6).pattern(/^\d+$/).required()
  })
};

// Wallet validation schemas
const walletSchemas = {
  create: Joi.object({
    currency: commonSchemas.currency,
    pin: Joi.string().length(4).pattern(/^\d+$/).optional(),
    biometricEnabled: commonSchemas.boolean.optional(),
    multiSigEnabled: commonSchemas.boolean.optional()
  }),

  transfer: Joi.object({
    fromWalletId: commonSchemas.id,
    toWalletId: commonSchemas.id,
    amount: commonSchemas.amount,
    currency: commonSchemas.currency,
    description: Joi.string().max(500).optional(),
    pin: Joi.string().length(4).pattern(/^\d+$/).optional()
  }),

  deposit: Joi.object({
    walletId: commonSchemas.id,
    amount: commonSchemas.amount,
    currency: commonSchemas.currency,
    paymentMethod: Joi.string().required(),
    description: Joi.string().max(500).optional()
  }),

  withdrawal: Joi.object({
    walletId: commonSchemas.id,
    amount: commonSchemas.amount,
    currency: commonSchemas.currency,
    destination: Joi.string().required(),
    description: Joi.string().max(500).optional(),
    pin: Joi.string().length(4).pattern(/^\d+$/).optional()
  })
};

// Money generation validation schemas
const generationSchemas = {
  generate: Joi.object({
    method: Joi.string().valid('mining', 'staking', 'referral', 'bonus', 'airdrop').required(),
    amount: commonSchemas.amount,
    currency: commonSchemas.currency,
    walletId: commonSchemas.id,
    parameters: Joi.object().optional()
  }),

  setLimits: Joi.object({
    walletId: commonSchemas.id,
    daily: Joi.number().positive().optional(),
    monthly: Joi.number().positive().optional(),
    yearly: Joi.number().positive().optional()
  })
};

// Transaction validation schemas
const transactionSchemas = {
  create: Joi.object({
    fromWalletId: commonSchemas.id,
    toWalletId: commonSchemas.id,
    amount: commonSchemas.amount,
    currency: commonSchemas.currency,
    type: Joi.string().valid('transfer', 'deposit', 'withdrawal', 'generation').required(),
    description: Joi.string().max(500).optional(),
    metadata: Joi.object().optional()
  }),

  update: Joi.object({
    status: Joi.string().valid('pending', 'completed', 'failed', 'cancelled').optional(),
    description: Joi.string().max(500).optional(),
    metadata: Joi.object().optional()
  })
};

// Payment validation schemas
const paymentSchemas = {
  create: Joi.object({
    amount: commonSchemas.amount,
    currency: commonSchemas.currency,
    paymentMethod: Joi.string().required(),
    provider: Joi.string().required(),
    walletId: commonSchemas.id,
    description: Joi.string().max(500).optional(),
    metadata: Joi.object().optional()
  }),

  webhook: Joi.object({
    provider: Joi.string().required(),
    event: Joi.string().required(),
    data: Joi.object().required(),
    signature: Joi.string().optional()
  })
};

// KYC validation schemas
const kycSchemas = {
  createProfile: Joi.object({
    userId: commonSchemas.id,
    documentType: Joi.string().valid('passport', 'national_id', 'drivers_license', 'utility_bill').required(),
    documentNumber: Joi.string().required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    dateOfBirth: commonSchemas.date,
    nationality: Joi.string().required(),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required(),
      postalCode: Joi.string().required()
    }).required()
  }),

  uploadDocument: Joi.object({
    profileId: commonSchemas.id,
    documentType: Joi.string().valid('passport', 'national_id', 'drivers_license', 'utility_bill', 'selfie').required(),
    file: Joi.object().required(),
    description: Joi.string().max(500).optional()
  }),

  verify: Joi.object({
    profileId: commonSchemas.id,
    verificationMethod: Joi.string().valid('manual', 'automated', 'third_party').required(),
    notes: Joi.string().max(1000).optional()
  })
};

// Generic validation function
const validate = (schema, data) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    throw new Error(JSON.stringify(errors));
  }
  
  return value;
};

// Sanitization functions
const sanitize = {
  email: (email) => email.toLowerCase().trim(),
  phone: (phone) => phone.replace(/[^\d+()-]/g, ''),
  username: (username) => username.toLowerCase().trim(),
  amount: (amount) => parseFloat(parseFloat(amount).toFixed(2)),
  string: (str) => str.trim(),
  object: (obj) => {
    const sanitized = {};
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        sanitized[key] = obj[key].trim();
      } else {
        sanitized[key] = obj[key];
      }
    });
    return sanitized;
  }
};

module.exports = {
  schemas: {
    common: commonSchemas,
    user: userSchemas,
    wallet: walletSchemas,
    generation: generationSchemas,
    transaction: transactionSchemas,
    payment: paymentSchemas,
    kyc: kycSchemas
  },
  validate,
  sanitize
};
