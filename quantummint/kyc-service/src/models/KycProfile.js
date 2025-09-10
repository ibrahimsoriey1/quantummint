const mongoose = require('mongoose');

const kycProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  profileId: {
    type: String,
    required: true,
    unique: true
  },
  personalInfo: {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    middleName: {
      type: String
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    nationality: {
      type: String,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    phoneNumber: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    }
  },
  identityDocument: {
    type: {
      type: String,
      enum: ['passport', 'national_id', 'drivers_license'],
      required: true
    },
    number: {
      type: String,
      required: true
    },
    issuingCountry: {
      type: String,
      required: true
    },
    expiryDate: {
      type: Date,
      required: true
    }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_review', 'approved', 'rejected', 'requires_update'],
    default: 'pending'
  },
  verificationLevel: {
    type: String,
    enum: ['basic', 'intermediate', 'advanced'],
    default: 'basic'
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  verificationHistory: [{
    status: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'rejected', 'requires_update']
    },
    reason: String,
    reviewedBy: String,
    reviewedAt: Date,
    notes: String
  }],
  complianceFlags: [{
    type: {
      type: String,
      enum: ['sanctions_check', 'pep_check', 'adverse_media', 'watchlist']
    },
    status: {
      type: String,
      enum: ['clear', 'flagged', 'pending']
    },
    details: String,
    checkedAt: Date
  }],
  approvedAt: Date,
  rejectedAt: Date,
  lastUpdated: Date
}, {
  timestamps: true
});

// Indexes
kycProfileSchema.index({ userId: 1 });
kycProfileSchema.index({ profileId: 1 });
kycProfileSchema.index({ verificationStatus: 1 });
kycProfileSchema.index({ verificationLevel: 1 });
kycProfileSchema.index({ 'personalInfo.email': 1 });
kycProfileSchema.index({ 'identityDocument.number': 1 });

module.exports = mongoose.model('KycProfile', kycProfileSchema);
