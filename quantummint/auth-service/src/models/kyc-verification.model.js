const mongoose = require('mongoose');

const kycVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  verificationType: {
    type: String,
    required: true,
    enum: ['identity', 'address', 'both']
  },
  documentType: {
    type: String,
    required: true,
    enum: ['passport', 'national_id', 'drivers_license']
  },
  documentNumber: {
    type: String,
    required: true
  },
  documentExpiryDate: {
    type: Date,
    required: true
  },
  documentFrontImage: {
    type: String,
    required: true
  },
  documentBackImage: String,
  selfieImage: {
    type: String,
    required: true
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
    index: true
  },
  verificationNotes: String,
  verifiedBy: mongoose.Schema.Types.ObjectId,
  rejectionReason: String,
  verifiedAt: Date
}, {
  timestamps: true
});

// Indexes
kycVerificationSchema.index({ userId: 1, verificationStatus: 1 });
kycVerificationSchema.index({ createdAt: -1 });

const KYCVerification = mongoose.model('KYCVerification', kycVerificationSchema);

module.exports = KYCVerification;