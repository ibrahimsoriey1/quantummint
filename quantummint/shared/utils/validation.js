const Joi = require('joi');

// Common validation schemas
const schemas = {
  // User validation schemas
  userRegistration: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      }),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().max('now').optional()
  }),

  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    twoFactorCode: Joi.string().length(6).pattern(/^[0-9]+$/).optional(),
    rememberMe: Joi.boolean().optional()
  }),

  userUpdate: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    preferences: Joi.object({
      notifications: Joi.object({
        email: Joi.boolean().optional(),
        sms: Joi.boolean().optional(),
        push: Joi.boolean().optional()
      }).optional(),
      language: Joi.string().valid('en', 'fr', 'es', 'de').optional(),
      timezone: Joi.string().optional(),
      currency: Joi.string().valid('USD', 'EUR', 'GBP', 'QMC').optional()
    }).optional()
  }),

  passwordChange: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({
        'any.only': 'Passwords do not match'
      })
  }),

  // Transaction validation schemas
  moneyGeneration: Joi.object({
    amount: Joi.number().positive().max(10000).required(),
    method: Joi.string().valid('quantum', 'mining', 'staking', 'rewards').required(),
    description: Joi.string().max(500).optional()
  }),

  moneyTransfer: Joi.object({
    toUserId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    toEmail: Joi.string().email().optional(),
    toUsername: Joi.string().alphanum().min(3).max(30).optional(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().valid('QMC', 'USD', 'EUR', 'GBP').default('QMC'),
    description: Joi.string().max(500).optional(),
    scheduledFor: Joi.date().min('now').optional()
  }).xor('toUserId', 'toEmail', 'toUsername'),

  // Payment validation schemas
  paymentMethod: Joi.object({
    type: Joi.string().valid('card', 'bank_account', 'mobile_money').required(),
    provider: Joi.string().valid('stripe', 'orange_money', 'afrimoney').required(),
    details: Joi.object().required(),
    isDefault: Joi.boolean().default(false)
  }),

  deposit: Joi.object({
    amount: Joi.number().positive().required(),
    paymentMethodId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP').required()
  }),

  withdrawal: Joi.object({
    amount: Joi.number().positive().required(),
    paymentMethodId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP').required()
  }),

  // KYC validation schemas
  kycProfile: Joi.object({
    documentType: Joi.string().valid('passport', 'national_id', 'drivers_license').required(),
    documentNumber: Joi.string().required(),
    documentCountry: Joi.string().length(2).required(),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().optional(),
      postalCode: Joi.string().required(),
      country: Joi.string().length(2).required()
    }).required(),
    occupation: Joi.string().optional(),
    sourceOfFunds: Joi.string().valid('employment', 'business', 'investment', 'inheritance', 'other').required()
  }),

  // Common validation schemas
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
  
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  dateRange: Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().min(Joi.ref('startDate')).optional()
  })
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    req[property] = value;
    next();
  };
};

// Custom validation functions
const customValidators = {
  // Check if user exists
  userExists: async (userId, User) => {
    const user = await User.findById(userId);
    return !!user;
  },

  // Check if wallet has sufficient balance
  sufficientBalance: async (userId, amount, Wallet) => {
    const wallet = await Wallet.findOne({ userId });
    return wallet && wallet.availableBalance >= amount;
  },

  // Check if amount is within daily limits
  withinDailyLimit: async (userId, amount, Transaction) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyTotal = await Transaction.aggregate([
      {
        $match: {
          fromUserId: userId,
          createdAt: { $gte: today },
          status: { $in: ['completed', 'processing'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const currentTotal = dailyTotal[0]?.total || 0;
    return (currentTotal + amount) <= 10000; // Daily limit of 10,000
  },

  // Validate file upload
  validateFile: (file, allowedTypes = ['jpg', 'jpeg', 'png', 'pdf'], maxSize = 10485760) => {
    if (!file) {
      return { valid: false, message: 'No file provided' };
    }

    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      return { valid: false, message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
    }

    if (file.size > maxSize) {
      return { valid: false, message: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` };
    }

    return { valid: true };
  }
};

module.exports = {
  schemas,
  validate,
  customValidators
};
