const mongoose = require('mongoose');

const generationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be at least 0.01']
  },
  method: {
    type: String,
    enum: ['standard', 'accelerated', 'premium'],
    required: [true, 'Generation method is required']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'verified', 'rejected'],
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
    type: String,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  transactionId: {
    type: String,
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
generationSchema.index({ status: 1 });
generationSchema.index({ method: 1 });
generationSchema.index({ verificationStatus: 1 });

// Create model from schema
const Generation = mongoose.model('Generation', generationSchema);

module.exports = Generation;