const mongoose = require('mongoose');
const crypto = require('crypto');

const systemConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Configuration key is required'],
    unique: true,
    trim: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Configuration value is required']
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: [true, 'Configuration category is required'],
    enum: [
      'system', 'security', 'payment', 'kyc', 'generation', 'notification',
      'limits', 'fees', 'api', 'database', 'cache', 'monitoring'
    ],
    index: true
  },
  isEncrypted: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    default: 'string'
  },
  validationRules: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Last modified by is required']
  },
  version: {
    type: Number,
    default: 1
  },
  tags: {
    type: [String],
    default: []
  },
  environment: {
    type: String,
    enum: ['development', 'staging', 'production', 'all'],
    default: 'all'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
systemConfigSchema.index({ category: 1, key: 1 });
systemConfigSchema.index({ isPublic: 1 });
systemConfigSchema.index({ environment: 1 });
systemConfigSchema.index({ tags: 1 });

// Pre-save hook to encrypt sensitive values
systemConfigSchema.pre('save', function(next) {
  if (this.isEncrypted && typeof this.value === 'string') {
    // In a real implementation, you would use proper encryption
    // This is a placeholder for demonstration
    this.value = this.encryptValue(this.value);
  }
  next();
});

// Method to encrypt value
systemConfigSchema.methods.encryptValue = function(value) {
  // Placeholder encryption - implement proper encryption in production
  return crypto.createHash('sha256').update(value).digest('hex');
};

// Method to decrypt value
systemConfigSchema.methods.decryptValue = function() {
  if (!this.isEncrypted) {
    return this.value;
  }
  // Placeholder decryption - implement proper decryption in production
  return this.value; // In real implementation, decrypt here
};

// Method to validate value based on validation rules
systemConfigSchema.methods.validateValue = function(value) {
  if (!this.validationRules || Object.keys(this.validationRules).length === 0) {
    return { isValid: true };
  }

  const rules = this.validationRules;
  const errors = [];

  // Type validation
  if (rules.type && typeof value !== rules.type) {
    errors.push(`Value must be of type ${rules.type}`);
  }

  // String validations
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`String must be at least ${rules.minLength} characters long`);
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`String must be at most ${rules.maxLength} characters long`);
    }
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      errors.push(`String must match pattern ${rules.pattern}`);
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`Number must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && value > rules.max) {
      errors.push(`Number must be at most ${rules.max}`);
    }
  }

  // Array validations
  if (Array.isArray(value)) {
    if (rules.minItems && value.length < rules.minItems) {
      errors.push(`Array must have at least ${rules.minItems} items`);
    }
    if (rules.maxItems && value.length > rules.maxItems) {
      errors.push(`Array must have at most ${rules.maxItems} items`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

// Create model from schema
const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

module.exports = SystemConfig;
