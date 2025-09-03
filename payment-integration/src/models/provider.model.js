const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Provider name is required'],
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['payment', 'withdrawal', 'both'],
    default: 'both'
  },
  apiEndpoint: {
    type: String,
    required: [true, 'API endpoint is required']
  },
  apiVersion: {
    type: String,
    default: 'v1'
  },
  authType: {
    type: String,
    enum: ['api_key', 'oauth', 'basic_auth', 'bearer_token', 'custom'],
    default: 'api_key'
  },
  credentials: {
    clientId: {
      type: String,
      default: null
    },
    clientSecret: {
      type: String,
      default: null
    },
    apiKey: {
      type: String,
      default: null
    },
    merchantId: {
      type: String,
      default: null
    },
    publicKey: {
      type: String,
      default: null
    },
    privateKey: {
      type: String,
      default: null
    }
  },
  webhookUrl: {
    type: String,
    default: null
  },
  webhookSecret: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'deprecated'],
    default: 'active'
  },
  supportedCurrencies: {
    type: [String],
    default: ['USD']
  },
  transactionLimits: {
    minAmount: {
      type: Number,
      default: 0.01
    },
    maxAmount: {
      type: Number,
      default: 10000
    },
    dailyLimit: {
      type: Number,
      default: 50000
    },
    monthlyLimit: {
      type: Number,
      default: 500000
    }
  },
  fees: {
    fixedFee: {
      type: Number,
      default: 0
    },
    percentageFee: {
      type: Number,
      default: 0
    },
    minFee: {
      type: Number,
      default: 0
    },
    maxFee: {
      type: Number,
      default: 100
    }
  },
  description: {
    type: String,
    default: ''
  },
  logo: {
    type: String,
    default: null
  },
  supportedCountries: {
    type: [String],
    default: []
  },
  processingTime: {
    type: String,
    default: 'Instant'
  },
  requiredKycLevel: {
    type: String,
    enum: ['none', 'tier_1', 'tier_2', 'tier_3'],
    default: 'none'
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
providerSchema.index({ name: 1 }, { unique: true });
providerSchema.index({ status: 1 });
providerSchema.index({ type: 1 });
providerSchema.index({ supportedCurrencies: 1 });
providerSchema.index({ supportedCountries: 1 });

// Create model from schema
const Provider = mongoose.model('Provider', providerSchema);

module.exports = Provider;