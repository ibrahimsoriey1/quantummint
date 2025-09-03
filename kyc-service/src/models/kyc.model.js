const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  currentTier: {
    type: String,
    enum: ['none', 'tier_1', 'tier_2', 'tier_3'],
    default: 'none'
  },
  personalInfo: {
    firstName: {
      type: String,
      required: [true, 'First name is required']
    },
    middleName: {
      type: String,
      default: ''
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required']
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    nationality: {
      type: String,
      required: [true, 'Nationality is required']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: 'prefer_not_to_say'
    }
  },
  contactInfo: {
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required']
    },
    address: {
      street: {
        type: String,
        default: ''
      },
      city: {
        type: String,
        default: ''
      },
      state: {
        type: String,
        default: ''
      },
      postalCode: {
        type: String,
        default: ''
      },
      country: {
        type: String,
        required: [true, 'Country is required']
      }
    }
  },
  verifications: [{
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
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending'
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
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
    expiresAt: {
      type: Date,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  notes: {
    type: String,
    default: ''
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
kycSchema.index({ userId: 1 });
kycSchema.index({ status: 1 });
kycSchema.index({ currentTier: 1 });
kycSchema.index({ 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 });
kycSchema.index({ 'contactInfo.email': 1 });
kycSchema.index({ 'contactInfo.phoneNumber': 1 });

// Create model from schema
const KYC = mongoose.model('KYC', kycSchema);

module.exports = KYC;