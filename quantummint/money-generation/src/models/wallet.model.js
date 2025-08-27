const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  walletType: {
    type: String,
    required: true,
    enum: ['standard', 'premium', 'business'],
    default: 'standard'
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive', 'suspended', 'closed'],
    default: 'active',
    index: true
  },
  dailyGenerationLimit: {
    type: Number,
    required: true,
    default: 1000
  },
  monthlyGenerationLimit: {
    type: Number,
    required: true,
    default: 10000
  },
  totalGenerated: {
    type: Number,
    default: 0
  },
  dailyGenerated: {
    type: Number,
    default: 0
  },
  monthlyGenerated: {
    type: Number,
    default: 0
  },
  lastGenerationDate: Date,
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
walletSchema.index({ userId: 1, currency: 1 });
walletSchema.index({ status: 1 });
walletSchema.index({ walletType: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;