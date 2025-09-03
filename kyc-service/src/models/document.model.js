const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: [
      'id_card', 
      'passport', 
      'driving_license', 
      'utility_bill', 
      'bank_statement', 
      'selfie', 
      'proof_of_address',
      'other'
    ],
    required: [true, 'Document type is required']
  },
  subType: {
    type: String,
    default: null
  },
  purpose: {
    type: String,
    enum: ['identity', 'address', 'selfie', 'enhanced_due_diligence'],
    required: [true, 'Document purpose is required']
  },
  tier: {
    type: String,
    enum: ['tier_1', 'tier_2', 'tier_3'],
    required: [true, 'Document tier is required']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  fileName: {
    type: String,
    required: [true, 'File name is required']
  },
  fileKey: {
    type: String,
    required: [true, 'File key is required']
  },
  fileUrl: {
    type: String,
    default: null
  },
  fileType: {
    type: String,
    required: [true, 'File type is required']
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required']
  },
  issuingCountry: {
    type: String,
    default: null
  },
  documentNumber: {
    type: String,
    default: null
  },
  issuedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  verificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Verification',
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
  rejectionReason: {
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
documentSchema.index({ userId: 1, type: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ tier: 1 });
documentSchema.index({ fileKey: 1 }, { unique: true });

// Create model from schema
const Document = mongoose.model('Document', documentSchema);

module.exports = Document;