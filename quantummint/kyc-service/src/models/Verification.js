const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  verificationId: {
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
    enum: ['identity', 'address', 'phone', 'email', 'biometric', 'comprehensive']
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'expired'],
    default: 'pending'
  },
  method: {
    type: String,
    enum: ['document_upload', 'live_verification', 'third_party_api', 'manual_review'],
    required: true
  },
  provider: {
    type: String,
    enum: ['internal', 'jumio', 'onfido', 'trulioo', 'manual']
  },
  steps: [{
    stepId: String,
    name: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'skipped']
    },
    completedAt: Date,
    data: Object,
    errors: [String]
  }],
  results: {
    overallScore: {
      type: Number,
      min: 0,
      max: 100
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    checks: [{
      type: String,
      name: String,
      status: {
        type: String,
        enum: ['pass', 'fail', 'warning', 'pending']
      },
      score: Number,
      details: String,
      data: Object
    }],
    extractedData: Object,
    flags: [{
      type: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      description: String,
      recommendation: String
    }]
  },
  documents: [{
    documentId: String,
    type: String,
    status: String,
    verificationScore: Number
  }],
  timeline: [{
    event: String,
    timestamp: Date,
    details: String,
    performedBy: String
  }],
  reviewNotes: String,
  reviewedBy: String,
  reviewedAt: Date,
  completedAt: Date,
  expiresAt: Date,
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceFingerprint: String,
    sessionId: String,
    referenceId: String
  }
}, {
  timestamps: true
});

// Indexes
verificationSchema.index({ verificationId: 1 });
verificationSchema.index({ userId: 1, type: 1 });
verificationSchema.index({ profileId: 1 });
verificationSchema.index({ status: 1 });
verificationSchema.index({ createdAt: -1 });
verificationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Verification', verificationSchema);
