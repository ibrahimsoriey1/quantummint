const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  profileId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['identity_front', 'identity_back', 'proof_of_address', 'selfie', 'bank_statement', 'utility_bill', 'other']
  },
  category: {
    type: String,
    required: true,
    enum: ['identity', 'address', 'financial', 'biometric']
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'expired'],
    default: 'pending'
  },
  extractedData: {
    type: Object,
    default: {}
  },
  verificationResults: {
    quality: {
      score: Number,
      issues: [String]
    },
    authenticity: {
      score: Number,
      checks: [{
        type: String,
        passed: Boolean,
        details: String
      }]
    },
    dataExtraction: {
      confidence: Number,
      fields: Object
    }
  },
  metadata: {
    imageProperties: {
      width: Number,
      height: Number,
      format: String,
      colorSpace: String
    },
    exifData: Object,
    processingInfo: {
      processedAt: Date,
      processingTime: Number,
      version: String
    }
  },
  notes: String,
  rejectionReason: String,
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes
documentSchema.index({ documentId: 1 });
documentSchema.index({ userId: 1, type: 1 });
documentSchema.index({ profileId: 1 });
documentSchema.index({ verificationStatus: 1 });
documentSchema.index({ uploadedAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
