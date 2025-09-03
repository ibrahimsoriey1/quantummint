
const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Provider name is required'],
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Provider code is required'],
    unique: true,
    trim: true,
    enum: ['stripe', 'orange_money', 'afrimoney']
  },
  type: {
    type: String,
    enum: ['payment', 'withdrawal', 'both'],
    default: 'both'
  },
  description: {
    type: String,
    default: ''
  },
  logo: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  supportedCountries: {
    type: [String],
    default: []
  },
  supportedCurrencies: {
    type: [String],
    default: []
  },
  minAmount: {
    type: Number,
    default: 0.01
  },
  maxAmount: {
    type: Number,
    default: 10000
  },
  processingTime: {
    type: String,
    default: 'Instant'
  },
  feeStructure: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      type: 'percentage',
      value: 0
    }
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
  webhookEndpoint: {
    type: String,
    default: null
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

// Create model from schema
const Provider = mongoose.model('Provider', providerSchema);

module.exports = Provider;
