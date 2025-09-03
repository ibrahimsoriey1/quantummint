const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: ['email', 'phone', 'identity', 'address', 'selfie', 'enhanced_due_diligence'],
    required: [true, 'Verification type is required']
  },
  tier: {
    type: String,
    enum: ['tier_1', 'tier_2', 'tier_3'],
    required: [true, 'Verification tier is required']
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  verificationData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  verifiedBy: {
    type: String,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  attempts: {
    type: Number,
    default: 0
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
verificationSchema.index({ userId: 1, type: 1, tier: 1 });
verificationSchema.index({ status: 1 });
verificationSchema.index({ expiresAt: 1 });

// Create model from schema
const Verification = mongoose.model('Verification', verificationSchema);

module.exports = Verification;