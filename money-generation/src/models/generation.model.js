const mongoose = require('mongoose');

const generationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Wallet ID is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be at least 0.01']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'USD'
  },
  generationMethod: {
    type: String,
    enum: ['standard', 'accelerated', 'premium', 'instant', 'scheduled'],
    required: [true, 'Generation method is required']
  },
  generationParams: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'verified', 'rejected', 'cancelled'],
    default: 'pending'
  },
  verificationStatus: {
    type: String,
    enum: ['not_required', 'pending', 'approved', 'rejected'],
    default: 'not_required'
  },
  verificationReason: {
    type: String,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  },
  kycLevel: {
    type: String,
    enum: ['none', 'tier_1', 'tier_2', 'tier_3'],
    default: 'none'
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  deviceInfo: {
    type: String,
    default: null
  },
  location: {
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    country: {
      type: String,
      default: null
    },
    city: {
      type: String,
      default: null
    }
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
generationSchema.index({ userId: 1, createdAt: -1 });
generationSchema.index({ walletId: 1 });
generationSchema.index({ status: 1 });
generationSchema.index({ generationMethod: 1 });
generationSchema.index({ verificationStatus: 1 });
generationSchema.index({ createdAt: -1 });

// Create model from schema
const Generation = mongoose.model('Generation', generationSchema);

module.exports = Generation;